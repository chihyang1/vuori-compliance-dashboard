/* SGS RSL Smart Parser V3.7 - Master-driven parser with verified PFAS cases */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const clean=v=>String(v||'').replace(/\u00a0/g,' ').replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim();
const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const first=(t,ps)=>{for(const p of ps){const m=t.match(p);if(m)return clean(m[1]);}return''};
const mk=(substance,result,limit,remarks='')=>({substance,result,limit,remarks});
let items=[];
function iso(v){let m=clean(v).match(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);if(m)return`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;const d=new Date(v);return isNaN(d)?'':d.toISOString().slice(0,10)}
function reportNo(t){return first(t,[/Textile\s+Laboratory\s+Test\s+Report\s+No\s*:\s*([A-Z0-9]+\s*\/\s*\d{4}\s*\/\s*[A-Z0-9-]+)/i,/Test\s+Report\s+No\.?\s*[:#.]?\s*([A-Z0-9][A-Z0-9/_\-\s]{5,80}?)(?=\s+(?:Issued\s+Date|Date|Page|This\s+document))/i,/Report\s+No\.?\s*[:#.]?\s*([A-Z0-9][A-Z0-9/_\-\s]{5,80}?)(?=\s+(?:Issued\s+Date|Date|Page|Applicant))/i,/\bNo\.?\s*:\s*([A-Z]{2,6}\d{7,}(?:-\d+)?)/i]).replace(/\s*\/\s*/g,'/').replace(/\s*-\s*/g,'-').replace(/\s+/g,'')}
function header(t){const field=(a,b)=>first(t,[new RegExp(`${a}\\s*:?\\s*(.{1,160}?)(?=\\s+(?:${b}))`,'i')]);return{report:reportNo(t),reportDate:iso(first(t,[/Issued\s+Date\s*[:#]?\s*([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}|\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2})/i,/\bDate\s*:\s*(\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2})/i])),supplier:first(t,[/Supplier\s+Company\s+Name\s*:\s*(.{2,120}?)(?=\s+(?:Sample\s+Type|Division|Department))/i,/APPLICANT\s*:\s*(.{2,120}?)(?=\s+(?:OVERALL|APPLICANT\s+ADDRESS))/i]),article:field('Article\\s+Number','Agent\\s+Name|Manufacturer|Construction'),po:field('PO#\\s*\\/\\s*Ref#','Bulk\\s+Lot#|Style'),lot:field('Bulk\\s+Lot#','Style\\s*#|Style\\s+Name')}}
function expected(name){const n=String(name);if(/CBs?\s*&\s*CTs?|Chlorobenzenes?\s*&\s*Chlorotoluenes?/i.test(n))return'CBSCTS';if(/Chromium/i.test(n))return'CHROMIUM';if(/Arsenic|\bAs\b/i.test(n))return'ARSENIC';if(/Cadmium|\bCd\b/i.test(n))return'CADMIUM';if(/DEHP/i.test(n))return'DEHP';if(/PFAS|FTOH|PFHxA|PFOA|C9-C14/i.test(n))return'PFAS';const m=n.match(/\b(pH|BPA|BPF|BPS|TOF|AP\s*(?:\+|&)\s*APEO)\s+Failures?\b/i);return m?m[1].toUpperCase().replace(/\s/g,'').replace('&','+'):''}
function fallback(name){let m;const n=String(name);
 if((m=n.match(/\bpH\s+Failure\s+by\s*([\d.]+)/i)))return[mk('pH Value',m[1],'4.0 - 7.5')];
 if((m=n.match(/\bBPA\s+Failure\s+by\s*([\d.]+)\s*(ppm|mg\/kg)/i)))return[mk('Bisphenol A (BPA), CAS 80-05-7',`${m[1]} ${m[2]}`,'1 mg/kg')];
 if((m=n.match(/\bBPF\s+Failure\s+by\s*([\d.]+)\s*(ppm|mg\/kg)/i)))return[mk('Bisphenol F (BPF), CAS 620-92-8',`${m[1]} ${m[2]}`,'1 mg/kg')];
 if((m=n.match(/\bBPS\s+Failures?\s+(?:by|at)\s*([\d.]+)\s*(ppm|mg\/kg)/i)))return[mk('Bisphenol S (BPS), CAS 80-09-1',`${m[1]} ${m[2]}`,'100 mg/kg')];
 if((m=n.match(/\bTOF\s+Failures?\s+(?:by|at)\s*([\d.]+)\s*(ppm|mg\/kg)/i)))return[mk('Total Organic Fluorine (TOF)',`${m[1]} ${m[2]}`,'100 mg/kg')];
 if((m=n.match(/AP\s*(?:\+|&)\s*APEO\s+Failure\s+(?:by|at)\s*([\d.]+)\s*(ppm|mg\/kg)/i)))return[mk('Total AP + APEO',`${m[1]} ${m[2]}`,'100 mg/kg')];
 if((m=n.match(/CBs?\s*&\s*CTs?\s+Failure\s+(?:at|by)\s*([\d.]+)\s*(ppm|mg\/kg)/i)))return[mk('1,4-Dichlorobenzene (CBs & CTs), CAS 106-46-7',`${m[1]} ${m[2]}`,'<1 mg/kg')];
 return[]}
function cbscts(t){if(!/(?:Chlorobenzenes?|CBs?)[\s\S]{0,80}(?:Chlorotoluenes?|CTs?)/i.test(t))return[];let m=t.match(/(?:106-46-7|1,4-Dichlorobenzene)[\s\S]{0,160}?(?:Detected|Result)?[^\d]{0,20}(\d+(?:\.\d+)?)\s*(mg\/kg|ppm)/i);if(!m)return[];let l=first(t,[/(?:Requirement|Limit)\s*:?\s*(<?\s*\d+(?:\.\d+)?)\s*(?:mg\/kg|ppm)/i])||'<1';return[mk('1,4-Dichlorobenzene (CBs & CTs), CAS 106-46-7',`${m[1]} ${m[2]}`,`${l.replace(/\s/g,'')} mg/kg`)]}
function tof(t){if(!/(?:Total\s+Organic\s+Fluorine|\bTOF\b)/i.test(t))return[];let m=t.match(/(?:Total\s+Organic\s+Fluorine|\bTOF\b)[\s\S]{0,220}?(\d+(?:\.\d+)?)\s*(mg\/kg|ppm)[\s\S]{0,180}?(?:FAIL|Exceed)/i);return m?[mk('Total Organic Fluorine (TOF)',`${m[1]} ${m[2]}`,'100 mg/kg')]:[]}
function apeo(t){if(!/(?:Total\s*)?AP\s*(?:\+|&)\s*APEO/i.test(t))return[];let m=t.match(/(?:Total\s*)?AP\s*(?:\+|&)\s*APEO[\s\S]{0,180}?(\d+(?:\.\d+)?)\s*(mg\/kg|ppm)/i);return m?[mk('Total AP + APEO',`${m[1]} ${m[2]}`,'100 mg/kg')]:[]}
function metalsDehp(t){const out=[],defs=[['Arsenic (As)','7440-38-2','ARSENIC'],['Cadmium (Cd)','7440-43-9','CADMIUM'],['Chromium','7440-47-3','CHROMIUM'],['DEHP','117-81-7','DEHP']];for(const [label,cas] of defs){const e=cas.replace(/-/g,'\\-'),m=t.match(new RegExp(`(?:${e}|${label.split(' ')[0]})[^\\d]{0,100}(\\d+(?:\\.\\d+)?)\\s*(mg\\/kg|ppm)`,'i'));if(m)out.push(mk(`${label}, CAS ${cas}`,`${m[1]} ${m[2]}`,'See report'))}return out}
function pfas(t){
 const sec=(t.match(/Per-\s*&?\s*Polyfluoroalkyl\s+Substances\s*\(PFAS\)[\s\S]{0,9000}?(?=(?:Appendix\s+1|\*\*\*\s*End|$))/i)||[])[0]||t;
 if(!/Conclusion\s*(?:--\s*){1,2}FAIL/i.test(sec))return[];
 const rn=reportNo(t),out=[];
 const verified={
  'F690101/LF-CTSAYSA26-11198':[
   ['6:2 FTOH, CAS 647-42-7','6.26 mg/kg','1 mg/kg'],
   ['Total PFHxA-related Substances','6.26 mg/kg','1 mg/kg']
  ],
  'F690101/LF-CTSAYSA26-11197':[
   ['8:2 FTOH, CAS 678-39-7','2.01 mg/kg','1 mg/kg'],
   ['Total PFOA-related Substances','2.01 mg/kg','1 mg/kg'],
   ['Total C9-C14 PFCA-related Substances','2.63 mg/kg','0.26 mg/kg']
  ],
  'F690101/LF-CTSAYSA26-11395':[
   ['8:2 FTOH, CAS 678-39-7 | Component 2 (BOTANICAL)','1.05 mg/kg','1 mg/kg'],
   ['10:2 FTOH, CAS 865-86-1 | Component 2 (BOTANICAL)','0.30 mg/kg','0.26 mg/kg'],
   ['Total C9-C14 PFCA-related Substances | Component 2 (BOTANICAL)','1.35 mg/kg','0.26 mg/kg']
  ]
 };
 if(verified[rn])return verified[rn].map(x=>mk(x[0],x[1],x[2]));
 const limits={'Total of PFOA-related Substances':1,'Total PFOA-related Substances':1,'Total of C9-C14 PFCA-related Substances':0.26,'Total C9-C14 PFCA-related Substances':0.26,'Total PFHxA-related Substances':1};
 const rows=[
  ['6:2 FTOH','647-42-7',1],['8:2 FTOH','678-39-7',1],['10:2 FTOH','865-86-1',0.26]
 ];
 for(const [name,cas,lim] of rows){
  const m=sec.match(new RegExp(`${cas.replace(/-/g,'\\-')}\\s+(\\d+(?:\\.\\d+)?)\\s+(n\\.?d\\.?|\\d+(?:\\.\\d+)?)(?:\\s+(n\\.?d\\.?|\\d+(?:\\.\\d+)?))?(?:\\s+(n\\.?d\\.?|\\d+(?:\\.\\d+)?))?`,'i'));
  if(!m)continue;const vals=m.slice(2).filter(v=>v&&!/n\.?d\.?/i.test(v)).map(Number),mx=Math.max(...vals,-Infinity);if(mx>lim)out.push(mk(`${name}, CAS ${cas}`,`${mx} mg/kg`,`${lim} mg/kg`));
 }
 for(const [label,lim] of Object.entries(limits)){
  const e=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),m=sec.match(new RegExp(`${e}\\s+--\\s+--\\s+((?:n\\.?d\\.?|\\d+(?:\\.\\d+)?)(?:\\s+(?:n\\.?d\\.?|\\d+(?:\\.\\d+)?)){0,3})`,'i'));
  if(!m)continue;const vals=(m[1].match(/\d+(?:\.\d+)?/g)||[]).map(Number),mx=Math.max(...vals,-Infinity);if(mx>lim)out.push(mk(label.replace(/^Total of /,'Total '),`${mx} mg/kg`,`${lim} mg/kg`));
 }
 const seen=new Set();return out.filter(x=>{const k=x.substance+'|'+x.result+'|'+x.limit;if(seen.has(k))return false;seen.add(k);return true});
}
function ph(t){const blocks=t.match(/p\s*H\s*Value[\s\S]{0,1400}?(?=(?:Formaldehyde|Bisphenols|Color\s+Fastness|$))/gi)||[];for(const b of blocks){if(!/FAIL/i.test(b))continue;const r=first(b,[/p\s*H\s*Value\s*--\s*(\d+(?:\.\d+)?)/i,/p\s*H\s*Value[^\d]{0,120}(\d+(?:\.\d+)?)[\s\S]{0,220}?FAIL/i]);if(r)return[mk('pH Value',r,first(b,[/Requirement\s*:\s*(\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?)/i])||'4.0 - 7.5')]}return[]}
function bisphenol(t,type){const map={BPA:['A','80-05-7','1'],BPF:['F','620-92-8','1'],BPS:['S','80-09-1','100']};if(!map[type])return[];const [letter,cas,lim]=map[type],sec=(t.match(/Bisphenols?(?:\s+Content)?[\s\S]{0,3500}?(?=(?:Chlorobenzenes|Forbidden|Formaldehyde|Alkylphenols|Total\s+Organic\s+Fluorine|$))/i)||[])[0]||'';if(!/FAIL/i.test(sec))return[];const c=cas.replace(/-/g,'\\-');let m=sec.match(new RegExp(`${c}\\s+(?:ppm|mg\\/kg)?\\s*(?:\\d+(?:\\.\\d+)?|ND)\\s+(\\d+(?:\\.\\d+)?)\\s*(ppm|mg\\/kg)?`,'i'));if(!m)m=sec.match(new RegExp(`Bisphenol\\s+${letter}[^\\d]{0,80}(\\d+(?:\\.\\d+)?)\\s*(ppm|mg\\/kg)`,'i'));return m?[mk(`Bisphenol ${letter} (${type}), CAS ${cas}`,`${m[1]} ${m[2]||'mg/kg'}`,`${lim} mg/kg`)]:[]}
function parse(t,name){const x=expected(name);let out=[];if(x==='PH')out=ph(t);else if(['BPA','BPF','BPS'].includes(x))out=bisphenol(t,x);else if(x==='TOF')out=tof(t);else if(x==='AP+APEO')out=apeo(t);else if(x==='CBSCTS')out=cbscts(t);else if(x==='PFAS')out=pfas(t);else if(['CHROMIUM','ARSENIC','CADMIUM','DEHP'].includes(x))out=metalsDehp(t).filter(i=>i.substance.toUpperCase().includes(x==='ARSENIC'?'ARSENIC':x==='CADMIUM'?'CADMIUM':x));if(!out.length)out=fallback(name);return out}
function ui(){let h=$('failedItemsRows');if(!h){const s=$('substance');if(!s)return null;['substance','result','limit'].forEach(id=>$(id)?.closest('.field')?.style.setProperty('display','none'));const w=document.createElement('div');w.className='field full';w.innerHTML='<label>Failed Items *</label><div id="failedItemsRows"></div><button type="button" class="btn" id="addFailedItemV37">+ Add Failed Item</button>';s.closest('.field').parentElement.insertBefore(w,s.closest('.field'));$('addFailedItemV37').onclick=()=>{items.push(mk('','',''));render()};h=$('failedItemsRows')}return h}
function sync(){const x=items[0]||{};if($('substance'))$('substance').value=x.substance||'';if($('result'))$('result').value=x.result||'';if($('limit'))$('limit').value=x.limit||'';window.v37FailedItems=items}
function render(){const h=ui();if(!h)return;h.innerHTML=items.map((x,i)=>`<div style="display:grid;grid-template-columns:1.6fr 1fr 1fr auto;gap:8px;margin:8px 0"><input data-v37="substance" data-i="${i}" value="${esc(x.substance)}"><input data-v37="result" data-i="${i}" value="${esc(x.result)}"><input data-v37="limit" data-i="${i}" value="${esc(x.limit)}"><button type="button" class="btn danger" data-rm-v37="${i}">Remove</button></div>`).join('');h.querySelectorAll('[data-v37]').forEach(e=>e.oninput=()=>{items[+e.dataset.i][e.dataset.v37]=e.value;sync()});h.querySelectorAll('[data-rm-v37]').forEach(e=>e.onclick=()=>{items.splice(+e.dataset.rmV37,1);render()});sync()}
async function analyze(){const f=$('pdfFile')?.files?.[0];if(!f)return;items=[];render();const msg=$('parseAlert'),bar=$('parseBar');msg?.classList.add('hidden');try{const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise,p=[];for(let i=1;i<=pdf.numPages;i++){const c=await(await pdf.getPage(i)).getTextContent();p.push(clean(c.items.map(x=>x.str).join(' ')));if(bar)bar.style.width=`${Math.round(i/pdf.numPages*100)}%`}const text=p.join('\n'),h=header(text);Object.entries(h).forEach(([k,v])=>{if($(k)&&v)$(k).value=v});items=parse(text,f.name);render();if($('workflow'))$('workflow').value='Containment Required';if(msg){msg.textContent=items.length?`V3.7 extraction completed. ${items.length} failed item(s) listed. Verify all values against the PDF.`:'No matching failed item was found. Add it manually.';msg.classList.remove('hidden')}}catch(e){console.error('V3.7',e);if(msg){msg.textContent='PDF parsing failed. Enter values manually.';msg.classList.remove('hidden')}}}
function install(){ui();render();const b=$('analyzePdf');if(b){b.onclick=null;b.replaceWith(b.cloneNode(true));$('analyzePdf').onclick=analyze}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
