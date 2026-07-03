() => {
  const text=(document.body.innerText||'').replace(/\s+/g,' ').slice(0,8000);
  const hasSignOut=/\bSign Out\b/i.test(text);
  const accessProvided=/Access provided by/i.test(text);
  const accessReady=hasSignOut || accessProvided;

  const out=[], seen=new Set();
  document.querySelectorAll('a[href*=\"/document/\"]').forEach(a=>{
    const m=a.href.match(/\/document\/(\d+)/);
    const title=(a.textContent||'').trim().replace(/\s+/g,' ');
    if(m && title && !seen.has(m[1])){
      seen.add(m[1]);
      out.push({arnumber:m[1], title});
    }
  });
  const totalM = text.match(/Showing \d+-\d+ of ([\d,]+)/);
  const totalResults = totalM ? parseInt(totalM[1].replace(/,/g,'')) : out.length;
  const perPage = parseInt(new URL(location.href).searchParams.get('rowsPerPage') || '25');
  const totalPages = Math.ceil(totalResults / perPage);
  const display = 'Total: ' + totalResults + '  Page: 1/' + totalPages + '  perPage: ' + perPage + '\n'
    + out.slice(0,5).map((x,i) => '#'+(i+1)+'  '+x.arnumber+'  '+x.title).join('\n');
  return {accessReady, totalResults, perPage, totalPages, items:out.slice(0,5), display};
}
