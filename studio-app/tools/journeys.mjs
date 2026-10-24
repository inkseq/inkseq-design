// User-journey checks (h3-studio#501) against a deployed site, normally staging.
// They walk the main paths the way a person does and fail on what a person would notice:
// a page that does not open, the wrong screen, missing content or an uncaught page error.
// Read-mostly with QA accounts only: no generation, pictures, purchases or deletions.
//
// Usage:
//   JOURNEY_BASE=https://staging.inkseq.com \
//   QA_ACCOUNTS_FILE=../../h3-studio/.local/staging-qa-accounts.json node tools/journeys.mjs
// or QA_USER / QA_USER_PASSWORD / QA_ADMIN / QA_ADMIN_PASSWORD in the environment (CI).
// Passwords are never printed.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = (process.env.JOURNEY_BASE || 'https://staging.inkseq.com').replace(/\/+$/, '');
if (/^https:\/\/(www\.)?inkseq\.com$/.test(BASE))
  throw Error('Journeys sign in with QA accounts; never point them at production.');

function accounts() {
  if (process.env.QA_ACCOUNTS_FILE) {
    const file = JSON.parse(readFileSync(process.env.QA_ACCOUNTS_FILE, 'utf8'));
    const find = (name) => file.accounts.find((a) => a.username === name);
    return { user: find('qa-user'), admin: find('qa-admin') };
  }
  const pair = (name, secret) =>
    process.env[name] && process.env[secret]
      ? { username: process.env[name], password: process.env[secret] }
      : null;
  return {
    user: pair('QA_USER', 'QA_USER_PASSWORD'),
    admin: pair('QA_ADMIN', 'QA_ADMIN_PASSWORD'),
  };
}

const { user: QA_USER, admin: QA_ADMIN } = accounts();
const browser = await chromium.launch();
const results = [];

// One sign-in per account for the whole run (sign-in is rate limited); later journeys
// reuse its cookies in a fresh context.
const sessions = new Map(),
  refused = new Map();
async function page(as) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 860 },
    storageState: as ? sessions.get(as.username) : undefined,
  });
  await context.addInitScript(() => localStorage.setItem('inkseq.ui.locale.v1', 'zh'));
  const p = await context.newPage();
  p.errors = [];
  p.on('pageerror', (error) => p.errors.push(error.message));
  await p.goto(BASE + '/');
  if (as && !sessions.has(as.username)) {
    // A refused sign-in is not retried by later journeys (that only extends a rate limit).
    if (refused.has(as.username)) {
      await context.close();
      throw Error(refused.get(as.username));
    }
    const status = await p.evaluate(
      async ([username, password]) =>
        (
          await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          })
        ).status,
      [as.username, as.password],
    );
    if (status !== 200) {
      refused.set(as.username, `sign-in as ${as.username} returned ${status}`);
      await context.close();
      throw Error(refused.get(as.username));
    }
    sessions.set(as.username, await context.storageState());
  }
  return p;
}

const api = (p, path) =>
  p.evaluate(async (url) => {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    return { status: r.status, body: r.ok ? await r.json() : null };
  }, path);

function expect(condition, message) {
  if (!condition) throw Error(message);
}

async function journey(name, needs, run) {
  if (process.env.JOURNEY_ONLY && !name.includes(process.env.JOURNEY_ONLY)) return;
  if (needs && !needs()) {
    results.push({ name, status: 'skip', detail: 'QA account not configured' });
    return;
  }
  const started = Date.now();
  let p;
  try {
    p = await run((as) => page(as).then((value) => (p = value)));
    expect(!p?.errors?.length, 'page error: ' + p?.errors?.[0]);
    results.push({ name, status: 'pass', detail: `${Date.now() - started} ms` });
  } catch (error) {
    results.push({ name, status: 'fail', detail: error.message.split('\n')[0] });
    // JOURNEY_SHOTS=<dir> keeps a screenshot of each failure for diagnosis.
    if (process.env.JOURNEY_SHOTS && p && !p.isClosed())
      await p
        .screenshot({ path: `${process.env.JOURNEY_SHOTS}/${name.replace(/\W+/g, '-')}.png` })
        .catch(() => {});
  } finally {
    if (p && !p.isClosed()) await p.context().close();
  }
}

const settle = (p, ms = 3000) => p.waitForTimeout(ms);

await journey('anonymous landing offers password sign-in', null, async (open) => {
  const p = await open(null);
  await settle(p);
  const link = p.getByRole('button', { name: '已有用户名账号？用密码登录' });
  if (await link.count()) {
    await link.click();
    await p.locator('input[autocomplete=username]').waitFor({ timeout: 5000 });
  } else {
    // Hosted sign-in off: the landing opens the username dialog from its main button.
    expect(await p.locator('.landing').count(), 'landing page did not render');
  }
  return p;
});

await journey(
  'Quick Create opens for a signed-in user',
  () => QA_USER,
  async (open) => {
    const p = await open(QA_USER);
    await p.goto(BASE + '/quick-chat');
    await p.waitForSelector('.sc-shell, .quick-shell', { timeout: 15000 });
    return p;
  },
);

