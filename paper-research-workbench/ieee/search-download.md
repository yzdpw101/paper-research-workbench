# IEEE Xplore fast path (Reasonix + Firefox)

> **Code pattern**: Multi-line evaluate code must use `--code-file` (shell-safe). Write code to a temp file first, then pass it.

## Preflight

```bash
node "${SKILL_DIR}/scripts/ff-setup.js" --dir "~/Downloads/paper-research-workbench"
```

## URL 参数速查

基础搜索 URL：
```
https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=<encoded>
```

| 参数 | 格式 | 示例 |
|------|------|------|
| ContentType | `&refinements=ContentType:<Type>` | `ContentType:Conferences` |
| Year 范围 | `&ranges=<YYYY>_<YYYY>_Year` | `&ranges=2024_2025_Year` |
| 单年 | `&ranges=<YYYY>_<YYYY>_Year` | `&ranges=2024_2024_Year` |
| 翻页 | `&pageNumber=<N>` | `&pageNumber=2` |
| 每页条数 | `&rowsPerPage=<N>` | `&rowsPerPage=50`（10/25/50/75/100） |

**⚠️ Year 不走 `refinements=`，走 `&ranges=`。**

### ContentType 取值

| 值 | 说明 |
|----|------|
| `Conferences` | 会议论文 |
| `Journals` | 期刊论文 |
| `Magazines` | 杂志 |
| `Books` | 书籍 |
| `Early Access Articles` | 早期发表 |
| `Standards` | 标准 |

> 不加 = 全部类型。ContentType 不可叠加，Year 和 ContentType 可同时用。

## 检索流程（逐层渐进）

```
1. 搜索 → ff-eval → 只展示标题+arnumber（紧凑列表）
2. 用户说"摘要" → 展开+提取 → 展示 snippet
3. 用户说"详情/第X篇" → ff-eval 详情页 → 展示元数据
4. 用户说"下载" → ff-run --expect-download --save-as → 一步到位
```

**展示**：直接输出 evaluate 返回的 `display` 字段（已预格式化），不加分析不推荐。

## Search → login check + extract results

1. Write evaluate code to temp file（此代码含 `${}` 模板字面量，不能直接放 `--code`）：

```js
// ieee-search.js
() => {
  const text=(document.body.innerText||'').replace(/\s+/g,' ').slice(0,8000);
  const hasSignOut=/\bSign Out\b/i.test(text);
  const accessProvided=/Access provided by/i.test(text);
  const signInMarkers=/Institutional Sign In|Personal Sign In|Sign in|Sign In/i.test(text);
  const denialMarkers=/Purchase PDF|Subscribe|Access Denied|Get Access|Sign in to access/i.test(text);
  const accessReady=hasSignOut || accessProvided;
  const needLogin=!accessReady && (signInMarkers || denialMarkers);
  if (!accessReady) return {accessReady, needLogin, sample:text.slice(0,160)};

  const noResults=/No results found|unable to find results/i.test(text);
  if (noResults) return {accessReady, needLogin, noResults:true, total:0, items:[]};

  const out=[], seen=new Set();
  document.querySelectorAll('a[href*=\"/document/\"]').forEach(a=>{
    const m=a.href.match(/\/document\/(\d+)/);
    const title=(a.textContent||'').trim().replace(/\s+/g,' ');
    if(m && title && !seen.has(m[1])){
      seen.add(m[1]);
      out.push({arnumber:m[1], title, url:a.href});
    }
  });
  const list = out.slice(0,20).map((x,i)=>'#'+(i+1)+'  '+x.arnumber+'  '+x.title).join('\n');
  const totalM = text.match(/Showing \d+-\d+ of ([\d,]+)/);
  const totalResults = totalM ? parseInt(totalM[1].replace(/,/g,'')) : out.length;
  const perPage = parseInt(new URL(location.href).searchParams.get('rowsPerPage')||'25');
  const totalPages = Math.ceil(totalResults/perPage);
  const info = 'Showing '+out.length+' of '+totalResults+'  p1/'+totalPages+'  '+perPage+' rows/page';
  return {accessReady, needLogin, totalResults, perPage, totalPages, items:out.slice(0,20), display:info+'\n'+list};
}
```

