/**
 * HTTP Probe Provider — fetches target domain to detect hosting, CDN, and status.
 */

async function probe(domain) {
  const result = {
    status: null,
    redirect_chain: [],
    server: null,
    cdn: null,
    headers: {},
  };

  try {
    let url = `https://${domain}`;
    let redirects = 0;
    const maxRedirects = 5;

    while (redirects < maxRedirects) {
      const resp = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'HackWHOIS/2.0 Domain Intelligence' },
      });

      result.redirect_chain.push({ url, status: resp.status });

      if (resp.status >= 300 && resp.status < 400) {
        const location = resp.headers.get('location');
        if (!location) break;
        url = location.startsWith('http') ? location : new URL(location, url).href;
        redirects++;
        continue;
      }

      result.status = resp.status;
      result.server = resp.headers.get('server');

      // Collect relevant headers
      const headerKeys = ['x-powered-by', 'x-vercel-id', 'x-nf-request-id', 'cf-ray',
        'x-served-by', 'x-cache', 'x-fastly-request-id', 'x-amz-cf-id',
        'x-azure-ref', 'x-akamai-transformed'];
      for (const key of headerKeys) {
        const val = resp.headers.get(key);
        if (val) result.headers[key] = val;
      }

      break;
    }

    result.cdn = detectCDN(result.headers, result.server);
  } catch (e) {
    // HTTP probe failed — try HTTP fallback
    try {
      const resp = await fetch(`http://${domain}`, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'HackWHOIS/2.0 Domain Intelligence' },
      });
      result.status = resp.status;
      result.server = resp.headers.get('server');
    } catch (e2) {
      // Both HTTPS and HTTP failed
    }
  }

  return result;
}

function detectCDN(headers, server) {
  if (headers['cf-ray'] || headers['x-fastly-request-id']) {
    if (headers['cf-ray']) return 'Cloudflare';
    return 'Fastly';
  }
  if (headers['x-vercel-id']) return 'Vercel';
  if (headers['x-nf-request-id']) return 'Netlify';
  if (headers['x-amz-cf-id'] || headers['x-azure-ref']) {
    if (headers['x-amz-cf-id']) return 'AWS CloudFront';
    return 'Azure CDN';
  }
  if (server) {
    const s = server.toLowerCase();
    if (s.includes('cloudflare')) return 'Cloudflare';
    if (s.includes('amazon')) return 'AWS';
    if (s.includes('gws') || s.includes('gse')) return 'Google';
    if (s.includes('nginx')) return 'Nginx';
    if (s.includes('apache')) return 'Apache';
  }
  return null;
}

module.exports = { probe };
