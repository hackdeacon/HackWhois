/**
 * App — main controller.
 * Hero-driven search, History API routing, system theme only.
 */
(() => {
  const $ = (id) => document.getElementById(id);

  // ── Language ──
  const langToggle = $('lang-toggle');
  function updateLangBtn() { langToggle.textContent = I18n.getLang() === 'zh-CN' ? 'EN' : '中'; }
  langToggle.addEventListener('click', () => {
    I18n.setLang(I18n.getLang() === 'zh-CN' ? 'en' : 'zh-CN');
    updateLangBtn();
    if (currentPage === 'history') History.render($('history-list'), historyClickHandler);
  });
  I18n.init();
  updateLangBtn();

  // ── Keyboard: / to focus search ──
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      $('hero-input').focus();
    }
    if (e.key === 'Escape') document.activeElement.blur();
  });

  // ── Router (History API) ──
  const routes = {
    '/':        'page-lookup',
    '/batch':   'page-batch',
    '/history': 'page-history',
  };
  let currentPage = '/';

  function route(path) {
    if (!path || !routes[path]) path = '/';
    currentPage = path;
    const pageId = routes[path];

    document.querySelectorAll('.main').forEach(el => el.classList.add('hidden'));
    const page = document.getElementById(pageId);
    if (page) page.classList.remove('hidden');

    document.querySelectorAll('.hero-nav-link').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === path);
    });

    if (path === '/history') History.render($('history-list'), historyClickHandler);
  }

  function navigate(path) {
    if (path === currentPage) return;
    history.pushState(null, '', path);
    route(path);
    window.scrollTo(0, 0);
  }

  // Intercept hero-nav and back links
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (routes[href]) {
      e.preventDefault();
      navigate(href);
    }
  });

  window.addEventListener('popstate', () => route(location.pathname));
  route(location.pathname);

  // ── Search ──
  const heroInput = $('hero-input');
  const heroGo = $('hero-go');

  function doLookup(overrideQuery) {
    const q = overrideQuery || heroInput.value.trim();
    if (!q) return;
    heroInput.value = q;
    if (currentPage !== '/') navigate('/');
    executeLookup(q);
  }

  heroGo.addEventListener('click', () => doLookup());
  heroInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLookup(); });

  // ── Lookup Execution ──
  async function executeLookup(query) {
    const loadingEl = $('loading');
    const errorBox = $('error-box');
    const errorMsg = $('error-msg');
    const resultsEl = $('results');
    const lookupEmpty = $('lookup-empty');

    errorBox.classList.add('hidden');
    resultsEl.classList.add('hidden');
    lookupEmpty.classList.add('hidden');
    loadingEl.classList.remove('hidden');
    heroGo.disabled = true;

    try {
      const data = await IntelClient.lookup(query);
      if (!data.success) throw new Error(data.error || 'Lookup failed');

      loadingEl.classList.add('hidden');
      heroGo.disabled = false;
      renderResults(data);
      resultsEl.classList.remove('hidden');
      History.add(query, data.type || IntelClient.detectType(query), data);
    } catch (err) {
      loadingEl.classList.add('hidden');
      heroGo.disabled = false;
      errorMsg.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  }

  // ── Render Results ──
  function renderResults(response) {
    const data = response.data || response;
    const type = data.type || IntelClient.detectType(data.domain || data.query || '');
    const title = data.domain || data.query || data.as_number || '';

    $('result-title').textContent = title;

    const statusSection = $('status-section');
    if (data.status?.length) {
      statusSection.classList.remove('hidden');
      Render.statusBadges(data.status, $('status-badges'));
    } else {
      statusSection.classList.add('hidden');
    }

    Render.whoisCards(data, $('whois-cards'));

    const dnsSection = $('dns-section');
    if (type === 'domain' && data.dns && Object.keys(data.dns).length) {
      dnsSection.classList.remove('hidden');
      Render.dnsGrid(data.dns, $('dns-type-tabs'), $('dns-records'));
    } else {
      dnsSection.classList.add('hidden');
    }

    const hostingSection = $('hosting-section');
    if (type === 'domain' && data.hosting) {
      hostingSection.classList.remove('hidden');
      Render.hostingCard(data.hosting, $('hosting-cards'));
    } else {
      hostingSection.classList.add('hidden');
    }

    const httpSection = $('http-section');
    if (type === 'domain' && data.raw?.http) {
      httpSection.classList.remove('hidden');
      Render.httpInfo(data.raw.http, $('http-cards'));
    } else {
      httpSection.classList.add('hidden');
    }

    const sslSection = $('ssl-section');
    if (type === 'domain' && data.ssl) {
      sslSection.classList.remove('hidden');
      Render.sslInfo(data.ssl, $('ssl-cards'));
    } else {
      sslSection.classList.add('hidden');
    }

    $('raw-output').textContent = JSON.stringify(data.raw || data, null, 2);

    $('btn-copy').onclick = () => {
      navigator.clipboard.writeText($('raw-output').textContent).then(() => {
        const btn = $('btn-copy');
        const orig = btn.textContent;
        btn.textContent = '✓';
        setTimeout(() => { btn.textContent = orig; }, 1500);
      });
    };
    $('btn-export-json').onclick = () => Exporter.exportJSON(data, `intel-${title}-${Exporter.getTimestamp()}.json`);
    $('btn-export-csv').onclick = () => Exporter.exportCSV(data, `intel-${title}-${Exporter.getTimestamp()}.csv`);
  }

  // ── History Click Handler ──
  function historyClickHandler(q) {
    heroInput.value = q;
    navigate('/');
    doLookup(q);
  }

  // ── Batch ──
  const batchInput = $('batch-input');
  const btnBatchStart = $('btn-batch-start');
  const btnBatchStop = $('btn-batch-stop');
  const batchFile = $('batch-file');
  const batchTableBody = document.querySelector('#batch-table tbody');

  btnBatchStart.addEventListener('click', startBatch);
  btnBatchStop.addEventListener('click', () => BatchQuery.stop());
  batchFile.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { batchInput.value = ev.target.result; };
    reader.readAsText(file);
  });

  async function startBatch() {
    const queries = BatchQuery.parseInput(batchInput.value);
    if (!queries.length) return;

    btnBatchStart.classList.add('hidden');
    btnBatchStop.classList.remove('hidden');
    $('batch-progress').classList.remove('hidden');
    $('batch-results').classList.remove('hidden');
    batchTableBody.innerHTML = '';
    $('progress-fill').style.width = '0%';
    $('progress-text').textContent = `0 / ${queries.length}`;

    await BatchQuery.start(
      queries,
      (completed, total) => {
        $('progress-fill').style.width = `${Math.round((completed / total) * 100)}%`;
        $('progress-text').textContent = `${completed} / ${total}`;
      },
      (result, err) => renderBatchRow(result || err)
    );

    btnBatchStart.classList.remove('hidden');
    btnBatchStop.classList.add('hidden');
  }

  function renderBatchRow(result) {
    const tr = document.createElement('tr');
    const d = result.data || {};
    const isError = !result.success;
    const query = d.domain || d.query || result.query || '—';
    const type = result.type || IntelClient.detectType(query);
    const registrar = isError ? '—' : (d.registrar?.name || d.org?.name || '—');
    const expOrCountry = isError ? '—' : (d.expires_at || d.org?.country || '—');
    const source = d.source || result.source || '—';

    tr.innerHTML = `
      <td title="${Render.escape(query)}">${Render.escape(query)}</td>
      <td>${type.toUpperCase()}</td>
      <td title="${Render.escape(registrar)}">${Render.escape(registrar)}</td>
      <td>${Render.escape(type === 'domain' ? Render.formatDate(expOrCountry) : expOrCountry)}</td>
      <td>${isError ? `<span class="status-err">${I18n.t('batch.error')}</span>` : `<span class="status-ok">${Render.escape(source)}</span>`}</td>
      <td><button class="btn-link" data-query="${Render.escape(query)}">${I18n.t('batch.view')}</button></td>
    `;
    batchTableBody.appendChild(tr);
  }

  batchTableBody.addEventListener('click', e => {
    const btn = e.target.closest('.btn-link');
    if (!btn) return;
    heroInput.value = btn.dataset.query;
    navigate('/');
    doLookup(btn.dataset.query);
  });

  $('btn-batch-export-json').addEventListener('click', () => {
    const r = BatchQuery.getResults();
    if (r.length) Exporter.exportJSON(r, `intel-batch-${Exporter.getTimestamp()}.json`);
  });
  $('btn-batch-export-csv').addEventListener('click', () => {
    const r = BatchQuery.getResults();
    if (r.length) Exporter.exportCSV(r, `intel-batch-${Exporter.getTimestamp()}.csv`);
  });

  // ── History ──
  $('btn-clear-history').addEventListener('click', () => {
    History.clear();
    History.render($('history-list'), historyClickHandler);
  });

  // ── Init ──
  IntelClient.checkApi();
})();
