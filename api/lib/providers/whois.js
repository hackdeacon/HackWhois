/**
 * WHOIS Provider — raw WHOIS protocol queries.
 * Fallback when RDAP is unavailable.
 */
const whois = require('whois');

function lookupRaw(query, server) {
  return new Promise((resolve, reject) => {
    const opts = { follow: 3, timeout: 10000 };
    if (server) opts.server = server;
    whois.lookup(query, opts, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

async function queryDomain(domain) {
  try {
    const raw = await lookupRaw(domain);
    return { success: true, source: 'whois', raw };
  } catch (e) {
    return { success: false, error: e.message, source: 'whois' };
  }
}

async function queryIp(ip) {
  try {
    const raw = await lookupRaw(ip);
    return { success: true, source: 'whois', raw };
  } catch (e) {
    return { success: false, error: e.message, source: 'whois' };
  }
}

async function queryAsn(asn) {
  const num = asn.replace(/^AS/i, '');
  try {
    const raw = await lookupRaw(`AS${num}`);
    return { success: true, source: 'whois', raw };
  } catch (e) {
    return { success: false, error: e.message, source: 'whois' };
  }
}

module.exports = { queryDomain, queryIp, queryAsn };
