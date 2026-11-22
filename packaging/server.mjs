#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOST = process.env.PFLEGERUST_HOST || '0.0.0.0';
const PORT = Number.parseInt(process.env.PFLEGERUST_PORT || '8080', 10);
const WWW_DIR = path.resolve(process.env.PFLEGERUST_WWW_DIR || path.join(__dirname, 'www'));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const NO_CACHE_FILES = new Set(['/index.html', '/sw.js', '/registerSW.js', '/manifest.webmanifest']);

function sendFile(res, filePath, urlPath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const cacheControl = NO_CACHE_FILES.has(urlPath)
    ? 'no-cache, no-store, must-revalidate'
    : urlPath.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=3600';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });

  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end('Internal Server Error');
  });
  stream.pipe(res);
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname;
  try {
    pathname = decodeURIComponent(parsedUrl.pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  if (pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok\n');
    return;
  }

  const normalized = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  const requestedPath = path.resolve(WWW_DIR, `.${normalized}`);

  // Prevent path traversal outside WWW_DIR
  if (!requestedPath.startsWith(WWW_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(requestedPath, (err, stats) => {
    if (!err && stats.isFile()) {
      sendFile(res, requestedPath, pathname);
      return;
    }

    // SPA fallback to index.html
    const indexPath = path.join(WWW_DIR, 'index.html');
    fs.stat(indexPath, (indexErr, indexStats) => {
      if (indexErr || !indexStats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }
      sendFile(res, indexPath, '/index.html');
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`PflegeRust listening on http://${HOST}:${PORT} (root: ${WWW_DIR})`);
});
