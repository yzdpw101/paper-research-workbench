#!/usr/bin/env python
"""
Batch fetch IEEE paper details using paper-research-workbench's ff-eval.js
Reads ieee_papers.json, fetches details for each arnumber, saves to ieee_metadata.json
"""
import json, subprocess, os, sys, time

SKILL_DIR = "C:/Users/Tel13/AppData/Roaming/reasonix/global-workspace/.reasonix/skills/paper-research-workbench"
FF_EVAL = os.path.join(SKILL_DIR, "scripts/ff-eval.js")
CODE_FILE = "/tmp/detail_extract.js"

# Load paper list
papers = json.load(open("ieee_papers.json"))

# Load existing metadata if any
meta_path = "ieee_metadata.json"
if os.path.exists(meta_path):
    metadata = json.load(open(meta_path, encoding='utf-8'))
    print(f"Loaded existing metadata: {len(metadata)} papers")
else:
    metadata = {}

# Count total
all_arns = []
for cat, items in papers.items():
    for arn, title in items:
        if arn not in metadata:
            all_arns.append((cat, arn, title))

print(f"Total papers: {sum(len(v) for v in papers.values())}")
print(f"Already fetched: {len(metadata)}")
print(f"Remaining to fetch: {len(all_arns)}")

# Write the ff-eval code file
code_content = """() => {
  const raw = (document.body?.innerText || '');
  const b = raw.replace(/[\\s]+/g, ' ');
  const accessReady = /\\bSign Out\\b/i.test(b) || /Access provided by/i.test(b);
  if (!accessReady) return { accessReady, error: 'not logged in' };
  let title = (document.querySelector('h1')?.textContent || '').trim().replace(/\\s+/g, ' ');
  if (!title || title.length < 10) {
    const tm = b.match(/ADVANCED SEARCH[\\s\\S]*?>([^>]+?)Publisher:\\s*IEEE/);
    title = tm ? tm[1].trim().replace(/\\s*>\\s*$/, '') : '';
  }
  const am = b.match(/Cite This\\s*PDF\\s+(.+?)All Authors/);
  const authors = am ? am[1].trim().split(';').map(s => s.trim()).filter(s => s.length > 2 && !s.includes('All')) : [];
  const absM = b.match(/Abstract:\\s*(.+?)(?:Published in:|Date of Conference:|Date of\\b|DOI:|Publisher:|Show More)/);
  const abstract = absM ? absM[1].trim() : '';
  const pubM = b.match(/Published in:\\s*(.+?)(?:\\s+Date of|\\s+DOI:|\\s+Publisher:)/);
  const publishedIn = pubM ? pubM[1].trim() : '';
  const dateM = b.match(/Date of Conference:\\s*(.+?)(?:\\s+DOI|\\s+Date Added|\\s+Publisher|\\s+INSPEC)/);
  const pubDate = dateM ? dateM[1].trim() : '';
  const doiM = b.match(/DOI:\\s*(10\\.\\d+\\/[^\\s]+)/);
  const doi = doiM ? doiM[1] : '';
  const authKW = raw.match(/Author Keywords\\s*\\n([\\s\\S]*?)(?:\\nIEEE Keywords|\\nMetrics)/);
  const ieeeKW = raw.match(/IEEE Keywords\\s*\\n([\\s\\S]*?)(?:\\nMetrics|\\nAdvertisement)/);
  return {
    accessReady, title, arnumber: window.location.pathname.match(/\\/document\\/(\\d+)/)?.[1] || '',
    authors: authors.slice(0, 10),
    abstract: abstract.slice(0, 800),
    publishedIn, pubDate, doi,
    keywords: {
      author: authKW ? authKW[1].trim().replace(/\\n/g, ', ') : '',
      ieee: ieeeKW ? ieeeKW[1].trim().replace(/\\n/g, ', ') : ''
    }
  };
}"""

with open(CODE_FILE, 'w', encoding='utf-8') as f:
    f.write(code_content)

# Fetch each paper
for i, (cat, arn, title) in enumerate(all_arns):
    print(f"\n[{i+1}/{len(all_arns)}] {cat}: {arn} - {title[:50]}...")
    
    cmd = [
        "node", FF_EVAL,
        "--url", f"https://ieeexplore.ieee.org/document/{arn}/",
        "--wait", "4000",
        "--code-file", CODE_FILE
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        output = result.stdout.strip()
        
        if output:
            data = json.loads(output)
            if data.get('accessReady'):
                data['category'] = cat
                data['_title_short'] = title
                metadata[arn] = data
                print(f"  OK: {data.get('title', 'N/A')[:60]}")
            else:
                print(f"  FAIL: {data.get('error', 'unknown')}")
        else:
            print(f"  EMPTY output (stderr: {result.stderr[:200]})")
    except Exception as e:
        print(f"  ERROR: {e}")
    
    # Save after each batch of 5
    if (i+1) % 5 == 0 or i == len(all_arns) - 1:
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        print(f"  [Saved {len(metadata)} papers to {meta_path}]")
    
    time.sleep(0.5)

print(f"\nDone! Total metadata: {len(metadata)} papers")
