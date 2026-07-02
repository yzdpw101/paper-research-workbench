/**
 * wf-search.js — Wanfang search (one-shot)
 *
 * Usage:
 *   node wf-search.js --q <keyword> [--type <paper|periodical|thesis|conference|patent|...>]
 *                     [--page <n>] [--no-snippet] [--wait <ms>]
 *
 * --q          : Search keyword (required)
 * --type       : Resource type, default "paper" (all types)
 * --page       : Page number, default 1
 * --no-snippet : Omit abstract text from results (smaller output)
 */

const { launch } = require('./_browser');

function opt(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const keyword = opt('--q', '');
const wfType = opt('--type', 'paper');
const pageNum = opt('--page', '1');
const noSnippet = process.argv.includes('--no-snippet');
const waitMs = parseInt(opt('--wait', '3000'));

if (!keyword) {
  console.error('Usage: node wf-search.js --q <keyword> [--type thesis] [--page 1] [--no-snippet]');
  process.exit(1);
}

const url = 'https://s.wanfangdata.com.cn/' + wfType + '?q=' + encodeURIComponent(keyword) + '&p=' + pageNum;

(async () => {
  const { browser, page } = await launch();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(waitMs);

  const result = await page.evaluate((opts) => {
    const TARGET_INDEX = null;
    const text = (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 8000);
    const headerEl = document.querySelector('header,.header,.top,.topbar,.user-info,.nav,[class*=header],[class*=top],[class*=login]');
    const header = ((headerEl && headerEl.innerText) || text.slice(0, 1200)).replace(/\s+/g, ' ');
    const hasLoginText = /登录|注册/.test(header);
    const hasLogout = /退出登录|退出|注销/.test(header);
    const hasInstitution = /大学图书馆|图书馆/.test(header);
    const noAccess = /无权限|购买|充值|机构权限|未订购|无法下载/.test(text);
    const logged = (hasLogout || hasInstitution || !hasLoginText) && !noAccess;
    if (!logged || noAccess) return { logged, noAccess, header: header.slice(0, 160) };

    if (/没有检索到数据|没有找到您要的资源/.test(text)) return { logged, noAccess: false, noResults: true, total: 0, items: [] };

    const items = [], seen = new Set();
    const currentPage = new URL(location.href).searchParams.get('p') || '1';
    document.querySelectorAll('div.normal-list').forEach((el, i) => {
      if (items.length >= 20) return;
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      let m = t.match(/^(\d+)\.(?:目录\s*)?(.+?)(文摘阅读|patent_|nstr_|cstad_|standard_)/);
      if (!m) return;
      const title = m[2].trim();
      const typeM = t.match(/\[(硕士论文|博士论文|期刊论文|会议论文|专利|科技报告|成果|标准|法规)\]/);
      if (title.length > 8 && !seen.has(title)) {
        seen.add(title);
        const btnContainer = el.querySelector('.button-list, [class*=button], [class*=btn]');
        const allBtns = btnContainer ? btnContainer.querySelectorAll('*') : [];
        let hasFull = false, hasDownload = false;
        allBtns.forEach(b => {
          const txt = (b.innerText || b.textContent || '').trim();
          if (txt === '整篇下载') hasFull = true;
          if (txt === '下载' || txt === '整篇下载') hasDownload = true;
        });
        // Extract snippet between 摘要： and download button
        const item = { idx: i, key: 'p' + currentPage + '#' + m[1], title, type: (typeM || [''])[0], hasFull, hasDownload };
        if (!opts.noSnippet) {
          const absStart = t.indexOf('摘要：');
          const absEnd = t.search(/在线阅读|整篇下载|分章下载|下载全文/);
          item.snippet = absStart > 0 ? t.slice(absStart, absEnd > absStart ? absEnd : absStart + 300).trim().slice(0, 250) : '';
        }
        items.push(item);
      }
    });

    const activeFilters = [];
    document.querySelectorAll('label.ivu-checkbox-wrapper-checked .words').forEach(w => {
      const v = (w.textContent || '').trim();
      if (v && v.length < 50) activeFilters.push(v);
    });

    const dl = x => x.hasFull ? '[整篇]' : x.hasDownload ? '[下载]' : '[无]';
    const totalM = text.match(/找到([\d,]+)条/);
    const totalResults = totalM ? parseInt(totalM[1].replace(/,/g, '')) : items.length;
    const perPageM = text.match(/每页\s*(\d+)\s*条/);
    const perPage = perPageM ? parseInt(perPageM[1]) : 20;
    const totalPages = Math.ceil(totalResults / perPage);
    const hdr = '找到' + totalResults + '条  p' + currentPage + '/' + totalPages + '  每页' + perPage + '条';
    const list = items.slice(0, 20).map((x, i) => '#' + (i + 1) + '  ' + (x.type || '-') + '  ' + dl(x) + '  ' + x.title).join('\n');
    return { logged, noAccess, page: currentPage, totalResults, totalPages, perPage, items: items.slice(0, 20), activeFilters, display: hdr + '\n' + list };
  }, { noSnippet });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
