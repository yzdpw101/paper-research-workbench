"""Save IEEE PDF from browser_run_code_unsafe base64 result.
Usage: python save_ieee_pdf.py <cached-file> <out.pdf>"""
import base64, json, re, sys
from pathlib import Path

def extract_json(text: str) -> dict:
    # Skip markdown header lines, find first data line
    for line in text.split('\n'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        # Data may be JSON string wrapping inner JSON: "{\"key\":...}"
        try:
            parsed = json.loads(line)
            if isinstance(parsed, str) and parsed.strip().startswith('{'):
                return json.loads(parsed)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
        break
    # Regex fallback for unusual wrappers
    m = re.search(r'\{[^{}]*"b64"\s*:\s*"[^"\\]*(?:\\.[^"\\]*)*"[^{}]*\}', text, re.S)
    if m: return json.loads(m.group(0))
    m = re.search(r'\{.*\}', text, re.S)
    if m: return json.loads(m.group(0))
    raise ValueError('No JSON found')

def main() -> int:
    _, fin, fout = sys.argv[0], Path(sys.argv[1]), Path(sys.argv[2])
    if fout.suffix.lower() != '.pdf': fout = fout.with_suffix('.pdf')
    data = extract_json(fin.read_text('utf-8', errors='replace'))
    b64 = re.sub(r'\s+', '', data.get('b64', ''))
    buf = base64.b64decode(b64)
    if len(buf) < 1024 or not buf.startswith(b'%PDF-'):
        raise SystemExit(f'Invalid PDF: size={len(buf)} ct={data.get("contentType","?")}')
    fout.parent.mkdir(parents=True, exist_ok=True)
    fout.write_bytes(buf)
    print(str(fout))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
