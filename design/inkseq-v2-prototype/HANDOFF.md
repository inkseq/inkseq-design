# Inkseq web app v2 — prototype handoff

Owner-approved UX reference (updated 2026-10-17). A local React prototype with sample data and
simulated generation/GPUs. **It defines behaviour and layout; it is not production code.** Rebuild each
feature in the canonical frontend (`inkseq/sixnine-design`, `studio-app`) on the real backend
(`inkseq/h3-studio`). Supersedes the 2026-10-14 storyboard handoff.

- Run: `npm install && npm run dev` → http://127.0.0.1:5192/ (English by default; 中文 switch top right). Open a page directly with
  `?page=home|quick|story|library|gpu|settings|trash`. Phone layout: any width ≤ 760 px.
- Optional real assistant: `server/assistant.py` on :5193 (Gemini for proposals, TypeSafe Jev for
  matching) started through the central `AI-Registry/tools/api_run.py`; without it the prototype falls back
  to local rules. No keys are in this folder.
- Code map: `src/store.jsx` (all actions/reducer, simulated queue and machines), `src/model.js` (prompt
  assembly, inherited controls, estimates), `src/trash.js` (soft delete), `src/quick.jsx`,
  `src/components.jsx` (story library, shot editor), `src/takes.jsx` (version workbench),
  `src/layouts.jsx` (story workspace, bulk bar), `src/library.jsx`, `src/gpu.jsx`, `src/agent.jsx`,
  `src/trashPage.jsx`, `src/advanced.jsx` (all H3 controls), `src/inputs.jsx`.

## Rules for the implementation

1. **Every feature ships for both the browser and Agents.** Browser and Agent use the same business API.
   A feature is done only when (a) the API exists, (b) the web UI works on desktop and phone, and
   (c) the public Agent skill (`skills/sixnine-yingxu/SKILL.md`, helper, `/for-agents`) documents it with
   an example. Pure UI details (hover play, long-press hints, layout) need no Agent counterpart.
2. Build and accept on staging, promote the same build (existing release path, single release lane).
3. Keep the existing contracts: owner isolation, preflight before paid work, budgets, immutable
   revisions/receipts, no silent retries. Database changes are additive only.
4. Keep everything the user made: no automatic deletion or retention expiry for now (owner, 2026-10-17).
   Deleting = move to trash, restorable.
5. **No hard-coded limits** (owner, 2026-10-17). Every cap, threshold or limit has a default **and a place in
   the UI to change it**: the user's daily spend and "ask me above $X" (设置 → 我的额度), each AI assistant's
   daily cap (设置 → AI 助手, editable after connecting), and admin defaults for test machines — daily
   spend, max hourly price, idle auto-stop, max runtime (设置 → 管理员). Backend reads them from settings,
   never from constants.
6. **Bilingual, English by default** (owner, 2026-10-17). Every user-facing string exists in English and
   Chinese; first visit is English; a 中文/EN switch in the header remembers the choice. The prototype does
   this with a runtime dictionary (`src/i18n.js`, `src/en.json`) only to show the result — production must
   use proper i18n keys in `studio-app` (and translate server-side messages and Agent-facing errors).

## Batches (suggested order; each is one issue)

| # | Batch | Prototype | Backend status |
|---|---|---|---|
| 1 | Quick Chat takes | `?page=quick` | mostly exists |
| 2 | AI assistant entry (Agent connect v2) | Quick Chat sidebar, story bar, Settings → AI 助手 | partly exists |
| 3 | Storyboard: version workbench, bulk actions, inherited defaults | `?page=story` | small additions |
| 4 | Trash and undo everywhere | ⋯ menus, `?page=trash` | needs soft delete |
| 5 | Phone layout | any page at ≤ 760 px | none (frontend) |
| 6 | Account-wide library | `?page=library` | larger change |

### 1 · Quick Chat takes
- Proposal card and direct mode: **generate 1–4 takes** at once; each take gets its own random seed (a
  fixed seed applies to the first only). Shows an estimate ("约 N 分钟机器时间 · 约 $X") before generating.
- Takes from one proposal render as **one group card**: thumbnail grid (newest first, hover plays,
  fold after 8 with "显示全部"), a selected take with the normal actions, ☆ star, **side-by-side compare**
  of two takes ("选这条" exits). "再来一条" adds a take to the same group; "改一改" starts a new proposal.
