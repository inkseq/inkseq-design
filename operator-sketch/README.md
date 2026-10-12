# P4 operator sketch — review artifact

Related delivery issue: [inkseq/h3-studio #132](https://github.com/inkseq/h3-studio/issues/132), P4, and [#125](https://github.com/inkseq/h3-studio/issues/125). This standalone static artifact supersedes the earlier local mock for the current review. It is not the production application or a new system of record. No backend, API, schema, release, provider calls, rentals, job submissions or billing changes are included. All mock state is in memory and resets on reload; no credentials or private assets are used.

Open `index.html` directly, or serve this folder with a loopback static HTTP server. The current local review copy is served at `http://127.0.0.1:18997/`. The user approved v2 and authorized implementation after the eight refinements below. This static file remains a disconnected review artifact.

## Approved v2 refinements

- Stop warns when waiting FL/REF jobs would lose their last compatible ready/busy machine. Stopping rows and hourly cost stay visible until a terminal observation.
- Fictional per-offer availability is consumed once per batch; quantities spread across distinct stock slots. The live API's offers are advisory resource quotes, not pinnable physical machines; live starts require independent fresh previews and allocation journals.
- Group Add defaults to one machine. Find/Queue starts default to Ungrouped, which is also a move destination.
- Renting, downloading weights, loading model, ready and stopping/stopped are separate mock phases. Live process startup is not model-load evidence; an unavailable load observation must stay explicit.
- Keep-on remains visible at 760–1220 px by wrapping into a second row.
- Ended history shows runtime, total cost and videos; detail shows today's cost/videos beside generation statistics.
- Admin shows all account machines, stop controls and spend per account. Cross-account access must be separately authorized by the server.

## Review flows

1. **Start a batch:** header Start opens two removable configurations, one FL and one REF. Each binds model, GPU, mode, stock quote and machine count before confirmation. Delete a row to start one, copy a row or increase quantity for multiple independent machines. Inventory and queue entry points prefill their selected configuration; an existing machine can start another with its model/mode/GPU/group/lifetime policy. Quotes are freshly selected, not copied supplier instance identities. The sample shows one GPU per machine; multi-GPU rentals remain disabled pending qualification. `both` means a single serial FL/REF slot, never two concurrent outputs. Partial provider acceptance must report each original start separately in the eventual application, not imply an atomic rollback.
2. **Actionable groups:** group hourly sum, add machines, common keep-on and stop-all. The keep dialog identifies mixed existing policies before unifying them. Stop confirms affected machines/jobs and finishes accepted work/result saving before shutdown; queued jobs are retained. Machine details allow moving between same-owner groups without changing configuration or tasks. The mock may illustrate these actions but does not execute them.
3. **Lifetime:** idle stop, keep until a future time (then idle stop), and until manually stopped. Preserve edited duration/time when changing choices. The third policy is already live in backend #141; it is not a newly invented finite hard deadline. Hourly price and cumulative account spend caps still apply. Sketch validation is illustrative, not a replacement for server checks.
4. **Queue:** FL and REF waiting counts, current job-to-machine links, rough time until next/last waiting task **starts**, and matching Add capacity entry points. Estimates adapt to dedicated ready/busy capacity and comparable example durations. Preparing/stopping/ended records do not create available slots. Shared unassigned FL/REF slots appear once in a separate note; they do not independently promise an immediate start to both queues. No compatible slot -> waiting for preparation/capacity, not zero wait. Actual integration must use frozen job profiles, owner eligibility, current assignments, shared-slot allocation and missing telemetry states.
5. **Creator/admin separation:** creator defaults to owned groups, concise ready/preparing/running/cost summaries and clean ended history. Original-request uncertainty, manual reviews and invoice reconciliation live in a separate administrator area. This static demo uses a fictional administrator account to illustrate both views; actual authentication/authorization stays server-owned. Administrative archival never deletes original rows or settles unknown bills.
6. **Performance details:** mean seconds/video, estimated generation cost/video, comparable sample count/window, heat state and stage breakdown; no samples -> unavailable, not zero. All figures and stock ages on this page are explicitly fictional examples, not newly fetched provider/Grafana evidence.

## Existing telemetry mapping for later implementation

Use the existing Grafana Cloud structured stage events and current business records; no additional metrics database. In current backend source:

- `studio_platform/telemetry.py`: stage histograms label stage/provider/profile/mode/GPU/warmth/outcome. Machine/job/attempt IDs and width/height/frame count/steps are structured log/trace attributes, **not** histogram labels. Per-machine comparable means require filtering those events and deduplicating original task/attempt/stage observations. Do not present the current dashboard median/p95 as an average.
- `deploy/observability/README.md`: `generate` includes remote submission transport and terminal polling. Label the UI **average generation time**, not pure denoising speed. `end_to_end` means acceptance to committed, validated/downloadable output and includes queue time; it is a separate duration.
- Match exact recipe/profile, mode, dimensions, frame count, steps, provider/GPU and warm/cold cohort. Exclude simulation and failures from successful-output averages; missing stages are unavailable, not zero. For `both`, retain separate FL/REF cohorts. Display sample count; single samples are observations, not stable predictions.
- No existing per-video supplier-charge metric is assumed. This mock uses `mean generate seconds × current quoted hourly price / 3600`, labeled **estimated generation cost**. It excludes startup, idle, storage and transfer. Future historical aggregation can instead match each attempt's actual quote and duration, then average; an approved price ceiling is not a supplier quote. Invoice settlement remains administrator-only in the existing accounting ledger.

Remaining production telemetry coverage, average queries, truthful quote availability and queue-estimate integration remain within #132. This static step does not claim those are fully implemented or measured.
