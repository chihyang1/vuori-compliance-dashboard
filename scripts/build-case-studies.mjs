import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const jsonPath=path.join(root,'case-studies.json');
const oldCases=fs.existsSync(jsonPath)?(JSON.parse(fs.readFileSync(jsonPath,'utf8')).cases||[]):[];
const oldByFile=new Map(oldCases.map(x=>[x.file,x]));
const oldByBase=new Map(oldCases.map(x=>[path.basename(x.file),x]));
const caseNumber=file=>{const m=path.basename(file).match(/^Case\s*(\d+)/i);return m?Number(m[1]):null;};
// Preserve punctuation inside the report title. Remove only the leading "Case N" and its separator.
const titleFromFilename=file=>path.basename(file,path.extname(file)).replace(/^Case\s*\d+\s*-\s*/i,'').trim();
const defaultDescription=title=>`${title} case study and investigation report.`;
const files=[];
const reportsDir=path.join(root,'case-reports');
if(fs.existsSync(reportsDir)) for(const name of fs.readdirSync(reportsDir)){const full=path.join(reportsDir,name);if(fs.statSync(full).isFile()&&name.toLowerCase().endsWith('.pdf')) files.push(`case-reports/${name}`);}
if(files.length===0) for(const name of fs.readdirSync(root)){const full=path.join(root,name);if(fs.statSync(full).isFile()&&/^Case\s*\d+.*\.pdf$/i.test(name)) files.push(name);}
const cases=files.sort((a,b)=>(caseNumber(a)??999999)-(caseNumber(b)??999999)||a.localeCompare(b)).map(file=>{const n=caseNumber(file);const prev=oldByFile.get(file)||oldByBase.get(path.basename(file));const filenameTitle=titleFromFilename(file);const title=filenameTitle||prev?.title||'Case Study';return {order:n??prev?.order??9999,tag:n?`CASE ${n}`:(prev?.tag||'CASE STUDY'),title,description:prev?.description||defaultDescription(title),file};});
fs.writeFileSync(jsonPath,JSON.stringify({cases},null,2)+'\n');
console.log(`Updated case-studies.json with ${cases.length} PDF reports; titles preserve filename punctuation.`);
