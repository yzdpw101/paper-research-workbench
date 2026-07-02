/**
 * ff-eval.js — Navigate + evaluate + return JSON (generic fallback)
 * 
 * Usage:
 *   node ff-eval.js --url <url> (--code <js> | --code-file <path> | --stdin)
 *                  [--wait <ms>] [--timeout <ms>] [--browser <firefox|chrome|edge>]
 */

const { launch } = require('./_browser');
const fs = require('fs');

function opt(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const url = opt('--url', '');
let code = opt('--code', '');
const codeFile = opt('--code-file', '');
const useStdin = process.argv.includes('--stdin');
const waitMs = parseInt(opt('--wait', '2000'));
const timeout = parseInt(opt('--timeout', '30000'));

if (codeFile) { code = fs.readFileSync(codeFile, 'utf8').trim(); }
else if (useStdin) { code = fs.readFileSync(0, 'utf8').trim(); }

if (!url || !code) {
  console.error('Usage: node ff-eval.js --url <url> (--code <js> | --code-file <path> | --stdin)');
  process.exit(1);
}

(async () => {
  const { browser, page } = await launch();

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
