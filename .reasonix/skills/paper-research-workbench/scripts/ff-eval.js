/**
 * ff-eval.js — Firefox navigate + evaluate + return JSON
 * 
 * Usage:
 *   node ff-eval.js --url <url> (--code <js> | --code-file <path> | --stdin)
 *                  [--wait <ms>] [--timeout <ms>] [--profile <dir>]
 * 
 * FF_PROFILE_DIR env var or --profile overrides the default profile path.
 * Uses persistent Firefox profile for login-state persistence.
 */

const { firefox } = require('playwright');
const fs = require('fs');

function opt(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const PROFILE_DIR = process.env.FF_PROFILE_DIR || opt('--profile', 'C:/Users/Tel13/playwright-firefox-profile-v2');

const url = opt('--url', '');
let code = opt('--code', '');
const codeFile = opt('--code-file', '');
const useStdin = process.argv.includes('--stdin');
const waitMs = parseInt(opt('--wait', '2000'));
const timeout = parseInt(opt('--timeout', '30000'));

if (codeFile) {
  code = fs.readFileSync(codeFile, 'utf8').trim();
} else if (useStdin) {
  code = fs.readFileSync(0, 'utf8').trim();
}

if (!url || !code) {
  console.error('Usage: node ff-eval.js --url <url> (--code <js> | --code-file <path> | --stdin)');
  process.exit(1);
}

(async () => {
  const browser = await firefox.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });

  const cleanup = async () => { try { await browser.close(); } catch(_) {} process.exit(0); };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  const page = browser.pages()[0] || await browser.newPage();

  let result;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForTimeout(waitMs);
    const fn = eval('(' + code + ')');
    result = await page.evaluate(fn);
  } catch (e) {
    result = { error: e.message, stack: e.stack?.split('\n').slice(0, 3).join('\n') };
  }

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
