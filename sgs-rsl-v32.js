/* SGS RSL Failure Center V3.2 parser extension
   Adds: PFAS + Bisphenols, multiple failed items, 80% exclusion,
   APEO / CBs & CTs / Heavy Metals parsing, and multi-item email output. */
(() => {
  'use strict';

  const ANALYTES = [
    // PFAS / fluorine
    {name:'6:2 FTOH', re:/\b6\s*:\s*2\s*FTOH\b/i, group:'PFAS'},
    {name:'8:2 FTOH', re:/\b8\s*:\s*2\s*FTOH\b/i, group:'PFAS'},
    {name:'PFOA', re:/\bPFOA\b|perfluorooctanoic acid/i, group:'PFAS'},
    {name:'PFOS', re:/\bPFOS\b|perfluorooctane sulfon/i, group:'PFAS'},
    {name:'PFHxA', re:/\bPFHxA\b|perfluorohexanoic acid/i, group:'PFAS'},
    {name:'PFNA', re:/\bPFNA\b|perfluorononanoic acid/i, group:'PFAS'},
    {name:'Total PFAS', re:/\btotal\s+PFAS\b/i, group:'PFAS'},
    {name:'TOF', re:/\bTOF\b|total organic fluorine/i, group:'PFAS'},
    // Bisphenols. BPAF / Bisphenol AF intentionally excluded.
    {name:'BPA', re:/\bBPA\b|bisphenol\s*A\b/i, group:'Bisphenols'},
    {name:'BPF', re:/\bBPF\b|bisphenol\s*F\b/i, group:'Bisphenols'},
    {name:'BPS', re:/\bBPS\b|bisphenol\s*S\b/i, group:'Bisphenols'},
    {name:'BPB', re:/\bBPB\b|bisphenol\s*B\b/i, group:'Bisphenols'},
    {name:'Total Bisphenols', re:/\btotal\s+bisphenols?\b/i, group:'Bisphenols'},
    // APEO
    {name:'NPEO', re:/\bNPEO\b|nonylphenol ethoxylates?/i, group:'APEO'},
    {name:'OPEO', re:/\bOPEO\b|octylphenol ethoxylates?/i, group:'APEO'},
    {name:'NP', re:/\bnonylphenol\b|\bNP\b/i, group:'APEO'},
    {name:'OP', re:/\boctylphenol\b|\bOP\b/i, group:'APEO'},
    {name:'Total APEOs', re:/\btotal\s+APEOs?\b/i, group:'APEO'},
    // Chlorobenzenes / chlorotoluenes
    {name:'1,4-Dichlorobenzene', re:/1\s*,\s*4\s*-?\s*dichlorobenzene/i, group:'CBs & CTs'},
    {name:'Chlorobenzenes & Chlorotoluenes', re:/chlorobenzenes?.{0,20}chlorotoluenes?|\bCBs?\s*&\s*CTs?\b/i, group:'CBs & CTs'},
    // Heavy metals
    {name:'Lead', re:/\blead\b|\bPb\b/i, group:'Heavy Metals'},
    {name:'Cadmium', re:/\bcadmium\b|\bCd\b/i, group:'Heavy Metals'},
    {name:'Mercury', re:/\bmercury\b|\bHg\b/i, group:'Heavy Metals'},
    {name:'Chromium VI', re:/chromium\s*(?:VI|6)|\bCr\s*\(?VI\)?\b/i, group:'Heavy Metals'},
    {name:'Arsenic', re:/\barsenic\b|\bAs\b/i, group:'Heavy Metals'},
    {name:'Nickel', re:/\bnickel\b|\bNi\b/i, group:'Heavy Metals'}
  ];

  const $v32 = id => document.getElementById(id);
  let v32Items = [];

  function numberParts(text) {
    const out = [];
    const rx = /([<>≤≥]?\s*\d+(?:\.\d+)?)\s*(mg\/kg|ppm|µg\/g|ug\/g|ng\/g|µg\/kg|ug\/kg|ppb|pH|%)?/gi;
    let m;
    while ((m = rx.exec(text))) {
      const raw = `${m[1]}${m[2] ? ' ' + m[2] : ''}`.replace(/\s+/g,' ').trim();
      const unit = (m[2] || '').toLowerCase();
      const value = Number((m[1].match(/\d+(?:\.\d+)?/) || [])[0]);
      const context = text.slice(Math.max(0,m.index-35), Math.min(text.length,rx.lastIndex+35));
      // Prevent the known 80% safety-factor / composition misread and all percentage values.
      if (unit === '%' || /(?:fiber|fibre|composition|content|safety factor|of (?:the )?requirement)/i.test(context)) continue;
      if (!Number.isFinite(value)) continue;
      out.push({raw, value, unit:unit || '', index:m.index, context});
    }
    return out;
  }

  function sameUnit(a,b){return !a.unit || !b.unit || a.unit === b.unit;}

  function parseWindow(analyte, text, index) {
    const start = Math.max(0,index-120), end = Math.min(text.length,index+520);
    const w = text.slice(start,end).replace(/\s+/g,' ');
    if (/(?:BPAF|bisphenol\s*AF)/i.test(w) && analyte.group === 'Bisphenols') return null;
    const nums = numberParts(w);
    if (!nums.length) return null;
    const limitLabel = /(?:requirement|limit|client requirement|specification)\s*[:=]?/ig;
    let lm, limit = null;
    while ((lm = limitLabel.exec(w))) {
      const after = nums.find(n => n.index >= lm.index && n.index <= lm.index + 120);
      if (after) { limit = after; break; }
    }
    const star = nums.find(n => /\*/.test(w.slice(n.index,n.index+n.raw.length+4)));
    const conclusionFail = /\b(?:conclusion\s*[-:]*\s*)?FAIL\b/i.test(w) || /exceed(?:s|ed)?\s+(?:the\s+)?limit/i.test(w);
    let result = star || nums.find(n => !limit || n.index < limit.index) || nums[0];
    if (!limit && nums.length >= 2) limit = nums[nums.length-1];
    if (limit && result === limit && nums.length >= 2) result = nums[0];
    if (!result || !limit || !sameUnit(result,limit)) return null;
    // A record is failed only when the report says FAIL / exceed, a star marks it,
    // or the comparable numeric result is above the limit.
    const autoFail = result.value > limit.value;
    if (!(conclusionFail || star || autoFail)) return null;
    return {substance:analyte.name, group:analyte.group, result:result.raw, limit:limit.raw};
  }

  function extractItems(text) {
    const cleaned = String(text || '').replace(/\u00a0/g,' ').replace(/[\t\r]+/g,' ');
    const found = [];
    for (const analyte of ANALYTES) {
      const global = new RegExp(analyte.re.source, analyte.re.flags.includes('g') ? analyte.re.flags : analyte.re.flags+'g');
      let m;
      while ((m = global.exec(cleaned))) {
        const item = parseWindow(analyte,cleaned,m.index);
        if (item) found.push(item);
        if (global.lastIndex === m.index) global.lastIndex++;
      }
    }
    const dedup = new Map();
    for (const x of found) {
      const k = `${x.substance}|${x.result}|${x.limit}`.toUpperCase();
      if (!dedup.has(k)) dedup.set(k,x);
    }
    return [...dedup.values()];
  }

  function makeItemsUI() {
    if ($v32('failedItemsV32')) return;
    const substance = $v32('substance');
    if (!substance) return;
    const field = substance.closest('.field');
    const resultField = $v32('result')?.closest('.field');
    const limitField = $v32('limit')?.closest('.field');
    [field,resultField,limitField].filter(Boolean).forEach(x=>x.style.display='none');
    const wrap = document.createElement('div');
    wrap.id='failedItemsV32'; wrap.className='field full';
    wrap.innerHTML='<label>Failed Items *</label><div id="failedItemsRows"></div><button type="button" class="btn" id="addFailedItemV32">+ Add Failed Item</button>';
    field.parentElement.insertBefore(wrap,field);
    $v32('addFailedItemV32').onclick=()=>{v32Items.push({substance:'',group:'Other',result:'',limit:''});renderItems()};
    renderItems();
  }

  function renderItems() {
    const host=$v32('failedItemsRows'); if(!host)return;
    host.innerHTML=v32Items.map((x,i)=>`<div style="display:grid;grid-template-columns:1.5fr 1fr 1fr auto;gap:8px;margin:8px 0"><input data-fi="substance" data-i="${i}" value="${escapeHtml(x.substance)}" placeholder="Substance / Test Item"><input data-fi="result" data-i="${i}" value="${escapeHtml(x.result)}" placeholder="Measured Result"><input data-fi="limit" data-i="${i}" value="${escapeHtml(x.limit)}" placeholder="Limit"><button type="button" class="btn danger" data-remove="${i}">Remove</button></div>`).join('');
    host.querySelectorAll('[data-fi]').forEach(n=>n.oninput=()=>{v32Items[+n.dataset.i][n.dataset.fi]=n.value;syncLegacy()});
    host.querySelectorAll('[data-remove]').forEach(n=>n.onclick=()=>{v32Items.splice(+n.dataset.remove,1);renderItems();syncLegacy()});
    syncLegacy();
  }
  function escapeHtml(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function syncLegacy(){const x=v32Items[0]||{};if($v32('substance'))$v32('substance').value=x.substance||'';if($v32('result'))$v32('result').value=x.result||'';if($v32('limit'))$v32('limit').value=x.limit||'';}

  function itemsText(items){return items.map((x,i)=>`${i+1}. ${x.substance}\n   Test result: ${x.result}\n   Requirement / limit: ${x.limit}`).join('\n\n');}

  function install() {
    makeItemsUI();
    const analyze=$v32('analyzePdf');
    if (analyze) {
      const original=analyze.onclick;
      analyze.onclick=async function(e){
        await original?.call(this,e);
        // The base parser stores the extracted PDF text in page flow only indirectly,
        // so re-read the selected PDF here and retain page separators.
        const file=$v32('pdfFile')?.files?.[0];
        if(!file)return;
        try{
          const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
          const pages=[];
          for(let i=1;i<=pdf.numPages;i++){const c=await(await pdf.getPage(i)).getTextContent();pages.push(c.items.map(x=>x.str).join(' '));}
          v32Items=extractItems(pages.join('\n'));
          if(!v32Items.length)v32Items=[{substance:'Review PDF failure table',group:'Other',result:'See PDF',limit:'See PDF'}];
          renderItems();
          const a=$v32('parseAlert');
          if(a){a.textContent=v32Items[0].substance==='Review PDF failure table'?'Automated extraction completed, but no supported failed item was confirmed. Review the original PDF and add failed items manually.':`Automated extraction completed. ${v32Items.length} failed item(s) listed. Verify every item against the original PDF before creating the case.`;a.classList.remove('hidden');}
        }catch(err){console.error('V3.2 item parser',err)}
      };
    }

    const create=$v32('createCase');
    if(create){
      const original=create.onclick;
      create.onclick=function(e){
        syncLegacy();
        if(!v32Items.length||v32Items.some(x=>!x.substance||!x.result||!x.limit)){alert('Complete Substance, Measured Result and Limit for every Failed Item.');return;}
        const before=Array.isArray(cases)?cases.length:0;
        original?.call(this,e);
        if(Array.isArray(cases)&&cases.length>before){cases[0].failedItems=JSON.parse(JSON.stringify(v32Items));localStorage.setItem(CASE_KEY,JSON.stringify(cases));renderCases?.();generateEmailV32(cases[0]);}
      };
    }
    const oldGenerate=window.generateEmail;
    window.generateEmail=function(c){generateEmailV32(c)};
    function generateEmailV32(c){
      const items=c.failedItems?.length?c.failedItems:v32Items.length?v32Items:[{substance:c.substance,result:c.result,limit:c.limit}];
      const preview=$v32('emailPreview');if(!preview)return;
      preview.textContent=`Subject: SGS RSL Failure Notification | ${c.article} | Report ${c.report}\n\nDear ${c.supplier} Team,\n\nSGS RSL Report ${c.report} for Fabric Article ${c.article}${c.po?`, PO(s) ${c.po}`:''}${c.lot?`, Lot(s) ${c.lot}`:''} has a FAIL result.\n\nFailed Items\n\n${itemsText(items)}\n\nImmediate containment is required. Please immediately quarantine all affected material and stop shipment, cutting, production use, transfer or release until written disposition is provided.\n\nPlease reply with the following information:\n\nImmediate Containment\n1. How much material is affected? Include quantity, unit, PO(s) and lot(s).\n2. Where is the affected material currently located?\n3. What is the current status of the failed material?\n4. What immediate actions have been completed?\n5. Is all affected material on hold and physically segregated? Please provide evidence.\n6. Will the material be held, reworked, dropped, destroyed or otherwise disposed of?\n\nCAPA and Retest\n7. Please provide a formal Root Cause Analysis.\n8. Please provide the Corrective Action Plan, responsible owner and target completion date.\n9. Please provide additional Preventive Actions to prevent recurrence.\n10. Please provide the SGS retest plan, including the full required test scope, TRF number, all affected lot numbers, sample submission date and expected report completion date.\n11. Please confirm how the corrective actions and retest results will be verified before any material is released.\n\nCAPA due date: ${c.dueDate}\n\nPlease attach quarantine evidence, material inventory, affected PO/lot records and the retest timeline.\n\nBest regards,\nVuori Product Integrity & Compliance`;
      $v32('emailCard')?.classList.remove('hidden');
    }
    // Make the existing Email buttons use all saved failed items.
    document.addEventListener('click',e=>{const b=e.target.closest('[data-email]');if(!b)return;const c=cases.find(x=>x.id===b.dataset.email);if(c)setTimeout(()=>generateEmailV32(c),0)},true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
