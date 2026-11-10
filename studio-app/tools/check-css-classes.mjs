// Every class a stylesheet names must appear somewhere in the app's source, so CSS for removed
// markup is deleted with it instead of piling up. tools/css-class-use.mjs holds the rules.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classUse, sheetClasses } from './css-class-use.mjs';

const app = fileURLToPath(new URL('..', import.meta.url));
const src = join(app, 'src');
const code = [],
  css = [];
const walk = (dir) => {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(jsx?|mjs)$/.test(name) && !name.includes('.test.')) code.push(path);
    else if (name.endsWith('.css')) css.push(path);
  }
};
walk(src);
const shown = (path) => relative(src, path).split(sep).join('/');
const use = classUse();
use.markup(readFileSync(join(app, 'index.html'), 'utf8'));
for (const path of code) {
  try {
    use.script(readFileSync(path, 'utf8'));
  } catch (error) {
    // an unread file would make its classes look unused
    console.error(`${shown(path)}: cannot read its strings (${error.message}).`);
    process.exit(1);
  }
}
const unused = [];
for (const file of css)
  for (const name of sheetClasses(readFileSync(file, 'utf8')))
    if (!use.renders(name)) unused.push(`${shown(file)}: .${name}`);
if (unused.length) {
  for (const line of unused)
    console.error(line + ' — no source renders this class; delete its rules or the class name.');
  process.exit(1);
}
console.log('CSS classes: all used.');
