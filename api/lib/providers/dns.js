/**
 * DNS Provider — resolves DNS records using Node.js native dns module.
 */
const dns = require('dns').promises;
const { Resolver } = require('dns').promises;

const TYPES = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA'];

async function resolveAll(domain) {
  const results = {};

  const tasks = TYPES.map(async (type) => {
    try {
      let records;
      switch (type) {
        case 'A':
          records = (await dns.resolve4(domain, { ttl: true })).map(r => ({ value: r.address, ttl: r.ttl }));
          break;
        case 'AAAA':
          records = (await dns.resolve6(domain, { ttl: true })).map(r => ({ value: r.address, ttl: r.ttl }));
          break;
        case 'MX':
          records = (await dns.resolveMx(domain)).map(r => ({ priority: r.priority, exchange: r.exchange }));
          break;
        case 'NS':
          records = (await dns.resolveNs(domain)).map(r => ({ value: r }));
          break;
        case 'TXT':
          records = (await dns.resolveTxt(domain)).map(r => ({ value: r.join(' ') }));
          break;
        case 'CNAME':
          records = (await dns.resolveCname(domain)).map(r => ({ value: r }));
          break;
        case 'SOA':
          const soa = await dns.resolveSoa(domain);
          records = [{
            nsname: soa.nsname,
            hostmaster: soa.hostmaster,
            serial: soa.serial,
            refresh: soa.refresh,
            retry: soa.retry,
            expire: soa.expire,
            minttl: soa.minttl,
          }];
          break;
      }
      if (records && records.length > 0) {
        results[type.toLowerCase()] = records;
      }
    } catch (e) {
      // Record type not found or error — skip
    }
  });

  await Promise.all(tasks);
  return results;
}

module.exports = { resolveAll };
