# 浏览器配置

## 默认浏览器

`shared/.browser` 文件记录默认浏览器（firefox / chrome / edge）。

```bash
node scripts/set-browser.js                # 查看当前
node scripts/set-browser.js chrome          # 设为 Chrome
node scripts/set-browser.js firefox         # 设为 Firefox
```

单个命令临时切换（不改变默认）：

```bash
node scripts/ieee-search.js --browser chrome --q "..."
```

## 登录态

按浏览器独立存储，位于 `~/.paper-research-workbench/storageState-<browser>.json`。

首次在新浏览器中运行脚本时需登录一次。登录后 Cookie 自动保存，每 30 秒自动备份。后续无需重新登录。

重置登录态：

```bash
rm ~/.paper-research-workbench/storageState-*.json
```

## 下载机制

- IEEE PDF：`context.request.fetch(stampPDF)` 直接抓取字节流，跨浏览器通用，不触发 PDF 查看器
- 万方 PDF：点击下载按钮，`page.on('download')` 事件捕获，`download.createReadStream()` 保存
- 下载目录：`E:/Downloads/Firefox`（可通过 `--save-as` 指定最终路径）

## 浏览器安装

- Firefox：`npx playwright install firefox`（Playwright 自带）
- Chrome / Edge：使用系统安装版，无需额外下载
