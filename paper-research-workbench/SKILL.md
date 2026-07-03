---
name: paper-research-workbench
description: Automate IEEE Xplore or Wanfang paper search/download with Playwright (Firefox/Chrome/Edge). Use for IEEE/Wanfang search, login checks, metadata extraction, PDF/ZIP download, chapter download, or figure extraction. Do not use for general literature review or academic writing.
---

# Paper Research Workbench

## Route first

Use the smallest matching path. Do not read every reference file.

| Intent | Read | Fast method |
|---|---|---|
| IEEE 搜索 | `ieee/search-download.md` | `ieee-search.js --q "..." --type Journals --year 2023-2025` |
| IEEE 摘要展开 | 同上，加 `--expand` | `ieee-search.js --q "..." --expand` |
| IEEE 下载 | `ieee/search-download.md` §PDF download | `ieee-download.js --arnumber <n> --save-as "..."` |
| IEEE 详情页 | `ieee/search-download.md` §Detail page | `ieee-detail.js --arnumber <n>` |
| IEEE Figures | `ieee/figures.md` | `ieee-figures.js --arnumber <n> --out-dir "..."` |
| Wanfang 搜索 | `wanfang/search-download.md` | `wf-search.js --q "..." --type thesis`（自带摘要，`--no-snippet` 去摘要省 token） |
| Wanfang 整篇下载 | `wanfang/search-download.md` | `wf-download.js --q "..." --type thesis --idx 0 --save-as "..."` |
| Wanfang 分章 | `wanfang/chapters.md` | `wf-chapter.js --q "..." --idx 0 --save-as "..."` |
| Setup | `shared/setup.md` | ⚠️ `shared/.setup-done` 不存在 → **停止一切**，逐步引导 |
| 切换浏览器 | `shared/setup.md` §切换默认浏览器 | `set-browser.js <firefox\|chrome\|edge>` |
| 适配其他 Agent | `shared/cross-agent.md` | 路径替换 + 前提条件 |
| 临时换浏览器 | 任意命令加 `--browser` | `ieee-search.js --browser chrome --q "..."` |

> **IEEE 渐进式**：标题→摘要→详情→下载，每步按需。**万方一步到位**：搜索页已有完整信息。说"检索"不跳到下载。

## Architecture

```
Skill (SKILL.md + platform docs)
    │
    │  bash calls
    ▼
┌─────────────────────────────────────────┐
│  scripts/                               │
│  ieee-search.js   IEEE search              │
│  ieee-detail.js   IEEE metadata extraction  │
│  ieee-download.js IEEE PDF download         │
│  ieee-figures.js  IEEE figure extraction    │
│  wf-search.js     Wanfang search            │
│  wf-download.js   Wanfang download          │
│  wf-chapter.js    Wanfang chapter download  │
│  eval.js       generic evaluate (fallback)│
│  run.js        generic run (fallback)     │
│  init.js      verify + init browser     │
│  set-browser.js   set default browser       │
│  place_download.js                      │
│  save_ieee_figures.py                   │
│  save_ieee_pdf.py                       │
└──────────────┬──────────────────────────┘
               │  Playwright Node.js API
               ▼
┌─────────────────────────────────────────┐
│  Firefox / Chrome / Edge                 │
│  (.state/storageState-<browser>.json)     │
│  Downloads → .state/downloads/            │
└─────────────────────────────────────────┘
```

## Key differences from Claude Code version

| Old (Claude Code) | New (Reasonix) |
|---|---|
| Playwright MCP `browser_*` tools | `node scripts/eval.js` / `run.js` |
| Chrome + CDP + Extension + Token | Firefox / Chrome / Edge + `storageState` |
| `browser_evaluate(function="...")` | `ieee-search.js` / `wf-search.js` 等专用脚本；`eval.js --code-file` 作 fallback |
| `browser_run_code_unsafe(async (page)=>{...})` | `run.js --code-file /tmp/code.js` |
| `browser_navigate(url)` + `browser_evaluate` | `eval.js --url "..." --code-file /tmp/code.js` (combined) |
| `browser_click [data-target="..."]` | `run.js --code-file /tmp/code.js` (page.click inside) |
| `chrome-preflight.ps1` → `CHROME_DIR` | `init.js` + `set-browser.js` → `.state/.browser` |
| `${SKILL_DIR}` | Same — Reasonix resolves via skill root |

## Hard rules

- **First-time setup**: 检查 `shared/.setup-done`。不存在 → **立即停止，禁止 Playwright**。按 `shared/setup.md` 逐步引导。完成后 Agent 跑 `init.js` → 创建 `.setup-done`。存在 → 正常流程。
- **搜索 ≠ 下载**: "检索/找/搜" → 只搜索+展示，不下载。"下载/下/保存" → 只下载。

- **Login**: 不依赖登录检查来阻塞操作。校园网 IP 认证不会产生持久 Cookie，登录检查经常误报。**搜索、详情、下载前不做登录检查**——直接尝试操作，失败时自然报错（如 404、无权访问等）。如果用户明确说"未登录"，再引导登录。
- **IEEE login**: 不做前置登录检查。下载时 `ieee-download.js` 会直接尝试 fetch，返回错误时再提示用户。
- **IEEE PDF**: 用 `ieee-download.js --arnumber <n> --save-as <path>`。`context.request.fetch()` 直接下载，无需登录检查。
- **Wanfang login**: 不依赖登录检查阻塞。`logged=false` 仅作提示，继续执行后续操作。最多 reload 1 次（SPA 不自动感知 CARSI cookie），仍失败也继续。
- **Wanfang pagination**: URL `p=<N>` does NOT work (SPA resets to p=1). Use bottom-pagination clicks.
- **Wanfang PDF**: 用 `wf-download.js --q "..." --type <type> --idx <n> --save-as <path>`。内置 thesis（新标签+倒计时+点击此处）vs periodical（直接下载）分流。
- **Browser preflight**: `init.js` 幂等。验证 profile + 下载目录。`set-browser.js <browser>` 切换默认浏览器。`--browser <browser>` 临时覆盖。
- **Wanfang buttons**: Use `data-target` attribute bridge: evaluate marks exact button → run.js clicks `[data-target="wf-dl"]`. Thesis: 整篇下载 preferred; bare 下载 = login expired → 换一篇。
- **Snapshots**: Prefer evaluate JSON on result pages (cheaper). `ref` 概念不适用（我们用文本 JSON 而非 accessibility tree）。
- **Detail expiry**: If redirected to home after login, reopen saved detail URL.
- **No results**: evaluate 内置 `noResults` 检测。`noResults=true` → 直接告知用户换搜索词。
- **Serial downloads**: IEEE 论文下载必须串行（每篇下完 place+rename 再下一篇）。
- **Human in the loop**: 一次失败 = 停 + 诊断 + 和用户交流，不反复重试。
- **Output**: Minimal: platform, title, final path, next action only.
- **Python**: Windows Git Bash 无 `python3`，统一用 `python`。
