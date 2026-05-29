/**
 * Batch Query — handles concurrent domain intelligence lookups for multiple targets.
 */
const BatchQuery = (() => {
  const CONCURRENCY = 3;
  let running = false;
  let aborted = false;
  let results = [];

  function parseInput(text) {
    return text
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  async function start(queries, onProgress, onResult) {
    running = true;
    aborted = false;
    results = [];
    const queue = [...queries];
    const total = queue.length;
    let completed = 0;

    const workers = [];
    for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
      workers.push(runWorker());
    }

    async function runWorker() {
      while (queue.length > 0 && !aborted) {
        const query = queue.shift();
        if (!query) break;

        try {
          const result = await IntelClient.lookup(query);
          results.push(result);
          onResult(result, null);
        } catch (err) {
          const errResult = { success: false, query, error: err.message };
          results.push(errResult);
          onResult(null, errResult);
        }

        completed++;
        onProgress(completed, total);
      }
    }

    await Promise.all(workers);
    running = false;
    return results;
  }

  function stop() {
    aborted = true;
    running = false;
  }

  function isRunning() {
    return running;
  }

  function getResults() {
    return results;
  }

  function renderResultRow(result, tbody) {
    const tr = document.createElement('tr');
    const data = result.data || {};
    const isError = !result.success;

    const query = result.query || data.query || '—';
    const type = result.type || IntelClient.detectType(query);
    const registrar = isError ? '—' : (data.registrar?.name || data.org?.name || data.registrar || '—');
    const expOrCountry = isError ? '—' : (data.expires_at || data.country || data.org?.country || '—');
    const status = isError
      ? `<span class="status-err">Error</span>`
      : `<span class="status-ok">OK</span>`;

    tr.innerHTML = `
      <td title="${escapeHtml(query)}">${escapeHtml(query)}</td>
      <td>${type.toUpperCase()}</td>
      <td title="${escapeHtml(registrar)}">${escapeHtml(registrar)}</td>
      <td>${escapeHtml(expOrCountry)}</td>
      <td>${status}</td>
      <td><button class="btn-link" data-query="${escapeHtml(query)}">View</button></td>
    `;

    tbody.appendChild(tr);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  return { parseInput, start, stop, isRunning, getResults, renderResultRow };
})();
