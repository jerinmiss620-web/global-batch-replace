// Keep scrolling inside the extension panel instead of scrolling Tavern's document.
export function revealInPanel(app, target, { block = 'start', behavior = 'auto' } = {}) {
    if (!target) return;
    for (let pane = target.parentElement; pane && pane !== app.dialog; pane = pane.parentElement) {
        if (!['auto', 'scroll'].includes(window.getComputedStyle(pane).overflowY)) continue;
        if (pane.scrollHeight <= pane.clientHeight) continue;
        const bounds = pane.getBoundingClientRect(), rect = target.getBoundingClientRect();
        const start = pane.scrollTop + rect.top - bounds.top - pane.clientTop;
        const end = pane.scrollTop + rect.bottom - bounds.top - pane.clientHeight;
        const top = block === 'nearest' ? (rect.top < bounds.top ? start : rect.bottom > bounds.bottom ? end : pane.scrollTop)
            : block === 'center' ? start - Math.max(0, (pane.clientHeight - rect.height) / 2) : start;
        pane.scrollTo({ top: Math.max(0, top), behavior });
        return;
    }
}
