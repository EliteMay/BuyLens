import { readFile, access } from 'node:fs/promises';

const requiredFiles = [
  'index.html',
  'styles.css',
  'src/app.js',
  'src/db.js',
  'README.md',
  'REQUIREMENTS.md',
  'SPEC.md',
  'PROJECT_LEARNINGS.md'
];

for (const file of requiredFiles) {
  await access(file);
}

const html = await readFile('index.html', 'utf8');
const spec = await readFile('SPEC.md', 'utf8');
const requirements = await readFile('REQUIREMENTS.md', 'utf8');

const requiredHtmlTokens = [
  'id="productList"',
  'id="compareTableWrap"',
  'id="budgetInput"',
  'id="productDialog"',
  'src="./src/app.js"'
];

for (const token of requiredHtmlTokens) {
  if (!html.includes(token)) throw new Error(`index.html missing: ${token}`);
}

if (!spec.includes('IndexedDB') || !requirements.includes('IndexedDB')) {
  throw new Error('Storage specification is missing IndexedDB.');
}

if (!requirements.includes('JSON Backup')) {
  throw new Error('Requirements are missing JSON Backup.');
}

console.log('BuyLens static validation passed.');
