# 万方分章节下载 (Reasonix + Firefox)

仅限硕博论文。使用专用 `wf-chapter.js` 一步完成。

## 用法

```bash
node "${SKILL_DIR}/scripts/wf-chapter.js" \
  --q "<关键词>" \
  --idx <N> \
  --save-as "<输出路径>.zip"
```

默认勾选前 2 节（`auto:2`），自动展开含子节的章。

### 参数

| 参数 | 默认 | 说明 |
|------|------|------|
| `--q` | **必填** | 搜索关键词 |
| `--idx` | `0` | 第几篇（0-based） |
| `--page` | `1` | 搜索页码 |
| `--expand` | auto | 要展开的章标题（逗号分隔），如 `第一章,第二章` |
| `--check` | `auto:2` | 要勾选的节标题（逗号分隔），或 `auto:N` 自动选前 N 节 |
| `--save-as` | 自动命名 | 输出路径（`.zip`） |
| `--no-close` | off | 浏览器保持打开 |

### 示例

```bash
# 自动模式：下载第 1 篇，自动选前 2 节
node "${SKILL_DIR}/scripts/wf-chapter.js" \
  --q "稀布阵列" --idx 0 --save-as "E:/Desktop/稀布阵列_分章.zip"

# 手动指定章节
node "${SKILL_DIR}/scripts/wf-chapter.js" \
  --q "稀布阵列" --idx 0 \
  --expand "第二章,第三章" \
  --check "2.1理论基础,2.2建模方法,3.1优化算法" \
  --save-as "E:/Desktop/chapters.zip"
```

### 返回值

```json
// 成功
{"status":"ok","download":{"name":"...zip","path":"E:/...","size":8117471}}

// 失败（无分章）
{"status":"error","error":"no chapter download for index 0","available":["篇名1","篇名2"]}

// 失败（无书签）
{"status":"error","error":"no chapter bookmarks in PDF","details":{"tier":"none"}}

// 失败（未登录 — 加 --no-close 后手动登录）
{"status":"error","error":"not logged in — use --no-close and log in manually"}
```

## 注意事项

- **首次使用**：加 `--no-close`，浏览器打开后手动登录万方，关闭浏览器后登录态自动保存。后续无需 `--no-close`
- `hasChapter=true` ≠ PDF 有分层书签。脚本自动诊断 tier
- tier=flat：自动勾选前 N 个叶子节点
- tier=none：建议改用整篇下载
- 分章页 URL 含 `d.wanfangdata.com.cn/part/thesis/`
- 确认下载后自动忽略 `f.wanfangdata.com.cn` 新标签
