/**
 * ieee-download.js — IEEE Xplore PDF download
 *
 * Usage:
 *   node ieee-download.js --arnumber <n> [--save-as <path>] [--timeout <ms>]
 *
 * Uses page.goto(stampPDF) + download event to send browser cookies.
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

  const result = await new Promise(resolve => {
    const t = setTimeout(() => resolve({ error: 'download timeout' }), dlTimeout);

    page.on('download', async (dl) => {
      const filename = path.basename(dl.suggestedFilename());
      let dest;
      if (saveAsPath) {
        if ((fs.existsSync(saveAsPath) && fs.statSync(saveAsPath).isDirectory()) || !path.extname(saveAsPath)) {
          dest = path.join(saveAsPath, filename);
        } else {
          dest = saveAsPath;
        }
      } else {
        dest = path.join(DOWNLOAD_DIR, filename);
      }
      const dd = path.dirname(dest);
      if (!fs.existsSync(dd)) fs.mkdirSync(dd, { recursive: true });
      try {
        const stream = await dl.createReadStream();
        const ws = fs.createWriteStream(dest);
        await new Promise((res, rej) => { stream.pipe(ws); ws.on('finish', res); ws.on('error', rej); stream.on('error', rej); });
        clearTimeout(t);
        resolve({ ok: true, arnumber, download: { name: filename, path: dest, size: fs.statSync(dest).size } });
      } catch (e) {
        try { await dl.saveAs(dest); clearTimeout(t); resolve({ ok: true, arnumber, download: { name: filename, path: dest, size: fs.statSync(dest).size } }); }
        catch (e2) { clearTimeout(t); resolve({ error: 'save failed: ' + e.message }); }
      }
    });

    page.goto(stampPDF, { timeout: dlTimeout, waitUntil: 'commit' }).catch(() => {});
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
