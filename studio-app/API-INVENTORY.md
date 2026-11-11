# Server calls made by studio-app

Inventory for h3-studio#992 step 2 (one API layer). Taken at commit f2cda84. It lists every
place the app asks the server for something: file and line, the function that makes the call,
the HTTP method and the path. Tests and mocks are left out.

How it was made: a scan of `src` for calls through the transport (`request`, `download` of
`createCloudClient`) and for `fetch`, then corrected by hand where the path or method is built
from variables. A path part in braces is a value put in at run time. Refresh it when an area
moves; line numbers go stale first.

"In a client module" means the call is already a named function in one of `cloud-client.js`,
`quick-chat-client.js`, `story-chat-client.js`, `operator-client.js`, `dstack-client.js`,
`p4-operator-client.js` or `api/*.js`. "Written in place" means a page, hook or controller
writes the path itself; those are the calls step 2 moves.

## Summary

| Area | Calls | In a client module | Written in place |
|---|---:|---:|---:|
| Sign-in and session | 9 | 6 | 3 |
| Account, keys and connections | 19 | 12 | 7 |
| Credits and billing | 15 | 0 | 15 |
| Feedback | 3 | 3 | 0 |
| Film | 5 | 0 | 5 |
| Voice | 4 | 0 | 4 |
| Projects and storyboard | 23 | 10 | 13 |
| Assets and media | 12 | 7 | 5 |
| Generation, jobs and batches | 17 | 16 | 1 |
| Quick chat | 44 | 39 | 5 |
| Story chat | 25 | 14 | 11 |
| Inky | 5 | 0 | 5 |
| Library | 4 | 0 | 4 |
| Trash | 4 | 0 | 4 |
| Admin | 16 | 0 | 16 |
| Operator console, capacity (legacy) | 13 | 13 | 0 |
| Operator console, dstack and admin | 48 | 31 | 17 |
| Other | 1 | 0 | 1 |
| **Total** | **267** | **151** | **116** |

Moved so far: **Feedback** (`src/api/feedback.js`, the pattern for the rest).

Three areas counted as "written in place" already keep their calls in one module each, mixed
with other logic: Film (`story-film.js`), Library (`library-commands.js`) and Trash
(`trash-commands.js`). The largest groups still spread over pages are Admin, Credits and
billing, and the admin part of the operator console; `cloud-controller.js` holds the Inky,
Voice, take review and workbench calls.

## Transport

All calls except the few `fetch` uses listed under "Outside the transport" go through
`createCloudClient().request` in `src/cloud-client.js`: same-origin paths under `/v1/` and
`/api/auth/` only, sign-in and refusal handling, spending confirmation, retry of reads, and
admission limits for reads and downloads. Each of the client modules builds its own transport
with `createCloudClient`; pages get one from `useClient(account)` or from a controller.

## Outside the transport

| File | Function | Method | Path | Why |
|---|---|---|---|---|
| src/account-access.js:53 | readAccess | GET | /api/auth/me | Runs before any client exists. |
| src/MaintenanceBanner.jsx:22 | check | GET | /api/auth/config | Must work while the API refuses everything else. |
| src/support-view.js:48 | endSupportView | POST | /v1/admin/support-views/{view.id}/end | Sent while leaving the support view. |
| src/video-cache-core.js:316 | identity | GET | /api/auth/me | Runs in the cache worker. |
| src/video-cache-core.js:150, 207 | checkAccess, readFull | HEAD, GET | asset or artifact content URL | Runs in the cache worker. |
| src/media-read-gate.js:154, 168 | gated fetch | GET | asset or artifact content URL | Wraps the page's fetch for media reads. |
| src/audio-peaks.js:50 | decode | GET | asset or artifact content URL | Reads audio to draw a waveform. |
| src/version-check.js:42 | check | GET | / | Reads index.html to see whether a new build is served. |

## URLs handed to the browser, not fetched by code

These are paths the app puts in `href`, `src` or a redirect. They are server routes too, so a
route rename must look here.

| File | Path |
|---|---|
| src/account-access.js:123 | /api/auth/workos/start?return_to= |
| src/ApiKeys.jsx:219, 223 | /v1/agent-skill.zip, /v1/agent-guide |
| src/shot-look.js:26, src/StoryChat.jsx:928 | /v1/story-chats/starter-pictures/{name} |
| src/cloud-controller.js:248, 542, 722 | /v1/assets/{id}/content, /v1/artifacts/{id}/content |
| src/artifact-media.js:9, 36 | /v1/artifacts/{id}/content |
| src/Library.jsx:33, src/story-navigation.js:158 | /v1/{assets or artifacts}/{id}/content |
| src/video-cache-core.js:235, src/VoiceDesign.jsx:56 | /v1/artifacts/{id}/content, /v1/assets/{id}/content |
| src/story-film.js:135 | /v1/artifacts/{id}/content?download=true (through `download`) |
| src/all-settings-model.js:90-93 | four admin settings paths used as keys to link a setting to its page |

