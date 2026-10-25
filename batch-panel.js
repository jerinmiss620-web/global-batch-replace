import { validateRules, previewSegments } from './batch-engine.js';
import { BATCH_SCOPES } from './batch-adapters.js';
import { revealInPanel } from './scroll.js';
import { createBatchClient } from './batch-runtime.js';

const node = (tag, text = '', className = '') => { const el = document.createElement(tag); el.textContent = text; el.className = className; return el; };
const button = (text, action) => { const el = node('button', text, 'menu_button'); el.type = 'button'; el.dataset.batchAction = action; return el; };
export const TARGET_TYPES = { character: '角色卡', world: '独立世界书', persona: 'User Persona', chat: '聊天记录', preset: '预设', prompt: '提示词条目', file: '指定文本文件' };
export function visibleTargets(owners, query = '') {
    const search = query.trim().toLocaleLowerCase();
    return owners.filter(owner => `${TARGET_TYPES[owner.type] || owner.type} ${owner.label}`.toLocaleLowerCase().includes(search));
}
export function selectTargetGroup(targets, owners, type, selected, query = '') {
    const next = new Set(targets);
    for (const owner of visibleTargets(owners, query).filter(owner => owner.type === type)) selected ? next.add(owner.id) : next.delete(owner.id);
    return next;
}

