# Paper Research Workbench

Automate IEEE Xplore and Wanfang paper search, metadata extraction, PDF download, chapter download, and figure extraction with Playwright (Firefox / Chrome / Edge).

## Quick Start

```bash
npm install playwright
npx playwright install firefox   # Firefox only; Chrome/Edge use system install

cd scripts
node set-browser.js firefox       # choose default browser
node ff-setup.js                  # verify environment
node ieee-search.js --q "sparse array antenna" --type Journals --expand
node ieee-download.js --arnumber 9134643 --save-as ~/Desktop/
```

## Scripts

| Script | Function |
|--------|----------|
| `ieee-search.js` | IEEE search with optional abstract expansion |
| `ieee-detail.js` | IEEE detail page metadata (full abstract, references, keywords) |
| `ieee-download.js` | IEEE PDF download (fetch-based, cross-browser) |
| `ieee-figures.js` | IEEE figure extraction + download |
| `wf-search.js` | Wanfang search with built-in abstracts |
| `wf-download.js` | Wanfang PDF download (thesis/periodical auto-detect) |
| `wf-chapter.js` | Wanfang thesis chapter download (ZIP) |
| `ff-eval.js` | Generic navigate + evaluate (fallback) |
| `ff-run.js` | Generic Playwright operations (fallback) |
| `ff-setup.js` | Verify environment |
| `set-browser.js` | Set/get default browser |

## Browsers

```bash
node set-browser.js firefox    # default
node set-browser.js chrome
node set-browser.js edge       # untested

# One-time override:
node ieee-search.js --browser chrome --q "..."
```

Login state per browser stored in `~/.paper-research-workbench/storageState-<browser>.json`.

## Agent Compatibility

All scripts are standard Node.js. Works with any agent that can run shell commands. See `shared/cross-agent.md`.

## License

MIT
