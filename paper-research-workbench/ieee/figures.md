# IEEE 图片下载 (Reasonix + Firefox)

使用 `ieee-figures.js` 一步完成。

## 用法

```bash
node "${SKILL_DIR}/scripts/ieee-figures.js" --arnumber <n> --out-dir "<dir>"
```

## 示例

```bash
node "${SKILL_DIR}/scripts/ieee-figures.js" --arnumber 9134643 --out-dir "~/Desktop/figs"
```

## 返回值

```json
{
  "ok": true,
  "arnumber": "9134643",
  "figureCount": 8,
  "saved": 8,
  "failed": 0,
  "files": [
    {"name": "kedar1-p4-kedar.gif", "path": "~/Desktop/figs/kedar1-p4-kedar.gif", "size": 38217},
    ...
  ]
}
```

## 注意

- 只有论文详情页有 Figures 标签，搜索结果页没有
- 优先用 `-large` 版本图片
- IEEE 图片通常是 GIF 格式
- 下载前确保已登录机构账号