export class BatchPanel {
    constructor(app) {
        this.app = app; this.excludedFiles = new Set(); this.excludedMatches = new Set(); this.combinations = {}; this.groupQueries = new Map();
        this.panel = node('section', '', 'gbr-batch'); this.panel.hidden = true;
        this.panel.innerHTML = `<p>扫描已经保存的资料。请先保存原编辑器中的修改；执行替换时暂停其他标签页和设备的编辑。</p>
          <div class="gbr-row"><label>操作 <select data-batch="operation"><option value="search">仅查找（不修改资料）</option><option value="replace">查找并批量替换</option></select></label><small class="gbr-operation-hint">查找支持多条普通文本关键词，区分大小写；替换使用原文一次匹配，不连续改写新内容。</small></div>
          <div class="gbr-batch-column-labels" aria-hidden="true"><span>查找内容</span><span>替换为（留空表示删除）</span><span></span></div><div class="gbr-batch-rules" aria-label="替换规则"></div>
          <div class="gbr-row"><button type="button" data-batch-action="add">＋ 添加规则</button><input class="text_pole" data-batch="combo-name" aria-label="规则组合名称" placeholder="常用规则组合名称"><button type="button" data-batch-action="save-combo">保存组合</button><select data-batch="combos" aria-label="已保存的规则组合"><option value="">选择常用规则</option></select><button type="button" data-batch-action="load-combo">载入</button><button type="button" data-batch-action="delete-combo">删除组合</button></div>
          <fieldset><legend>作用范围</legend><input class="text_pole" data-batch="scope-search" type="search" aria-label="搜索作用范围" placeholder="搜索作用范围"><div class="gbr-batch-scopes"></div><div class="gbr-row"><button type="button" data-batch-action="all-scopes">全选</button><button type="button" data-batch-action="clear-scopes">清空选择</button></div></fieldset>
          <div class="gbr-row"><label>模式 <select data-batch="mode"><option value="local">局部：只处理下面勾选的资源</option><option value="global">全局：所选范围内的全部资源</option></select></label><button type="button" data-batch-action="refresh">刷新资源列表</button></div>
          <details class="gbr-batch-targets" open><summary>选择角色卡、世界书及其他资源</summary><p class="gbr-batch-target-summary" role="status"></p><input class="text_pole" data-batch="target-search" type="search" aria-label="筛选局部资源" placeholder="输入名称、文件名或头像 ID 筛选"><div class="gbr-batch-owner-list"></div><small>勾选资源会切换到局部模式，仅处理所选资源中已勾选的作用范围。角色卡内嵌世界书归所属角色卡；勾选聊天范围时，所选角色的全部聊天分支也会纳入。同名 Persona 按头像 ID 区分。</small><label>指定 JSON / YAML 文件允许修改的字段路径（JSON 数组）<textarea class="text_pole" data-batch="paths" rows="2" placeholder='[["content"],["entries","0","content"]]'></textarea></label><small>其他文件仅列出用户数据目录 user/files 中的 UTF-8 TXT、JSON、YAML。JSON / YAML 必须明确字段路径，不递归替换未知数据。</small></details>
          <div class="gbr-row"><button type="button" data-batch-action="scan">扫描匹配</button><button type="button" data-batch-action="cancel" hidden>取消扫描</button><button type="button" data-batch-action="backups">查看备份与恢复</button></div>
          <p class="gbr-batch-status" role="status" aria-live="polite"></p><div class="gbr-batch-stats"></div><details class="gbr-batch-skipped" hidden><summary>无法处理 / 已跳过的文件</summary><ul></ul></details>
          <div class="gbr-batch-result-tools" hidden><div class="gbr-row"><input class="text_pole" data-batch="search" type="search" aria-label="搜索扫描结果" placeholder="搜索文件、身份、字段或命中文本"><select data-batch="rule" aria-label="按规则筛选"><option value="">全部规则</option></select><select data-batch="scope" aria-label="按作用范围筛选"><option value="">全部范围</option></select><button type="button" data-batch-action="select-files">选中所有命中文件</button><button type="button" data-batch-action="unselect-files">取消所有文件</button></div></div>
          <div class="gbr-batch-results"></div>
          <div class="gbr-row"><button type="button" data-batch-action="prepare" disabled>执行替换…</button><span class="gbr-batch-selected"></span></div>
          <section class="gbr-batch-confirm" hidden role="alertdialog" aria-label="确认批量替换"><h3>确认本次修改</h3><p></p><small>系统会先备份所有待改文件，再校验和写入；成功后需要重新载入酒馆，刷新内存中的身份、预设和聊天。请暂停其他标签页或设备的编辑。</small><div class="gbr-row"><button type="button" data-batch-action="apply">确认备份并执行</button><button type="button" data-batch-action="dismiss">返回检查</button></div></section>
          <section class="gbr-batch-backups" hidden><div class="gbr-row"><h3>本地备份</h3><button type="button" data-batch-action="hide-backups">收起</button></div><small>备份保存在当前用户 backups/global-batch-replace 下。下载的 ZIP 含原文件和校验清单；恢复会检查修改后是否又有新变化。</small><div class="gbr-batch-backup-list"></div></section>`;
        this.panel.querySelectorAll('button').forEach(b => b.classList.add('menu_button'));
        this.$ = selector => this.panel.querySelector(selector);
        app.$('.gbr-main').prepend(this.panel);
        for (const [scope, text] of Object.entries(BATCH_SCOPES)) {
            const label = node('label'), input = document.createElement('input'); input.type = 'checkbox'; input.value = scope; input.dataset.batchScope = scope;
            label.append(input, document.createTextNode(` ${text}`)); this.$('.gbr-batch-scopes').append(label);
        }
        this.panel.addEventListener('click', event => {
            const action = event.target.closest('[data-batch-action]');
            if (!action) return; event.preventDefault(); event.stopPropagation();
            this.action(action.dataset.batchAction, action).catch(error => this.message(error.message, true));
        });
        this.panel.addEventListener('input', event => {
            if (event.target.matches('[data-batch="search"],[data-batch="rule"],[data-batch="scope"]')) { this.scheduleFilter(); return; }
            if (event.target.matches('[data-batch="target-search"]')) { this.renderOwners(); return; }
            if (event.target.matches('[data-batch="scope-search"]')) { this.filterScopes(); return; }
            if (event.target.matches('[data-batch-group-search]')) {
                const type = event.target.dataset.batchGroupSearch;
                this.groupQueries.set(type, event.target.value);
                this.renderTargetGroup(event.target.closest('.gbr-batch-target-group'), type); return;
            }
            if (event.target.closest('.gbr-batch-rules') || event.target.matches('[data-batch-scope],[data-batch-owner],[data-batch="mode"],[data-batch="paths"],[data-batch="operation"]')) { this.invalidate(); this.syncCustomFields(); this.persist(); }
        });
        this.panel.addEventListener('change', event => {
            const el = event.target;
            if (el.dataset.batchOwner) { el.checked ? this.targets.add(el.value) : this.targets.delete(el.value); this.$('[data-batch="mode"]').value = 'local'; this.invalidate(); this.renderOwners(); this.persist(); }
            if (el.matches('[data-batch="mode"]')) this.renderOwners();
            if (el.matches('[data-batch="operation"]')) { this.invalidate(); this.syncOperation(); this.persist(); }
            if (el.dataset.batchFile) { el.checked ? this.excludedFiles.delete(el.value) : this.excludedFiles.add(el.value); this.updateSelection(); }
            if (el.dataset.batchMatch) { el.checked ? this.excludedMatches.delete(el.value) : this.excludedMatches.add(el.value); this.updateSelection(); }
            if (el.matches('[data-batch="rule"],[data-batch="scope"]')) this.scheduleFilter();
        });
        this.targets = new Set();
    }
    key() { return `gbr:${this.app.namespace}:batch-config`; }
    isSearchOnly() { return this.$('[data-batch="operation"]').value === 'search'; }
    syncCustomFields() {
        const label = this.$('[data-batch="paths"]').closest('label'), hidden = !this.scopes().includes('other');
        label.hidden = hidden; label.nextElementSibling.hidden = hidden;
    }
    effectiveRules() { return this.rules().map(rule => this.isSearchOnly() ? { find: rule.find, replace: rule.find } : rule); }
    syncOperation() {
        const search = this.isSearchOnly();
        this.panel.classList.toggle('gbr-search-only', search);
        this.panel.querySelectorAll('[data-replace]').forEach(input => { input.disabled = search || !!this.scanning; });
        this.$('[data-batch-action="scan"]').textContent = search ? '查找全部匹配' : '扫描替换预览';
        this.$('[data-batch-action="prepare"]').hidden = search;
        this.$('.gbr-batch-column-labels span:nth-child(2)').textContent = search ? '替换内容（仅查找时不使用）' : '替换为（留空表示删除）';
    }
    rules() { return [...this.panel.querySelectorAll('.gbr-batch-rule')].map(row => ({ find: row.querySelector('[data-find]').value, replace: row.querySelector('[data-replace]').value })); }
    scopes() { return [...this.panel.querySelectorAll('[data-batch-scope]:checked')].map(x => x.value).filter(scope => !this.inventory?.supportedScopes || this.inventory.supportedScopes.includes(scope)); }
    filterScopes() {
        const query = this.$('[data-batch="scope-search"]').value.trim().toLocaleLowerCase();
        this.panel.querySelectorAll('[data-batch-scope]').forEach(input => {
            const label = input.closest('label'); label.hidden = !`${label.textContent} ${input.value}`.toLocaleLowerCase().includes(query);
        });
        this.$('[data-batch-action="all-scopes"]').textContent = query ? '全选筛选结果' : '全选';
        this.$('[data-batch-action="clear-scopes"]').textContent = query ? '清空筛选结果' : '清空选择';
    }
    syncScopeCapabilities() {
        if (!this.inventory?.supportedScopes) return;
        this.panel.querySelectorAll('[data-batch-scope]').forEach(input => {
            if (!this.inventory.supportedScopes.includes(input.value)) { input.disabled = true; input.checked = false; input.title = '当前 TT 适配暂未开放此范围'; }
        });
        this.$('[data-batch-action="scan"]').disabled = !!this.inventory.datasetBinding || !!this.scanning || !!this.operation;
        this.$('[data-batch-action="backups"]').disabled = !!this.inventory.datasetBinding || !!this.scanning || !!this.operation;
    }
    renderDatasetBinding() {
        this.$('.gbr-batch-dataset')?.remove();
        const binding = this.inventory?.datasetBinding; if (!binding) return;
        const area = node('fieldset', '', 'gbr-batch-dataset');
        area.append(node('legend', '导入／迁移后的资料集登记'), node('p', `当前 TT 目录：${binding.currentRoot}`), node('p', `导入包记录的旧目录：${binding.previousRoot}`));
        area.append(node('p', '确认当前目录就是本次导入后要使用的资料。登记会建立新的资料集标记，保留旧备份并隔离其恢复入口；不会替换、删除或恢复业务资料。之后请重新勾选资源并扫描。'));
        area.append(button('确认将当前导入资料登记为新资料集', 'register-dataset'));
        this.panel.querySelector(':scope > p').after(area);
    }
    async persist() {
        try { await this.app.store.set(this.key(), { operation: this.isSearchOnly() ? 'search' : 'replace', rules: this.rules(), scopes: this.scopes(), mode: this.$('[data-batch="mode"]').value, targets: [...this.targets], paths: this.$('[data-batch="paths"]').value, combinations: this.combinations }); return true; }
        catch { this.message('本地规则保存失败，请保留输入后再关闭。', true); return false; }
    }
    addRule(rule = { find: '', replace: '' }) {
        if (this.rules().length >= 200) throw Error('最多 200 条规则。');
        const row = node('div', '', 'gbr-batch-rule'), find = node('input', '', 'text_pole'), replace = node('input', '', 'text_pole');
        find.dataset.find = ''; find.value = rule.find; find.setAttribute('aria-label', '查找内容'); find.placeholder = '查找内容（普通文本）';
        replace.dataset.replace = ''; replace.value = rule.replace; replace.setAttribute('aria-label', '替换内容'); replace.placeholder = '替换为（留空表示删除）';
        replace.disabled = this.$('[data-batch="operation"]')?.value !== 'replace';
        row.append(find, replace, button('删除', 'remove-rule')); this.$('.gbr-batch-rules').append(row);
    }
    invalidate() {
        if (this.scanning) return;
        this.jobId = null; this.snapshot = null; this.$('[data-batch-action="prepare"]').disabled = true;
        this.$('.gbr-batch-confirm').hidden = true; this.$('.gbr-batch-results').replaceChildren(); this.$('.gbr-batch-stats').replaceChildren();
        this.$('.gbr-batch-result-tools').hidden = true; this.$('.gbr-batch-selected').textContent = '';
    }
    message(text, error = false) { this.$('.gbr-batch-status').textContent = text; this.$('.gbr-batch-status').classList.toggle('gbr-error', error); }
    async api(name, body = {}) {
        this.clientPromise ||= createBatchClient(this.app.bridge).catch(error => { this.clientPromise = null; throw error; });
        this.client = await this.clientPromise;
        return this.client.call(name, body);
    }
    async open() {
        if (!this.loaded) {
            const saved = await this.app.store.get(this.key()) || {};
            for (const r of (saved.rules?.length ? saved.rules : [{ find: '', replace: '' }])) this.addRule(r);
            this.panel.querySelectorAll('[data-batch-scope]').forEach(el => { el.checked = (saved.scopes || []).includes(el.value); });
            this.$('[data-batch="operation"]').value = saved.operation === 'replace' ? 'replace' : 'search';
            this.$('[data-batch="mode"]').value = saved.mode === 'global' ? 'global' : 'local'; this.targets = new Set(saved.targets || []);
            this.$('[data-batch="paths"]').value = saved.paths || ''; this.combinations = saved.combinations || {}; this.renderCombinations(); this.loaded = true;
        }
        this.syncOperation(); this.syncCustomFields();
        this.panel.hidden = false; this.app.dialog.classList.add('gbr-batch-mode'); this.app.$('.gbr-footer').hidden = true;
        revealInPanel(this.app, this.panel);
        if (!this.inventory) await this.refresh();
    }
    close() {
        if (this.panel.hidden) return;
        this.persist(); this.app.close();
    }
    async refresh() {
        this.message('正在读取资源列表…'); this.inventory = await this.api('inventory'); this.renderOwners();
        if (this.inventory.supportedScopes) {
            this.syncScopeCapabilities();
            this.$('.gbr-batch-backups>small').textContent = `备份保存在${this.inventory.backupLocation}；可下载 ZIP 或导入本扩展导出的 TT 备份。恢复将检查修改后是否又有新变化。`;
            this.panel.querySelector(':scope > p').textContent = `当前宿主：TauriTavern。通过当前 TT 原生接口读取和保存，不使用 SillyTavern 服务端插件。${this.inventory.warning}`;
            this.$('[data-batch="paths"]').closest('label').hidden = true;
            this.$('[data-batch="paths"]').closest('label').nextElementSibling.hidden = true;
            this.$('.gbr-batch-confirm>small').textContent = '先保存并复读校验全部原文、预期结果及角色／身份原始 PNG，再逐项保存并校验；失败停止并尝试恢复已提交项。不是跨资源原子事务。执行期间暂停其他编辑与同步，结束后自动重新载入。';
            this.$('.gbr-batch-targets>small').textContent = 'TT 中角色卡内保存的世界书与独立世界书分别勾选。TT 导出卡时会用绑定的独立世界书重新生成内嵌内容；要替换该绑定书中实际生效的内容，也请勾选对应的独立世界书。勾选聊天范围时，所选角色的全部聊天分支一并纳入。同名 Persona 按头像 ID 区分。';
            if (!this.$('[data-batch-action="import-tt-backup"]')) {
                const input = node('input'); input.type = 'file'; input.accept = '.zip,application/zip'; input.hidden = true;
                const launch = button('导入 TT 批量替换备份 ZIP', 'import-tt-backup');
                launch.addEventListener('click', () => input.click());
                input.addEventListener('change', async () => {
                    const file = input.files?.[0]; if (!file) return;
                    try { const result = await this.client.importBackup(file); this.message(`已校验并导入备份 ${result.id}，尚未恢复业务资料。`); await this.backups(); }
                    catch (error) { this.message(error.message, true); }
                    finally { input.value = ''; }
                });
                this.$('.gbr-batch-backups>.gbr-row').append(launch, input);
            }
        }
        this.renderDatasetBinding();
        if (this.inventory.datasetBinding) { this.message('导入资料的目录标记与当前 TT 不同。请核对上方目录并登记，尚未扫描或修改资料。', true); return; }
        this.message(`已识别 ${this.inventory.resources.length} 个文件。请选择规则和范围后扫描。`);
    }
    renderOwners() {
        if (!this.inventory) return;
        const mode = this.$('[data-batch="mode"]').value;
        if (this.renderedMode !== mode) { this.$('.gbr-batch-targets').open = mode === 'local'; this.renderedMode = mode; }
        const list = this.$('.gbr-batch-owner-list'); list.replaceChildren();
        const owners = this.targetOwners();
        const selected = owners.filter(owner => this.targets.has(owner.id)).length;
        this.$('.gbr-batch-target-summary').textContent = this.$('[data-batch="mode"]').value === 'local'
            ? `局部模式：已勾选 ${selected} 项资源。搜索不会取消已勾选的资源；未勾选的角色卡和世界书不会修改。`
            : '全局模式：处理所选作用范围内的全部资源。下方局部勾选不限制全局扫描；勾选任一资源即可切回局部模式。';
        for (const [type, title] of Object.entries(TARGET_TYPES)) {
            const all = owners.filter(owner => owner.type === type);
            if (!all.length) continue;
            const group = node('section', '', 'gbr-batch-target-group'); group.dataset.ownerType = type;
            const tools = node('div', '', 'gbr-row');
            tools.append(node('strong', '', 'gbr-batch-group-count'));
            for (const [action, text] of [['select-targets', '全选本组'], ['clear-targets', '清空本组']]) {
                const control = button(text, action); control.dataset.ownerType = type; tools.append(control);
            }
            const search = node('input', '', 'text_pole gbr-batch-group-search'); search.type = 'search'; search.dataset.batchGroupSearch = type;
            search.value = this.groupQueries.get(type) || ''; search.placeholder = `搜索${title}名称、文件名或 ID`; search.setAttribute('aria-label', `搜索${title}`);
            group.append(tools, search, node('div', '', 'gbr-batch-target-items')); list.append(group); this.renderTargetGroup(group, type);
        }
    }
    groupOwners(type) {
        const all = this.targetOwners().filter(owner => owner.type === type);
        return visibleTargets(visibleTargets(all, this.$('[data-batch="target-search"]').value), this.groupQueries.get(type) || '');
    }
    renderTargetGroup(group, type) {
        const all = this.targetOwners().filter(owner => owner.type === type), matches = this.groupOwners(type);
        const filtered = !!(this.$('[data-batch="target-search"]').value.trim() || this.groupQueries.get(type)?.trim());
        group.querySelector('.gbr-batch-group-count').textContent = `${TARGET_TYPES[type]}：已选 ${all.filter(owner => this.targets.has(owner.id)).length} / ${all.length} · 显示 ${matches.length}`;
        for (const action of ['select-targets', 'clear-targets']) {
            const control = group.querySelector(`[data-batch-action="${action}"]`);
            control.disabled = !matches.length;
            control.textContent = action === 'select-targets' ? (filtered ? '全选筛选结果' : '全选本组') : (filtered ? '清空筛选结果' : '清空本组');
        }
        const items = group.querySelector('.gbr-batch-target-items'); items.replaceChildren();
        for (const owner of matches) {
            const label = node('label'), checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = owner.id; checkbox.dataset.batchOwner = owner.id; checkbox.checked = this.targets.has(owner.id);
            label.append(checkbox, document.createTextNode(` ${owner.label}`)); items.append(label);
        }
        if (!matches.length) items.append(node('small', '没有匹配的资源。'));
    }
    targetOwners() {
        return [...this.inventory.owners, ...this.inventory.resources.filter(r => ['text', 'custom-json'].includes(r.adapter)).map(r => ({ id: r.id, type: 'file', label: r.relative }))];
    }
    renderCombinations() {
        const select = this.$('[data-batch="combos"]'); select.replaceChildren(new Option('选择常用规则', ''), ...Object.keys(this.combinations).map(name => new Option(name, name)));
    }
    lockScanning(active) {
        this.scanning = active;
        for (const el of this.panel.querySelectorAll('input,select,textarea,button')) {
            if (active) { el.dataset.wasDisabled = String(el.disabled); el.disabled = !['cancel', 'close'].includes(el.dataset.batchAction); }
            else { el.disabled = el.dataset.wasDisabled === 'true'; delete el.dataset.wasDisabled; }
        }
        this.$('[data-batch-action="cancel"]').hidden = !active;
    }
    async scan() {
        if (this.scanning) return;
        const searchOnly = this.isSearchOnly(), { rules, warnings } = validateRules(this.effectiveRules(), { searchOnly }), scopes = this.scopes();
        if (!scopes.length) throw Error('请至少勾选一个作用范围。');
        if (!this.inventory) await this.refresh();
        if (this.$('[data-batch="mode"]').value === 'local' && !this.targetOwners().some(owner => this.targets.has(owner.id))) throw Error('请先勾选要修改的角色卡、世界书或其他具体资源。');
        const fileIds = [...this.targets].filter(id => this.inventory.resources.some(r => r.id === id));
        const customPaths = {}, custom = this.inventory.resources.filter(r => r.adapter === 'custom-json' && fileIds.includes(r.id));
        if (custom.length && scopes.includes('other')) { const paths = JSON.parse(this.$('[data-batch="paths"]').value || 'null'); if (!Array.isArray(paths)) throw Error('请填写 JSON / YAML 允许修改的字段路径。'); for (const r of custom) customPaths[r.id] = paths; }
        this.invalidate(); await this.persist(); this.excludedFiles.clear(); this.excludedMatches.clear(); this.cancelRequested = false; this.lockScanning(true);
        try {
            const job = await this.api('scan', { rules, searchOnly, scopes, mode: this.$('[data-batch="mode"]').value, fileIds, ownerIds: [...this.targets], customPaths });
            this.jobId = job.id;
            if (this.cancelRequested) await this.api('cancel', { id: job.id });
            for (;;) {
                const snapshot = await this.api('status', { id: job.id }); this.snapshot = snapshot; this.scanRules = rules; this.searchOnlyJob = searchOnly;
                this.message(`已扫描 ${snapshot.scanned} / ${snapshot.total} 个文件，命中 ${snapshot.files.length} 个文件、${snapshot.matches} 处。${warnings.join(' ')}`);
                if (snapshot.status !== 'scanning') {
                    if (snapshot.status !== 'ready') throw Error(snapshot.error || '扫描已取消，未修改文件。');
                    this.renderResults(); break;
                }
                await new Promise(resolve => setTimeout(resolve, 400));
            }
        } finally { this.lockScanning(false); this.updateSelection(); }
    }
    renderResults() {
        const s = this.snapshot, stats = this.$('.gbr-batch-stats'); stats.replaceChildren();
        const rules = this.scanRules || this.effectiveRules();
        rules.forEach((r, i) => stats.append(node('div', this.searchOnlyJob ? `${r.find}：${s.counts[i]} 处` : `${r.find} → ${r.replace || '（删除）'}：${s.counts[i]} 处`)));
        for (const [scope, count] of Object.entries(s.scopeCounts)) stats.append(node('div', `${BATCH_SCOPES[scope]}：${count} 处`));
        for (const text of s.warnings) stats.append(node('p', text));
        const skipped = this.$('.gbr-batch-skipped'); skipped.hidden = !s.skipped.length;
        skipped.querySelector('ul').replaceChildren(...s.skipped.map(x => node('li', `${x.path}：${x.error}`)));
        this.$('[data-batch="rule"]').replaceChildren(new Option('全部规则', ''), ...rules.map((r, i) => new Option(`${i + 1} · ${r.find}`, String(i))));
        this.$('[data-batch="scope"]').replaceChildren(new Option('全部范围', ''), ...Object.keys(s.scopeCounts).map(scope => new Option(BATCH_SCOPES[scope], scope)));
        this.$('.gbr-batch-result-tools').hidden = false;
        const results = this.$('.gbr-batch-results'); results.replaceChildren();
        for (const file of s.files) {
            const details = node('details', '', 'gbr-batch-file'); details.dataset.fileId = file.id;
            const summary = node('summary'), check = document.createElement('input'); check.type = 'checkbox'; check.checked = !this.excludedFiles.has(file.id); check.value = file.id; check.dataset.batchFile = file.id;
            check.addEventListener('click', e => e.stopPropagation());
            summary.append(check, document.createTextNode(` ${file.path} · ${file.count} 处 · ${file.scopes.map(k => BATCH_SCOPES[k]).join('、')}`));
            const rows = node('div', '', 'gbr-batch-matches'); details.append(summary, rows);
            details.addEventListener('toggle', () => { if (details.open && !details.dataset.loaded) this.loadPreview(details, 0).catch(e => this.message(e.message, true)); });
            results.append(details);
        }
        this.filterKey = ''; this.scheduleFilter(); this.updateSelection();
    }
    async loadPreview(details, offset) {
        const request = String((Number(details.dataset.request) || 0) + 1); details.dataset.request = request;
        const id = this.jobId, filter = this.filter(), key = JSON.stringify(filter), data = await this.api('preview', { id, fileId: details.dataset.fileId, offset, filter });
        if (id !== this.jobId || key !== JSON.stringify(this.filter()) || details.dataset.request !== request) return;
        details.querySelector('[data-batch-action="more"]')?.remove();
        const container = details.querySelector('.gbr-batch-matches');
        if (!offset) container.replaceChildren();
        for (const row of data.rows) {
            const item = node('div', '', 'gbr-batch-match'); item.dataset.rule = row.rule; item.dataset.scope = row.scope;
            const label = node('label'), input = document.createElement('input'); input.type = 'checkbox'; input.checked = !this.excludedMatches.has(row.id); input.value = row.id; input.dataset.batchMatch = row.id;
            label.append(input, document.createTextNode(` ${row.label} · ${row.field} · 位置 ${row.start + 1}${row.aliases.length ? `（同步 ${row.aliases.join('、')}）` : ''}`)); item.append(label);
            item.preview = row; item.fileId = details.dataset.fileId;
            item.append(node('div', '', 'gbr-batch-diff'), node('div', '', 'gbr-batch-diff'));
            this.renderDiff(item);
            container.append(item);
        }
        details.dataset.loaded = 'true';
        if (offset + data.rows.length < data.total) { const more = button('加载后续匹配', 'more'); more.dataset.offset = offset + data.rows.length; container.append(more); }
    }
    filter() { return { query: this.$('[data-batch="search"]').value.trim(), rule: this.$('[data-batch="rule"]').value, scope: this.$('[data-batch="scope"]').value }; }
    scheduleFilter() {
        clearTimeout(this.filterTimer); this.filterTimer = setTimeout(() => this.filterResults().catch(e => this.message(e.message, true)), 180);
    }
    async filterResults() {
        if (!this.snapshot || !this.jobId) return;
        const id = this.jobId, filter = this.filter(), key = JSON.stringify(filter);
        if (key === this.filterKey) return;
        this.filterKey = key;
        const status = await this.api('status', { id, filter });
        if (id !== this.jobId || key !== JSON.stringify(this.filter())) return;
        for (const details of this.panel.querySelectorAll('.gbr-batch-file')) {
            const file = status.files.find(f => f.id === details.dataset.fileId); details.hidden = !file?.visible;
            details.querySelector('.gbr-batch-matches').replaceChildren(); delete details.dataset.loaded;
            if (details.open && !details.hidden) await this.loadPreview(details, 0);
        }
    }
    updateSelection() {
        const files = (this.snapshot?.files || []).filter(f => !this.excludedFiles.has(f.id));
        const selected = files.map(f => ({ ...f, selected: f.count - [...this.excludedMatches].filter(id => id.startsWith(`${f.id}:`)).length })).filter(f => f.selected > 0);
        const count = selected.reduce((n, f) => n + f.selected, 0);
        this.$('.gbr-batch-selected').textContent = `已选 ${selected.length} 个文件、${count} 处${this.searchOnlyJob ? '匹配（仅查找，不修改）' : '修改'}。隐藏的筛选结果仍保持原有勾选状态。`;
        this.$('[data-batch-action="prepare"]').disabled = this.isSearchOnly() || this.searchOnlyJob || this.scanning || this.snapshot?.status !== 'ready' || count <= 0;
        this.selection = { files: selected.length, count };
        this.panel.querySelectorAll('.gbr-batch-match').forEach(item => this.renderDiff(item));
    }
    renderDiff(item) {
        const row = item.preview, excluded = this.excludedFiles.has(item.fileId) ? new Set(row.context.matches.map(m => m.id)) : this.excludedMatches;
        const preview = previewSegments(row.context, row.id, this.scanRules || this.effectiveRules(), excluded), lines = item.querySelectorAll('.gbr-batch-diff');
        if (this.searchOnlyJob) {
            lines[0].replaceChildren(node('b', '命中：'), document.createTextNode(preview.prefix), node('mark', preview.before), document.createTextNode(preview.suffix));
            lines[1].hidden = true; return;
        }
        const selected = !excluded.has(row.id);
        for (const [i, side] of ['before', 'after'].entries()) {
            const mark = node(selected ? (i ? 'ins' : 'del') : 'span', preview[side] || (i ? '（删除）' : ''));
            lines[i].replaceChildren(node('b', i ? '改后：' : '原文：'), document.createTextNode(preview[i ? 'afterPrefix' : 'prefix']), mark, document.createTextNode(preview[i ? 'afterSuffix' : 'suffix']));
        }
    }
    checkWriting() {
        const ctx = this.app.bridge.context();
        if (ctx.isGenerating || ctx.streamingProcessor) throw Error('请先等待当前回复生成结束。');
        if (this.requiresReload) throw Error('请先重新载入酒馆。');
    }
    async backups() {
        const backups = await this.api('backups'), list = this.$('.gbr-batch-backup-list'); list.replaceChildren();
        const states = { preparing: '备份中', prepared: '备份已就绪', pending: '尚未提交', committing: '提交中', committed: '已修改', complete: '已完成', 'needs-attention': '需要检查恢复', aborted: '执行中止，已恢复', restored: '已恢复', restoring: '恢复中', unchanged: '原文未改', conflict: '存在新变化', 'partially-restored': '部分恢复，保留冲突', unreadable: '清单无法读取', foreign: '迁移前／其他资料集，仅可下载' };
        for (const backup of backups) {
            const item = node('details'), summary = node('summary', `${backup.created ? new Date(backup.created).toLocaleString('zh-CN') : backup.id} · ${states[backup.status] || backup.status} · ${backup.files?.length || 0} 个文件`); item.append(summary);
            item.append(node('p', backup.id));
            for (const file of backup.files || []) item.append(node('div', `${file.path} · ${states[file.state] || file.state}`));
            if (backup.error) item.append(node('p', backup.error));
            if (backup.status !== 'unreadable') {
                if (backup.status !== 'foreign') { const restore = button('恢复此备份…', 'restore'); restore.dataset.id = backup.id; item.append(restore); }
                const download = button('下载完整备份 ZIP', 'download'); download.dataset.id = backup.id; item.append(download);
            }
            list.append(item);
        }
        if (!backups.length) list.append(node('p', '尚无批量替换备份。'));
        this.$('.gbr-batch-backups').hidden = false; revealInPanel(this.app, this.$('.gbr-batch-backups'));
    }
    async reloadAfterWrite(message) {
        this.requiresReload = true; this.message(`${message} 即将自动重新载入。`);
        this.panel.querySelectorAll('button,input,select,textarea').forEach(el => { el.disabled = true; });
        const reload = button('重新载入酒馆', 'reload'); reload.disabled = false; this.$('.gbr-batch-status').append(document.createTextNode(' '), reload);
        await this.persist();
        this.app.dialog.querySelectorAll('button,input,select,textarea').forEach(el => { if (!this.panel.contains(el)) el.disabled = true; });
        setTimeout(() => window.location.reload(), 1800);
    }
    async action(action, control) {
        if (this.operation && !['reload'].includes(action)) return;
        if (action === 'reload') { window.location.reload(); return; }
        if (action === 'close') { this.close(); return; }
        if (action === 'cancel') { this.cancelRequested = true; if (this.jobId) await this.api('cancel', { id: this.jobId }); return; }
        if (this.scanning) return;
        if (action === 'register-dataset') {
            const binding = this.inventory?.datasetBinding; if (!binding) throw Error('资料集状态已改变，请刷新列表。');
            this.operation = true; control.disabled = true;
            try {
                await this.api('register-dataset', { confirm: true, previousId: binding.previousId, root: binding.currentRoot });
                this.targets.clear(); this.$('[data-batch="mode"]').value = 'local'; this.invalidate(); await this.persist(); await this.refresh();
                this.message(`当前导入资料已登记，已识别 ${this.inventory.resources.length} 份资源。旧备份保留且隔离，尚未替换业务资料。请重新选择资源并扫描。`);
            } finally { this.operation = false; control.disabled = false; this.syncScopeCapabilities(); }
            return;
        }
        if (action === 'add') { this.addRule(); this.invalidate(); await this.persist(); }
        if (action === 'remove-rule') { control.closest('.gbr-batch-rule').remove(); this.invalidate(); await this.persist(); }
        if (action === 'save-combo') { const name = this.$('[data-batch="combo-name"]').value.trim(); if (!name || ['__proto__', 'prototype', 'constructor'].includes(name)) throw Error('请填写有效组合名称。'); validateRules(this.effectiveRules(), { searchOnly: this.isSearchOnly() }); this.combinations[name] = this.rules(); if (!await this.persist()) throw Error('组合未能保存到本地，请保留规则输入后重试。'); this.renderCombinations(); this.message('规则组合已保存。'); }
        if (action === 'load-combo' || action === 'delete-combo') {
            const name = this.$('[data-batch="combos"]').value; if (!Object.hasOwn(this.combinations, name)) throw Error('请先选择组合。');
            if (action === 'load-combo') { this.$('.gbr-batch-rules').replaceChildren(); this.combinations[name].forEach(r => this.addRule(r)); this.invalidate(); }
            else { delete this.combinations[name]; this.renderCombinations(); } await this.persist();
        }
        if (action === 'all-scopes' || action === 'clear-scopes') {
            const filtered = !!this.$('[data-batch="scope-search"]')?.value?.trim();
            this.panel.querySelectorAll('[data-batch-scope]').forEach(el => {
                if (filtered && el.closest('label').hidden) return;
                el.checked = action === 'all-scopes' && !el.disabled && (!this.inventory?.supportedScopes || this.inventory.supportedScopes.includes(el.value));
            }); this.invalidate(); this.syncCustomFields(); await this.persist();
        }
        if (action === 'select-targets' || action === 'clear-targets') {
            this.targets = selectTargetGroup(this.targets, this.groupOwners(control.dataset.ownerType), control.dataset.ownerType, action === 'select-targets');
            this.$('[data-batch="mode"]').value = 'local'; this.invalidate(); this.renderOwners(); await this.persist();
        }
        if (action === 'refresh') { this.invalidate(); await this.refresh(); }
        if (action === 'scan') await this.scan();
        if (action === 'more') await this.loadPreview(control.closest('.gbr-batch-file'), Number(control.dataset.offset));
        if (action === 'select-files' || action === 'unselect-files') { this.excludedFiles = new Set(action === 'select-files' ? [] : this.snapshot.files.map(f => f.id)); this.panel.querySelectorAll('[data-batch-file]').forEach(el => { el.checked = !this.excludedFiles.has(el.value); }); this.updateSelection(); }
        if (action === 'prepare') { if (this.isSearchOnly() || this.searchOnlyJob || !this.jobId || this.snapshot?.status !== 'ready') throw Error('请先扫描替换预览；仅查找结果不能执行替换。'); this.checkWriting(); this.$('.gbr-batch-confirm p').textContent = `将修改 ${this.selection.files} 个文件中的 ${this.selection.count} 处匹配。${this.client?.host === 'tt' ? '修改前保存资源内容及可用的原始图片备份。' : '修改前将创建完整文件备份。'}`; this.$('.gbr-batch-confirm').hidden = false; revealInPanel(this.app, this.$('.gbr-batch-confirm')); }
        if (action === 'dismiss') this.$('.gbr-batch-confirm').hidden = true;
        if (action === 'backups') await this.backups();
        if (action === 'hide-backups') this.$('.gbr-batch-backups').hidden = true;
        if (action === 'apply') {
            if (this.isSearchOnly() || this.searchOnlyJob || this.$('.gbr-batch-confirm').hidden) throw Error('请先扫描替换预览并确认修改。');
            this.checkWriting(); this.operation = true; control.disabled = true; this.app.busy = true; this.app.dialog.inert = true; this.message('正在备份、校验并写入…');
            try {
                const result = await this.api('apply', { id: this.jobId, excludedFiles: [...this.excludedFiles], excludedMatches: [...this.excludedMatches] });
                this.snapshot.status = 'applied'; await this.reloadAfterWrite(`已修改 ${result.files} 个文件、${result.matches} 处。备份编号：${result.id}。请立即重新载入酒馆。`);
            } catch (error) { await this.reloadAfterWrite(`执行未完成：${error.message}。请重新载入酒馆后查看备份中的逐文件状态。`); }
            finally { this.operation = false; this.app.dialog.inert = false; this.app.busy = !!this.requiresReload; if (!this.requiresReload) control.disabled = false; }
        }
        if (action === 'restore' || action === 'restore-confirm' || action === 'restore-preserve') {
            this.checkWriting();
            if (action === 'restore') { const confirm = button('确认检查并恢复', 'restore-confirm'); confirm.dataset.id = control.dataset.id; control.replaceWith(confirm); return; }
            this.operation = true; control.disabled = true; this.app.busy = true; this.app.dialog.inert = true;
            try {
                const result = await this.api('restore', { id: control.dataset.id, preserveConflicts: action === 'restore-preserve' });
                if (result.needsConfirmation) {
                    const area = control.parentElement; area.append(node('p', `以下文件已有新变化，将保留当前文件：${result.conflicts.join('、')}`));
                    const preserve = button('保留冲突文件，仅恢复其余文件', 'restore-preserve'); preserve.dataset.id = control.dataset.id; area.append(preserve); this.message('发现冲突，尚未恢复任何文件。');
                } else await this.reloadAfterWrite(`已恢复 ${result.restored} 个文件，保留 ${result.conflicts.length} 个冲突文件。请立即重新载入酒馆。`);
            } catch (error) { await this.reloadAfterWrite(`恢复未完成：${error.message}。请重新载入酒馆后检查备份状态。`); }
            finally { this.operation = false; this.app.dialog.inert = false; this.app.busy = !!this.requiresReload; if (!this.requiresReload) control.disabled = false; }
        }
        if (action === 'download') {
            const blob = await this.client.download(control.dataset.id), name = `global-batch-replace-backup-${control.dataset.id}.zip`;
            if (this.client.host === 'tt') {
                const { download } = await import('/scripts/utils.js');
                const result = await download(blob, name, 'application/zip', { throwOnFailure: true });
                if (!result?.delivered) throw Error('备份保存已取消或未完成。');
            } else {
                const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        }
    }
}