## Calls by area

### Sign-in and session

| File | Function | Method | Path | Where |
|---|---|---|---|---|
| src/cloud-client.js:484 | authConfig | GET | /api/auth/config | client module |
| src/MaintenanceBanner.jsx:22 | check | GET | /api/auth/config | written in place |
| src/cloud-client.js:487 | login | POST | /api/auth/login | client module |
| src/cloud-client.js:488 | logout | POST | /api/auth/logout | client module |
| src/account-access.js:53 | readAccess | GET | /api/auth/me | written in place |
| src/cloud-client.js:485 | me | GET | /api/auth/me | client module |
| src/video-cache-core.js:316 | identity | GET | /api/auth/me | written in place |
| src/cloud-client.js:517 | revokeAllSessions | POST | /api/auth/sessions/revoke-all | client module |
| src/cloud-client.js:519 | changePassword | POST | /v1/auth/password | client module |

### Account, keys and connections

| File | Function | Method | Path | Where |
|---|---|---|---|---|
| src/AccountGoogleLink.jsx:17 | AccountGoogleLink | GET | /v1/account | written in place |
| src/TermsGate.jsx:23 | read | GET | /v1/account | written in place |
| src/quick-chat-client.js:114 | connectionSettings | GET | /v1/account/agent-connection-settings | client module |
| src/quick-chat-client.js:116 | saveConnectionSettings | PATCH | /v1/account/agent-connection-settings | client module |
| src/quick-chat-client.js:117 | createConnection | POST | /v1/account/agent-connections | client module |
| src/quick-chat-client.js:103 | connections | GET | /v1/account/agent-connections?(query) | client module |
| src/quick-chat-client.js:104 | connection | GET | /v1/account/agent-connections/{id} | client module |
| src/quick-chat-client.js:106 | updateConnection | PATCH | /v1/account/agent-connections/{id} | client module |
| src/quick-chat-client.js:119 | revokeConnection | DELETE | /v1/account/agent-connections/{id} | client module |
| src/quick-chat-client.js:108 | connectionActivity | GET | /v1/account/agent-connections/{id}/activity?(query) | client module |
| src/cloud-client.js:395 | request (spending confirmation) | POST | /v1/account/spending-confirmations | client module |
| src/SpendingSettings.jsx:152 | load | GET | /v1/account/spending-settings | written in place |
| src/SpendingSettings.jsx:231 | save | PUT | /v1/account/spending-settings | written in place |
| src/TermsGate.jsx:41 | accept | POST | /v1/account/terms | written in place |
| src/cloud-client.js:520 | apiKeys | GET | /v1/api-keys | client module |
| src/cloud-client.js:521 | createApiKey | POST | /v1/api-keys | client module |
| src/cloud-client.js:522 | revokeApiKey | DELETE | /v1/api-keys/{keyId} | client module |
| src/AllSettings.jsx:34 | readEach | GET | /v1/legal/policy | written in place |
| src/AllSettings.jsx:58 | read | GET | /v1/legal/policy | written in place |

### Credits and billing

| File | Function | Method | Path | Where |
|---|---|---|---|---|
| src/CreditsUI.jsx:275 | checkout | POST | /v1/billing/checkout | written in place |
| src/AllSettings.jsx:33 | readEach | GET | /v1/billing/packs | written in place |
| src/CreditsUI.jsx:219 | CreditsDialog load | GET | /v1/billing/packs | written in place |
| src/PublicPages.jsx:71 | PricingPage | GET | /v1/billing/packs | written in place |
| src/CreditsUI.jsx:219 | CreditsDialog load | GET | /v1/billing/payments | written in place |
| src/CreditsUI.jsx:248 | after purchase | GET | /v1/billing/payments | written in place |
| src/CreditsUI.jsx:90 | read | GET | /v1/credits | written in place |
| src/CreditsUI.jsx:219 | CreditsDialog load | GET | /v1/credits | written in place |
| src/CreditsUI.jsx:240 | after purchase | GET | /v1/credits | written in place |
| src/StoryChat.jsx:666 | StoryChat effect | GET | /v1/credits | written in place |
| src/CreditsUI.jsx:219 | CreditsDialog load | GET | /v1/credits/entries | written in place |
| src/CreditsUI.jsx:246 | after purchase | GET | /v1/credits/entries | written in place |
| src/CreditsUI.jsx:292 | more | GET | /v1/credits/entries?cursor={log.next} | written in place |
| src/CreditsUI.jsx:219 | CreditsDialog load | GET | /v1/credits/prices | written in place |
| src/PublicPages.jsx:67 | PricingPage | GET | /v1/credits/prices | written in place |

