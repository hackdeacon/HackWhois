/**
 * History — persists query history in localStorage.
 */
const History = (() => {
  const STORAGE_KEY = 'hackwhois_history';
  const MAX_ITEMS = 200;

  function getAll() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }

  function add(query, type, result) {
    const items = getAll().filter(i => i.query !== query);
    items.unshift({
      query,
      type,
      timestamp: Date.now(),
      result: result ? {
        success: result.success,
        registrar: result.data?.registrar?.name || result.data?.org?.name || null,
        expirationDate: result.data?.expires_at || null,
        country: result.data?.registrant?.country || result.data?.org?.country || null,
      } : null,
    });
    if (items.length > MAX_ITEMS) items.length = MAX_ITEMS;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function clear() { localStorage.removeItem(STORAGE_KEY); }

  function remove(query) {
    const items = getAll().filter(i => i.query !== query);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const lang = I18n.getLang();

    if (diffMin < 1) return lang === 'zh-CN' ? '刚刚' : 'just now';
    if (diffMin < 60) return lang === 'zh-CN' ? `${diffMin} 分钟前` : `${diffMin}m ago`;
    if (diffHr < 24) return lang === 'zh-CN' ? `${diffHr} 小时前` : `${diffHr}h ago`;

    return I18n.formatDate(d.toISOString());
  }

  function render(container, onItemClick) {
    const items = getAll();
    container.innerHTML = '';

    if (!items.length) {
      container.innerHTML = `<p class="empty-text">${I18n.t('empty.noHistory')}</p>`;
      return;
    }

    for (const item of items) {
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <span class="history-query">${escapeHtml(item.query)}</span>
        <span class="history-type">${item.type.toUpperCase()}</span>
        <span class="history-time">${formatTime(item.timestamp)}</span>
      `;
      div.addEventListener('click', () => onItemClick(item.query));
      container.appendChild(div);
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return { getAll, add, clear, remove, render };
})();
