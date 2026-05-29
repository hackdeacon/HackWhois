/**
 * Detection — CDN, hosting provider, and parked domain detection.
 */

function detectCDN(headers, server) {
  const h = headers || {};
  const s = (server || '').toLowerCase();

  if (h['cf-ray']) return 'Cloudflare';
  if (h['x-vercel-id']) return 'Vercel';
  if (h['x-nf-request-id']) return 'Netlify';
  if (h['x-fastly-request-id']) return 'Fastly';
  if (h['x-amz-cf-id']) return 'AWS CloudFront';
  if (h['x-azure-ref']) return 'Azure CDN';

  if (s.includes('cloudflare')) return 'Cloudflare';
  if (s.includes('amazon')) return 'AWS';
  if (s.includes('gws') || s.includes('gse')) return 'Google';

  return null;
}

function detectHosting(nameservers, ips) {
  const ns = (nameservers || []).map(n => n.toLowerCase());
  const ipStr = (ips || []).join(' ');

  // NS-based detection
  for (const n of ns) {
    if (n.includes('cloudflare')) return 'Cloudflare';
    if (n.includes('awsdns')) return 'AWS Route 53';
    if (n.includes('googledomains') || n.includes('google.com')) return 'Google Cloud';
    if (n.includes('vercel')) return 'Vercel';
    if (n.includes('netlify')) return 'Netlify';
    if (n.includes('digitalocean')) return 'DigitalOcean';
    if (n.includes('linode')) return 'Linode';
    if (n.includes('azure')) return 'Azure';
    if (n.includes('dns-parking')) return 'Parked';
  }

  return null;
}

function detectParked(nameservers, httpBody) {
  const ns = (nameservers || []).map(n => n.toLowerCase());

  // NS patterns common with parked domains
  const parkNs = ['dns-parking', 'parklogic', 'above', 'sedoparking', 'domainlore', 'undeveloped'];
  for (const n of ns) {
    if (parkNs.some(p => n.includes(p))) return true;
  }

  return false;
}

module.exports = { detectCDN, detectHosting, detectParked };
