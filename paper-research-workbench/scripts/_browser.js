/**
 * _browser.js — Multi-browser launcher
 *
 * Browser priority: --browser flag > .state/.browser file
 * No storageState persistence — campus IP auth doesn't need cookies.
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

function killZombies(name) {
  if (process.argv.includes('--no-kill')) return;
  try {
    if (name === 'firefox') execSync('taskkill /F /IM firefox.exe 2>nul', { stdio: 'ignore', timeout: 3000 });
    else if (name === 'chrome') execSync('taskkill /F /IM chrome.exe 2>nul', { stdio: 'ignore', timeout: 3000 });
    else if (name === 'edge') execSync('taskkill /F /IM msedge.exe 2>nul', { stdio: 'ignore', timeout: 3000 });
  } catch (_) {}
}

async function launch(options = {}) {
  const browserName = resolveBrowser();
  const { viewport = { width: 1280, height: 900 }, acceptDownloads = true } = options;

  killZombies(browserName);

  let browser;
  if (browserName === 'firefox') {
    browser = await firefox.launch({ headless: false, firefoxUserPrefs: { 'browser.startup.page': 0 } });
  } else if (browserName === 'chrome') {
    browser = await chromium.launch({ headless: false, channel: 'chrome' });
  } else if (browserName === 'edge') {
    browser = await chromium.launch({ headless: false, channel: 'msedge' });
  } else {
    throw new Error('Unknown browser: ' + browserName);
  }

  const context = await browser.newContext({ viewport, acceptDownloads });

  [DEFAULT_DOWNLOAD_DIR, STATE_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  const page = context.pages()[0] || await context.newPage();

  const goto = async (pg, url, opts = {}) => {
    const { navTimeout = 60000, waitFor = '', waitMs = 0 } = opts;
    await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: navTimeout });
    if (waitFor) {
      try {
        await pg.waitForSelector(waitFor, { timeout: Math.max(navTimeout - 5000, 10000) });
      } catch (_) {}
    }
    if (waitMs > 0) await pg.waitForTimeout(waitMs);
  };

  return { browser, context, page, browserName, goto };
}

module.exports = { launch, BROWSER_FILE, DOWNLOAD_DIR: DEFAULT_DOWNLOAD_DIR, resolveBrowser };
