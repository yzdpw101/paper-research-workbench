"""Save multiple base64-encoded images from browser_run_code_unsafe result.
Usage: python save_figures.py <cached-file> <out-dir>"""
import base64, json, re, sys
from pathlib import Path

def extract(text: str) -> list:
    for line in text.split('\n'):
        line = line.strip()
        if not line or line.startswith('#'): continue
        try:
            parsed = json.loads(line)
            if isinstance(parsed, str): parsed = json.loads(parsed)
            if isinstance(parsed, list): return parsed
            if isinstance(parsed, dict) and 'b64' in parsed: return [parsed]
        except: pass
        break
    m = re.search(r'\[.*\]', text, re.S)
    if m: return json.loads(m.group(0))
    raise ValueError('No image data found')

def main() -> int:
    _, fin, out_dir = sys.argv[0], Path(sys.argv[1]), Path(sys.argv[2])
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    items = extract(fin.read_text('utf-8', errors='replace'))
    saved = []
    for item in items:
        name = item.get('name', f"fig_{len(saved)+1}")
        b64 = re.sub(r'\s+', '', item.get('b64', ''))
        ext = item.get('ext', 'gif')
        path = out_dir / f"{name}.{ext}"
        data = base64.b64decode(b64)
        path.write_bytes(data)
        saved.append(f"{path} ({len(data)} bytes)")
    print('\n'.join(saved))
    print(f"\nSaved {len(saved)} files to {out_dir}")
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
