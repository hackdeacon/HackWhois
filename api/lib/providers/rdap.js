/**
 * RDAP Provider — queries authoritative RDAP endpoints.
 * Uses IANA bootstrap to discover TLD-specific servers.
 */

// Local TLD → RDAP server cache (avoids IANA round-trip for common TLDs)
const TLD_CACHE = {
  com: 'https://rdap.verisign.com/com/v1',
  net: 'https://rdap.verisign.com/net/v1',
  org: 'https://rdap.publicinterestregistry.org/rdap',
  info: 'https://rdap.identitydigital.services/rdap',
  io: 'https://rdap.nic.io/rdap',
  co: 'https://rdap.nic.co/rdap',
  me: 'https://rdap.nic.me/rdap',
  app: 'https://www.registry.google/rdap',
  dev: 'https://www.registry.google/rdap',
  page: 'https://www.registry.google/rdap',
  ai: 'https://rdap.nic.ai/rdap',
  tv: 'https://rdap.nic.tv/rdap',
  de: 'https://rdap.denic.de/rdap',
  fr: 'https://rdap.nic.fr/rdap',
  uk: 'https://rdap.nominet.uk/rdap',
  au: 'https://rdap.auda.org.au/rdap',
  nl: 'https://rdap.sidn.nl/rdap',
  eu: 'https://rdap.eu/rdap',
  ru: 'https://rdap.tcinet.ru/rdap',
  cn: 'https://rdap.cnnic.cn/rdap',
  xyz: 'https://rdap.nic.xyz/rdap',
  online: 'https://rdap.identitydigital.services/rdap',
  site: 'https://rdap.identitydigital.services/rdap',
  store: 'https://rdap.identitydigital.services/rdap',
  tech: 'https://rdap.identitydigital.services/rdap',
  cloud: 'https://rdap.identitydigital.services/rdap',
};

let ianaCache = null;
let ianaCacheTime = 0;
const IANA_CACHE_TTL = 3600000; // 1 hour

async function fetchIANABootstrap() {
  const now = Date.now();
  if (ianaCache && (now - ianaCacheTime) < IANA_CACHE_TTL) {
    return ianaCache;
  }

  const resp = await fetch('https://data.iana.org/rdap/dns.json', {
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`IANA bootstrap returned ${resp.status}`);

  const data = await resp.json();
  const map = {};
  for (const [tlds, servers] of data.services) {
    for (const tld of tlds) {
      map[tld] = servers[0].replace(/\/+$/, '');
    }
  }

  ianaCache = map;
  ianaCacheTime = now;
  return map;
}

async function getRdapServer(tld) {
  // Check local cache first
  if (TLD_CACHE[tld]) return TLD_CACHE[tld];

  // Try IANA bootstrap
  try {
    const iana = await fetchIANABootstrap();
    if (iana[tld]) return iana[tld];
  } catch (e) {
    // IANA fetch failed
  }

  return null;
}

async function queryDomain(domain) {
  const tld = domain.split('.').pop().toLowerCase();
  const server = await getRdapServer(tld);
  if (!server) {
    return { success: false, error: `No RDAP server found for .${tld}`, source: 'rdap' };
  }

  try {
    const resp = await fetch(`${server}/domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: 'application/rdap+json' },
      signal: AbortSignal.timeout(12000),
    });

    if (resp.status === 404) {
      return { success: false, error: 'Domain not found in RDAP', source: 'rdap', rdap_supported: true };
    }
    if (!resp.ok) {
      return { success: false, error: `RDAP returned ${resp.status}`, source: 'rdap' };
    }

    const data = await resp.json();
    return { success: true, source: 'rdap', rdap_supported: true, data };
  } catch (e) {
    return { success: false, error: `RDAP fetch failed: ${e.message}`, source: 'rdap' };
  }
}

async function queryIp(ip) {
  const resp = await fetch(`https://rdap.arin.net/registry/ip/${encodeURIComponent(ip)}`, {
    headers: { Accept: 'application/rdap+json' },
    signal: AbortSignal.timeout(12000),
  });

  if (!resp.ok) {
    // Fallback to RIPE
    const ripe = await fetch(`https://rdap.db.ripe.net/ip/${encodeURIComponent(ip)}`, {
      headers: { Accept: 'application/rdap+json' },
      signal: AbortSignal.timeout(12000),
    });
    if (!ripe.ok) return { success: false, error: `RDAP returned ${resp.status}`, source: 'rdap' };
    const data = await ripe.json();
    return { success: true, source: 'rdap', data };
  }

  const data = await resp.json();
  return { success: true, source: 'rdap', data };
}

async function queryAsn(asn) {
  const num = asn.replace(/^AS/i, '');
  const resp = await fetch(`https://rdap.arin.net/registry/autnum/${num}`, {
    headers: { Accept: 'application/rdap+json' },
    signal: AbortSignal.timeout(12000),
  });

  if (!resp.ok) {
    const ripe = await fetch(`https://rdap.db.ripe.net/autnum/${num}`, {
      headers: { Accept: 'application/rdap+json' },
      signal: AbortSignal.timeout(12000),
    });
    if (!ripe.ok) return { success: false, error: `RDAP returned ${resp.status}`, source: 'rdap' };
    const data = await ripe.json();
    return { success: true, source: 'rdap', data };
  }

  const data = await resp.json();
  return { success: true, source: 'rdap', data };
}

module.exports = { queryDomain, queryIp, queryAsn, getRdapServer };
