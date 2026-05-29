/**
 * DNS Resolver — uses DNS-over-HTTPS (Cloudflare & Google) for frontend DNS queries.
 */
const DnsResolver = (() => {
  const DOH_SERVERS = [
    'https://cloudflare-dns.com/dns-query',
    'https://dns.google/resolve',
  ];

  async function resolve(domain, type = 'A') {
    const errors = [];

    for (const server of DOH_SERVERS) {
      try {
        const url = `${server}?name=${encodeURIComponent(domain)}&type=${type}`;
        const resp = await fetch(url, {
          headers: { Accept: 'application/dns-json' },
          signal: AbortSignal.timeout(5000),
        });
        if (!resp.ok) continue;
        const data = await resp.json();
        return parseDoHResponse(data, type);
      } catch (e) {
        errors.push(e.message);
      }
    }

    return { type, records: [], error: errors.join('; ') || 'DNS query failed' };
  }

  function parseDoHResponse(data, type) {
    if (!data.Answer || data.Answer.length === 0) {
      return { type, records: [] };
    }

    const records = data.Answer
      .filter(a => {
        // Match the requested type (type codes: A=1, AAAA=28, MX=15, NS=2, TXT=16, CNAME=5, SOA=6)
        const typeMap = { A: 1, AAAA: 28, MX: 15, NS: 2, TXT: 16, CNAME: 5, SOA: 6 };
        return a.type === typeMap[type];
      })
      .map(a => {
        const r = { name: a.name, ttl: a.TTL };
        if (type === 'MX') {
          // MX data format: "10 mail.example.com"
          const parts = a.data.split(' ');
          r.priority = parseInt(parts[0]);
          r.exchange = parts[1];
          r.display = `${r.priority} ${r.exchange}`;
        } else if (type === 'TXT') {
          r.text = a.data.replace(/^"|"$/g, '');
          r.display = r.text;
        } else {
          r.value = a.data;
          r.display = a.data;
        }
        return r;
      });

    return { type, records };
  }

  async function resolveAll(domain) {
    const types = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME'];
    const results = await Promise.all(types.map(t => resolve(domain, t)));
    const combined = {};

    for (const r of results) {
      if (r.records.length > 0) {
        combined[r.type] = r.records;
      }
    }

    return combined;
  }

  function renderDnsRecords(dnsData, container) {
    container.innerHTML = '';

    const allRecords = [];
    for (const [type, records] of Object.entries(dnsData)) {
      for (const r of records) {
        allRecords.push({ type, ...r });
      }
    }

    if (allRecords.length === 0) {
      container.innerHTML = `<div class="dns-record"><span class="dns-value" style="color:var(--c-steel)">${I18n.t('dns.noData')}</span></div>`;
      return;
    }

    for (const rec of allRecords) {
      const div = document.createElement('div');
      div.className = 'dns-record';
      div.innerHTML = `<span class="dns-type">${rec.type}</span><span class="dns-value">${escapeHtml(rec.display)}</span>`;
      container.appendChild(div);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { resolve, resolveAll, renderDnsRecords };
})();
