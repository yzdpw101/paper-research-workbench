/**
 * set-browser.js — Read or set the default browser for paper-research-workbench
 *
 * Usage:
 *   node set-browser.js                # show current default
 *   node set-browser.js firefox        # set Firefox as default
 *   node set-browser.js chrome         # set Chrome as default
 *   node set-browser.js edge           # set Edge as default
 */

const fs = require('fs');
const path = require('path');
const { BROWSER_FILE, resolveBrowser } = require('./_browser');

const newBrowser = process.argv[2];

if (newBrowser) {
  if (!['firefox', 'chrome', 'edge'].includes(newBrowser)) {
    console.error('Usage: node set-browser.js [firefox|chrome|edge]');
    console.error('  Valid browsers: firefox, chrome, edge');
    process.exit(1);
  }
  const dir = path.dirname(BROWSER_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(BROWSER_FILE, newBrowser + '\n');
  console.log('Default browser set to: ' + newBrowser);
  console.log('  (' + BROWSER_FILE + ')');
} else {
  console.log('Current default: ' + resolveBrowser());
  console.log('Set with: node set-browser.js [firefox|chrome|edge]');
}
