/**
 * 测试：万方分章下载
 */
const { firefox } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = 'C:/Users/Tel13/playwright-firefox-profile-v2';
const DOWNLOAD_DIR = 'E:/Downloads/Firefox';

(async () => {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const browser = await firefox.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });

  // Download tracking
  let downloadDone = null;
  const dlPromise = new Promise(r => { downloadDone = r; });
  const timeout = setTimeout(() => downloadDone({ error: 'timeout' }), 120000);

  function listen(page) {
    page.on('download', async (dl) => {
      const dest = path.join(DOWNLOAD_DIR, dl.suggestedFilename());
      // Stream-based save — more reliable on Windows
      try {
        const stream = await dl.createReadStream();
        const ws = fs.createWriteStream(dest);
        await new Promise((resolve, reject) => {
          stream.pipe(ws);
          ws.on('finish', resolve);
          ws.on('error', reject);
          stream.on('error', reject);
        });
      } catch (_) {
        await dl.saveAs(dest);
      }
      clearTimeout(timeout);
      downloadDone({ ok: true, path: dest, size: fs.statSync(dest).size, name: dl.suggestedFilename() });
    });
  }
  for (const p of browser.pages()) listen(p);
  browser.on('page', p => listen(p));

  const page = browser.pages()[0] || await browser.newPage();

  // Step 1: Search
  console.log('1. 搜索...');
  await page.goto('https://s.wanfangdata.com.cn/thesis?q=%E7%A8%80%E5%B8%83%E9%98%B5%E5%88%97&p=1', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForTimeout(3000);

  // Step 2: Mark 分章下载 button on first result
  console.log('2. 标记分章下载...');
  const mark = await page.evaluate(() => {
    const items = [];
    document.querySelectorAll('div.normal-list').forEach((el, i) => {
      if (items.length >= 1) return;
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const m = t.match(/^(\d+)\.(?:目录\s*)?(.+?)(文摘阅读)/);
      if (!m) return;
      const title = m[2].trim();
      if (title.length > 8) {
        const spans = el.querySelectorAll('.button-list span');
        let chBtn = null;
        spans.forEach(s => { if ((s.innerText || '').trim() === '分章下载') chBtn = s; });
        items.push({ idx: i, title, hasChapter: !!chBtn });
      }
    });
    if (items[0] && items[0].hasChapter) {
      const el = document.querySelectorAll('div.normal-list')[items[0].idx];
      const spans = el.querySelectorAll('.button-list span');
      document.querySelectorAll('[data-target="wf-ch"]').forEach(e => e.removeAttribute('data-target'));
      spans.forEach(s => { if ((s.innerText || '').trim() === '分章下载') s.setAttribute('data-target', 'wf-ch'); });
      return { ok: true, title: items[0].title };
    }
    return { error: 'no chapter download', items };
  });
  console.log('   ', JSON.stringify(mark));
  if (mark.error) { console.log('FAIL:', mark.error); return; }

  // Step 3: Click 分章下载
  console.log('3. 点击分章下载...');
  await page.click('[data-target="wf-ch"]');

  // Step 4: Switch to chapter page
  console.log('4. 等待分章页...');
  let chPage = null;
  for (let i = 0; i < 15; i++) {
    for (const p of browser.pages()) {
      if (p !== page && p.url().includes('part/thesis')) { chPage = p; break; }
    }
    if (chPage) break;
    await page.waitForTimeout(1000);
  }
  if (!chPage) { console.log('FAIL: no chapter page'); return; }
  await chPage.bringToFront();
  await chPage.waitForLoadState('domcontentloaded');
  await chPage.waitForTimeout(2000);
  console.log('    URL:', chPage.url());

  // Step 5: Diagnose tree
  console.log('5. 诊断章节树...');
  const diag = await chPage.evaluate(() => {
    const nodes = [];
    document.querySelectorAll('.ivu-tree li').forEach((li, i) => {
      const title = li.querySelector('.ivu-tree-title')?.textContent?.trim() || '';
      const hasArrow = !!li.querySelector('.ivu-tree-arrow i');
      nodes.push({ i, title, hasArrow });
    });
    const arrowCount = document.querySelectorAll('.ivu-tree-arrow i').length;
    const hasChapters = nodes.some(n => /^第.+章/.test(n.title));
    const tier = arrowCount === 0 ? (hasChapters ? 'flat' : 'none') : 'nested';
    return { tier, totalNodes: nodes.length, nodes: nodes.slice(0, 20) };
  });
  console.log('    tier:', diag.tier, 'nodes:', diag.totalNodes);
  diag.nodes.slice(0, 10).forEach(n => console.log('      ', n.title?.slice(0, 60), n.hasArrow ? '▶' : '☐'));

  // Step 6: Expand first 2 chapters + check first 2 subsections
  if (diag.tier === 'nested') {
    console.log('6. 展开章节 + 勾选...');
    const expandResult = await chPage.evaluate(async () => {
      // Expand chapters 1 and 2
      const items = document.querySelectorAll('li');
      let expanded = 0;
      for (const item of items) {
        const titleEl = item.querySelector(':scope > .ivu-tree-arrow + label + .ivu-tree-title, :scope > label + .ivu-tree-title');
        if (!titleEl) continue;
        const txt = (titleEl.textContent || '').trim();
        if (/^第[一二]章/.test(txt)) {
          const arrow = item.querySelector(':scope > .ivu-tree-arrow i');
          if (arrow) { arrow.click(); expanded++; await new Promise(r => setTimeout(r, 300)); }
        }
      }
      return { expanded };
    });
    console.log('    展开:', expandResult.expanded, '章');
    await chPage.waitForTimeout(500);

    // Check first 2 subsections
    const checkResult = await chPage.evaluate(() => {
      const labels = document.querySelectorAll('label.ivu-checkbox-wrapper');
      let checked = 0;
      for (const label of labels) {
        if (checked >= 2) break;
        const titleEl = label.nextElementSibling;
        if (!titleEl || !titleEl.classList.contains('ivu-tree-title')) continue;
        const txt = (titleEl.textContent || '').trim();
        if (/^\d+[.．]\d+/.test(txt) && !label.classList.contains('ivu-checkbox-wrapper-checked')) {
          label.click();
          checked++;
        }
      }
      return { checked };
    });
    console.log('    勾选:', checkResult.checked, '节');

    const checkedCount = await chPage.evaluate(() => document.querySelectorAll('span.ivu-checkbox-checked').length);
    console.log('    已选:', checkedCount, '项');

    // Step 7: Click confirm
    console.log('7. 确认下载...');
    try {
      await chPage.locator('button').filter({ hasText: '确认下载' }).first().click();
      console.log('    已点击确认下载');
    } catch (e) {
      console.log('    点击失败:', e.message);
    }
  } else if (diag.tier === 'flat') {
    console.log('    flat tier — 尝试勾选前2个节点');
    await chPage.evaluate(() => {
      const labels = document.querySelectorAll('label.ivu-checkbox-wrapper');
      let c = 0;
      for (const l of labels) {
        if (c >= 2) break;
        if (!l.classList.contains('ivu-checkbox-wrapper-checked')) { l.click(); c++; }
      }
    });
    await chPage.waitForTimeout(300);
    try {
      await chPage.locator('button').filter({ hasText: '确认下载' }).first().click();
    } catch (e) {}
  } else {
    console.log('    none tier — 无法分章下载');
    return;
  }

  // Step 8: Wait for download
  console.log('8. 等待下载...');
  const result = await dlPromise;
  console.log('RESULT:', JSON.stringify(result, null, 2));
  console.log('\n浏览器保持打开...');
  await new Promise(() => {});
})();
