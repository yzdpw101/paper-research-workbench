# Local PDF processing

Use this only after a PDF is already local.

## PDF 页 → 论文内容页映射

提取文字/图片时，PDF 页码与实际论文内容页码不同：

| 论文类型 | 1 页 PDF 对应 | 来源 |
|---------|--------------|------|
| IEEE 期刊/会议 | 2 页论文内容 | IEEE Xplore |
| 万方期刊/会议 | 2 页论文内容 | 万方 |
| 万方毕业论文 | 1 页论文内容 | 万方 |

## Text extraction

```python
import fitz
from pathlib import Path

pdf = Path('paper.pdf')
doc = fitz.open(pdf)
text = []
for i, page in enumerate(doc, 1):
    text.append(f'\n\n## Page {i}\n' + page.get_text())
Path('paper.txt').write_text('\n'.join(text), encoding='utf-8')
```

If text is empty or garbled, the PDF is probably scanned. Ask before OCR unless the user explicitly requested OCR.

## Figure extraction

Sort figures top-to-bottom, then left-to-right. 命名时按映射规则转换页码：

```python
import fitz
from pathlib import Path

pdf = Path('paper.pdf')
out_dir = Path('figures')
out_dir.mkdir(exist_ok=True)
doc = fitz.open(pdf)
is_thesis = False  # 硕士/博士论文设为 True

for page_idx, page in enumerate(doc):
    rows=[]
    for img in page.get_images(full=True):
        xref = img[0]
        rects = page.get_image_rects(xref)
        if not rects:
            continue
        base = doc.extract_image(xref)
        r = rects[0]
        rows.append((round(r.y0, -1), r.x0, xref, base))
    rows.sort(key=lambda z: (z[0], z[1]))
    # 按映射规则确定论文页码
    if is_thesis:
        page_num = page_idx + 1
    else:
        start = page_idx * 2 + 1
        page_num = f"{start}-{start+1}"
    for seq, (_, _, xref, base) in enumerate(rows, 1):
        ext = base.get('ext', 'png')
        (out_dir / f'p{page_num}_{seq:02d}.{ext}').write_bytes(base['image'])
```
