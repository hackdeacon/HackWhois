/**
 * History — persists query history in localStorage.
 */
const History = (() => {
  const STORAGE_KEY = 'hackwhois_history';
  const MAX_ITEMS = 200;

  function getAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function add(query, type, result) {
    const items = getAll();
    items.unshift({
      query,
      type,
      timestamp: Date.now(),
      result: result ? {
        success: result.success,
        registrar: result.data?.registrar || result.data?.orgName || result.data?.org || null,
        expirationDate: result.data?.expirationDate || null,
        country: result.data?.country || null,
      } : null,
    });

    // Trim to max
    if (items.length > MAX_ITEMS) items.length = MAX_ITEMS;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function remove(query) {
    const items = getAll().filter(i => i.query !== query);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function render(container, onItemClick) {
    const items = getAll();
    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = `<p class="empty-state">${I18n.t('empty.noHistory')}</p>`;
      return;
    }

    for (const item of items) {
      const div = document.createElement('div');
      div.className = 'history-item';
      const time = new Date(item.timestamp).toLocaleString();
      div.innerHTML = `
        <div>
          <span class="history-query">${escapeHtml(item.query)}</span>
          <span class="history-type">${item.type.toUpperCase()}</span>
        </div>
        <span class="history-meta">${time}</span>
      `;
      div.addEventListener('click', () => onItemClick(item.query));
      container.appendChild(div);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { getAll, add, clear, remove, render };
})();
