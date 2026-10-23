// Layout audit (h3-studio#328): load the built studio at three viewports and fail on
// horizontal page scroll, elements pushed off-screen, text clipped without an ellipsis,
// button content spilling out of a fixed height,
// text under 10 px and uncaught page errors. Text from 10 to 11 px is a warning only.
// Usage: npm run build && npm run audit:layout [-- --base http://127.0.0.1:4173]
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const baseArg = args.indexOf('--base');
const ROUTES = [
  '/',
  '/quick-chat',
  '/library',
  '/settings',
  '/trash',
  '/pricing',
  '/terms',
  '/privacy',
  '/content',
];
const VIEWPORTS = [
  ['desktop', 1366, 860],
  ['laptop', 1024, 640],
  ['tablet', 820, 1180],
  ['phone', 375, 812],
];

async function startPreview() {
  const port = 4173;
  const vite = new URL('../node_modules/vite/bin/vite.js', import.meta.url);
  const child = spawn(
    process.execPath,
    [fileURLToPath(vite), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { stdio: ['ignore', 'pipe', 'ignore'] },
  );
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite preview did not start')), 30000);
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes(String(port))) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on('exit', (code) => reject(new Error(`vite preview exited ${code}`)));
  });
  return { base: `http://127.0.0.1:${port}`, stop: () => child.kill() };
}

// Runs inside the page. Only visible elements count; scroll containers may clip on purpose.
function inspect() {
  const out = { scrollX: 0, offscreen: [], clipped: [], spill: [], tiny: [], small: [] };
  const doc = document.documentElement;
  out.scrollX = doc.scrollWidth - doc.clientWidth;
  const vw = doc.clientWidth;
  const label = (el) => {
    const text = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
    const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} "${text.slice(0, 40)}"`;
  };
  const insideScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowX) || /(auto|scroll)/.test(s.overflow)) return true;
    }
    return false;
  };
  for (const el of document.body.querySelectorAll('*')) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0)
      continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    // Skip links sit off-screen until focused; sr-only text is meant to be invisible.
    if (el.closest('[aria-hidden="true"], .sr-only, .visually-hidden, a.skip')) continue;
    if (
      (rect.right > vw + 1 || rect.left < -1) &&
      !insideScroller(el) &&
      style.position !== 'fixed'
    )
      out.offscreen.push(label(el));
    // A fixed-height button whose content spills out (text over the next row).
    if (
      el.tagName === 'BUTTON' &&
      style.overflowY === 'visible' &&
      el.scrollHeight > el.clientHeight + 4
    )
      out.spill.push(label(el));
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!ownText) continue;
    // font-size: 0 is the deliberate icon-only pattern (the label stays for screen readers).
    const size = parseFloat(style.fontSize);
    if (size === 0) continue;
    if (size < 10) out.tiny.push(`${label(el)} ${size}px`);
    else if (size < 11) out.small.push(`${label(el)} ${size}px`);
    const clipsX = el.scrollWidth > el.clientWidth + 1 && style.overflowX !== 'visible';
    if (clipsX && style.textOverflow !== 'ellipsis' && !/(auto|scroll)/.test(style.overflowX))
      out.clipped.push(label(el));
  }
  for (const key of ['offscreen', 'clipped', 'spill', 'tiny', 'small'])
    out[key] = [...new Set(out[key])];
  return out;
}

const preview = baseArg >= 0 ? { base: args[baseArg + 1], stop() {} } : await startPreview();
const browser = await chromium.launch();
let failures = 0;
// The four viewports run side by side (each in its own context); their reports print in
// the original order, so the log reads exactly as before while CI waits ~4x less.
async function audit([name, width, height]) {
  const lines = [];
  let count = 0;
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: width < 768,
    hasTouch: width < 768,
  });
  for (const route of ROUTES) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(preview.base + route, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const found = await page.evaluate(inspect);
    const problems = [
      ...(found.scrollX > 1 ? [`page scrolls sideways by ${found.scrollX}px`] : []),
      ...found.offscreen.map((x) => `off-screen: ${x}`),
      ...found.clipped.map((x) => `clipped without ellipsis: ${x}`),
      ...found.spill.map((x) => `content spills out of button: ${x}`),
      ...found.tiny.map((x) => `text under 10px: ${x}`),
      ...errors.map((x) => `page error: ${x}`),
    ];
    const tag = `${name} ${width}x${height} ${route}`;
    if (problems.length) {
      count += problems.length;
      lines.push(`FAIL ${tag}`);
      for (const p of problems.slice(0, 15)) lines.push(`  ${p}`);
      if (problems.length > 15) lines.push(`  … ${problems.length - 15} more`);
    } else lines.push(`ok   ${tag}`);
    for (const w of found.small.slice(0, 5)) lines.push(`  warn 10–11px: ${w}`);
    await page.close();
  }
  await context.close();
  return { lines, count };
}
try {
  for (const { lines, count } of await Promise.all(VIEWPORTS.map(audit))) {
    for (const line of lines) console.log(line);
    failures += count;
  }
} finally {
  await browser.close();
  preview.stop();
}
if (failures) {
  console.log(`\n${failures} layout problem(s).`);
  process.exit(1);
}
