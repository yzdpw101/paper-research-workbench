() => {
  const raw = (document.body?.innerText || '');
  const b = raw.replace(/[\s]+/g, ' ');
  const accessReady = /\bSign Out\b/i.test(b) || /Access provided by/i.test(b);
  let title = (document.querySelector('h1')?.textContent || '').trim().replace(/\s+/g, ' ');
  if (!title || title.length < 10) {
    const tm = b.match(/ADVANCED SEARCH[\s\S]*?>([^>]+?)Publisher:\s*IEEE/);
    title = tm ? tm[1].trim().replace(/\s*>\s*$/, '') : '';
  }
  const am = b.match(/Cite This\s*PDF\s+(.+?)All Authors/);
  const authors = am ? am[1].trim().split(';').map(s=>s.trim()).filter(s=>s.length>2&&!s.includes('All')) : [];
  const absM = b.match(/Abstract:\s*(.+?)(?:Published in:|Date of Conference:|Date of\b|DOI:|Publisher:|Show More)/);
  const abstract = absM ? absM[1].trim() : '';
  const pubM = b.match(/Published in:\s*(.+?)(?:\s+Date of|\s+DOI:|\s+Publisher:)/);
  const publishedIn = pubM ? pubM[1].trim() : '';
  const doiM = b.match(/DOI:\s*(10\.\d+\/[^\s]+)/);
  const doi = doiM ? doiM[1] : '';
  return {accessReady, title, authors:authors.slice(0,8), abstract:abstract.slice(0,500), publishedIn, doi};
}
