// Ratchet for the broader lint rules (eslint.ratchet.config.js): findings per file and rule may
// only go down. Run with --update after fixing some to lower the recorded baseline.
import { readFileSync, writeFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { ESLint } from 'eslint';

const app = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const baselineFile = new URL('./lint-baseline.json', import.meta.url);
const eslint = new ESLint({ cwd: app, overrideConfigFile: 'eslint.ratchet.config.js' });
const results = await eslint.lintFiles(['src/**/*.{js,jsx}']);
const counts = {};
for (const result of results) {
  const file = relative(app, result.filePath).split(sep).join('/');
  for (const message of result.messages) {
    const rule = message.ruleId || 'parse';
    (counts[rule] ||= {})[file] ||= 0;
    counts[rule][file]++;
  }
}
const totals = Object.fromEntries(
  Object.entries(counts)
    .map(([rule, files]) => [rule, Object.values(files).reduce((a, b) => a + b, 0)])
    .sort((a, b) => b[1] - a[1]),
);
if (process.argv.includes('--update')) {
  writeFileSync(baselineFile, JSON.stringify({ totals, files: counts }, null, 2) + '\n');
  console.log('Lint baseline set:', JSON.stringify(totals));
  process.exit(0);
}
const baseline = JSON.parse(readFileSync(baselineFile, 'utf8'));
const grown = [];
for (const [rule, files] of Object.entries(counts))
  for (const [file, n] of Object.entries(files)) {
    const was = baseline.files[rule]?.[file] || 0;
    if (n > was) grown.push(`${file}: ${rule} ${n} (was ${was})`);
  }
if (grown.length) {
  for (const line of grown) console.error(line);
  console.error('New lint findings; fix them (npx eslint -c eslint.ratchet.config.js <file>).');
  process.exit(1);
}
console.log('Lint findings:', JSON.stringify(totals));
