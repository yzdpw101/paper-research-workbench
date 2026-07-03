/**
 * ieee-search.js — IEEE Xplore search (one-shot)
 *
 * Usage:
 *   node ieee-search.js --q <keyword> [--type <ContentType>] [--year <YYYY-YYYY>]
 *                       [--rows <n>] [--page <n>] [--expand]
 *
 * --q       : Search keyword (required)
 * --type    : ContentType: Journals|Conferences|Magazines|Books|Early Access Articles|Standards
 * --year    : Year range, e.g. "2023-2025" or "2024"
 * --rows    : Results per page (10/25/50/75/100), default 25
 * --page    : Page number, default 1
 * --expand  : Expand abstracts; each item gets a .snippet field
 */

const { launch } = require('./_browser');

function opt(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const keyword = opt('--q', '');
const type = opt('--type', '');
const year = opt('--year', '');
const rows = opt('--rows', '25');
const page = opt('--page', '1');
const expand = process.argv.includes('--expand');
const waitMs = parseInt(opt('--wait', '3000'));

if (!keyword) {
  console.error('Usage: node ieee-search.js --q <keyword> [--type Journals] [--year 2023-2025] [--rows 25] [--page 1] [--expand]');
  process.exit(1);
}

let url = 'https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=' + encodeURIComponent(keyword);
if (type) url += '&refinements=ContentType:' + encodeURIComponent(type);
if (year) { const parts = year.split('-'); url += '&ranges=' + parts[0] + '_' + (parts[1] || parts[0]) + '_Year'; }
url += '&rowsPerPage=' + rows + '&pageNumber=' + page;

(async () => {
  const { browser, page, goto } = await launch();

  await goto(page, url, {
    navTimeout: parseInt(opt('--nav-timeout', '60000')),
    waitFor: 'a[href*="/document/"]',
    waitMs: expand ? 0 : 500     // extra wait only if not expanding abstracts
  });

  // Expand all abstracts if requested
  if (expand) {
    await page.evaluate(() => {
      document.querySelectorAll('.abstract-control').forEach(c => {
        if (c.querySelector('.fa-angle-down')) c.click();
      });
    });
    await page.waitForTimeout(1500);
  }

  const result = await page.evaluate((opts) => {
    const text = (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 8000);
    const hasSignOut = /\bSign Out\b/i.test(text);
    const accessProvided = /Access provided by/i.test(text);
    const signInMarkers = /Institutional Sign In|Personal Sign In|Sign in|Sign In/i.test(text);
    const denialMarkers = /Purchase PDF|Subscribe|Access Denied|Get Access|Sign in to access/i.test(text);
    const accessReady = hasSignOut || accessProvided;
    const needLogin = !accessReady && (signInMarkers || denialMarkers);
    if (!accessReady) return { accessReady, needLogin, warning: '未检测到登录态（可能是校园网IP认证，不影响使用）', items: [], totalResults: 0 };

    const noResults = /No results found|unable to find results/i.test(text);
    if (noResults) return { accessReady, needLogin, noResults: true, total: 0, items: [] };

    const out = [], seen = new Set();
    const body = (document.body?.innerText || '').replace(/\s+/g, ' ');

    document.querySelectorAll('a[href*="/document/"]').forEach(a => {
      const m = a.href.match(/\/document\/(\d+)/);
      const title = (a.textContent || '').trim().replace(/\s+/g, ' ');
      if (m && title && !seen.has(m[1])) {
        seen.add(m[1]);
        const item = { arnumber: m[1], title, url: a.href };
        // Extract snippet if expand mode
        if (opts.expand) {
          const idx = body.indexOf(title);
          item.snippet = idx >= 0 ? body.slice(idx + title.length, idx + title.length + 400) : '';
        }
        out.push(item);
      }
    });

    const list = out.map((x, i) => '#' + (i + 1) + '  ' + x.arnumber + '  ' + x.title).join('\n');
    const totalM = text.match(/Showing \d+-\d+ of ([\d,]+)/);
    const totalResults = totalM ? parseInt(totalM[1].replace(/,/g, '')) : out.length;
    const perPage = parseInt(new URL(location.href).searchParams.get('rowsPerPage') || '25');
    const totalPages = Math.ceil(totalResults / perPage);
    return {
      accessReady, needLogin, totalResults, perPage, totalPages,
      items: out.slice(0, 20),
      display: 'Showing ' + out.length + ' of ' + totalResults + '  p' + (new URL(location.href).searchParams.get('pageNumber') || '1') + '/' + totalPages + '  ' + perPage + ' rows/page\n' + list
    };
  }, { expand });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
