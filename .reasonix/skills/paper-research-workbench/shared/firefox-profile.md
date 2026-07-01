# Firefox Profile & Download

## Preflight

每次平台操作前运行（幂等）。验证 profile + 下载目录：

```bash
node "${SKILL_DIR}/scripts/ff-setup.js" --dir "E:/Downloads/Firefox"
```

输出：
```
FF_DOWNLOAD_DIR=E:/Downloads/Firefox
FF_PROFILE_DIR=C:/Users/Tel13/playwright-firefox-profile-v2
Firefox preflight OK
```

## 下载机制（重要）

**不依赖 Firefox 浏览器下载。** Playwright 的 `download.saveAs()` API 直接拦截下载事件，将文件写入目标路径。推荐使用 `ff-run --expect-download --save-as <path>` 一步到位。

| 旧方案（Chrome 时代） | 新方案（Playwright API） |
|---|---|
| `chrome-preflight.ps1` 设 `always_open_pdf_externally=true` | 不需要 |
| `firefoxUserPrefs: pdfjs.disabled=true` | 不需要 |
| `wait_latest_download.js` 轮询磁盘 | 不需要（`--save-as` 直接指定最终路径） |
| `place_download.js` copy 到目标 | 不需要（`--save-as` 一步到位） |
| 依赖浏览器下载行为 | Playwright 直接程序控制 |

`wait_latest_download.js` 和 `place_download.js` 保留作为 fallback。

## Profile 路径

默认路径 `C:/Users/Tel13/playwright-firefox-profile-v2/`，可通过以下方式覆盖：

```bash
# 环境变量
export FF_PROFILE_DIR="C:/path/to/custom-profile"

# 或命令行参数
node .../ff-eval.js --profile "C:/path/to/custom-profile" ...
```

内含：
- `cookies.sqlite` — Cookie 持久化（跨会话保留登录态）
- `storage/` — localStorage/sessionStorage
- `places.sqlite` — 浏览历史

## 重置 Profile

如果登录态异常：
```bash
rm -rf "C:/Users/Tel13/playwright-firefox-profile-v2"
```
下次运行自动重建，需重新登录。
