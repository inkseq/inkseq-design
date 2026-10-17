# Public progress preview (#251)

This is a separate static progress host. It is not staging acceptance or production.
The view imports the actual canonical `src/main.jsx`, App, page components and styles.
The initial source snapshot is `68a3b5738cc896a976b9d0ee4c512f83d5d9ef89`: base a624b082 plus the11 canonical component WIP files captured without modifying the source worktree/index.

Only curated fictional project/profile/image fixtures are provided. Quick Create has an empty conversation; GPUs and Trash have synthetic empty states. No live generation, assistant call, upload, sign-in, credential, budget mutation, rental or deletion works. Seven-page visual parity is still incomplete; this site makes no acceptance claim.

Before importing the app, bootstrap installs memory-only storage, disables persistent media storage and form/file inputs, replaces fetch with an allowlisted in-memory GET transport (no network fallback), and rejects every write. Early CSP blocks all script network connections; other resource types are same-origin/blob/data only. A build-only adapter gives the actual root-path router a Pages prefix; the production router/source remain unchanged. Known real routes receive static HTML entry files for refresh. Story/session/shot queries remain ordinary query parameters.

## Update a completed page

1. Root completes/reviews the page in its canonical worktree. Record the source checkpoint in #251.
2. In this isolated preview branch, copy only the reviewed canonical source checkpoint (and paired locked dependency manifests if needed); never copy a DB, .env, generated series tree, browser storage or user media. Preserve the canonical index/WIP.
3. Update the source snapshot identifier in preview config, keep synthetic fixtures and fail-closed transport, and run `node --test progress-preview/transport.test.js`.
4. Commit/push this preview branch. Its independent Pages workflow checks, builds and publishes static files only; it has no AWS/provider secrets or release permissions.
5. Open the exact `https://inkseq.github.io/sixnine-design/p251/<preview-commit>/` URL and check the changed page, mobile, navigation/Back/refresh and network boundary. Update the existing #251 progress comment with page, source revision and working URL.

Hashed assets and a new commit path avoid reusing cached HTML. The stable project root links to the newest snapshot. Only the latest snapshot is hosted by each deployment; GitHub history retains source checkpoints. No Service Worker is installed. Formal acceptance and promotion continue through the separate staging lane.

For a future custom domain, first configure the repository Pages domain, then set Namecheap CNAME `preview` to `inkseq.github.io.` (no repository suffix). This preview does not change DNS.

