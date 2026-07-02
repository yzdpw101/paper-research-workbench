/**
 * _browser.js — Multi-browser launcher with storageState persistence
 *
 * Browser priority: --browser flag > shared/.browser file > "firefox"
 */

const { firefox, chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const SKILL_DIR = path.resolve(__dirname, '..');
const BROWSER_FILE = path.join(SKILL_DIR, 'shared', '.browser');
const STATE_DIR = path.join(os.homedir(), '.paper-research-workbench');
const DEFAULT_DOWNLOAD_DIR = path.join(os.homedir(), 'Downloads', 'paper-research-workbench');

function resolveBrowser() {
  const i = process.argv.indexOf('--browser');
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  try {
    const v = fs.readFileSync(BROWSER_FILE, 'utf8').trim();
    if (v === 'chrome' || v === 'firefox' || v === 'edge') return v;
  } catch (_) {}
  return 'firefox';
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

  const saveState = async () => {
    try {
      const state = await context.storageState();
      fs.writeFileSync(sf + '.tmp', JSON.stringify(state));
      fs.renameSync(sf + '.tmp', sf);
    } catch (_) {}
  };

  const autoSave = setInterval(saveState, 30000);
  const origClose = browser.close.bind(browser);
  browser.close = async () => { clearInterval(autoSave); await saveState(); await origClose(); };

  const cleanup = async () => { clearInterval(autoSave); await saveState(); try { await browser.close(); } catch (_) {} process.exit(0); };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  return { browser, context, page, browserName };
}

module.exports = { launch, STATE_DIR, STATE_FILE: stateFile, BROWSER_FILE, DOWNLOAD_DIR: DEFAULT_DOWNLOAD_DIR, resolveBrowser };
