/**
 * Local dev server — all routes go through api/intel.js.
 * Usage: node server.js
 */
const http = require('http');
const path = require('path');

const PORT = 3456;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Collect POST body
  let body = '';
  if (req.method === 'POST') {
    for await (const chunk of req) body += chunk;
  }

  try {
    const handler = require('./api/intel.js');
    const url = new URL(req.url, `http://localhost:${PORT}`);

    const mockReq = {
      method: req.method,
      url: req.url,
      query: Object.fromEntries(url.searchParams),
      body: body ? JSON.parse(body) : {},
    };

    let statusCode = 200;
    let headers = {};
    let responseBody = '';

    const mockRes = {
      writeHead: (code, h) => { statusCode = code; Object.assign(headers, h); },
      end: (data) => { responseBody = data; },
    };

    await handler(mockReq, mockRes);

    res.writeHead(statusCode, headers);
    res.end(responseBody);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`\n  HackWhois dev server:\n`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → http://localhost:${PORT}/google.com\n`);
});
