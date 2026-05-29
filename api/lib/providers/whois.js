/**
 * WHOIS Provider — HTTP-based WHOIS queries.
 * Uses whoisjs.com API as fallback when RDAP is unavailable.
 */

const WHOISJS_BASE = 'https://whoisjs.com/api/v1';

async function fetchWhois(query) {
  const resp = await fetch(`${WHOISJS_BASE}/${encodeURIComponent(query)}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`whoisjs.com returned ${resp.status}`);
  const json = await resp.json();
  if (!json.success && !json.raw) throw new Error(json.message || 'whoisjs.com lookup failed');
  return json;
}

async function queryDomain(domain) {
  try {
    const json = await fetchWhois(domain);
    const raw = json.raw || JSON.stringify(json);
    return { success: true, source: 'whois', raw };
  } catch (e) {
    return { success: false, error: e.message, source: 'whois' };
  }
}

async function queryIp(ip) {
  try {
    const json = await fetchWhois(ip);
    const raw = json.raw || JSON.stringify(json);
    return { success: true, source: 'whois', raw };
  } catch (e) {
    return { success: false, error: e.message, source: 'whois' };
  }
}

async function queryAsn(asn) {
  try {
    const json = await fetchWhois(asn);
    const raw = json.raw || JSON.stringify(json);
    return { success: true, source: 'whois', raw };
  } catch (e) {
    return { success: false, error: e.message, source: 'whois' };
  }
}

module.exports = { queryDomain, queryIp, queryAsn };
