/* SGS RSL Smart Parser V26.2
   Patch for pH, BPA and BPF. Load AFTER sgs-rsl-v261.js.
*/
(()=>{'use strict';
const $=id=>document.getElementById(id);
const tidy=s=>String(s||'').replace(/\u00a0/g,' ').replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim();
const mk=(substance,result,limit,component='')=>({substance:component?`${substance} | Component ${component}`:substance,result,limit});
const cap=(s,arr)=>{for(const r of arr){const m=s.match(r);if(m)return tidy(m[1])}return''};
function filenameItems(name){
 const out=[]; let m;
 if((m=name.match(/pH Failure by\s*([\d.]+)/i))) out.push(mk('pH Value',m[1],'4.0 - 7.5'));
 if((m=name.match(/BPA Failure by\s*([\d.]+)\s*ppm/i))) out.push(mk('Bisphenol A (BPA), CAS 80-05-7',`${m[1]} mg/kg`,'1 mg/kg'));
 if((m=name.match(/BPF Failure by\s*([\d.]+)\s*ppm/i))) out.push(mk('Bisphenol F (BPF), CAS 620-92-8',`${m[1]} mg/kg`,'1 mg/kg'));
 return out;
}
function parsePH(t){
 if(!/p\s*h\s*value/i.test(t))return[];
 let result=cap(t,[/p\s*H\s*Value\s*--\s*(\d+(?:\.\d+)?)[\s\S]{0,180}?Conclusion\s*--\s*FAIL/i,/p\s*H\s*Value[^\d]{0,80}(\d+(?:\.\d+)?)[\s\S]{0,160}?FAIL/i]);
 const limit=cap(t,[/Requirement\s*:\s*(\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?)/i])||'4.0 - 7.5';
 const component=cap(t,[/Result\s+CAS-?No\.?\s+([A-Z]?\d*)[\s\S]{0,180}?p\s*H\s*Value/i]);
 return result?[mk('pH Value',result,limit,component)]:[];
}
function parseBisphenol(t,label,abbr,cas){
 const out=[];
 const escaped=abbr.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const patterns=[
  new RegExp(`Bisphenol\\s+${label}\\s*(?:\\(${escaped}\\))?\\s+${cas.replace(/-/g,'\\-')}[^\\d]{0,40}(\\d+(?:\\.\\d+)?)`,'i'),
  new RegExp(`Bisphenol\\s+${label}\\s*(?:\\(${escaped}\\))?[^\\d]{0,60}(\\d+(?:\\.\\d+)?)\\s*(?:ppm|mg\\/kg)`,'i'),
  new RegExp(`${escaped}\\s+${cas.replace(/-/g,'\\-')}[^\\d]{0,40}(\\d+(?:\\.\\d+)?)`,'i')
 ];
 let result=cap(t,patterns);
 if(!result)return out;
 let limit=cap(t,[new RegExp(`(?:Requirement|Client.?s Limit)[\\s\\S]{0,250}?${escaped}[^\\d]{0,30}(\\d+(?:\\.\\d+)?)\\s*(?:ppm|mg\\/kg)`,'i')]);
 if(!limit)limit='1';
 out.push(mk(`Bisphenol ${label} (${abbr}), CAS ${cas}`,`${result} mg/kg`,`${limit} mg/kg`));
 return out;
}
function getHost(){return $('failedItemsRowsV26')||$('failedItemsRowsV261')||$('failedItemsRows');}
function readCurrent(){const host=getHost();if(!host)return[];return [...host.querySelectorAll('[data-k="substance"],[data-v26="substance"]')].map(e=>{const i=e.dataset.i;return{substance:e.value,result:host.querySelector(`[data-i="${i}"][data-k="result"],[data-i="${i}"][data-v26="result"]`)?.value||'',limit:host.querySelector(`[data-i="${i}"][data-k="limit"],[data-i="${i}"][data-v26="limit"]`)?.value||''}}).filter(x=>x.substance);}
function render(items){const host=getHost();if(!host)return false;host.innerHTML=items.map((x,i)=>`<div style="display:grid;grid-template-columns:1.6fr 1fr 1fr auto;gap:8px;margin:8px 0"><input data-k="substance" data-i="${i}" value="${x.substance.replace(/"/g,'&quot;')}"><input data-k="result" data-i="${i}" value="${x.result.replace(/"/g,'&quot;')}"><input data-k="limit" data-i="${i}" value="${x.limit.replace(/"/g,'&quot;')}"><button type="button" class="btn danger" data-v262-remove="${i}">Remove</button></div>`).join('');
 const sync=()=>{window.v26FailedItems=[...host.querySelectorAll('[data-k="substance"]')].map(e=>{const i=e.dataset.i;return{substance:e.value,result:host.querySelector(`[data-k="result"][data-i="${i}"]`)?.value||'',limit:host.querySelector(`[data-k="limit"][data-i="${i}"]`)?.value||''}});const x=window.v26FailedItems[0]||{};if($('substance'))$('substance').value=x.substance||'';if($('result'))$('result').value=x.result||'';if($('limit'))$('limit').value=x.limit||''};
 host.querySelectorAll('input').forEach(e=>e.oninput=sync);host.querySelectorAll('[data-v262-remove]').forEach(b=>b.onclick=()=>{items.splice(+b.dataset.v262Remove,1);render(items)});sync();return true;}
async function analyze(){
 const f=$('pdfFile')?.files?.[0];if(!f)return;
 ['report','reportDate','supplier','article','po','lot','substance','result','limit'].forEach(id=>{if($(id))$(id).value=''});
 const msg=$('parseAlert'),bar=$('parseBar');msg?.classList.add('hidden');
 try{const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise,p=[];for(let i=1;i<=pdf.numPages;i++){const c=await(await pdf.getPage(i)).getTextContent();p.push(c.items.map(x=>x.str).join(' '));if(bar)bar.style.width=`${Math.round(i/pdf.numPages*100)}%`}
  const text=tidy(p.join('\n'));
  // First run V26.1 for header and its supported chemistries.
  const prior=$('analyzePdf').dataset.v262Prior;
  let items=[...parsePH(text),...parseBisphenol(text,'A','BPA','80-05-7'),...parseBisphenol(text,'F','BPF','620-92-8')];
  if(!items.length)items=filenameItems(f.name);
  const dedupe=new Map(items.map(x=>[`${x.substance}|${x.result}|${x.limit}`,x]));items=[...dedupe.values()];render(items);
  if(msg){msg.textContent=items.length?`V26.2 extraction completed. ${items.length} failed item(s) found. Verify all values against the PDF.`:'No pH, BPA or BPF failure was confirmed. Add the failed item manually.';msg.classList.remove('hidden')}
 }catch(e){console.error('V26.2',e);if(msg){msg.textContent='PDF parsing failed. Enter values manually.';msg.classList.remove('hidden')}}
}
function install(){const b=$('analyzePdf');if(b)b.onclick=analyze;}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
