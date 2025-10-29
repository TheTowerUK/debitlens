import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd(), 'src');
const map = new Map<string, string[]>();

function walk(dir: string): void {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else {
      const key = full.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(full);
    }
  }
}

walk(ROOT);

let clashes = 0;
for (const [, files] of map) {
  const uniq = [...new Set(files)];
  if (uniq.length > 1) {
    console.log('CASE CLASH:\n  ' + uniq.join('\n  '));
    clashes++;
  }
}

if (!clashes) {
  console.log('No case clashes found.');
}
