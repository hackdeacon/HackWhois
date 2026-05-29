/**
 * Normalizer — merges data from multiple sources into the unified schema.
 */

function normalize(queryType, registration, dns, http, ssl, source) {
  if (queryType === 'domain') {
    return normalizeDomain(registration, dns, http, ssl, source);
  }
  if (queryType === 'ip') {
    return normalizeIp(registration, source);
  }
  if (queryType === 'asn') {
    return normalizeAsn(registration, source);
  }
  return { error: 'Unknown query type' };
}

function normalizeDomain(reg, dns, http, ssl, source) {
  const result = {
    domain: reg.domain || null,
    tld: reg.tld || null,
    registered: reg.registered !== false,
    created_at: reg.created_at || null,
    updated_at: reg.updated_at || null,
    expires_at: reg.expires_at || null,
    registrar: {
      name: reg.registrar?.name || null,
      url: reg.registrar?.url || null,
      abuse_email: reg.registrar?.abuse_email || null,
    },
    registrant: {
      name: reg.registrant?.name || null,
      org: reg.registrant?.org || null,
      country: reg.registrant?.country || null,
    },
    status: reg.status || [],
    nameservers: reg.nameservers || [],
    dns: {
      a: dns?.a || [],
      aaaa: dns?.aaaa || [],
      mx: dns?.mx || [],
      ns: dns?.ns || [],
      txt: dns?.txt || [],
      soa: dns?.soa || [],
      cname: dns?.cname || [],
    },
    ssl: ssl?.success ? {
      issuer: ssl.data.issuer || null,
      valid_from: ssl.data.valid_from || null,
      valid_to: ssl.data.valid_to || null,
      subject: ssl.data.subject || null,
      alt_names: ssl.data.alt_names || [],
      protocol: ssl.data.protocol || null,
    } : null,
    hosting: {
      cdn: http?.cdn || null,
      provider: detectProvider(reg.nameservers, dns?.a),
      ip: dns?.a?.map(r => r.value) || [],
      country: reg.registrant?.country || null,
    },
    rdap_supported: reg.rdap_supported !== false,
    source: source || reg.source || 'unknown',
    raw: {
      registration: reg.raw || null,
      dns: dns || null,
      http: http || null,
    },
  };

  return result;
}

function normalizeIp(reg, source) {
  return {
    query: reg.query || null,
    type: 'ip',
    net_range: reg.net_range || null,
    cidr: reg.cidr || null,
    net_name: reg.net_name || null,
    org: reg.org || { name: null, id: null, country: null },
    created_at: reg.created_at || null,
    updated_at: reg.updated_at || null,
    source: source || reg.source || 'unknown',
    raw: reg.raw || reg.raw_fields || null,
  };
}

function normalizeAsn(reg, source) {
  return {
    query: reg.query || null,
    type: 'asn',
    as_number: reg.as_number || null,
    as_name: reg.as_name || null,
    org: reg.org || { name: null, country: null },
    status: reg.status || [],
    source: source || reg.source || 'unknown',
    raw: reg.raw || reg.raw_fields || null,
  };
}

function detectProvider(nameservers, aRecords) {
  const ns = (nameservers || []).map(n => n.toLowerCase());
  for (const n of ns) {
    if (n.includes('cloudflare')) return 'Cloudflare';
    if (n.includes('awsdns')) return 'AWS';
    if (n.includes('google')) return 'Google Cloud';
    if (n.includes('vercel')) return 'Vercel';
    if (n.includes('netlify')) return 'Netlify';
    if (n.includes('digitalocean')) return 'DigitalOcean';
  }
  return null;
}

module.exports = { normalize };
