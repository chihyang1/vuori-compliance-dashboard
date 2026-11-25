import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const jsonPath = path.join(root, 'case-studies.json');
const oldCases = fs.existsSync(jsonPath)
  ? (JSON.parse(fs.readFileSync(jsonPath, 'utf8')).cases || [])
  : [];

const oldByFile = new Map(oldCases.map(item => [item.file, item]));
const oldByBase = new Map(oldCases.map(item => [path.basename(item.file), item]));

function caseNumber(file) {
  const match = path.basename(file).match(/^Case\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

function cleanTitle(file) {
  return path.basename(file, path.extname(file))
    .replace(/^Case\s*\d+\s*[-_–—]?\s*/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const files = [];
const reportsDir = path.join(root, 'case-reports');
if (fs.existsSync(reportsDir)) {
  for (const name of fs.readdirSync(reportsDir)) {
    const full = path.join(reportsDir, name);
    if (fs.statSync(full).isFile() && name.toLowerCase().endsWith('.pdf')) {
      files.push(`case-reports/${name}`);
    }
  }
}
// Backward compatibility: only use root PDFs if case-reports is empty.
if (files.length === 0) {
  for (const name of fs.readdirSync(root)) {
    const full = path.join(root, name);
    if (fs.statSync(full).isFile() && /^Case\s*\d+.*\.pdf$/i.test(name)) files.push(name);
  }
}

const cases = files
  .sort((a, b) => (caseNumber(a) ?? 999999) - (caseNumber(b) ?? 999999) || a.localeCompare(b))
  .map(file => {
    const n = caseNumber(file);
    const previous = oldByFile.get(file) || oldByBase.get(path.basename(file));
    return {
      order: n ?? previous?.order ?? 9999,
      tag: n ? `CASE ${n}` : (previous?.tag || 'CASE STUDY'),
      title: previous?.title || cleanTitle(file),
      description: previous?.description || 'Case study report.',
      file
    };
  });

fs.writeFileSync(jsonPath, JSON.stringify({ cases }, null, 2) + '\n');
console.log(`Updated case-studies.json with ${cases.length} PDF reports.`);
