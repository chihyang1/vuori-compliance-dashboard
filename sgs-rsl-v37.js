/* SGS RSL Smart Parser V3.7 - content-driven FAIL section scanner */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const clean=v=>String(v||'').replace(/\u00a0/g,' ').replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim();
const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const first=(t,ps)=>{for(const p of ps){const m=t.match(p);if(m)return clean(m[1]);}return''};
const mk=(substance,result,limit,remarks='')=>({substance:clean(substance),result:clean(result),limit:clean(limit),remarks:clean(remarks)});
const n=v=>{const m=String(v||'').replace(/,/g,'').match(/\d+(?:\.\d+)?/);return m?Number(m[0]):null};
let items=[];
function iso(v){let m=clean(v).match(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);if(m)return`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;const d=new Date(v);return isNaN(d)?'':d.toISOString().slice(0,10)}
function reportNo(t){return first(t,[/Test\s+Report(?:\s+No\.?)?\s*[:#.]?\s*([A-Z0-9][A-Z0-9/_\-]{5,})/i,/Textile\s+Laboratory\s+Test\s+Report\s+No\s*:\s*([A-Z0-9]+\s*\/\s*\d{4}\s*\/\s*[A-Z0-9-]+)/i,/Report\s+No\.?\s*[:#.]?\s*([A-Z0-9][A-Z0-9/_\-]{5,})/i]).replace(/\s*\/\s*/g,'/').replace(/\s+/g,'')}
function header(t){const field=(a,b)=>first(t,[new RegExp(`${a}\\s*:?\\s*(.{1,180}?)(?=\\s+(?:${b}))`,'i')]);return{report:reportNo(t),reportDate:iso(first(t,[/(?:Issued\s+Date|Date)\s*:?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s*\d{4}|\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2})/i])),supplier:first(t,[/Supplier\s+Company\s+Name\s*:\s*(.{2,140}?)(?=\s+(?:Sample\s+Type|Division|Department))/i,/APPLICANT\s*:\s*(.{2,140}?)(?=\s+(?:OVERALL|APPLICANT\s+ADDRESS))/i]),article:field('Article\\s+Number','Agent\\s+Name|Manufacturer|Construction'),po:field('PO#\\s*\\/\\s*REF#','Bulk\\s+Lot#|Style'),lot:field('Bulk\\s+Lot#','Style\\s*#|Style\\s+Name')}}
function failSection(t,start,end,max=6000){const re=new RegExp(`${start}[\\s\\S]{0,${max}}?(?=${end}|$)`,'gi');return(t.match(re)||[]).filter(s=>/Conclusion\s*(?:--\s*){0,2}(?:FAIL|Fail)/i.test(s))}
function parsePH(t){const out=[];for(const s of failSection(t,'p\\s*H\\s*Value','Azo-amines|Formaldehyde|Bisphenols',1600)){const r=first(s,[/pH\s*Value\s*-\s*(\d+(?:\.\d+)?)/i,/pH\s*Value[^\d]{0,120}(\d+(?:\.\d+)?)[\s\S]{0,240}?Conclusion/i]);const l=first(s,[/Requirement\s*:?\s*(\d+(?:\.\d+)?\s*[-~]\s*\d+(?:\.\d+)?)/i])||'4.0 - 7.5';if(r)out.push(mk('pH Value',r,l))}return out}
function parseBisphenols(t){
 const out=[];
 const defs=[['BPA','A','80-05-7',1],['BPS','S','80-09-1',100],['BPF','F','620-92-8',1],['BPAF','AF','1478-61-1',1],['BPB','B','77-40-7',1]];
 const secs=failSection(t,'Bisphenols?(?:\\s+Content)?','Total\\s+Organic\\s+Fluorine|Alkylphenols|Chlorobenzenes|Forbidden|$');
 for(const s of secs){
  for(const [abbr,letter,cas,defaultLim] of defs){
   const c=cas.replace(/-/g,'\\-');
   const re=new RegExp(`Bisphenol\\s*${letter}\\s*\\(${abbr}\\)\\s+${c}\\s+(?:ppm|mg\\/kg)\\s+([^\\n]{1,160})`,'gi');
   for(const row of s.matchAll(re)){
    const nums=(row[1].match(/(?:^|\\s)(\\d+(?:\\.\\d+)?)(?=\\s|$)/g)||[]).map(x=>Number(x.trim()));
    if(nums.length<3)continue;
    const rl=nums[0];
    const limit=nums[nums.length-1]||defaultLim;
    const results=nums.slice(1,-1).filter(v=>v!==rl&&v>limit);
    results.forEach((v,i)=>out.push(mk(`Bisphenol ${letter} (${abbr}), CAS ${cas}${results.length>1?` | Failed result ${i+1}`:''}`,`${v} mg/kg`,`${limit} mg/kg`)));
   }
  }
 }
 const seen=new Set();
 return out.filter(x=>{const k=x.substance+x.result+x.limit;if(seen.has(k))return false;seen.add(k);return true});
}
function parseTOF(t){const out=[];for(const s of failSection(t,'(?:Total\\s+Organic\\s+Fluorine(?:\\s+Screening)?|Fluorine\\s+Content)','Alkylphenols|Per-.*?Polyfluoroalkyl|$')){const m=s.match(/(?:Fluorine\s+Content|Total\s+Organic\s+Fluorine)[\s\S]{0,160}?(?:mg\/kg|ppm)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i);if(m&&n(m[1])>n(m[2]))out.push(mk('Total Organic Fluorine (TOF)',`${m[1]} mg/kg`,`${m[2]} mg/kg`))}return out}
function parseAPEO(t){const out=[];for(const s of failSection(t,'Alkylphenols?\\s*\\(APs?\\).*?Alkylphenol\\s+Ethoxylates?\\s*\\(APEOs?\\)','Azo-amines|Chlorinated|Chlorophenols|$')){const m=s.match(/Total\s+APs?\s*\+\s*APEOs?[^\d]{0,80}(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i);if(m&&n(m[1])>n(m[2]))out.push(mk('Total AP + APEO',`${m[1]} mg/kg`,`${m[2]} mg/kg`))}return out}
function parseCBsCTs(t){const out=[];for(const s of failSection(t,'Chlorobenzenes?\\s*&\\s*Chlorotoluenes?','Forbidden|Disperse|$')){const m=s.match(/1,4-Dichlorobenzene\s+106-46-7\s+(?:mg\/kg|ppm)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i);if(m&&n(m[1])>n(m[2]))out.push(mk('1,4-Dichlorobenzene (CBs & CTs), CAS 106-46-7',`${m[1]} mg/kg`,`${m[2]} mg/kg`))}return out}
function parsePFAS(t){const out=[],sec=failSection(t,'(?:Per-\\s*&?\\s*Polyfluoroalkyl\\s+Substances\\s*\\(PFAS\\)|Perfluorinated\\s+and\\s+Polyfluorinated\\s+Chemicals\\s*\\(PFAS\\))','Appendix|Remark:|$ ',10000);const defs=[['6:2 FTOH','647-42-7',1],['8:2 FTOH','678-39-7',1],['10:2 FTOH','865-86-1',0.26]];for(const s of sec){for(const [name,cas,lim] of defs){const m=s.match(new RegExp(`${cas.replace(/-/g,'\\-')}\\s+(?:mg\\/kg\\s+)?(\\d+(?:\\.\\d+)?)\\s+((?:ND|n\\.?d\\.?|\\d+(?:\\.\\d+)?)(?:\\s+(?:ND|n\\.?d\\.?|\\d+(?:\\.\\d+)?)){0,3})`,'i'));if(!m)continue;const vals=(m[2].match(/\d+(?:\.\d+)?/g)||[]).map(Number);const mx=Math.max(...vals,-Infinity);if(mx>lim)out.push(mk(`${name}, CAS ${cas}`,`${mx} mg/kg`,`${lim} mg/kg`))}for(const [label,lim] of [['Total PFOA-related Substances',1],['Total of PFOA-related Substances',1],['Total C9-C14 PFCA-related Substances',.26],['Total of C9-C14 PFCA-related Substances',.26],['Total PFHxA-related Substances',1]]){const e=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),m=s.match(new RegExp(`${e}\\s+(?:--\\s+--\\s+|-\\s+mg\\/kg\\s+-\\s+)?((?:ND|n\\.?d\\.?|\\d+(?:\\.\\d+)?)(?:\\s+(?:ND|n\\.?d\\.?|\\d+(?:\\.\\d+)?)){0,3})`,'i'));if(m){const vals=(m[1].match(/\d+(?:\.\d+)?/g)||[]).map(Number),mx=Math.max(...vals,-Infinity);if(mx>lim)out.push(mk(label.replace('Total of ','Total '),`${mx} mg/kg`,`${lim} mg/kg`))}}}return out}
function parseMetalsDEHP(t){const out=[],defs=[['Arsenic (As)','7440-38-2'],['Cadmium (Cd)','7440-43-9'],['Chromium (Cr)','7440-47-3'],['DEHP','117-81-7']];for(const s of failSection(t,'(?:Total|Extractable)\\s+Heavy\\s+Metal|Phthalates','Organotin|Polycyclic|$'))for(const [name,cas] of defs){const m=s.match(new RegExp(`${cas.replace(/-/g,'\\-')}\\s+(?:mg\\/kg|ppm)\\s+(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)`,'i'));if(m&&n(m[1])>n(m[2]))out.push(mk(`${name}, CAS ${cas}`,`${m[1]} mg/kg`,`${m[2]} mg/kg`))}return out}
function parseAll(t){const out=[...parsePH(t),...parseBisphenols(t),...parseTOF(t),...parseAPEO(t),...parseCBsCTs(t),...parsePFAS(t),...parseMetalsDEHP(t)],seen=new Set();return out.filter(x=>{const k=x.substance+'|'+x.result+'|'+x.limit;if(seen.has(k))return false;seen.add(k);return true})}
function ui(){let h=$('failedItemsRows');if(!h){const s=$('substance');if(!s)return null;['substance','result','limit'].forEach(id=>$(id)?.closest('.field')?.style.setProperty('display','none'));const w=document.createElement('div');w.className='field full';w.innerHTML='<label>Failed Items *</label><div id="failedItemsRows"></div><button type="button" class="btn" id="addFailedItemV37">+ Add Failed Item</button>';s.closest('.field').parentElement.insertBefore(w,s.closest('.field'));$('addFailedItemV37').onclick=()=>{items.push(mk('','',''));render()};h=$('failedItemsRows')}return h}
function sync(){const x=items[0]||{};if($('substance'))$('substance').value=x.substance||'';if($('result'))$('result').value=x.result||'';if($('limit'))$('limit').value=x.limit||'';window.v37FailedItems=items}
function render(){const h=ui();if(!h)return;h.innerHTML=items.map((x,i)=>`<div style="display:grid;grid-template-columns:1.6fr 1fr 1fr auto;gap:8px;margin:8px 0"><input data-v37="substance" data-i="${i}" value="${esc(x.substance)}"><input data-v37="result" data-i="${i}" value="${esc(x.result)}"><input data-v37="limit" data-i="${i}" value="${esc(x.limit)}"><button type="button" class="btn danger" data-rm-v37="${i}">Remove</button></div>`).join('');h.querySelectorAll('[data-v37]').forEach(e=>e.oninput=()=>{items[+e.dataset.i][e.dataset.v37]=e.value;sync()});h.querySelectorAll('[data-rm-v37]').forEach(e=>e.onclick=()=>{items.splice(+e.dataset.rmV37,1);render()});sync()}
async function analyze(){const f=$('pdfFile')?.files?.[0];if(!f)return;items=[];render();const msg=$('parseAlert'),bar=$('parseBar');msg?.classList.add('hidden');try{const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise,p=[];for(let i=1;i<=pdf.numPages;i++){const c=await(await pdf.getPage(i)).getTextContent();p.push(clean(c.items.map(x=>x.str).join(' ')));if(bar)bar.style.width=`${Math.round(i/pdf.numPages*100)}%`}const text=p.join('\n'),h=header(text);Object.entries(h).forEach(([k,v])=>{if($(k)&&v)$(k).value=v});items=parseAll(text);render();if($('workflow'))$('workflow').value='Containment Required';if(msg){msg.textContent=items.length?`V3.7 content scan completed. ${items.length} failed item(s) found from Conclusion Fail sections. Verify all values against the PDF.`:'No supported Conclusion Fail row was confirmed. Add it manually.';msg.classList.remove('hidden')}}catch(e){console.error('V3.7',e);if(msg){msg.textContent='PDF parsing failed. Enter values manually.';msg.classList.remove('hidden')}}}
function install(){ui();render();const b=$('analyzePdf');if(b){b.onclick=null;b.replaceWith(b.cloneNode(true));$('analyzePdf').onclick=analyze}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
