/**
 * wf-download-patched.js — Wanfang paper download with extended timeout
 *
 * Usage: node wf-download-patched.js --q <keyword> --type <paper|thesis|periodical|...>
 *                       [--idx <n>] [--page <n>] [--save-as <path>] [--timeout <ms>]
 */
const BASE = "C:/Users/Tel13/.agents/skills/paper-research-workbench/scripts";
const { launch, DOWNLOAD_DIR } = require(BASE + '/_browser');
const fs = require('fs');
const path = require('path');

function opt(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const keyword = opt('--q', '');
const wfType = opt('--type', 'paper');
const targetIdx = parseInt(opt('--idx', '0'));
const pageNum = opt('--page', '1');
const saveAsPath = opt('--save-as', '');
const dlTimeout = parseInt(opt('--timeout', '180000'));
const navTimeout = parseInt(opt('--nav-timeout', '120000'));

if (!keyword) {
  console.error('Usage: node wf-download-patched.js --q <keyword> --type <paper|thesis|periodical|...> [--idx 0] [--save-as <path>]');
  process.exit(1);
}

const searchUrl = 'https://s.wanfangdata.com.cn/' + wfType + '?q=' + encodeURIComponent(keyword) + '&p=' + pageNum;

(async () => {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  const { browser, context, page } = await launch();

  const result = await new Promise(resolve => {
    const t = setTimeout(() => resolve({ error: 'download timeout' }), dlTimeout);

    function listen(p) {
      p.on('download', async (dl) => {
        const dest = saveAsPath || path.join(DOWNLOAD_DIR, dl.suggestedFilename());
        const dd = path.dirname(dest);
        if (!fs.existsSync(dd)) fs.mkdirSync(dd, { recursive: true });
        try {
          const stream = await dl.createReadStream();
          const ws = fs.createWriteStream(dest);
          await new Promise((res, rej) => { stream.pipe(ws); ws.on('finish', res); ws.on('error', rej); stream.on('error', rej); });
        } catch (_) { await dl.saveAs(dest); }
        clearTimeout(t);
        resolve({ ok: true, title: _title, download: { name: dl.suggestedFilename(), path: dest, size: fs.statSync(dest).size } });
      });
    }
    for (const p of context.pages()) listen(p);
    context.on('page', p => listen(p));

    let _title = '';

    (async () => {
      // Use extended navigation timeout
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: navTimeout });
      await page.waitForTimeout(5000);

      const mark = await page.evaluate((idx) => {
        const text = (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 8000);
        const headerEl = document.querySelector('header,.header,.top,.topbar,.user-info,.nav,[class*=header],[class*=top],[class*=login]');
        const header = ((headerEl && headerEl.innerText) || text.slice(0, 1200)).replace(/\s+/g, ' ');
        const logged = (/退出登录|退出|注销/.test(header) || /大学图书馆|图书馆/.test(header) || !/登录|注册/.test(header))
          && !/无权限|购买|充值/.test(text);
        if (!logged) return { error: 'not logged in', warning: '未检测到登录态（可能是校园网IP认证，不影响使用），仍继续尝试下载' };

        const items = [];
        document.querySelectorAll('div.normal-list').forEach((el, i) => {
          if (items.length > idx) return;
          const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
          const m = t.match(/^(\d+)\.(?:目录\s*)?(.+?)(文摘阅读)/);
          if (!m) return;
          const title = m[2].trim();
          if (title.length > 8) {
            const spans = el.querySelectorAll('.button-list span');
            let dlBtn = null;
            spans.forEach(s => { const txt = (s.innerText || '').trim(); if (txt === '整篇下载' || txt === '下载') dlBtn = s; });
            items.push({ idx: i, title, hasBtn: !!dlBtn });
          }
        });
        if (items[idx] && items[idx].hasBtn) {
          const el = document.querySelectorAll('div.normal-list')[items[idx].idx];
          const spans = el.querySelectorAll('.button-list span');
          document.querySelectorAll('[data-target="wf-dl"]').forEach(e => e.removeAttribute('data-target'));
          spans.forEach(s => { const txt = (s.innerText || '').trim(); if (txt === '整篇下载' || txt === '下载') s.setAttribute('data-target', 'wf-dl'); });
          return { ok: true, title: items[idx].title };
        }
        return { error: 'no download button for index ' + idx };
      }, targetIdx);

      if (mark.error) { clearTimeout(t); resolve(mark); return; }
      _title = mark.title;

      await page.click('[data-target="wf-dl"]');

      let dlPage = null;
      for (let i = 0; i < 15; i++) {
        for (const p of context.pages()) {
          if (p !== page && p.url().includes('f.wanfangdata.com.cn')) { dlPage = p; break; }
        }
        if (dlPage) break;
        await page.waitForTimeout(1000);
      }

      if (dlPage) {
        await dlPage.bringToFront();
        await dlPage.waitForLoadState('domcontentloaded');
        for (let i = 0; i < 30; i++) {
          await page.waitForTimeout(1000);
          const txt = await dlPage.evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' '));
          if (txt.includes('点击此处')) {
            await dlPage.evaluate(() => {
              document.querySelectorAll('a').forEach(a => { if ((a.textContent || '').includes('点击此处')) a.click(); });
            });
            break;
          }
        }
      }
    })().catch(e => { clearTimeout(t); resolve({ error: e.message }); });
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
