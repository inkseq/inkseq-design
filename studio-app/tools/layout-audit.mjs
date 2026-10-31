// Layout audit (h3-studio#328): load the built studio at three viewports and fail on
// horizontal page scroll, elements pushed off-screen, text clipped without an ellipsis,
// button content spilling out of a fixed height,
// text under 10 px and uncaught page errors. Text from 10 to 11 px is a warning only.
// Usage: npm run build && npm run audit:layout [-- --base http://127.0.0.1:4173]
import { chromium } from 'playwright';
import { inspect, startPreview } from './layout-shared.mjs';

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
