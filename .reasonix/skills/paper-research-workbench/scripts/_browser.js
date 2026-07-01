/**
 * _browser.js — Shared Firefox browser launcher with storageState persistence
 *
 * All scripts require this instead of calling launchPersistentContext directly.
 * Stores cookies/localStorage in a portable JSON file instead of a fragile
 * profile directory. Crashes won't corrupt the profile.
 */

const { firefox } = require('playwright');
const fs = require('fs');
const path = require('path');

const STATE_FILE = 'C:/Users/Tel13/.paper-research-workbench/storageState.json';
const DEFAULT_DOWNLOAD_DIR = 'E:/Downloads/Firefox';

async function launch(options = {}) {
  const { viewport = { width: 1280, height: 900 }, acceptDownloads = true } = options;

  const browser = await firefox.launch({ headless: false });

  // Load storage state if it exists
  let storageState = undefined;
  if (fs.existsSync(STATE_FILE)) {
    try {
      storageState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (_) { /* corrupted — ignore */ }
  }

  const context = await browser.newContext({
    viewport,
    acceptDownloads,
    storageState,
  });

  // Ensure download dir exists
  if (!fs.existsSync(DEFAULT_DOWNLOAD_DIR)) fs.mkdirSync(DEFAULT_DOWNLOAD_DIR, { recursive: true });

  const page = context.pages()[0] || await context.newPage();

  // Save storage state on clean exit
  const saveState = async () => {
    try {
      const state = await context.storageState();
      const dir = path.dirname(STATE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(STATE_FILE + '.tmp', JSON.stringify(state));
      fs.renameSync(STATE_FILE + '.tmp', STATE_FILE);
    } catch (_) { /* best effort */ }
  };

  // Auto-save every 30s (safe even with --no-close or unexpected exit)
  const autoSave = setInterval(saveState, 30000);

  // Override close to clean up auto-save timer + save state
  const origClose = browser.close.bind(browser);
  browser.close = async () => {
    clearInterval(autoSave);
    await saveState();
    await origClose();
  };

  // Save on signal (SIGINT/SIGTERM)
  const cleanup = async () => {
    clearInterval(autoSave);
    await saveState();
    try { await browser.close(); } catch (_) {}
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  return { browser, context, page };
}

module.exports = { launch, STATE_FILE, DOWNLOAD_DIR: DEFAULT_DOWNLOAD_DIR };
