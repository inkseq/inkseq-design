// Ratchet for h3-studio#514: raw hex colours outside the token/skin files may only go down,
// and pages may not restyle the shared button variants (ui/controls.css owns them).
// Run with --update after removing some to lower the recorded baseline.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const baselineFile = new URL('./token-baseline.json', import.meta.url);
const allowed = new Set(['ui/tokens.css', 'skins.css']);
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name.endsWith('.css')) files.push(path);
  }
};
walk(root);
const counts = {};
const buttonRules = [];
for (const file of files) {
  const rel = relative(root, file).split(sep).join('/');
  if (allowed.has(rel)) continue;
  const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const n = (text.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
  if (n) counts[rel] = n;
  if (rel.startsWith('ui/') || rel === 'style.css') continue;
  // A selector that is only `button` plus shared variant classes or states, e.g. `button.primary:hover`.
  const shared =
    /^button((\.(primary|ghost|danger|small|round))|:(hover|active|disabled|focus-visible))*$/;
  for (const [, prelude] of text.matchAll(/([^{}]+)\{/g))
    for (const selector of prelude.split(',').map((x) => x.trim()))
      if (shared.test(selector)) buttonRules.push(`${rel}: ${selector}`);
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);
if (process.argv.includes('--update')) {
  writeFileSync(baselineFile, JSON.stringify({ total, files: counts }, null, 2) + '\n');
  console.log(`Token baseline set to ${total} raw colours.`);
  process.exit(0);
}
if (buttonRules.length) {
  for (const r of buttonRules)
    console.error(`${r} restyles a shared button. Use <Button variant/size> and ui/controls.css.`);
  process.exit(1);
}
const baseline = JSON.parse(readFileSync(baselineFile, 'utf8'));
const grown = Object.entries(counts).filter(([f, n]) => n > (baseline.files[f] || 0));
if (grown.length) {
  for (const [f, n] of grown)
    console.error(
      `${f}: ${n} raw colours (was ${baseline.files[f] || 0}). Use var(--token) from src/ui/tokens.css.`,
    );
  process.exit(1);
}
console.log(`Raw colours: ${total} (baseline ${baseline.total}).`);
