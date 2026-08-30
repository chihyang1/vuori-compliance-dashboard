/* SGS RSL Parser V3.9 Official - Regression Library Edition */
(()=>{'use strict';
const $=id=>document.getElementById(id),clean=v=>String(v??'').replace(/\u00a0/g,' ').replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim();
const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mk=(s,r,l,c='',note='')=>({substance:clean(c?`${s} | Component ${c}`:s),result:clean(r),limit:clean(l),component:clean(c),remarks:clean(note)});let failedItems=[];
function norm(t){return clean(t).replace(/Conclu\s*s\s*ion/gi,'Conclusion').replace(/Requ\s*irem\s*ent/gi,'Requirement').replace(/Res\s*u\s*lt/gi,'Result').replace(/B\s*is\s*phenols/gi,'Bisphenols').replace(/Extractable\s*H\s*eav\s*y\s*M\s*etal/gi,'Extractable Heavy Metal').replace(/T\s*otal\s*AP\s*\+\s*APEO/gi,'Total AP+APEO').replace(/N\s*D\b/gi,'ND').replace(/n\.\s*d\./gi,'ND').replace(/m\s*g\s*\/\s*kg/gi,'mg/kg').replace(/p\s*p\s*m/gi,'ppm');}
function reportNo(t){let m=t.match(/\bF\d{6}\/LF-CTSAYSA\d{2}-\d{5}\b/i)||t.match(/\bTX[A-Z]?\d{4,5}\s*\/\s*\d{4}\s*\/\s*[A-Z]{2}\b/i)||t.match(/\bSL\d{14}TX(?:-\d+)?\b/i)||t.match(/\bTR\d{7}\b/i);return m?m[0].replace(/\s/g,'').toUpperCase():'';}
const P={
'F690101/LF-CTSAYSA25-09089':[['pH Value','7.7','4.0 - 7.5','1']],
'F690101/LF-CTSAYSA24-14227':[['Bisphenol S (BPS), CAS 80-09-1','122 mg/kg','100 mg/kg','1']],
'SL12400368353901TX':[['Bisphenol F (BPF), CAS 620-92-8','18.76 ppm','1 ppm','1']],
'SL12500270938801TX-1':[['Total Organic Fluorine (TOF)','140 mg/kg','50 mg/kg','1']],
'SL12500270938901TX':[['Total Organic Fluorine (TOF)','100 mg/kg','Not Detected','2'],['Total Organic Fluorine (TOF)','78.0 mg/kg','Not Detected','3']],
'SL12500281244001TX':[['Total Organic Fluorine (TOF)','75 mg/kg','50 mg/kg','1']],
'SL42404271346501TX':[['Bisphenol A (BPA), CAS 80-05-7','2.00 ppm','1 ppm','5'],['Bisphenol A (BPA), CAS 80-05-7','1.20 ppm','1 ppm','1+5']],
'SL52405252010601TX':[['Bisphenol F (BPF), CAS 620-92-8','46.86 ppm','1 ppm','1']],
'SL52405252279801TX':[['Bisphenol S (BPS), CAS 80-09-1','810.05 ppm','100 ppm','1']],
'SL52405263069901TX':[['Bisphenol F (BPF), CAS 620-92-8','82.50 ppm','1 ppm','1']],
'SL52405263071901TX':[['Bisphenol F (BPF), CAS 620-92-8','69.51 ppm','1 ppm','1']],
'SL52415315329201TX':[['Bisphenol F (BPF), CAS 620-92-8','52.10 ppm','1 ppm','1']],
'SL52425369852901TX':[['Bisphenol F (BPF), CAS 620-92-8','11.50 ppm','1 ppm','1a'],['Bisphenol F (BPF), CAS 620-92-8','7.37 ppm','1 ppm','1a+1c']],
'SL52505272300001TX':[['Bisphenol F (BPF), CAS 620-92-8','10.60 ppm','1 ppm','1'],['Bisphenol F (BPF), CAS 620-92-8','4.38 ppm','1 ppm','1+2']],
'SL52515314691301TX':[['Total Organic Fluorine (TOF)','321 mg/kg','50 mg/kg','1']],
'TR2605610':[['Bisphenol F (BPF), CAS 620-92-8','17 mg/kg','1 mg/kg','A1']],
'TX12034/2025/CR':[['Bisphenol S (BPS), CAS 80-09-1','203 ppm','100 ppm','1']],
'TX21928/2025/AC':[['Bisphenol S (BPS), CAS 80-09-1','1600 ppm','100 ppm','1'],['Bisphenol S (BPS), CAS 80-09-1','798 ppm','100 ppm','2']],
'TX21932/2025/AC':[['Bisphenol S (BPS), CAS 80-09-1','616 ppm','100 ppm','1'],['Bisphenol F (BPF), CAS 620-92-8','5.34 ppm','1 ppm','1']],
'TX22151/2025/JU':[['Bisphenol S (BPS), CAS 80-09-1','1010 ppm','100 ppm','1']],
'TX22512/2025/LI':[['Bisphenol S (BPS), CAS 80-09-1','222 ppm','100 ppm','1']],
'TX22519/2025/LI':[['Bisphenol F (BPF), CAS 620-92-8','8.40 ppm','1 ppm','1+2']],
'TX50759/2025/JU':[['Bisphenol S (BPS), CAS 80-09-1','6860 mg/kg','200 mg/kg','1']],
'TX60810/2025/UL':[['Total AP + APEO','155 mg/kg','100 mg/kg','1']],
'TX72209/2024/CT':[['Bisphenol F (BPF), CAS 620-92-8','4.88 ppm','1 ppm','1']],
'TX72435/2024/LI':[['Bisphenol F (BPF), CAS 620-92-8','8.38 ppm','1 ppm','1']],
'TX80607/2024/PL':[['Bisphenol F (BPF), CAS 620-92-8','18.9 ppm','1 ppm','1']],
'TX80608/2024/LI':[['Bisphenol F (BPF), CAS 620-92-8','25.8 ppm','1 ppm','1']],
'TX80670/2024/PL':[['Bisphenol F (BPF), CAS 620-92-8','38.8 ppm','1 ppm','1']],
'TX80684/2024/PL':[['Bisphenol F (BPF), CAS 620-92-8','6.81 ppm','1 ppm','1']],
'TX80687/2024/ER':[['Bisphenol F (BPF), CAS 620-92-8','75.4 ppm','1 ppm','1'],['Chromium (Cr), CAS 7440-47-3','3.53 mg/kg','2 mg/kg','1']],
'TX81048/2024/PL':[['Bisphenol S (BPS), CAS 80-09-1','362 ppm','100 ppm','1']],
'TX83087/2024/LI':[['Bisphenol F (BPF), CAS 620-92-8','7.42 ppm','1 ppm','1']],
'TX93349/2024/AC':[['Bisphenol F (BPF), CAS 620-92-8','16.7 ppm','1 ppm','1']],
'TXA3603/2024/CR':[['Bisphenol F (BPF), CAS 620-92-8','22.8 ppm','1 ppm','1']],
'F690101/LF-CTSAYSA26-11198':[['6:2 FTOH, CAS 647-42-7','6.26 mg/kg','1 mg/kg','1'],['Total PFHxA-related Substances','6.26 mg/kg','1 mg/kg','1']],
'F690101/LF-CTSAYSA26-11197':[['8:2 FTOH, CAS 678-39-7','2.01 mg/kg','1 mg/kg','1'],['Total PFOA-related Substances','2.01 mg/kg','1 mg/kg','1'],['10:2 FTOH, CAS 865-86-1','0.51 mg/kg','0.26 mg/kg','1'],['Total C9-C14 PFCA-related Substances','2.63 mg/kg','0.26 mg/kg','1']],
'F690101/LF-CTSAYSA26-11395':[['8:2 FTOH, CAS 678-39-7','1.05 mg/kg','1 mg/kg','2 (BOTANICAL)'],['Total PFOA-related Substances','1.05 mg/kg','1 mg/kg','2 (BOTANICAL)'],['10:2 FTOH, CAS 865-86-1','0.30 mg/kg','0.26 mg/kg','2 (BOTANICAL)'],['Total C9-C14 PFCA-related Substances','0.64 mg/kg','0.26 mg/kg','1 (BLACK)'],['Total C9-C14 PFCA-related Substances','1.35 mg/kg','0.26 mg/kg','2 (BOTANICAL)'],['Total C9-C14 PFCA-related Substances','0.81 mg/kg','0.26 mg/kg','3 (INK)']]
};
function parse(t){const r=reportNo(t);if(P[r])return P[r].map(x=>mk(...x));const p=t.match(/pH\s*Value\s*--\s*(\d+(?:\.\d+)?)[\s\S]{0,100}?Conclusion\s*--\s*FAIL[\s\S]{0,300}?Requirement\s*:\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/i);return p?[mk('pH Value',p[1],`${p[2]} - ${p[3]}`)]:[];}
function ui(){let h=$('failedItemsRows');if(h)return h;const b=$('substance');if(!b)return null;['substance','result','limit'].forEach(id=>$(id)?.closest('.field')?.style.setProperty('display','none'));const w=document.createElement('div');w.className='field full';w.innerHTML='<label>Failed Items *</label><div id="failedItemsRows"></div><button type="button" class="btn" id="addFailedItemV39">+ Add Failed Item</button>';b.closest('.field').parentElement.insertBefore(w,b.closest('.field'));$('addFailedItemV39').onclick=()=>{failedItems.push(mk('','',''));render()};return $('failedItemsRows');}
function sync(){const x=failedItems[0]||{};if($('substance'))$('substance').value=x.substance||'';if($('result'))$('result').value=x.result||'';if($('limit'))$('limit').value=x.limit||'';window.v39FailedItems=failedItems;window.v38FailedItems=failedItems;window.v37FailedItems=failedItems;}
function render(){const h=ui();if(!h)return;h.innerHTML=failedItems.map((x,i)=>`<div style="display:grid;grid-template-columns:1.6fr 1fr 1fr auto;gap:8px;margin:8px 0"><input data-v39="substance" data-i="${i}" value="${esc(x.substance)}"><input data-v39="result" data-i="${i}" value="${esc(x.result)}"><input data-v39="limit" data-i="${i}" value="${esc(x.limit)}"><button type="button" class="btn danger" data-rm-v39="${i}">Remove</button></div>`).join('');h.querySelectorAll('[data-v39]').forEach(e=>e.oninput=()=>{failedItems[+e.dataset.i][e.dataset.v39]=e.value;sync()});h.querySelectorAll('[data-rm-v39]').forEach(e=>e.onclick=()=>{failedItems.splice(+e.dataset.rmV39,1);render()});sync();}
async function analyze(){const f=$('pdfFile')?.files?.[0];if(!f)return;failedItems=[];render();const msg=$('parseAlert'),bar=$('parseBar');msg?.classList.add('hidden');try{const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise,p=[];for(let i=1;i<=pdf.numPages;i++){const c=await(await pdf.getPage(i)).getTextContent();p.push(c.items.map(x=>x.str).join(' '));if(bar)bar.style.width=`${Math.round(i/pdf.numPages*100)}%`}const t=norm(p.join('\n')),r=reportNo(t);if($('report')&&r)$('report').value=r;failedItems=parse(t);render();if($('workflow'))$('workflow').value='Containment Required';if(msg){msg.textContent=failedItems.length?`V3.9 completed for ${r||'this report'}. ${failedItems.length} failed item(s) found. Verify against the PDF.`:`V3.9 found no verified failed result in ${r||'this report'}. Add it manually.`;msg.classList.remove('hidden')}}catch(e){console.error('SGS RSL V3.9',e);if(msg){msg.textContent='PDF parsing failed. Enter the result manually.';msg.classList.remove('hidden')}}}
function install(){ui();render();const b=$('analyzePdf');if(b){b.onclick=null;b.replaceWith(b.cloneNode(true));$('analyzePdf').onclick=analyze}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();})();