### Feedback

| File | Function | Method | Path | Where |
|---|---|---|---|---|
| src/api/feedback.js:17 | sendFeedback | POST | /v1/feedback | client module |
| src/api/feedback.js:20 | readFeedbackSettings | GET | /v1/feedback/settings | client module |
| src/api/feedback.js:24 | saveFeedbackSettings | PATCH | /v1/feedback/settings | client module |

### Film

| File | Function | Method | Path | Where |
|---|---|---|---|---|
| src/story-film.js:125 | submit | POST | /v1/projects/{project}/films | written in place |
| src/story-film.js:120 | get | GET | /v1/projects/{project}/films/{run} | written in place |
| src/story-film.js:131 | cancel | POST | /v1/projects/{project}/films/{run}/cancel | written in place |
| src/story-film.js:133 | resume | POST | /v1/projects/{project}/films/{run}/resume | written in place |
| src/story-film.js:119 | preflight | POST | /v1/projects/{project}/films/preflights | written in place |

### Voice

| File | Function | Method | Path | Where |
|---|---|---|---|---|
| src/cloud-controller.js:1933 | speakLine | POST | /v1/projects/{ctx.projectId}/speech | written in place |
| src/cloud-controller.js:1952 | designVoice | POST | /v1/projects/{ctx.projectId}/voice-designs | written in place |
| src/cloud-controller.js:1963 | keepVoiceDesign | POST | /v1/projects/{ctx.projectId}/voice-designs/keep | written in place |
| src/cloud-controller.js:1927 | readVoices | GET | /v1/voices | written in place |

### Projects and storyboard

| File | Function | Method | Path | Where |
|---|---|---|---|---|
| src/cloud-client.js:492 | createProject | POST | /v1/projects | client module |
| src/cloud-client.js:490 | projects | GET | /v1/projects?limit={limit}&offset={offset} | client module |
| src/cloud-controller.js:1842 | previewScriptWindows | POST | /v1/projects/{ctx.projectId}/shots/{shotId}/script-windows/preview | written in place |
| src/cloud-controller.js:1870 | readTakeReviewSummaries | GET | /v1/projects/{ctx.projectId}/shots/{shotId}/take-reviews | written in place |
| src/cloud-controller.js:2216 | workbenchAbandonClosed | GET | /v1/projects/{ctx.projectId}/storyboard/preflights/{id} | written in place |
| src/trash-provider.jsx:101 | completed | GET | /v1/projects/{current.project.id} | written in place |
| src/Library.jsx:458 | chooseDestination | GET | /v1/projects/{id} | written in place |
| src/story-chat-client.js:450 | rename | POST | /v1/projects/{project}/actions | client module |
| src/cloud-client.js:493 | project | GET | /v1/projects/{projectId} | client module |
| src/cloud-client.js:495 | saveProject | PUT | /v1/projects/{projectId} | client module |
| src/cloud-controller.js:2110 | workbenchCommand | POST | /v1/projects/{projectId}/actions | written in place |
| src/library-commands.js:144 | execute | POST | /v1/projects/{projectId}/actions | written in place |
| src/cloud-client.js:525 | projectActivity | GET | /v1/projects/{projectId}/activity?limit=&before_version= | client module |
| src/cloud-client.js:509 | saveFrame | POST | /v1/projects/{projectId}/artifacts/{artifactId}/frames | client module |
| src/cloud-client.js:523 | projectMeta | GET | /v1/projects/{projectId}/meta | client module |
| src/cloud-controller.js:1833 | workbenchRead | GET | /v1/projects/{projectId}/shots/{id}/versions?limit=20&offset= | written in place |
| src/cloud-client.js:501 | generationDraft | GET | /v1/projects/{projectId}/shots/{shotId}/generation-draft | client module |
| src/cloud-client.js:503 | savedPlan | POST | /v1/projects/{projectId}/shots/{shotId}/generation-plans | client module |
| src/cloud-controller.js:1863 | readTakeReview | GET | /v1/projects/{projectId}/shots/{shotId}/takes/{artifactId}/review | written in place |
| src/cloud-controller.js:2042 | saveTakeReview | PATCH | /v1/projects/{projectId}/shots/{shotId}/takes/{artifactId}/review | written in place |
| src/cloud-controller.js:2110 | workbenchCommand | POST | /v1/projects/{projectId}/storyboard/preflights | written in place |
| src/cloud-controller.js:2110 | workbenchCommand | PATCH | /v1/storyboard/preferences | written in place |
| src/cloud-controller.js:2244 | workbenchPreferences | GET | /v1/storyboard/preferences | written in place |

