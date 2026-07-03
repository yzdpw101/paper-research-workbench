"""Read all downloaded PDFs and extract key info"""
import fitz, os

base = r'E:/Desktop/稀布综述/pdfs'
pdfs = []
for root, dirs, files in os.walk(base):
    for f in files:
        if f.endswith('.pdf'):
            pdfs.append(os.path.join(root, f))

print(f'Total PDFs: {len(pdfs)}')
for p in pdfs:
    doc = fitz.open(p)
    text = ''
    for page in doc:
        text += page.get_text()
    
    lines = text.split('\n')
    title = ''
    abstract_lines = []
    in_abstract = False
    for i, line in enumerate(lines):
        line = line.strip()
        if len(line) > 20 and not title:
            title = line[:100]
        if 'Abstract' in line or 'abstract' in line or '摘 要' in line or '摘要' in line:
            in_abstract = True
            continue
        if in_abstract:
            if 'Key words' in line or 'Keywords' in line or '关键词' in line or ('1 ' in line and len(line)<10):
                break
            abstract_lines.append(line)
    
    abstract = ' '.join(abstract_lines)[:300]
    fname = p.split(os.sep)[-1]
    fdir = p.split(os.sep)[-2]
    result = f'\n=== {fdir}/{fname} ({len(doc)}p) ===\n  Title: {title}\n'
    if abstract:
        result += f'  Abstract: {abstract[:200]}\n'
    print(result, end='', flush=True)
    doc.close()
