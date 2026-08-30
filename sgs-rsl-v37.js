/* SGS RSL Smart Parser V3.7 Stable - page-aware, content-driven */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const tidy = v => String(v ?? '').replace(/\u00a0/g,' ').replace(/[‐‑‒–—−]/g,'-').replace(/[ \t]+/g,' ').trim();
const flat = v => tidy(v).replace(/\s+/g,' ');
const esc = v => flat(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val = v => { const m=String(v??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/); return m?Number(m[0]):null; };
const item = (substance,result,limit,remarks='') => ({substance:flat(substance),result:flat(result),limit:flat(limit),remarks:flat(remarks)});
let failedItems=[];

function normalize(raw){
 let t=flat(raw);
 const rules=[
  [/Conclu\s*s\s*ion/gi,'Conclusion'],[/Requ\s*irem\s*ent/gi,'Requirement'],[/Res\s*u\s*lt/gi,'Result'],
  [/B\s*is\s*phenol/gi,'Bisphenol'],[/Extractable\s*H\s*eav\s*y\s*M\s*etal/gi,'Extractable Heavy Metal'],
  [/Total\s*H\s*eav\s*y\s*M\s*etal/gi,'Total Heavy Metal'],[/H\s*eav\s*y\s*M\s*etal/gi,'Heavy Metal'],
  [/Client[’']s\s*L\s*im\s*it/gi,"Client's Limit"],[/L\s*im\s*it/gi,'Limit'],
  [/T\s*otal\s*AP\s*\+\s*APEO/gi,'Total AP+APEO'],[/T\s*otal\s*APEO/gi,'Total APEO'],[/T\s*otal\s*AP/gi,'Total AP'],
  [/N\s*PEO/gi,'NPEO'],[/O\s*PEO/gi,'OPEO'],[/N\s*P/gi,'NP'],[/O\s*P/gi,'OP'],
  [/v\s*ariou\s*s/gi,'various'],[/N\s*D\b/gi,'ND'],[/m\s*g\s*\/\s*kg/gi,'mg/kg'],[/p\s*p\s*m/gi,'ppm'],
  [/Flu\s*orine/gi,'Fluorine'],[/C\s*ontent/gi,'Content'],[/Reporting\s*lim\s*it/gi,'Reporting limit'],
  [/Chlorotolu\s*enes/gi,'Chlorotoluenes'],[/CB\s*s\s*&\s*CT\s*s/gi,'CBs & CTs'],
  [/B\s*PAF\b/gi,'BPAF'],[/B\s*PA\b/gi,'BPA'],[/B\s*PS\b/gi,'BPS'],[/B\s*PF\b/gi,'BPF'],[/B\s*PB\b/gi,'BPB']
 ];
 for(const [a,b] of rules)t=t.replace(a,b);
 return t;
}
function first(t,patterns){for(const p of patterns){const m=t.match(p);if(m)return flat(m[1]);}return'';}
function iso(v){if(!v)return'';let m=v.match(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);if(m)return`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;const d=new Date(v);return isNaN(d)?'':d.toISOString().slice(0,10);}
function reportNo(t){return first(t,[/Textile\s+Laboratory\s+Test\s+Report\s+No\s*:\s*([A-Z0-9]+\s*\/\s*\d{4}\s*\/\s*[A-Z0-9-]+)/i,/Test\s+Report(?:\s+No\.?)?\s*[:#.]?\s*([A-Z0-9][A-Z0-9/_-]{5,})/i,/Report\s+No\.?\s*[:#.]?\s*([A-Z0-9][A-Z0-9/_-]{5,})/i]).replace(/\s*\/\s*/g,'/').replace(/\s+/g,'');}
function header(t){
 const field=(a,b)=>first(t,[new RegExp(`${a}\\s*:?\\s*(.{1,180}?)(?=\\s+(?:${b}))`,'i')]);
 return {report:reportNo(t),reportDate:iso(first(t,[/(?:Issued\s+Date|Date)\s*:?\s*([A-Za-z]{3,9}\.?\s+\d{1,2},?\s*\d{4}|\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2})/i])),supplier:first(t,[/Supplier\s+Company\s+Name\s*:\s*(.{2,150}?)(?=\s+(?:Sample\s+Type|Division|Department))/i,/APPLICANT\s*:\s*(.{2,150}?)(?=\s+(?:OVERALL|APPLICANT\s+ADDRESS))/i]),article:field('Article\\s+Number','Agent\\s+Name|Manufacturer|Construction'),po:field('PO#\\s*\\/\\s*(?:Ref#|REF#)','Bulk\\s+Lot#|Style'),lot:field('Bulk\\s+Lot#','Style\\s*#|Style\\s+Name')};
}
const isFail = p => /Conclusion\s*(?:--\s*)?FAIL(?:\s*[#*])?/i.test(p);
function unique(a){const seen=new Set();return a.filter(x=>{const k=[x.substance,x.result,x.limit].join('|').toUpperCase();if(seen.has(k))return false;seen.add(k);return true;});}
function pageSlice(p,start,end){const i=p.search(start);if(i<0)return'';const rest=p.slice(i);const j=rest.search(end);return j>0?rest.slice(0,j):rest;}

function parsePH(pages){const out=[];for(const p of pages){if(!/p\s*H\s*Value/i.test(p)||!isFail(p))continue;const s=pageSlice(p,/p\s*H\s*Value/i,/Azo|Formaldehyde|Bisphenol/i);const r=first(s,[/p\s*H\s*Value\s*(?:--|-)?\s*(\d+(?:\.\d+)?)/i,/Result[^\d]{0,80}(\d+(?:\.\d+)?)[\s\S]{0,200}?Conclusion/i]);const range=first(s,[/Requirement\s*:?\s*(\d+(?:\.\d+)?\s*[-~]\s*\d+(?:\.\d+)?)/i])||'4.0 - 7.5';if(r){const [lo,hi]=(range.match(/\d+(?:\.\d+)?/g)||[]).map(Number);if(lo===undefined||Number(r)<lo||Number(r)>hi)out.push(item('pH Value',r,range));}}return out;}

const BIS=[['BPA','A','80-05-7',1],['BPS','S','80-09-1',100],['BPF','F','620-92-8',1],['BPAF','AF','1478-61-1',1],['BPB','B','77-40-7',1]];
function parseBisphenols(pages){const out=[];for(const p of pages){if(!/Bisphenols?/i.test(p)||!isFail(p))continue;const s=pageSlice(p,/Bisphenols?/i,/Total\s+Organic\s+Fluorine|Alkylphenol|Chlorobenzene|Forbidden/i);const matrix=/\bRL\b|Reporting Limit/i.test(s);for(const [abbr,letter,cas,defLimit] of BIS){const c=cas.replace(/-/g,'\\-');const re=new RegExp(`Bisphenol\\s*${letter}\\s*\\(${abbr}\\)\\s+${c}\\s+(?:(?:ppm|mg\\/kg)\\s+)?([\\s\\S]{1,100}?)(?=Bisphenol\\s*(?:A|S|F|AF|B)\\s*\\(|Conclusion|$)`,'gi');for(const m of s.matchAll(re)){const body=m[1],tokens=body.replace(/[#*]/g,' ').match(/ND|\d+(?:\.\d+)?/gi)||[];const nums=tokens.filter(x=>!/^ND$/i.test(x)).map(Number);if(!matrix){const result=nums[0];if(result!==undefined&&result>defLimit)out.push(item(`Bisphenol ${letter} (${abbr}), CAS ${cas}`,`${result} ppm`,`${defLimit} ppm`));continue;}if(nums.length<2)continue;const rl=nums[0],limit=nums[nums.length-1]??defLimit;nums.slice(1,-1).filter(v=>v!==rl&&v>limit).forEach((v,i,a)=>out.push(item(`Bisphenol ${letter} (${abbr}), CAS ${cas}${a.length>1?` | Failed result ${i+1}`:''}`,`${v} ppm`,`${limit} ppm`)));}}}return unique(out);}

function parseTOF(pages){const out=[];for(const p of pages){if(!/(?:Total\s+Organic\s+Fluorine|Fluorine\s+Content)/i.test(p)||!isFail(p))continue;for(const m of p.matchAll(/Test\s+Item\(s\)\s*(\d+(?:\+\d+)*)[\s\S]{0,100}?Total\s+Organic\s+Fluorine\s+(ND|\d+(?:\.\d+)?)\s*(mg\/kg|ppm)?[#*]?[\s\S]{0,80}?Conclusion\s+FAIL/gi)){if(!/^ND$/i.test(m[2]))out.push(item(`Total Organic Fluorine (TOF) | Component ${m[1]}`,`${m[2]} ${m[3]||'mg/kg'}`,'Not Detected'));}if(out.length)continue;const s=pageSlice(p,/(?:Total\s+Organic\s+Fluorine|Fluorine\s+Content)/i,/Alkylphenol|PFAS|Perfluorinated/i),m=s.match(/(?:Fluorine\s+Content|Total\s+Organic\s+Fluorine)[\s\S]{0,140}?(?:mg\/kg|ppm)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i);if(m&&val(m[1])>=val(m[2]))out.push(item('Total Organic Fluorine (TOF)',`${m[1]} mg/kg`,`${m[2]} mg/kg`));}return unique(out);}

function parseAPEO(pages){const out=[];for(const p of pages){if(!/Alkylphenols?\s*\(AP\)/i.test(p)||!isFail(p))continue;const s=pageSlice(p,/Alkylphenols?\s*\(AP\)/i,/Azo|Bisphenol|Chlorobenzene/i);const m=s.match(/Total\s+AP\s*\+\s*APEO\s+(?:various\s+)?(ND|\d+(?:\.\d+)?)/i),lim=first(s,[/Requirement[\s\S]{0,100}?Total\s+AP\s*\+\s*APEO\s*(\d+(?:\.\d+)?)/i])||'100';if(m&&!/^ND$/i.test(m[1])&&val(m[1])>val(lim))out.push(item('Total AP + APEO',`${m[1]} mg/kg`,`${lim} mg/kg`));}return out;}

function parseCBsCTs(pages){const out=[];for(const p of pages){if(!/Chlorobenzenes?\s*&\s*Chlorotoluenes?/i.test(p)||!isFail(p))continue;const s=pageSlice(p,/Chlorobenzenes?/i,/Forbidden|Disperse/i);const m=s.match(/1,4-Dichlorobenzene\s+106-46-7\s+(?:(?:mg\/kg|ppm)\s+)?(?:\d+(?:\.\d+)?\s+)?(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i);if(m&&val(m[1])>val(m[2]))out.push(item('1,4-Dichlorobenzene (CBs & CTs), CAS 106-46-7',`${m[1]} mg/kg`,`${m[2]} mg/kg`));}return out;}

function parseMetals(pages){const out=[],defs=[['Arsenic (As)','7440-38-2',.2],['Cadmium (Cd)','7440-43-9',.1],['Chromium (Cr)','7440-47-3',2],['Mercury (Hg)','7439-97-6',.02]];for(const p of pages){if(!/(?:Extractable|Total)\s+Heavy\s+Metal/i.test(p)||!isFail(p))continue;const s=pageSlice(p,/(?:Extractable|Total)\s+Heavy\s+Metal/i,/Organotin|Quinoline|Above\s+test/i);for(const [name,cas,limit] of defs){const m=s.match(new RegExp(`${cas.replace(/-/g,'\\-')}\\s+(?:(?:mg\\/kg|ppm)\\s+)?(ND|\\d+(?:\\.\\d+)?)`,'i'));if(m&&!/^ND$/i.test(m[1])&&val(m[1])>limit)out.push(item(`${name}, CAS ${cas}`,`${m[1]} mg/kg`,`${limit} mg/kg`));}}return out;}

function parsePFAS(pages){const joined=pages.join(' ');if(!/(?:PFAS|Polyfluoroalkyl)/i.test(joined)||!isFail(joined))return[];const out=[],defs=[['6:2 FTOH','647-42-7',1],['8:2 FTOH','678-39-7',1],['10:2 FTOH','865-86-1',.26]];for(const [name,cas,limit] of defs){const re=new RegExp(`${cas.replace(/-/g,'\\-')}\\s+(?:(?:mg\\/kg|ppm)\\s+)?(?:\\d+(?:\\.\\d+)?\\s+)?(ND|\\d+(?:\\.\\d+)?)`,'gi');for(const m of joined.matchAll(re)){if(!/^ND$/i.test(m[1])&&val(m[1])>limit)out.push(item(`${name}, CAS ${cas}`,`${m[1]} mg/kg`,`${limit} mg/kg`));}}return unique(out);}

function parseDEHP(pages){const out=[];for(const p of pages){if(!/Phthalates/i.test(p)||!isFail(p))continue;const s=pageSlice(p,/Phthalates/i,/PAH|Polyaromatic|Polycyclic/i);const m=s.match(/(?:DEHP|117-81-7)[\s\S]{0,60}?(?:mg\/kg|ppm)?\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i);if(m&&val(m[1])>val(m[2]))out.push(item('Bis-(2-ethylhexyl) Phthalate (DEHP), CAS 117-81-7',`${m[1]} mg/kg`,`${m[2]} mg/kg`));}return out;}
function parseAll(pages){return unique([...parsePH(pages),...parseBisphenols(pages),...parseTOF(pages),...parseAPEO(pages),...parseCBsCTs(pages),...parseMetals(pages),...parsePFAS(pages),...parseDEHP(pages)]);}

function ensureUI(){let h=$('failedItemsRows');if(h)return h;const base=$('substance');if(!base)return null;['substance','result','limit'].forEach(id=>$(id)?.closest('.field')?.style.setProperty('display','none'));const wrap=document.createElement('div');wrap.className='field full';wrap.innerHTML='<label>Failed Items *</label><div id="failedItemsRows"></div><button type="button" class="btn" id="addFailedItemV37">+ Add Failed Item</button>';base.closest('.field').parentElement.insertBefore(wrap,base.closest('.field'));$('addFailedItemV37').onclick=()=>{failedItems.push(item('','',''));render();};return $('failedItemsRows');}
function sync(){const x=failedItems[0]||{};if($('substance'))$('substance').value=x.substance||'';if($('result'))$('result').value=x.result||'';if($('limit'))$('limit').value=x.limit||'';window.v37FailedItems=failedItems;}
function render(){const h=ensureUI();if(!h)return;h.innerHTML=failedItems.map((x,i)=>`<div style="display:grid;grid-template-columns:1.6fr 1fr 1fr auto;gap:8px;margin:8px 0"><input data-v37="substance" data-i="${i}" value="${esc(x.substance)}"><input data-v37="result" data-i="${i}" value="${esc(x.result)}"><input data-v37="limit" data-i="${i}" value="${esc(x.limit)}"><button type="button" class="btn danger" data-rm-v37="${i}">Remove</button></div>`).join('');h.querySelectorAll('[data-v37]').forEach(e=>e.oninput=()=>{failedItems[+e.dataset.i][e.dataset.v37]=e.value;sync();});h.querySelectorAll('[data-rm-v37]').forEach(e=>e.onclick=()=>{failedItems.splice(+e.dataset.rmV37,1);render();});sync();}
async function analyze(){const f=$('pdfFile')?.files?.[0];if(!f)return;failedItems=[];render();const msg=$('parseAlert'),bar=$('parseBar');msg?.classList.add('hidden');try{const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise,rawPages=[];for(let i=1;i<=pdf.numPages;i++){const c=await(await pdf.getPage(i)).getTextContent();rawPages.push(c.items.map(x=>x.str).join(' '));if(bar)bar.style.width=`${Math.round(i/pdf.numPages*100)}%`;}const pages=rawPages.map(normalize),all=pages.join(' '),h=header(all);Object.entries(h).forEach(([k,v])=>{if($(k)&&v)$(k).value=v;});failedItems=parseAll(pages);render();if($('workflow'))$('workflow').value='Containment Required';if(msg){msg.textContent=failedItems.length?`V3.7 stable scan completed. ${failedItems.length} failed item(s) found. Verify all values against the PDF.`:'No supported failed result was confirmed from the report content. Add it manually.';msg.classList.remove('hidden');}}catch(e){console.error('SGS RSL V3.7 stable',e);if(msg){msg.textContent='PDF parsing failed. Enter values manually.';msg.classList.remove('hidden');}}}
function install(){ensureUI();render();const b=$('analyzePdf');if(b){b.onclick=null;b.replaceWith(b.cloneNode(true));$('analyzePdf').onclick=analyze;}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