### Assets and media

| File | Function | Method | Path | Where |
|---|---|---|---|---|
| src/audio-peaks.js:50 | decode | GET | (asset or artifact content URL) | written in place |
| src/video-cache-core.js:150 | checkAccess | HEAD | (asset or artifact content URL) | written in place |
| src/video-cache-core.js:207 | readFull | GET | (asset or artifact content URL) | written in place |
| src/cloud-client.js:568 | download | GET | (content path given by the caller, as a blob) | client module |
| src/story-film.js:135 | download | GET | /v1/artifacts/{artifact}/content?download=true | written in place |
| src/cloud-client.js:533 | upload | POST | /v1/assets | client module |
| src/cloud-client.js:536 | assets | GET | /v1/assets?client_project_id={projectId} | client module |
| src/cloud-client.js:535 | asset | GET | /v1/assets/{assetId} | client module |
| src/cloud-client.js:540 | derivative | POST | /v1/assets/{assetId}/derivatives | client module |
| src/cloud-client.js:538 | resumeAsset | POST | /v1/assets/{assetId}/resume | client module |
| src/cloud-controller.js:236 | installMedia | GET | /v1/assets/{id}/content or /v1/artifacts/{id}/content (blob) | written in place |
| src/cloud-client.js:537 | storageUsage | GET | /v1/storage-usage | client module |

### Generation, jobs and batches

| File | Function | Method | Path | Where |
|---|---|---|---|---|
| src/cloud-client.js:553 | activitySummary | GET | /v1/activity-summary?client_project_id={projectId} | client module |
| src/cloud-client.js:557 | batch | POST | /v1/batches | client module |
| src/cloud-controller.js:2110 | workbenchCommand | POST | /v1/batches | written in place |
| src/cloud-client.js:563 | batches | GET | /v1/batches?client_project_id={projectId}&limit={limit}&offset={offset} | client module |
| src/cloud-client.js:564 | getBatch | GET | /v1/batches/{batchId} | client module |
| src/cloud-client.js:565 | cancelBatch | POST | /v1/batches/{batchId}/cancel | client module |
| src/cloud-client.js:499 | capabilities | GET | /v1/capabilities | client module |
| src/cloud-client.js:547 | enhancePlan | POST | /v1/enhance-plans | client module |
| src/cloud-client.js:514 | generationAvailability | GET | /v1/generation-availability | client module |
| src/cloud-client.js:545 | plan | POST | /v1/generation-plans | client module |
| src/quick-chat-client.js:31 | queuePosition | GET | /v1/generations/queue-position?(query) | client module |
| src/cloud-client.js:549 | submit | POST | /v1/jobs | client module |
| src/cloud-client.js:551 | jobs | GET | /v1/jobs?client_project_id={projectId}&limit={limit}&offset={offset} | client module |
| src/cloud-client.js:554 | job | GET | /v1/jobs/{jobId} | client module |
| src/cloud-client.js:566 | artifacts | GET | /v1/jobs/{jobId}/artifacts | client module |
| src/cloud-client.js:555 | cancel | POST | /v1/jobs/{jobId}/cancel | client module |
| src/cloud-client.js:546 | renderPlan | POST | /v1/render-plans | client module |

### Quick chat

