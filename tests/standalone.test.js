import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Window } from 'happy-dom';
import { BatchService } from '../server-plugin/batch-server.js';
import { TtBatchService } from '../batch-tt.js';
import { compileRules, findMatches } from '../batch-engine.js';
import { BatchConfigStore } from '../storage.js';

globalThis.__GBR_TEST__ = true;
const { GlobalBatchApp, install } = await import('../index.js');
const rules = [{ find: '青石镇', replace: '青石镇' }, { find: '旅行者', replace: '旅行者' }];
function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gbr-standalone-'));
    fs.mkdirSync(path.join(root, 'worlds'));
    fs.writeFileSync(path.join(root, 'worlds/测试.json'), JSON.stringify({ entries: { 0: { content: '旅行者来到青石镇。旅行者休息。', key: ['青石镇'] } } }));
    const before = fs.readFileSync(path.join(root, 'worlds/测试.json'));
    t.after(() => { assert(path.resolve(root).startsWith(path.join(os.tmpdir(), 'gbr-standalone-'))); fs.rmSync(root, { recursive: true, force: true }); });
    return { root, before, service: new BatchService(root) };
}

test('identical find/replace strings are searchable only with explicit search-only compilation', () => {
    assert.equal(findMatches('青石镇旅行者', compileRules(rules)).length, 0);
    const compiled = compileRules(rules, { searchOnly: true });
    assert.equal(findMatches('青石镇旅行者旅行者', compiled).length, 3);
    assert.deepEqual(compiled.warnings, []);
});

test('PC search-only jobs expose previews and refuse apply before creating backups', async t => {
    const f = fixture(t), { id } = f.service.startScan({ rules, searchOnly: true, mode: 'global', scopes: ['world'] });
    await f.service.job(id).done;
    assert.equal(f.service.status(id).matches, 4);
    const file = f.service.status(id).files[0];
    assert.equal(f.service.preview(id, file.id).total, 4);
    assert.throws(() => f.service.apply({ id }), /仅查找.*禁止/);
    assert.deepEqual(fs.readFileSync(path.join(f.root, 'worlds/测试.json')), f.before);
    assert.equal(fs.existsSync(path.join(f.root, 'backups')), false);
    assert.throws(() => f.service.startScan({ rules, searchOnly: 'false', mode: 'global', scopes: ['world'] }), /选项无效/);
});

test('TT search-only jobs cannot save business data and use an independent namespace', async () => {
    const values = new Map(), writes = [], resource = { adapter: 'world', id: 'tt:world:sample', name: 'sample', relative: 'sample' };
    const key = o => `${o.namespace}/${o.table || 'main'}/${o.key}`;
    const store = {
        async tryGetJson(o) { return { found: values.has(key(o)), value: values.get(key(o)) }; },
        async getJson(o) { if (!values.has(key(o))) throw Error('missing'); return values.get(key(o)); },
        async setJson(o) { writes.push(o.namespace); values.set(key(o), structuredClone(o.value)); },
        async listKeys() { return []; }, async getBlob() { throw Error('unexpected blob'); }, async setBlob() { throw Error('unexpected blob'); },
    };
    const host = { __TAURITAVERN_HOST__: { kind: 'mobile' }, __TAURITAVERN__: { abiVersion: 2, api: { extension: { store } } } };
    const service = new TtBatchService({ host, context: () => ({}), fetcher: () => { throw Error('unexpected request'); } });
    await service.init();
    service.inventory = async () => ({ resources: [resource] });
    service.read = async () => ({ entries: { 0: { content: '青石镇旅行者' } } });
    service.write = async () => { throw Error('must never write'); };
    const { id } = await service.scan({ rules, searchOnly: true, mode: 'global', scopes: ['world'] });
    await service.job(id).done;
    assert.equal(service.status(id).matches, 2);
    await assert.rejects(service.apply({ id }), /仅查找.*禁止/);
    assert.deepEqual(writes, ['global-batch-replace']);
});

function dom(t) {
    const win = new Window({ url: 'http://localhost/' });
    win.document.body.innerHTML = '<div id="extensions_settings2"></div><div id="extensionsMenu"></div>';
    const prior = {};
    const Option = function (text, value) { const option = win.document.createElement('option'); option.textContent = text; option.value = value; return option; };
    for (const [name, value] of Object.entries({ window: win, document: win.document, Option })) {
        prior[name] = globalThis[name]; globalThis[name] = value;
    }
    t.after(async () => { await win.happyDOM.abort(); win.close(); for (const key of Object.keys(prior)) { if (prior[key] === undefined) delete globalThis[key]; else globalThis[key] = prior[key]; } });
    return win;
}

