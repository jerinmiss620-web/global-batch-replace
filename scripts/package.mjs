import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, unzipSync } from '../vendor/fflate.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const version = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'))).version;
const output = path.join(root, 'dist'); fs.mkdirSync(output, { recursive: true });
const frontendFiles = ['manifest.json','index.js','style.css','batch-panel.js','batch-runtime.js','batch-tt.js','batch-engine.js','batch-adapters.js','scroll.js','storage.js','vendor/fflate.js','vendor/fflate-LICENSE','README.md','CREDITS.md','TT-COMPATIBILITY.md'];
const serverFiles = ['index.js','package.json','package-lock.json','batch-server.js','batch-engine.js','batch-adapters.js','png-encode.js'];
for (const file of ['batch-engine.js','batch-adapters.js']) fs.copyFileSync(path.join(root, file), path.join(root, 'server-plugin', file));
function pack(name, entries) {
    const bytes = zipSync(entries, { level: 6 }), filename = path.join(output, name);
    const checked = unzipSync(bytes);
    for (const [key, value] of Object.entries(entries)) {
        if (!Buffer.from(checked[key]).equals(Buffer.from(value))) throw Error(`ZIP mismatch: ${key}`);
    }
    fs.writeFileSync(filename, bytes); return { path: filename, files: Object.keys(entries).length, bytes: bytes.length };
}
const frontend = {};
for (const file of frontendFiles) frontend[`global-batch-replace/${file}`] = fs.readFileSync(path.join(root, file));
frontend['global-batch-replace/package.json'] = Buffer.from(JSON.stringify({ name: 'tavern-global-batch-replace-frontend', version, private: true, type: 'module' }, null, 2));
const full = {};
for (const [name, value] of Object.entries(frontend)) full[`data/default-user/extensions/${name}`] = value;
for (const file of serverFiles) full[`plugins/global-batch-replace/${file}`] = fs.readFileSync(path.join(root, 'server-plugin', file));
full['README.md'] = fs.readFileSync(path.join(root, 'README.md'));
const source = {};
function walk(dir, relative = '') {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules','dist','verification','.git','downloads'].includes(item.name)) continue;
        const file = path.join(dir, item.name), name = relative + item.name;
        if (item.isDirectory()) walk(file, name + '/'); else source[`global-batch-replace/${name}`] = fs.readFileSync(file);
    }
}
walk(root);
const result = [pack(`global-batch-replace-${version}-full.zip`, full), pack(`global-batch-replace-${version}-TT.zip`, frontend), pack(`global-batch-replace-${version}-source.zip`, source)];
fs.writeFileSync(path.join(output, 'packages.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
