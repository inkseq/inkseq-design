# #251 prototype-component acceptance

Accepted immutable staging candidate: `722e46ebc0303f1b3f1b294ac7b049dbedd77480`, canonical frontend source `cee88d76` (design PR61, merge7b0b1fd4). Original publication run39009319080/1; candidate SHA `3aa4fecb9f858817a945c44597797c3d41772dfcaf29c3d1cab55981cd8496c5`. Browser: existing Chrome extension, Monash, superdan; observations2026-10-17 approximately06:31–07:00UTC. No credential/login reset.

## Actual prototype / staging pairs

All source screenshots are unmodified PNGs. Prototype uses simulated data; staging uses authorized synthetic QA records and ordinary live APIs.

| Page | Prototype1440×900 | Staging1440×900 | Prototype375×812 | Staging375×812 |
|---|---|---|---|---|
| home | ![prototype desktop](prototype-home-1440x900.png) | ![staging desktop](staging-home-1440x900.png) | ![prototype phone](prototype-home-375x812.png) | ![staging phone](staging-home-375x812.png) |
| quick | ![prototype desktop](prototype-quick-1440x900.png) | ![staging desktop](staging-quick-1440x900.png) | ![prototype phone](prototype-quick-375x812.png) | ![staging phone](staging-quick-375x812.png) |
| library | ![prototype desktop](prototype-library-1440x900.png) | ![staging desktop](staging-library-1440x900.png) | ![prototype phone](prototype-library-375x812.png) | ![staging phone](staging-library-375x812.png) |
| story | ![prototype desktop](prototype-story-1440x900.png) | ![staging desktop](staging-story-1440x900.png) | ![prototype phone](prototype-story-375x812.png) | ![staging phone](staging-story-375x812.png) |
| gpu | ![prototype desktop](prototype-gpu-1440x900.png) | ![staging desktop](staging-gpu-1440x900.png) | ![prototype phone](prototype-gpu-375x812.png) | ![staging phone](staging-gpu-375x812.png) |
| settings | ![prototype desktop](prototype-settings-1440x900.png) | ![staging desktop](staging-settings-1440x900.png) | ![prototype phone](prototype-settings-375x812.png) | ![staging phone](staging-settings-375x812.png) |
| trash | ![prototype desktop](prototype-trash-1440x900.png) | ![staging desktop](staging-trash-1440x900.png) | ![prototype phone](prototype-trash-375x812.png) | ![staging phone](staging-trash-375x812.png) |

## Observed behavior

- Works: actual cloud/local entries, search, restored entry, normal new-story dialog. Cover badges were computed at11px rather than54px. A newly created cloud QA story opened the card-wall workspace directly; the old seven-step wizard is absent.
- Quick Create: existing owned conversation and real three-take metadata group loaded. Compare-two toggles and selection layout worked. Take2 star saved through the real API and was subsequently restored to its original unstarred state. Navigating to Library and back retained the selected conversation, expanded take group and unsent input. The test input was then cleared without submitting.
- Quick safety: these three takes are **awaiting confirmation**, not completed video jobs. The absence of a live worker disables execution with an original actionable reason. No paid generation was submitted solely for visual acceptance.
- Library: eight existing QA images, tags/source-story/usage metadata and thumbnails loaded; both desktop side panel and phone full-screen detail dialog worked. Inbox remains truthfully unavailable. No fabricated media or cross-owner reads were used.
- Story: two scene groups/five shots, library tabs, bottom player/timeline and right editor drawer rendered. Selecting a timeline shot updated the real project/entity URL. Phone drawer and its close action worked, including controls derived from current capabilities. The fixture has no generated workbench versions; its missing saved-character reference is reported honestly.
- Story refresh: the shareable project/entity URL remains intact. On a document refresh the existing local-draft safety prompt preserves local work; choosing Open linked story restores the exact cloud story and shot. This original guard is retained intentionally.
- GPUs: real staging queue and machine summary loaded with zero active machines. The normal read-only provider query returned five actual grouped5090 quotes with enabled launch entry points. No rental or lifecycle mutation was performed to reproduce prototype rows. No invented preparation progress or cost was shown.
- Settings: account/defaults/budget/admin routes loaded; defaults→admin Back and Forward restored the correct query tab. The existing human-admin all-account audited budget/price editor loaded all six staging account rows including shared GPU/generation budgets. No allowance, price, credential or daily safety value was changed.
- Trash: a newly created disposable QA story was moved through the normal recoverable trash flow and restored through the original API. Counts1→0 and the returned Works entry were verified. No permanent deletion, expiry or generation replay occurred.
- SPA navigation: all six top-level entries shared the same observed document loader ID; earlier Quick→Library→Quick also retained the loader. Phone width/scrollWidth was375/375 for all six pages and Story. Bottom navigation/drawers/actions remained reachable.

## Deliberate differences and coverage limits

- The prototype's sample generated videos, stock rows, prices, cost counters and expiry are not business truth. Staging displays its real owned records, live quotes, empty/blocked states, non-expiring trash and original confirmation/owner/resource/budget rules.
- Screenshots capture existing preflight/take metadata and empty generated-version states. Fresh generation/playback/download is **not claimed** for this Low-risk view-layer batch. The native execution/media/storage source and pinned native source-index bytes are unchanged versus the accepted F boundary; prior genuine staging website/Agent video and separate-audio qualifications are reused only for those unchanged paths. No foreign-owned output was opened to manufacture a loaded screenshot.
- Existing server-origin diagnostics/cloud-status notices may retain their original Chinese text in an English view. The view retains the exact diagnostic rather than replacing it with a generic failure.
- Administrative authorization, snapshot/CAS, pending-write recovery, pagination/generation fences, retired-cap and invoice-pending semantics are retained from F/#255. The26 affected financial model tests passed; ordinary Agent denial is checked separately. Browser budget writes were intentionally not repeated because this port changes presentation, not authority.

## Validation and release evidence

- Local combined frontend suite658/658; final affected checks/build passed; canonical and integration required CI passed.
- H3 PR258 and design PR61 merged. Source merge is separate from deployment.
- Sole staging deployment7ba390be: Success/0. Exact postflight4a53ce07 matched all three manifests,13 frontend files, actual OCI descriptor/config chains and healthy app/controller/dstack.
- Reviewed offline rehearsal59234fd1: Success/0, exact candidate, network-none temporary PostgreSQL, original dump identity unchanged, prior intents/helpers retained; no production DB copy published.
- Production pre-promotion read-only census3238c01c: acceptedF remains app_ready/no pending release; all11 retained financial/compatibility fields unchanged. No reservation recovery/refund/settlement replay.
- Protected owner instances56330848 and56336890 were not operated on. No test GPU was rented in this takeover; incremental test GPU spend isUSD0.
- Production promotion: pending final exact acceptance metadata and protected same-artifact operation; record the original promotion/postflight in #251 rather than inferring it from this report.

