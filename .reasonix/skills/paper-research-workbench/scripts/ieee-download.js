/**
 * ieee-download.js — IEEE Xplore PDF download (one-shot)
 *
 * Usage:
 *   node ieee-download.js --arnumber <n> [--save-as <path>] [--timeout <ms>]
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
  await page.goto('https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=test', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  const loginOk = await page.evaluate(() => {
    const t = (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 8000);
    return /\bSign Out\b/i.test(t) || /Access provided by/i.test(t);
  });
  if (!loginOk) { console.log(JSON.stringify({ error: 'not logged in' })); await browser.close(); return; }

  const result = await new Promise(resolve => {
    const t = setTimeout(() => resolve({ error: 'download timeout' }), dlTimeout);

    page.on('download', async (dl) => {
      const dest = saveAsPath || path.join(DOWNLOAD_DIR, dl.suggestedFilename());
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      try {
        const stream = await dl.createReadStream();
        const ws = fs.createWriteStream(dest);
        await new Promise((res, rej) => { stream.pipe(ws); ws.on('finish', res); ws.on('error', rej); stream.on('error', rej); });
      } catch (_) { await dl.saveAs(dest); }
      clearTimeout(t);
      resolve({ ok: true, arnumber, download: { name: dl.suggestedFilename(), path: dest, size: fs.statSync(dest).size } });
    });

    page.goto(stampPDF, { timeout: 15000, waitUntil: 'commit' }).catch(() => {});
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
