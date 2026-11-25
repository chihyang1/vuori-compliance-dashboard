import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const jsonPath=path.join(root,'case-studies.json');
const old=fs.existsSync(jsonPath)?JSON.parse(fs.readFileSync(jsonPath,'utf8')).cases||[]:[];
const known=new Map(old.map(x=>[x.file,x]));
const files=[];
for(const dir of ['.', 'case-reports']){
  const abs=path.join(root,dir);
  if(!fs.existsSync(abs)) continue;
  for(const name of fs.readdirSync(abs)){
    const full=path.join(abs,name);
    if(fs.statSync(full).isFile() && name.toLowerCase().endsWith('.pdf') && (dir==='case-reports'||/^Case\s*\d+/i.test(name))) files.push((dir==='.'?'':dir+'/')+name);
  }
}
function cleanTitle(file){return path.basename(file,'.pdf').replace(/^Case\s*\d+\s*[-–—_]\s*/i,'').replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim();}
const maxOrder=Math.max(0,...old.map(x=>Number(x.order)||0)); let next=maxOrder+1;
const cases=files.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(file=>known.get(file)||{order:next++,tag:'NEW CASE',title:cleanTitle(file),description:'New case study report. Update this description in case-studies.json when needed.',file});
fs.writeFileSync(jsonPath,JSON.stringify({cases},null,2)+'\n');
console.log(`Updated case-studies.json with ${cases.length} PDF reports.`);
