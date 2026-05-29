/**
 * Local dev server — serves static files + API routes.
 * Usage: node server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // API route
  if (url.pathname.startsWith('/api/')) {
    return handleAPI(req, res, url);
  }

  // Static files
  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
  const ext = path.extname(filePath);

  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');

    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

async function handleAPI(req, res, url) {
  // Collect POST body
  let body = '';
  if (req.method === 'POST') {
    for await (const chunk of req) body += chunk;
  }

  try {
    // Load the API handler dynamically
    const handler = require('./api/intel.js');
    // Mock Vercel req/res
    const mockReq = {
      method: req.method,
      query: Object.fromEntries(url.searchParams),
      body: body ? JSON.parse(body) : {},
    };

    let statusCode = 200;
    let headers = { 'Content-Type': 'application/json' };
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
}

server.listen(PORT, () => {
  console.log(`\n  HackWHOIS dev server running at:\n`);
  console.log(`  → http://localhost:${PORT}\n`);
  console.log(`  API: http://localhost:${PORT}/api/intel?query=google.com\n`);
});
