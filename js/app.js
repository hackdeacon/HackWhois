/**
 * App — main controller for HackWHOIS Domain Intelligence Platform.
 */
(() => {
  // DOM refs
  const $ = (id) => document.getElementById(id);
  const queryInput = $('query-input');
  const btnLookup = $('btn-lookup');
  const loadingEl = $('loading');
  const errorBox = $('error-box');
  const errorMsg = $('error-msg');
  const resultsEl = $('results');
  const resultTitle = $('result-title');
  const apiModeEl = $('api-mode');

  // ── Theme ──
  const THEME_KEY = 'hackwhois_theme';
  const themeToggle = $('theme-toggle');
  const themeIcon = $('theme-icon');

  function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'auto';
  }

  function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
  }

  function updateThemeIcon(theme) {
    if (theme === 'dark') themeIcon.textContent = '☀';
    else if (theme === 'light') themeIcon.textContent = '◐';
    else themeIcon.textContent = '◐';
  }

  // Cycle: auto → light → dark → auto
  themeToggle.addEventListener('click', () => {
    const current = getTheme();
    const next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
    setTheme(next);
  });

  // Init theme
  setTheme(getTheme());

  // Listen for system theme changes when in auto mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === 'auto') {
      // CSS handles it via data-theme="auto", just update icon
      updateThemeIcon('auto');
    }
  });

  // ── Language ──
  const langToggle = $('lang-toggle');

  function updateLangButton() {
    const lang = I18n.getLang();
    langToggle.textContent = lang === 'zh-CN' ? 'EN' : '中';
  }

  langToggle.addEventListener('click', () => {
    const next = I18n.getLang() === 'zh-CN' ? 'en' : 'zh-CN';
    I18n.setLang(next);
    updateLangButton();
    // Re-render dynamic content
    if (!$('results').classList.contains('hidden')) {
      // Re-render last lookup if visible (simplified: just update static labels)
    }
    // Re-render history if visible
    const historyPanel = $('panel-history');
    if (historyPanel.classList.contains('active')) {
      History.render($('history-list'), historyClickHandler);
    }
  });

  // Init i18n
  I18n.init();
  updateLangButton();

  // ── Mobile nav ──
  const hamburger = $('nav-hamburger');
  const overlay = $('nav-overlay');
  const drawer = $('nav-drawer');

  function openMobileNav() {
    hamburger.classList.add('open');
    overlay.classList.add('open');
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeMobileNav() {
    hamburger.classList.remove('open');
    overlay.classList.remove('open');
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  }
  function toggleMobileNav() {
    if (drawer.classList.contains('open')) closeMobileNav();
    else openMobileNav();
  }

  hamburger.addEventListener('click', toggleMobileNav);
  overlay.addEventListener('click', closeMobileNav);

  // Close drawer on swipe-right
  let touchStartX = 0;
  drawer.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  drawer.addEventListener('touchend', (e) => {
    if (e.changedTouches[0].clientX - touchStartX > 60) closeMobileNav();
  }, { passive: true });

  // ── Tab switching ──
  function historyClickHandler(q) {
    switchToSingle();
    queryInput.value = q;
    doLookup();
    if (window.innerWidth < 768) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function activateTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const target = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`panel-${tabName}`)?.classList.add('active');

    document.querySelectorAll('.nav-mobile-link').forEach(l => {
      l.classList.toggle('active', l.dataset.tab === tabName);
    });

    if (tabName === 'history') {
      History.render($('history-list'), historyClickHandler);
    }
  }

  document.querySelectorAll('.tab, .nav-link[data-tab]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      activateTab(el.dataset.tab);
    });
  });

  document.querySelectorAll('.nav-mobile-link').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      activateTab(el.dataset.tab);
      closeMobileNav();
    });
  });

  function switchToSingle() {
    activateTab('single');
  }

  // Single query
  btnLookup.addEventListener('click', doLookup);
  queryInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLookup(); });

  async function doLookup() {
    const query = queryInput.value.trim();
    if (!query) return;

    queryInput.blur();
    showLoading(true);
    hideError();
    hideResults();

    if (window.innerWidth < 768) {
      document.querySelector('.content-band').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    try {
      const result = await IntelClient.lookup(query);
      const type = result.type || IntelClient.detectType(query);
      History.add(query, type, result);
      showResults(result);
    } catch (err) {
      showError(err.message);
    } finally {
      showLoading(false);
    }
  }

  function showResults(result) {
    const data = result.data;
    const type = result.type || IntelClient.detectType(data?.domain || data?.query);
    resultsEl.classList.remove('hidden');

    if (window.innerWidth < 768) {
      setTimeout(() => {
        resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }

    // Title
    if (type === 'domain') resultTitle.textContent = data.domain || data.query;
    else if (type === 'ip') resultTitle.textContent = `IP: ${data.query}`;
    else if (type === 'asn') resultTitle.textContent = `ASN: ${data.as_number || data.query}`;

    // Status badges
    const statusSection = $('status-section');
    if (type === 'domain' && data.status?.length) {
      statusSection.classList.remove('hidden');
      Render.statusBadges(data.status, $('status-badges'));
    } else {
      statusSection.classList.add('hidden');
    }

    // Registration cards
    Render.whoisCards(data, $('whois-cards'));

    // DNS (domain only) — grouped by type tabs
    const dnsSection = $('dns-section');
    const dnsTypeTabs = $('dns-type-tabs');
    const dnsRecords = $('dns-records');
    if (type === 'domain' && data.dns && Object.keys(data.dns).length) {
      dnsSection.classList.remove('hidden');
      Render.dnsGrid(data.dns, dnsTypeTabs, dnsRecords);
    } else if (type === 'domain') {
      dnsSection.classList.remove('hidden');
      dnsTypeTabs.innerHTML = '';
      dnsRecords.innerHTML = `<div class="dns-record"><span class="dns-value" style="color:var(--c-mute)">${I18n.t('dns.loading')}</span></div>`;
      DnsResolver.resolveAll(data.domain || data.query).then(dnsData => {
        Render.dnsGrid(dnsData, dnsTypeTabs, dnsRecords);
      });
    } else {
      dnsSection.classList.add('hidden');
    }

    // Hosting
    const hostingSection = $('hosting-section');
    if (type === 'domain' && data.hosting) {
      hostingSection.classList.remove('hidden');
      Render.hostingCard(data.hosting, $('hosting-cards'));
    } else {
      hostingSection.classList.add('hidden');
    }

    // HTTP
    const httpSection = $('http-section');
    if (type === 'domain' && data.raw?.http) {
      httpSection.classList.remove('hidden');
      Render.httpInfo(data.raw.http, $('http-cards'));
    } else {
      httpSection.classList.add('hidden');
    }

    // SSL
    const sslSection = $('ssl-section');
    if (type === 'domain' && data.ssl) {
      sslSection.classList.remove('hidden');
      Render.sslInfo(data.ssl, $('ssl-cards'));
    } else {
      sslSection.classList.add('hidden');
    }

    // Raw
    $('raw-output').textContent = JSON.stringify(data.raw || data, null, 2);

    // Export buttons
    $('btn-copy').onclick = () => navigator.clipboard.writeText($('raw-output').textContent);
    $('btn-export-json').onclick = () => Exporter.exportJSON(data, `intel-${data.domain || data.query}-${Exporter.getTimestamp()}.json`);
    $('btn-export-csv').onclick = () => Exporter.exportCSV(data, `intel-${data.domain || data.query}-${Exporter.getTimestamp()}.csv`);
  }

  // Batch
  const batchInput = $('batch-input');
  const btnBatchStart = $('btn-batch-start');
  const btnBatchStop = $('btn-batch-stop');
  const batchFile = $('batch-file');
  const batchTableBody = document.querySelector('#batch-table tbody');

  btnBatchStart.addEventListener('click', startBatch);
  btnBatchStop.addEventListener('click', () => BatchQuery.stop());

  batchFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { batchInput.value = ev.target.result; };
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
        const pct = Math.round((completed / total) * 100);
        $('progress-fill').style.width = `${pct}%`;
        $('progress-text').textContent = `${completed} / ${total}`;
      },
      (result, err) => {
        const row = result || err;
        renderBatchRow(row);
      }
    );

    btnBatchStart.classList.remove('hidden');
    btnBatchStop.classList.add('hidden');
  }

  function renderBatchRow(result) {
    const tr = document.createElement('tr');
    const data = result.data || {};
    const isError = !result.success;
    const query = data.domain || data.query || result.query || '—';
    const type = result.type || IntelClient.detectType(query);
    const registrar = isError ? '—' : (data.registrar?.name || data.org?.name || '—');
    const expOrCountry = isError ? '—' : (data.expires_at || data.org?.country || '—');
    const source = data.source || result.source || '—';

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

  batchTableBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-link');
    if (!btn) return;
    switchToSingle();
    queryInput.value = btn.dataset.query;
    doLookup();
    if (window.innerWidth < 768) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // Batch export
  $('btn-batch-export-json').addEventListener('click', () => {
    const r = BatchQuery.getResults();
    if (r.length) Exporter.exportJSON(r, `intel-batch-${Exporter.getTimestamp()}.json`);
  });
  $('btn-batch-export-csv').addEventListener('click', () => {
    const r = BatchQuery.getResults();
    if (r.length) Exporter.exportCSV(r, `intel-batch-${Exporter.getTimestamp()}.csv`);
  });

  // History
  $('btn-clear-history').addEventListener('click', () => {
    History.clear();
    History.render($('history-list'), historyClickHandler);
  });

  // UI helpers
  function showLoading(show) { loadingEl.classList.toggle('hidden', !show); btnLookup.disabled = show; }
  function showError(msg) { errorMsg.textContent = msg; errorBox.classList.remove('hidden'); }
  function hideError() { errorBox.classList.add('hidden'); }
  function hideResults() { resultsEl.classList.add('hidden'); }

  // Init
  (async () => {
    const mode = await IntelClient.checkApi();
    apiModeEl.textContent = mode === 'server'
      ? I18n.t('footer.apiServer')
      : I18n.t('footer.apiPublic');
  })();
})();
