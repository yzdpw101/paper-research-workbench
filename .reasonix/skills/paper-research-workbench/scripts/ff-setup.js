/**
 * ff-setup.js — Verify Firefox + download directory
 *
 * Usage:
 *   node ff-setup.js [--dir <download-dir>]
 *
 * Uses storageState.json for login persistence — no fragile profile directory.
 */

const { launch, STATE_FILE, DOWNLOAD_DIR } = require('./_browser');
const fs = require('fs');

function opt(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const downloadDir = opt('--dir', DOWNLOAD_DIR);

(async () => {
  fs.mkdirSync(downloadDir, { recursive: true });

  const { browser, page } = await launch();
  await page.goto('about:blank', { waitUntil: 'load', timeout: 10000 });

  console.log('FF_DOWNLOAD_DIR=' + downloadDir);
  console.log('FF_STATE_FILE=' + STATE_FILE);
  console.log('Firefox preflight OK');

  await browser.close();
})();
