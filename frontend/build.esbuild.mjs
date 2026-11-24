#!/usr/bin/env node
/**
 * esbuild 生产构建脚本
 *
 * 原因：Vite build (Rollup) 在此环境内存受限 (~2GB)，Rollup 阶段 OOM 被杀。
 * 改用 esbuild (Rust 原生，内存高效) 生成生产 bundle。
 *
 * 用法：node build.esbuild.mjs
 */
import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = path.resolve(import.meta.dirname || '.');
const outdir = path.join(root, 'dist');

// 清空 dist
fs.rmSync(outdir, { recursive: true, force: true });
fs.mkdirSync(outdir, { recursive: true });

// 环境变量 define
const defines = {
  'import.meta.env.DEV': 'false',
  'import.meta.env.VITE_API_BASE_URL': '"/api"',
  'import.meta.env.VITE_API_TIMEOUT': '"30000"',
  'import.meta.env.VITE_PREMIUM_API_BASE_URL': '"/premium-api"',
};

async function main() {
  const result = await build({
    entryPoints: ['src/main.jsx'],
    bundle: true,
    loader: {
      '.js': 'jsx',
      '.jsx': 'jsx',
      '.css': 'css',
      '.png': 'file',
      '.woff2': 'file',
      '.hdr': 'file',
      '.svg': 'file',
      '.jpg': 'file',
      '.gif': 'file',
    },
    outdir,
    format: 'iife',
    globalName: 'AppBundle',
    entryNames: 'assets/js/[name]-[hash]',
    chunkNames: 'assets/js/chunks/[name]-[hash]',
    assetNames: '[ext]/[name]-[hash]',
    define: defines,
    minify: true,
    logLevel: 'info',
  });

  // 移动 CSS 到 assets/css
  const jsFiles = fs.readdirSync(path.join(outdir, 'assets/js'));
  const cssFiles = jsFiles.filter(f => f.endsWith('.css'));
  if (cssFiles.length) {
    fs.mkdirSync(path.join(outdir, 'assets/css'), { recursive: true });
    cssFiles.forEach(f => {
      fs.renameSync(
        path.join(outdir, 'assets/js', f),
        path.join(outdir, 'assets/css', f)
      );
    });
  }

  // 拷贝 public 静态资源
  const publicDir = path.join(root, 'public');
  if (fs.existsSync(publicDir)) {
    fs.cpSync(publicDir, outdir, { recursive: true });
  }

  // 生成 index.html
  const jsName = fs.readdirSync(path.join(outdir, 'assets/js')).find(f => f.endsWith('.js'));
  const cssName = fs.readdirSync(path.join(outdir, 'assets/css')).find(f => f.endsWith('.css')) || '';
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IDC设备管理系统</title>
  ${cssName ? `<link rel="stylesheet" href="/assets/css/${cssName}">` : ''}
</head>
<body>
  <div id="root"></div>
  <script src="/assets/js/${jsName}"></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(outdir, 'index.html'), html);

  console.log(`\n✅ Build complete: ${jsName}${cssName ? ', ' + cssName : ''}`);
  console.log(`   dist size: ${(fs.readdirSync(outdir).reduce((a, f) => a + fs.statSync(path.join(outdir, f)).size, 0) / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
