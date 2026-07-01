# First-time Setup (Reasonix + Firefox)

检查 `.reasonix/skills/paper-research-workbench/shared/.setup-done` 是否存在。存在 → 跳过。不存在 → 按以下步骤引导，完成后创建该文件。

## Step 1: 确认环境

Agent 跑：

```bash
node -e "require('playwright'); console.log('Playwright OK')"
npx playwright install --list 2>&1 | grep firefox
```

- Playwright 未安装 → `npm install playwright`
- Firefox browser 未安装 → `npx playwright install firefox`

## Step 2: 配置 Firefox 下载偏好

```bash
node "${SKILL_DIR}/scripts/ff-setup.js" --dir "E:/Downloads/Firefox"
```

幂等操作，设完输出：
```
FF_DOWNLOAD_DIR=E:/Downloads/Firefox
FF_PROFILE_DIR=C:/Users/Tel13/playwright-firefox-profile-v2
Firefox preflight OK
```

## Step 3: 跳过

无需 Chrome 扩展、无需 Token、无需 MCP 配置。直接可用。

## 完成

Agent 创建 `shared/.setup-done`。

## 关键路径

| 路径 | 用途 |
|------|------|
| `E:/Downloads/Firefox` | Firefox 下载目录 |
| `C:/Users/Tel13/playwright-firefox-profile-v2` | Firefox 持久化用户目录（Cookie/登录态） |
| `${SKILL_DIR}/scripts/` | 全部脚本位置 |

## 排查

| 现象 | 可能原因 | 怎么做 |
|------|---------|--------|
| `Error: Cannot find module 'playwright'` | 依赖未安装 | `npm install playwright` |
| `Firefox not found` | 浏览器未下载 | `npx playwright install firefox` |
| 下载没出现在目录 | 下载仍在进行 | 检查 `wait_latest_download.js` 是否正常等待 |
| 登录态丢失 | Profile 损坏 | 删除 `C:/Users/Tel13/playwright-firefox-profile-v2` 重新登录 |

**核心原则：一次失败 = 诊断 + 沟通，不反复重试。**
