# Wanfang fast path (Reasonix + Firefox)

> **Code pattern**: Multi-line evaluate code must use `--code-file` (shell-safe). Write code to a temp file first, then pass it. Short one-liners without `$` can use `--code`.

## Preflight

```bash
node "${SKILL_DIR}/scripts/ff-setup.js" --dir "E:/Downloads/Firefox"
```

幂等。输出 `FF_DOWNLOAD_DIR` 和 `FF_PROFILE_DIR`。

## 检索流程

万方搜索页已含完整摘要和元数据。两步走：

```
1. 搜索 → ff-eval (merged evaluate) → 展示（标题+类型+hasFull/hasDownload）
2. 用户选 → ff-run (click + new-tab + download.saveAs) → 文件直接到 E:/Downloads/Firefox
```

**展示**：直接输出 `display` 字段（已预格式化），不加分析不推荐。

## Navigate → login check + extract results

URL: `https://s.wanfangdata.com.cn/<type>?q=<encoded>&p=<page>`

Set `TARGET_INDEX` to the 0-based array index. `null` if just browsing.

```bash
node "${SKILL_DIR}/scripts/ff-eval.js" \
  --url "https://s.wanfangdata.com.cn/<type>?q=<encoded>&p=<page>" \
  --wait 3000 \
  --code-file <code-file>
```

`<code-file>` 内容（用 `--code-file` 避免 shell 转义 `${}` 的问题）：

```js
() => {
  const TARGET_INDEX = null;   // 0-based, or null if browsing
  const text=(document.body.innerText||'').replace(/\s+/g,' ').slice(0,8000);
  const headerEl=document.querySelector('header,.header,.top,.topbar,.user-info,.nav,[class*=header],[class*=top],[class*=login]');
  const header=((headerEl&&headerEl.innerText)||text.slice(0,1200)).replace(/\s+/g,' ');
  const hasLoginText=/登录|注册/.test(header);
  const hasLogout=/退出登录|退出|注销/.test(header);
  const hasInstitution=/大学图书馆|图书馆/.test(header);
  const noAccess=/无权限|购买|充值|机构权限|未订购|无法下载/.test(text);
  const logged=(hasLogout || hasInstitution || !hasLoginText) && !noAccess;
  if(!logged || noAccess) return {logged, noAccess, header:header.slice(0,160)};

  if(/没有检索到数据|没有找到您要的资源/.test(text)) return {logged, noAccess:false, noResults:true, total:0, items:[]};

  const items=[], seen=new Set();
  const currentPage=new URL(location.href).searchParams.get('p')||'1';
  document.querySelectorAll('div.normal-list').forEach((el,i)=>{
    if(items.length>=20) return;
    const t=(el.textContent||'').replace(/\s+/g,' ').trim();
    let m=t.match(/^(\d+)\.(?:目录\s*)?(.+?)(文摘阅读|patent_|nstr_|cstad_|standard_)/);
    if(!m) return;
    const title=m[2].trim();
    const typeM=t.match(/\[(硕士论文|博士论文|期刊论文|会议论文|专利|科技报告|成果|标准|法规)\]/);
    if(title.length>8 && !seen.has(title)){
      seen.add(title);
      const btnContainer=el.querySelector('.button-list, [class*=button], [class*=btn]');
      const allBtns=btnContainer ? btnContainer.querySelectorAll('*') : [];
      let hasFull=false, hasDownload=false;
      allBtns.forEach(b=>{
        const txt=(b.innerText||b.textContent||'').trim();
        if(txt==='整篇下载') hasFull=true;
        if(txt==='下载'||txt==='整篇下载') hasDownload=true;
      });
      items.push({idx:i, key:'p'+currentPage+'#'+m[1], title, type:(typeM||[''])[0], hasFull, hasDownload});
    }
  });

  let mark=null;
  if(TARGET_INDEX!=null && items[TARGET_INDEX]){
    const el=document.querySelectorAll('div.normal-list')[items[TARGET_INDEX].idx];
    const allEls=el.querySelectorAll('*');
    let dlBtn=null;
    allEls.forEach(e=>{if((e.innerText||e.textContent||'').trim().match(/^(整篇下载|分章下载|下载)$/) && !dlBtn) dlBtn=e;});
    if(dlBtn){document.querySelectorAll('[data-target="wf-dl"]').forEach(e=>e.removeAttribute('data-target'));dlBtn.setAttribute('data-target','wf-dl'); mark=items[TARGET_INDEX].title;}
  }
  const dl = x => x.hasFull ? '[整篇]' : x.hasDownload ? '[下载]' : '[无]';
  const totalM = text.match(/找到([\d,]+)条/);
  const totalResults = totalM ? parseInt(totalM[1].replace(/,/g,'')) : items.length;
  const perPageM = text.match(/每页\s*(\d+)\s*条/);
  const perPage = perPageM ? parseInt(perPageM[1]) : 20;
  const totalPages = Math.ceil(totalResults / perPage);
  const header_out = '找到'+totalResults+'条  p'+currentPage+'/'+totalPages+'  每页'+perPage+'条';
  const list = items.slice(0,20).map((x,i) => '#'+(i+1)+'  '+(x.type||'-')+'  '+dl(x)+'  '+x.title).join('\n');
  // Active filters snapshot
  const activeFilters = [];
  document.querySelectorAll('label.ivu-checkbox-wrapper-checked .words').forEach(w => {
    const v = (w.textContent || '').trim();
    if (v && v.length < 50) activeFilters.push(v);
  });
  return {logged, noAccess, page:currentPage, totalResults, totalPages, perPage, items:items.slice(0,20), mark, activeFilters,
    display: header_out + '\n' + list};
}
```

