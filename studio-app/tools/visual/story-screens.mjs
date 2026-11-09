// The story steps the visual audit opens (owner 2026-11-10): Script, World, Storyboard,
// Library and Edit, each with the states people actually see. The same list drives the
// replay (tools/visual-audit.mjs) and a re-recording (tools/visual/README.md), so the fixture
// always holds the answers these screens ask for.
// One QA story, 三个身体的儿子: a character group, split members, places, props, 50 files,
// shots with takes and an edit timeline.
export const STORY_PROJECT = 'project-70e55fda6b704c9ea5cafe2727ae9bbf';

// World and Library are one page component; both the current and the redesigned markup count.
const PAGE = '.stage-page, .stage-library > aside.library';
const PEOPLE = '.pcard, .sp-card';
const FILES = '.tile, .sp-card';
const go = (stage) => async (page, base) => {
  const step = stage === 'storyboard' ? '' : `&stage=${stage}`;
  await page.goto(`${base}/?view=workspace&project=${STORY_PROJECT}${step}`, {
    waitUntil: 'domcontentloaded',
  });
};
const tab = (text) => async (page) => {
  await page
    .locator(`:is(${PAGE}) :is(button, [role="tab"])`)
    .filter({ hasText: text })
    .first()
    .click();
};
const cardSize = (text) => async (page) => {
  await page.locator('.card-size button').filter({ hasText: text }).first().click();
};
const quiet = async (page) => {
  await page.keyboard.press('Escape');
  await page.mouse.move(1, 1);
};

// Shared by every step: the top bar keeps next step and Inky in reach.
const TOP = ['.sb-next-step', '.inky-button'];
const WORLD = {
  root: PAGE,
  edges: ['.lib-head, .sp-title', '.lib-search, .sp-bar', '.plist, .sp-grid'],
  cards: PEOPLE,
  panel: 'none',
  need: TOP,
  media: `:is(${PAGE}) :is(${PEOPLE}), :is(${PAGE}) :is(${PEOPLE}) > *`,
};
const LIBRARY = {
  ...WORLD,
  edges: ['.lib-head, .sp-title', '.lib-search, .sp-bar', '.grid, .inbox, .sp-grid'],
  cards: FILES,
  media: `:is(${PAGE}) :is(${FILES}), :is(${PAGE}) :is(${FILES}) > *`,
};
const BOARD = {
  root: '.layout.A > .col',
  edges: [
    '.chapter-head .chapter-summary',
    '.sb-scene-groups > .scene',
    '.dock-screen, .dock-right',
  ],
  cards: '[data-shot-card]',
  panel: 'none',
  need: TOP,
  media: '[data-shot-card], [data-shot-card] > *',
};

export const STORY_SCREENS = [
  {
    name: 'script',
    open: go('script'),
    ready: '.script-sheet .script-scene',
    rules: {
      root: '.script-page',
      edges: ['.script-head h1', '.script-scene', '.script-add'],
      panel: 'none',
      need: TOP,
    },
  },
  {
    name: 'world: people and the 三兄弟 group',
    open: go('world'),
    ready: `:is(${PAGE}) :is(${PEOPLE})`,
    rules: WORLD,
  },
  { name: 'world: places', open: tab('场景'), ready: `:is(${PAGE}) :is(${PEOPLE})`, rules: WORLD },
  { name: 'world: props', open: tab('道具'), ready: `:is(${PAGE}) :is(${PEOPLE})`, rules: WORLD },
  {
    name: 'world: ⋯ menu open',
    async open(page) {
      await tab('人物')(page);
      await page.locator(`:is(${PAGE}) :is(${PEOPLE}) .item-menu button`).first().click();
    },
    ready: '[role="menu"]',
    rules: WORLD,
  },
  {
    name: 'world: profile editor open',
    async open(page) {
      await quiet(page);
      await page
        .locator(`:is(${PAGE}) :is(${PEOPLE})`)
        .first()
        .click({ position: { x: 8, y: 8 } });
    },
    ready: 'dialog[open]',
    rules: { ...WORLD, root: 'dialog[open]', edges: [], cards: null, media: null },
    after: quiet,
  },
  { name: 'storyboard', open: go('storyboard'), ready: '[data-shot-card]', rules: BOARD },
  {
    name: 'storyboard: small cards',
    open: cardSize('小'),
    ready: '[data-shot-card]',
    rules: BOARD,
  },
  {
    name: 'storyboard: large cards',
    open: cardSize('大'),
    ready: '[data-shot-card]',
    rules: BOARD,
  },
  {
    name: 'storyboard: shot panel open',
    async open(page) {
      await cardSize('中')(page);
      // The card's title opens the shot (its description box would only take focus).
      await page.locator('[data-shot-card] .card-title').first().click();
      // A hovered card lifts 2px; measure the resting layout.
      await page.mouse.move(1, 1);
    },
    ready: 'aside.drawer',
    rules: { ...BOARD, panel: 'fit' },
    after: async (page) => {
      await quiet(page);
    },
  },
  {
    name: 'library: images',
    open: go('library'),
    ready: `:is(${PAGE}) :is(${FILES})`,
    rules: LIBRARY,
  },
  {
    name: 'library: video',
    open: tab('视频'),
    ready: `:is(${PAGE}) :is(${FILES})`,
    rules: LIBRARY,
  },
  {
    name: 'library: audio',
    open: tab('声音'),
    ready: `:is(${PAGE}) :is(${FILES})`,
    rules: LIBRARY,
  },
  {
    name: 'library: 待整理 inbox',
    open: tab('待整理'),
    ready: `:is(${PAGE}) :is(${FILES})`,
    rules: LIBRARY,
  },
  {
    name: 'edit',
    open: go('edit'),
    ready: '.film-editor .film-vtrack',
    rules: {
      root: '.film-editor',
      edges: [
        '.film-editor-head',
        '.film-monitor',
        '.film-zoom',
        '.film-timeline',
        '.film-audio-bar',
      ],
      panel: 'none',
      need: TOP,
    },
  },
];