await journey(
  'an old Quick Create link opens its story or explains (#477, #481)',
  () => QA_USER,
  async (open) => {
    const p = await open(QA_USER);
    const sessions = await api(p, '/v1/quick-chat/sessions?limit=5&view=active');
    const session = sessions.body?.sessions?.[0];
    expect(session, 'qa-user has no Quick Create conversation to reopen');
    await p.goto(BASE + '/quick-chat?session=' + encodeURIComponent(session.id));
    // Opening resolves through the server; under a fresh deploy that can take longer than a
    // fixed pause, so wait for either outcome instead of checking once.
    await p
      .waitForFunction(
        () =>
          new URL(location.href).searchParams.get('story') ||
          document.querySelector('.story-open-notice button'),
        null,
        { timeout: 20000 },
      )
      .catch(() => {});
    const url = new URL(p.url());
    // The original Quick Create was removed (2026-10-24): a converted conversation opens
    // its story (#481); anything else explains itself with a way on, never a blank page.
    if (url.searchParams.get('story')) return p;
    expect(!(await p.locator('.quick-shell').count()), 'the removed Quick Create still renders');
    expect(
      await p.locator('.story-open-notice button').count(),
      'old link showed neither its story nor the explanation with a way on',
    );
    return p;
  },
);

await journey(
  'Works lists stories with the standard account menu',
  () => QA_USER,
  async (open) => {
    const p = await open(QA_USER);
    await p.goto(BASE + '/?view=works');
    await p.waitForSelector('.story-grid', { timeout: 15000 });
    await p.locator('.hbar details.account-menu > summary').click();
    await settle(p, 800);
    const menu = (await p.locator('.hbar .account-menu-panel').innerText()).replace(/\s+/g, ' ');
    expect(!/ZIP/.test(menu), 'Works account menu still shows story actions: ' + menu);
    // Newest first: the browser-only sample can come first and has no multi-select.
    const card = p.locator('.story-wrap:has(.story-pick)').first();
    if (await card.count()) {
      await p.locator('.hbar details.account-menu > summary').click();
      await card.hover();
      await card.locator('.story-pick input').check();
      expect(await p.locator('.works-select-bar').count(), 'multi-select bar did not appear');
      await p.locator('.works-select-bar button.ghost').click();
    }
    return p;
  },
);

await journey(
  'Settings → Account shows the sign-in card',
  () => QA_USER,
  async (open) => {
    const p = await open(QA_USER);
    await p.goto(BASE + '/settings');
    await settle(p, 4000);
    const config = await api(p, '/api/auth/config');
    if (config.body?.hosted_sign_in?.enabled)
      expect(await p.locator('.account-link').count(), 'Google link card missing');
    return p;
  },
);

const SECTION_INDEX = { overview: 0, jobs: 1, limits: 2, users: 3, pricing: 4, log: 5 };
await journey(
  'Admin console sections load with data',
  () => QA_ADMIN,
  async (open) => {
    const p = await open(QA_ADMIN);
    // The old Settings → Admin link now lands on /admin (h3-studio#537).
    await p.goto(BASE + '/settings?tab=admin');
    await p.waitForURL(/\/admin\?section=limits/, { timeout: 15000 });
    await p.waitForSelector('.admin-home .cap-group', { timeout: 15000 });
    for (const [section, selector] of [
      ['overview', '.admin-home .ah-kpis'],
      ['users', '.admin-home .user-row:not(.head)'],
      ['pricing', '.admin-home .margin-table'],
      ['log', '.admin-home .audit-log > div'],
    ]) {
      await p.locator('.ah-nav button').nth(SECTION_INDEX[section]).click();
      await p.waitForSelector(selector, { timeout: 15000 }).catch(() => {
        throw Error(`admin section ${section}: ${selector} did not appear`);
      });
    }
    return p;
  },
);

await journey(
  'the header looks the same on every page',
  () => QA_USER,
  async (open) => {
    const p = await open(QA_USER);
    const seen = new Map();
    for (const path of ['/quick-chat', '/?view=works', '/library', '/settings']) {
      await p.goto(BASE + path);
      await p.waitForSelector('.hbar nav button', { timeout: 15000 });
      await settle(p, 1500);
      const box = await p.evaluate(() => {
        const tab = document.querySelector('.hbar nav button');
        const r = tab.getBoundingClientRect();
        return `${Math.round(r.top)}/${Math.round(r.height)}/${getComputedStyle(tab).fontSize}`;
      });
      seen.set(path, box);
    }
    expect(new Set(seen.values()).size === 1, 'header differs: ' + JSON.stringify([...seen]));
    return p;
  },
);

await browser.close();
const width = Math.max(...results.map((r) => r.name.length));
for (const r of results) console.log(`${r.status.padEnd(4)}  ${r.name.padEnd(width)}  ${r.detail}`);
const failed = results.filter((r) => r.status === 'fail').length;
console.log(
  `\n${results.length - failed} of ${results.length} journeys passed${failed ? '' : '.'}`,
);
if (failed) process.exit(1);