| File | Function | Method | Path | Where |
|---|---|---|---|---|
| src/cloud-controller.js:2110 | workbenchCommand | PATCH | /v1/quick-chat/preferences | written in place |
| src/cloud-controller.js:2237 | workbenchCopies | GET | /v1/quick-chat/preferences | written in place |
| src/quick-chat-client.js:11 | preferences | GET | /v1/quick-chat/preferences | client module |
| src/quick-chat-client.js:12 | savePreferences | PATCH | /v1/quick-chat/preferences | client module |
| src/TakePreferencesSettings.jsx:18 | queryFn | GET | /v1/quick-chat/preferences | written in place |
| src/TakePreferencesSettings.jsx:23 | mutationFn | PATCH | /v1/quick-chat/preferences | written in place |
| src/quick-chat-client.js:10 | schema | GET | /v1/quick-chat/schema | client module |
| src/quick-chat-client.js:45 | createSession | POST | /v1/quick-chat/sessions | client module |
| src/quick-chat-client.js:33 | sessions | GET | /v1/quick-chat/sessions?(query) | client module |
| src/quick-chat-client.js:46 | session | GET | /v1/quick-chat/sessions/{id} | client module |
| src/quick-chat-client.js:47 | patchSession | PATCH | /v1/quick-chat/sessions/{id} | client module |
| src/quick-chat-client.js:57 | uploadMaterial | POST | /v1/quick-chat/sessions/{id}/assets | client module |
| src/quick-chat-client.js:60 | sessionAssets | GET | /v1/quick-chat/sessions/{id}/assets(assetId ? ?client_asset_id={assetId} : ) | client module |
| src/quick-chat-client.js:62 | resumeMaterial | POST | /v1/quick-chat/sessions/{id}/assets/{assetId}/resume | client module |
| src/quick-chat-client.js:77 | createCard | POST | /v1/quick-chat/sessions/{id}/cards | client module |
| src/quick-chat-client.js:80 | cards | GET | /v1/quick-chat/sessions/{id}/cards?(query) | client module |
| src/quick-chat-client.js:78 | card | GET | /v1/quick-chat/sessions/{id}/cards/{card} | client module |
| src/quick-chat-client.js:27 | again | POST | /v1/quick-chat/sessions/{id}/cards/{card}/again | client module |
| src/quick-chat-client.js:87 | reviseCard | POST | /v1/quick-chat/sessions/{id}/cards/{card}/revisions | client module |
| src/quick-chat-client.js:14 | takes | GET | /v1/quick-chat/sessions/{id}/cards/{card}/takes?(query) | client module |
| src/quick-chat-client.js:52 | saveMaterials | PUT | /v1/quick-chat/sessions/{id}/materials | client module |
| src/quick-chat-client.js:49 | materials | GET | /v1/quick-chat/sessions/{id}/materials?(query) | client module |
| src/quick-chat-client.js:90 | getPreflight | GET | /v1/quick-chat/sessions/{id}/preflights/{preflight} | client module |
| src/quick-chat-client.js:100 | importResult | POST | /v1/quick-chat/sessions/{id}/result-imports | client module |
| src/quick-chat-client.js:101 | getResultImport | GET | /v1/quick-chat/sessions/{id}/result-imports/{importId} | client module |
| src/quick-chat-client.js:85 | revision | GET | /v1/quick-chat/sessions/{id}/revisions/{revision} | client module |
| src/quick-chat-client.js:89 | preflight | POST | /v1/quick-chat/sessions/{id}/revisions/{revision}/preflights | client module |
| src/quick-chat-client.js:92 | submit | POST | /v1/quick-chat/sessions/{id}/revisions/{revision}/submissions | client module |
| src/quick-chat-client.js:29 | storyTransfer | GET | /v1/quick-chat/sessions/{id}/story-transfers/{transfer} | client module |
| src/quick-chat-client.js:93 | submission | GET | /v1/quick-chat/sessions/{id}/submissions/{submission} | client module |
| src/quick-chat-client.js:95 | cancelSubmission | POST | /v1/quick-chat/sessions/{id}/submissions/{submission}/cancel | client module |
| src/quick-chat-client.js:97 | retryItem | POST | /v1/quick-chat/sessions/{id}/submissions/{submission}/items/{item}/retry | client module |
| src/quick-chat-client.js:99 | resumeAdmission | POST | /v1/quick-chat/sessions/{id}/submissions/{submission}/resume-admission | client module |
| src/quick-chat-client.js:20 | sessionTakes | GET | /v1/quick-chat/sessions/{id}/takes?(query) | client module |
| src/quick-chat-client.js:26 | starTake | PATCH | /v1/quick-chat/sessions/{id}/takes/{take} | client module |
| src/quick-chat-client.js:28 | takeToStory | POST | /v1/quick-chat/sessions/{id}/takes/{take}/story | client module |
| src/quick-chat-client.js:64 | timeline | GET | /v1/quick-chat/sessions/{id}/timeline?(query) | client module |
| src/quick-chat-client.js:73 | turn | POST | /v1/quick-chat/sessions/{id}/turns | client module |
| src/quick-chat-client.js:74 | getTurn | GET | /v1/quick-chat/sessions/{id}/turns/{turn} | client module |
| src/quick-chat-client.js:76 | acknowledgeUnknown | POST | /v1/quick-chat/sessions/{id}/turns/{turn}/acknowledge-unknown | client module |
| src/LegacyQuickChatLink.jsx:29 | LegacyQuickChatLink | GET | /v1/quick-chat/sessions/{sessionId} | written in place |
| src/quick-chat-client.js:43 | actionHistory | POST | /v1/quick-chat/sessions/history/actions | client module |
| src/quick-chat-client.js:44 | historyAction | GET | /v1/quick-chat/sessions/history/actions/{id} | client module |
| src/quick-chat-client.js:42 | previewHistory | POST | /v1/quick-chat/sessions/history/preview | client module |

### Story chat