- **放进故事** copies the full recipe into a new shot: inputs and roles (first/last/guides or REF refs with
  excerpt/sound options), controls, duration, quality, seed (seed lock on), so regenerating reproduces it.
- Queue position "排队中 · 第 N 位" is computed over story shots **and** Quick Chat jobs (one queue per mode).
- Composer drafts are kept per conversation; switching never carries attachments/"基于第 N 条" over.
- Backend: revisions + submissions with `copies` exist. Add: take star; position in the shared queue;
  "revision → shot generation draft" transfer. Agent: submit with copies, list a group's takes and their
  recipes, star, move to story.

### 2 · AI assistant entry (replaces the current per-session "AI 创作伙伴" panel)
- Entry points: "让 AI 助手来做" in Quick Chat, "AI 助手" in the story bar, Settings → AI 助手.
- Three steps: **scope** (this Quick Chat / this story / all my work) → **permission** (只看和整理 = no paid
  work; 创作并生成 with a **daily spend cap**) → **one short paragraph to paste** to the Agent: skill URL,
  one-time code (10 min, single use), scope, permission, cap. Waiting → connected.
- Settings lists connected assistants: device, scope, today's spend vs cap, recent actions, pause/resume,
  revoke (work stays).
- Everything an Agent creates carries a 🤖 badge (Quick Chat rows/groups, shot cards) so the owner reviews
  and picks results in the normal UI. Over the daily cap the Agent's submit is refused and logged.
- Backend: Agent Connect, one-time codes and PATs exist. Add: scope (session/project/all), per-connection
  daily cap enforced in admission, pause, `created_by` connection on sessions/shots/takes, per-connection
  activity list. Keep the technical details (fingerprints, tenant, profile versions) out of the user copy.

### 3 · Storyboard
- **Version workbench**: the shot editor can expand (stops at the library sidebar; back/Esc collapses
  first). All takes as a grid with hover play, "和上一版比：改了…" diff, ☆, 用这个, **用它的设置** (restore
  that take's recipe), delete. Compare two side by side. Generate 1–4 at once.
- Each version stores its **recipe snapshot** (`RECIPE_KEYS` in `model.js`).
- **Bulk actions** on the card wall: pick with the circle, Ctrl/⌘-click or Shift-range; bar offers generate
  (N per shot, with estimate), draft/final, move to scene, delete (to trash, one undo), select all; Esc clears.
- **Inherited defaults**: global → story → shot. "设为本故事默认" stores defaults on the story; shots
  follow unless they changed that control. Duration and seed are per shot.
- Shared profile notice: a profile used by several stories says so; "只给本故事复制一份" forks it for
  this story's shots.
- Backend: per-version recipe snapshot, copies for shot generation, story-level defaults, profile copy.

### 4 · Trash and undo
- Every user-made thing can be renamed/edited and deleted: story, chapter, scene, shot, version, file,
  profile, look, Quick Chat conversation, take. Delete never asks; it moves to trash and shows "撤销".
  Only permanent delete asks. Running items cannot be deleted (reason shown). Keep at least one chapter/scene.
- Trash page: filter by kind, multi-select restore/permanent delete, empty trash. Restoring brings back
  references (a trashed file just disappears from shots until restored). Purging removes references.
- ⋯ menus close on any outside click, Esc or scroll.
- Backend: Quick Chat history trash exists (#182). Add soft delete (`trashed_at`) for project entities,
  assets and projects with restore/purge and reference clean-up.

### 5 · Phone layout (≤ 760 px)
- Bottom tab bar; Quick Chat list as a drawer; story library as an overlay; shot editor full screen;
  composer options scroll horizontally; 2-column wall; library filters as a chip row.
- Icon+text buttons collapse to icons except primary actions, menus and story/chapter titles; long press
  shows the label. Ambiguous icons (改一改, 再来, 助手) should keep a short label (open follow-up).

### 6 · Library (last)
- One library per account across stories: profiles + files, filters by type, **work (computed from usage)**,
  unused, tags; detail panel with rename, tags, source, **用在哪里** (jump to the shot), file into a profile;
  bulk tag/file/delete; drag-and-drop upload.
- Backend today scopes assets and profiles to one project. Interim: per-story library plus an aggregated
  read-only view and "import from another story". Full account library is a separate design decision.

## Known gaps left in the prototype
Single-level undo; editing a shot while one of its files is in trash drops that reference on restore;
dragging a multi-selection moves one card. Estimates are rough constants — use `/v1/generations/preflight`.
