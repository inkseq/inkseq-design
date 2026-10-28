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
    // QA accounts accept the current reviewed Terms once, as a person would in the dialog
    // (h3-studio#374); otherwise paid previews refuse with terms_acceptance_required.
    await p.evaluate(async () => {
      const account = await (await fetch('/v1/account')).json().catch(() => null);
      const terms = account?.terms;
      if (terms?.status === 'reviewed' && terms.acceptance_required)
        await fetch('/v1/account/terms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: terms.version }),
        });
    });
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
    // Hosted sign-in off: the landing opens the username dialog from its main button. Wait for
    // it rather than counting after the fixed settle: the US runner reaches staging slowly.
    const shown = await p
      .locator('.landing')
      .waitFor({ timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    expect(shown, 'landing page did not render');
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
    await p.locator('.hbar .account-menu-trigger').click();
    await settle(p, 800);
    const menu = (await p.locator('.account-menu-panel').innerText()).replace(/\s+/g, ' ');
    expect(!/ZIP/.test(menu), 'Works account menu still shows story actions: ' + menu);
    // Newest first: the browser-only sample can come first and has no multi-select.
    const card = p.locator('.story-wrap:has(.story-pick)').first();
    if (await card.count()) {
      await p.locator('.hbar .account-menu-trigger').click();
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
    await p.waitForSelector('.admin-home .cap .ui-setting-row', { timeout: 15000 });
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

// ---- Acceptance checks that used to be manual (h3-studio#665) ----

// JSON request in the page (cookies of the signed-in QA account).
const send = (p, method, path, body, key) =>
  p.evaluate(
    async ([method, path, body, key]) => {
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (key) headers['Idempotency-Key'] = crypto.randomUUID();
      const r = await fetch(path, { method, headers, body: JSON.stringify(body) });
      return { status: r.status, body: await r.json().catch(() => null) };
    },
    [method, path, body, key],
  );

// A qa-user story with a shot that already has a take (for settings, preflight and reviews).
async function qaShot(p) {
  const list = await api(p, '/v1/projects?limit=40');
  for (const row of list.body?.projects || list.body?.items || []) {
    const id = row.id || row.project_id;
    const doc = await api(p, '/v1/projects/' + encodeURIComponent(id));
    const project = doc.body?.payload || doc.body?.project || doc.body;
    for (const shot of (project?.entities || []).filter((e) => e.type === 'shot')) {
      if (!shot.data?.selectedAssetId) continue;
      const reviews = await api(p, `/v1/projects/${id}/shots/${shot.id}/take-reviews`);
      if (Array.isArray(reviews.body) && reviews.body.length) return { project: id, shot: shot.id };
    }
  }
  throw Error('qa-user has no story with a generated take to check against');
}
const shotControls = async (p, where) => {
  const doc = await api(p, '/v1/projects/' + encodeURIComponent(where.project));
  const project = doc.body?.payload || doc.body?.project || doc.body;
  return {
    version: doc.body?.version,
    controls: project.entities.find((e) => e.id === where.shot)?.data?.h3?.controls || {},
  };
};
async function openShot(p, where) {
  await p.goto(BASE + '/?view=workspace&project=' + encodeURIComponent(where.project));
  const card = p.locator(`[data-shot-card="${where.shot}"]`);
  await card.waitFor({ timeout: 60000 });
  await card.click();
  await p.locator('.ed-footer').waitFor({ timeout: 20000 });
  await settle(p, 1500);
}
const saved = async (p) => {
  await settle(p, 500);
  await p.getByText('已保存').first().waitFor({ timeout: 60000 });
  await settle(p, 800);
};

await journey('home page: one flow, loop from Video to Fix, coral look', null, async (open) => {
  const p = await open(null);
  await p.locator('.lp-flow').waitFor({ timeout: 30000 });
  const home = await p.evaluate(() => {
    const nodes = [...document.querySelectorAll('.lp-node')].map((n) => n.getBoundingClientRect());
    const loop = document.querySelector('.lp-loop-line')?.getBoundingClientRect();
    const centre = (r) => r.left + r.width / 2;
    return {
      skin: document.documentElement.dataset.skin,
      nodes: nodes.length,
      beforeAfter: document.querySelectorAll('.lp-ba').length,
      loopStart: loop && Math.abs(loop.left - centre(nodes[3])),
      loopEnd: loop && Math.abs(loop.right - centre(nodes[5])),
      chips: [...document.querySelectorAll('.lp-agents li')].map((n) => n.textContent),
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  expect(/^coral/.test(home.skin), 'home page is not on the coral look: ' + home.skin);
  expect(home.nodes === 7 && home.beforeAfter === 0, 'home page sections changed');
  expect(home.loopStart < 12 && home.loopEnd < 12, 'review loop no longer spans 04 to 06');
  expect(!home.chips.includes('Codex'), 'assistant list names Codex again');
  expect(home.overflow <= 0, 'home page scrolls sideways');
  return p;
});

await journey('an old stored light/dark choice moves to coral', null, async () => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('journey-seeded')) {
      localStorage.setItem('inkseq.skin', 'default');
      localStorage.removeItem('inkseq.skin.coral-v1');
      sessionStorage.setItem('journey-seeded', '1');
    }
  });
  const p = await context.newPage();
  p.errors = [];
  p.on('pageerror', (error) => p.errors.push(error.message));
  await p.goto(BASE + '/');
  await p.locator('.landing').waitFor({ timeout: 30000 });
  const skin = await p.evaluate(() => document.documentElement.dataset.skin);
  expect(skin === 'coral-dark', 'old dark choice was not moved to coral-dark: ' + skin);
  return p;
});

await journey(
  'shot editor: creator settings save, preflight and restore',
  () => QA_USER,
  async (open) => {
    const p = await open(QA_USER);
    const where = await qaShot(p);
    await openShot(p, where);
    const footer = await p.evaluate(() => ({
      raw: document.querySelectorAll('.workbench-defaults').length,
      tips: document.querySelectorAll('.ed-footer .help-tip').length,
      text: document.querySelector('.ed-footer')?.innerText || '',
    }));
    expect(footer.raw === 0, 'model parameter panel is back in the shot editor');
    expect(footer.tips >= 3, 'help tips missing in the shot editor footer');
    for (const word of ['横屏', '竖屏', '方形', '保留声音', '换一版'])
      expect(footer.text.includes(word), 'shot editor footer lost: ' + word);
    const before = await shotControls(p, where);
    const aspect = p.locator('.ed-footer .seg').nth(1);
    const keep = p.locator('.ed-footer label.check', { hasText: '保留声音' }).locator('input');
    try {
      await aspect.getByRole('button', { name: '竖屏' }).click();
      await saved(p);
      if (await keep.isChecked()) {
        await keep.uncheck();
        await saved(p);
      }
      const after = await shotControls(p, where);
      expect(
        after.controls.aspect_ratio === '9:16' && after.controls.generate_audio === false,
        'portrait / silent did not save: ' + JSON.stringify(after.controls),
      );
      const plan = await send(
        p,
        'POST',
        `/v1/projects/${where.project}/shots/${where.shot}/generation-plans`,
        { expected_version: after.version },
      );
      const effective = plan.body?.effective_request || {};
      expect(plan.status === 201, 'shot preflight failed: ' + plan.status);
      expect(
        effective.aspect_ratio === '9:16' && effective.generate_audio === false,
        'preflight ignored the creator choices: ' + JSON.stringify(effective),
      );
      expect(
        (await shotControls(p, where)).version === after.version,
        'preflight changed the story',
      );
    } finally {
      // Put the QA shot back as it was.
      const wanted =
        before.controls.aspect_ratio === '9:16'
          ? '竖屏'
          : before.controls.aspect_ratio === '1:1'
            ? '方形'
            : '横屏';
      await aspect
        .getByRole('button', { name: wanted })
        .click()
        .catch(() => {});
      await saved(p).catch(() => {});
      if (before.controls.generate_audio !== false && !(await keep.isChecked().catch(() => true))) {
        await keep.check().catch(() => {});
        await saved(p).catch(() => {});
      }
    }
    return p;
  },
);

await journey(
  'profile editor is a dialog; Escape closes the file chooser first',
  () => QA_USER,
  async (open) => {
    const p = await open(QA_USER);
    const where = await qaShot(p);
    await openShot(p, where);
    const card = p.locator('.pcard').first();
    if (!(await card.count())) return p; // no character, place or prop in this story
    await card.click();
    await p.locator('dialog.pe-dialog[open]').waitFor({ timeout: 15000 });
    await p.locator('dialog.pe-dialog .pe-photo-add').click();
    await p.locator('dialog.pe-choose[open]').waitFor({ timeout: 10000 });
    await p.keyboard.press('Escape');
    await settle(p, 400);
    expect(!(await p.locator('dialog.pe-choose[open]').count()), 'Escape left the chooser open');
    expect(await p.locator('dialog.pe-dialog[open]').count(), 'Escape closed the editor too');
    await p.keyboard.press('Escape');
    await settle(p, 400);
    expect(
      !(await p.locator('dialog.pe-dialog[open]').count()),
      'second Escape left the editor open',
    );
    return p;
  },
);

await journey(
  'take review verdict shows on the take card and is put back',
  () => QA_USER,
  async (open) => {
    const p = await open(QA_USER);
    const where = await qaShot(p);
    const list = await api(p, `/v1/projects/${where.project}/shots/${where.shot}/take-reviews`);
    const take = list.body[0];
    const path = `/v1/projects/${where.project}/shots/${where.shot}/takes/${take.artifact_id}/review`;
    const current = await api(p, path);
    const original = current.body?.verdict ?? null;
    const set = await send(
      p,
      'PATCH',
      path,
      { expected_revision: current.body.revision, verdict: 'keep' },
      true,
    );
    expect(set.status === 200, 'saving a verdict failed: ' + set.status);
    try {
      await openShot(p, where);
      await p
        .locator('.take-review-badges')
        .first()
        .waitFor({ timeout: 15000 })
        .catch(() => {
          throw Error('take card shows no review badge');
        });
    } finally {
      await send(
        p,
        'PATCH',
        path,
        { expected_revision: set.body.revision, verdict: original },
        true,
      );
    }
    return p;
  },
);

// Fields the studio reads from each API response (h3-studio#665). A backend change that drops
// one fails here after the staging deploy, before promotion. Keep in step with the readers in
// cloud-controller.js, StoryboardWorkbench.jsx, TakeReview.jsx, CreditsUI.jsx and settings.
const CONTRACT = [
  ['/api/auth/me', null, ['username', 'role', 'credits', 'features', 'operator_capacity']],
  ['/v1/credits', null, ['balance', 'available', 'today_used', 'daily_limit']],
  ['/v1/projects?limit=5', 'projects', ['id', 'title', 'version', 'updated_at']],
  [
    '/v1/capabilities',
    null,
    ['capabilities_version', 'recipes', 'deployment_profiles', 'upload_max_bytes'],
  ],
  ['/v1/capabilities', 'deployment_profiles', ['id', 'tier', 'generation_support']],
  ['/v1/generation-availability', 'profiles', ['deployment_profile_id', 'tier', 'modes']],
  ['/v1/feedback/settings', null, ['revision', 'enabled']],
  ['SHOT/generation-draft', null, ['project_version', 'draft', 'issues', 'defaults']],
  ['SHOT/versions?limit=5', null, ['project_version', 'versions', 'next_offset', 'defaults']],
  [
    'SHOT/versions?limit=5',
    'versions',
    [
      'id',
      'selected',
      'aliased',
      'starred',
      'title',
      'created_at',
      'kind',
      'recipe',
      'preview_url',
      'thumbnail_url',
    ],
  ],
  ['SHOT/take-reviews', '', ['artifact_id', 'revision', 'verdict', 'mark_count']],
];

await journey(
  'API contract: fields the studio reads are present',
  () => QA_USER,
  async (open) => {
    const p = await open(QA_USER);
    const where = await qaShot(p);
    const shotPath = `/v1/projects/${encodeURIComponent(where.project)}/shots/${encodeURIComponent(where.shot)}`;
    const missing = [];
    const cache = new Map();
    for (const [route, rows, fields] of CONTRACT) {
      const path = route.replace(/^SHOT/, shotPath);
      if (!cache.has(path)) cache.set(path, await api(p, path));
      const res = cache.get(path);
      if (res.status !== 200) {
        missing.push(`${route} → HTTP ${res.status}`);
        continue;
      }
      const target = rows === null ? res.body : rows === '' ? res.body?.[0] : res.body?.[rows]?.[0];
      if (!target) continue; // an empty list cannot be checked; other journeys need data anyway
      for (const field of fields)
        if (!(field in target)) missing.push(`${route}${rows ? ' ' + rows + '[]' : ''}.${field}`);
    }
    const plan = await send(p, 'POST', shotPath + '/generation-plans', {
      expected_version: (await shotControls(p, where)).version,
    });
    for (const field of [
      'plan_id',
      'status',
      'effective_request',
      'estimate',
      'blockers',
      'warnings',
    ])
      if (!(field in (plan.body || {}))) missing.push('generation-plans.' + field);
    for (const field of ['aspect_ratio', 'generate_audio', 'resolution', 'seed'])
      if (!(field in (plan.body?.effective_request || {})))
        missing.push('generation-plans.effective_request.' + field);
    expect(!missing.length, 'API fields the studio reads are missing: ' + missing.join(', '));
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
