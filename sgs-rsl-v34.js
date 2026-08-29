/* SGS RSL Failure Center V3.4 Integrated
   Replaces: sgs-rsl-v26.js, v261.js, v262.js, v263.js, v32.js and v33.js.
   One PDF parser, one Failed Items state, one Analyze handler and one case workflow.
*/
(() => {
'use strict';
const $ = id => document.getElementById(id);
const MASTER_FILE = 'RSL Failure Tracking Master.csv';
const DRAFT_KEY = 'vuoriSgsFailureDraftsV34';
let failedItems = [];
let masterCases = [];
let draftCases = safeJson(localStorage.getItem(DRAFT_KEY), []);

function safeJson(v, fallback){ try { return JSON.parse(v || ''); } catch { return fallback; } }
function clean(v){ return String(v ?? '').replace(/\u00a0/g,' ').replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim(); }
function esc(v){ return clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function num(v){ const m=String(v??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; }
function valid(v){ return clean(v) && !/^(?:N\/?A|NOT APPLICABLE|\/|-)$/i.test(clean(v)); }
function first(t, patterns){ for(const p of patterns){ const m=t.match(p); if(m) return clean(m[1]); } return ''; }
function item(substance,result,limit,component='',conclusion='FAIL',remarks=''){
  return {substance:clean(component ? `${substance} | Component ${component}` : substance),result:clean(result),limit:clean(limit),component:clean(component),conclusion,remarks:clean(remarks)};
}
function dedupe(a){ const m=new Map(); for(const x of a){ const k=`${x.substance}|${x.result}|${x.limit}|${x.component}`.toUpperCase(); if(!m.has(k))m.set(k,x); } return [...m.values()]; }
function unit(v, fallback='mg/kg'){ const m=String(v||'').match(/(?:mg\s*\/\s*kg|ppm|ppb)/i); return m ? m[0].replace(/\s/g,'') : fallback; }
function normalizeReport(v){ return clean(v).replace(/[／⁄∕]/g,'/').replace(/\s*\/\s*/g,'/').replace(/\s*-\s*/g,'-').replace(/\s+/g,'').replace(/[^A-Z0-9/_-]/gi,''); }
function isoDate(v){
  if(!v)return '';
  let m=v.match(/(\d{4})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})/);
  if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  const d=new Date(v.replace(/\./g,' ')); return isNaN(d) ? '' : d.toISOString().slice(0,10);
}
function reportNo(t){ return normalizeReport(first(t,[
  /Textile\s+Laboratory\s+Test\s+Report\s+No\s*:\s*([A-Z0-9]+\s*\/\s*\d{4}\s*\/\s*[A-Z0-9-]+)/i,
  /Test\s+Report\s+No\.?\s*[:#.]?\s*([A-Z0-9][A-Z0-9/_\-\s]{5,80}?)(?=\s+(?:Issued\s+Date|Date|Page|This\s+document))/i,
  /Report\s+No\.?\s*[:#.]?\s*([A-Z0-9][A-Z0-9/_\-\s]{5,80}?)(?=\s+(?:Issued\s+Date|Date|Page|Applicant))/i,
  /\b(?:No\.?)\s*:\s*([A-Z]{2,6}\d{7,}(?:-\d+)?)/i
])); }
function header(t){
  const supplier=first(t,[/Supplier\s+Company\s+Name\s*:\s*(.{2,120}?)(?=\s+(?:Sample\s+Type|Division|Department))/i,/APPLICANT\s*:\s*(.{2,120}?)(?=\s+(?:OVERALL|APPLICANT\s+ADDRESS))/i]);
  const date=first(t,[/Issued\s+Date\s*[:#]?\s*([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}|\d{4}\s*[.\/-]\s*\d{1,2}\s*[.\/-]\s*\d{1,2})/i,/\bDate\s*:\s*(\d{4}\s*[.\/-]\s*\d{1,2}\s*[.\/-]\s*\d{1,2})/i]);
  const field=(label,next)=>first(t,[new RegExp(`${label}\\s*:?\\s*(.{1,180}?)(?=\\s+(?:${next}))`,'i')]);
  return {report:reportNo(t),reportDate:isoDate(date),supplier,article:field('Article\\s+Number','Agent\\s+Name|Manufacturer|Construction'),po:field('PO#\\s*\\/\\s*Ref#','Bulk\\s+Lot#|Style'),lot:field('Bulk\\s+Lot#','Style\\s*#|Style\\s+Name'),color:field('Color','Article\\s+Number|Agent\\s+Name')};
}
function conclusionFail(s){ return /Conclusion\s*(?::|--)?\s*(?:--\s*)?FAIL[#*]?/i.test(s) || /INTERIM-FAIL/i.test(s); }
function sections(t,start,end,max=2600){ const re=new RegExp(`${start}[\\s\\S]{0,${max}}?(?=${end}|$)`,'gi'); return t.match(re)||[]; }
function resultAfterCas(s,cas){
  const c=cas.replace(/-/g,'\\-');
  const patterns=[
    new RegExp(`${c}\\s+(?:ppm|mg\\/kg)?\\s*(?:\\d+(?:\\.\\d+)?|ND|N\\.?D\\.?)\\s+(ND|N\\.?D\\.?|Not Detected|\\d+(?:\\.\\d+)?)\\s*(ppm|mg\\/kg)?`,'i'),
    new RegExp(`${c}[^\\d]{0,35}(ND|N\\.?D\\.?|Not Detected|\\d+(?:\\.\\d+)?)\\s*(ppm|mg\\/kg)?`,'i')
  ];
  for(const p of patterns){ const m=s.match(p); if(m && !/^(?:ND|N\.?D\.?|Not Detected)$/i.test(clean(m[1]))) return {value:m[1],unit:m[2]||'mg/kg'}; }
  return null;
}
function requirement(s, labels, fallback=''){
  for(const label of labels){
    const e=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const ps=[new RegExp(`(?:Requirement|Client.?s Limit|Req\\.?)?[\\s\\S]{0,220}?${e}[^\\d]{0,45}(\\d+(?:\\.\\d+)?)\\s*(mg\\/kg|ppm|ppb)`,'i'),new RegExp(`${e}\\s+(\\d+(?:\\.\\d+)?)\\s*(mg\\/kg|ppm|ppb)`,'i')];
    for(const p of ps){const m=s.match(p);if(m)return {value:m[1],unit:m[2]};}
  }
  return fallback ? {value:fallback,unit:'mg/kg'} : null;
}
function parsePH(t){
  const out=[]; for(const s of sections(t,'p\\s*H\\s*Value','(?:Color\\s+Fastness|Formaldehyde|Bisphenols|$)',1200)){
    if(!conclusionFail(s))continue;
    const r=first(s,[/p\s*H\s*Value\s*--\s*(\d+(?:\.\d+)?)/i,/p\s*H\s*Value[^\d]{0,100}(\d+(?:\.\d+)?)[\s\S]{0,180}?FAIL/i]);
    const l=first(s,[/Requirement\s*:\s*(\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?)/i])||'4.0 - 7.5';
    const c=first(s,[/Result\s+CAS-?No\.?\s+([A-Z]?\d*)[\s\S]{0,180}?p\s*H/i]); if(r)out.push(item('pH Value',r,l,c));
  } return out;
}
function parseBisphenols(t){
  const out=[], defs=[['Bisphenol A (BPA)','BPA','80-05-7','1'],['Bisphenol S (BPS)','BPS','80-09-1','100'],['Bisphenol B (BPB)','BPB','77-40-7','1'],['Bisphenol F (BPF)','BPF','620-92-8','1'],['Bisphenol AF (BPAF)','BPAF','1478-61-1','1']];
  for(const s of sections(t,'Bisphenols?(?:\\s+Content)?','(?:Chlorobenzenes|Forbidden|Formaldehyde|Alkylphenols|Total\\s+Organic\\s+Fluorine|$)',3000)){
    if(!conclusionFail(s))continue;
    for(const [name,abbr,cas,fallback] of defs){
      const r=resultAfterCas(s,cas); if(!r)continue;
      const l=requirement(s,[abbr,name.replace(/\s*\(.+?\)/,'')],fallback); if(!l)continue;
      if(num(r.value)>num(l.value) || conclusionFail(s)) out.push(item(`${name}, CAS ${cas}`,`${r.value} ${unit(r.unit)}`,`${l.value} ${unit(l.unit)}`));
    }
  } return out;
}
function parseTOF(t){
  const out=[]; for(const s of sections(t,'(?:Total\\s+Organic\\s+Fluorine(?:\\s+Content|\\s+Screening)?|Fluorine\\s+Content)','(?:Alkylphenols|Phthalates|Heavy\\s+Metal|$)',2200)){
    if(!conclusionFail(s))continue;
    let r=null;
    const row=s.match(/(?:Total\s+Organic\s+Fluorine(?:\s+Content|\s+Screening)?|Fluorine\s+Content)\s*(?:mg\/kg|ppm)?\s*(?:\d+(?:\.\d+)?|ND)\s+(\d+(?:\.\d+)?)\s*(mg\/kg|ppm)?/i);
    if(row)r={value:row[1],unit:row[2]||'mg/kg'};
    if(!r){const m=s.match(/(?:Total\s+Organic\s+Fluorine|Fluorine\s+Content)[^\d]{0,100}(\d+(?:\.\d+)?)\s*(mg\/kg|ppm)/i);if(m)r={value:m[1],unit:m[2]};}
    const l=requirement(s,['Total Organic Fluorine','TOF']);
    if(r)out.push(item('Total Organic Fluorine (TOF)',`${r.value} ${unit(r.unit)}`,l?`${l.value} ${unit(l.unit)}`:'See report'));
  } return out;
}
function parsePFAS(t){
  const out=[], defs=[['6:2 FTOH','647-42-7','PFHxA-related Substances'],['8:2 FTOH','678-39-7','PFOA-related Substances'],['10:2 FTOH','865-86-1','C9-C14 PFCA-related Substances'],['12:2 FTOH','39239-77-5','C9-C14 PFCA-related Substances']];
  for(const s of sections(t,'(?:Per-\\s*&?\\s*Polyfluoroalkyl\\s+Substances\\s*\\(PFAS\\)|PFAS\\s*-\\s*Target\\s+Analysis)','(?:Bisphenols|Phthalates|Heavy\\s+Metal|$)',6000)){
    if(!conclusionFail(s))continue;
    for(const [name,cas,group] of defs){const r=resultAfterCas(s,cas),l=requirement(s,[group]);if(r&&l&&num(r.value)>num(l.value))out.push(item(`${name}, CAS ${cas}`,`${r.value} ${unit(r.unit)}`,`${l.value} ${unit(l.unit)}`));}
    for(const [name,label,group] of [['Total PFHxA-related Substances','Total PFHxA-related Substances','PFHxA-related Substances'],['Total PFOA-related Substances','Total of PFOA-related Substances','PFOA-related Substances'],['Total C9-C14 PFCA-related Substances','Total of C9-C14 PFCA-related Substances','C9-C14 PFCA-related Substances']]){
      const e=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),m=s.match(new RegExp(`${e}\\s+--\\s+--\\s+(ND|N\\.?D\\.?|\\d+(?:\\.\\d+)?)`,'i')),l=requirement(s,[group]);if(m&&!/ND/i.test(m[1])&&l&&num(m[1])>num(l.value))out.push(item(name,`${m[1]} mg/kg`,`${l.value} ${unit(l.unit)}`));
    }
  } return out;
}
function parseAPEO(t){
  const out=[]; for(const s of sections(t,'Alkylphenols?\\s*\\(AP\\)','(?:Phthalates|Heavy\\s+Metal|Bisphenols|$)',2600)){
    if(!conclusionFail(s))continue; const r=first(s,[/Total\s*AP\s*\+\s*APEO\s+(?:various\s+)?(\d+(?:\.\d+)?)/i]);const l=requirement(s,['Total AP + APEO'],'100');if(r)out.push(item('Total AP + APEO',`${r} mg/kg`,`${l.value} ${unit(l.unit)}`));
  } return out;
}
function parseHeavyMetals(t){
  const out=[],defs=[['Arsenic','As','7440-38-2'],['Cadmium','Cd','7440-43-9'],['Mercury','Hg','7439-97-6']];
  for(const s of sections(t,'(?:Total|Extractable)\\s+Heavy\\s+Metal','(?:Chromium\\s+VI|Total\\s+Lead|Phthalates|Organotin|$)',2600)){
    if(!conclusionFail(s))continue; const ext=/Extractable/i.test(s);
    for(const [name,sym,cas] of defs){const r=resultAfterCas(s,cas);if(!r)continue;const fallback=ext?(sym==='As'?'.2':sym==='Cd'?'.1':'.02'):(sym==='As'?'100':sym==='Cd'?'40':'.5');const l=requirement(s,[name,sym],fallback);out.push(item(`${ext?'Extractable ':''}${name} (${sym}), CAS ${cas}`,`${r.value} ${unit(r.unit)}`,`${l.value} ${unit(l.unit)}`));}
  } return out;
}
function parsePhthalates(t){
  const out=[]; for(const s of sections(t,'Phthalates','(?:Organotin|Heavy\\s+Metal|Bisphenols|$)',3600)){
    if(!conclusionFail(s))continue; const r=resultAfterCas(s,'117-81-7'),l=requirement(s,['DEHP','Each'],'500');if(r)out.push(item('Di(2-ethylhexyl) phthalate (DEHP), CAS 117-81-7',`${r.value} ${unit(r.unit)}`,`${l.value} ${unit(l.unit)}`));
  } return out;
}
function parseAll(t){ return dedupe([...parsePFAS(t),...parsePH(t),...parseBisphenols(t),...parseTOF(t),...parseAPEO(t),...parseHeavyMetals(t),...parsePhthalates(t)]); }
function expectedFromFilename(name){ const m=String(name||'').match(/\b(pH|BPA|BPF|BPS|TOF|AP\s*\+\s*APEO)\s+Failures?\b/i);return m?m[1].toUpperCase().replace(/\s/g,''):''; }
function warningForFilename(name,items){ const x=expectedFromFilename(name);if(!x)return'';const hit=items.some(i=>clean(i.substance).toUpperCase().replace(/\s/g,'').includes(x==='AP+APEO'?'AP+APEO':x));return hit?'':` Warning: the filename indicates ${x}, but no matching FAIL row was confirmed in the PDF text.`; }

function installFailedItemsUI(){
  let host=$('failedItemsRows'); if(host)return host;
  const hidden=$('substance'); if(!hidden)return null;
  ['substance','result','limit'].forEach(id=>$(id)?.closest('.field')?.style.setProperty('display','none'));
  const wrap=document.createElement('div');wrap.id='failedItemsV34';wrap.className='field full';wrap.innerHTML='<label>Failed Items *</label><div id="failedItemsRows"></div><button type="button" class="btn" id="addFailedItemV34">+ Add Failed Item</button>';
  hidden.closest('.field').parentElement.insertBefore(wrap,hidden.closest('.field'));$('addFailedItemV34').onclick=()=>{failedItems.push(item('','',''));renderItems();};return $('failedItemsRows');
}
function syncItems(){ const x=failedItems[0]||{};if($('substance'))$('substance').value=x.substance||'';if($('result'))$('result').value=x.result||'';if($('limit'))$('limit').value=x.limit||'';window.v34FailedItems=failedItems; }
function renderItems(){ const h=installFailedItemsUI();if(!h)return;h.innerHTML=failedItems.map((x,i)=>`<div class="v34-failed-row" style="display:grid;grid-template-columns:1.6fr 1fr 1fr auto;gap:8px;margin:8px 0"><input data-v34="substance" data-i="${i}" value="${esc(x.substance)}" placeholder="Substance / Test Item"><input data-v34="result" data-i="${i}" value="${esc(x.result)}" placeholder="Measured Result"><input data-v34="limit" data-i="${i}" value="${esc(x.limit)}" placeholder="Requirement / Limit"><button type="button" class="btn danger" data-rm-v34="${i}">Remove</button></div>`).join('');h.querySelectorAll('[data-v34]').forEach(n=>n.oninput=()=>{failedItems[+n.dataset.i][n.dataset.v34]=n.value;syncItems();});h.querySelectorAll('[data-rm-v34]').forEach(n=>n.onclick=()=>{failedItems.splice(+n.dataset.rmV34,1);renderItems();});syncItems(); }
async function analyze(){
  const f=$('pdfFile')?.files?.[0];if(!f)return;
  ['report','reportDate','supplier','article','po','lot','color','substance','result','limit'].forEach(id=>{if($(id))$(id).value='';});failedItems=[];renderItems();
  const msg=$('parseAlert'),bar=$('parseBar');msg?.classList.add('hidden');if(bar)bar.style.width='5%';
  try{
    const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise,p=[];
    for(let i=1;i<=pdf.numPages;i++){const c=await(await pdf.getPage(i)).getTextContent();p.push(clean(c.items.map(x=>x.str).join(' ')));if(bar)bar.style.width=`${Math.round(5+92*i/pdf.numPages)}%`;}
    const text=p.join('\n'),h=header(text);for(const [k,v] of Object.entries(h)){if($(k)&&valid(v))$(k).value=v;}
    failedItems=parseAll(text);renderItems();
    if($('workflow'))$('workflow').value='Containment Required';if($('immediate'))$('immediate').value='Immediately quarantine all affected material. Stop shipment, cutting, production use, transfer and release pending written disposition.';
    if($('dueDate')&&!$('dueDate').value){const d=new Date();d.setDate(d.getDate()+14);$('dueDate').value=d.toISOString().slice(0,10);}
    if(bar)bar.style.width='100%';if(msg){const warn=warningForFilename(f.name,failedItems);msg.textContent=failedItems.length?`V3.4 extraction completed. ${failedItems.length} confirmed failed item(s) listed. Verify every value against the original PDF.${warn}`:`No supported FAIL row was confirmed in the PDF text. Add the failed item manually.${warn}`;msg.classList.remove('hidden');}
  }catch(e){console.error('SGS RSL V3.4',e);if(msg){msg.textContent='The PDF text could not be parsed. Enter the fields manually.';msg.classList.remove('hidden');}if(bar)bar.style.width='0%';}
}

function pick(row,names){const n={};Object.keys(row||{}).forEach(k=>n[clean(k).toLowerCase()]=row[k]);for(const name of names){const v=n[name.toLowerCase()];if(valid(v))return clean(v);}return'';}
function masterToCase(row){const id=pick(row,['Case ID']);if(!id)return null;return{id,workflow:pick(row,['Status'])||'Review Required',supplier:pick(row,['Applicant']),article:pick(row,['Article #']),po:pick(row,['PO #']),report:pick(row,['Report #']),reportDate:pick(row,['Report Date']),dueDate:pick(row,['Due Date']),substance:pick(row,['Failure']),result:'',limit:'',pdf:'',caReport:pick(row,['C.A Report#']),remarks:pick(row,['Remarks']),source:'master'};}
async function loadMaster(){try{if(typeof Papa==='undefined')return;const r=await fetch(MASTER_FILE,{cache:'no-store'});if(!r.ok)throw new Error(`${MASTER_FILE}: ${r.status}`);const p=Papa.parse(await r.text(),{header:true,skipEmptyLines:'greedy',transformHeader:h=>clean(h).replace(/^\uFEFF/,'')});masterCases=(p.data||[]).map(masterToCase).filter(Boolean);renderCases();}catch(e){console.error('Unable to load master CSV',e);if($('caseSummary'))$('caseSummary').textContent='Unable to load RSL Failure Tracking Master.csv';}}
function allCases(){const m=new Map();masterCases.forEach(c=>m.set(c.id,c));draftCases.forEach(c=>{if(!m.has(c.id))m.set(c.id,{...c,source:'draft'});});return[...m.values()];}
function failureText(c){return c.failedItems?.length?c.failedItems.map(x=>`${x.substance}: ${x.result} / ${x.limit}`).join('; '):(c.substance||'—');}
function renderCases(){
  const all=allCases(),q=clean($('caseSearch')?.value).toLowerCase(),status=$('caseStatus')?.value||'ALL',visible=all.filter(c=>(!q||Object.values(c).flat().join(' ').toLowerCase().includes(q))&&(status==='ALL'||c.workflow===status)),today=new Date().toISOString().slice(0,10),open=c=>!['CA Completed','Closed'].includes(c.workflow);
  if($('co'))$('co').textContent=all.filter(open).length;if($('cp'))$('cp').textContent=all.filter(c=>c.workflow==='Containment Required').length;if($('cc'))$('cc').textContent=all.filter(c=>c.workflow==='CAPA Open').length;if($('cr'))$('cr').textContent=all.filter(c=>c.workflow==='Retest Pending').length;if($('cd'))$('cd').textContent=all.filter(c=>c.workflow==='CA Completed').length;if($('cv'))$('cv').textContent=all.filter(c=>c.dueDate&&c.dueDate<today&&open(c)).length;
  if($('caseSummary'))$('caseSummary').textContent=`Showing ${visible.length} of ${all.length} cases from RSL Failure Tracking Master${draftCases.length?`, plus ${draftCases.length} local draft(s)`:''}`;
  if(!$('caseBody'))return;$('caseBody').innerHTML=visible.length?visible.map(c=>`<tr><td>${esc(c.id)}</td><td><span class="badge ${['Closed','CA Completed'].includes(c.workflow)?'ok':'warn'}">${esc(c.workflow)}</span>${c.source==='draft'?'<br><small>Pending CSV upload</small>':''}</td><td>${esc(c.supplier)}</td><td>${esc(c.article)}</td><td>${esc(c.po)}</td><td>${esc(c.report)}</td><td>${esc(failureText(c))}</td><td>${esc(c.dueDate)}</td><td>${esc(c.pdf)}</td><td><button class="btn" data-email-v34="${esc(c.id)}">Email</button>${c.source==='draft'?` <button class="btn" data-csv-v34="${esc(c.id)}">Download CSV Row</button> <button class="btn danger" data-del-v34="${esc(c.id)}">Delete Draft</button>`:''}</td></tr>`).join(''):'<tr><td colspan="10">No matching failure cases</td></tr>';
  document.querySelectorAll('[data-email-v34]').forEach(b=>b.onclick=()=>{const c=allCases().find(x=>x.id===b.dataset.emailV34);if(c)generateEmail(c);});document.querySelectorAll('[data-csv-v34]').forEach(b=>b.onclick=()=>downloadDraftRow(b.dataset.csvV34));document.querySelectorAll('[data-del-v34]').forEach(b=>b.onclick=()=>{draftCases=draftCases.filter(x=>x.id!==b.dataset.delV34);localStorage.setItem(DRAFT_KEY,JSON.stringify(draftCases));renderCases();});
}
function nextDraftId(){const y=new Date().getFullYear(),nums=allCases().map(c=>String(c.id).match(new RegExp(`RSL-${y}-(\\d+)`))?.[1]).filter(Boolean).map(Number);return `RSL-${y}-${String(Math.max(0,...nums)+1).padStart(4,'0')}`;}
function csvCell(v){const s=clean(v).replace(/"/g,'""');return /[",\n]/.test(s)?`"${s}"`:s;}
function draftRow(c){return{'NO.':'','Case ID':c.id,'Status':c.workflow,'Season':'','PO #':c.po,'Style #':'','Article #':c.article,'Color ':c.color||'','Report #':c.report,'Report Date':c.reportDate,'Failure':failureText(c),'Applicant':c.supplier,'Review Conclusion':'Rejected - CAP & Retest Required','Due Date':c.dueDate,'Remarks':c.remarks||'','C.A Report#':c.caReport||''};}
function downloadDraftRow(id){const c=draftCases.find(x=>x.id===id);if(!c)return;const row=draftRow(c),heads=Object.keys(row),csv='\uFEFF'+heads.map(csvCell).join(',')+'\r\n'+heads.map(h=>csvCell(row[h])).join(',')+'\r\n',a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`${c.id}-RSL-Failure-CSV-Row.csv`;a.click();URL.revokeObjectURL(a.href);}
function collectCase(){const base=typeof window.collect==='function'?window.collect():{};return{...base,workflow:$('workflow')?.value||base.workflow||'Containment Required',supplier:$('supplier')?.value||'',article:$('article')?.value||'',po:$('po')?.value||'',lot:$('lot')?.value||'',color:$('color')?.value||'',report:$('report')?.value||'',reportDate:$('reportDate')?.value||'',dueDate:$('dueDate')?.value||'',immediate:$('immediate')?.value||'',failedItems:JSON.parse(JSON.stringify(failedItems)),substance:failedItems[0]?.substance||'',result:failedItems[0]?.result||'',limit:failedItems[0]?.limit||''};}
function generateEmail(c){const p=$('emailPreview');if(!p)return;const a=c.failedItems?.length?c.failedItems:failedItems,list=a.map((x,i)=>`${i+1}. ${x.substance}\n   Test result: ${x.result}\n   Requirement / limit: ${x.limit}`).join('\n\n');p.textContent=`Subject: SGS RSL Failure Case Established | ${c.article||''} | Report ${c.report||''}\n\nDear ${c.supplier||'Supplier'} Team,\n\nA Failure Case has been established based on SGS RSL Report ${c.report||''} for Fabric Article ${c.article||''}${c.po?`, PO(s) ${c.po}`:''}${c.lot?`, Lot(s) ${c.lot}`:''}.\n\nFailed Items\n\n${list}\n\nImmediate action is required. Please immediately quarantine all affected material and stop shipment, cutting, production use, transfer, or release until Vuori provides the next written instruction.\n\nPlease provide the possible root cause, affected quantity, affected PO(s), affected lot(s), current inventory status, quarantine status, disposition plan, full retest plan, sample submission date, expected completion date, and SGS TRF number once available.\n\nThank you for your immediate attention and cooperation.\n\nBest regards,\nVuori Product Integrity & Compliance`;if($('emailCard'))$('emailCard').classList.remove('hidden');window.currentCase=c;}
function createDraft(){syncItems();const c=collectCase();if(!c.report||!c.reportDate||!c.supplier||!c.article||!failedItems.length||failedItems.some(x=>!x.substance||!x.result||!x.limit)){alert('Review and complete the required header fields and every Failed Item.');return;}c.id=nextDraftId();c.source='draft';draftCases.unshift(c);localStorage.setItem(DRAFT_KEY,JSON.stringify(draftCases));renderCases();generateEmail(c);downloadDraftRow(c.id);$('emailCard')?.scrollIntoView({behavior:'smooth'});alert('Failure Case saved as a local draft. The CSV row has been downloaded for RSL Failure Tracking Master.csv.');}
function install(){installFailedItemsUI();renderItems();const a=$('analyzePdf');if(a){a.onclick=null;a.replaceWith(a.cloneNode(true));$('analyzePdf').onclick=analyze;}const c=$('createCase');if(c)c.onclick=createDraft;if($('caseSearch'))$('caseSearch').oninput=renderCases;if($('caseStatus'))$('caseStatus').onchange=renderCases;window.generateEmail=generateEmail;loadMaster();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
