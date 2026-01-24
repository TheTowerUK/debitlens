const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'screens', 'DataExportImportScreen.tsx');
let content = fs.readFileSync(file, 'utf8');

const end = content.indexOf('  const persistCsvStats = async (stats: CsvImportStats) => {');
if (end === -1) {
  console.error('End marker not found');
  process.exit(1);
}

const start1 = content.indexOf('\n\n      if (accountColIndex >= 0) {');
const start2 = content.indexOf("      if (accountColIndex >= 0) {");
const start = start1 >= 0 ? start1 + 1 : start2 >= 0 ? start2 : -1;
if (start === -1) {
  console.error('Start marker not found');
  process.exit(1);
}

const before = content.slice(0, start);
const after = content.slice(end);
content = before + after;
fs.writeFileSync(file, content);
console.log('Removed preview block');
