/* SGS RSL Failure Center V3.2F
   Fixes:
   1) Preserve official Report Number '/' exactly as printed in the PDF.
   2) Use Issued Date from the PDF.
   3) Parse SGS Korea PFAS rows by exact CAS number + Reporting Limit + Result.
   4) Do not treat analyte names (10:2 / 12:2), reporting limits, or group headers as results.
   5) Compare each result only with its exact regulatory group requirement.
*/
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let failedItems = [];

  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  function clean(value) {
    return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function pageText(content) {
    return clean((content.items || []).map(x => String(x.str || '').trim()).filter(Boolean).join(' '));
  }

  function normalizeReportNumber(value) {
    return String(value || '')
      .trim()
      .replace(/[／⁄∕]/g, '/')
      .replace(/[–—−]/g, '-')
      .replace(/\s*\/\s*/g, '/')
      .replace(/\s*-\s*/g, '-')
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9/_-]/gi, '');
  }

  function extractReportNumber(text) {
    const source = clean(text);
    const patterns = [
      /Test\s+Report\s+No\.?\s*[:#]?\s*([A-Z0-9][A-Z0-9/_\-\s]{5,80}?)(?=\s+(?:Issued\s+Date|Date|Page|This\s+document))/i,
      /Textile\s+Laboratory\s+Test\s+Report\s+No\.?\s*[:#]?\s*([A-Z0-9][A-Z0-9/_\-\s]{5,80}?)(?=\s+(?:Date|Page))/i,
      /Report\s+No\.?\s*[:#]?\s*([A-Z0-9][A-Z0-9/_\-\s]{5,80}?)(?=\s+(?:Issued\s+Date|Date|Page|Applicant))/i
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (!match) continue;
      const value = normalizeReportNumber(match[1]);
      if (value.length >= 6) return value;
    }
    return '';
  }

  function extractIssuedDate(text) {
    const match = clean(text).match(/Issued\s+Date\s*[:#]?\s*(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/i);
    if (!match) return '';
    return `${match[1]}-${String(match[2]).padStart(2,'0')}-${String(match[3]).padStart(2,'0')}`;
  }

  function failedItem(name, measured, limit) {
    return { substance:name, result:`${measured} mg/kg`, limit:`${limit} mg/kg` };
  }

  function findRequirement(text, exactLabel) {
    /*
     * Search the entire combined PFAS section and use the LAST exact
     * requirement occurrence. SGS Korea can place another test section's
     * Requirement block before the PFAS Requirement list on the same
     * combined page text. Stopping at the first "Requirement:" therefore
     * misses the PFAS limits.
     */
    const source = clean(text);
    const escaped = exactLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`(?:^|\\s)${escaped}\\s+\\d+(?:\\.\\d+)?\\s*ppb\\s*\\((\\d+(?:\\.\\d+)?)\\s*mg\\/kg\\)`, 'gi'),
      new RegExp(`(?:^|\\s)${escaped}\\s+(\\d+(?:\\.\\d+)?)\\s*mg\\/kg`, 'gi')
    ];
    const values = [];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(source))) {
        values.push({ index: match.index, value: Number(match[1]) });
        if (pattern.lastIndex === match.index) pattern.lastIndex++;
      }
    }
    if (!values.length) return null;
    values.sort((a,b) => a.index - b.index);
    return values[values.length - 1].value;
  }

  function findCasResult(text, casNumber) {
    const escaped = casNumber.replace(/-/g, '\\-');
    // SGS Korea PFAS layout: CAS-No. | Reporting Limit | Result.
    // Result must be the token immediately after the reporting-limit number.
    const regex = new RegExp(`${escaped}\\s+(\\d+(?:\\.\\d+)?)\\s+(n\\.?d\\.?|not detected|\\d+(?:\\.\\d+)?)`, 'i');
    const match = clean(text).match(regex);
    if (!match || /n\.?d\.?|not detected/i.test(match[2])) return null;
    return Number(match[2]);
  }

  function findTotalResult(text, exactLabel) {
    const escaped = exactLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escaped}\\s+--\\s+--\\s+(n\\.?d\\.?|not detected|\\d+(?:\\.\\d+)?)`, 'i');
    const match = clean(text).match(regex);
    if (!match || /n\.?d\.?|not detected/i.test(match[1])) return null;
    return Number(match[1]);
  }

  function parsePfas(text) {
    const source = clean(text);
    if (!/Per-\s*&?\s*Polyfluoroalkyl\s+Substances\s*\(PFAS\)|PFAS\s*-\s*Target\s+Analysis/i.test(source)) return [];
    if (!/Conclusion\s*(?:--\s*){0,2}FAIL\s*\*/i.test(source)) return [];

    const definitions = [
      { name:'6:2 FTOH', cas:'647-42-7', requirement:'PFHxA-related Substances' },
      { name:'8:2 FTOH', cas:'678-39-7', requirement:'PFOA-related Substances' },
      { name:'10:2 FTOH', cas:'865-86-1', requirement:'C9-C14 PFCA-related Substances' },
      { name:'12:2 FTOH', cas:'39239-77-5', requirement:'C9-C14 PFCA-related Substances' }
    ];

    const output = [];
    for (const item of definitions) {
      const measured = findCasResult(source, item.cas);
      const limit = findRequirement(source, item.requirement);
      if (measured !== null && limit !== null && measured > limit) {
        output.push(failedItem(item.name, measured, limit));
      }
    }

    const totals = [
      { name:'Total PFHxA-related Substances', label:'Total PFHxA-related Substances', requirement:'PFHxA-related Substances' },
      { name:'Total PFOA-related Substances', label:'Total of PFOA-related Substances', requirement:'PFOA-related Substances' },
      { name:'Total C9-C14 PFCA-related Substances', label:'Total of C9-C14 PFCA-related Substances', requirement:'C9-C14 PFCA-related Substances' }
    ];

    for (const item of totals) {
      const measured = findTotalResult(source, item.label);
      const limit = findRequirement(source, item.requirement);
      if (measured !== null && limit !== null && measured > limit) {
        output.push(failedItem(item.name, measured, limit));
      }
    }
    return output;
  }

  function parseBisphenols(text) {
    const source = clean(text);
    if (!/\bBisphenols\b/i.test(source)) return [];
    const section = source.match(/Bisphenols[\s\S]{0,1800}?(?=Chlorobenzenes|Forbidden|Formaldehyde|$)/i)?.[0] || '';
    if (!/Conclusion\s*(?:--\s*)?FAIL\s*\*/i.test(section)) return [];

    const bpaLimit = findRequirement(section, 'BPA');
    const otherMatch = section.match(/BPS\s*,?\s*BPB\s*,?\s*BPF\s+(\d+(?:\.\d+)?)\s*mg\/kg/i);
    const otherLimit = otherMatch ? Number(otherMatch[1]) : null;
    const definitions = [
      {name:'BPA', cas:'80-05-7', limit:bpaLimit},
      {name:'BPS', cas:'80-09-1', limit:otherLimit},
      {name:'BPB', cas:'77-40-7', limit:otherLimit},
      {name:'BPF', cas:'620-92-8', limit:otherLimit}
    ];
    return definitions.flatMap(item => {
      const measured = findCasResult(section, item.cas);
      return measured !== null && item.limit !== null && measured > item.limit
        ? [failedItem(item.name, measured, item.limit)] : [];
    });
  }

  function deduplicate(list) {
    const map = new Map();
    list.forEach(item => map.set(`${item.substance}|${item.result}|${item.limit}`.toUpperCase(), item));
    return [...map.values()];
  }

  function installFailedItemsUi() {
    if ($('failedItemsV32')) return;
    const original = $('substance');
    if (!original) return;
    const fields = [original.closest('.field'), $('result').closest('.field'), $('limit').closest('.field')];
    fields.forEach(field => field.style.display = 'none');
    const wrapper = document.createElement('div');
    wrapper.id = 'failedItemsV32'; wrapper.className = 'field full';
    wrapper.innerHTML = '<label>Failed Items *</label><div id="failedItemsRows"></div><button type="button" class="btn" id="addFailedItemV32">+ Add Failed Item</button>';
    fields[0].parentElement.insertBefore(wrapper, fields[0]);
    $('addFailedItemV32').onclick = () => { failedItems.push({substance:'',result:'',limit:''}); renderFailedItems(); };
    renderFailedItems();
  }

  function renderFailedItems() {
    const host = $('failedItemsRows'); if (!host) return;
    host.innerHTML = failedItems.map((item,index) => `
      <div style="display:grid;grid-template-columns:1.5fr 1fr 1fr auto;gap:8px;margin:8px 0">
        <input data-key="substance" data-index="${index}" value="${escapeHtml(item.substance)}" placeholder="Substance / Test Item">
        <input data-key="result" data-index="${index}" value="${escapeHtml(item.result)}" placeholder="Measured Result">
        <input data-key="limit" data-index="${index}" value="${escapeHtml(item.limit)}" placeholder="Limit">
        <button type="button" class="btn danger" data-remove="${index}">Remove</button>
      </div>`).join('');
    host.querySelectorAll('[data-key]').forEach(input => input.oninput = () => {
      failedItems[Number(input.dataset.index)][input.dataset.key] = input.value; syncLegacy();
    });
    host.querySelectorAll('[data-remove]').forEach(button => button.onclick = () => {
      failedItems.splice(Number(button.dataset.remove),1); renderFailedItems();
    });
    syncLegacy();
  }

  function syncLegacy() {
    const first = failedItems[0] || {};
    $('substance').value = first.substance || '';
    $('result').value = first.result || '';
    $('limit').value = first.limit || '';
  }

  function generateEmailV32(caseRecord) {
    const list = caseRecord.failedItems?.length ? caseRecord.failedItems : failedItems;
    const preview = $('emailPreview'); if (!preview) return;
    const details = list.map((x,i) => `${i+1}. ${x.substance}\n   Test result: ${x.result}\n   Requirement / limit: ${x.limit}`).join('\n\n');
    preview.textContent = `Subject: SGS RSL Failure Notification | ${caseRecord.article} | Report ${caseRecord.report}\n\nDear ${caseRecord.supplier} Team,\n\nSGS RSL Report ${caseRecord.report} for Fabric Article ${caseRecord.article}${caseRecord.po ? `, PO(s) ${caseRecord.po}` : ''}${caseRecord.lot ? `, Lot(s) ${caseRecord.lot}` : ''} has a FAIL result.\n\nFailed Items\n\n${details}\n\nImmediate containment is required. Please immediately quarantine all affected material and stop shipment, cutting, production use, transfer or release until written disposition is provided.\n\nPlease reply with the following information:\n\nImmediate Containment\n1. How much material is affected? Include quantity, unit, PO(s) and lot(s).\n2. Where is the affected material currently located?\n3. What is the current status of the failed material?\n4. What immediate actions have been completed?\n5. Is all affected material on hold and physically segregated? Please provide evidence.\n6. Will the material be held, reworked, dropped, destroyed or otherwise disposed of?\n\nCAPA and Retest\n7. Please provide a formal Root Cause Analysis.\n8. Please provide the Corrective Action Plan, responsible owner and target completion date.\n9. Please provide additional Preventive Actions to prevent recurrence.\n10. Please provide the SGS retest plan, including the full required test scope, TRF number, all affected lot numbers, sample submission date and expected report completion date.\n11. Please confirm how corrective actions and retest results will be verified before any material is released.\n\nCAPA due date: ${caseRecord.dueDate}\n\nBest regards,\nVuori Product Integrity & Compliance`;
    $('emailCard')?.classList.remove('hidden');
  }

  function install() {
    installFailedItemsUi();
    const analyze = $('analyzePdf'); const originalAnalyze = analyze?.onclick;
    if (analyze) analyze.onclick = async function(event) {
      await originalAnalyze?.call(this,event);
      const file = $('pdfFile')?.files?.[0]; if (!file) return;
      try {
        const pdf = await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
        const pages=[];
        for(let i=1;i<=pdf.numPages;i++) pages.push(pageText(await (await pdf.getPage(i)).getTextContent()));
        const headerText=pages.slice(0,3).join(' ');
        const reportNumber=extractReportNumber(headerText); if(reportNumber) $('report').value=reportNumber;
        const issuedDate=extractIssuedDate(headerText); if(issuedDate) $('reportDate').value=issuedDate;
        let parsed=[];
        for(let i=0;i<pages.length;i++){
          const section=[pages[i],pages[i+1]||'',pages[i+2]||''].join(' ');
          parsed=parsed.concat(parsePfas(section),parseBisphenols(section));
        }
        failedItems=deduplicate(parsed); renderFailedItems();
        const alert=$('parseAlert'); if(alert){
          alert.textContent=failedItems.length
            ? `Automated extraction completed. ${failedItems.length} failed item(s) listed.${reportNumber ? ` Official Report #: ${reportNumber}.` : ''} Verify each item against the original PDF.`
            : `No supported failed section was confirmed.${reportNumber ? ` Official Report #: ${reportNumber}.` : ''} Add failed items manually.`;
          alert.classList.remove('hidden');
        }
      } catch(error){ console.error('SGS RSL V3.2F parser error',error); }
    };

    const create=$('createCase'); const originalCreate=create?.onclick;
    if(create) create.onclick=function(event){
      syncLegacy();
      if(!failedItems.length||failedItems.some(x=>!x.substance||!x.result||!x.limit)){alert('Complete each Failed Item before creating the case.');return;}
      const before=cases.length; originalCreate?.call(this,event);
      if(cases.length>before){cases[0].failedItems=JSON.parse(JSON.stringify(failedItems));localStorage.setItem(CASE_KEY,JSON.stringify(cases));renderCases?.();generateEmailV32(cases[0]);}
    };
    window.generateEmail=generateEmailV32;
    document.addEventListener('click',event=>{const button=event.target.closest('[data-email]');if(!button)return;const record=cases.find(x=>x.id===button.dataset.email);if(record)setTimeout(()=>generateEmailV32(record),0);},true);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
})();
