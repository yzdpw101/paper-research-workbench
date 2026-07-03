/**
 * init.js — Interactive first-time setup wizard
 *
 * Usage:
 *   node init.js [--browser <firefox|chrome|edge>]
 *
 * Walks through: Node.js check → Playwright check → browser choice → browser install → verify.
 */

const { BROWSER_FILE, DOWNLOAD_DIR } = require('./_browser');
const fs = require('fs');
const path = require('path');

function opt(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const browserArg = opt('--browser', '');

function check(ok, msg) {
  console.log((ok ? '  [OK] ' : '  [!]  ') + msg);
  return ok;
}

(async () => {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  const bdir = path.dirname(BROWSER_FILE);
  if (!fs.existsSync(bdir)) fs.mkdirSync(bdir, { recursive: true });

  const checks = [];

  // Step 1: Node.js
  checks.push(check(true, 'Node.js v' + process.version.slice(1)));

  // Step 2: Playwright npm package
  let hasPlaywright = false;
  try { require.resolve('playwright'); hasPlaywright = true; } catch (_) {}
  checks.push(check(hasPlaywright, 'Playwright npm package'));
  if (!hasPlaywright) console.log('       → 运行: npm install playwright');

  // Step 3: Browser choice
  let browserChoice = browserArg;
  if (!browserChoice && fs.existsSync(BROWSER_FILE)) {
    browserChoice = fs.readFileSync(BROWSER_FILE, 'utf8').trim();
  }
  if (!browserChoice) {
    checks.push(check(false, '请选择默认浏览器'));
    console.log('');
    console.log('       你希望默认使用哪个浏览器？');
    console.log('');
    console.log('         Firefox — 需额外安装: npx playwright install firefox');
    console.log('         Chrome  — 系统自带，无需额外安装');
    console.log('         Edge    — Windows 自带，无需额外安装');
    console.log('');
    console.log('       选择后运行: node scripts/set-browser.js <firefox|chrome|edge>');
    console.log('       然后重新: node scripts/init.js');
  } else {
    checks.push(check(true, '默认浏览器: ' + browserChoice));
  }

  // Step 4: Browser binary
  if (browserChoice && hasPlaywright) {
    const { chromium } = require('playwright');
    let browserOK = false;
    try {
      if (browserChoice === 'firefox') {
        const { firefox } = require('playwright');
        const b = await firefox.launch({ headless: false });
        await b.close(); browserOK = true;
      } else {
        const c = browserChoice === 'edge' ? 'msedge' : browserChoice;
        const b = await chromium.launch({ headless: false, channel: c });
        await b.close(); browserOK = true;
      }
    } catch (e) {
      const m = e.message.slice(0, 150);
      if (m.includes('Executable') || m.includes('Chromium')) {
        checks.push(check(false, browserChoice + ' 未安装'));
        if (browserChoice === 'firefox') console.log('       → 运行: npx playwright install firefox');
        else console.log('       → 请安装 ' + browserChoice + ' 浏览器');
      } else {
        checks.push(check(false, browserChoice + ' 启动失败: ' + m));
      }
    }
    if (browserOK) {
      checks.push(check(true, browserChoice + ' 浏览器可用'));
      fs.writeFileSync(BROWSER_FILE, browserChoice + '\n');
    }
  }

  // Summary
  const allOK = checks.every(Boolean);
  console.log('');
  if (allOK) {
    console.log('✓ 环境就绪。可直接使用，无需登录检查。');
  } else {
    console.log('✗ 部分检查未通过，按上述提示修复后重新运行。');
  }
  process.exit(allOK ? 0 : 1);
})();
