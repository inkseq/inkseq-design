# Visual layout checks (h3-studio#897)

`npm run build && npm run audit:visual` opens signed-in screens from recorded API fixtures and
fails on geometry rules. CI runs it on every pull request; failing screens are uploaded as
`visual-failures`. Two suites:

- **storyboard** (`storyboard.har`): the storyboard dock, the shot takes and trim bar and the
  enhance dialog at 1440×900 and 1280×760. Rules per screen in `tools/visual-audit.mjs`:
  marks overlapping pictures or labels, badges off one line, labels sticking out of their bar,
  fills not clipped to rounded corners.
- **story** (`story.har`, owner 2026-11-10): every story step at 1440×900, 1920×1080 and
  390×844, light and dark. Script; World (people with the 三兄弟 group, places, props, a card's ⋯
  menu, a profile editor); Storyboard (medium, small and large cards, the shot panel open);
  Library (images, video, audio, the 待整理 inbox); Edit. Screens are listed in
  `story-screens.mjs`; the rules are in `page-rules.mjs`.

Both suites also run the layout audit's generic checks (sideways scroll, off-screen, clipped
text, spilling buttons, text under 10px, page errors).

`--only story|storyboard` runs one suite, `--pick "phone light"` only those story windows,
`--shots <dir>` saves every story screen (keep those outside the repo), and `AUDIT_PORT=4291`
serves the build on another port when 4173 is taken.

## Story rules (`page-rules.mjs`)

| Rule              | Fails when                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Nothing clipped   | text or a control is cut by the window, by a container that hides overflow, or sits left of a scroller's start; or starts left of the page's content edge. An ellipsis is a deliberate cut and passes. |
| One left edge     | the title, toolbar and grid (`edges`) do not start at the same x within 1px. Ink counts: a border, background, picture or button box, else the first text.                                             |
| Rows              | cards (`cards`) in one visual row differ in top or height, or a card shows more than 24px of nothing at its foot (stretched to a neighbour).                                                           |
| Gutters           | gaps between neighbours in a grid differ, across or down, or across differs from down. A group band is its own grid.                                                                                   |
| Fixed media boxes | a card or its parts moves when pictures arrive late: pictures are held until the screen has drawn, then half load (a wide stand-in) and half fail.                                                     |
| No overlap        | two controls overlap, or text overlaps text, within one layer (menus and dialogs are their own layer).                                                                                                 |
| Floating controls | a row of only buttons sits more than 64px below the nearest content above it, with nothing beside it.                                                                                                  |
| Panels            | the shot panel is open on a step other than the storyboard; on the storyboard, the open panel or anything in it scrolls sideways.                                                                      |
| Top bar           | next step or Inky is missing or outside the window.                                                                                                                                                    |

Add a rule when a layout bug is fixed, and check it fails on the old CSS.

## No login, no network

The fixtures are QA projects' API traffic, recorded once from staging and sanitised. Tests
replay them with Playwright `routeFromHAR`, so the app believes it is signed in; every other
request is refused, and pictures are answered by the audit itself. CI never signs in.

## Re-recording a fixture

Needed when the API shape changes or a new screen needs data.

1. Serve the build through a local proxy to staging (local only, not committed):
   `vite preview` with `preview.proxy` for `/v1` and `/api/auth` to
   `https://staging.inkseq.com` (`changeOrigin`, `cookieDomainRewrite: '127.0.0.1'`, and the
   `origin` header set to the staging address, or sign-in is refused as cross-site).
2. Sign in once as `qa-user`, never an admin (admin views carry internals) or a real account
   (accounts: `h3-studio/.local/staging-qa-accounts.json`; not while journeys-staging runs).
   Refuse every PUT, POST, PATCH and DELETE except `/api/auth/*` with `context.route`, so the
   story never changes and nothing is generated. Record with
   `browser.newContext({ recordHar: { path: 'tools/visual/raw.har', urlFilter: /\/(v1|api)\//, content: 'embed' } })`.
   For the story fixture, walk `STORY_SCREENS` from `story-screens.mjs` at 1440×900 and at
   390×844 in that context, so the fixture holds every answer the screens ask for.
3. `node tools/visual/sanitize-har.mjs tools/visual/raw.har tools/visual/story.har <project id>`
   keeps only JSON answers (no media), drops headers, cookies, signed media URLs, e-mail
   addresses, the account's ids, generation internals (steps, provider, cost, model names,
   compiled prompts) and, with a project id, every other story from the story list. Delete
   `raw.har`, then grep the result for internal names before committing: this repository is
   public.
