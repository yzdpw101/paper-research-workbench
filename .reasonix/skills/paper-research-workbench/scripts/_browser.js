/**
 * _browser.js — Multi-browser launcher with storageState persistence
 *
 * Browser priority: --browser flag > shared/.browser file > "firefox"
 *
 * Usage (any script):
 *   node script.js --browser chrome          # one-time override
 *   node set-browser.js chrome               # change default permanently
 *   node script.js                            # use default
 */

const { firefox, chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SKILL_DIR = path.resolve(__dirname, '..');
const BROWSER_FILE = path.join(SKILL_DIR, 'shared', '.browser');
const STATE_DIR = 'C:/Users/Tel13/.paper-research-workbench';
const DEFAULT_DOWNLOAD_DIR = 'E:/Downloads/Firefox';

function resolveBrowser() {
  // 1. --browser flag
  const i = process.argv.indexOf('--browser');
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];

  // 2. shared/.browser file
  try {
    const v = fs.readFileSync(BROWSER_FILE, 'utf8').trim();
    if (v === 'chrome' || v === 'firefox' || v === 'edge') return v;
  } catch (_) {}

  // 3. default
  return 'firefox';
}

function stateFile(browser) {
  return path.join(STATE_DIR, 'storageState-' + browser + '.json');
}

const { execSync } = require('child_process');

// Kill zombie browser processes from previous crashes
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

  // Clean up from previous crash
  killZombies(browserName);

  // Launch browser
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

  // Load storage state
  const sf = stateFile(browserName);
  let storageState = undefined;
  if (fs.existsSync(sf)) {
    try { storageState = JSON.parse(fs.readFileSync(sf, 'utf8')); } catch (_) {}
  }

  const context = await browser.newContext({ viewport, acceptDownloads, storageState });

  // Chrome/Edge: use CDP to force downloads (don't open in PDF viewer)
  if (browserName === 'chrome' || browserName === 'edge') {
    try {
      const cdp = await context.newCDPSession(context.pages()[0] || await context.newPage());
      await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DEFAULT_DOWNLOAD_DIR });
    } catch (_) { /* CDP may not be available */ }
  }

  if (!fs.existsSync(DEFAULT_DOWNLOAD_DIR)) fs.mkdirSync(DEFAULT_DOWNLOAD_DIR, { recursive: true });
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });

  const page = context.pages()[0] || await context.newPage();

  // saveState helper
  const saveState = async () => {
    try {
      const state = await context.storageState();
      fs.writeFileSync(sf + '.tmp', JSON.stringify(state));
      fs.renameSync(sf + '.tmp', sf);
    } catch (_) {}
  };

  // Override close
  const origClose = browser.close.bind(browser);
  browser.close = async () => { await saveState(); await origClose(); };

  // Signal handlers
  const cleanup = async () => { await saveState(); try { await browser.close(); } catch (_) {} process.exit(0); };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  return { browser, context, page, browserName };
}

module.exports = { launch, STATE_DIR, STATE_FILE: stateFile, BROWSER_FILE, DOWNLOAD_DIR: DEFAULT_DOWNLOAD_DIR, resolveBrowser };
