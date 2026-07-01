/**
 * Wait for the newest completed Wanfang-like download after a timestamp.
 * No external dependencies.
 * Usage:
 *   node wait_latest_download.js <download-dir> [--since-ms 1710000000000] [--timeout 90000]
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dir = args[0] || process.cwd();
function opt(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const sinceMs = Number(opt('--since-ms', '0')) || 0;
const timeout = Number(opt('--timeout', '90000')) || 90000;
const poll = 1000;
const exts = new Set(['.pdf', '.zip', '.caj', '.nh']);

if (!fs.existsSync(dir)) {
  console.error(JSON.stringify({ ok: false, message: 'Directory not found', dir }, null, 2));
  process.exit(2);
}

function scan() {
  const names = fs.readdirSync(dir);
  const active = names.filter(n => n.endsWith('.crdownload') || n.endsWith('.tmp'));
  const files = names
    .filter(name => !name.endsWith('.crdownload') && !name.endsWith('.tmp'))
    .map(name => {
      const full = path.join(dir, name);
      let st;
      try { st = fs.statSync(full); } catch (_) { return null; }
      if (!st.isFile()) return null;
      return { name, full, mtimeMs: st.mtimeMs, size: st.size, ext: path.extname(name).toLowerCase() };
    })
    .filter(Boolean)
    .filter(f => f.size > 0 && exts.has(f.ext) && f.mtimeMs >= sinceMs - 60000)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return { active, files };
}

(async () => {
  const start = Date.now();
  while (Date.now() - start <= timeout) {
    const { active, files } = scan();
    if (files.length && active.length === 0) {
      const f = files[0];
      console.log(JSON.stringify({
        ok: true,
        path: f.full,
        name: f.name,
        size: f.size,
        modified: new Date(f.mtimeMs).toISOString(),
        dir
      }, null, 2));
      process.exit(0);
    }
    await new Promise(r => setTimeout(r, poll));
  }
  const { active, files } = scan();
  console.log(JSON.stringify({
    ok: false,
    message: 'No completed PDF/ZIP-like download found after timestamp before timeout.',
    dir,
    sinceMs,
    activeDownloads: active,
    latestCandidates: files.slice(0, 5)
  }, null, 2));
  process.exit(0);
})();
