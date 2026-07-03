"""Extract all PDF content to a text file for reading"""
import fitz, os

base = r'E:/Desktop/稀布综述/pdfs'
output = r'E:/Desktop/稀布综述/精读笔记/all_papers_summary.txt'

with open(output, 'w', encoding='utf-8') as out:
    pdfs = []
    for root, dirs, files in os.walk(base):
        for f in files:
            if f.endswith('.pdf'):
                pdfs.append(os.path.join(root, f))
    
    out.write(f'Total PDFs: {len(pdfs)}\n')
    out.write('='*80 + '\n')
    
    for p in pdfs:
        doc = fitz.open(p)
        text = ''
        for page in doc:
            text += page.get_text()
        
        fname = p.split(os.sep)[-1]
        fdir = p.split(os.sep)[-2]
        
        out.write(f'\n{"="*80}\n')
        out.write(f'File: {fdir}/{fname} ({len(doc)} pages)\n')
        out.write(f'{"="*80}\n\n')
        
        # Write first 2000 chars (title + abstract + intro)
        out.write(text[:2000])
        out.write('\n\n[...]\n\n')
        # Write last 1000 chars (conclusion)
        out.write(text[-1000:])
        out.write('\n\n')
        
        doc.close()

print(f'Summary saved to: {output}')
print(f'Total PDFs: {len(pdfs)}')
