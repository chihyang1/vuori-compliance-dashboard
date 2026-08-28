/* SGS RSL Smart Parser V26.1 - targeted correction layer
   Fixes stale fields, BPS, TOF and AP+APEO value/limit mapping.
   Load AFTER sgs-rsl-v26.js.
*/
(()=>{'use strict';
const $=id=>document.getElementById(id);
const clean=s=>String(s||'').replace(/\u00a0/g,' ').replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim();
const glued=s=>clean(s).toLowerCase().replace(/\s+/g,'');
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let items=[];
const mk=(substance,result,limit,component='')=>({substance:component?`${substance} | Component ${component}`:substance,result,limit});
function capture(t,patterns){for(const p of patterns){const m=t.match(p);if(m)return clean(m[1])}return''}
function normalizeReport(v){return clean(v).replace(/\s*\/\s*/g,'/').replace(/\s*-\s*/g,'-').replace(/\s+/g,'')}
function isoDate(v){if(!v)return'';let m=v.match(/(\d{4})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})/);if(m)return`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;const d=new Date(v);return isNaN(d)?'':d.toISOString().slice(0,10)}
function unbreakWords(s){return clean(s)
 .replace(/\bM\s+anteco\b/gi,'Manteco').replace(/\bT\s+ORAY\b/gi,'TORAY')
 .replace(/\bJu\s+ne\b/gi,'June').replace(/\bT\s+otal\b/gi,'Total')
 .replace(/\bN\s+D\b/gi,'ND').replace(/\bm\s*g\s*\/\s*k\s*g\b/gi,'mg/kg')
 .replace(/\bAP\s*\+\s*APEO\b/gi,'AP+APEO').replace(/\bA\s*PEO\b/gi,'APEO');}
function parseHeader(t,file){const n=unbreakWords(t),f=String(file||'');
 let report=capture(n,[/Textile Laboratory Test Report No\s*:\s*([A-Z0-9]+\s*\/\s*\d{4}\s*\/\s*[A-Z0-9-]+)/i,/Test Report No\.?\s*[:.]?\s*([A-Z0-9][A-Z0-9\/_\-\s]{5,70}?)(?=\s+(?:Issued Date|Date|Page))/i,/Test Report\s+(SL\d{10,}(?:-\d+)?)/i,/\bNo\.?\s*:\s*(VNSL\d+TX)/i]);
 if(!report){const m=f.match(/((?:F\d+\/LF-CTSAYSA\d+-\d+)|(?:SL\d{10,}(?:-\d+)?)|(?:TX\d+[_/]\d{4}[_/][A-Z]+)|(?:VNSL\d+TX))/i);report=m?m[1]:''}
 report=normalizeReport(report.replace(/_/g,'/'));
 const date=isoDate(capture(n,[/Issued Date\s*:\s*([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}|\d{4}\s*[.\/-]\s*\d{1,2}\s*[.\/-]\s*\d{1,2})/i,/\bDate\s*:\s*([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}|\d{4}\s*[.\/-]\s*\d{1,2}\s*[.\/-]\s*\d{1,2})/i]));
 const supplier=capture(n,[/Supplier Company Name\s*:\s*(.{2,100}?)(?=\s+(?:Sample Type|Division|Department))/i,/APPLICANT\s*:\s*(.{2,100}?)(?=\s+(?:OVERALL|APPLICANT ADDRESS))/i]);
 const article=capture(n,[/Article Number\s*:\s*(.{1,60}?)(?=\s+(?:Agent Name|Manufacturer|Construction))/i]);
 const po=capture(n,[/PO#\s*\/\s*Ref#\s*:\s*(.{1,100}?)(?=\s+Bulk Lot#)/i]);
 const lot=capture(n,[/Bulk Lot#\s*:\s*(.{1,80}?)(?=\s+Style #)/i]);
 const empty=v=>/^(?:\/|n\/?a|-)?$/i.test(clean(v))?'':clean(v);
 return{report,reportDate:date,supplier:empty(supplier),article:empty(article).replace(/\s+(?=\d)/g,''),po:empty(po),lot:empty(lot)};}
function parseBPS(t,file){const n=unbreakWords(t),g=glued(n);let result='';
 let m=n.match(/Bisphenol S(?:\s*\(BPS\))?\s+(?:80-09-1\s+)?(\d+(?:\.\d+)?)\s*(?:mg\/kg|ppm)/i);if(m)result=m[1];
 if(!result){m=n.match(/Bisphenol S\s+(\d+(?:\.\d+)?)\s*mg\/kg/i);if(m)result=m[1]}
 if(!result){m=String(file).match(/BPS Failure by (\d+(?:\.\d+)?)\s*ppm/i);if(m)result=m[1]}
 if(!result||!/(bisphenols?|bps)/i.test(n))return[];
 let limit='';m=n.match(/(?:Requirement|Client.?s Limit)[\s\S]{0,150}?BPS\s+(\d+(?:\.\d+)?)\s*(?:mg\/kg|ppm)/i);if(m)limit=m[1];
 if(!limit&&g.includes('bisphenols'))limit='100';
 return[mk('Bisphenol S (BPS), CAS 80-09-1',`${result} mg/kg`,`${limit||100} mg/kg`)];}
function parseTOF(t,file){const n=unbreakWords(t),out=[];if(!/(organic fluorine|fluorine screening|fluorine content|\bTOF\b)/i.test(n)&&!/TOF Failure/i.test(file))return out;
 const blocks=n.match(/(?:Total Organic Fluorine(?: Content| Screening)?|Fluorine Content)[\s\S]{0,900}?Conclusion\s*(?:--)?\s*FAIL[#*]?/gi)||[];
 for(const b of blocks){let vals=[...b.matchAll(/(?:Total Organic Fluorine(?: Content| Screening)?|Fluorine Content)[^\d]{0,80}(\d+(?:\.\d+)?)\s*(?:mg\/kg|ppm)/gi)].map(x=>x[1]);if(!vals.length)vals=[...b.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:mg\/kg|ppm)\s*[#*]?/gi)].map(x=>x[1]);let lim=capture(b,[/Requirement\s*:\s*(?:Not Detected|N\.D\.)?\s*(\d+(?:\.\d+)?)\s*(?:mg\/kg|ppm)/i,/Client.?s Limit[^\d]*(\d+(?:\.\d+)?)\s*(?:mg\/kg|ppm)/i]);for(const v of vals){if(!lim||Number(v)>Number(lim))out.push(mk('Total Organic Fluorine (TOF)',`${v} mg/kg`,lim?`${lim} mg/kg`:'Not Detected'));}}
 if(!out.length){const fm=String(file).match(/TOF Failures? by ([\d.]+)\s*ppm(?:\s*&\s*([\d.]+)\s*ppm)?/i);if(fm){out.push(mk('Total Organic Fluorine (TOF)',`${fm[1]} mg/kg`,'100 mg/kg'));if(fm[2])out.push(mk('Total Organic Fluorine (TOF)',`${fm[2]} mg/kg`,'100 mg/kg'));}}
 return out;}
function parseAPEO(t,file){const n=unbreakWords(t),g=glued(n);if(!g.includes('totalap+apeo'))return[];
 let result='';let m=g.match(/totalap\+apeo(?:various)?(\d+(?:\.\d+)?)(?=conclusion|fail|note)/i);if(m)result=m[1];
 if(!result){m=String(file).match(/AP\+APEO Failure by (\d+(?:\.\d+)?)\s*ppm/i);if(m)result=m[1]}
 let limit='';m=g.match(/requirement:totalaptotalap\+apeo10mg\/kg(\d+(?:\.\d+)?)mg\/kg/i);if(m)limit=m[1];
 if(!limit){m=n.match(/Requirement\s*:\s*Total AP\s+Total AP\+APEO\s+10\s*mg\/kg\s+(\d+(?:\.\d+)?)\s*mg\/kg/i);if(m)limit=m[1]}
 if(!result)return[];return[mk('Total AP + APEO',`${result} mg/kg`,`${limit||100} mg/kg`)];}
function render(){let host=$('failedItemsRowsV26')||$('failedItemsRows');if(!host){const hidden=$('substance');if(!hidden)return;const wrap=document.createElement('div');wrap.className='field full';wrap.innerHTML='<label>Failed Items *</label><div id="failedItemsRowsV261"></div><button type="button" class="btn" id="addV261">+ Add Failed Item</button>';hidden.closest('.field').parentElement.insertBefore(wrap,hidden.closest('.field'));host=$('failedItemsRowsV261');$('addV261').onclick=()=>{items.push(mk('','',''));render()}}
 host.innerHTML=items.map((x,i)=>`<div style="display:grid;grid-template-columns:1.6fr 1fr 1fr auto;gap:8px;margin:8px 0"><input data-k="substance" data-i="${i}" value="${esc(x.substance)}"><input data-k="result" data-i="${i}" value="${esc(x.result)}"><input data-k="limit" data-i="${i}" value="${esc(x.limit)}"><button type="button" class="btn danger" data-r="${i}">Remove</button></div>`).join('');host.querySelectorAll('[data-k]').forEach(e=>e.oninput=()=>{items[+e.dataset.i][e.dataset.k]=e.value;sync()});host.querySelectorAll('[data-r]').forEach(e=>e.onclick=()=>{items.splice(+e.dataset.r,1);render()});sync();}
function sync(){const x=items[0]||{};if($('substance'))$('substance').value=x.substance||'';if($('result'))$('result').value=x.result||'';if($('limit'))$('limit').value=x.limit||'';window.v26FailedItems=items;}
async function analyze(){const f=$('pdfFile')?.files?.[0];if(!f)return;['report','reportDate','supplier','article','po','lot','substance','result','limit'].forEach(id=>{if($(id))$(id).value=''});items=[];render();const bar=$('parseBar'),msg=$('parseAlert');msg?.classList.add('hidden');try{const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise,p=[];for(let i=1;i<=pdf.numPages;i++){const c=await(await pdf.getPage(i)).getTextContent();p.push(c.items.map(x=>x.str).join(' '));if(bar)bar.style.width=`${Math.round(i/pdf.numPages*100)}%`}const text=p.join('\n'),h=parseHeader(text,f.name);Object.entries(h).forEach(([k,v])=>{if($(k)&&v)$(k).value=v});items=[...parseBPS(text,f.name),...parseTOF(text,f.name),...parseAPEO(text,f.name)];const seen=new Set();items=items.filter(x=>{const k=`${x.substance}|${x.result}|${x.limit}`;if(seen.has(k))return false;seen.add(k);return true});render();if(msg){msg.textContent=items.length?`V26.1 extraction completed. ${items.length} failed item(s) found. Verify all values against the PDF.`:'No supported failed section was confirmed. Review the PDF and add failed items manually.';msg.classList.remove('hidden')}}catch(e){console.error(e);if(msg){msg.textContent='PDF parsing failed. Enter values manually.';msg.classList.remove('hidden')}}}
function install(){const b=$('analyzePdf');if(b)b.onclick=analyze;}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
