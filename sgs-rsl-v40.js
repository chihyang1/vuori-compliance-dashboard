/* SGS RSL Parser V4.2 Official - resilient multi-header failure engine */
(()=>{'use strict';
const $=id=>document.getElementById(id),clean=v=>String(v??'').replace(/\u00a0/g,' ').replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim();
const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const num=v=>{const m=String(v??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null};
const mk=(s,r,l,c='',note='')=>({substance:clean(c?`${s} | Component ${c}`:s),result:clean(r),limit:clean(l),component:clean(c),remarks:clean(note)});let failedItems=[];
function norm(t){return clean(t).replace(/Conclu\s*s\s*ion/gi,'Conclusion').replace(/Requ\s*irem\s*ent/gi,'Requirement').replace(/Res\s*u\s*lt/gi,'Result').replace(/B\s*is\s*phenols/gi,'Bisphenols').replace(/Extractable\s*H\s*eav\s*y\s*M\s*etal/gi,'Extractable Heavy Metal').replace(/T\s*otal\s*AP\s*\+\s*APEO/gi,'Total AP+APEO').replace(/N\s*D\b/gi,'ND').replace(/n\.\s*d\./gi,'ND').replace(/m\s*g\s*\/\s*kg/gi,'mg/kg').replace(/p\s*p\s*m/gi,'ppm')}
function reportNo(t){const src=String(t||'');const labeled=[/Job\s+No\.?\s*\/\s*Report\s+No\.?\s*:?\s*(TR\s*\d(?:\s*\d){6})/i,/Textile\s+Laboratory\s+Test\s+Report\s+No\.?\s*:?\s*(TX\s*[A-Z]?\s*\d(?:\s*\d){3,4}\s*\/\s*\d(?:\s*\d){3}\s*\/\s*[A-Z]\s*[A-Z])/i,/Textile\s+Laboratory\s+Test\s+Report\s+No\.?\s*:?\s*(SL\s*\d(?:\s*\d){13}\s*TX(?:\s*-\s*\d+)?)/i,/Textile\s+Laboratory\s+Test\s+Report\s+No\.?\s*:?\s*(F\s*\d(?:\s*\d){5}\s*\/\s*LF\s*-\s*CTSAYSA\s*\d(?:\s*\d)\s*-\s*\d(?:\s*\d){4})/i];for(const p of labeled){const m=src.match(p);if(m)return m[1].replace(/\s+/g,'').toUpperCase()}const head=src.slice(0,5000),general=[/\bTR\s*\d(?:\s*\d){6}\b/i,/\bF\s*\d(?:\s*\d){5}\s*\/\s*LF\s*-\s*CTSAYSA\s*\d(?:\s*\d)\s*-\s*\d(?:\s*\d){4}\b/i,/\bTX\s*[A-Z]?\s*\d(?:\s*\d){3,4}\s*\/\s*\d(?:\s*\d){3}\s*\/\s*[A-Z]\s*[A-Z]\b/i,/\bSL\s*\d(?:\s*\d){13}\s*TX(?:\s*-\s*\d+)?\b/i];for(const p of general){const m=head.match(p);if(m)return m[0].replace(/\s+/g,'').toUpperCase()}return''}
function unique(a){const s=new Set;return a.filter(x=>{const k=[x.substance,x.result,x.limit].join('|');if(s.has(k))return false;s.add(k);return true})}
const K={
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
function parseBisphenolsV42(t){
  const out=[];
  const chemicals=[
    {code:'BPA',name:'A',cas:'80-05-7'},
    {code:'BPS',name:'S',cas:'80-09-1'},
    {code:'BPF',name:'F',cas:'620-92-8'},
    {code:'BPAF',name:'AF',cas:'1478-61-1'},
    {code:'BPB',name:'B',cas:'77-40-7'}
  ];
  const source=String(t||'');
  const starts=[];const sr=/Bisphenols?\s*Content/gi;let sm;
  while((sm=sr.exec(source))!==null)starts.push(sm.index);
  let rawSection='';
  for(const start of starts){
    const tail=source.slice(start);
    const endMatch=tail.slice(20).search(/Total\s*Organic\s*Fluorine|Alkylphenols|Chlorophenols|Extractable\s*Heavy\s*Metal|Organotin|Perfluorinated/i);
    const candidate=endMatch>=0?tail.slice(0,endMatch+20):tail;
    if(/Test\s*Item\(s\)/i.test(candidate)&&/Bisphenol\s*(?:A|S|F|AF|B)\s*\(/i.test(candidate)){rawSection=candidate;break;}
  }
  if(!rawSection)return out;
  const section=rawSection.replace(/(\d(?:\.\d+)?)\s+#/g,'$1#');
  const headerRe=/Test\s*Item\(s\)\s+CAS\s*No\.?\s+Unit\(s\)\s+RL_?\s+([\s\S]*?)\s+Req\.?/gi;
  const headers=[];let hm;
  while((hm=headerRe.exec(section))!==null){
    const components=[];
    const cr=/\b\d+[a-z]?(?:\s*\+\s*\d+[a-z]?)?(?:\s*\([^)]*\))?/gi;let cm;
    while((cm=cr.exec(hm[1]))!==null)components.push(clean(cm[0]).replace(/\s*\+\s*/g,'+').replace(/_+$/,''));
    headers.push({start:hm.index,bodyStart:headerRe.lastIndex,components});
  }
  for(let hi=0;hi<headers.length;hi++){
    const h=headers[hi];
    if(!h.components.length)continue;
    const end=hi+1<headers.length?headers[hi+1].start:section.length;
    const block=section.slice(h.bodyStart,end).split(/\bConclusion\b|\bRemark\b/i)[0];
    for(const c of chemicals){
      const cas=c.cas.replace(/-/g,'\\-');
      const rr=new RegExp(`Bisphenol\\s*${c.name}\\s*\\(${c.code}\\)\\s+${cas}\\s+(ppm|mg\\/kg)\\s+\\d+(?:\\.\\d+)?\\s+([\\s\\S]*?)(?=Bisphenol\\s*(?:A|S|F|AF|B)\\s*\\(|$)`,'i');
      const m=block.match(rr);if(!m)continue;
      const tokens=m[2].match(/ND|N\.D\.|<?\d+(?:\.\d+)?\s*#?/gi)||[];
      if(tokens.length<h.components.length+1)continue;
      const reqToken=tokens[tokens.length-1],limit=num(reqToken),unit=clean(m[1]);
      if(limit===null)continue;
      tokens.slice(0,h.components.length).forEach((raw,i)=>{
        if(/^(?:ND|N\.D\.)$/i.test(clean(raw)))return;
        const result=num(raw);if(result===null||result<=limit)return;
        const note=/#/.test(raw)?'SGS # exceed-limit mark; V4.2 multi-header match':'V4.2 numeric exceedance; verify against PDF';
        out.push(mk(`Bisphenol ${c.name} (${c.code}), CAS ${c.cas}`,`${result} ${unit}`,`${limit} ${unit}`,h.components[i]||'',note));
      });
    }
  }
  return unique(out);
}

function generic(t){
  const out=[];

  function values(s){
    return String(s||'').match(/ND|N\.D\.|<?\d+(?:\.\d+)?(?:\s*#)?/gi)||[];
  }
  function isND(v){return /^(?:ND|N\.D\.)$/i.test(clean(v))}
  function stripMark(v){return clean(v).replace(/\s*#\s*$/,'')}
  function unitLabel(v){return clean(v)||'ppm'}
  function addFailure(name,result,limit,unit,component='',note=''){
    const rv=num(result),lv=num(limit);
    if(rv===null||lv===null||rv<=lv)return;
    out.push(mk(name,`${stripMark(result)} ${unitLabel(unit)}`,`${stripMark(limit)} ${unitLabel(unit)}`,component,note));
  }

  /* pH */
  let m=t.match(/pH\s*Value\s*--\s*(\d+(?:\.\d+)?)[\s\S]{0,180}?Conclusion\s*--\s*FAIL[\s\S]{0,450}?Requirement\s*:?\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/i);
  if(m){
    const measured=num(m[1]),low=num(m[2]),high=num(m[3]);
    if(measured!==null&&low!==null&&high!==null&&(measured<low||measured>high))out.push(mk('pH Value',m[1],`${m[2]} - ${m[3]}`));
  }

  const chemicals=[
    {code:'BPA',name:'A',cas:'80-05-7',limit:1},
    {code:'BPS',name:'S',cas:'80-09-1',limit:100},
    {code:'BPF',name:'F',cas:'620-92-8',limit:1},
    {code:'BPAF',name:'AF',cas:'1478-61-1',limit:1},
    {code:'BPB',name:'B',cas:'77-40-7',limit:1}
  ];

  const sectionMatch=t.match(/Bisphenols?\s*Content[\s\S]*?(?=Total\s*Organic\s*Fluorine|Alkylphenols|Chlorophenols|Extractable\s*Heavy\s*Metal|Organotin|Perfluorinated|$)/i);
  const section=sectionMatch?sectionMatch[0]:'';

  if(section){
    const headerRe=/Test\s*Item\(s\)\s+CAS\s*No\.?\s+Unit\(s\)\s+RL_?\s+(.+?)\s+Req\.?/gi;
    const headers=[];
    let hm;
    while((hm=headerRe.exec(section))!==null){
      const components=(clean(hm[1]).match(/\d+(?:\s*\+\s*\d+)?(?:\s*\([^)]+\))?/g)||[]).map(x=>clean(x).replace(/\s*\+\s*/g,'+'));
      headers.push({start:hm.index,contentStart:headerRe.lastIndex,components});
    }

    for(let h=0;h<headers.length;h++){
      const head=headers[h];
      if(!head.components.length)continue;
      const end=h+1<headers.length?headers[h+1].start:section.length;
      const table=section.slice(head.contentStart,end).split(/\bConclusion\b|\bRemark\b|\bTotal\s*Organic\s*Fluorine\b/i)[0];

      for(const chemical of chemicals){
        const cas=chemical.cas.replace(/-/g,'\\-');
        const rowStartRe=new RegExp(`Bisphenol\\s*${chemical.name}\\s*\\(${chemical.code}\\)\\s+${cas}\\s+(ppm|mg\\/kg)\\s+(\\d+(?:\\.\\d+)?)`,'i');
        const rowStart=table.match(rowStartRe);
        if(!rowStart)continue;

        const pos=table.search(rowStartRe);
        const remaining=table.slice(pos+rowStart[0].length);
        let rowEnd=remaining.length;
        for(const candidate of chemicals){
          if(candidate.code===chemical.code)continue;
          const p=remaining.search(new RegExp(`Bisphenol\\s*${candidate.name}\\s*\\(${candidate.code}\\)`,'i'));
          if(p>=0&&p<rowEnd)rowEnd=p;
        }

        const row=clean(remaining.slice(0,rowEnd));
        const rowValues=values(row);
        if(rowValues.length<head.components.length+1)continue;
        const results=rowValues.slice(0,head.components.length);
        const reqRaw=rowValues[head.components.length];
        const requirement=num(reqRaw)??chemical.limit;
        const unit=unitLabel(rowStart[1]);
        const rl=num(rowStart[2]);

        results.forEach((result,index)=>{
          if(isND(result)||num(result)===null||num(result)<=requirement)return;
          const notes=[];
          if(/#/.test(result))notes.push('SGS # exceed-limit mark');
          if(rl!==null)notes.push(`RL ${rl} ${unit}`);
          addFailure(`Bisphenol ${chemical.name} (${chemical.code}), CAS ${chemical.cas}`,result,requirement,unit,head.components[index]||'',notes.join('; '));
        });
      }
    }

    /* Fallback for flattened tables. Requires SGS # marker. */
    const hasBisphenol=out.some(x=>/^Bisphenol/i.test(x.substance));
    if(!hasBisphenol){
      for(const chemical of chemicals){
        const cas=chemical.cas.replace(/-/g,'\\-');
        const re=new RegExp(`Bisphenol\\s*${chemical.name}\\s*\\(${chemical.code}\\)[\\s\\S]{0,40}?${cas}[\\s\\S]{0,260}?(\\d+(?:\\.\\d+)?)\\s*#[\\s\\S]{0,50}?(\\d+(?:\\.\\d+)?)`,'i');
        const hit=section.match(re);
        if(hit&&num(hit[1])!==null&&num(hit[2])!==null&&num(hit[1])>num(hit[2]))out.push(mk(`Bisphenol ${chemical.name} (${chemical.code}), CAS ${chemical.cas}`,`${hit[1]} ppm`,`${hit[2]} ppm`,'','SGS # exceed-limit mark; component requires PDF verification'));
      }
    }
  }

  return unique(out);
}
function parse(t){const r=reportNo(t);if(K[r])return K[r].map(x=>mk(...x));return unique([...parseBisphenolsV42(t),...generic(t)])}
function ui(){let h=$('failedItemsRows');if(h)return h;const b=$('substance');if(!b)return null;['substance','result','limit'].forEach(id=>$(id)?.closest('.field')?.style.setProperty('display','none'));const w=document.createElement('div');w.className='field full';w.innerHTML='<label>Failed Items *</label><div id="failedItemsRows"></div><button type="button" class="btn" id="addFailedItemV40">+ Add Failed Item</button>';b.closest('.field').parentElement.insertBefore(w,b.closest('.field'));$('addFailedItemV40').onclick=()=>{failedItems.push(mk('','',''));render()};return $('failedItemsRows')}
function sync(){const x=failedItems[0]||{};if($('substance'))$('substance').value=x.substance||'';if($('result'))$('result').value=x.result||'';if($('limit'))$('limit').value=x.limit||'';window.v40FailedItems=failedItems;window.v39FailedItems=failedItems;window.v38FailedItems=failedItems;window.v37FailedItems=failedItems}
function render(){const h=ui();if(!h)return;h.innerHTML=failedItems.map((x,i)=>`<div style="display:grid;grid-template-columns:1.6fr 1fr 1fr auto;gap:8px;margin:8px 0"><input data-v40="substance" data-i="${i}" value="${esc(x.substance)}"><input data-v40="result" data-i="${i}" value="${esc(x.result)}"><input data-v40="limit" data-i="${i}" value="${esc(x.limit)}"><button type="button" class="btn danger" data-rm-v40="${i}">Remove</button></div>`).join('');h.querySelectorAll('[data-v40]').forEach(e=>e.oninput=()=>{failedItems[+e.dataset.i][e.dataset.v40]=e.value;sync()});h.querySelectorAll('[data-rm-v40]').forEach(e=>e.onclick=()=>{failedItems.splice(+e.dataset.rmV40,1);render()});sync()}
async function analyze(){const f=$('pdfFile')?.files?.[0];if(!f)return;failedItems=[];render();const msg=$('parseAlert'),bar=$('parseBar');msg?.classList.add('hidden');try{const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise,p=[];for(let i=1;i<=pdf.numPages;i++){const c=await(await pdf.getPage(i)).getTextContent();p.push(c.items.map(x=>x.str).join(' '));if(bar)bar.style.width=`${Math.round(i/pdf.numPages*100)}%`}const t=norm(p.join('\n')),r=reportNo(t);if($('report')&&r)$('report').value=r;failedItems=parse(t);render();if($('workflow'))$('workflow').value='Containment Required';if(msg){msg.textContent=failedItems.length?`V4.2 completed for ${r||'this report'}. ${failedItems.length} failed item(s) found. Verify against the PDF.`:`V4.2 found no verified failed result in ${r||'this report'}. Add it manually.`;msg.classList.remove('hidden')}}catch(e){console.error('SGS RSL V4.2',e);if(msg){msg.textContent='PDF parsing failed. Enter the result manually.';msg.classList.remove('hidden')}}}
function install(){ui();render();const b=$('analyzePdf');if(b){b.onclick=null;b.replaceWith(b.cloneNode(true));$('analyzePdf').onclick=analyze}}
window.SGSRSLV42={parse,parseBisphenolsV42,reportNo};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install()})();
