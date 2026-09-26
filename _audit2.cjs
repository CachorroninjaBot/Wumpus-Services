const fs = require('fs');
const defaults = fs.readFileSync('src/core/module-defaults.ts', 'utf8');
const defaultsModules = {};
let currentModule = null;
for (const line of defaults.split('\n')) {
  const topMatch = line.match(/^  (\w+):\s*\{$/);
  if (topMatch) { currentModule = topMatch[1]; defaultsModules[currentModule] = {}; }
  if (currentModule && !topMatch) {
    const km = line.match(/^    (\w+):/);
    if (km) defaultsModules[currentModule][km[1]] = true;
  }
}
const fields = fs.readFileSync('src/web/module-fields.tsx', 'utf8');
const fieldsModules = {};
const re = /key:\s*"(\w+)"/g;
let m;
const modRe = /^  (\w+):\s*\[/gm;
let modMatch;
let lastMod = null;
let lastIndex = 0;
while ((modMatch = modRe.exec(fields)) !== null) {
  if (lastMod) {
    const block = fields.substring(lastIndex, modMatch.index);
    fieldsModules[lastMod] = {};
    let km;
    const kre = /key:\s*"(\w+)"/g;
    while ((km = kre.exec(block)) !== null) fieldsModules[lastMod][km[1]] = true;
  }
  lastMod = modMatch[1];
  lastIndex = modMatch.index;
}
if (lastMod) {
  const block = fields.substring(lastIndex);
  fieldsModules[lastMod] = {};
  let km;
  const kre = /key:\s*"(\w+)"/g;
  while ((km = kre.exec(block)) !== null) fieldsModules[lastMod][km[1]] = true;
}
// Also count spread fields
const spreadRe = /\{\s*\.\.\.(\w+)/g;
let sm;
const spreadCounts = {};
while ((sm = spreadRe.exec(fields)) !== null) {
  spreadCounts[sm[1]] = (spreadCounts[sm[1]] || 0) + 1;
}

let gaps = 0;
for (const mod of Object.keys(defaultsModules)) {
  const defKeys = Object.keys(defaultsModules[mod] || {});
  const fieldKeys = Object.keys(fieldsModules[mod] || {});
  const missingInUI = defKeys.filter(k => !fieldKeys.includes(k));
  if (missingInUI.length) {
    gaps++;
    console.log(mod + ': MISSING in UI -> ' + missingInUI.join(', '));
  }
}
if (!gaps) console.log('ALL defaults have matching UI fields.');
console.log('\nSpreads detected: ' + JSON.stringify(spreadCounts));