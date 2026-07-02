/**
 * ff-setup.js — Verify browser + download directory
 *
 * Usage:
 *   node ff-setup.js [--dir <download-dir>] [--browser <firefox|chrome|edge>]
 *
 * Writes shared/.browser on first run (defaults to firefox if not specified).
 * Uses storageState-<browser>.json for login persistence.
 */

const { launch, resolveBrowser, BROWSER_FILE, DOWNLOAD_DIR } = require('./_browser');
const fs = require('fs');
const path = require('path');

function opt(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const downloadDir = opt('--dir', DOWNLOAD_DIR);

(async () => {
  fs.mkdirSync(downloadDir, { recursive: true });

  // Ensure .browser file exists
  const bdir = path.dirname(BROWSER_FILE);
  if (!fs.existsSync(bdir)) fs.mkdirSync(bdir, { recursive: true });
  if (!fs.existsSync(BROWSER_FILE)) {
    fs.writeFileSync(BROWSER_FILE, 'firefox\n');
  }

  const { browser, page, browserName } = await launch();
  await page.goto('about:blank', { waitUntil: 'load', timeout: 10000 });

  console.log('BROWSER=' + browserName);
  console.log('DOWNLOAD_DIR=' + downloadDir);
  console.log('STATE_FILE=' + (require('./_browser').STATE_FILE(browserName)));
  console.log('BROWSER_FILE=' + BROWSER_FILE);
  console.log('Preflight OK');

  await browser.close();
})();
