# 浏览器配置

## 默认浏览器

`shared/.browser` 文件记录默认浏览器（firefox / chrome / edge）。

```bash
node scripts/set-browser.js                # 查看当前
node scripts/set-browser.js chrome          # 设为 Chrome
node scripts/set-browser.js firefox         # 设为 Firefox
node scripts/set-browser.js edge            # 设为 Edge
```

单个命令临时切换（不改变默认）：

```bash
node scripts/ieee-search.js --browser edge --q "..."
```

## 浏览器差异

| 特性 | Firefox | Chrome | Edge |
|------|:--:|:--:|:--:|
| Playwright 引擎 | `firefox` | `chromium` | `chromium` |
| channel 参数 | — | `chrome` | `msedge` |
| 安装方式 | `npx playwright install firefox` | 系统自带 | Windows 自带 |
| PDF 查看器干扰 | 无 | 有（fetch 方案规避） | 有（fetch 方案规避） |
| 残留进程名 | `firefox.exe` | `chrome.exe` | `msedge.exe` |

> IEEE 下载统一使用 `context.request.fetch()` 直接从服务端抓取 PDF 字节流，不依赖浏览器下载行为，因此 Chrome/Edge 内置 PDF 查看器不影响。

## 登录态

按浏览器独立存储：`~/.paper-research-workbench/storageState-<browser>.json`

首次在新浏览器中运行脚本时需登录一次。登录后 Cookie 每 30 秒自动保存。

重置：
```bash
rm ~/.paper-research-workbench/storageState-*.json
```

## 下载机制

- IEEE PDF：`context.request.fetch(stampPDF)` 直接抓取字节流
- 万方 PDF：浏览器点击下载按钮 → `page.on('download')` → `createReadStream()` 保存
- `--save-as` 支持目录（保留原名）或完整文件路径

> **Edge 状态**：代码已支持但未经实机测试。如有问题请反馈。

