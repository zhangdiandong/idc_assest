/**
 * IDC 设备管理系统 - 生产环境静态服务器（零依赖）
 *
 * 作用：替代 `serve -s dist -l 8080`
 *  1. 提供前端 dist 静态文件（SPA）
 *  2. 将 /api、/uploads、/health、/api-docs 反向代理到后端 localhost:8000
 *
 * 解决：`serve` 纯静态服务器不代理 /api，导致登录/数据接口返回 index.html
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const FRONT_PORT = parseInt(process.env.FRONT_PORT, 10) || 8080;
const BACKEND_TARGET = process.env.BACKEND_TARGET || 'http://localhost:8000';
const DIST_DIR = path.resolve(__dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

// 需要代理到后端的路径前缀
const PROXY_PREFIXES = ['/api', '/uploads', '/health', '/api-docs', '/premium-api'];

function proxyRequest(req, res) {
  const target = new URL(BACKEND_TARGET);
  const proxyReq = http.request(
    {
      hostname: target.hostname,
      port: target.port,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: target.host,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    console.error(`[proxy] ${req.method} ${req.url} -> ${BACKEND_TARGET} 失败:`, err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    }
    res.end(
      JSON.stringify({
        success: false,
        message: `后端服务不可用: ${err.message}`,
      })
    );
  });

  req.pipe(proxyReq);
}

function serveStatic(req, res, urlPath) {
  // 去掉查询字符串
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  // 防止路径穿越
  const safePath = path.normalize(cleanPath).replace(/^(\.\.[/\\])+/, '');

  let filePath = path.join(DIST_DIR, safePath);
  // 确保在 dist 内
  if (!filePath.startsWith(DIST_DIR)) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html'); // SPA fallback
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
      return;
    }
    // 静态资源缓存
    const isAsset = /\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|ico|webp)$/.test(ext);
    const headers = {
      'Content-Type': contentType,
      'Content-Length': data.length,
    };
    if (isAsset) {
      headers['Cache-Control'] = 'public, max-age=2592000, immutable'; // 30 天
    } else {
      headers['Cache-Control'] = 'no-cache';
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const reqPath = req.url.split('?')[0];

  // 判断是否代理
  const shouldProxy = PROXY_PREFIXES.some(
    (prefix) => reqPath === prefix || reqPath.startsWith(prefix + '/')
  );

  if (shouldProxy) {
    return proxyRequest(req, res);
  }

  // 根路径直接返回 index.html
  if (reqPath === '/' || reqPath === '') {
    return serveStatic(req, res, '/index.html');
  }

  return serveStatic(req, res, req.url);
});

server.listen(FRONT_PORT, () => {
  console.log(`[idc-frontend] 静态服务器运行于 http://localhost:${FRONT_PORT}`);
  console.log(`[idc-frontend] API 代理 -> ${BACKEND_TARGET}`);
  console.log(`[idc-frontend] 静态目录 -> ${DIST_DIR}`);
});
