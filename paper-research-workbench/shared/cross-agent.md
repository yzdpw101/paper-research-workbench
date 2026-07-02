# 适配其他 AI Agent

本 skill 所有脚本是标准 Node.js，任何能执行 `node` 的 Agent 都可以用。

## 直接可用的部分

| 组件 | 原因 |
|------|------|
| 所有 `scripts/*.js` / `scripts/*.py` | 纯命令行调用，与 Agent 无关 |
| `storageState-<browser>.json` | 文件持久化，跨 Agent 共享 |
| `shared/.browser` | 文件持久化 |
| 浏览器引擎 | Playwright 控制，不依赖 Agent |

## 需要适配的部分

| 组件 | Claude Code | OpenCode / Codex | 其他 |
|------|------------|-----------------|------|
| Skill 格式 | SKILL.md frontmatter | 同格式 | 取决于平台 |
| `${SKILL_DIR}` | 自动设为 skill 根目录 | **不支持**→ 改绝对路径 | 替换 |
| `settings.json` | `~/.claude/settings.json` | 对应平台路径 | — |
| Agent 指令 | Markdown code block | 该平台的 task routing 方式 | 替换 |

## 快速适配清单

1. 将所有 `${SKILL_DIR}` 替换为 skill 根目录的绝对路径
2. 确认目标 Agent 能执行 `node` 命令
3. 确认 Playwright 已安装：`npm install playwright`
4. 确认浏览器已安装：`npx playwright install firefox`（仅 Firefox）

## 前提条件

目标 Agent 必须：
1. 能执行 `node` 命令（运行脚本）
2. 能执行 `python` 命令（仅 `save_ieee_figures.py`，可跳过）
3. 能读写文件（写 code 文件到 temp、读 JSON 输出）

## 已测 Agent

| Agent | 状态 |
|-------|------|
| Reasonix | ✅ 完整测试 |
| Claude Code | ⚠️ 脚本通用，未验证 SKILL.md 加载 |
| OpenCode | ⚠️ 脚本通用，需改路径 |

## 浏览器支持

| 浏览器 | 状态 |
|--------|------|
| Firefox | ✅ 完整测试 |
| Chrome | ✅ 搜索+下载测试通过 |
| Edge | ⚠️ 代码已支持，未实机测试 |
