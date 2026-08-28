/* SGS RSL Parser V26.3 - failure-type guard
   Load after sgs-rsl-v262.js.
   Prevents PASS chemistry sections from being added as failures.
*/
(()=>{'use strict';
const $=id=>document.getElementById(id);
function expectedType(){
  const name=$('pdfFile')?.files?.[0]?.name||'';
  if(/\bpH\s+Failure\b/i.test(name)) return 'ph';
  if(/\bBPA\s+Failure\b/i.test(name)) return 'bpa';
  if(/\bBPF\s+Failure\b/i.test(name)) return 'bpf';
  if(/\bBPS\s+Failure\b/i.test(name)) return 'bps';
  if(/\bTOF\s+Failures?\b/i.test(name)) return 'tof';
  if(/AP\s*\+\s*APEO\s+Failure/i.test(name)) return 'apeo';
  return '';
}
function matchesExpected(text,type){
  const t=String(text||'').toLowerCase();
  if(type==='ph') return /\bph\s*value\b/.test(t);
  if(type==='bpa') return /bisphenol\s*a\b|\bbpa\b/.test(t);
  if(type==='bpf') return /bisphenol\s*f\b|\bbpf\b/.test(t);
  if(type==='bps') return /bisphenol\s*s\b|\bbps\b/.test(t);
  if(type==='tof') return /organic\s+fluorine|fluorine\s+(?:content|screening)|\btof\b/.test(t);
  if(type==='apeo') return /total\s*ap\s*\+\s*apeo/.test(t);
  return true;
}
function host(){return $('failedItemsRowsV26')||$('failedItemsRowsV261')||$('failedItemsRows');}
function guard(){
  const type=expectedType(),h=host();
  if(!type||!h)return;
  const substanceInputs=[...h.querySelectorAll('[data-k="substance"],[data-v26="substance"]')];
  let removed=0;
  substanceInputs.forEach(input=>{
    if(matchesExpected(input.value,type))return;
    const row=input.closest('div');
    if(row){row.remove();removed++;}
  });
  if(removed){
    const remaining=[...h.querySelectorAll('[data-k="substance"],[data-v26="substance"]')];
    window.v26FailedItems=remaining.map(input=>{
      const i=input.dataset.i;
      return {
        substance:input.value,
        result:h.querySelector(`[data-i="${i}"][data-k="result"],[data-i="${i}"][data-v26="result"]`)?.value||'',
        limit:h.querySelector(`[data-i="${i}"][data-k="limit"],[data-i="${i}"][data-v26="limit"]`)?.value||''
      };
    });
    const first=window.v26FailedItems[0]||{};
    if($('substance'))$('substance').value=first.substance||'';
    if($('result'))$('result').value=first.result||'';
    if($('limit'))$('limit').value=first.limit||'';
    if($('parseAlert'))$('parseAlert').textContent=`V26.3 validation completed. ${window.v26FailedItems.length} confirmed failed item(s). PASS chemistry sections were excluded.`;
  }
}
function install(){
  const button=$('analyzePdf');
  if(!button)return;
  button.addEventListener('click',()=>{
    const timer=setInterval(guard,150);
    setTimeout(()=>{clearInterval(timer);guard();},8000);
  },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