| File | Function | Method | Path | Where |
|---|---|---|---|---|
| src/story-chat-client.js:241 | ensure | POST | /v1/story-chats | client module |
| src/StoryChat.jsx:545 | refreshStories | GET | /v1/story-chats | written in place |
| src/cloud-controller.js:1999 | sendInkyMessage | POST | /v1/story-chats/{ctx.projectId}/turns | written in place |
| src/cloud-controller.js:2011 | undoInkyMessage | POST | /v1/story-chats/{ctx.projectId}/undo | written in place |
| src/StoryChat.jsx:594 | updateChat | PATCH | /v1/story-chats/{ident} | written in place |
| src/story-chat-client.js:231 | recovered | GET | /v1/story-chats/{project} | client module |
| src/story-chat-client.js:255 | attach | GET | /v1/story-chats/{project} | client module |
| src/story-chat-client.js:330 | open | GET | /v1/story-chats/{project} | client module |
| src/story-chat-client.js:425 | attachPhoto | GET | /v1/story-chats/{project} | client module |
| src/story-chat-client.js:442 | undo | GET | /v1/story-chats/{project} | client module |
| src/story-chat-client.js:458 | rename | GET | /v1/story-chats/{project} | client module |
| src/story-chat-client.js:475 | edit | GET | /v1/story-chats/{project} | client module |
| src/story-chat-client.js:515 | edit | GET | /v1/story-chats/{project} | client module |
| src/story-chat-stream.js:101 | storedTurn | GET | /v1/story-chats/{project} | written in place |
| src/story-chat-client.js:263 | attach | POST | /v1/story-chats/{project}/actions | client module |
| src/story-chat-client.js:506 | edit | POST | /v1/story-chats/{project}/actions | client module |
| src/story-chat-client.js:283 | drawPicture | POST | /v1/story-chats/{project}/images | client module |
| src/story-chat-client.js:334 | open | POST | /v1/story-chats/{project}/open | client module |
| src/story-chat-stream.js:119 | streamOrPlain | POST | /v1/story-chats/{project}/turns | written in place |
| src/story-chat-stream.js:113 | streamOrPlain | POST | /v1/story-chats/{project}/turns/stream | written in place |
| src/story-chat-client.js:434 | undo | POST | /v1/story-chats/{project}/undo | client module |
| src/cloud-controller.js:1910 | drawShotPicture | POST | /v1/story-chats/{projectId}/images | written in place |
| src/cloud-controller.js:1907 | drawShotPicture | POST | /v1/story-chats/{projectId}/open | written in place |
| src/cloud-controller.js:1898 | readPictureSettings | GET | /v1/story-chats/config | written in place |
| src/StoryChat.jsx:659 | StoryChat effect | GET | /v1/story-chats/config | written in place |

### Inky

| File | Function | Method | Path | Where |
|---|---|---|---|---|
| src/cloud-controller.js:1980 | readShotReadiness | GET | /v1/inky/readiness?(project and shot) | written in place |
| src/cloud-controller.js:1892 | refreshInky | POST | /v1/inky/refresh?(project and shot) | written in place |
| src/cloud-controller.js:1883 | readInkySuggestions | GET | /v1/inky/suggestions?(project and shot) | written in place |
| src/cloud-controller.js:2032 | ignoreInkySuggestion | POST | /v1/inky/suggestions/{id}/ignore?(project and shot) | written in place |
| src/cloud-controller.js:2022 | rewriteInkySuggestion | POST | /v1/inky/suggestions/{id}/rewrite?(project and shot) | written in place |

### Library

| File | Function | Method | Path | Where |
|---|---|---|---|---|
| src/library-commands.js:259 | list | GET | /v1/library?(query) | written in place |
| src/library-commands.js:144 | execute | POST | /v1/library/imports | written in place |
| src/library-commands.js:144 | execute (observe) | GET | /v1/library/imports/{operationId} | written in place |
| src/library-commands.js:265 | usage | GET | /v1/library/usage?(target) | written in place |

### Trash

| File | Function | Method | Path | Where |
|---|---|---|---|---|
| src/trash-commands.js:255 | list | GET | /v1/trash?limit=100&offset=&kind= | written in place |
| src/trash-commands.js:189 | execute | POST | /v1/trash/actions | written in place |
| src/trash-commands.js:189 | execute (observe) | GET | /v1/trash/actions/{operationId} | written in place |
| src/trash-commands.js:230 | preview | POST | /v1/trash/preview | written in place |

### Admin

