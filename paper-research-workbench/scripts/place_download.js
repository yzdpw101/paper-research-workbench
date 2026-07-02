/**
 * Copy or move a downloaded file to a final target directory or file path.
 * No external dependencies.
 * Usage:
 *   node place_download.js <source-file> <final-dir-or-file> [--move|--copy]
 */
const fs = require('fs');
const path = require('path');

const source = process.argv[2];
const targetArg = process.argv[3];
const shouldMove = process.argv.includes('--move');
const shouldCopy = process.argv.includes('--copy') || !shouldMove;

if (!source || !targetArg) {
  console.error('Usage: node place_download.js <source-file> <final-dir-or-file> [--move|--copy]');
  process.exit(1);
}

if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
  console.error(JSON.stringify({ ok: false, message: 'Source file not found', source }, null, 2));
  process.exit(2);
}

let target = targetArg;
if (fs.existsSync(targetArg) && fs.statSync(targetArg).isDirectory()) {
  target = path.join(targetArg, path.basename(source));
} else if (!path.extname(targetArg)) {
  fs.mkdirSync(targetArg, { recursive: true });
  target = path.join(targetArg, path.basename(source));
} else {
  fs.mkdirSync(path.dirname(targetArg), { recursive: true });
}

function uniquePath(p) {
  if (!fs.existsSync(p)) return p;
  const dir = path.dirname(p);
  const ext = path.extname(p);
  const base = path.basename(p, ext);
  for (let i = 2; i < 1000; i++) {
    const q = path.join(dir, `${base} (${i})${ext}`);
    if (!fs.existsSync(q)) return q;
  }
  throw new Error('Too many duplicate filenames');
}

const finalPath = uniquePath(target);
if (shouldMove) {
  fs.renameSync(source, finalPath);
} else if (shouldCopy) {
  fs.copyFileSync(source, finalPath);
}

const st = fs.statSync(finalPath);
console.log(JSON.stringify({
  ok: true,
  action: shouldMove ? 'move' : 'copy',
  source,
  finalPath,
  size: st.size
}, null, 2));
