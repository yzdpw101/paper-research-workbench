() => {
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
      const idx = body.indexOf(title);
      item.snippet = idx >= 0 ? body.slice(idx + title.length, idx + title.length + 400) : '';
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
}