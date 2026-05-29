/**
 * WHOIS Parser — normalizes raw WHOIS text into standard fields.
 */

function normalizeDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch { return null; }
}

function parseKeyValue(raw) {
  const fields = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^\s*([^:]+?):\s*(.+)/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      if (key && val) {
        if (!fields[key]) fields[key] = val;
        else if (Array.isArray(fields[key])) fields[key].push(val);
        else fields[key] = [fields[key], val];
      }
    }
  }
  return fields;
}

function findField(fields, keys) {
  for (const k of keys) {
    if (fields[k]) return fields[k];
    const lower = k.toLowerCase();
    for (const dk of Object.keys(fields)) {
      if (dk.toLowerCase() === lower) return fields[dk];
    }
  }
  return null;
}

function findFields(fields, keys) {
  for (const k of keys) {
    if (fields[k]) return Array.isArray(fields[k]) ? fields[k] : [fields[k]];
  }
  return [];
}

function parseDomain(raw, domain) {
  const fields = parseKeyValue(raw);

  return {
    domain: findField(fields, ['Domain Name', 'domain', 'Domain']) || domain,
    tld: domain.split('.').pop().toLowerCase(),
    registered: true,
    created_at: normalizeDate(findField(fields, ['Creation Date', 'Registration Time', 'Created', 'created'])),
    updated_at: normalizeDate(findField(fields, ['Updated Date', 'Last Modified', 'Last Updated', 'last-update'])),
    expires_at: normalizeDate(findField(fields, ['Registry Expiry Date', 'Expiration Time', 'Expiry Date', 'expires'])),
    registrar: {
      name: findField(fields, ['Registrar', 'Sponsoring Registrar', 'registrar']),
      url: findField(fields, ['Registrar URL', 'registrar-url']),
      abuse_email: findField(fields, ['Registrar Abuse Contact Email', 'abuse-mailbox']),
    },
    registrant: {
      name: findField(fields, ['Registrant', 'Registrant Name', 'registrant']),
      org: findField(fields, ['Registrant Organization', 'Registrant Organisation']),
      country: findField(fields, ['Registrant Country', 'registrant-country']),
    },
    status: findFields(fields, ['Domain Status', 'Status', 'status']),
    nameservers: findFields(fields, ['Name Server', 'Name Servers', 'nserver', 'nameservers'])
      .map(ns => ns.toLowerCase()),
    dnssec: findField(fields, ['DNSSEC', 'dnssec']) || null,
    source: 'whois',
    raw_text: raw,
    raw_fields: fields,
  };
}

function parseIp(raw, ip) {
  const fields = parseKeyValue(raw);

  return {
    query: ip,
    type: 'ip',
    net_range: findField(fields, ['NetRange', 'inetnum', 'inet6num']),
    cidr: findField(fields, ['CIDR', 'cidr']) ? [findField(fields, ['CIDR', 'cidr'])] : null,
    net_name: findField(fields, ['NetName', 'netname']),
    org: {
      name: findField(fields, ['OrgName', 'org-name', 'descr', 'Organization']),
      id: findField(fields, ['OrgId', 'org-id']),
      country: findField(fields, ['Country', 'country']),
    },
    created_at: normalizeDate(findField(fields, ['RegDate', 'created'])),
    updated_at: normalizeDate(findField(fields, ['Updated', 'last-modified'])),
    source: 'whois',
    raw_text: raw,
    raw_fields: fields,
  };
}

function parseAsn(raw, asn) {
  const fields = parseKeyValue(raw);

  return {
    query: asn,
    type: 'asn',
    as_number: findField(fields, ['aut-num', 'ASNumber', 'as-number']) || asn,
    as_name: findField(fields, ['as-name', 'ASName', 'descr']),
    org: {
      name: findField(fields, ['org-name', 'OrgName', 'descr']),
      country: findField(fields, ['Country', 'country']),
    },
    status: findFields(fields, ['Status', 'status']),
    source: 'whois',
    raw_text: raw,
    raw_fields: fields,
  };
}

module.exports = { parseDomain, parseIp, parseAsn };
