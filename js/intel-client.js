/**
 * Intel Client — communicates with /api/intel backend.
 * Falls back to public APIs (rdap.cloud + DoH) when backend is unavailable.
 */
const IntelClient = (() => {
  const API_BASE = '/api/intel';
  const RDAP_CLOUD = 'https://rdap.cloud/api/v1';
  const CORS_PROXIES = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ];

  const TLD_RDAP = {
    com: 'https://rdap.verisign.com/com/v1/domain/',
    net: 'https://rdap.verisign.com/net/v1/domain/',
    org: 'https://rdap.publicinterestregistry.org/rdap/domain/',
    info: 'https://rdap.identitydigital.services/rdap/domain/',
    io: 'https://rdap.nic.io/rdap/domain/',
    co: 'https://rdap.nic.co/rdap/domain/',
    me: 'https://rdap.nic.me/rdap/domain/',
    app: 'https://www.registry.google/rdap/domain/',
    dev: 'https://www.registry.google/rdap/domain/',
    ai: 'https://rdap.nic.ai/rdap/domain/',
    de: 'https://rdap.denic.de/rdap/domain/',
    fr: 'https://rdap.nic.fr/rdap/domain/',
    uk: 'https://rdap.nominet.uk/rdap/domain/',
    nl: 'https://rdap.sidn.nl/rdap/domain/',
    eu: 'https://rdap.eu/rdap/domain/',
    ru: 'https://rdap.tcinet.ru/rdap/domain/',
    cn: 'https://rdap.cnnic.cn/rdap/domain/',
    xyz: 'https://rdap.nic.xyz/rdap/domain/',
  };

  let useBackend = false;

  async function checkApi() {
    try {
      const resp = await fetch('/test', {
        method: 'GET',
        signal: AbortSignal.timeout(4000),
      });
      if (resp.ok || resp.status === 400 || resp.status === 500) {
        useBackend = true;
        return 'server';
      }
    } catch (e) { /* no backend */ }
    useBackend = false;
    return 'public';
  }

  // ---- Backend ----

  async function queryBackend(query) {
    const resp = await fetch(`/${encodeURIComponent(query)}`);
    const data = await resp.json();
    if (!data.success) throw new Error(data.error || 'API error');
    return data;
  }

  // ---- Public fallback (rdap.cloud) ----

  async function queryRdapCloud(query) {
    const resp = await fetch(`${RDAP_CLOUD}/${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!resp.ok) throw new Error(`rdap.cloud returned ${resp.status}`);
    const json = await resp.json();
    const result = json.results?.[query];
    if (!result?.success || !result?.data) {
      throw new Error(result?.message || 'rdap.cloud lookup failed');
    }

    const type = detectType(query);
    if (type === 'domain') return parseRdapDomain(result.data, query);
    if (type === 'ip') return parseRdapIp(result.data, query);
    if (type === 'asn') return parseRdapAsn(result.data, query);
    throw new Error('Unknown type');
  }

  async function queryWhoisJS(query) {
    const resp = await fetch(`https://whoisjs.com/api/v1/${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new Error('whoisjs.com failed');
    const json = await resp.json();
    if (!json.success || !json.raw) throw new Error('whoisjs.com lookup failed');

    return parseWhoisRaw(json, query);
  }

  async function queryDirectRDAP(query) {
    const type = detectType(query);
    if (type !== 'domain') throw new Error('Direct RDAP only supports domains');

    const tld = query.split('.').pop().toLowerCase();
    const server = TLD_RDAP[tld];
    if (!server) throw new Error(`No RDAP server for .${tld}`);

    for (const makeProxy of CORS_PROXIES) {
      try {
        const resp = await fetch(makeProxy(server + encodeURIComponent(query)), {
          signal: AbortSignal.timeout(10000),
        });
        if (resp.ok) {
          const data = await resp.json();
          return parseRdapDomain(data, query);
        }
      } catch (e) { /* try next */ }
    }
    throw new Error('All RDAP endpoints unreachable');
  }

  // ---- Parsers (public fallback) ----

  function parseRdapDomain(rdap, domain) {
    const result = {
      domain: rdap.ldhName || domain,
      tld: domain.split('.').pop().toLowerCase(),
      registered: true,
      created_at: null, updated_at: null, expires_at: null,
      registrar: { name: null, url: null, abuse_email: null },
      registrant: { name: null, org: null, country: null },
      status: [], nameservers: [], dnssec: null,
      dns: {}, hosting: { cdn: null, provider: null, ip: [], country: null },
      rdap_supported: true, source: 'rdap',
      raw: { registration: rdap },
    };

    for (const evt of rdap.events || []) {
      switch (evt.eventAction) {
        case 'registration': result.created_at = evt.eventDate; break;
        case 'expiration': result.expires_at = evt.eventDate; break;
        case 'last changed': result.updated_at = evt.eventDate; break;
      }
    }

    result.nameservers = (rdap.nameservers || []).map(ns => ns.ldhName?.toLowerCase()).filter(Boolean);
    result.status = rdap.status || [];

    const extractEntity = (entities, role) => {
      for (const e of entities || []) {
        if ((e.roles || []).includes(role)) {
          const vc = e.vcardArray?.[1] || [];
          return {
            name: vc.find(v => v[0] === 'fn')?.[3] || e.handle || null,
            org: vc.find(v => v[0] === 'org')?.[3]?.[0] || null,
            country: vc.find(v => v[0] === 'adr')?.[1]?.cc || null,
            email: vc.find(v => v[0] === 'email')?.[3]?.replace('mailto:', '') || null,
          };
        }
        const nested = extractEntity(e.entities, role);
        if (nested) return nested;
      }
      return null;
    };

    const registrar = extractEntity(rdap.entities, 'registrar');
    if (registrar) {
      result.registrar.name = registrar.name;
      result.registrar.abuse_email = registrar.email;
    }

    const registrant = extractEntity(rdap.entities, 'registrant');
    if (registrant) {
      result.registrant.name = registrant.name;
      result.registrant.org = registrant.org;
      result.registrant.country = registrant.country;
    }

    if (rdap.secureDNS) {
      result.dnssec = rdap.secureDNS.delegationSigned ? 'signed' : 'unsigned';
    }

    return { success: true, type: 'domain', data: result };
  }

  function parseRdapIp(rdap, ip) {
    const org = (() => {
      for (const e of rdap.entities || []) {
        if ((e.roles || []).includes('registrant')) {
          return { name: e.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || e.handle, id: e.handle };
        }
        for (const sub of e.entities || []) {
          if ((sub.roles || []).includes('registrant')) {
            return { name: sub.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || sub.handle, id: sub.handle };
          }
        }
      }
      return null;
    })();

    return {
      success: true, type: 'ip',
      data: {
        query: ip, type: 'ip',
        net_range: rdap.startAddress && rdap.endAddress ? `${rdap.startAddress} - ${rdap.endAddress}` : null,
        cidr: rdap.cidr0_cidrs?.map(c => `${c.v4prefix || c.v6prefix}/${c.length}`) || null,
        net_name: rdap.name || null,
        org: { name: org?.name || null, id: org?.id || null, country: rdap.country || null },
        created_at: rdap.events?.find(e => e.eventAction === 'registration')?.eventDate || null,
        updated_at: rdap.events?.find(e => e.eventAction === 'last changed')?.eventDate || null,
        source: 'rdap', raw: rdap,
      },
    };
  }

  function parseRdapAsn(rdap, asn) {
    const org = (() => {
      for (const e of rdap.entities || []) {
        if ((e.roles || []).includes('registrant')) {
          return { name: e.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || e.handle };
        }
        for (const sub of e.entities || []) {
          if ((sub.roles || []).includes('registrant')) {
            return { name: sub.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || sub.handle };
          }
        }
      }
      return null;
    })();

    return {
      success: true, type: 'asn',
      data: {
        query: asn, type: 'asn',
        as_number: rdap.handle || (rdap.startAutnum ? `AS${rdap.startAutnum}` : asn),
        as_name: rdap.name || null,
        org: { name: org?.name || null, country: rdap.country || null },
        status: rdap.status || [],
        source: 'rdap', raw: rdap,
      },
    };
  }

  function parseWhoisRaw(json, query) {
    const raw = json.raw || '';
    const fields = {};
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([^:]+?):\s*(.+)/);
      if (m) {
        const k = m[1].trim(), v = m[2].trim();
        if (k && v) {
          if (!fields[k]) fields[k] = v;
          else if (Array.isArray(fields[k])) fields[k].push(v);
          else fields[k] = [fields[k], v];
        }
      }
    }

    const find = (keys) => {
      for (const k of keys) {
        if (fields[k]) return fields[k];
        for (const dk of Object.keys(fields)) {
          if (dk.toLowerCase() === k.toLowerCase()) return fields[dk];
        }
      }
      return null;
    };
    const findAll = (keys) => {
      for (const k of keys) {
        if (fields[k]) return Array.isArray(fields[k]) ? fields[k] : [fields[k]];
      }
      return [];
    };

    return {
      success: true, type: 'domain',
      data: {
        domain: json.domain?.name || find(['Domain Name', 'domain']) || query,
        tld: query.split('.').pop().toLowerCase(),
        registered: true,
        created_at: find(['Creation Date', 'Registration Time', 'Created']),
        updated_at: find(['Updated Date', 'Last Modified']),
        expires_at: find(['Registry Expiry Date', 'Expiration Time', 'Expiry Date']),
        registrar: { name: find(['Registrar', 'Sponsoring Registrar']), url: find(['Registrar URL']), abuse_email: find(['Registrar Abuse Contact Email']) },
        registrant: { name: find(['Registrant', 'Registrant Name']), org: find(['Registrant Organization']), country: find(['Registrant Country']) },
        status: findAll(['Domain Status', 'Status']),
        nameservers: findAll(['Name Server', 'nserver']).map(n => n.toLowerCase()),
        dns: {}, hosting: { cdn: null, provider: null, ip: [], country: null },
        rdap_supported: false, source: 'whois',
        raw: { registration: fields, raw_text: raw },
      },
    };
  }

  function detectType(query) {
    const q = query.trim();
    if (/^AS\d+$/i.test(q)) return 'asn';
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(q)) return 'ip';
    if (/^[a-fA-F0-9:]+$/.test(q) && q.includes(':')) return 'ip';
    return 'domain';
  }

  // ---- Main lookup ----

  async function lookup(query) {
    if (useBackend) {
      return await queryBackend(query);
    }

    // Public fallback: rdap.cloud → whoisjs.com → direct RDAP
    try { return await queryRdapCloud(query); } catch (e) { /* next */ }
    try { return await queryWhoisJS(query); } catch (e) { /* next */ }

    const type = detectType(query);
    if (type === 'domain') {
      return await queryDirectRDAP(query);
    }

    throw new Error(`All lookup methods failed for: ${query}`);
  }

  return { checkApi, lookup, detectType, isUsingBackend: () => useBackend };
})();
