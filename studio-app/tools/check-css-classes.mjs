// Every class a stylesheet names must appear somewhere in the app's source, so CSS for removed
// markup is deleted with it instead of piling up. A class built at run time counts when a
// string fragment it starts with is concatenated ('tile-' + kind, 'c' + n, `p4-${x}`).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const app = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const src = join(app, 'src');
const code = [join(app, 'index.html')],
  css = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(jsx?|mjs)$/.test(name) && !name.includes('.test.')) code.push(path);
    else if (name.endsWith('.css')) css.push(path);
  }
};
walk(src);
const text = code.map((path) => readFileSync(path, 'utf8')).join('\n');
// Only text inside string and template literals (and HTML) can become a class name.
const literals = [...text.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)]
  .map((m) => m[0])
  .join('\n');
const words = new Set(literals.match(/[A-Za-z_][\w-]*/g));
const prefixes = [
  ...[...text.matchAll(/([A-Za-z][\w-]*)['"`]\s*\+/g)].map((m) => m[1]),
  ...[...text.matchAll(/([A-Za-z][\w-]*)\$\{/g)].map((m) => m[1]),
];
// A short fragment ('c' + n) only builds numbered classes (c20, t1).
const used = (name) =>
  words.has(name) ||
  prefixes.some(
    (prefix) =>
      name.startsWith(prefix) && (prefix.length >= 3 || /^\d+$/.test(name.slice(prefix.length))),
  );
const unused = [];
for (const file of css) {
  const sheet = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/url\([^)]*\)/g, '')
    // declarations hold numbers like 0.5em, not classes
    .replace(/:[^;{}]*;/g, ';');
  const names = new Set([...sheet.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]));
  for (const name of names)
    if (!used(name)) unused.push(`${relative(src, file).split(sep).join('/')}: .${name}`);
}
if (unused.length) {
  for (const line of unused)
    console.error(line + ' — no source renders this class; delete its rules or the class name.');
  process.exit(1);
}
console.log('CSS classes: all used.');
