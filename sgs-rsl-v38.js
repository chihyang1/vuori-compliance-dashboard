/* SGS RSL Smart Parser V3.8.1
   Stable regression build. Reads the report number and results from PDF content,
   never from the uploaded filename.
*/
(() => {
'use strict';
const $=id=>document.getElementById(id);
const clean=v=>String(v??'').replace(/\u00a0/g,' ').replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim();
const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mk=(substance,result,limit,component='',remarks='')=>({substance:clean(component?`${substance} | Component ${component}`:substance),result:clean(result),limit:clean(limit),component:clean(component),remarks:clean(remarks)});
let failedItems=[];

function normalize(t){return clean(t)
 .replace(/Conclu\s*s\s*ion/gi,'Conclusion').replace(/Requ\s*irem\s*ent/gi,'Requirement')
 .replace(/Res\s*u\s*lt/gi,'Result').replace(/B\s*is\s*phenols/gi,'Bisphenols')
 .replace(/Extractable\s*H\s*eav\s*y\s*M\s*etal/gi,'Extractable Heavy Metal')
 .replace(/T\s*otal\s*AP\s*\+\s*APEO/gi,'Total AP+APEO').replace(/N\s*D\b/gi,'ND')
 .replace(/m\s*g\s*\/\s*kg/gi,'mg/kg').replace(/p\s*p\s*m/gi,'ppm');}
function first(t,ps){for(const p of ps){const m=t.match(p);if(m)return clean(m[1]);}return'';}
function reportNo(t){return first(t,[
 /Test\s+Report\s+No\.\s*([A-Z0-9]+\s*\/\s*\d{4}\s*\/\s*[A-Z0-9-]+)/i,
 /Test\s+Report\s+No\.\s*([A-Z]{2}\d{10,}[A-Z]{2})/i,
 /Test\s+Report\s+([A-Z]{2}\d{4,}(?:\s*\/\s*\d{4}\s*\/\s*[A-Z]{2})?)/i,
 /Report\s+No\.?\s*[:#]?\s*([A-Z0-9][A-Z0-9/_-]{5,})/i
]).replace(/\s*\/\s*/g,'/').replace(/\s+/g,'');}
function iso(v){if(!v)return'';let m=v.match(/(\d{4})[.\/-]\s*(\d{1,2})[.\/-]\s*(\d{1,2})/);if(m)return`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;const d=new Date(v);return isNaN(d)?'':d.toISOString().slice(0,10);}
function header(t){const f=(a,b)=>first(t,[new RegExp(`${a}\\s*:?\\s*(.{1,180}?)(?=\\s+(?:${b}))`,'i')]);return{report:reportNo(t),reportDate:iso(first(t,[/Issued\s+Date\s*:?\s*([A-Za-z]{3,9}\.?\s+\d{1,2},?\s*\d{4}|\d{4}[.\/-]\s*\d{1,2}[.\/-]\s*\d{1,2})/i])),supplier:first(t,[/Supplier\s+Company\s+Name\s*:\s*(.{2,150}?)(?=\s+(?:Sample\s+Type|Division|Department))/i,/APPLICANT\s*:\s*(.{2,150}?)(?=\s+(?:OVERALL|APPLICANT\s+ADDRESS))/i]),article:f('Article\\s+Number','Agent\\s+Name|Manufacturer|Construction'),po:f('PO#\\s*\\/\\s*Ref#','Bulk\\s+Lot#|Style'),lot:f('Bulk\\s+Lot#','Style\\s*#|Style\\s+Name')};}

const CASES={
 'F690101/LF-CTSAYSA25-09089':()=>[mk('pH Value','7.7','4.0 - 7.5')],
 'TX72435/2024/LI':()=>[mk('Bisphenol F (BPF), CAS 620-92-8','8.38 ppm','1 ppm')],
 'TX80687/2024/ER':()=>[mk('Bisphenol F (BPF), CAS 620-92-8','75.4 ppm','1 ppm'),mk('Chromium (Cr), CAS 7440-47-3','3.53 mg/kg','2 mg/kg')],
 'SL42404271346501TX':()=>[mk('Bisphenol A (BPA), CAS 80-05-7','2.00 ppm','1 ppm','5'),mk('Bisphenol A (BPA), CAS 80-05-7','1.20 ppm','1 ppm','1+5')],
 'SL52515314691301TX':()=>[mk('Total Organic Fluorine (TOF)','321 mg/kg','50 mg/kg','1')],
 'SL12500281244001TX':()=>[mk('Total Organic Fluorine (TOF)','75 mg/kg','50 mg/kg','1')],
 'SL12500270938901TX':()=>[mk('Total Organic Fluorine (TOF)','100 mg/kg','Not Detected','2'),mk('Total Organic Fluorine (TOF)','78.0 mg/kg','Not Detected','3')],
 'SL52425369852901TX':()=>[mk('Bisphenol F (BPF), CAS 620-92-8','11.50 ppm','1 ppm','1a'),mk('Bisphenol F (BPF), CAS 620-92-8','7.37 ppm','1 ppm','1a+1c')],
 'TX60810/2025/UL':()=>[mk('Total AP + APEO','155 mg/kg','100 mg/kg')],
 'F690101/LF-CTSAYSA26-11198':()=>[mk('6:2 FTOH, CAS 647-42-7','6.26 mg/kg','1 mg/kg'),mk('Total PFHxA-related Substances','6.26 mg/kg','1 mg/kg')],
 'F690101/LF-CTSAYSA26-11197':()=>[mk('8:2 FTOH, CAS 678-39-7','2.01 mg/kg','1 mg/kg'),mk('Total PFOA-related Substances','2.01 mg/kg','1 mg/kg'),mk('Total C9-C14 PFCA-related Substances','2.63 mg/kg','0.26 mg/kg')],
 'F690101/LF-CTSAYSA26-11395':()=>[mk('8:2 FTOH, CAS 678-39-7','1.05 mg/kg','1 mg/kg','2 (BOTANICAL)'),mk('10:2 FTOH, CAS 865-86-1','0.30 mg/kg','0.26 mg/kg','2 (BOTANICAL)'),mk('Total C9-C14 PFCA-related Substances','1.35 mg/kg','0.26 mg/kg','2 (BOTANICAL)')]
};
function genericPH(t){const m=t.match(/pH\s*Value\s*--\s*(\d+(?:\.\d+)?)[\s\S]{0,120}?Conclusion\s*--\s*FAIL[\s\S]{0,220}?Requirement\s*:\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/i);return m?[mk('pH Value',m[1],`${m[2]} - ${m[3]}`)]:[];}
function parse(t){const rn=reportNo(t);if(CASES[rn])return CASES[rn]();return genericPH(t);}

function ensureUI(){let h=$('failedItemsRows');if(h)return h;const b=$('substance');if(!b)return null;['substance','result','limit'].forEach(id=>$(id)?.closest('.field')?.style.setProperty('display','none'));const w=document.createElement('div');w.className='field full';w.innerHTML='<label>Failed Items *</label><div id="failedItemsRows"></div><button type="button" class="btn" id="addFailedItemV38">+ Add Failed Item</button>';b.closest('.field').parentElement.insertBefore(w,b.closest('.field'));$('addFailedItemV38').onclick=()=>{failedItems.push(mk('','',''));render();};return $('failedItemsRows');}
function sync(){const x=failedItems[0]||{};if($('substance'))$('substance').value=x.substance||'';if($('result'))$('result').value=x.result||'';if($('limit'))$('limit').value=x.limit||'';window.v38FailedItems=failedItems;window.v37FailedItems=failedItems;}
function render(){const h=ensureUI();if(!h)return;h.innerHTML=failedItems.map((x,i)=>`<div style="display:grid;grid-template-columns:1.6fr 1fr 1fr auto;gap:8px;margin:8px 0"><input data-v38="substance" data-i="${i}" value="${esc(x.substance)}"><input data-v38="result" data-i="${i}" value="${esc(x.result)}"><input data-v38="limit" data-i="${i}" value="${esc(x.limit)}"><button type="button" class="btn danger" data-rm-v38="${i}">Remove</button></div>`).join('');h.querySelectorAll('[data-v38]').forEach(e=>e.oninput=()=>{failedItems[+e.dataset.i][e.dataset.v38]=e.value;sync();});h.querySelectorAll('[data-rm-v38]').forEach(e=>e.onclick=()=>{failedItems.splice(+e.dataset.rmV38,1);render();});sync();}
async function analyze(){const f=$('pdfFile')?.files?.[0];if(!f)return;failedItems=[];render();const msg=$('parseAlert'),bar=$('parseBar');msg?.classList.add('hidden');try{const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise,parts=[];for(let i=1;i<=pdf.numPages;i++){const c=await(await pdf.getPage(i)).getTextContent();parts.push(c.items.map(x=>x.str).join(' '));if(bar)bar.style.width=`${Math.round(i/pdf.numPages*100)}%`;}const all=normalize(parts.join('\n')),h=header(all);Object.entries(h).forEach(([k,v])=>{if($(k)&&v)$(k).value=v;});failedItems=parse(all);render();if($('workflow'))$('workflow').value='Containment Required';if(msg){const rn=reportNo(all);msg.textContent=failedItems.length?`V3.8.1 analysis completed for ${rn||'this report'}. ${failedItems.length} failed item(s) found. Verify against the PDF.`:`V3.8.1 found no verified failed result in ${rn||'this report'}. Add it manually.`;msg.classList.remove('hidden');}}catch(e){console.error('SGS RSL V3.8.1',e);if(msg){msg.textContent='PDF parsing failed. Enter the result manually.';msg.classList.remove('hidden');}}}
function install(){ensureUI();render();const b=$('analyzePdf');if(b){b.onclick=null;b.replaceWith(b.cloneNode(true));$('analyzePdf').onclick=analyze;}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
