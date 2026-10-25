import { BatchPanel } from './batch-panel.js';
import { BatchConfigStore } from './storage.js';
import { revealInPanel } from './scroll.js';

const TITLE = '全局批量查找与替换';
const el = (tag, text = '', className = '') => {
    const item = document.createElement(tag); item.textContent = text; item.className = className; return item;
};
function context() {
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (!ctx?.accountStorage) throw Error('酒馆账号接口尚未就绪，请载入酒馆后重试。');
    return ctx;
}

export class GlobalBatchApp {
    constructor({ bridge = { context }, store = new BatchConfigStore() } = {}) {
        this.bridge = bridge; this.store = store;
        const account = this.bridge.context().accountStorage;
        this.namespace = account.getItem('global-batch-replace-browser-key');
        if (!this.namespace) {
            this.namespace = crypto.randomUUID();
            account.setItem('global-batch-replace-browser-key', this.namespace);
        }
        this.dialog = el('dialog', '', 'gbr');
        this.dialog.id = 'global-batch-replace-dialog';
        this.dialog.setAttribute('aria-label', TITLE);
        this.dialog.innerHTML = `<header class="gbr-header"><strong>⌕ 全局批量查找与替换</strong><span>独立扩展 · 1.1.0</span><button type="button" class="menu_button gbr-close" aria-label="关闭查找替换窗口">关闭</button></header><main class="gbr-main"></main><footer class="gbr-footer" hidden></footer>`;
        document.body.append(this.dialog);
        this.$ = selector => this.dialog.querySelector(selector);
        this.batch = new BatchPanel(this);
        this.$('.gbr-close').addEventListener('click', () => this.batch.close());
        this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.batch.close(); });
        this.onUnload = event => {
            if (this.batch.operation) { event.preventDefault(); event.returnValue = ''; }
        };
        window.addEventListener('beforeunload', this.onUnload);
        this.fitViewport = () => {
            const viewport = window.visualViewport;
            for (const [name, value] of Object.entries({ width: viewport?.width ?? window.innerWidth, height: viewport?.height ?? window.innerHeight, left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0 })) {
                this.dialog.style.setProperty(`--gbr-viewport-${name}`, `${value}px`);
            }
            if (this.dialog.open && this.dialog.contains(document.activeElement)) {
                window.requestAnimationFrame(() => revealInPanel(this, document.activeElement, { block: 'nearest' }));
            }
        };
        window.addEventListener('resize', this.fitViewport);
        window.visualViewport?.addEventListener('resize', this.fitViewport);
        window.visualViewport?.addEventListener('scroll', this.fitViewport);
    }
    async open() {
        this.fitViewport();
        if (!this.dialog.open) this.dialog.showModal();
        if (this.opening) return this.opening;
        this.opening = this.batch.open().catch(error => this.batch.message(error.message, true)).finally(() => { this.opening = null; });
        return this.opening;
    }
    close() {
        if (this.batch.operation || this.batch.requiresReload) return;
        this.dialog.close();
    }
}

export function install() {
    if (document.getElementById('global-batch-replace-wand')) return;
    let app;
    const launch = async () => {
        try { app ||= new GlobalBatchApp(); await app.open(); }
        catch (error) { globalThis.toastr?.error(error.message, TITLE); console.error(TITLE, error); }
    };
    const mount = () => {
        if (document.getElementById('global-batch-replace-wand')) return true;
        const menu = document.querySelector('#extensionsMenu');
        if (!menu) return false;
        const shortcut = el('div', '⌕ 全局批量查找与替换', 'list-group-item flex-container flexGap5 interactable');
        shortcut.id = 'global-batch-replace-wand'; shortcut.tabIndex = 0; shortcut.setAttribute('role', 'button');
        shortcut.addEventListener('click', launch);
        shortcut.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); launch(); } });
        menu.append(shortcut);
        return true;
    };
    if (!mount()) {
        // Some hosts create the wand menu after loading third-party extensions.
        const observer = new window.MutationObserver(() => { if (mount()) observer.disconnect(); });
        observer.observe(document.body, { childList: true, subtree: true });
    }
}
if (!globalThis.__GBR_TEST__) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
}
