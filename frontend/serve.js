import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '5555', 10);
const HOST = '0.0.0.0';
const STATIC_DIR = path.resolve(__dirname, '../static');
const BACKEND_HOST = process.env.BACKEND_HOST || '127.0.0.1';
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '9000', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. Proxy API endpoints to FastAPI backend
  if (pathname.startsWith('/api')) {
    const proxyReq = http.request({
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${BACKEND_HOST}:${BACKEND_PORT}`
      }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Backend service unavailable', details: err.message }));
    });

    req.pipe(proxyReq);
    return;
  }

  // 2. Serve static files from static directory
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const ext = path.extname(safePath).toLowerCase();
  const hasAssetExt = Boolean(ext && ext !== '.html');

  let targetFile = null;
  try {
    const candidate = path.join(STATIC_DIR, safePath);
    if (fs.existsSync(candidate)) {
      const stat = fs.statSync(candidate);
      if (stat.isFile()) {
        targetFile = candidate;
      } else if (stat.isDirectory()) {
        const indexCandidate = path.join(candidate, 'index.html');
        if (fs.existsSync(indexCandidate)) {
          targetFile = indexCandidate;
        }
      }
    }
  } catch {
    // Stat error, continue to fallback
  }

  // If asset not found, return 404 for asset files (prevent serving HTML for missing images/css/js)
  if (!targetFile && hasAssetExt) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  // SPA fallback to index.html for navigation routes
  if (!targetFile) {
    targetFile = path.join(STATIC_DIR, 'index.html');
  }

  if (!fs.existsSync(targetFile)) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Frontend build missing. Please run pnpm build first.');
    return;
  }

  const targetExt = path.extname(targetFile).toLowerCase();
  const contentType = MIME_TYPES[targetExt] || 'application/octet-stream';
  const headers = { 'Content-Type': contentType };

  if (pathname.startsWith('/_astro/')) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else if (targetExt === '.html') {
    headers['Cache-Control'] = 'no-cache';
  }

  res.writeHead(200, headers);
  fs.createReadStream(targetFile).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`[kaitoon-frontend] Production server listening on http://${HOST}:${PORT}`);
});
