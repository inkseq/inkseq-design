# Visual layout checks (h3-studio#897)

`npm run build && npm run audit:visual` opens signed-in screens (storyboard dock, shot
takes and trim bar, enhance dialog) at two viewports and fails on geometry rules: marks
overlapping pictures or labels, badges off one line, labels sticking out of their bar,
fills not clipped to rounded corners, plus the layout audit's generic checks. CI runs it
on every pull request; failing screens are uploaded as `visual-failures`.

## No login, no network

`storyboard.har` is one QA project's API traffic, recorded once from staging and
sanitised. Tests replay it with Playwright `routeFromHAR`, so the app believes it is
signed in; every other request (media, other hosts) is refused, so videos stay blank and
results are the same on every run. CI never signs in to staging.

## Adding a rule

Each screen in `tools/visual-audit.mjs` lists `[kind, selector, otherSelector, tolerance]`:
`no-overlap`, `same-midline`, `inside`, `above`, `starts-above`, `left-of`, `clips-like`.
Add the rule when a layout bug is fixed, and check it fails on the old CSS.

## Re-recording the fixture

Needed when the API shape changes or a new screen needs data.

1. Serve the build through a local proxy to staging (local only, not committed):
   `vite preview` with `preview.proxy` for `/v1` and `/api/auth` to
   `https://staging.inkseq.com`, `cookieDomainRewrite: '127.0.0.1'`, port 4173.
2. Sign in once as `qa-user`, never an admin (admin views carry internals) or a real
   account (accounts: `h3-studio/.local/staging-qa-accounts.json`; not while
   journeys-staging runs), and record with
   `browser.newContext({ recordHar: { path: 'tools/visual/raw.har', urlFilter: /\/(v1|api)\//, content: 'embed' } })`
   while opening the same screens.
3. `node tools/visual/sanitize-har.mjs tools/visual/raw.har tools/visual/storyboard.har`
   (drops headers, cookies, signed media URLs, e-mail addresses and generation
   internals such as steps, provider and cost), delete `raw.har`, and grep the result
   for internal names before committing: this repository is public.
