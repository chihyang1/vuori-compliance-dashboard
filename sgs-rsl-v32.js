/* SGS RSL Failure Center V3.2D
   - Preserves the official SGS Report Number format, including '/'
   - Uses the PDF report header before the file name
   - Parses SGS Korea PFAS and Bisphenols by failed test section
   - Supports multiple failed items and supplier email generation
*/
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  let failedItems = [];

  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function cleanText(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function pdfPageText(content) {
    return cleanText((content.items || [])
      .map(item => String(item.str || '').trim())
      .filter(Boolean)
      .join(' '));
  }

  /*
   * Extract the official report number from the PDF itself.
   * The slash is part of the SGS report number and must be preserved.
   * Examples supported:
   *   F690101/LF-CTSAYSA26-11198
   *   TX91718/2025/CI
   *   SL52605309313101TX
   */
  function normalizeReportNumber(value) {
    return String(value || '')
      .trim()
      .replace(/[＿﹍]/g, '_')
      .replace(/[／⁄∕]/g, '/')
      .replace(/[–—−]/g, '-')
      .replace(/\s*\/\s*/g, '/')
      .replace(/\s*-\s*/g, '-')
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9/_-]/gi, '');
  }

  function extractReportNumber(text) {
    const source = cleanText(text);
    const patterns = [
      /Test\s+Report\s+No\.?\s*[:#]?\s*([A-Z0-9][A-Z0-9/_\-\s]{5,80}?)(?=\s+(?:Issued\s+Date|Date|Page|This\s+document))/i,
      /Textile\s+Laboratory\s+Test\s+Report\s+No\.?\s*[:#]?\s*([A-Z0-9][A-Z0-9/_\-\s]{5,80}?)(?=\s+(?:Date|Page))/i,
      /Report\s+No\.?\s*[:#]?\s*([A-Z0-9][A-Z0-9/_\-\s]{5,80}?)(?=\s+(?:Issued\s+Date|Date|Page|Applicant|Buyer))/i
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (!match) continue;
      const reportNumber = normalizeReportNumber(match[1]);
      if (reportNumber.length >= 6) return reportNumber;
    }
    return '';
  }

  function setOfficialReportNumber(pages) {
    const reportNumber = extractReportNumber(pages.slice(0, 3).join(' '));
    if (reportNumber && $('report')) $('report').value = reportNumber;
    return reportNumber;
  }

  function makeFailedItem(name, result, limit) {
    return {
      substance: name,
      result: `${result} mg/kg`,
      limit: `${limit} mg/kg`
    };
  }

  function isPfasSection(text) {
    return /Per-\s*&?\s*Polyfluoroalkyl\s+Substances\s*\(PFAS\)|PFAS\s*-\s*Target\s+Analysis/i.test(text);
  }

  function isFailedSection(text) {
    return /Conclusion\s*(?:--\s*){0,2}FAIL\s*\*/i.test(text);
  }

  function extractRequirement(text, label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`${escaped}[\\s\\S]{0,100}?\\((\\d+(?:\\.\\d+)?)\\s*mg\\/kg\\)`, 'i'),
      new RegExp(`${escaped}[\\s\\S]{0,100}?(\\d+(?:\\.\\d+)?)\\s*mg\\/kg`, 'i')
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return Number(match[1]);
    }
    return null;
  }

  function extractPfasRowValue(text, rowPattern) {
    const match = text.match(rowPattern);
    return match ? Number(match[1]) : null;
  }

  function parsePfasSection(text) {
    if (!isPfasSection(text) || !isFailedSection(text)) return [];

    const results = [];
    const analytes = [
      {
        name: '6:2 FTOH',
        row: /1H,1H,2H,2H-Perfluorooctanol\s*\(6:2\s*FTOH\)[\s\S]{0,100}?647-42-7[\s\S]{0,35}?\b\d+(?:\.\d+)?\b[\s\S]{0,20}?\b(\d+(?:\.\d+)?)\b/i,
        requirement: 'PFHxA-related Substances'
      },
      {
        name: '8:2 FTOH',
        row: /Perfluorocylethanol\s*8:2\s*\(8:2\s*FTOH\)[\s\S]{0,100}?678-39-7[\s\S]{0,35}?\b\d+(?:\.\d+)?\b[\s\S]{0,20}?\b(\d+(?:\.\d+)?)\b/i,
        requirement: 'PFOA-related Substances'
      },
      {
        name: '10:2 FTOH',
        row: /Perfluorododecanol\s*\(10:2\s*FTOH\)[\s\S]{0,100}?865-86-1[\s\S]{0,35}?\b\d+(?:\.\d+)?\b[\s\S]{0,20}?\b(\d+(?:\.\d+)?)\b/i,
        requirement: 'C9-C14 PFCA-related Substances'
      },
      {
        name: '12:2 FTOH',
        row: /perfluorotetradecan-1-ol\s*\(12:2\s*FTOH\)[\s\S]{0,100}?39239-77-5[\s\S]{0,35}?\b\d+(?:\.\d+)?\b[\s\S]{0,20}?\b(\d+(?:\.\d+)?)\b/i,
        requirement: 'C9-C14 PFCA-related Substances'
      }
    ];

    for (const analyte of analytes) {
      const measured = extractPfasRowValue(text, analyte.row);
      const limit = extractRequirement(text, analyte.requirement);
      if (measured !== null && limit !== null && measured > limit) {
        results.push(makeFailedItem(analyte.name, measured, limit));
      }
    }

    const totals = [
      {
        name: 'Total PFHxA-related Substances',
        row: /Total\s+PFHxA-related\s+Substances[\s\S]{0,40}?\b(\d+(?:\.\d+)?)\b/i,
        requirement: 'PFHxA-related Substances'
      },
      {
        name: 'Total PFOA-related Substances',
        row: /Total\s+(?:of\s+)?PFOA-related\s+Substances[\s\S]{0,40}?\b(\d+(?:\.\d+)?)\b/i,
        requirement: 'PFOA-related Substances'
      },
      {
        name: 'Total C9-C14 PFCA-related Substances',
        row: /Total\s+(?:of\s+)?C9-C14\s+PFCA-related\s+Substances[\s\S]{0,40}?\b(\d+(?:\.\d+)?)\b/i,
        requirement: 'C9-C14 PFCA-related Substances'
      }
    ];

    for (const total of totals) {
      const measured = extractPfasRowValue(text, total.row);
      const limit = extractRequirement(text, total.requirement);
      if (measured !== null && limit !== null && measured > limit) {
        results.push(makeFailedItem(total.name, measured, limit));
      }
    }

    return results;
  }

  function parseBisphenolsSection(text) {
    if (!/\bBisphenols\b/i.test(text) || !isFailedSection(text)) return [];

    const bpaLimit = extractRequirement(text, 'BPA');
    const otherLimitMatch = text.match(/BPS\s*,?\s*BPB\s*,?\s*BPF[\s\S]{0,50}?(\d+(?:\.\d+)?)\s*mg\/kg/i);
    const otherLimit = otherLimitMatch ? Number(otherLimitMatch[1]) : null;

    const definitions = [
      ['BPA', /Bisphenol\s+A\s*\(BPA\)[\s\S]{0,50}?80-05-7[\s\S]{0,20}?\b(\d+(?:\.\d+)?)\b/i, bpaLimit],
      ['BPS', /Bisphenol\s+S\s*\(BPS\)[\s\S]{0,50}?80-09-1[\s\S]{0,20}?\b(\d+(?:\.\d+)?)\b/i, otherLimit],
      ['BPB', /Bisphenol\s+B\s*\(BPB\)[\s\S]{0,50}?77-40-7[\s\S]{0,20}?\b(\d+(?:\.\d+)?)\b/i, otherLimit],
      ['BPF', /Bisphenol\s+F\s*\(BPF\)[\s\S]{0,50}?620-92-8[\s\S]{0,20}?\b(\d+(?:\.\d+)?)\b/i, otherLimit]
    ];

    return definitions.flatMap(([name, pattern, limit]) => {
      const match = text.match(pattern);
      if (!match || limit === null) return [];
      const measured = Number(match[1]);
      return measured > limit ? [makeFailedItem(name, measured, limit)] : [];
    });
  }

  function deduplicate(list) {
    const map = new Map();
    list.forEach(item => map.set(`${item.substance}|${item.result}|${item.limit}`.toUpperCase(), item));
    return [...map.values()];
  }

  function createFailedItemsUi() {
    if ($('failedItemsV32')) return;
    const substance = $('substance');
    if (!substance) return;

    const substanceField = substance.closest('.field');
    const resultField = $('result').closest('.field');
    const limitField = $('limit').closest('.field');
    [substanceField, resultField, limitField].forEach(field => field.style.display = 'none');

    const wrapper = document.createElement('div');
    wrapper.id = 'failedItemsV32';
    wrapper.className = 'field full';
    wrapper.innerHTML = '<label>Failed Items *</label><div id="failedItemsRows"></div><button type="button" class="btn" id="addFailedItemV32">+ Add Failed Item</button>';
    substanceField.parentElement.insertBefore(wrapper, substanceField);

    $('addFailedItemV32').onclick = () => {
      failedItems.push({ substance: '', result: '', limit: '' });
      renderFailedItems();
    };
    renderFailedItems();
  }

  function renderFailedItems() {
    const host = $('failedItemsRows');
    if (!host) return;

    host.innerHTML = failedItems.map((item, index) => `
      <div style="display:grid;grid-template-columns:1.5fr 1fr 1fr auto;gap:8px;margin:8px 0">
        <input data-item-key="substance" data-item-index="${index}" value="${escapeHtml(item.substance)}" placeholder="Substance / Test Item">
        <input data-item-key="result" data-item-index="${index}" value="${escapeHtml(item.result)}" placeholder="Measured Result">
        <input data-item-key="limit" data-item-index="${index}" value="${escapeHtml(item.limit)}" placeholder="Limit">
        <button type="button" class="btn danger" data-remove-item="${index}">Remove</button>
      </div>`).join('');

    host.querySelectorAll('[data-item-key]').forEach(input => {
      input.oninput = () => {
        failedItems[Number(input.dataset.itemIndex)][input.dataset.itemKey] = input.value;
        syncLegacyFields();
      };
    });

    host.querySelectorAll('[data-remove-item]').forEach(button => {
      button.onclick = () => {
        failedItems.splice(Number(button.dataset.removeItem), 1);
        renderFailedItems();
      };
    });
    syncLegacyFields();
  }

  function syncLegacyFields() {
    const first = failedItems[0] || {};
    $('substance').value = first.substance || '';
    $('result').value = first.result || '';
    $('limit').value = first.limit || '';
  }

  function generateSupplierEmail(caseRecord) {
    const list = caseRecord.failedItems?.length ? caseRecord.failedItems : failedItems;
    const preview = $('emailPreview');
    if (!preview) return;

    const failedItemsText = list.map((item, index) =>
      `${index + 1}. ${item.substance}\n   Test result: ${item.result}\n   Requirement / limit: ${item.limit}`
    ).join('\n\n');

    preview.textContent = `Subject: SGS RSL Failure Notification | ${caseRecord.article} | Report ${caseRecord.report}\n\nDear ${caseRecord.supplier} Team,\n\nSGS RSL Report ${caseRecord.report} for Fabric Article ${caseRecord.article}${caseRecord.po ? `, PO(s) ${caseRecord.po}` : ''}${caseRecord.lot ? `, Lot(s) ${caseRecord.lot}` : ''} has a FAIL result.\n\nFailed Items\n\n${failedItemsText}\n\nImmediate containment is required. Please immediately quarantine all affected material and stop shipment, cutting, production use, transfer or release until written disposition is provided.\n\nPlease reply with the following information:\n\nImmediate Containment\n1. How much material is affected? Include quantity, unit, PO(s) and lot(s).\n2. Where is the affected material currently located?\n3. What is the current status of the failed material?\n4. What immediate actions have been completed?\n5. Is all affected material on hold and physically segregated? Please provide evidence.\n6. Will the material be held, reworked, dropped, destroyed or otherwise disposed of?\n\nCAPA and Retest\n7. Please provide a formal Root Cause Analysis.\n8. Please provide the Corrective Action Plan, responsible owner and target completion date.\n9. Please provide additional Preventive Actions to prevent recurrence.\n10. Please provide the SGS retest plan, including the full required test scope, TRF number, all affected lot numbers, sample submission date and expected report completion date.\n11. Please confirm how the corrective actions and retest results will be verified before any material is released.\n\nCAPA due date: ${caseRecord.dueDate}\n\nBest regards,\nVuori Product Integrity & Compliance`;

    $('emailCard')?.classList.remove('hidden');
  }

  function install() {
    createFailedItemsUi();

    const analyzeButton = $('analyzePdf');
    const baseAnalyze = analyzeButton?.onclick;
    if (analyzeButton) {
      analyzeButton.onclick = async function(event) {
        await baseAnalyze?.call(this, event);
        const file = $('pdfFile')?.files?.[0];
        if (!file) return;

        try {
          const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
          const pages = [];
          for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            pages.push(pdfPageText(await page.getTextContent()));
          }

          const reportNumber = setOfficialReportNumber(pages);
          let parsed = [];
          for (let index = 0; index < pages.length; index++) {
            const section = [pages[index], pages[index + 1] || '', pages[index + 2] || ''].join(' ');
            parsed = parsed.concat(parsePfasSection(section), parseBisphenolsSection(section));
          }

          failedItems = deduplicate(parsed);
          renderFailedItems();

          const alert = $('parseAlert');
          if (alert) {
            const reportMessage = reportNumber ? ` Official Report #: ${reportNumber}.` : '';
            alert.textContent = failedItems.length
              ? `Automated extraction completed. ${failedItems.length} failed item(s) listed.${reportMessage} Verify each item against the original PDF.`
              : `No supported failed section was confirmed.${reportMessage} Add the failed items manually.`;
            alert.classList.remove('hidden');
          }
        } catch (error) {
          console.error('SGS RSL V3.2D parser error', error);
        }
      };
    }

    const createButton = $('createCase');
    const baseCreate = createButton?.onclick;
    if (createButton) {
      createButton.onclick = function(event) {
        syncLegacyFields();
        if (!failedItems.length || failedItems.some(item => !item.substance || !item.result || !item.limit)) {
          alert('Complete each Failed Item before creating the case.');
          return;
        }

        const previousCount = cases.length;
        baseCreate?.call(this, event);
        if (cases.length > previousCount) {
          cases[0].failedItems = JSON.parse(JSON.stringify(failedItems));
          localStorage.setItem(CASE_KEY, JSON.stringify(cases));
          renderCases?.();
          generateSupplierEmail(cases[0]);
        }
      };
    }

    window.generateEmail = generateSupplierEmail;
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-email]');
      if (!button) return;
      const caseRecord = cases.find(item => item.id === button.dataset.email);
      if (caseRecord) setTimeout(() => generateSupplierEmail(caseRecord), 0);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();