Decision:
- `logged=false` → reload + retry; 仍失败 stop
- `TARGET_INDEX=null` → 展示 items，等用户选
- `mark=null` but TARGET_INDEX set → 按钮没找到，换一篇
- `mark` = title → proceed to download

## Page switch

URL `p=<N>` does **not** work — SPA resets to p=1. Use pagination clicks.

**Next page:**
```bash
node "${SKILL_DIR}/scripts/ff-eval.js" \
  --url "https://s.wanfangdata.com.cn/<type>?q=<encoded>&p=<N>" \
  --wait 1000 --code-file <code-file>
```
code: `() => { const btn=document.querySelector('.bottom-pagination .next'); if(btn) btn.click(); return {advanced:true}; }`

**Jump to page N:**
```bash
node "${SKILL_DIR}/scripts/ff-eval.js" \
  --url "https://s.wanfangdata.com.cn/<type>?q=<encoded>&p=<N>" \
  --wait 1000 --code-file <code-file>
```
code: `() => { const TARGET_PAGE='5'; ... }`（同原版 pagination logic）

> 跳页后重新 run merged evaluate。

## Download（使用 ff-run + --expect-download）

**一次 ff-run 完成全部。Write code to file first:**

```js
// wf-dl.js
const TARGET = <N>;
await page.goto('https://s.wanfangdata.com.cn/<type>?q=<encoded>&p=<page>', { waitUntil: 'domcontentloaded', timeout: 30000 });
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
      spans.forEach(s=>{const txt=(s.innerText||'').trim(); if(txt==='整篇下载'||txt==='下载') dlBtn=s;});
      items.push({idx:i, title, hasBtn:!!dlBtn});
    }
  });
  if(targetIdx < items.length && items[targetIdx].hasBtn){
    const el=document.querySelectorAll('div.normal-list')[items[targetIdx].idx];
    const spans=el.querySelectorAll('.button-list span');
    document.querySelectorAll('[data-target=\"wf-dl\"]').forEach(e=>e.removeAttribute('data-target'));
    spans.forEach(s=>{const txt=(s.innerText||'').trim(); if(txt==='整篇下载'||txt==='下载') s.setAttribute('data-target','wf-dl');});
    return {ok:true, title:items[targetIdx].title};
  }
  return {error:'no download button'};
}, TARGET);
if (markResult.error) return markResult;

await page.click('[data-target=\"wf-dl\"]');

// Wait for new tab (只学位论文会跳转 f.wanfangdata.com.cn，期刊直接下载)
let dlPage = null;
for (let i = 0; i < 15; i++) {
  for (const p of context.pages()) {
    if (p !== page && p.url().includes('f.wanfangdata.com.cn')) { dlPage = p; break; }
  }
  if (dlPage) break;
  await page.waitForTimeout(1000);
}

if (dlPage) {
  // Thesis flow: countdown page → click 点击此处
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
}
// else: periodical/conference — download triggered directly, --expect-download captures it

return {ok:true, title:markResult.title, hasDownloadPage:!!dlPage};
// --expect-download captures the download
```

```bash
node "${SKILL_DIR}/scripts/ff-run.js" \
  --expect-download \
  --save-as "E:/Desktop/<论文标题>.pdf" \
  --code-file /tmp/wf-dl.js
```
```

### 下载结果

ff-run `--save-as` 直接写到目标路径，无需 `place_download.js`。输出 JSON 含 `download.path`。

## Type table

| 类型 | path | 下载按钮 |
|------|------|---------|
| 全部 | `paper` | 下载 |
| 期刊 | `periodical` | 下载 |
| 学位 | `thesis` | 整篇下载/分章下载 |
| 会议 | `conference` | 下载 |
| 专利 | `patent` | 部分有下载 |
| 科技报告 | `nstr` | — |
| 成果 | `cstad` | — |
| 标准 | `standard` | 部分有下载 |
| 法规 | `law` | — |

## Filters（客户端 checkbox）

### Step 1：查询可选项

```bash
node "${SKILL_DIR}/scripts/ff-eval.js" \
  --url "https://s.wanfangdata.com.cn/<type>?q=<encoded>" \
  --wait 2000 --code-file <code-file>
```
code: `() => { document.querySelectorAll('.facet-list-box .title, [class*=facet] h3').forEach(h=>h.click()); const v=[]; document.querySelectorAll('label.ivu-checkbox-wrapper .words').forEach(w=>{const t=(w.textContent||'').trim(); if(t&&t.length<50) v.push(t);}); return [...new Set(v)]; }`

### Step 2：勾选 + 确定

```js
// wf-filter.js
const CHECKS=['2024','2023','硕士'];
await page.goto('URL',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2000);
const allLabels=await page.locator('label.ivu-checkbox-wrapper').all();
let toggled=0;
for(const label of allLabels){
  const w=label.locator('.words'); if(await w.count()===0) continue;
  const val=(await w.first().textContent())?.trim()||'';
  const isChecked=await label.evaluate(el=>el.className.includes('ivu-checkbox-wrapper-checked'));
  for(const c of CHECKS){ if(val.includes(c)&&!isChecked){ await label.evaluate(el=>el.click()); toggled++; break; } }
}
await page.waitForTimeout(500);
const btn=page.locator('span.fixed-btn-submit:has-text(\"确定\")');
if(await btn.count()>0){ await btn.first().click(); await page.waitForTimeout(1000); }
return {toggled};
```

```bash
node "${SKILL_DIR}/scripts/ff-run.js" --code-file /tmp/wf-filter.js
```

## Wanfang don'ts

- Never `request.fetch` / `route.fetch` / `page.goto` for downloads — only real click → download.saveAs
- Never click the same button twice without checking result
- Login expired: thesis buttons degrade from 整篇下载/分章下载 to bare 下载 → stop
