/* SGS RSL Failure Center V3.2A
   Strict row-based parser for PFAS, Bisphenols, APEO, CBs & CTs, and Heavy Metals.
   Replaces the earlier wide-window parser that produced excessive false positives. */
(() => {
  'use strict';

  const ANALYTES = [
    {name:'6:2 FTOH', re:/\b6\s*:\s*2\s*FTOH\b/i},
    {name:'8:2 FTOH', re:/\b8\s*:\s*2\s*FTOH\b/i},
    {name:'PFOA', re:/\bPFOA\b|perfluorooctanoic acid/i},
    {name:'PFOS', re:/\bPFOS\b|perfluorooctane sulfon/i},
    {name:'PFHxA', re:/\bPFHxA\b|perfluorohexanoic acid/i},
    {name:'PFNA', re:/\bPFNA\b|perfluorononanoic acid/i},
    {name:'Total PFAS', re:/\btotal\s+PFAS\b/i},
    {name:'TOF', re:/\bTOF\b|total organic fluorine/i},
    {name:'BPA', re:/\bBPA\b|bisphenol\s*A\b/i},
    {name:'BPF', re:/\bBPF\b|bisphenol\s*F\b/i},
    {name:'BPS', re:/\bBPS\b|bisphenol\s*S\b/i},
    {name:'BPB', re:/\bBPB\b|bisphenol\s*B\b/i},
    {name:'Total Bisphenols', re:/\btotal\s+bisphenols?\b/i},
    {name:'NPEO', re:/\bNPEO\b|nonylphenol ethoxylates?/i},
    {name:'OPEO', re:/\bOPEO\b|octylphenol ethoxylates?/i},
    {name:'NP', re:/\bnonylphenol\b|\bNP\b/i},
    {name:'OP', re:/\boctylphenol\b|\bOP\b/i},
    {name:'Total APEOs', re:/\btotal\s+APEOs?\b/i},
    {name:'1,4-Dichlorobenzene', re:/1\s*,\s*4\s*-?\s*dichlorobenzene/i},
    {name:'Chlorobenzenes & Chlorotoluenes', re:/chlorobenzenes?.{0,25}chlorotoluenes?|\bCBs?\s*&\s*CTs?\b/i},
    {name:'Lead', re:/\blead\b/i},
    {name:'Cadmium', re:/\bcadmium\b/i},
    {name:'Mercury', re:/\bmercury\b/i},
    {name:'Chromium VI', re:/chromium\s*(?:VI|6)/i},
    {name:'Arsenic', re:/\barsenic\b/i},
    {name:'Nickel', re:/\bnickel\b/i}
  ];

  const $v = id => document.getElementById(id);
  let failedItems = [];

  function esc(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function buildRows(content) {
    const groups = new Map();
    for (const item of content.items || []) {
      const text = String(item.str || '').trim();
      if (!text) continue;
      const x = Number(item.transform?.[4] || 0);
      const y = Math.round(Number(item.transform?.[5] || 0) / 2) * 2;
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y).push({x,text});
    }
    return [...groups.entries()]
      .sort((a,b)=>b[0]-a[0])
      .map(([y,items])=>({y,text:items.sort((a,b)=>a.x-b.x).map(x=>x.text).join(' ').replace(/\s+/g,' ').trim()}));
  }

  function isNoise(row) {
    return /(?:page\s+\d+\s+of\s+\d+|CAS[- ]?No\.?|test method|reporting limit|fiber|fibre|composition|content|safety factor|80% of|sample description|article number|style|PO#|bulk lot)/i.test(row);
  }

  function values(row) {
    const out=[];
    const rx=/([<>≤≥]?\s*(?:ND|N\.D\.|not detected|\d+(?:\.\d+)?)(?:\s*\*)?)\s*(mg\/kg|ppm|µg\/g|ug\/g|ng\/g|µg\/kg|ug\/kg|ppb|pH)?/gi;
    let m;
    while((m=rx.exec(row))){
      const raw=(m[1] + (m[2]?' '+m[2]:'')).replace(/\s+/g,' ').trim();
      const unit=(m[2]||'').toLowerCase();
      if(!unit) continue; // rejects CAS numbers, page numbers, row IDs and footnote numbers
      if(unit==='%') continue;
      const numeric=/ND|not detected/i.test(raw)?null:Number((raw.match(/\d+(?:\.\d+)?/)||[])[0]);
      out.push({raw,unit,numeric,star:/\*/.test(raw),index:m.index});
    }
    return out;
  }

  function findLimit(rows, index, unit) {
    for (let d=0; d<=3; d++) {
      for (const i of d===0?[index]:[index-d,index+d]) {
        if(i<0||i>=rows.length) continue;
        const row=rows[i].text;
        if(!/(?:requirement|limit|specification)/i.test(row)) continue;
        const vs=values(row).filter(v=>!unit||v.unit===unit);
        if(vs.length) return vs[vs.length-1];
      }
    }
    return null;
  }

  function rowHasFailure(row, value) {
    return /\bFAIL\b|exceed(?:s|ed)?\s+(?:the\s+)?limit/i.test(row) || Boolean(value?.star);
  }

  function parsePageRows(rows) {
    const found=[];
    rows.forEach((r,index)=>{
      if(isNoise(r.text)) return;
      for(const analyte of ANALYTES){
        if(!analyte.re.test(r.text)) continue;
        if(/BPAF|bisphenol\s*AF/i.test(r.text)) continue;
        const local=[r.text,rows[index+1]?.text||'',rows[index+2]?.text||''].join(' ');
        const vs=values(local);
        if(!vs.length) continue;
        // Result must occur on the analyte row or the immediately following row and have a chemical unit.
        const result=vs.find(v=>v.star) || vs[0];
        const limit=findLimit(rows,index,result.unit) || (vs.length>1?vs[vs.length-1]:null);
        if(!limit||limit===result||result.unit!==limit.unit) continue;
        const numericFail=result.numeric!==null&&limit.numeric!==null&&result.numeric>limit.numeric;
        if(!(rowHasFailure(local,result)||numericFail)) continue;
        found.push({substance:analyte.name,result:result.raw,limit:limit.raw});
      }
    });
    return found;
  }

  function dedupe(items){
    const map=new Map();
    for(const x of items){
      const k=`${x.substance}|${x.result}|${x.limit}`.toUpperCase();
      if(!map.has(k)) map.set(k,x);
    }
    return [...map.values()];
  }

  function makeUI(){
    if($v('failedItemsV32')) return;
    const old=$v('substance'); if(!old)return;
    const a=old.closest('.field'),b=$v('result')?.closest('.field'),c=$v('limit')?.closest('.field');
    [a,b,c].filter(Boolean).forEach(x=>x.style.display='none');
    const wrap=document.createElement('div');wrap.id='failedItemsV32';wrap.className='field full';
    wrap.innerHTML='<label>Failed Items *</label><div id="failedItemsRows"></div><button type="button" class="btn" id="addFailedItemV32">+ Add Failed Item</button>';
    a.parentElement.insertBefore(wrap,a);
    $v('addFailedItemV32').onclick=()=>{failedItems.push({substance:'',result:'',limit:''});render()};
    render();
  }

  function render(){
    const host=$v('failedItemsRows');if(!host)return;
    host.innerHTML=failedItems.map((x,i)=>`<div style="display:grid;grid-template-columns:1.5fr 1fr 1fr auto;gap:8px;margin:8px 0"><input data-k="substance" data-i="${i}" value="${esc(x.substance)}" placeholder="Substance / Test Item"><input data-k="result" data-i="${i}" value="${esc(x.result)}" placeholder="Measured Result"><input data-k="limit" data-i="${i}" value="${esc(x.limit)}" placeholder="Limit"><button type="button" class="btn danger" data-r="${i}">Remove</button></div>`).join('');
    host.querySelectorAll('[data-k]').forEach(n=>n.oninput=()=>{failedItems[+n.dataset.i][n.dataset.k]=n.value;sync()});
    host.querySelectorAll('[data-r]').forEach(n=>n.onclick=()=>{failedItems.splice(+n.dataset.r,1);render();sync()});
    sync();
  }

  function sync(){const x=failedItems[0]||{};if($v('substance'))$v('substance').value=x.substance||'';if($v('result'))$v('result').value=x.result||'';if($v('limit'))$v('limit').value=x.limit||'';}

  function emailItems(items){return items.map((x,i)=>`${i+1}. ${x.substance}\n   Test result: ${x.result}\n   Requirement / limit: ${x.limit}`).join('\n\n');}

  function generateV32Email(c){
    const items=c.failedItems?.length?c.failedItems:failedItems;
    const p=$v('emailPreview');if(!p)return;
    p.textContent=`Subject: SGS RSL Failure Notification | ${c.article} | Report ${c.report}\n\nDear ${c.supplier} Team,\n\nSGS RSL Report ${c.report} for Fabric Article ${c.article}${c.po?`, PO(s) ${c.po}`:''}${c.lot?`, Lot(s) ${c.lot}`:''} has a FAIL result.\n\nFailed Items\n\n${emailItems(items)}\n\nImmediate containment is required. Please immediately quarantine all affected material and stop shipment, cutting, production use, transfer or release until written disposition is provided.\n\nPlease reply with the following information:\n\nImmediate Containment\n1. How much material is affected? Include quantity, unit, PO(s) and lot(s).\n2. Where is the affected material currently located?\n3. What is the current status of the failed material?\n4. What immediate actions have been completed?\n5. Is all affected material on hold and physically segregated? Please provide evidence.\n6. Will the material be held, reworked, dropped, destroyed or otherwise disposed of?\n\nCAPA and Retest\n7. Please provide a formal Root Cause Analysis.\n8. Please provide the Corrective Action Plan, responsible owner and target completion date.\n9. Please provide additional Preventive Actions to prevent recurrence.\n10. Please provide the SGS retest plan, including the full required test scope, TRF number, all affected lot numbers, sample submission date and expected report completion date.\n11. Please confirm how the corrective actions and retest results will be verified before any material is released.\n\nCAPA due date: ${c.dueDate}\n\nPlease attach quarantine evidence, material inventory, affected PO/lot records and the retest timeline.\n\nBest regards,\nVuori Product Integrity & Compliance`;
    $v('emailCard')?.classList.remove('hidden');
  }

  function install(){
    makeUI();
    const analyze=$v('analyzePdf');
    if(analyze){
      const base=analyze.onclick;
      analyze.onclick=async function(e){
        await base?.call(this,e);
        const file=$v('pdfFile')?.files?.[0];if(!file)return;
        try{
          const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
          let all=[];
          for(let i=1;i<=pdf.numPages;i++){
            const content=await(await pdf.getPage(i)).getTextContent();
            all=all.concat(parsePageRows(buildRows(content)));
          }
          failedItems=dedupe(all);
          if(failedItems.length>12){
            failedItems=[];
            const a=$v('parseAlert');if(a){a.textContent='Excessive extraction was prevented. Review the original PDF and add only the failed items manually.';a.classList.remove('hidden');}
          } else if(!failedItems.length){
            const a=$v('parseAlert');if(a){a.textContent='No supported failed row was confirmed. Review the original PDF and add the failed items manually.';a.classList.remove('hidden');}
          } else {
            const a=$v('parseAlert');if(a){a.textContent=`Automated extraction completed. ${failedItems.length} failed item(s) listed. Verify each item against the original PDF.`;a.classList.remove('hidden');}
          }
          render();
        }catch(err){console.error('V3.2A strict parser',err)}
      };
    }
    const create=$v('createCase');
    if(create){
      const base=create.onclick;
      create.onclick=function(e){
        sync();
        if(!failedItems.length||failedItems.some(x=>!x.substance||!x.result||!x.limit)){alert('Complete each Failed Item before creating the case.');return;}
        const before=cases.length;base?.call(this,e);
        if(cases.length>before){cases[0].failedItems=JSON.parse(JSON.stringify(failedItems));localStorage.setItem(CASE_KEY,JSON.stringify(cases));renderCases?.();generateV32Email(cases[0]);}
      };
    }
    window.generateEmail=generateV32Email;
    document.addEventListener('click',e=>{const b=e.target.closest('[data-email]');if(!b)return;const c=cases.find(x=>x.id===b.dataset.email);if(c)setTimeout(()=>generateV32Email(c),0)},true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
