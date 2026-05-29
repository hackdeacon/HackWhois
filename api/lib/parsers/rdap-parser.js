/**
 * RDAP Parser — normalizes RDAP JSON into standard fields.
 */

function normalizeDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch { return null; }
}

function extractVcard(entities, role) {
  const results = [];
  for (const entity of entities || []) {
    const roles = entity.roles || [];
    if (roles.includes(role)) {
      const vc = entity.vcardArray?.[1] || [];
      const get = (name) => vc.find(v => v[0] === name)?.[3] || null;
      results.push({
        name: get('fn') || entity.handle || null,
        org: (get('org') || [])[0] || null,
        email: get('email')?.replace('mailto:', '') || null,
        phone: get('tel')?.replace('tel:', '') || null,
        country: vc.find(v => v[0] === 'adr')?.[1]?.cc || null,
        address: get('adr')?.filter(s => s && s.trim()) || null,
        handle: entity.handle || null,
      });
    }
    // Recurse into nested entities
    if (entity.entities?.length) {
      results.push(...extractVcard(entity.entities, role));
    }
  }
  return results;
}

function parseDomain(rdap, domain) {
  const result = {
    domain: rdap.ldhName || domain,
    tld: domain.split('.').pop().toLowerCase(),
    registered: true,
    created_at: null,
    updated_at: null,
    expires_at: null,
    registrar: { name: null, url: null, abuse_email: null },
    registrant: { name: null, org: null, country: null },
    status: [],
    nameservers: [],
    dnssec: null,
    rdap_supported: true,
    raw: rdap,
  };

  // Events
  for (const evt of rdap.events || []) {
    const date = normalizeDate(evt.eventDate);
    switch (evt.eventAction) {
      case 'registration': result.created_at = date; break;
      case 'expiration': result.expires_at = date; break;
      case 'last changed': case 'last update of RDAP database': result.updated_at = date; break;
    }
  }

  // Nameservers
  result.nameservers = (rdap.nameservers || []).map(ns => (ns.ldhName || '').toLowerCase()).filter(Boolean);

  // Status
  result.status = rdap.status || [];

  // Entities
  const registrars = extractVcard(rdap.entities, 'registrar');
  if (registrars.length > 0) {
    result.registrar.name = registrars[0].name;
    result.registrar.abuse_email = registrars[0].email;
  }

  const registrants = extractVcard(rdap.entities, 'registrant');
  if (registrants.length > 0) {
    result.registrant.name = registrants[0].name;
    result.registrant.org = registrants[0].org;
    result.registrant.country = registrants[0].country;
  }

  // DNSSEC
  if (rdap.secureDNS) {
    result.dnssec = rdap.secureDNS.delegationSigned ? 'signed' : 'unsigned';
  }

  return result;
}

function parseIp(rdap, ip) {
  const result = {
    query: ip,
    type: 'ip',
    net_range: null,
    cidr: null,
    net_name: null,
    org: { name: null, id: null, country: null },
    created_at: null,
    updated_at: null,
    raw: rdap,
  };

  if (rdap.startAddress && rdap.endAddress) {
    result.net_range = `${rdap.startAddress} - ${rdap.endAddress}`;
  }
  if (rdap.cidr0_cidrs) {
    result.cidr = rdap.cidr0_cidrs.map(c => `${c.v4prefix || c.v6prefix}/${c.length}`);
  }
  result.net_name = rdap.name || null;
  result.org.country = rdap.country || null;

  for (const evt of rdap.events || []) {
    const date = normalizeDate(evt.eventDate);
    if (evt.eventAction === 'registration') result.created_at = date;
    if (evt.eventAction === 'last changed') result.updated_at = date;
  }

  const findOrg = (entities) => {
    for (const e of entities || []) {
      if ((e.roles || []).includes('registrant')) {
        return { name: e.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || e.handle, id: e.handle };
      }
      const nested = findOrg(e.entities);
      if (nested) return nested;
    }
    return null;
  };

  const org = findOrg(rdap.entities);
  if (org) {
    result.org.name = org.name;
    result.org.id = org.id;
  }

  return result;
}

function parseAsn(rdap, asn) {
  const result = {
    query: asn,
    type: 'asn',
    as_number: rdap.handle || (rdap.startAutnum ? `AS${rdap.startAutnum}` : asn),
    as_name: rdap.name || null,
    org: { name: null, country: null },
    status: rdap.status || [],
    raw: rdap,
  };

  const findOrg = (entities) => {
    for (const e of entities || []) {
      if ((e.roles || []).includes('registrant')) {
        return { name: e.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || e.handle, country: e.country || null };
      }
      const nested = findOrg(e.entities);
      if (nested) return nested;
    }
    return null;
  };

  const org = findOrg(rdap.entities);
  if (org) {
    result.org.name = org.name;
    result.org.country = org.country;
  }

  return result;
}

module.exports = { parseDomain, parseIp, parseAsn };
