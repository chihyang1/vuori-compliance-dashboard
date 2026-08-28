/* SGS RSL Failure Center V3.3
   Keeps PDF upload + auto-fill review.
   Reads formal cases from RSL Failure Tracking Master.csv.
   New browser-created cases are saved as local drafts until the CSV is updated.
*/
(() => {
'use strict';
const $ = id => document.getElementById(id);
const MASTER_FILE = 'RSL Failure Tracking Master.csv';
const DRAFT_KEY = 'vuoriSgsFailureDraftsV33';
const clean = v => String(v ?? '').trim();
const esc = v => clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validValue = v => clean(v) && !/^N\/?A$/i.test(clean(v));
let masterCases = [];
let draftCases = JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]');

function pick(row, names){
  const normalized = {};
  Object.keys(row).forEach(k => normalized[clean(k).toLowerCase()] = row[k]);
  for(const name of names){
    const value = normalized[name.toLowerCase()];
    if(validValue(value)) return clean(value);
  }
  return '';
}
function masterToCase(row){
  const id = pick(row,['Case ID']);
  if(!id) return null;
  return {
    id,
    workflow: pick(row,['Status']) || 'Review Required',
    supplier: pick(row,['Applicant']),
    article: pick(row,['Article #']),
    po: pick(row,['PO #']),
    report: pick(row,['Report #']),
    reportDate: pick(row,['Report Date']),
    dueDate: pick(row,['Due Date']),
    substance: pick(row,['Failure']),
    result: '', limit: '',
    pdf: '',
    caReport: pick(row,['C.A Report#']),
    remarks: pick(row,['Remarks']),
    source: 'master'
  };
}
async function loadMasterCases(){
  try{
    const response = await fetch(MASTER_FILE,{cache:'no-store'});
    if(!response.ok) throw new Error(`${MASTER_FILE}: ${response.status}`);
    const parsed = Papa.parse(await response.text(),{
      header:true, skipEmptyLines:'greedy',
      transformHeader:h=>clean(h).replace(/^\uFEFF/,'')
    });
    masterCases = (parsed.data || []).map(masterToCase).filter(Boolean);
    renderMasterAndDraftCases();
  }catch(error){
    console.error('Unable to load RSL Failure Tracking Master.csv',error);
    if($('caseSummary')) $('caseSummary').textContent='Unable to load RSL Failure Tracking Master.csv';
  }
}
function allCases(){
  const byId = new Map();
  masterCases.forEach(c=>byId.set(c.id,c));
  draftCases.forEach(c=>{ if(!byId.has(c.id)) byId.set(c.id,{...c,source:'draft'}); });
  return [...byId.values()];
}
function failureText(c){
  if(c.failedItems?.length){
    return c.failedItems.map(x=>`${x.substance}: ${x.result} / ${x.limit}`).join('; ');
  }
  return c.substance || '—';
}
function renderMasterAndDraftCases(){
  const casesNow = allCases();
  const q = clean($('caseSearch')?.value).toLowerCase();
  const status = $('caseStatus')?.value || 'ALL';
  const visible = casesNow.filter(c =>
    (!q || Object.values(c).flat().join(' ').toLowerCase().includes(q)) &&
    (status === 'ALL' || c.workflow === status)
  );
  const today = new Date().toISOString().slice(0,10);
  const open = c => !['CA Completed','Closed'].includes(c.workflow);
  if($('co')) $('co').textContent=casesNow.filter(open).length;
  if($('cp')) $('cp').textContent=casesNow.filter(c=>c.workflow==='Containment Required').length;
  if($('cc')) $('cc').textContent=casesNow.filter(c=>c.workflow==='CAPA Open').length;
  if($('cr')) $('cr').textContent=casesNow.filter(c=>c.workflow==='Retest Pending').length;
  if($('cd')) $('cd').textContent=casesNow.filter(c=>c.workflow==='CA Completed').length;
  if($('cv')) $('cv').textContent=casesNow.filter(c=>c.dueDate && c.dueDate<today && open(c)).length;
  if($('caseSummary')) $('caseSummary').textContent=`Showing ${visible.length} of ${casesNow.length} cases from RSL Failure Tracking Master${draftCases.length ? `, plus ${draftCases.length} local draft(s)` : ''}`;
  if(!$('caseBody')) return;
  $('caseBody').innerHTML = visible.length ? visible.map(c=>`<tr>
    <td>${esc(c.id)}</td>
    <td><span class="badge ${['Closed','CA Completed'].includes(c.workflow)?'ok':'warn'}">${esc(c.workflow)}</span>${c.source==='draft'?'<br><small>Pending CSV upload</small>':''}</td>
    <td>${esc(c.supplier)}</td><td>${esc(c.article)}</td><td>${esc(c.po)}</td>
    <td>${esc(c.report)}</td><td>${esc(failureText(c))}</td><td>${esc(c.dueDate)}</td>
    <td>${esc(c.pdf)}</td>
    <td><button class="btn" data-email-v33="${esc(c.id)}">Email</button>${c.source==='draft'?` <button class="btn" data-csv-v33="${esc(c.id)}">Download CSV Row</button> <button class="btn danger" data-del-v33="${esc(c.id)}">Delete Draft</button>`:''}</td>
  </tr>`).join('') : '<tr><td colspan="10">No matching failure cases</td></tr>';
  document.querySelectorAll('[data-email-v33]').forEach(b=>b.onclick=()=>{
    const c=allCases().find(x=>x.id===b.dataset.emailV33);
    if(c && window.generateEmail){ window.generateEmail(c); $('emailCard')?.classList.remove('hidden'); }
  });
  document.querySelectorAll('[data-csv-v33]').forEach(b=>b.onclick=()=>downloadDraftRow(b.dataset.csvV33));
  document.querySelectorAll('[data-del-v33]').forEach(b=>b.onclick=()=>{
    draftCases=draftCases.filter(x=>x.id!==b.dataset.delV33);
    localStorage.setItem(DRAFT_KEY,JSON.stringify(draftCases)); renderMasterAndDraftCases();
  });
}
function csvCell(v){ const s=clean(v).replace(/"/g,'""'); return /[",\n]/.test(s)?`"${s}"`:s; }
function draftRow(c){
  const failure=failureText(c);
  return {
    'NO.':'','Case ID':c.id,'Status':c.workflow,'Season':'','PO #':c.po,'Style #':'',
    'Article #':c.article,'Color ':'','Report #':c.report,'Report Date':c.reportDate,
    'Failure':failure,'Applicant':c.supplier,'Review Conclusion':'Rejected – CAP & Retest Required',
    'Due Date':c.dueDate,'Remarks':c.remarks||'','C.A Report#':c.caReport||''
  };
}
function downloadDraftRow(id){
  const c=draftCases.find(x=>x.id===id); if(!c) return;
  const row=draftRow(c), headers=Object.keys(row);
  const csv='\uFEFF'+headers.map(csvCell).join(',')+'\r\n'+headers.map(h=>csvCell(row[h])).join(',')+'\r\n';
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download=`${c.id}-RSL-Failure-CSV-Row.csv`; a.click(); URL.revokeObjectURL(a.href);
}
function nextDraftId(){
  const year=new Date().getFullYear();
  const nums=allCases().map(c=>String(c.id).match(new RegExp(`RSL-${year}-(\\d+)`))?.[1]).filter(Boolean).map(Number);
  return `RSL-${year}-${String((Math.max(0,...nums)+1)).padStart(4,'0')}`;
}
function install(){
  // The base page keeps Upload SGS FAIL PDF and Review Auto-Filled Failure Case.
  const create=$('createCase');
  if(create){
    create.onclick=()=>{
      const c=collect();
      if(!c.report||!c.reportDate||!c.supplier||!c.article||!c.substance||!c.result||!c.limit){
        alert('Review and complete all required fields marked with *.'); return;
      }
      c.id=nextDraftId(); c.source='draft';
      const itemRows=[...document.querySelectorAll('#failedItemsRows [data-k=\"substance\"]')].map(input=>{
        const i=input.dataset.i;
        return {
          substance:clean(input.value),
          result:clean(document.querySelector(`#failedItemsRows [data-k=\"result\"][data-i=\"${i}\"]`)?.value),
          limit:clean(document.querySelector(`#failedItemsRows [data-k=\"limit\"][data-i=\"${i}\"]`)?.value)
        };
      }).filter(x=>x.substance||x.result||x.limit);
      if(itemRows.length) c.failedItems=itemRows;
      draftCases.unshift(c); localStorage.setItem(DRAFT_KEY,JSON.stringify(draftCases));
      currentCase=c; renderMasterAndDraftCases(); generateEmail(c);
      $('emailCard')?.classList.remove('hidden'); $('emailCard')?.scrollIntoView({behavior:'smooth'});
      downloadDraftRow(c.id);
      alert('Failure Case saved as a local draft. The CSV row has been downloaded. Add that row to RSL Failure Tracking Master.csv to publish the case to all browsers.');
    };
  }
  if($('caseSearch')) $('caseSearch').oninput=renderMasterAndDraftCases;
  if($('caseStatus')) $('caseStatus').onchange=renderMasterAndDraftCases;
  loadMasterCases();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
})();
