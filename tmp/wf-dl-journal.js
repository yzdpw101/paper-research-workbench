const TARGET = 0;
await page.goto('https://s.wanfangdata.com.cn/periodical?q=%E7%A8%80%E7%96%8F%E9%98%B5%E5%88%97%20%E4%BC%98%E5%8C%96&p=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(3000);

const markResult = await page.evaluate((targetIdx) => {
  const items = [];
  document.querySelectorAll('div.normal-list').forEach((el,i)=>{
    if(items.length > targetIdx) return;
    const t=(el.textContent||'').replace(/\s+/g,' ').trim();
    const m=t.match(/^(\d+)\.(?:目录\s*)?(.+?)(文摘阅读)/);
    if(!m) return;
    const title=m[2].trim();
    if(title.length>8){
      const spans=el.querySelectorAll('.button-list span');
      let dlBtn=null;
      spans.forEach(s=>{const txt=(s.innerText||'').trim(); if(txt==='下载'||txt==='整篇下载') dlBtn=s;});
      items.push({idx:i, title, hasBtn:!!dlBtn});
    }
  });
  if(targetIdx < items.length && items[targetIdx].hasBtn){
    const el=document.querySelectorAll('div.normal-list')[items[targetIdx].idx];
    const spans=el.querySelectorAll('.button-list span');
    document.querySelectorAll('[data-target="wf-dl"]').forEach(e=>e.removeAttribute('data-target'));
    spans.forEach(s=>{const txt=(s.innerText||'').trim(); if(txt==='下载'||txt==='整篇下载') s.setAttribute('data-target','wf-dl');});
    return {ok:true, title:items[targetIdx].title};
  }
  return {error:'no download button'};
}, TARGET);
if (markResult.error) return markResult;

await page.click('[data-target="wf-dl"]');

let dlPage = null;
for (let i = 0; i < 15; i++) {
  for (const p of context.pages()) {
    if (p !== page && p.url().includes('f.wanfangdata.com.cn')) { dlPage = p; break; }
  }
  if (dlPage) break;
  await page.waitForTimeout(1000);
}
if (!dlPage) return {error:'download tab did not open'};

await dlPage.bringToFront();
await dlPage.waitForLoadState('domcontentloaded');

for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(1000);
  const txt = await dlPage.evaluate(() => (document.body?.innerText||'').replace(/\s+/g,' '));
  if (txt.includes('点击此处')) {
    await dlPage.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const a of links) { if ((a.textContent||'').includes('点击此处')) { a.click(); return; } }
    });
    break;
  }
}

return {ok:true, title:markResult.title};
