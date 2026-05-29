/**
 * Render — renders intelligence data into DOM sections.
 * Cards: flat, 1px hairline, rounded.lg. No shadows.
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

  function createCard(label, value) {
    const card = document.createElement('div');
    card.className = 'info-card';
    card.innerHTML = `
      <div class="info-card-label">${escape(label)}</div>
      <div class="info-card-value">${escape(value)}</div>
    `;
    return card;
  }

  // ── WHOIS / RDAP Cards ──
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
      container.appendChild(createCard(f.label, f.value));
    }
  }

  // ── Status Badges ──
  function statusBadges(statuses, container) {
    container.innerHTML = '';
    if (!statuses?.length) return;
    for (const s of statuses) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = s.replace(/(client|server)\s*/i, '').replace(/Prohibited/i, 'Locked').trim();
      container.appendChild(badge);
    }
  }

  // ── DNS Grid ──
  const DNS_TYPES = ['all', 'a', 'aaaa', 'mx', 'ns', 'txt', 'cname', 'soa'];

  function dnsGrid(dns, tabsContainer, gridContainer) {
    tabsContainer.innerHTML = '';
    gridContainer.innerHTML = '';

    if (!dns || !Object.keys(dns).length) {
      gridContainer.innerHTML = `<div class="dns-record"><span class="dns-value" style="color:var(--c-mute)">${I18n.t('dns.noData')}</span></div>`;
      return;
    }

    const counts = {};
    let total = 0;
    for (const type of DNS_TYPES.slice(1)) {
      if (dns[type]?.length) { counts[type] = dns[type].length; total += dns[type].length; }
    }
    counts.all = total;

    const defaultType = counts.ns ? 'ns' : 'all';

    for (const type of DNS_TYPES.filter(t => t === 'all' || counts[t])) {
      const btn = document.createElement('button');
      btn.className = 'pill-tab' + (type === defaultType ? ' active' : '');
      btn.dataset.dnsType = type;
      btn.innerHTML = `${I18n.t(`dns.${type}`)}<span class="pill-tab-count">${counts[type] || 0}</span>`;
      tabsContainer.appendChild(btn);
    }

    const allGroup = document.createElement('div');
    allGroup.className = 'dns-group' + (defaultType === 'all' ? ' active' : '');
    allGroup.dataset.dnsGroup = 'all';
    for (const type of ['a', 'aaaa', 'mx', 'ns', 'txt', 'cname', 'soa']) {
      if (!dns[type]) continue;
      for (const r of dns[type]) allGroup.appendChild(createDnsRecord(type, r));
    }
    gridContainer.appendChild(allGroup);

    for (const type of DNS_TYPES.slice(1)) {
      if (!counts[type]) continue;
      const group = document.createElement('div');
      group.className = 'dns-group' + (type === defaultType ? ' active' : '');
      group.dataset.dnsGroup = type;
      for (const r of dns[type]) group.appendChild(createDnsRecord(type, r));
      gridContainer.appendChild(group);
    }

    tabsContainer.addEventListener('click', e => {
      const btn = e.target.closest('.pill-tab');
      if (!btn) return;
      tabsContainer.querySelectorAll('.pill-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      gridContainer.querySelectorAll('.dns-group').forEach(g => {
        g.classList.toggle('active', g.dataset.dnsGroup === btn.dataset.dnsType);
      });
    });
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

  // ── Hosting Card ──
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
      container.appendChild(createCard(f.label, f.value));
    }
    if (!hasData) {
      container.innerHTML = `<div class="dns-record"><span class="dns-value" style="color:var(--c-mute)">${I18n.t('empty.noHosting')}</span></div>`;
    }
  }

  // ── HTTP Info ──
  function httpInfo(http, container) {
    container.innerHTML = '';
    if (!http?.status && !http?.redirect_chain?.length) return;

    if (http.status) {
      container.appendChild(createCard('Status', `${http.status} ${http.status_text || ''}`));
    }

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

  // ── SSL Info ──
  function sslInfo(ssl, container) {
    container.innerHTML = '';
    if (!ssl) {
      container.innerHTML = `<div class="dns-record"><span class="dns-value" style="color:var(--c-mute)">${I18n.t('empty.noSsl')}</span></div>`;
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
      container.appendChild(createCard(f.label, f.value));
    }
  }

  return { whoisCards, statusBadges, dnsGrid, hostingCard, httpInfo, sslInfo, escape, formatDate };
})();
