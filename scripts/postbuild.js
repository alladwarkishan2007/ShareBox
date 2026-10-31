import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');

if (fs.existsSync(distDir)) {
  // 1. Create 404.html for SPA routing fallback and _redirects for Netlify
  const indexHtml = path.join(distDir, 'index.html');
  const notFoundHtml = path.join(distDir, '404.html');
  const redirectsFile = path.join(distDir, '_redirects');

  if (fs.existsSync(indexHtml)) {
    fs.copyFileSync(indexHtml, notFoundHtml);
    console.log('[Postbuild] Created dist/404.html');
  }

  fs.writeFileSync(redirectsFile, '/*    /index.html   200\n');
  console.log('[Postbuild] Created dist/_redirects for Netlify');

  // 2. Compatibility aliases for cached bundles
  const assetsDir = path.join(distDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    const jsBundle = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
    if (jsBundle) {
      // Alias to index-C3-kpZkb.js for browsers with cached HTML
      const legacyAlias = path.join(assetsDir, 'index-C3-kpZkb.js');
      if (!fs.existsSync(legacyAlias)) {
        fs.copyFileSync(path.join(assetsDir, jsBundle), legacyAlias);
        console.log(`[Postbuild] Created compatibility alias index-C3-kpZkb.js -> ${jsBundle}`);
      }
    }

    // 3. Duplicate assets into /ShareBox/assets for absolute-path subfolder compatibility
    const shareboxSubdir = path.join(distDir, 'ShareBox');
    const shareboxAssetsDir = path.join(shareboxSubdir, 'assets');
    fs.mkdirSync(shareboxAssetsDir, { recursive: true });

    // Copy all assets into /ShareBox/assets
    for (const f of files) {
      fs.copyFileSync(path.join(assetsDir, f), path.join(shareboxAssetsDir, f));
    }
    fs.copyFileSync(indexHtml, path.join(shareboxSubdir, 'index.html'));
    console.log('[Postbuild] Created /ShareBox/ subfolder fallback in dist');
  }
}