2. Run:

```bash
node "${SKILL_DIR}/scripts/ff-eval.js" \
  --url "https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=<encoded>" \
  --wait 3000 \
  --code-file /tmp/ieee-search.js
```

`accessReady=false` → stop, prompt login. 否则用 `items` 列表。

## Detail page — login check + metadata

Write code file then run:

```js
// ieee-detail.js
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
  const dateM = b.match(/Date of Conference:\s*(.+?)(?:\s+DOI|\s+Date Added|\s+Publisher|\s+INSPEC)/);
  const pubDate = dateM ? dateM[1].trim() : '';
  const doiM = b.match(/DOI:\s*(10\.\d+\/[^\s]+)/);
  const doi = doiM ? doiM[1] : '';
  const authKW = raw.match(/Author Keywords\s*\n([\s\S]*?)(?:\nIEEE Keywords|\nMetrics)/);
  const ieeeKW = raw.match(/IEEE Keywords\s*\n([\s\S]*?)(?:\nMetrics|\nAdvertisement)/);
  return {accessReady, title, authors:authors.slice(0,8), abstract:abstract.slice(0,500), publishedIn, pubDate, doi,
    keywords:{author:authKW?authKW[1].trim().replace(/\n/g,', '):'', ieee:ieeeKW?ieeeKW[1].trim().replace(/\n/g,', '):''}};
}
```

```bash
node "${SKILL_DIR}/scripts/ff-eval.js" \
  --url "https://ieeexplore.ieee.org/document/<arnumber>/" \
  --wait 3000 \
  --code-file /tmp/ieee-detail.js
```

## Abstract expand

```bash
node "${SKILL_DIR}/scripts/ff-eval.js" \
  --url "https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=<encoded>" \
  --wait 2000 \
  --code "() => { document.querySelectorAll('.abstract-control').forEach(c=>{if(c.querySelector('.fa-angle-down'))c.click();}); const body=(document.body?.innerText||'').replace(/\s+/g,' '); const titles=[]; document.querySelectorAll('a[href*=\"/document/\"]').forEach(a=>{const t=(a.textContent||'').trim().replace(/\s+/g,' '); if(t.length>15&&titles.length<5){const idx=body.indexOf(t); if(idx>=0)titles.push({title:t,snippet:body.slice(idx+t.length,idx+t.length+300)});}}); return titles; }"
```

> 简短 code 可直接 `--code`（无 `${}` 即可）。

## 筛选器侧边栏 / 翻页

同样用 `--code-file` 模式（参考原版 evaluate 代码，写法不变，只改传参方式）。

## PDF download — `--expect-download --save-as` 一步到位

> **下载前先确认有权限**：在详情页 evaluate 检查 `Download PDF` 按钮是否存在。如无权限（`Purchase PDF`/`Sign in to access`），不要触发下载。

```bash
node "${SKILL_DIR}/scripts/ff-run.js" \
  --expect-download \
  --save-as "~/Desktop/my_paper.pdf" \
  --timeout 60000 \
  --code "const AR='<arnumber>'; try { await page.goto('https://ieeexplore.ieee.org/stampPDF/getPDF.jsp?tp=&arnumber='+AR,{timeout:15000,waitUntil:'commit'}); } catch(e){} return {ok:true,arnumber:AR};"
```

> 如 `--save-as` 报 ENOENT，改用 `--download-dir "~/Downloads/paper-research-workbench"` 然后手动 cp。

输出包含 `download.path` → 直接就是最终文件。

### Login check before download

```bash
node "${SKILL_DIR}/scripts/ff-eval.js" \
  --url "https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=test" \
  --wait 2000 \
  --code "()=>{const t=(document.body.innerText||'').replace(/\s+/g,' ').slice(0,8000); return {accessReady:/\bSign Out\b/i.test(t)||/Access provided by/i.test(t)};}"
```

## Figures

见 `ieee/figures.md`。
