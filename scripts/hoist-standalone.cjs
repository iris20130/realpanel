const fs = require('fs');
const path = require('path');

const root = process.argv[2];
const nm = path.join(root, 'node_modules');
const pnpmDir = path.join(nm, '.pnpm');

function listPkgs(dir) {
  const found = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const full = path.join(dir, e.name);
    if (e.name.startsWith('@')) {
      for (const s of fs.readdirSync(full, { withFileTypes: true })) {
        if (s.isDirectory()) found.push([`${e.name}/${s.name}`, path.join(full, s.name)]);
      }
    } else if (fs.existsSync(path.join(full, 'package.json'))) {
      found.push([e.name, full]);
    }
  }
  return found;
}

const wanted = new Map();
for (const pkg of fs.readdirSync(pnpmDir)) {
  const inner = path.join(pnpmDir, pkg, 'node_modules');
  if (!fs.existsSync(inner)) continue;
  for (const [name, src] of listPkgs(inner)) {
    if (!wanted.has(name)) wanted.set(name, src);
  }
}

let hoisted = 0;
for (const [name, src] of wanted) {
  const to = path.join(nm, name);
  if (fs.existsSync(to)) continue;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(src, to);
  hoisted++;
}
console.log('hoisted:', hoisted, 'total packages:', wanted.size);
