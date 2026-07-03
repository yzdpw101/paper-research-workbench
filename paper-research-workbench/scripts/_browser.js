/**
 * _browser.js — Multi-browser launcher with storageState persistence
 *
 * Browser priority: --browser flag > .state/.browser file > "firefox"
 */

const { firefox, chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SKILL_DIR = path.resolve(__dirname, '..');
const BROWSER_FILE = path.join(SKILL_DIR, '.state', '.browser');
const STATE_DIR = path.join(SKILL_DIR, '.state');
const DEFAULT_DOWNLOAD_DIR = path.join(SKILL_DIR, '.state', 'downloads');

function resolveBrowser() {
  const i = process.argv.indexOf('--browser');
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  try {
    const v = fs.readFileSync(BROWSER_FILE, 'utf8').trim();
    if (v === 'chrome' || v === 'firefox' || v === 'edge') return v;
  } catch (_) {}
  throw new Error('No browser selected. Run: node scripts/set-browser.js <firefox|chrome|edge>, then re-run.');
}

function stateFile(browser) {
  return path.join(STATE_DIR, 'storageState-' + browser + '.json');
}

function killZombies(name) {
  try {
    if (name === 'firefox') execSync('taskkill /F /IM firefox.exe 2>nul', { stdio: 'ignore' });
    else if (name === 'chrome') execSync('taskkill /F /IM chrome.exe 2>nul', { stdio: 'ignore' });
    else if (name === 'edge') execSync('taskkill /F /IM msedge.exe 2>nul', { stdio: 'ignore' });
  } catch (_) {}
}

async function launch(options = {}) {
  const browserName = resolveBrowser();
  const { viewport = { width: 1280, height: 900 }, acceptDownloads = true } = options;

  killZombies(browserName);

  let browser;
  if (browserName === 'firefox') {
    browser = await firefox.launch({ headless: false });
  } else if (browserName === 'chrome') {
    browser = await chromium.launch({ headless: false, channel: 'chrome' });
  } else if (browserName === 'edge') {
    browser = await chromium.launch({ headless: false, channel: 'msedge' });
  } else {
    throw new Error('Unknown browser: ' + browserName);
  }

  const sf = stateFile(browserName);
  let storageState = undefined;
  if (fs.existsSync(sf)) {
    try { storageState = JSON.parse(fs.readFileSync(sf, 'utf8')); } catch (_) {}
  }

  const context = await browser.newContext({ viewport, acceptDownloads, storageState });

  [DEFAULT_DOWNLOAD_DIR, STATE_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  const page = context.pages()[0] || await context.newPage();

  // Unified page.goto with waitForSelector support
  const goto = async (pg, url, opts = {}) => {
    const { navTimeout = 60000, waitFor = '', waitMs = 0 } = opts;
    await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: navTimeout });
    if (waitFor) {
      try {
        await pg.waitForSelector(waitFor, { timeout: Math.max(navTimeout - 5000, 10000) });
      } catch (_) { /* selector not found — page may have loaded differently */ }
    }
    if (waitMs > 0) await pg.waitForTimeout(waitMs);
  };

  const saveState = async () => {
    try { await context.storageState({ path: sf }); } catch (_) {}
  };

  // Save on browser close, context close, and signals
  context.on('close', () => saveState().catch(() => {}));
  const origClose = browser.close.bind(browser);
  browser.close = async () => { await saveState(); await origClose(); };

  const cleanup = async () => { await saveState(); try { await browser.close(); } catch (_) {} process.exit(0); };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  return { browser, context, page, browserName, goto };
}

module.exports = { launch, STATE_DIR, STATE_FILE: stateFile, BROWSER_FILE, DOWNLOAD_DIR: DEFAULT_DOWNLOAD_DIR, resolveBrowser };
