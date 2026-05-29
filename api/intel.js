/**
 * Domain Intelligence API — main entry point.
 * RDAP → WHOIS fallback, DNS + HTTP enrichment, unified normalization.
 */
const rdap = require('./lib/providers/rdap');
const whois = require('./lib/providers/whois');
const rdapParser = require('./lib/parsers/rdap-parser');
const whoisParser = require('./lib/parsers/whois-parser');
const { enrich } = require('./lib/enricher');
const { normalize } = require('./lib/normalizer');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function detectType(query) {
  const q = query.trim();
  if (/^AS\d+$/i.test(q)) return 'asn';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(q)) return 'ip';
  if (/^[a-fA-F0-9:]+$/.test(q) && q.includes(':')) return 'ip';
  return 'domain';
}

async function lookupDomain(domain) {
  // Step 1: RDAP
  const rdapResult = await rdap.queryDomain(domain);
  let registration;
  let source;

  if (rdapResult.success) {
    registration = rdapParser.parseDomain(rdapResult.data, domain);
    registration.rdap_supported = true;
    source = 'rdap';
  } else {
    // Step 2: WHOIS fallback
    const whoisResult = await whois.queryDomain(domain);
    if (whoisResult.success) {
      registration = whoisParser.parseDomain(whoisResult.raw, domain);
      registration.rdap_supported = false;
      source = 'whois';
    } else {
      return {
        success: false,
        error: `All lookup methods failed for ${domain}. RDAP: ${rdapResult.error}. WHOIS: ${whoisResult.error}`,
        query: domain,
        type: 'domain',
      };
    }
  }

  // Step 3: DNS + HTTP + SSL enrichment (parallel)
  const { dns, http, ssl } = await enrich(domain);

  // Step 4: Normalize
  const normalized = normalize('domain', registration, dns, http, ssl, source);

  return { success: true, type: 'domain', data: normalized };
}

async function lookupIp(ip) {
  const rdapResult = await rdap.queryIp(ip);
  let registration;
  let source;

  if (rdapResult.success) {
    registration = rdapParser.parseIp(rdapResult.data, ip);
    source = 'rdap';
  } else {
    const whoisResult = await whois.queryIp(ip);
    if (whoisResult.success) {
      registration = whoisParser.parseIp(whoisResult.raw, ip);
      source = 'whois';
    } else {
      return { success: false, error: `Lookup failed for ${ip}`, query: ip, type: 'ip' };
    }
  }

  const normalized = normalize('ip', registration, null, null, null, source);
  return { success: true, type: 'ip', data: normalized };
}

async function lookupAsn(asn) {
  const rdapResult = await rdap.queryAsn(asn);
  let registration;
  let source;

  if (rdapResult.success) {
    registration = rdapParser.parseAsn(rdapResult.data, asn);
    source = 'rdap';
  } else {
    const whoisResult = await whois.queryAsn(asn);
    if (whoisResult.success) {
      registration = whoisParser.parseAsn(whoisResult.raw, asn);
      source = 'whois';
    } else {
      return { success: false, error: `Lookup failed for ${asn}`, query: asn, type: 'asn' };
    }
  }

  const normalized = normalize('asn', registration, null, null, null, source);
  return { success: true, type: 'asn', data: normalized };
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  const query = req.method === 'POST'
    ? req.body?.query
    : req.query?.query;

  if (!query || !query.trim()) {
    res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: "Missing 'query' parameter" }));
  }

  const q = query.trim();
  const type = detectType(q);

  try {
    let result;
    switch (type) {
      case 'ip': result = await lookupIp(q); break;
      case 'asn': result = await lookupAsn(q); break;
      default: result = await lookupDomain(q); break;
    }

    const status = result.success ? 200 : 500;
    res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(500, { ...CORS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: err.message, query: q, type }));
  }
};
