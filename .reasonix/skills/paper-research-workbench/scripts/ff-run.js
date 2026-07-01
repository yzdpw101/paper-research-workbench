/**
 * ff-run.js — Run arbitrary Playwright code with page + context access
 * 
 * Usage:
 *   node ff-run.js (--code <js-body> | --code-file <path> | --stdin)
 *                  [--expect-download] [--save-as <path> | --download-dir <dir>]
 *                  [--no-close] [--profile <dir>]
 * 
 * The code string is executed as the body of:
 *   async (page, context) => { <code> }
 * 
 * --expect-download : Wait for a download event and save it
 * --save-as <path>   : Save download directly to this path (overrides --download-dir)
 * --download-dir     : Directory to save downloads (default: E:/Downloads/Firefox)
 * --no-close         : Keep browser open after execution
 * --profile <dir>    : Firefox profile path (default from FF_PROFILE_DIR env or hardcoded)
 * --timeout <ms>     : Download timeout in ms (default: 120000)
 */

const { firefox } = require('playwright');
const fs = require('fs');
const path = require('path');

function opt(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const PROFILE_DIR = process.env.FF_PROFILE_DIR || opt('--profile', 'C:/Users/Tel13/playwright-firefox-profile-v2');

let code = opt('--code', '');
const codeFile = opt('--code-file', '');
const useStdin = process.argv.includes('--stdin');
const expectDownload = process.argv.includes('--expect-download');
const saveAsPath = opt('--save-as', '');
const downloadDir = opt('--download-dir', 'E:/Downloads/Firefox');
const noClose = process.argv.includes('--no-close');
const dlTimeout = parseInt(opt('--timeout', '120000'));

if (codeFile) {
  code = fs.readFileSync(codeFile, 'utf8').trim();
} else if (useStdin) {
  code = fs.readFileSync(0, 'utf8').trim();
}

if (!code) {
  console.error('Usage: node ff-run.js (--code <js-body> | --code-file <path> | --stdin) [--expect-download] [--save-as <path>] [--profile <dir>] [--no-close]');
  process.exit(1);
}

(async () => {
  fs.mkdirSync(downloadDir, { recursive: true });

  const browser = await firefox.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });

  const mainPage = browser.pages()[0] || await browser.newPage();

  // ====== Download handling ======
  let downloadResult = null;
  const downloadPromise = expectDownload
    ? new Promise(resolve => {
        const timeout = setTimeout(() => resolve(null), dlTimeout);

        function listenDownload(page) {
          page.on('download', async (download) => {
            const filename = download.suggestedFilename();
            const dest = saveAsPath || path.join(downloadDir, filename);

            // Ensure parent directory exists
            const destDir = path.dirname(dest);
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

            try {
              // Use stream-based save — more reliable than saveAs on Windows
              const stream = await download.createReadStream();
              const ws = fs.createWriteStream(dest);
              await new Promise((resolve, reject) => {
                stream.pipe(ws);
                ws.on('finish', resolve);
                ws.on('error', reject);
                stream.on('error', reject);
              });
              const st = fs.statSync(dest);
              clearTimeout(timeout);
              resolve({ filename, path: dest, size: st.size });
            } catch (e) {
              // Fallback: try saveAs
              try {
                await download.saveAs(dest);
                const st = fs.statSync(dest);
                clearTimeout(timeout);
                resolve({ filename, path: dest, size: st.size });
              } catch (e2) {
                clearTimeout(timeout);
                resolve({ error: 'download failed: ' + e.message + ' | saveAs: ' + e2.message, filename });
              }
            }
          });
        }

        for (const p of browser.pages()) listenDownload(p);
        browser.on('page', (newPage) => { listenDownload(newPage); });
      })
    : Promise.resolve(null);

  // ====== Run user code ======
  let result;
  try {
    const fn = eval('(async (page, context) => { ' + code + ' })');
    result = await fn(mainPage, browser);
  } catch (e) {
    result = { error: e.message, stack: e.stack?.split('\n').slice(0, 4).join('\n') };
  }

  // ====== Wait for download if expected ======
  if (expectDownload) {
    const dl = await downloadPromise;
    result = { ...(result || {}), download: dl };
  }

  console.log(JSON.stringify(result, null, 2));

  if (!noClose) {
    await browser.close();
  } else {
    console.log('// Browser kept open (--no-close)');
  }
})();
