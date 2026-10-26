// Ratchet for h3-studio#514 phase 2: hand-rolled UI patterns that have a shared replacement
// may only go down, per file. Run with --update after removing some to lower the baseline.
// - disabled={busy…}: page-wide busy that greys out everything; use per-action pending
//   (data/query.js mutations, the cloud controller's quiet operations)
// - <details>: hand-rolled floating panels; menus use ui/Menu, panels ui/Popover
//   (inline expand/collapse sections still count, so new ones are a deliberate choice)
// - <dialog / window.confirm / ChatDialog: use ui/Dialog
// - role="menuitem": use ui/Menu MenuItem
// - <button: use ui/Button, IconButton or Segmented (fields go inside ui/Field)
// - className "...overlay/backdrop...": hand-made modal layers; use ui/Dialog
// - page CSS rules that restyle buttons or fields (background, border, padding, size, colour):
//   the look belongs to ui/controls.css; pages only place controls
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const baselineFile = new URL('./ui-pattern-baseline.json', import.meta.url);
// The shared primitives in ui/ are where these patterns belong.
const owners = new Set(['QuickChatControls.jsx']);
const patterns = {
  busyDisables: /disabled=\{[^}]*\bbusy\b/g,
  details: /<details\b/g,
  rawDialog: /<dialog\b/g,
  confirm: /window\.confirm\(/g,
  chatDialog: /<ChatDialog\b/g,
  rawMenuItem: /role="menuitem"/g,
  rawButton: /<button\b/g,
  customOverlay: /className="[^"]*\b[\w-]*(?:overlay|backdrop)\b[^"]*"/g,
};
const controlSelector = /(^|[\s>,+~(])(button|input|select|textarea)\b|\.x\b|-btn\b|\.play\b/;
// max-height only limits growth (a composer) and accent-color is the shared checkbox/range
// accent, so neither counts as a page look.
const controlLook =
  /(background|border|padding|(?<!max-)height|border-radius|font-size|(?<![\w-])color)\s*:/;
const files = [];
const cssFiles = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name.endsWith('.jsx') && !name.endsWith('.test.jsx')) files.push(path);
    else if (name.endsWith('.css')) cssFiles.push(path);
  }
};
walk(root);
const counts = {};
for (const file of files) {
  const rel = relative(root, file).split(sep).join('/');
  if (owners.has(rel) || rel.startsWith('ui/')) continue;
  const text = readFileSync(file, 'utf8');
  for (const [name, re] of Object.entries(patterns)) {
    const n = (text.match(re) || []).length;
    if (n) (counts[name] ||= {})[rel] = n;
  }
}
for (const file of cssFiles) {
  const rel = relative(root, file).split(sep).join('/');
  if (rel.startsWith('ui/') || rel === 'skins.css') continue;
  const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  let n = 0;
  for (const [, selector, body] of text.matchAll(/([^{}@]+)\{([^{}]*)\}/g))
    if (controlSelector.test(selector.trim()) && controlLook.test(body)) n++;
  if (n) (counts.controlRestyle ||= {})[rel] = n;
}
const totals = Object.fromEntries(
  Object.entries(counts).map(([k, v]) => [k, Object.values(v).reduce((a, b) => a + b, 0)]),
);
if (process.argv.includes('--update')) {
  writeFileSync(baselineFile, JSON.stringify({ totals, files: counts }, null, 2) + '\n');
  console.log('UI pattern baseline set:', JSON.stringify(totals));
  process.exit(0);
}
const baseline = JSON.parse(readFileSync(baselineFile, 'utf8'));
const grown = [];
for (const [name, byFile] of Object.entries(counts))
  for (const [rel, n] of Object.entries(byFile)) {
    const was = baseline.files[name]?.[rel] || 0;
    if (n > was) grown.push(`${rel}: ${name} ${n} (was ${was})`);
  }
if (grown.length) {
  for (const line of grown)
    console.error(
      line + ' — use the shared ui/ component instead (see tools/check-ui-patterns.mjs).',
    );
  process.exit(1);
}
console.log('UI patterns:', JSON.stringify(totals));
