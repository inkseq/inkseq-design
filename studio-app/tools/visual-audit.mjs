// Visual layout checks (h3-studio#897): open signed-in screens from a recorded API fixture
// (tools/visual/storyboard.har, no network, no login) and fail on geometry the owner
// should never have to spot by eye: overlapping marks, badges off one line, labels cut at
// a bar's end, fills spilling past rounded corners, plus the layout audit's generic checks.
// Usage: npm run build && npm run audit:visual [-- --base http://127.0.0.1:4173]
// Re-record the fixture: see tools/visual/README.md.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { inspect, startPreview } from './layout-shared.mjs';

const args = process.argv.slice(2);
const baseArg = args.indexOf('--base');
const HAR = fileURLToPath(new URL('./visual/storyboard.har', import.meta.url));
const PROJECT = 'project-1d39fa642bb64f3babc89de38cc621a2';
const VIEWPORTS = [
  ['desktop', 1440, 900],
  ['laptop', 1280, 760],
];

// Runs inside the page: each rule names elements by selector and returns problems.
function measure(rules) {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.height ? r : null;
  };
  const all = (sel) =>
    [...document.querySelectorAll(sel)]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width && r.height);
  const overlap = (a, b) =>
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  const out = [];
  for (const [kind, a, b, tol = 1] of rules) {
    const A = box(a),
      B = b && box(b);
    if (!A || (b && !B)) {
      out.push(`${kind}: ${!A ? a : b} not found`);
      continue;
    }
    const mid = (r) => (r.top + r.bottom) / 2;
    if (kind === 'no-overlap' && all(b).some((r) => overlap(A, r))) out.push(`${a} overlaps ${b}`);
    if (kind === 'same-midline' && Math.abs(mid(A) - mid(B)) > tol)
      out.push(`${a} and ${b} are ${Math.abs(mid(A) - mid(B)).toFixed(1)}px off one line`);
    if (
      kind === 'inside' &&
      (A.left < B.left - tol ||
        A.right > B.right + tol ||
        A.top < B.top - tol ||
        A.bottom > B.bottom + tol)
    )
      out.push(`${a} sticks out of ${b}`);
    if (kind === 'starts-above' && A.top > B.top - tol)
      out.push(`${a} starts ${(A.top - B.top + tol).toFixed(1)}px too low: its grip covers ${b}`);
    if (kind === 'above' && A.bottom > B.top + tol)
      out.push(`${a} reaches ${(A.bottom - B.top).toFixed(1)}px into ${b}`);
    if (kind === 'left-of' && A.right > B.left + tol)
      out.push(`${a} reaches ${(A.right - B.left).toFixed(1)}px into ${b}`);
    if (kind === 'clips-like') {
      const sa = getComputedStyle(document.querySelector(a)),
        sb = getComputedStyle(document.querySelector(b));
      if (sa.overflow !== 'hidden' || sa.borderRadius !== sb.borderRadius)
        out.push(`${a} does not clip to ${b}'s rounded shape`);
    }
  }
  return out;
}

// Screens, each reached from the one before, with the geometry they must keep.
const SCREENS = [
  {
    name: 'storyboard dock, playhead at 0:00',
    async open(page, base) {
      await page.goto(`${base}/?view=workspace&project=${PROJECT}`, { waitUntil: 'load' });
      await page.locator('.timeline .track.video .playhead').waitFor();
    },
    rules: [
      // The grip lives above the pictures; the line at 0:00 sits in the gutter.
      ['starts-above', '.timeline .playhead', '.timeline .track.video', 12],
      ['left-of', '.timeline .playhead', '.timeline .tseg'],
      ['no-overlap', '.timeline .playhead', '.ruler span'],
      ['inside', '.ruler span:last-of-type', '.ruler'],
      ['above', '.timeline .track.video', '.ruler'],
    ],
  },
  {
    name: 'storyboard dock, playhead mid-film',
    async open(page) {
      const ruler = await page.locator('.ruler').boundingBox();
      await page.mouse.click(ruler.x + ruler.width / 2, ruler.y + ruler.height / 2);
    },
    rules: [
      ['no-overlap', '.timeline .playhead', '.ruler span'],
      ['inside', '.timeline .playhead', '.timeline'],
    ],
  },
  {
    name: 'shot panel: takes and trim bar',
    async open(page) {
      await page.locator('.card').first().click();
      await page.locator('.versions .ver.chosen').waitFor();
      await page.mouse.move(1, 1);
    },
    rules: [
      ['same-midline', '.ver.chosen em.chosen-dot', '.ver.chosen .take-q'],
      ['no-overlap', '.ver.chosen em.chosen-dot', '.ver.chosen .take-q'],
      ['inside', '.ver.chosen .take-q', '.ver.chosen'],
      ['inside', '.ver.chosen em.chosen-dot', '.ver.chosen'],
      ['clips-like', '.trim-bar-fill', '.trim-bar-track'],
      ['inside', '.trim-bar-fill', '.trim-bar-track'],
    ],
  },
  {
    name: 'enhance dialog',
    async open(page) {
      await page
        .locator('button', { hasText: /提升清晰度/ })
        .first()
        .click();
      await page.locator('dialog[open]').waitFor();
    },
    rules: [['inside', 'dialog[open]', 'body']],
  },
];

const preview = baseArg >= 0 ? { base: args[baseArg + 1], stop() {} } : await startPreview();
const browser = await chromium.launch();
let failures = 0;
try {
  for (const [label, width, height] of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width, height }, locale: 'zh-CN' });
    // Signed-in screens come from the fixture; anything else (media, other hosts) is refused.
    await context.route(
      (url) => !url.href.startsWith(preview.base),
      (route) => route.abort(),
    );
    await context.routeFromHAR(HAR, { url: /\/(v1|api)\//, notFound: 'abort' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const screen of SCREENS) {
      const tag = `${label} ${width}x${height} ${screen.name}`;
      let problems;
      try {
        await screen.open(page, preview.base);
        await page.waitForTimeout(600);
        const found = await page.evaluate(inspect);
        problems = [
          ...(await page.evaluate(measure, screen.rules)),
          ...(found.scrollX > 1 ? [`page scrolls sideways by ${found.scrollX}px`] : []),
          ...found.offscreen.map((x) => `off-screen: ${x}`),
          ...found.clipped.map((x) => `clipped without ellipsis: ${x}`),
          ...found.spill.map((x) => `content spills out of button: ${x}`),
          ...found.tiny.map((x) => `text under 10px: ${x}`),
          ...errors.splice(0).map((x) => `page error: ${x}`),
        ];
      } catch (error) {
        problems = [`could not open: ${error.message.split('\n')[0]}`];
      }
      if (problems.length) {
        failures += problems.length;
        console.log(`FAIL ${tag}`);
        for (const p of problems.slice(0, 15)) console.log(`  ${p}`);
        await page.screenshot({ path: `visual-fail-${label}-${SCREENS.indexOf(screen)}.png` });
      } else console.log(`ok   ${tag}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
  preview.stop();
}
if (failures) {
  console.log(`\n${failures} visual layout problem(s); screenshots: visual-fail-*.png`);
  process.exit(1);
}
