/**
 * Render — renders unified intelligence data into DOM sections.
 * Uses I18n for all labels. DNS records grouped by type tabs.
 */
const Render = (() => {
  function escape(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  function formatDate(iso) {
    return I18n.formatDate(iso);
  }

  // ---- WHOIS Cards ----

  function whoisCards(data, container) {
    container.innerHTML = '';
    const fields = [];

    if (data.type === 'domain' || !data.type) {
      fields.push(
        { label: I18n.t('field.domain'), value: data.domain },
        { label: I18n.t('field.registrar'), value: data.registrar?.name },
        { label: I18n.t('field.created'), value: formatDate(data.created_at) },
        { label: I18n.t('field.expires'), value: formatDate(data.expires_at) },
        { label: I18n.t('field.updated'), value: formatDate(data.updated_at) },
        { label: I18n.t('field.registrant'), value: data.registrant?.name },
        { label: I18n.t('field.organization'), value: data.registrant?.org },
        { label: I18n.t('field.country'), value: data.registrant?.country },
        { label: I18n.t('field.dnssec'), value: data.dnssec },
        { label: I18n.t('field.source'), value: data.source?.toUpperCase() },
      );
    } else if (data.type === 'ip') {
      fields.push(
        { label: I18n.t('field.ip'), value: data.query },
        { label: I18n.t('field.netRange'), value: data.net_range },
        { label: I18n.t('field.cidr'), value: Array.isArray(data.cidr) ? data.cidr.join(', ') : data.cidr },
        { label: I18n.t('field.netName'), value: data.net_name },
        { label: I18n.t('field.organization'), value: data.org?.name },
        { label: I18n.t('field.country'), value: data.org?.country },
        { label: I18n.t('field.created'), value: formatDate(data.created_at) },
      );
    } else if (data.type === 'asn') {
      fields.push(
        { label: I18n.t('field.asn'), value: data.as_number },
        { label: I18n.t('field.name'), value: data.as_name },
        { label: I18n.t('field.organization'), value: data.org?.name },
        { label: I18n.t('field.country'), value: data.org?.country },
      );
    }

    for (const f of fields) {
      if (!f.value || f.value === '—') continue;
      const card = document.createElement('div');
      card.className = 'info-card';
      card.innerHTML = `
        <div class="info-card-label">${escape(f.label)}</div>
        <div class="info-card-value">${escape(f.value)}</div>
      `;
      container.appendChild(card);
    }
  }

  // ---- Status Badges ----

  function statusBadges(statuses, container) {
    container.innerHTML = '';
    if (!statuses || !statuses.length) return;

    for (const s of statuses) {
      const badge = document.createElement('span');
      badge.className = 'badge-positive';
      const short = s.replace(/(client|server)\s*/i, '').replace(/Prohibited/i, 'Locked').trim();
      badge.textContent = short;
      container.appendChild(badge);
    }
  }

  // ---- DNS Grid (grouped by type tabs) ----

  const DNS_TYPES = ['all', 'a', 'aaaa', 'mx', 'ns', 'txt', 'cname', 'soa'];

  function dnsGrid(dns, tabsContainer, gridContainer) {
    tabsContainer.innerHTML = '';
    gridContainer.innerHTML = '';

    if (!dns || !Object.keys(dns).length) {
      gridContainer.innerHTML = `<div class="dns-record"><span class="dns-value" style="color:var(--c-steel)">${I18n.t('dns.noData')}</span></div>`;
      return;
    }

    // Count records per type
    const counts = {};
    let total = 0;
    for (const type of DNS_TYPES.slice(1)) {
      const records = dns[type];
      if (records && records.length) {
        counts[type] = records.length;
        total += records.length;
      }
    }
    counts.all = total;

    // Build type tabs
    const activeTypes = DNS_TYPES.filter(t => t === 'all' || counts[t]);
    for (const type of activeTypes) {
      const btn = document.createElement('button');
      btn.className = 'dns-type-tab' + (type === 'all' ? ' active' : '');
      btn.dataset.dnsType = type;
      const label = I18n.t(`dns.${type}`);
      const count = counts[type] || 0;
      btn.innerHTML = `${label}<span class="dns-type-count">${count}</span>`;
      tabsContainer.appendChild(btn);
    }

    // Build grid groups
    // "All" group
    const allGroup = document.createElement('div');
    allGroup.className = 'dns-grid dns-grid-group active';
    allGroup.dataset.dnsGroup = 'all';
    buildDnsRecords(dns, allGroup);
    gridContainer.appendChild(allGroup);

    // Per-type groups
    for (const type of DNS_TYPES.slice(1)) {
      if (!counts[type]) continue;
      const group = document.createElement('div');
      group.className = 'dns-grid dns-grid-group';
      group.dataset.dnsGroup = type;
      for (const r of dns[type]) {
        group.appendChild(createDnsRecord(type, r));
      }
      gridContainer.appendChild(group);
    }

    // Tab click handler
    tabsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.dns-type-tab');
      if (!btn) return;
      tabsContainer.querySelectorAll('.dns-type-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.dnsType;
      gridContainer.querySelectorAll('.dns-grid-group').forEach(g => {
        g.classList.toggle('active', g.dataset.dnsGroup === target);
      });
    });
  }

  function buildDnsRecords(dns, container) {
    const typeOrder = ['a', 'aaaa', 'mx', 'ns', 'txt', 'cname', 'soa'];
    for (const type of typeOrder) {
      const records = dns[type];
      if (!records) continue;
      for (const r of records) {
        container.appendChild(createDnsRecord(type, r));
      }
    }
  }

  function createDnsRecord(type, r) {
    const div = document.createElement('div');
    div.className = 'dns-record';
    let display;
    if (type === 'mx') display = `${r.priority} ${r.exchange}`;
    else if (type === 'soa') display = `${r.nsname} (${r.hostmaster})`;
    else display = r.value || r.text || JSON.stringify(r);
    div.innerHTML = `<span class="dns-type">${type.toUpperCase()}</span><span class="dns-value">${escape(display)}</span>`;
    return div;
  }

  // ---- Hosting Card ----

  function hostingCard(hosting, container) {
    container.innerHTML = '';
    if (!hosting) return;

    const fields = [
      { label: I18n.t('field.cdn'), value: hosting.cdn },
      { label: I18n.t('field.provider'), value: hosting.provider },
      { label: I18n.t('field.ipAddresses'), value: hosting.ip?.join(', ') },
      { label: I18n.t('field.country'), value: hosting.country },
    ];

    let hasData = false;
    for (const f of fields) {
      if (!f.value) continue;
      hasData = true;
      const card = document.createElement('div');
      card.className = 'info-card';
      card.innerHTML = `
        <div class="info-card-label">${escape(f.label)}</div>
        <div class="info-card-value">${escape(f.value)}</div>
      `;
      container.appendChild(card);
    }

    if (!hasData) {
      container.innerHTML = `<div class="dns-record"><span class="dns-value" style="color:var(--c-steel)">${I18n.t('empty.noHosting')}</span></div>`;
    }
  }

  // ---- HTTP Info ----

  function httpInfo(http, container) {
    container.innerHTML = '';
    if (!http || (!http.status && !http.redirect_chain?.length)) return;

    if (http.redirect_chain?.length > 1) {
      const chain = http.redirect_chain.map(r => `${r.status} → ${r.url}`).join('\n');
      const card = document.createElement('div');
      card.className = 'info-card';
      card.innerHTML = `
        <div class="info-card-label">${I18n.t('field.redirectChain')}</div>
        <div class="info-card-value" style="font-size:12px;font-family:var(--ff-mono);white-space:pre-line">${escape(chain)}</div>
      `;
      container.appendChild(card);
    }
  }

  // ---- SSL Info ----

  function sslInfo(ssl, container) {
    container.innerHTML = '';
    if (!ssl) {
      container.innerHTML = `<div class="dns-record"><span class="dns-value" style="color:var(--c-steel)">${I18n.t('empty.noSsl')}</span></div>`;
      return;
    }

    const fields = [
      { label: I18n.t('field.subject'), value: ssl.subject },
      { label: I18n.t('field.issuer'), value: ssl.issuer },
      { label: I18n.t('field.validFrom'), value: formatDate(ssl.valid_from) },
      { label: I18n.t('field.validTo'), value: formatDate(ssl.valid_to) },
      { label: I18n.t('field.protocol'), value: ssl.protocol },
      { label: I18n.t('field.sans'), value: ssl.alt_names?.length ? ssl.alt_names.slice(0, 10).join(', ') + (ssl.alt_names.length > 10 ? ` (+${ssl.alt_names.length - 10} more)` : '') : null },
    ];

    for (const f of fields) {
      if (!f.value) continue;
      const card = document.createElement('div');
      card.className = 'info-card';
      card.innerHTML = `
        <div class="info-card-label">${escape(f.label)}</div>
        <div class="info-card-value">${escape(f.value)}</div>
      `;
      container.appendChild(card);
    }
  }

  return { whoisCards, statusBadges, dnsGrid, hostingCard, httpInfo, sslInfo, escape, formatDate };
})();
