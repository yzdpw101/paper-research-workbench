/**
 * ieee-figures.js — IEEE Xplore figure extraction + download
 *
 * Usage:
 *   node ieee-figures.js --arnumber <n> --out-dir <dir>
 *
 * Navigates to detail page, clicks Figures tab, extracts large images,
 * saves to output directory. Returns list of saved files.
 */

const { launch } = require('./_browser');
const fs = require('fs');
const path = require('path');

function opt(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const arnumber = opt('--arnumber', '');
const outDir = opt('--out-dir', '');

if (!arnumber || !outDir) {
  console.error('Usage: node ieee-figures.js --arnumber <n> --out-dir <dir>');
  process.exit(1);
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });

  const { browser, page } = await launch();

  // 1. Navigate to detail page
  const detailUrl = 'https://ieeexplore.ieee.org/document/' + arnumber + '/';
  await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 2. Click Figures tab
  const tabResult = await page.evaluate(() => {
    const links = document.querySelectorAll('a.document-tab-link');
    for (const link of links) {
      if (link.textContent && link.textContent.trim() === 'Figures') {
        link.click(); return { clicked: true };
      }
    }
    // Try broader selector
    const allLinks = document.querySelectorAll('a');
    for (const a of allLinks) {
      if ((a.textContent || '').trim() === 'Figures' || (a.getAttribute('href') || '').includes('figures')) {
        a.click(); return { clicked: true, via: 'fallback' };
      }
    }
    return { clicked: false };
  });

  if (!tabResult.clicked) {
    console.log(JSON.stringify({ error: 'no Figures tab found', details: tabResult }));
    await browser.close(); return;
  }

  await page.waitForTimeout(3000);

  // 3. Extract image URLs
  const figData = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img');
    const urls = [], names = [];
    imgs.forEach(img => {
      if (img.src && img.src.includes('mediastore/IEEE')) {
        const src = img.src.includes('-large') ? img.src : img.src.replace('-small', '-large');
        if (!urls.includes(src)) {
          urls.push(src);
          const m = src.match(/\/([^/]+)-large\./);
          names.push(m ? m[1] : 'fig_' + urls.length);
        }
      }
    });
    return { urls, names, count: urls.length };
  });

  if (figData.count === 0) {
    console.log(JSON.stringify({ error: 'no figures found — click Figures tab first' }));
    await browser.close();
    return;
  }

  // 4. Download each figure via request.fetch
  const results = [];
  for (let i = 0; i < figData.urls.length; i++) {
    try {
      const resp = await page.context().request.fetch(figData.urls[i]);
      const buf = Buffer.from(await resp.body());
      const ext = figData.urls[i].match(/\.(\w+)(?:\?|$)/)?.[1] || 'gif';
      const filename = figData.names[i] + '.' + ext;
      const filepath = path.join(outDir, filename);
      fs.writeFileSync(filepath, buf);
      results.push({ name: filename, path: filepath, size: buf.length });
    } catch (e) {
      results.push({ name: figData.names[i], error: e.message });
    }
  }

  console.log(JSON.stringify({
    ok: true,
    arnumber,
    figureCount: figData.count,
    saved: results.filter(r => r.path).length,
    failed: results.filter(r => r.error).length,
    files: results
  }, null, 2));

  await browser.close();
})();
