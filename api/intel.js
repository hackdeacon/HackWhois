/**
 * Domain Intelligence API — main entry point.
 * Serves both API (/:query) and static files (SPA catch-all).
 */
const rdap = require('./lib/providers/rdap');
const whois = require('./lib/providers/whois');
const rdapParser = require('./lib/parsers/rdap-parser');
const whoisParser = require('./lib/parsers/whois-parser');
const { enrich } = require('./lib/enricher');
const { normalize } = require('./lib/normalizer');

const fs = require('fs');
const path = require('path');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const SPA_ROUTES = ['/', '/batch', '/history'];
const STATIC_EXT = new Set(['.html', '.css', '.js', '.json', '.png', '.svg', '.ico']);

function detectType(query) {
  const q = query.trim();
  if (/^AS\d+$/i.test(q)) return 'asn';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(q)) return 'ip';
  if (/^[a-fA-F0-9:]+$/.test(q) && q.includes(':')) return 'ip';
  return 'domain';
}

function isQuery(pathname) {
  if (SPA_ROUTES.includes(pathname)) return false;
  if (STATIC_EXT.has(path.extname(pathname))) return false;
  return /^[\w.\-:]+$/.test(pathname.slice(1));
}

async function lookupDomain(domain) {
  const rdapResult = await rdap.queryDomain(domain);
  let registration, source;

  if (rdapResult.success) {
    registration = rdapParser.parseDomain(rdapResult.data, domain);
    registration.rdap_supported = true;
    source = 'rdap';
  } else {
    const whoisResult = await whois.queryDomain(domain);
    if (whoisResult.success) {
      registration = whoisParser.parseDomain(whoisResult.raw, domain);
      registration.rdap_supported = false;
      source = 'whois';
    } else {
      return { success: false, error: `Lookup failed: ${domain}`, query: domain, type: 'domain' };
    }
  }

  const { dns, http, ssl } = await enrich(domain);
  const normalized = normalize('domain', registration, dns, http, ssl, source);
  return { success: true, type: 'domain', data: normalized };
}

async function lookupIp(ip) {
  const rdapResult = await rdap.queryIp(ip);
  let registration, source;

  if (rdapResult.success) {
    registration = rdapParser.parseIp(rdapResult.data, ip);
    source = 'rdap';
  } else {
    const whoisResult = await whois.queryIp(ip);
    if (whoisResult.success) {
      registration = whoisParser.parseIp(whoisResult.raw, ip);
      source = 'whois';
    } else {
      return { success: false, error: `Lookup failed: ${ip}`, query: ip, type: 'ip' };
    }
  }

  const normalized = normalize('ip', registration, null, null, null, source);
  return { success: true, type: 'ip', data: normalized };
}

async function lookupAsn(asn) {
  const rdapResult = await rdap.queryAsn(asn);
  let registration, source;

  if (rdapResult.success) {
    registration = rdapParser.parseAsn(rdapResult.data, asn);
    source = 'rdap';
  } else {
    const whoisResult = await whois.queryAsn(asn);
    if (whoisResult.success) {
      registration = whoisParser.parseAsn(whoisResult.raw, asn);
      source = 'whois';
    } else {
      return { success: false, error: `Lookup failed: ${asn}`, query: asn, type: 'asn' };
    }
  }

  const normalized = normalize('asn', registration, null, null, null, source);
  return { success: true, type: 'asn', data: normalized };
}

function serveStatic(res, pathname) {
  const filePath = path.join(__dirname, '..', pathname);
  try {
    const content = fs.readFileSync(filePath);
    const mime = MIME[path.extname(pathname)] || 'application/octet-stream';
    res.writeHead(200, { ...CORS, 'Content-Type': mime });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

function serveSPA(res) {
  const filePath = path.join(__dirname, '..', 'index.html');
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { ...CORS, 'Content-Type': 'text/html; charset=utf-8' });
    res.end(content);
  } catch {
    res.writeHead(500, { ...CORS, 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  // Static files (known extensions only)
  if (STATIC_EXT.has(path.extname(pathname))) {
    if (serveStatic(res, pathname)) return;
  }

  // SPA routes → serve index.html
  if (SPA_ROUTES.includes(pathname)) {
    return serveSPA(res);
  }

  // API: extract query from path or query param or POST body
  let query;
  if (isQuery(pathname)) {
    query = decodeURIComponent(pathname.slice(1));
  } else if (req.method === 'POST' && req.body?.query) {
    query = req.body.query;
  } else {
    query = url.searchParams.get('query');
  }

  if (!query || !query.trim()) {
    res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Missing query' }));
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
