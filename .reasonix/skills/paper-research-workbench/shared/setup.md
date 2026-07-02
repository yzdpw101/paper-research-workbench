# First-time Setup

检查 `shared/.setup-done` 是否存在。存在 → 跳过。不存在 → 按以下步骤引导，完成后创建该文件。

## Step 1: 确认环境

Agent 跑：

```bash
node -e "require('playwright'); console.log('Playwright OK')"
```

- Playwright 未安装 → `npm install playwright`

## Step 2: 选择默认浏览器

```bash
node "${SKILL_DIR}/scripts/set-browser.js" <firefox|chrome|edge>
```

如不选，默认 firefox。首次运行 `ff-setup.js` 时也会自动写入 firefox。

| 浏览器 | 安装 |
|--------|------|
| Firefox | `npx playwright install firefox` |
| Chrome | 系统自带 |
| Edge | Windows 自带 |

## Step 3: 验证环境

```bash
node "${SKILL_DIR}/scripts/ff-setup.js" --dir "E:/Downloads/Firefox"
```

输出类似：
```
BROWSER=firefox
DOWNLOAD_DIR=E:/Downloads/Firefox
STATE_FILE=.../storageState-firefox.json
BROWSER_FILE=.../shared/.browser
Preflight OK
```

## Step 4: 登录

浏览器打开后手动登录 IEEE + 万方，关闭窗口。Cookie 自动保存到 `storageState-<browser>.json`。

后续无需重新登录。

## 完成

Agent 创建 `shared/.setup-done`。

## 切换默认浏览器

```bash
node "${SKILL_DIR}/scripts/set-browser.js" chrome   # 永久切换
node "${SKILL_DIR}/scripts/set-browser.js"           # 查看当前
```

临时用其他浏览器（不改变默认）：

```bash
node "${SKILL_DIR}/scripts/ieee-search.js" --browser chrome --q "..."
```

## 关键路径

| 路径 | 用途 |
|------|------|
| `E:/Downloads/Firefox` | 下载目录 |
| `shared/.browser` | 默认浏览器配置（firefox/chrome/edge） |
| `~/.paper-research-workbench/storageState-<browser>.json` | 登录态（按浏览器独立） |

## 排查

| 现象 | 可能原因 | 怎么做 |
|------|---------|--------|
| `Error: Cannot find module 'playwright'` | 依赖未安装 | `npm install playwright` |
| `Firefox not found` | 浏览器未下载 | `npx playwright install firefox` |
| 登录态丢失 | Cookie 过期 | 删 `storageState-*.json` 重新登录 |
| Chrome 启动失败 | 系统未安装 Chrome | 装 Chrome 或用 `set-browser.js firefox` |

**核心原则：一次失败 = 诊断 + 沟通，不反复重试。**