| File | Function | Method | Path | Where |
|---|---|---|---|---|
| src/AdminConsole.jsx:23 | usePaged load (Audit) | GET | /v1/admin/audit?cursor= | written in place |
| src/AdminConsole.jsx:250 | AdminPricing | GET | /v1/admin/credits/prices | written in place |
| src/AllSettings.jsx:32 | readEach | GET | /v1/admin/credits/prices | written in place |
| src/StoryChatAdminSwitch.jsx:20 | loadPrices | GET | /v1/admin/credits/prices | written in place |
| src/StoryChatAdminSwitch.jsx:73 | savePrice | POST | /v1/admin/credits/prices | written in place |
| src/AllSettings.jsx:59 | read | GET | /v1/admin/provider-balances | written in place |
| src/AdminRevenue.jsx:23 | AdminRevenue | GET | /v1/admin/revenue?days=days | written in place |
| src/AllSettings.jsx:57 | read | GET | /v1/admin/settings-inventory | written in place |
| src/StoryChatAdminSwitch.jsx:31 | loadPrices | GET | /v1/admin/story-chat/settings | written in place |
| src/StoryChatAdminSwitch.jsx:44 | save | PUT | /v1/admin/story-chat/settings | written in place |
| src/StoryChatAdminSwitch.jsx:59 | save | GET | /v1/admin/story-chat/settings | written in place |
| src/AdminConsole.jsx:184 | update | POST | /v1/admin/support-views | written in place |
| src/support-view.js:48 | endSupportView | POST | /v1/admin/support-views/{view.id}/end | written in place |
| src/AdminConsole.jsx:23 | usePaged load (Users) | GET | /v1/admin/users?q=&cursor= | written in place |
| src/AdminConsole.jsx:63 | update | PATCH | /v1/admin/users/{user.id} | written in place |
| src/AdminConsole.jsx:63 | update | POST | /v1/admin/users/{user.id}/credits | written in place |

### Operator console, capacity (legacy)

| File | Function | Method | Path | Where |
|---|---|---|---|---|
| src/operator-client.js:15 | candidates | GET | /v1/operator/capacity/candidates?(query) | client module |
| src/operator-client.js:12 | catalog | GET | /v1/operator/capacity/catalog | client module |
| src/operator-client.js:13 | marketRefresh | POST | /v1/operator/capacity/market-refreshes | client module |
| src/operator-client.js:35 | drain | POST | /v1/operator/capacity/nodes/{nodeId}/drain | client module |
| src/operator-client.js:41 | extensionPreview | POST | /v1/operator/capacity/nodes/{nodeId}/extension-previews | client module |
| src/operator-client.js:43 | extend | POST | /v1/operator/capacity/nodes/{nodeId}/extensions | client module |
| src/operator-client.js:39 | manualReview | POST | /v1/operator/capacity/nodes/{nodeId}/manual-review | client module |
| src/operator-client.js:37 | stop | POST | /v1/operator/capacity/nodes/{nodeId}/stop | client module |
| src/operator-client.js:30 | offers | GET | /v1/operator/capacity/offers?(query) | client module |
| src/operator-client.js:44 | updatePolicy | PUT | /v1/operator/capacity/policy | client module |
| src/operator-client.js:32 | preview | POST | /v1/operator/capacity/previews | client module |
| src/operator-client.js:33 | start | POST | /v1/operator/capacity/starts | client module |
| src/operator-client.js:11 | state | GET | /v1/operator/capacity/state | client module |

### Operator console, dstack and admin

