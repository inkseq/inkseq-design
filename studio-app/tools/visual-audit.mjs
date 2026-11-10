// Visual layout checks (h3-studio#897): open signed-in screens from recorded API fixtures
// (tools/visual/*.har, no network, no login) and fail on geometry the owner should never have
// to spot by eye: overlapping marks, badges off one line, labels cut at a bar's end, fills
// spilling past rounded corners, plus the layout audit's generic checks.
// Two suites:
//   storyboard  the dock, takes, trim bar and enhance dialog (storyboard.har);
//   story       every story step: Script, World, Storyboard, Library and Edit, at three window
//               sizes in light and dark (story.har; screens in tools/visual/story-screens.mjs,
//               page rules in tools/visual/page-rules.mjs).
// Usage: npm run build && npm run audit:visual [-- --only story] [-- --shots <dir>]
//        [-- --pick "desktop light"]
//        [-- --base http://127.0.0.1:4173]; AUDIT_PORT=4291 serves the build on another port.
// Re-record a fixture: see tools/visual/README.md.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { inspect, startPreview } from './layout-shared.mjs';
import { mediaBoxes, pageRules } from './visual/page-rules.mjs';
import { STORY_SCREENS } from './visual/story-screens.mjs';

const args = process.argv.slice(2);
const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const only = arg('--only');
const shots = arg('--shots');
// --pick "phone light" runs only the story-suite windows whose label contains each word.
const pick = (arg('--pick') || '').split(/\s+/).filter(Boolean);
const HAR = fileURLToPath(new URL('./visual/storyboard.har', import.meta.url));
const STORY_HAR = fileURLToPath(new URL('./visual/story.har', import.meta.url));
const PROJECT = 'project-1d39fa642bb64f3babc89de38cc621a2';
const VIEWPORTS = [
  ['desktop', 1440, 900],
  ['laptop', 1280, 760],
];
const STORY_VIEWPORTS = [
  ['desktop', 1440, 900],
  ['wide', 1920, 1080],
  ['phone', 390, 844],
];
const THEMES = ['light', 'dark'];
const RECORDED = 'http://127.0.0.1:4173';

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
      // The card's title opens the shot (its description box would only take focus).
      await page.locator('.card .card-title').first().click();
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

// Fixtures are recorded on 127.0.0.1:4173; served elsewhere, the same answers move with it.
function fixture(file, base) {
  if (base === RECORDED) return file;
  const moved = join(tmpdir(), `visual-${process.pid}-${file.split(/[\\/]/).pop()}`);
  writeFileSync(moved, readFileSync(file, 'utf8').split(RECORDED).join(base));
  return moved;
}
const generic = (found) => [
  ...(found.scrollX > 1 ? [`page scrolls sideways by ${found.scrollX}px`] : []),
  ...found.offscreen.map((x) => `off-screen: ${x}`),
  ...found.clipped.map((x) => `clipped without ellipsis: ${x}`),
  ...found.spill.map((x) => `content spills out of button: ${x}`),
  ...found.tiny.map((x) => `text under 10px: ${x}`),
];
const slug = (text) =>
  text
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

// Pictures are held until the screen has drawn, then half load (a wide stand-in picture) and
// half fail. Cards and picture boxes must not move either way (layout-stability rule).
const PICTURE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="16"><rect width="64" height="16" fill="#888"/></svg>';
async function mediaGate(context) {
  const gate = { holding: true, pending: [] };
  const answer = (route) => {
    // The same picture always has the same outcome, independent of request scheduling.
    const path = new URL(route.request().url()).pathname;
    const odd = [...path].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2;
    return odd
      ? route.abort()
      : route.fulfill({ status: 200, contentType: 'image/svg+xml', body: PICTURE });
  };
  await context.route(/\/v1\/(assets|artifacts|voices)\/.+\/(content|sample)/, (route) =>
    gate.holding ? gate.pending.push(route) : answer(route),
  );
  gate.release = async () => {
    gate.holding = false;
    await Promise.all(gate.pending.splice(0).map((route) => answer(route).catch(() => {})));
  };
  return gate;
}

