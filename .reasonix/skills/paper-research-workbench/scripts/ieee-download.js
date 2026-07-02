/**
 * ieee-download.js — IEEE Xplore PDF download (cross-browser)
 *
 * Usage:
 *   node ieee-download.js --arnumber <n> [--save-as <path>] [--timeout <ms>]
 *
 * Uses fetch() via Playwright context to grab the PDF directly.
 * No download event, no PDF viewer, no browser-specific hacks.
 */

const { launch, DOWNLOAD_DIR } = require('./_browser');
const fs = require('fs');
const path = require('path');

function opt(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const arnumber = opt('--arnumber', '');
const saveAsPath = opt('--save-as', '');
const dlTimeout = parseInt(opt('--timeout', '60000'));

if (!arnumber) {
  console.error('Usage: node ieee-download.js --arnumber <n> [--save-as <path>] [--timeout 60000]');
  process.exit(1);
}

const stampPDF = 'https://ieeexplore.ieee.org/stampPDF/getPDF.jsp?tp=&arnumber=' + arnumber;

(async () => {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const { browser, page } = await launch();

  // Quick login check
  await page.goto('https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=test', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await page.waitForTimeout(2000);
  const loginOk = await page.evaluate(() => {
    const t = (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 8000);
    return /\bSign Out\b/i.test(t) || /Access provided by/i.test(t);
  });
  if (!loginOk) { console.log(JSON.stringify({ error: 'not logged in' })); await browser.close(); return; }

  // Fetch PDF via context.request — bypass PDF viewer, works in any browser
  try {
    const resp = await page.context().request.fetch(stampPDF, { timeout: dlTimeout });
    const buf = Buffer.from(await resp.body());

    if (buf.length < 1024 || !buf.slice(0, 4).equals(Buffer.from('%PDF'))) {
      console.log(JSON.stringify({ error: 'invalid PDF response', size: buf.length }));
      await browser.close();
      return;
    }

    // Determine filename
    const disp = resp.headers()['content-disposition'] || '';
    const fnMatch = disp.match(/filename[^;=\n]*=["']?([^"';\n]*)["']?/);
    const filename = fnMatch ? fnMatch[1] : 'paper-' + arnumber + '.pdf';
    const dest = saveAsPath || path.join(DOWNLOAD_DIR, filename);
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    fs.writeFileSync(dest, buf);
    console.log(JSON.stringify({
      ok: true, arnumber,
      download: { name: filename, path: dest, size: buf.length }
    }, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ error: 'fetch failed: ' + e.message }));
  }

  await browser.close();
})();