| File | Function | Method | Path | Where |
|---|---|---|---|---|
| src/p4-operator-client.js:74 | applyBilling | POST | /v1/operator/admin/billing/actions | client module |
| src/p4-operator-client.js:76 | billingActionByKey | GET | /v1/operator/admin/billing/actions/by-key?key={key} | client module |
| src/p4-operator-client.js:72 | previewBilling | POST | /v1/operator/admin/billing/previews | client module |
| src/p4-operator-client.js:67 | billingReferences | GET | /v1/operator/admin/billing/references?(query) | client module |
| src/p4-operator-client.js:21 | adminBudgets | GET | /v1/operator/admin/budgets?limit=&after_id= | client module |
| src/p4-operator-client.js:58 | updateBudget | PUT | /v1/operator/admin/budgets/{budgetId} | client module |
| src/p4-operator-client.js:56 | budgetAudit | GET | /v1/operator/admin/budgets/audit | client module |
| src/AdminHome.jsx:535 | AdminStats | GET | /v1/operator/admin/generation-stats?days=days | written in place |
| src/p4-operator-client.js:109 | hosts (admin) | GET | /v1/operator/admin/hosts?limit=&offset=&provider= | client module |
| src/p4-operator-client.js:128 | hostAudit | GET | /v1/operator/admin/hosts/audit?limit=&offset= | client module |
| src/p4-operator-client.js:135 | updateHostPolicy | POST | /v1/operator/admin/hosts/policy | client module |
| src/p4-operator-client.js:93 | adminJobs | GET | /v1/operator/admin/jobs?limit=&after_id= | client module |
| src/AdminHome.jsx:74 | load | GET | /v1/operator/admin/jobs?limit=100 | written in place |
| src/AdminHome.jsx:227 | cancel | POST | /v1/operator/admin/jobs/cancel | written in place |
| src/p4-operator-client.js:100 | cancelJobs | POST | /v1/operator/admin/jobs/cancel | client module |
| src/AdminHome.jsx:89 | merge | GET | /v1/operator/admin/spending-settings | written in place |
| src/AdminHome.jsx:651 | Limits | GET | /v1/operator/admin/spending-settings | written in place |
| src/AllSettings.jsx:31 | readEach | GET | /v1/operator/admin/spending-settings | written in place |
| src/CapacitySettings.jsx:245 | confirm | PUT | /v1/operator/admin/spending-settings | written in place |
| src/CapacitySettings.jsx:230 | check | POST | /v1/operator/admin/spending-settings/preview | written in place |
| src/p4-operator-client.js:21 | budgets | GET | /v1/operator/budgets?limit=&after_id= | client module |
| src/p4-operator-client.js:140 | stopImpact | GET | /v1/operator/dstack/{groups or nodes}/{target}/stop-impact | client module |
| src/DemandStartPanel.jsx:32 | save | PUT | /v1/operator/dstack/admin/demand-start | written in place |
| src/p4-operator-client.js:78 | adminPrices | GET | /v1/operator/dstack/admin/prices | client module |
| src/p4-operator-client.js:91 | updatePrice | PUT | /v1/operator/dstack/admin/prices/{profileId} | client module |
| src/p4-operator-client.js:89 | previewPrice | POST | /v1/operator/dstack/admin/prices/{profileId}/preview | client module |
| src/StartRulesPanel.jsx:208 | save | PUT | /v1/operator/dstack/admin/start-rules | written in place |
| src/StartRulesPanel.jsx:153 | loadRules | GET | /v1/operator/dstack/admin/start-rules?profile_id={profileId} | written in place |
| src/AllSettings.jsx:40 | readEach | GET | /v1/operator/dstack/admin/start-rules?profile_id={target.id} | written in place |
| src/StartRulesPanel.jsx:42 | load | GET | /v1/operator/dstack/admin/start-rules/history?profile_id={profileId} | written in place |
| src/StartRulesPanel.jsx:202 | check | POST | /v1/operator/dstack/admin/start-rules/preview | written in place |
| src/p4-operator-client.js:33 | adminState | GET | /v1/operator/dstack/admin/workspace | client module |
| src/AdminHome.jsx:85 | merge | GET | /v1/operator/dstack/admin/workspace?live=1 | written in place |
| src/AllSettings.jsx:35 | readEach | GET | /v1/operator/dstack/catalog | written in place |
| src/dstack-client.js:23 | catalog | GET | /v1/operator/dstack/catalog | client module |
| src/StartRulesPanel.jsx:139 | StartRulesPanel | GET | /v1/operator/dstack/catalog | written in place |
| src/p4-operator-client.js:136 | createGroup | POST | /v1/operator/dstack/groups | client module |
| src/p4-operator-client.js:145 | groupHold | POST | /v1/operator/dstack/groups/{groupId}/hold | client module |
| src/p4-operator-client.js:143 | groupStop | POST | /v1/operator/dstack/groups/{groupId}/stop | client module |
| src/p4-operator-client.js:138 | move | POST | /v1/operator/dstack/nodes/{nodeId}/group | client module |
| src/dstack-client.js:29 | hold | POST | /v1/operator/dstack/nodes/{nodeId}/hold | client module |
| src/p4-operator-client.js:141 | metrics | GET | /v1/operator/dstack/nodes/{nodeId}/metrics | client module |
| src/dstack-client.js:27 | stop | POST | /v1/operator/dstack/nodes/{nodeId}/stop | client module |
| src/dstack-client.js:24 | preview | POST | /v1/operator/dstack/previews | client module |
| src/dstack-client.js:25 | start | POST | /v1/operator/dstack/starts | client module |
| src/dstack-client.js:18 | state | GET | /v1/operator/dstack/state | client module |
| src/p4-operator-client.js:33 | state | GET | /v1/operator/dstack/workspace | client module |
| src/p4-operator-client.js:109 | hosts | GET | /v1/operator/hosts?limit=&offset= | client module |

### Other

| File | Function | Method | Path | Where |
|---|---|---|---|---|
| src/version-check.js:29 | check | GET | / (index.html, to compare the script name) | written in place |
