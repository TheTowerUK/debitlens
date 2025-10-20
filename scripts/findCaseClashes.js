// scripts/findCaseClashes.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.cwd(), 'src'); // scan only src/

const map = new Map();

function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else {
      const key = full.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(full);
    }
  }
}

walk(ROOT);

let clashes = 0;
for (const [, files] of map) {
  const uniq = [...new Set(files)];
  if (uniq.length > 1) {
    // same path differing only by case
    console.log('CASE CLASH:\n  ' + uniq.join('\n  '));
    clashes++;
  }
}
if (!clashes) console.log('No case clashes found.');
