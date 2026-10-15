# Sixnine design sources

- Read the backend repository's current `AGENTS.md` as the single short entry, then the assigned issue's latest owner comments/claims. Read `SOURCE-README.md` and other contracts only for the affected task. Keep one shared inkseq Project. Apply #200 risk tiers, the two-hour no-direction time-box, Chinese owner handoffs of about10lines and the backend `workflow/owner-changes.md`; GitHub technical content remains English.
- Canonical source: `studio-app/`; approved Quick Chat UX: `quick-chat-mock/`. Do not edit the backend `yingxu/` snapshot directly or synchronize it without applicable frontend publication approval.
- Use a dedicated branch/worktree per concurrent session. Preserve other sessions' changes. Agents open, verify and merge authorized PRs; the user does not perform routine manual PR work.
- Work in related batches and run affected checks once at the end. Low-risk UI/docs need no independent review, live GPU or private evidence file; one live browser check is sufficient. Source preservation is distinct from UX acceptance and actual release. After #195, use staging and promote the same accepted version to production.
- Backend, Worker and GPU lifecycle stay in `h3-studio`; do not duplicate their state machines in the browser.
- Keep credentials, connection codes, private prompts/media, caches and node_modules out of Git. Use the central AI Registry only for internal provider integration; external users do not require it.
- New sessions continue G1/G2 from the preserved implementation, not a fresh redesign. Missing service capability must be explicit to users.
