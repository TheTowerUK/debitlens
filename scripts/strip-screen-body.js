const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'src', 'screens', 'DataExportImportScreen.tsx');
let content = fs.readFileSync(p, 'utf8');
const lines = content.split(/\r?\n/);
// Keep lines 0-25 (0-indexed), then "  return (", then rest (1954+)
const before = lines.slice(0, 26).join('\n');
const fromReturn = lines.slice(1953); // from line 1954 (0-indexed 1953)
const after = fromReturn.join('\n');
const newContent = before + '\n\n' + after;
fs.writeFileSync(p, newContent);
console.log('Stripped screen body, new line count:', newContent.split(/\r?\n/).length);