async function storySuite(browser, base) {
  const har = fixture(STORY_HAR, base);
  const runs = STORY_VIEWPORTS.flatMap((v) => THEMES.map((theme) => [...v, theme])).filter((run) =>
    pick.every((word) => run.join(' ').includes(word)),
  );
  const results = await Promise.all(
    runs.map(async ([label, width, height, theme]) => {
      const lines = [];
      const missing = new Set();
      let count = 0;
      const context = await browser.newContext({
        viewport: { width, height },
        isMobile: width < 768,
        hasTouch: width < 768,
        locale: 'zh-CN',
        colorScheme: theme,
      });
      await context.route(
        (url) => !url.href.startsWith(base),
        (route) => route.abort(),
      );
      await context.routeFromHAR(har, { url: /\/(v1|api)\//, notFound: 'abort' });
      const gate = await mediaGate(context);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('requestfailed', (request) => {
        const url = new URL(request.url());
        if (/^\/(v1|api)\//.test(url.pathname) && !/\/(content|sample)$/.test(url.pathname))
          missing.add(`${request.method()} ${url.pathname}`);
      });
      for (const [index, screen] of STORY_SCREENS.entries()) {
        const tag = `${label} ${width}x${height} ${theme} ${screen.name}`;
        let problems;
        try {
          gate.holding = true;
          await screen.open(page, base);
          await page.locator(screen.ready).first().waitFor({ timeout: 15000 });
          await page.waitForTimeout(500);
          await page.evaluate(() => document.fonts.ready);
          const media = screen.rules.media;
          const before = media ? await page.evaluate(mediaBoxes, media) : [];
          await gate.release();
          await page.waitForFunction(() =>
            [...document.images]
              .filter((image) => image.currentSrc)
              .every((image) => image.complete),
          );
          await page.evaluate(
            () =>
              new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          );
          const after = media ? await page.evaluate(mediaBoxes, media) : [];
          const moved = [];
          if (before.length !== after.length)
            moved.push(
              `${before.length} picture boxes before pictures arrived, ${after.length} after`,
            );
          else
            before.forEach((a, i) => {
              const b = after[i];
              if (['x', 'y', 'w', 'h'].some((k) => Math.abs(a[k] - b[k]) > 1))
                moved.push(
                  `moved when pictures loaded or failed: ${a.key} ` +
                    `${[a.x, a.y, a.w, a.h].map(Math.round).join(',')} -> ` +
                    `${[b.x, b.y, b.w, b.h].map(Math.round).join(',')}`,
                );
            });
          const found = await page.evaluate(inspect);
          problems = [
            ...(await page.evaluate(pageRules, screen.rules)),
            ...moved.slice(0, 5),
            ...generic(found),
            ...errors.splice(0).map((x) => `page error: ${x}`),
          ];
        } catch (error) {
          problems = [`could not open: ${error.message.split('\n')[0]}`];
        }
        const name = `${label}-${theme}-${String(index).padStart(2, '0')}-${slug(screen.name)}.png`;
        if (shots) await page.screenshot({ path: join(shots, name) });
        if (problems.length) {
          count += problems.length;
          lines.push(`FAIL ${tag}`);
          for (const p of problems.slice(0, 60)) lines.push(`  ${p}`);
          if (problems.length > 60) lines.push(`  … ${problems.length - 60} more`);
          if (!shots) await page.screenshot({ path: `visual-fail-story-${name}` });
        } else lines.push(`ok   ${tag}`);
        if (screen.after) await screen.after(page).catch(() => {});
      }
      for (const m of missing) lines.push(`  note: no fixture answer for ${m}`);
      await context.close();
      return { lines, count };
    }),
  );
  let failures = 0;
  for (const { lines, count } of results) {
    for (const line of lines) console.log(line);
    failures += count;
  }
  return failures;
}

const preview = arg('--base') ? { base: arg('--base'), stop() {} } : await startPreview();
if (shots) mkdirSync(shots, { recursive: true });
const browser = await chromium.launch();
let failures = 0;
try {
  if (only !== 'story') failures += await storyboardSuite(browser, preview.base);
  if (only !== 'storyboard') failures += await storySuite(browser, preview.base);
} finally {
  await browser.close();
  preview.stop();
}
if (failures) {
  console.log(`\n${failures} visual layout problem(s); screenshots: visual-fail-*.png`);
  process.exit(1);
}

async function storyboardSuite(browser, base) {
  const har = fixture(HAR, base);
  let failures = 0;
  for (const [label, width, height] of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width, height }, locale: 'zh-CN' });
    // Signed-in screens come from the fixture; anything else (media, other hosts) is refused.
    await context.route(
      (url) => !url.href.startsWith(base),
      (route) => route.abort(),
    );
    await context.routeFromHAR(har, { url: /\/(v1|api)\//, notFound: 'abort' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const screen of SCREENS) {
      const tag = `${label} ${width}x${height} ${screen.name}`;
      let problems;
      try {
        await screen.open(page, base);
        await page.waitForTimeout(600);
        const found = await page.evaluate(inspect);
        problems = [
          ...(await page.evaluate(measure, screen.rules)),
          ...generic(found),
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
  return failures;
}