test('standalone entry opens without Writer Workbench and scans, previews, then applies an explicit replacement', async t => {
    const win = dom(t), f = fixture(t), account = new Map(), saved = new Map();
    const app = new GlobalBatchApp({ bridge: { context: () => ({ accountStorage: { getItem: key => account.get(key), setItem: (k, v) => account.set(k, v) } }) }, store: { get: async k => saved.get(k), set: async (k, v) => saved.set(k, structuredClone(v)) } });
    const batch = app.batch, calls = [];
    batch.api = async (name, body = {}) => {
        calls.push(name);
        if (name === 'inventory') return f.service.inventory();
        if (name === 'scan') return f.service.startScan(body);
        if (name === 'status') return f.service.status(body.id, body.filter);
        if (name === 'preview') return f.service.preview(body.id, body.fileId, body.offset, body.filter);
        if (name === 'apply') return f.service.apply(body);
        throw Error(name);
    };
    await app.open();
    assert(app.dialog.open); assert(batch.isSearchOnly());
    assert.deepEqual(calls, ['inventory']);
    assert.equal(batch.scopes().length, 0); assert.equal(batch.rules()[0].find, '');
    batch.$('[data-find]').value = '旅行者'; batch.$('[data-replace]').value = '旅人';
    batch.$('[data-batch-scope="world"]').checked = true; batch.$('[data-batch="mode"]').value = 'global';
    await batch.scan(); assert.equal(batch.snapshot.matches, 2);
    const details = batch.$('.gbr-batch-file'); await batch.loadPreview(details, 0);
    assert(batch.$('.gbr-batch-diff mark').textContent.includes('旅行者'));
    assert(batch.$('[data-batch-action="prepare"]').hidden);
    await assert.rejects(batch.action('apply', {}), /仅查找|先扫描/);
    assert.deepEqual(fs.readFileSync(path.join(f.root, 'worlds/测试.json')), f.before);
    batch.$('[data-batch="operation"]').value = 'replace';
    batch.$('[data-batch="operation"]').dispatchEvent(new win.Event('change', { bubbles: true }));
    assert.equal(batch.jobId, null); assert.equal(batch.$('[data-replace]').disabled, false);
    await batch.scan();
    await batch.action('prepare', {}); assert.equal(batch.$('.gbr-batch-confirm').hidden, false);
    let outcome;
    batch.reloadAfterWrite = async message => { outcome = message; batch.requiresReload = true; };
    await batch.action('apply', { disabled: false });
    assert.match(outcome, /已修改 1 个文件、2 处/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, 'worlds/测试.json'))).entries[0].content, '旅人来到青石镇。旅人休息。');
    assert.equal(f.service.backups().length, 1);
    assert(account.has('global-batch-replace-browser-key')); assert([...saved.keys()].every(k => k.startsWith('gbr:')));
});

test('entry is only in the wand menu even when the old wand preference was false', t => {
    dom(t); const original = globalThis.SillyTavern;
    globalThis.SillyTavern = { getContext: () => ({ accountStorage: { getItem: () => 'false' } }) };
    t.after(() => { if (original === undefined) delete globalThis.SillyTavern; else globalThis.SillyTavern = original; });
    install(); install();
    assert.equal(document.querySelectorAll('#global-batch-replace-settings').length, 0);
    assert.equal(document.querySelectorAll('#global-batch-replace-wand').length, 1);
    assert.equal(document.querySelectorAll('#writer-workbench-wand').length, 0);
});

test('each resource group filters independently without losing focus or hidden selections', async t => {
    const win = dom(t);
    const app = new GlobalBatchApp({ bridge: { context: () => ({ accountStorage: { getItem: () => 'test-account' } }) }, store: { get: async () => null, set: async () => {} } });
    const batch = app.batch;
    batch.api = async () => ({ resources: [], owners: [
        { id: 'card-a', type: 'character', label: '青石镇旅人' }, { id: 'card-b', type: 'character', label: '北地旅人' },
        { id: 'world-a', type: 'world', label: '青石镇百科' }, { id: 'world-b', type: 'world', label: '南方百科' },
    ] });
    await app.open(); batch.targets.add('card-b'); batch.renderOwners();
    const search = batch.$('[data-batch-group-search="character"]');
    search.focus(); search.value = '青'; search.dispatchEvent(new win.Event('input', { bubbles: true }));
    search.value = '青石'; search.dispatchEvent(new win.Event('input', { bubbles: true }));
    assert.equal(win.document.activeElement, search);
    const cardGroup = batch.$('[data-owner-type="character"]'), worldGroup = batch.$('[data-owner-type="world"]');
    assert.equal(cardGroup.querySelectorAll('[data-batch-owner]').length, 1);
    assert.equal(worldGroup.querySelectorAll('[data-batch-owner]').length, 2);
    await batch.action('select-targets', cardGroup.querySelector('[data-batch-action="select-targets"]'));
    assert.deepEqual([...batch.targets].sort(), ['card-a', 'card-b']);
    await batch.action('clear-targets', batch.$('[data-owner-type="character"] [data-batch-action="clear-targets"]'));
    assert.deepEqual([...batch.targets], ['card-b']);
    assert.equal(batch.$('[data-batch-group-search="character"]').value, '青石');
    const scopeSearch = batch.$('[data-batch="scope-search"]');
    batch.$('[data-batch-scope="persona"]').checked = true;
    scopeSearch.value = '世界书'; scopeSearch.dispatchEvent(new win.Event('input', { bubbles: true }));
    await batch.action('all-scopes', {});
    assert.deepEqual(batch.scopes().sort(), ['persona', 'world']);
    await batch.action('clear-scopes', {}); assert.deepEqual(batch.scopes(), ['persona']);
});

test('wand entry attaches when the host creates its menu after extension loading', async t => {
    const win = dom(t); win.document.getElementById('extensionsMenu').remove();
    install();
    const menu = win.document.createElement('div'); menu.id = 'extensionsMenu'; win.document.body.append(menu);
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(menu.querySelectorAll('#global-batch-replace-wand').length, 1);
    assert.equal(win.document.querySelectorAll('#global-batch-replace-settings').length, 0);
});

test('configuration persistence is separate and survives another instance', async () => {
    const cache = new Map(), legacy = () => ({ getItem: k => cache.get(k), setItem: (k, v) => cache.set(k, v), removeItem: k => cache.delete(k) });
    const store = new BatchConfigStore({ indexedDB: null, legacy });
    const settings = { rules, combinations: { 常用: rules } };
    await store.set('gbr:account-one:batch-config', settings);
    const next = new BatchConfigStore({ indexedDB: null, legacy });
    assert.deepEqual(await next.get('gbr:account-one:batch-config'), settings);
    assert.equal(await next.get('gbr:account-two:batch-config'), null);
});
