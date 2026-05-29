/**
 * Export — download results as JSON or CSV.
 */
const Exporter = (() => {
  function download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportJSON(data, filename) {
    const clean = sanitizeForExport(data);
    const json = JSON.stringify(clean, null, 2);
    download(json, filename || 'whois-result.json', 'application/json');
  }

  function exportCSV(data, filename) {
    const rows = Array.isArray(data) ? data : [data];
    const flat = rows.map(r => flattenObject(r));
    const headers = [...new Set(flat.flatMap(r => Object.keys(r)))];

    const csv = [
      headers.map(csvEscape).join(','),
      ...flat.map(row =>
        headers.map(h => csvEscape(row[h] ?? '')).join(',')
      ),
    ].join('\n');

    download(csv, filename || 'whois-result.csv', 'text/csv');
  }

  function sanitizeForExport(data) {
    if (Array.isArray(data)) return data.map(sanitizeForExport);
    if (data && typeof data === 'object') {
      const clean = {};
      for (const [k, v] of Object.entries(data)) {
        if (k === 'raw' || k === 'allFields') continue; // Skip bulky fields
        clean[k] = sanitizeForExport(v);
      }
      return clean;
    }
    return data;
  }

  function flattenObject(obj, prefix = '') {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (k === 'raw' || k === 'allFields') continue;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        Object.assign(result, flattenObject(v, key));
      } else if (Array.isArray(v)) {
        result[key] = v.join('; ');
      } else {
        result[key] = v;
      }
    }
    return result;
  }

  function csvEscape(val) {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function getTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }

  return { exportJSON, exportCSV, getTimestamp };
})();
