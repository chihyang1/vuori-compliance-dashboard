/* SGS RSL Smart Parser V3.7 - content-driven, multi-SGS-format */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const compact=v=>String(v||'').replace(/\u00a0/g,' ').replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim();
const esc=v=>compact(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const first=(t,ps)=>{for(const p of ps){const m=t.match(p);if(m)return compact(m[1]);}return''};
const mk=(substance,result,limit,remarks='')=>({substance:compact(substance),result:compact(result),limit:compact(limit),remarks:compact(remarks)});
const number=v=>{const m=String(v||'').replace(/,/g,'').match(/\d+(?:\.\d+)?/);return m?Number(m[0]):null};
let items=[];
function normalize(raw){
 let t=compact(raw);
 const fixes=[
  [/Conclu\s*s\s*ion/gi,'Conclusion'],[/Res\s*u\s*lt/gi,'Result'],[/Requ\s*irem\s*ent/gi,'Requirement'],
  [/B\s*is\s*phenols/gi,'Bisphenols'],[/H\s*eav\s*y\s*M\s*etal/gi,'Heavy Metal'],
  [/ExtractableH\s*eav\s*y\s*M\s*etal/gi,'Extractable Heavy Metal'],[/T\s*otalH\s*eav\s*y\s*M\s*etal/gi,'Total Heavy Metal'],
  [/L\s*im\s*it/gi,'Limit'],[/N\s*o\s*\./gi,'No.'],[/m\s*g\s*\/\s*kg/gi,'mg/kg'],[/p\s*p\s*m/gi,'ppm'],
  [/Chlorotolu\s*enes/gi,'Chlorotoluenes'],[/CB\s*s\s*&\s*CT\s*s/gi,'CBs & CTs'],
  [/Alkylphenols?\s*\(APs?\)/gi,'Alkylphenols (AP)'],[/Alkylphenol\s+Ethoxylates?\s*\(APEOs?\)/gi,'Alkylphenol Ethoxylates (APEO)']
 ];
 fixes.forEach(([a,b])=>t=t.replace(a,b)); return t;
}
function iso(v){let m=compact(v).match(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);if(m)return`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;const d=new Date(v);return isNaN(d)?'':d.toISOString().slice(0,10)}
function reportNo(t){return first(t,[/Textile\s+Laboratory\s+Test\s+Report\s+No\s*:\s*([A-Z0-9]+\s*\/\s*\d{4}\s*\/\s*[A-Z0-9-]+)/i,/Test\s+Report(?:\s+No\.?)?\s*[:#.]?\s*([A-Z0-9][A-Z0-9/_\-]{5,})/i,/Report\s+No\.?\s*[:#.]?\s*([A-Z0-9][A-Z0-9/_\-]{5,})/i]).replace(/\s*\/\s*/g,'/').replace(/\s+/g,'')}
function header(t){const field=(a,b)=>first(t,[new RegExp(`${a}\\s*:?\\s*(.{1,180}?)(?=\\s+(?:${b}))`,'i')]);return{report:reportNo(t),reportDate:iso(first(t,[/(?:Issued\s+Date|Date)\s*:?\s*([A-Za-z]{3,9}\.?\s+\d{1,2},?\s*\d{4}|\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2})/i])),supplier:first(t,[/Supplier\s+Company\s+Name\s*:\s*(.{2,150}?)(?=\s+(?:Sample\s+Type|Division|Department))/i,/APPLICANT\s*:\s*(.{2,150}?)(?=\s+(?:OVERALL|APPLICANT\s+ADDRESS))/i]),article:field('Article\\s+Number','Agent\\s+Name|Manufacturer|Construction'),po:field('PO#\\s*\\/\\s*(?:Ref#|REF#)','Bulk\\s+Lot#|Style'),lot:field('Bulk\\s+Lot#','Style\\s*#|Style\\s+Name')}}
function section(t,start,end,max=10000){const m=t.match(new RegExp(`${start}[\\s\\S]{0,${max}}?(?=${end}|$)`,'i'));return m?m[0]:''}
function hasFail(s){return /Conclusion\s*(?:--\s*)?(?:FAIL|Fail)(?:\s*[#*])?/i.test(s)}
function unique(a){const seen=new Set();return a.filter(x=>{const k=x.substance+'|'+x.result+'|'+x.limit;if(seen.has(k))return false;seen.add(k);return true})}
function parsePH(t){const out=[],s=section(t,'p\\s*H\\s*Value','Azo-amines|Formaldehyde|Bisphenols',1800);if(!hasFail(s))return out;const m=s.match(/pH\s*Value[^\d]{0,60}(\d+(?:\.\d+)?)[\s\S]{0,120}?(\d+(?:\.\d+)?)\s*[-~]\s*(\d+(?:\.\d+)?)/i);if(m)out.push(mk('pH Value',m[1],`${m[2]} - ${m[3]}`));return out}
function rowResults(row,defaultLimit){
 const tokens=row.replace(/[#*]/g,' ').match(/ND|n\.?d\.?|\d+(?:\.\d+)?/gi)||[];
 const vals=tokens.map(x=>/^(?:ND|n\.?d\.?)$/i.test(x)?null:Number(x));
 if(vals.length<2)return[];
 const rl=vals[0],limit=vals[vals.length-1]??defaultLimit;
 return vals.slice(1,-1).filter(v=>v!==null&&v!==rl&&v>limit).map(v=>({v,limit}));
}
function parseBisphenols(t){
 const s=section(t,'Bisphenols?(?:\\s+Content)?','Total\\s+Organic\\s+Fluorine|Alkylphenols|Chlorobenzenes|Forbidden|$'); if(!hasFail(s))return[];
 const out=[],defs=[['BPA','A','80-05-7',1],['BPS','S','80-09-1',100],['BPF','F','620-92-8',1],['BPAF','AF','1478-61-1',1],['BPB','B','77-40-7',1]];
 for(const [abbr,letter,cas,lim] of defs){
  const escCas=cas.replace(/-/g,'\\-');
  const re=new RegExp(`Bisphenol\\s*${letter}\\s*\\(${abbr}\\)\\s+${escCas}\\s+(?:(?:ppm|mg\\/kg)\\s+)?([\\s\\S]{1,100}?)(?=Bisphenol\\s*(?:A|S|F|AF|B)\\s*\\(|Conclusion|$)`,'gi');
  for(const m of s.matchAll(re)){
   const body=m[1];
   if(!/(?:RL|Reporting Limit)/i.test(s) && !/(?:ppm|mg\/kg)/i.test(m[0])){
    const v=number(body); if(v!==null&&v>lim)out.push(mk(`Bisphenol ${letter} (${abbr}), CAS ${cas}`,`${v} ppm`,`${lim} ppm`)); continue;
   }
   const results=rowResults(body,lim); results.forEach((r,i)=>out.push(mk(`Bisphenol ${letter} (${abbr}), CAS ${cas}${results.length>1?` | Failed result ${i+1}`:''}`,`${r.v} ppm`,`${r.limit} ppm`)));
  }
 }
 return unique(out);
}
function parseTOF(t){
 const s=section(t,'Total\\s+Organic\\s+Fluorine(?:\\s+Screening)?','Perfluorinated|Alkylphenols|Total\\s+Arsenic|$'); if(!hasFail(s))return[];
 const out=[];
 const blocks=[...s.matchAll(/Test\s+Item\(s\)\s*(\d+(?:\+\d+)*)[\s\S]{0,80}?Total\s+Organic\s+Fluorine\s+(ND|\d+(?:\.\d+)?)\s*(mg\/kg|ppm)?[#*]?[\s\S]{0,60}?Conclusion\s+FAIL/gi)];
 for(const m of blocks)if(!/^ND$/i.test(m[2]))out.push(mk(`Total Organic Fluorine (TOF) | Component ${m[1]}`,`${m[2]} ${m[3]||'mg/kg'}`,'Not Detected'));
 if(out.length)return out;
 const m=s.match(/(?:Fluorine\s+Content|Total\s+Organic\s+Fluorine)[\s\S]{0,100}?(?:mg\/kg|ppm)\s+(\d+(?:\.\d+)?)\s+(?:ND\s+)?(\d+(?:\.\d+)?)/i);if(m&&number(m[1])>=number(m[2]))out.push(mk('Total Organic Fluorine (TOF)',`${m[1]} mg/kg`,`${m[2]} mg/kg`));return out;
}
function parseAPEO(t){const s=section(t,'Alkylphenols?\\s*\\(AP\\)[\\s\\S]{0,80}?Alkylphenol\\s+Ethoxylates?\\s*\\(APEO\\)','Chlorinated|Azo-amines|Chlorophenols|$');if(!hasFail(s))return[];const m=s.match(/Total\s+APs?\s*\+\s*APEOs?[^\d]{0,70}(\d+(?:\.\d+)?)[\s\S]{0,100}?(?:Requirement|Req\.)[^\d]{0,30}(\d+(?:\.\d+)?)/i);return m&&number(m[1])>number(m[2])?[mk('Total AP + APEO',`${m[1]} mg/kg`,`${m[2]} mg/kg`)]:[]}
function parseCBsCTs(t){const s=section(t,'Chlorobenzenes?\\s*&\\s*Chlorotoluenes?','Forbidden|Disperse|$');if(!hasFail(s))return[];const out=[];const m=s.match(/1,4-Dichlorobenzene\s+106-46-7\s+(?:(?:mg\/kg|ppm)\s+)?(?:\d+(?:\.\d+)?\s+)?(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i);if(m&&number(m[1])>number(m[2]))out.push(mk('1,4-Dichlorobenzene (CBs & CTs), CAS 106-46-7',`${m[1]} mg/kg`,`${m[2]} mg/kg`));return out}
function parsePFAS(t){const s=section(t,'(?:Perfluorinated\\s+and\\s+Polyfluorinated\\s+Chemicals|Per-\\s*&?\\s*Polyfluoroalkyl\\s+Substances)\\s*\\(PFAS\\)','Applicant Form|Appendix|\\*\\*\\*\\s*End|$ ',14000);if(!hasFail(s))return[];const out=[],defs=[['6:2 FTOH','647-42-7',1],['8:2 FTOH','678-39-7',1],['10:2 FTOH','865-86-1',.26]];for(const [name,cas,lim] of defs){const m=s.match(new RegExp(`${cas.replace(/-/g,'\\-')}\\s+(?:(?:mg\\/kg|ppm)\\s+)?(\\d+(?:\\.\\d+)?)\\s+(ND|n\\.?d\\.?|\\d+(?:\\.\\d+)?)`,'i'));if(m&&!/^n?\.?d/i.test(m[2])&&number(m[2])>lim)out.push(mk(`${name}, CAS ${cas}`,`${m[2]} mg/kg`,`${lim} mg/kg`))}for(const [label,lim] of [['Sum of PFOA-related compounds',1],['Total PFOA-related Substances',1],['Sum of C9-C14 PFCA-related substances',.26],['Total C9-C14 PFCA-related Substances',.26],['Total PFHxA-related Substances',1]]){const e=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),m=s.match(new RegExp(`${e}[\\s\\S]{0,50}?(\\d+(?:\\.\\d+)?)\\s*(?:mg\\/kg|ppm)?[\\s\\S]{0,30}?(\\d+(?:\\.\\d+)?)`,'i'));if(m&&number(m[1])>number(m[2]))out.push(mk(label.replace(/^Sum of /,'Total '),`${m[1]} mg/kg`,`${m[2]} mg/kg`))}return unique(out)}
function parseMetals(t){const out=[],s=section(t,'(?:Extractable|Total)\\s+Heavy\\s+Metal','Organotin|Quinoline|$');if(!hasFail(s))return out;const defs=[['Arsenic (As)','7440-38-2',.2],['Cadmium (Cd)','7440-43-9',.1],['Chromium (Cr)','7440-47-3',2],['Mercury (Hg)','7439-97-6',.02]];for(const [name,cas,lim] of defs){const m=s.match(new RegExp(`${cas.replace(/-/g,'\\-')}\\s+(?:(?:mg\\/kg|ppm)\\s+)?(\\d+(?:\\.\\d+)?)`,'i'));if(m&&number(m[1])>lim)out.push(mk(`${name}, CAS ${cas}`,`${m[1]} mg/kg`,`${lim} mg/kg`))}return out}
function parseDEHP(t){const s=section(t,'Phthalates','Polyaromatic|Polycyclic|Applicant Form|$');if(!hasFail(s))return[];const m=s.match(/(?:DEHP|117-81-7)[\s\S]{0,60}?(\d+(?:\.\d+)?)\s*(?:mg\/kg|ppm)?[\s\S]{0,30}?(\d+(?:\.\d+)?)/i);return m&&number(m[1])>number(m[2])?[mk('Bis-(2-ethylhexyl) Phthalate (DEHP), CAS 117-81-7',`${m[1]} mg/kg`,`${m[2]} mg/kg`)]:[]}
function parseAll(t){return unique([...parsePH(t),...parseBisphenols(t),...parseTOF(t),...parseAPEO(t),...parseCBsCTs(t),...parsePFAS(t),...parseMetals(t),...parseDEHP(t)])}
function ui(){let h=$('failedItemsRows');if(!h){const s=$('substance');if(!s)return null;['substance','result','limit'].forEach(id=>$(id)?.closest('.field')?.style.setProperty('display','none'));const w=document.createElement('div');w.className='field full';w.innerHTML='<label>Failed Items *</label><div id="failedItemsRows"></div><button type="button" class="btn" id="addFailedItemV37">+ Add Failed Item</button>';s.closest('.field').parentElement.insertBefore(w,s.closest('.field'));$('addFailedItemV37').onclick=()=>{items.push(mk('','',''));render()};h=$('failedItemsRows')}return h}
function sync(){const x=items[0]||{};if($('substance'))$('substance').value=x.substance||'';if($('result'))$('result').value=x.result||'';if($('limit'))$('limit').value=x.limit||'';window.v37FailedItems=items}
function render(){const h=ui();if(!h)return;h.innerHTML=items.map((x,i)=>`<div style="display:grid;grid-template-columns:1.6fr 1fr 1fr auto;gap:8px;margin:8px 0"><input data-v37="substance" data-i="${i}" value="${esc(x.substance)}"><input data-v37="result" data-i="${i}" value="${esc(x.result)}"><input data-v37="limit" data-i="${i}" value="${esc(x.limit)}"><button type="button" class="btn danger" data-rm-v37="${i}">Remove</button></div>`).join('');h.querySelectorAll('[data-v37]').forEach(e=>e.oninput=()=>{items[+e.dataset.i][e.dataset.v37]=e.value;sync()});h.querySelectorAll('[data-rm-v37]').forEach(e=>e.onclick=()=>{items.splice(+e.dataset.rmV37,1);render()});sync()}
async function analyze(){const f=$('pdfFile')?.files?.[0];if(!f)return;items=[];render();const msg=$('parseAlert'),bar=$('parseBar');msg?.classList.add('hidden');try{const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise,p=[];for(let i=1;i<=pdf.numPages;i++){const c=await(await pdf.getPage(i)).getTextContent();p.push(c.items.map(x=>x.str).join(' '));if(bar)bar.style.width=`${Math.round(i/pdf.numPages*100)}%`}const text=normalize(p.join('\n'));const h=header(text);Object.entries(h).forEach(([k,v])=>{if($(k)&&v)$(k).value=v});items=parseAll(text);render();if($('workflow'))$('workflow').value='Containment Required';if(msg){msg.textContent=items.length?`V3.7 content scan completed. ${items.length} failed item(s) found from report content. Verify all values against the PDF.`:'No supported failed result was confirmed from the report content. Add it manually.';msg.classList.remove('hidden')}}catch(e){console.error('V3.7',e);if(msg){msg.textContent='PDF parsing failed. Enter values manually.';msg.classList.remove('hidden')}}}
function install(){ui();render();const b=$('analyzePdf');if(b){b.onclick=null;b.replaceWith(b.cloneNode(true));$('analyzePdf').onclick=analyze}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
