/**
 * Enricher — orchestrates parallel DNS + HTTP + SSL enrichment.
 */
const dnsProvider = require('./providers/dns');
const httpProvider = require('./providers/http');
const sslProvider = require('./providers/ssl');
const { detectCDN, detectHosting, detectParked } = require('./detect');

async function enrich(domain) {
  const [dns, http, ssl] = await Promise.all([
    dnsProvider.resolveAll(domain).catch(() => ({})),
    httpProvider.probe(domain).catch(() => ({ status: null, cdn: null, redirect_chain: [] })),
    sslProvider.getCertificate(domain).catch(() => ({ success: false })),
  ]);

  return { dns, http, ssl };
}

module.exports = { enrich };
