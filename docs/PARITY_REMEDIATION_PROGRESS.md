# Parity remediation progress

## Durable execution goal

Continue implementing and verifying every required remediation in `docs/PARITY_GAP_DISSERTATION.md` until `tanstack-keystone-starter` reaches evidence-backed behavioral, schema-workflow, dashboard, auth, provider, accessibility, and visual parity with `next-keystone-starter`, with no known P0/P1 gaps and no false passing gates.

Goal tooling was not exposed in this session, so this file is the durable execution ledger. Do not mark the overarching goal complete until every dissertation release gate is green on current source.

## Operating constraints

- `docs/PARITY_GAP_DISSERTATION.md` is the controlling remediation specification.
- `READINESS.md` is authoritative but every claim must be re-verified before reuse.
- `/Users/junaid/Code/next-keystone-starter` is read-only.
- No Git commands, Portless, persistent dev servers, or persistent test databases.
- Every behavioral fix follows red -> minimal fix -> focused verification -> broader gate -> real browser evidence where UI is involved.

## Release-gate ledger

| Gap | Severity | Status | Current evidence | Next action |
| --- | --- | --- | --- | --- |
| GAP-01 Authoritative browser create matrix | P0 | IN PROGRESS | Current-source seeded/fresh/Prisma coverage is independently verified; a disposable source-copy fixture now discovers every creatable list from runtime AdminMeta and proves an arbitrary `Project` model through mutation/result/ID/UI+GraphQL reload. | Obtain independent review, then broaden arbitrary field/auth shapes and reproduce or bound the user-specific case before closure. |
| GAP-02 Runnable sibling target oracle | P0 | IN REVIEW | A disposable derived fixture now proves intended sibling route behavior without editing the source; Review 014 verified patch fidelity and requested lifecycle hardening, now submitted in checkpoint 015. | Await independent acceptance of the hardened lifecycle; retain the explicit direct-GraphQL-create and synthetic-default boundaries. |
| GAP-03 Real-ID responsive overflow | P1 | IN REVIEW | Disposable Prisma reproduced 481px document width at 390px from a real CUID ID card; min-content sizing and token wrapping were repaired, and two full matrices now pass at 390px. | Await independent checkpoint review; retain realistic-ID overflow diagnostics in the browser gate. |
| GAP-04 Client abort handling | P1 | IN REVIEW | Nine real Firefox in-flight requests now correlate `NS_BINDING_ABORTED` outcomes to request IDs and authoritative Nitro disconnect state; genuine correlated faults retain JSON 500/log behavior. | Await independent checkpoint 015 acceptance; do not broaden suppression beyond recognized transport errors plus live abort state. |
| GAP-05 Advanced documents | P1 | IN REVIEW | Checkpoint 024 proves isolated PostgreSQL-backed Firefox UI plus raw GraphQL/PostgreSQL persistence for layout nodes, component blocks/nested props, and inline relationships, including update/reload and rollback assertions. | Await independent oversight rerun; retain the explicit fixture/runtime boundaries. |
| GAP-06 Custom `ui.views` loading | P1 | IN REVIEW | Checkpoint 023 freezes generated custom Field/Cell/CardValue/controller loading with distinct browser and focused-contract evidence. | Await checkpoint 023 review; retain custom package/deployment boundaries. |
| GAP-07 Field-zoo dashboard coverage | P1/P2 | IN REVIEW | Checkpoint 023 proves exact mutation/UI/raw reload across scalar/document/relationship kinds in an isolated Firefox fixture; image/file are explicitly hidden/read-only in this boundary. | Await checkpoint 023 review; retain editable upload and broader Prisma field-zoo boundaries. |
| GAP-08 Relationship/nested writes | P1 | IN REVIEW | Checkpoint 024 proves inline and component-block relationship IDs/labels, ownership/cardinality behavior, invalid nested-write rollback, and disposable PostgreSQL cleanup. | Await independent oversight rerun; do not broaden beyond the isolated Article/Author matrix without new evidence. |
| GAP-09 Auth/session/reset continuity | P1 | IN REVIEW | Replacement checkpoint 020 freezes reset non-enumeration, stale-report failure semantics, exact cleanup, and the two-process disposable-PostgreSQL continuity matrix at one stable hash. | Await checkpoint 020 review; retain external/multi-instance/revocation boundaries without implying closure. |
| GAP-10 Storage/provider continuity | P1 | IN REVIEW / EXTERNAL PARTIAL | Checkpoint 027 freezes bounded local SigV4/object-size/hanging-provider/multipart/orphan-rollback and SMTP delivery/retry/failure/timeout evidence at aggregate `10a4fd53…`; cleanup and concrete-value redaction checks pass. | Await checkpoint 027 review; real credentials, buckets/objects, external SMTP/network deliverability, distributed retries, staging, and production cutover remain external. |
| GAP-11 Dashboard states/visual/a11y | P1-P3 | IN PROGRESS | The established Firefox route/responsive gate passes; checkpoint 029 adds real field-label/control associations across built-in views, read-mode label correction, named AI controls, focused markup assertions, and a seeded Firefox confirmation/cancellation probe. | Independently rerun checkpoint 029, then add screen-reader, zoom, high-contrast/reduced-motion, complete keyboard/focus, and remaining route-state coverage. |
| GAP-12 AI/MCP parity | P1 | IN REVIEW | Accepted checkpoint 026 secures MCP transport/tool behavior. Checkpoint 029 now wires the completion route and AI sidebar to metadata-derived create/update/delete proposals, explicit accessible Confirm/Cancel review, generated-operation MCP execution, query invalidation, and secret-summary redaction. | Independently review checkpoint 029; retain natural-language/model-provider integration, signed/durable approval state, multi-instance audit storage, and external deployment boundaries. |
| GAP-13 Consumer runtime portability | P1 | IN PROGRESS | Accepted bounded checkpoint 025 proves disposable two-profile `opensource.builders`/`os.org` generation, migration, auth, exact rendered dashboard paths/content, domain CRUD/relationships, PostgreSQL persistence, dump/restore rollback, failure cleanup, and external post-finally restoration. | Prove real source access policies and production-shaped cutover; retain external-provider, production-data, and in-place-migration boundaries until executable evidence exists. |
| GAP-14 Safe schema-change loop | P2 | IN REVIEW | Replacement checkpoint 022 adds bounded exec/Docker/tar/Prisma/build/process calls and timeout/earliest-lifecycle probes to the full isolated state machine, with exact cache/artifact restoration. | Await checkpoint 022 review; retain the explicit non-browser CRUD boundary. |
| GAP-15 Hard-code audit | P2 | IN REVIEW | Checkpoint 031 adds an AST-based repository scanner with exact fingerprints for 300 starter literals across 47 classified demo/source-oracle files, fail-closed generic infrastructure rules, stale/unclassified detection, and bounded evidence bindings for arbitrary AdminMeta, UUID, autoincrement, mapped, and singleton fixtures. | Independently review checkpoint 031, then add real browser/database coverage for UUID/autoincrement/mapped/singleton shapes instead of promoting static bindings to closure. |
| GAP-16 Production/security/observability/performance/metadata | P1-P3 | IN PROGRESS | Checkpoint 030 adds bounded liveness/readiness, request IDs and redacted structured completion logs, production security headers, a declared GraphQL body limit, corrected metadata/manifest, deployment guidance, and an executable built-server gate. | Independently review checkpoint 030, then add Linux/container build, chunked/depth/complexity and load/pool budgets, metrics/tracing/alerts, production-sized migration timing, and staging rollback. |

## Execution log

### 2026-07-20 — Session start and evidence intake

- Read all 458 lines of `docs/PARITY_GAP_DISSERTATION.md` before changing code.
- Read all 164 lines of `READINESS.md`; identified the explicit contradiction between its mobile-pass claim and the dissertation's real-CUID overflow evidence. No readiness verdict has been changed.
- Confirmed goal APIs are not exposed and recorded the exact required objective above.
- Confirmed package stack from `package.json`: React 19.2, TanStack Start 1.168.28/Router 1.170.18, Prisma 7.8, GraphQL Yoga 5.21, Base UI 1.4.1, Slate 0.126, Vite 8, Vitest 4.1.5.
- First stop-the-line action: reproduce GAP-01 using the checked-in current-source browser command before implementation.

### 2026-07-20 — GAP-01 RED reproduced

- Ran `npm run test:dashboard:browser` unchanged. It rebuilt all current CMS/Nitro artifacts, started bounded memory/Firefox processes, and failed before create submission.
- Exact failure: Firefox WebDriver BiDi `move target out of bounds`, target `(970, 2019)` versus viewport `1440 × 2000`, from `clickNode` in `scripts/validate-dashboard-browser.mjs`.
- App log contained no resolver/create failure; process cleanup ran in the script's `finally` block. This confirms a harness-geometry failure, not an application-create verdict.
- Root harness defect: raw pointer movement assumes an element-origin target is already viewport-interactable. W3C WebDriver/WebDriver BiDi define interactability and element/shared-reference operations; the harness must scroll each target into the viewport before trusted pointer input rather than inflate the viewport.

### 2026-07-20 — GAP-01 harness regression and stable recovery

- Added per-command 30-second rejection to `BidiClient.command`, so an unresponsive BiDi command can no longer hold `waitFor` beyond its deadline.
- A trial of the current W3C `network.addDataCollector`/`network.getData` protocol regressed the gate: the first run was force-timed out at 240 seconds, leaving app PID 68856 and Firefox PID 68858 because the outer runner killed Node before its `finally`; those exact process groups and the matching temporary profile were explicitly removed. A second bounded run proved Firefox 152 never returned `network.getData` and failed after the new 30-second command timeout.
- Removed **all** data-collector/getData creation and calls. Repository search confirms no `network.addDataCollector`, `network.getData`, or `network.removeDataCollector` remains.
- Replaced that unsupported path with a scoped, same-origin browser `fetch` observer installed immediately before `DashboardCreate`. It preserves the original request/response, clones the GraphQL response for assertion, captures only dashboard-create operations (not signin), verifies request variables, HTTP 200, no GraphQL errors, and returned ID, and restores the original `fetch` in `finally`.
- Retained the independently proven scroll-into-view fix and trusted BiDi pointer input. No inflated viewport patch is used.
- Focused proof: `node scripts/validate-dashboard-browser.mjs` passed with captured `createTodo` payload/result, persisted item reload, rich document and relationship flow, mobile overflow assertion, control names, keyboard focus, and zero unexpected request/response/console errors.
- Clean-build proof 1: `rm -rf .output && npm run test:dashboard:browser` passed.
- Clean-build proof 2: `rm -rf .output && npm run test:dashboard:browser` passed again independently.
- Post-run cleanup check found no matching Node app, Firefox test process, or `tks-firefox-*` profile. `npx prettier --check scripts/validate-dashboard-browser.mjs docs/PARITY_REMEDIATION_PROGRESS.md` passed.
- GAP-01 remains **IN PROGRESS**, not green: these runs still cover seeded-memory Todo only.

### 2026-07-20 — REVIEW CHECKPOINT READY 001: seeded-memory all-list create foundation

**Claim boundary:** ready for independent review, not self-certified. GAP-01 and GAP-04 remain open overall; `READINESS.md` is unchanged. This checkpoint covers the current-source seeded-memory browser slice only.

**Exact changed files:**

- `scripts/validate-dashboard-browser.mjs`
- `package.json`
- `src/server/error-handler.ts`
- `src/server/nitro-plugin.ts`
- `tests/nitro-error-handler.test.ts`
- `vite.config.ts`
- `docs/PARITY_REMEDIATION_PROGRESS.md`

**Oversight findings addressed:**

- Read `docs/PARITY_REMEDIATION_OVERSIGHT.md` Review 001 completely before checkpointing.
- Todo create now asserts submitted label, heading document structure/content, and initial `assignedTo.connect.id`; then reloads the returned-ID route and asserts label, heading content, and Ada relationship **before** any update. A raw persisted GraphQL query independently checks the same create-time label/document/relationship.
- The scoped fetch observer now returns the original `Response` immediately. Response-clone parsing runs asynchronously and is bounded by the existing wait/command deadlines.
- A deliberate captured-action failure proves the original `fetch` identity is restored and both observer globals are deleted while the browser context remains alive.
- Direct script invocation now fails with an instruction to use the package gate; `npm run test:dashboard:browser` sets an explicit current-build marker only after `npm run build`.
- The first attempted formal checkpoint correctly failed and was discarded when the intermittent Nitro/H3 response-close `AbortError` recurred. Root-cause evidence showed H3 can log the srvx `ServerResponse` close abort before Nitro error handling. The final implementation classifies only request-disconnected AbortErrors or the exact srvx response-close stack, maps those to 499, keeps genuine/context-free errors reportable through Nitro's official error hook, and narrowly suppresses only the one-argument framework response-close abort log. It does not suppress arbitrary AbortErrors or multi-argument application logs.
- Framework grounding: Nitro custom error handler/plugin lifecycle (`https://nitro.build/docs/lifecycle`, `https://nitro.build/docs/plugins`) and srvx's client-abort handling source (`https://github.com/h3js/srvx/pull/209`).

**Exact checkpoint source hash:**

- Aggregate SHA-256 over the six implementation/config/test files above (excluding this mutable ledger): `4a9cb7771e56fd6001707e8c7e4398aa89907e97232b00a0d7b7ed591df3ef18`.
- Both formal clean-build passes recomputed this same hash after execution; no implementation file changed between passes.

**Claimed commands/evidence:**

1. `npx vitest run tests/nitro-error-handler.test.ts` — 1 file, 8 tests passed; expected disconnect, response-close signature, genuine error, and 499 behavior covered.
2. Exploratory stress from the immediately preceding current build: five consecutive bounded `DASHBOARD_BROWSER_CURRENT_BUILD=1 node scripts/validate-dashboard-browser.mjs` runs passed. This is flake diagnostics, not promoted to current-source acceptance.
3. Formal pass 1: `rm -rf .output && npm run test:dashboard:browser` — passed at checkpoint hash `4a9cb7…`; Role/User/Todo Image/Todo create requests and responses observed, returned IDs matched routes, values persisted after reload, Todo create-time document/relationship persisted before update, later rich update/relationship-card flow passed, and browser network/console checks were clean.
4. Formal pass 2: the exact same `rm -rf .output && npm run test:dashboard:browser` — passed at the identical checkpoint hash with the same assertions.
5. `npm test` — 38 files, 138 tests passed.
6. `npm run lint` — passed with no reported errors/warnings.
7. `npx tsc --noEmit` — passed.
8. `npx prettier --check scripts/validate-dashboard-browser.mjs package.json src/server/error-handler.ts src/server/nitro-plugin.ts tests/nitro-error-handler.test.ts vite.config.ts docs/PARITY_REMEDIATION_PROGRESS.md` — passed before this ledger append; implementation files remain formatted.
9. Post-pass process/profile inspection — no matching browser-test Node process, Nitro app process, Firefox test profile process, or `tks-firefox-*` directory remained.

### Non-overlapping preparation while review 001 is pending

- Re-verified `cms.config.ts` fresh-init item data creates an Admin role with all permissions needed for Role/User/Todo/TodoImage creates; this is evidence to drive the fresh browser matrix, not a runtime pass.
- Re-verified all eight checked-in Prisma migrations are available and `prisma.config.ts` points `migrate deploy` at them.
- Confirmed the pre-existing bounded database backend `vibe-runtime-postgres` is PostgreSQL 17, listens on loopback port 5432, uses local user `junaid`, and is ready. No container was started or reconfigured.
- Ran a disposable lifecycle probe with a unique `tks_parity_probe_<timestamp>_<pid>` database: create, connect/query, forced drop, and absence check all passed. The named probe database was removed.
- No checkpoint implementation file was changed during this preparation.

### 2026-07-20 — REVIEW CHECKPOINT READY 002: Review 002 blocker remediation

**Claim boundary:** ready for independent review, not self-certified. GAP-01 and GAP-04 remain open overall; `READINESS.md` is unchanged. This checkpoint remediates Review 002 blockers for the seeded-memory/error-evidence foundation only.

**Exact changed files:**

- `scripts/validate-dashboard-browser.mjs`
- `scripts/validate-nitro-error-runtime.mjs`
- `package.json`
- `src/server/error-handler.ts`
- `src/server/nitro-plugin.ts`
- `src/server/parity-fault-handler.ts`
- `src/server/parity-fault-state.ts`
- `tests/nitro-error-handler.test.ts`
- `vite.config.ts`
- `docs/PARITY_REMEDIATION_PROGRESS.md`

**Review 002 blockers addressed:**

- Read Review 002 completely before changing checkpoint code.
- Removed the process-global `console.error` replacement and removed all stack-based suppression helpers. Repository search finds no `console.error =`, `shouldSuppressExpectedAbortLog`, or `isNodeResponseCloseAbort` implementation.
- Disconnect classification now requires both a narrowly recognized transport error (`AbortError`, or Node HTTP `ECONNRESET` with exact message `aborted`) and live request-disconnect state. Destroyed sockets count only when request/response completion flags prove premature closure. A reviewer-style application-originated synthetic stack remains reportable.
- Added bounded production-output fault injection. The genuine injected exception retains Nitro's default JSON HTTP 500 (`error: true`, `status: 500`, `unhandled: true`) and emits `[cms][server-error]` with the controlled marker. A raw Node HTTP request is allowed to enter the handler, then its real socket is destroyed; the Nitro error hook observes `HTTPError` / `aborted` / `cause.code=ECONNRESET`, `signalAborted=true`, `requestAborted=true`, `responseDestroyed=true`, `responseWritableFinished=false`, and classifies only that live disconnect as quiet.
- Fault-route inclusion is build-time conditional on `CMS_PARITY_FAULT_INJECTION_BUILD=1`. Ordinary builds are independently checked by scanning every emitted server `.mjs` file for the fault marker and requesting the route to assert HTTP 404. The two formal browser builds omitted the route; no always-registered production test endpoint remains.
- User reload now asserts UI and raw persisted `name`, `email`, and returned ID, then authenticates over production HTTP with the submitted password and asserts `UserAuthenticationWithPasswordSuccess` for that ID.
- Todo Image reload now asserts UI and raw persisted `imagePath`, `altText`, and returned ID.
- The GraphQL observer now explicitly requires `url.origin === location.origin`.
- Added bounded browser network-idle tracking around explicit navigation. Both formal runs completed with zero navigation aborts rather than relying on cancellation filtering.

**Exact checkpoint source hash:**

- Aggregate SHA-256 over the nine implementation/config/test files above (excluding this mutable ledger): `6f0c30798478a9a038dcb3087a291eb7b2507036c4037c86a1737da90e4977e8`.
- Both formal clean-build browser passes recomputed this identical hash after execution.

**Claimed commands/evidence:**

1. RED proof: `npx vitest run tests/nitro-error-handler.test.ts` failed because the old generic stack classifier incorrectly accepted an application-originated synthetic stack.
2. `npx vitest run tests/nitro-error-handler.test.ts` — 10/10 passed after removing stack suppression and adding live-state/ECONNRESET/completion guards.
3. Initial `npm run test:nitro:errors` correctly failed and exposed the actual production hook error as `Error: aborted` with `cause.code=ECONNRESET`; it was not loosened based on guesswork.
4. Final `npm run test:nitro:errors` — passed after a conditional fault build. Genuine fault preserved JSON 500 plus visible log. Raw socket disconnect reached the error hook with the exact state above and emitted no `server-error`, `AbortError`, `unhandled`, or controlled-fault marker after the disconnect boundary. The bounded app process was terminated in `finally`.
5. Formal browser pass 1: `rm -rf .output && npm run test:dashboard:browser` — passed at hash `6f0c30…`; 1,376 observed events, zero navigation aborts, zero unexpected browser request/response/console errors, all submitted current-list values checked after reload, and ordinary output fault-route omission asserted.
6. Formal browser pass 2: the identical command passed at the identical hash with the same 1,376-event/zero-abort result.
7. `npm test` — 38 files, 140 tests passed.
8. `npm run lint` — passed with no reported errors/warnings.
9. `npx tsc --noEmit` — passed.
10. Focused Prettier check over all nine checkpoint files — passed.
11. Independent ordinary-output scan: no `PARITY_TEST_GENUINE_SERVER_ERROR` or `/__parity/fault` marker exists under `.output/server` after the ordinary build.
12. Post-pass inspection found no matching browser harness, Nitro fault harness, app server, Firefox test process, or `tks-firefox-*` profile.

### 2026-07-20 — REVIEW CHECKPOINT READY 003: Review 003 blocker remediation

**Claim boundary:** ready for independent review, not self-certified. GAP-01 and GAP-04 remain open; `READINESS.md` is unchanged. This checkpoint only removes Review 003's classifier/artifact blockers and normal-build test instrumentation.

**Exact changed files:**

- `scripts/validate-dashboard-browser.mjs`
- `scripts/validate-nitro-error-runtime.mjs`
- `package.json`
- `src/server/error-handler.ts`
- `src/server/nitro-plugin.ts`
- `src/server/parity-fault-handler.ts`
- `src/server/parity-fault-plugin.ts`
- `src/server/parity-fault-state.ts`
- `tests/nitro-error-handler.test.ts`
- `vite.config.ts`
- `docs/PARITY_REMEDIATION_PROGRESS.md`

**Review 003 findings addressed:**

- Read Review 003 completely before modifying the checkpoint.
- Removed request/response-destroyed fallback classification entirely. `requestDisconnectState().disconnected` now depends only on the authoritative flags observed in the real production hook: `event.req.signal.aborted` or Node `req.aborted`. Destroyed/completion fields remain diagnostics only and cannot silence an error.
- Added the independent counterexample as a regression: an application `AbortError` with both authoritative abort flags false and only an unfinished destroyed response must be reported. The test failed before the classifier fix and passes afterward.
- Retained the independently observed transport requirement: only `AbortError`, or exact Node HTTP `ECONNRESET` + `aborted`, can be considered, and only when an authoritative abort flag is true.
- `test:nitro:errors` now owns its conditional build. Its single `try/finally` stops the app and recursively removes `.output` on both success and failure, then asserts the server entry is absent.
- Added and executed a forced post-build failure probe. It exited nonzero as intended and proved `.output` was absent afterward. The normal gate subsequently passed and also left `.output` absent.
- Split fault observation into `parity-fault-plugin.ts`, which is included only in explicit fault-test builds alongside the conditional route. The ordinary plugin no longer imports or allocates parity state.
- Ordinary browser builds scan all emitted server modules and reject the fault marker, route state identifiers, or fault environment identifiers; they also assert the route returns HTTP 404. Independent post-build scan confirms ordinary output omits both the route and observation bookkeeping.

**Exact checkpoint source hash:**

- Aggregate SHA-256 over the ten implementation/config/test files above (excluding this mutable ledger): `9e40b54ef5ad0a6aa8eba7ad47ef499c436d6fc5407f61e5ea9cb9e4aef56e3c`.
- Both formal clean-build browser passes recomputed this exact hash after execution.

**Claimed commands/evidence:**

1. RED proof: `npx vitest run tests/nitro-error-handler.test.ts` failed because destroyed unfinished response state alone was still classified as a disconnect.
2. `npx vitest run tests/nitro-error-handler.test.ts` — 11/11 passed after restricting classification to authoritative abort flags.
3. Failure-cleanup proof: `CMS_PARITY_FAULT_FORCE_FAILURE_AFTER_BUILD=1 node scripts/validate-nitro-error-runtime.mjs` exited 1 at the intentional probe and left `.output` absent.
4. `npm run test:nitro:errors` — passed at the checkpoint source. Genuine JSON 500/log behavior and raw-socket disconnect hook state remained intact; the gate's own `finally` left `.output` absent.
5. Exploratory ordinary `npm run test:dashboard:browser` — passed and rebuilt a non-fault output.
6. Formal browser pass 1: `rm -rf .output && npm run test:dashboard:browser` — passed at hash `9e40b5…`; 1,376 observed events, zero navigation aborts, zero unexpected browser request/response/console errors.
7. Formal browser pass 2: the identical command passed at the identical hash with the same result.
8. `npm test` — 38 files, 141 tests passed.
9. `npm run lint` — passed with no reported errors/warnings.
10. `npx tsc --noEmit` — passed.
11. Focused Prettier check over all ten checkpoint files — passed.
12. Ordinary-output scan found no fault marker, fault route, observation-state identifiers, or fault environment identifier.
13. Post-pass inspection found no matching browser harness, Nitro fault harness, app server, Firefox test process, or `tks-firefox-*` profile.

### 2026-07-20 — REVIEW CHECKPOINT READY 004: bounded build-timeout cleanup

**Claim boundary:** ready for independent review, not self-certified. GAP-01 and GAP-04 remain open; `READINESS.md` is unchanged. This checkpoint addresses Review 004's single process-lifecycle blocker and associated app-exit concern only.

**Exact files changed since checkpoint 003:**

- `scripts/validate-nitro-error-runtime.mjs`
- `scripts/fixtures/hanging-fault-build.mjs`
- `docs/PARITY_REMEDIATION_PROGRESS.md`

**Review 004 blocker addressed:**

- Replaced the build timer's fire-and-forget SIGTERM/reject path with a shared bounded detached-child runner.
- On timeout the runner sends process-group SIGTERM, waits a bounded grace period, sends process-group SIGKILL if any group member remains, awaits the child `close` result, and polls until the complete process group no longer exists before propagating timeout failure.
- `stopApp()` now uses the same termination primitive, including awaited close after SIGKILL and process-group absence verification.
- Added `scripts/fixtures/hanging-fault-build.mjs`, which deliberately ignores SIGTERM and continuously rewrites a fault-marked `.output`. The short probe forces TERM-to-KILL escalation without waiting for the production 180-second timeout.
- Executed the hanging probe: it exited nonzero with the explicit “TERM/KILL escalation completed and its process group exited” diagnostic; no fixture process group remained; the fault gate's outer `finally` removed `.output` after termination, so the fixture could not recreate it.
- Re-ran the normal production fault gate. Genuine JSON 500/log and authoritative raw disconnect behavior still passed; app termination was awaited; `.output` was absent afterward.

**Exact verification source hash:**

- Aggregate SHA-256 over the eleven implementation/config/test files participating in this checkpoint: `863fa37979b27c3d9939f5ad3e9b1a64166e12929147a351fbf61771423a0b53`.
- Both formal clean-build browser passes recomputed this exact hash after execution.

**Claimed commands/evidence:**

1. `CMS_PARITY_FAULT_HANGING_BUILD_PROBE=1 node scripts/validate-nitro-error-runtime.mjs` — intentionally exited 1 after a 300ms timeout, bounded TERM grace, SIGKILL escalation, awaited close, and process-group absence verification. External checks found no `hanging-fault-build.mjs` process and no `.output`.
2. `npm run test:nitro:errors` — passed; production fault semantics remained green and the gate left no app process or `.output`.
3. Exploratory `npm run test:dashboard:browser` — passed after rebuilding ordinary output.
4. Formal browser pass 1: `rm -rf .output && npm run test:dashboard:browser` — passed at hash `863fa3…`; 1,376 events, zero navigation aborts, zero unexpected browser request/response/console errors.
5. Formal browser pass 2: the identical command passed at the identical hash with the same result.
6. `npm test` — 38 files, 141 tests passed.
7. `npm run lint` — passed with no reported errors/warnings.
8. `npx tsc --noEmit` — passed.
9. Focused Prettier check — passed.
10. Ordinary-output scan still omits fault route, fault marker, and observation bookkeeping.
11. Post-pass inspection found no process belonging to this repository's browser/fault harness, app server, Firefox profile, or hanging-build fixture. A separately running `osorg` build was observed and intentionally left untouched.

### 2026-07-20 — REVIEW CHECKPOINT READY 005: fresh-memory/disposable-Prisma create matrix and real-ID responsive repair

**Claim boundary:** ready for independent review, not self-certified. This checkpoint adds current-list seeded/fresh/Prisma evidence and repairs the real-CUID responsive failure it exposed. GAP-01 and GAP-04 remain open, and `READINESS.md` is unchanged.

**Exact files changed since checkpoint 004:**

- `scripts/lib/bounded-child.mjs`
- `scripts/fixtures/nonzero-descendant.mjs`
- `scripts/validate-dashboard-browser.mjs`
- `scripts/validate-dashboard-browser-prisma.mjs`
- `scripts/validate-nitro-error-runtime.mjs`
- `package.json`
- `src/routes/dashboard/$listKey.$id.tsx`
- `src/routes/dashboard/$listKey.create.tsx`
- `docs/PARITY_REMEDIATION_PROGRESS.md`

**Review 005 finding addressed:**

- Extracted the bounded detached-child lifecycle into `scripts/lib/bounded-child.mjs` before reusing it for Prisma orchestration and browser cleanup.
- Nonzero leader exit now checks the entire process group and terminates surviving descendants before propagating failure.
- Added `scripts/fixtures/nonzero-descendant.mjs`: its leader exits 7 while a SIGTERM-resistant descendant remains in the same group. `CMS_PARITY_FAULT_NONZERO_DESCENDANT_PROBE=1 node scripts/validate-nitro-error-runtime.mjs` intentionally exited nonzero only after descendant TERM/KILL cleanup and group-absence verification; no fixture process or `.output` remained.
- Re-ran the existing hanging-leader probe after extraction; TERM/KILL escalation, awaited close, process-group absence, and `.output` cleanup remained green.
- Browser app/Firefox cleanup now uses the same awaited group-absence primitive rather than fire-and-forget signals.

**Fresh-memory and Prisma matrix evidence:**

- Parameterized the production browser harness into `seeded`, `fresh`, and `prisma` modes while retaining current-build enforcement, scoped GraphQL request/result capture, returned-ID route checks, raw persisted reload checks, network-idle tracking, accessibility, keyboard, and responsive assertions.
- Fresh mode first proves `/dashboard` redirects to `/dashboard/init`, submits `createInitialUser`, asserts submitted fields plus HTTP 200/no GraphQL errors/returned administrator ID, reaches an authenticated dashboard, then creates Role, User, Todo Image, and Todo. Relationship checks use runtime-created IDs rather than assuming seeded users.
- Prisma orchestration creates a unique `tks_parity_browser_<pid>_<timestamp>` database in the existing local container, deploys all checked-in migrations, seeds demo data, builds current source, runs Firefox against the Prisma adapter, verifies all four browser-created records directly in PostgreSQL with realistic generated IDs, force-drops the database, and proves its absence in `finally`.
- Container user/password are derived from `docker inspect` into captured process memory without printing the secret. The first credential-less Prisma attempt failed P1000 as expected; its exact disposable database `tks_parity_browser_43879_1784554642973` was independently confirmed absent before retrying.
- Every failed and passing Prisma attempt ran the drop/absence path. Final aggregate checks found zero databases matching `tks_parity_browser_%`.

**Real-ID responsive RED and repair:**

- The first behaviorally valid Prisma browser run exposed the dissertation failure with real data: at a 390px viewport the document width was 481px. Diagnostics identified the item sidebar/ID card and real CUID `cmrta3gbq0003zduz0yuk5evq` as the min-content source.
- Added `min-w-0` boundaries to generic create/item grids and columns, and made the item-ID card/content wrap with a breakable long token. The same generic layout guard applies to ordinary and singleton create forms.
- The browser gate retains structured overflow evidence (viewport width, document width, and offending elements) on failure. Both formal Prisma passes now pass at 390px with generated CUIDs.

**Exact checkpoint source hash:**

- Aggregate SHA-256 over the eight implementation/config files above (excluding this mutable ledger): `a53b063b55f5961ebfca7c32e6175c5581d6c8e8de8808d6d4b5b0b96835fa59`.
- Both formal full-matrix passes recomputed this identical hash after execution; no checkpoint implementation file changed between passes.

**Claimed commands/evidence:**

1. RED credential proof: initial `npm run test:dashboard:browser:prisma` reached `prisma migrate deploy`, failed P1000 without a password, then dropped its unique database; a direct catalog query confirmed absence.
2. RED responsive proof: corrected credential orchestration reached the real Prisma browser flow and failed with `innerWidth=390`, `scrollWidth=481`, a real CUID, and exact overflowing elements. Its database was dropped and absence-checked despite browser failure.
3. `CMS_PARITY_FAULT_NONZERO_DESCENDANT_PROBE=1 node scripts/validate-nitro-error-runtime.mjs` — intentional exit 1 after nonzero-leader descendant cleanup; no matching descendant or `.output` remained.
4. `CMS_PARITY_FAULT_HANGING_BUILD_PROBE=1 node scripts/validate-nitro-error-runtime.mjs` — intentional timeout exit 1 after TERM/KILL escalation; no fixture process or `.output` remained.
5. `npm run test:nitro:errors` — passed after runner extraction; genuine JSON 500/log behavior and authoritative raw disconnect behavior remained green, and `.output` was removed.
6. Formal matrix pass 1: `rm -rf .output && npm run test:dashboard:browser:matrix` — seeded memory passed with 1,376 events, fresh memory with 1,380, and disposable Prisma with 1,376; all reported zero navigation aborts and zero unexpected request/response/console errors. PostgreSQL persistence verification and database absence passed.
7. Formal matrix pass 2: the identical command passed at the identical source hash with the same per-mode event/error results and a new unique disposable database, which was also removed.
8. `npm test` — 38 files, 141 tests passed.
9. `npm run lint` — passed.
10. `npx tsc --noEmit` — passed.
11. Focused Prettier check over all eight implementation/config files — passed.
12. Final cleanup inspection found no parity database, browser harness, fault harness, app server, Firefox test process/profile, hanging fixture, nonzero-descendant fixture, or fault-injected ordinary output marker.

**Deliberately not claimed:** GAP-01 remains **IN PROGRESS** because the checked-in browser scenarios still encode demo list/field/auth knowledge rather than discovering every permitted list from AdminMeta and proving an arbitrary model/auth fixture. GAP-04 remains **OPEN** pending repeated in-flight navigation stress and request/log correlation. No `READINESS.md` row has been changed.

### 2026-07-20 — REVIEW CHECKPOINT READY 006: AdminMeta arbitrary-model create discovery

**Claim boundary:** ready for independent review, not self-certified. This checkpoint proves one isolated arbitrary model through runtime AdminMeta discovery and addresses Review 006's harness-hardening findings. It does not close GAP-01, GAP-03, or GAP-04, and `READINESS.md` is unchanged.

**Exact files changed since checkpoint 005:**

- `scripts/lib/bounded-child.mjs`
- `scripts/lib/bounded-child.d.mts`
- `scripts/validate-dashboard-browser.mjs`
- `scripts/validate-dashboard-browser-prisma.mjs`
- `scripts/validate-dashboard-arbitrary-browser.mjs`
- `package.json`
- `tests/bounded-child.test.ts`
- `docs/PARITY_REMEDIATION_PROGRESS.md`

**Review 006 IMPORTANT findings addressed:**

- `runBoundedChild(captureOutput)` now enforces a shared configurable byte ceiling across stdout and stderr while continuing to drain both pipes. Overflow is a named gate failure rather than unbounded buffering. Two focused tests prove successful bounded capture and rejection above the configured limit.
- Prisma credential discovery no longer captures the container's full environment. A bounded `docker exec` shell expands only `POSTGRES_USER` and `POSTGRES_PASSWORD` inside the container and returns exactly those two NUL-delimited values to captured memory; values are neither command arguments nor logs.
- Browser cleanup now attempts app and Firefox process-group termination with `Promise.allSettled` and throws an `AggregateError` only after every child cleanup was attempted. One cleanup failure can no longer skip the other process.
- Review 006's responsive boundary is preserved rather than overclaimed: this checkpoint adds no new 320/375/768/desktop route-state evidence, and GAP-03 remains IN REVIEW.

**AdminMeta-driven arbitrary-model fixture:**

- Added `scripts/validate-dashboard-arbitrary-browser.mjs`, which creates a unique temporary source copy, excludes `.git`, `.output`, and `node_modules`, symlinks the existing dependency tree, and overwrites only the temporary copy's `cms.config.ts`.
- The temporary config defines hidden-create auth list `User` and an otherwise unknown `Project` list with required/unique text, integer, and checkbox fields. It builds from that copied source in fresh-memory mode and recursively removes the complete fixture in `finally`; the authoritative workspace config and sibling repository are untouched.
- Browser arbitrary mode creates the first administrator, fetches runtime AdminMeta, selects every list where `hideCreate` and `isHidden` permit creation, and asserts the discovered keys match the fixture contract. No `Project` route, mutation name, item query name, or field path is encoded in the browser create loop.
- For every discovered list, field kinds drive generic input values. The browser observes the AdminMeta-derived create mutation, asserts submitted variables, HTTP 200, no GraphQL errors, and returned ID; matches the returned-ID route; reloads UI field values; and executes the AdminMeta-derived item query to assert raw persisted values.
- The first fixture build exposed its missing application-level `redirectToInit` schema extension as an HTTP 500 during readiness rather than a false create verdict. The fixture now supplies the same required dashboard extension. A subsequent successful browser run exposed only a macOS `/private/var` path canonicalization assertion in orchestration; removing that irrelevant path-equality assertion left behavioral and cleanup checks intact.
- The existing seeded, fresh, and disposable-Prisma scenarios remain as deep current-model coverage. `test:dashboard:browser:matrix` now runs those three modes plus the isolated AdminMeta arbitrary-model fixture.

**Exact checkpoint source hash:**

- Aggregate SHA-256 over the seven implementation/config/test files above (excluding this mutable ledger): `9132d39015e19b16d20b5a046a5e090d57c18ecc0a9157f963b0b183e0bdb501`.
- Both formal full-matrix passes recomputed this identical hash after execution.

**Claimed commands/evidence:**

1. `npx vitest run tests/bounded-child.test.ts` — 2/2 passed, including the captured-output ceiling.
2. Formal matrix pass 1: `rm -rf .output && npm run test:dashboard:browser:matrix` — seeded 1,376 events, fresh 1,380, Prisma 1,376, and arbitrary model 278; every mode reported zero navigation aborts and zero unexpected request/response/console errors. Prisma direct persistence/drop/absence and arbitrary temporary-copy cleanup passed.
3. Formal matrix pass 2: the identical command passed at the identical source hash with the same event/error results and new unique disposable resources, all removed afterward.
4. `npm test` — 39 files, 143 tests passed.
5. `npm run lint` — passed.
6. `npx tsc --noEmit` — passed.
7. Focused Prettier checks over all seven implementation/config/test files — passed.
8. `CMS_PARITY_FAULT_NONZERO_DESCENDANT_PROBE=1 node scripts/validate-nitro-error-runtime.mjs` — intentionally exited nonzero after descendant cleanup; no process or `.output` remained.
9. `CMS_PARITY_FAULT_HANGING_BUILD_PROBE=1 node scripts/validate-nitro-error-runtime.mjs` — intentionally timed out after TERM/KILL cleanup; no process or `.output` remained.
10. `npm run test:nitro:errors` — passed after helper hardening and left `.output` absent.
11. Final cleanup found zero parity databases, temporary source copies, Firefox profiles, browser/fault harnesses, app servers, or fixture processes.

**Deliberately not claimed:** the arbitrary browser automator currently supports text, integer, and checkbox inputs, and its initialization still uses the starter-shaped `User`/`email` auth surface. The supplied user's exact failing command/list/data remains unavailable. GAP-01 therefore stays **IN PROGRESS**. GAP-03 remains **IN REVIEW** beyond the already verified 390px item state. GAP-04 remains **OPEN** pending correlated throttled navigation stress. No `READINESS.md` claim changed.

### 2026-07-22 — REVIEW CHECKPOINT READY 007: Review 007 lifecycle and fixture-isolation remediation

**Claim boundary:** ready for independent review, not self-certified. This checkpoint addresses all three Review 007 blockers and its cleanup/successful-descendant findings. It does not expand or close GAP-01, GAP-03, or GAP-04, and `READINESS.md` remains unchanged.

**Exact files changed since checkpoint 006:**

- `scripts/lib/bounded-child.mjs`
- `scripts/validate-dashboard-browser.mjs`
- `scripts/validate-dashboard-browser-prisma.mjs`
- `scripts/validate-dashboard-arbitrary-browser.mjs`
- `scripts/fixtures/firefox-launcher-exit.mjs`
- `scripts/validate-dashboard-launcher-cleanup.mjs`
- `package.json`
- `tests/bounded-child.test.ts`
- `docs/PARITY_REMEDIATION_PROGRESS.md`

**Review 007 blockers addressed:**

1. **Pre-spawn validation and all terminal outcomes:** `runBoundedChild` now validates label, timeout, TERM grace, and captured-output limits before calling `spawn`. A marker-writing infinite child with `maxCapturedBytes: 0` proves no process is created. A successful leader that leaves a SIGTERM-resistant descendant is now terminated, group-absence checked, and rejected; the focused regression verifies the exact descendant PID is absent. Existing finite capture and overflow tests remain green.
2. **Physically isolated writable caches:** the arbitrary fixture now creates a real temporary `node_modules` root and links dependency entries beneath it while excluding writable root caches (`.nitro`, `.vite`, `.vite-temp`, `.cache`). Scoped package roots are also fixture-owned. The gate hashes the authoritative `node_modules/.nitro` tree before the fixture, requires it to contain no arbitrary marker, and after every success/failure requires the hash to be identical with no `Project: list({` marker or temporary path. Both successful and intentional post-build-failure probes remove the complete fixture and preserve the source cache.
3. **Escaped Firefox launcher cleanup:** real Firefox is launched with `--foreground`. Cleanup additionally discovers only processes whose argv contains the exact unique test-profile path, sends bounded TERM/KILL directly to those PIDs, and waits for absence before profile removal. Process cleanup, exact-profile cleanup, profile removal, and post-removal verification are all attempted and aggregated, so one failure cannot skip filesystem cleanup. The forced launcher fixture exits its original group, forks a PID-1-reparented process that ignores TERM and continuously recreates the exact profile, and proves the harness kills that exact process and leaves no profile without touching the user's normal Firefox profile.

**Additional bounded reliability repair exposed during verification:** the pre-existing PostgreSQL container was stopped before the first formal matrix attempt. The Prisma orchestrator now inspects container state, starts and readiness-probes it only when needed, and restores the original stopped state after database persistence/drop/absence checks on success or failure. Two asynchronous relationship-sheet/option readiness checks were also strengthened after real browser runs reached visible sheet text before the target input/option existed.

**Exact checkpoint source hash:**

- Aggregate SHA-256 over the eight implementation/config/test files above (excluding this mutable ledger): `6ef5ab90acb2860858fd3b5461c78758913d4f1d90d7a8691e9be5d569c8227b`.
- Both final clean-build matrices recomputed this exact hash after execution.

**Claimed commands/evidence:**

1. `npx vitest run tests/bounded-child.test.ts` — 4/4 passed: bounded capture, finite overflow, invalid-option no-spawn, and successful-leader descendant cleanup.
2. `ARBITRARY_BROWSER_FORCE_FAILURE_AFTER_BUILD=1 npm run test:dashboard:browser:arbitrary` — intentionally exited nonzero after a fixture build; temporary source/caches were removed, authoritative Nitro cache hash stayed unchanged, and no arbitrary marker/path remained. Repeated again at the final hash with the same result.
3. `npm run test:dashboard:browser:arbitrary` — passed with Project discovered/persisted, 278 events, zero navigation aborts, and zero unexpected request/response/console errors while preserving the source cache.
4. `npm run test:dashboard:browser:launcher-cleanup` — passed at final source: the launcher exited, the detached TERM-resistant exact-profile process was killed, the profile was removed and stayed absent, and the app was cleaned. This command was rerun after the two formal matrices.
5. Focused disposable-Prisma browser run passed after container lifecycle and UI readiness repairs; direct persistence/drop/absence passed and the initially stopped container was stopped afterward.
6. Formal matrix pass 1: `rm -rf .output && npm run test:dashboard:browser:matrix` — seeded 1,376 events, fresh 1,380, Prisma 1,376, arbitrary 278; zero navigation aborts and zero unexpected browser request/response/console errors in all modes. Databases, temporary source/cache, Firefox, profiles, and temporarily started PostgreSQL were cleaned/restored.
7. Formal matrix pass 2: the identical command passed at the identical hash with the same event/error outcomes and independent disposable resources, all removed/restored.
8. `npm test` — 39 files, 145 tests passed.
9. `npx tsc --noEmit`, `npm run lint`, and focused Prettier checks — passed.
10. Final inspection found no checkpoint browser/fault/launcher process, app server, exact temporary profile/source copy, arbitrary cache marker/path, or running PostgreSQL container. Each Prisma gate's in-process catalog assertion found no parity database before restoring the stopped container state.

**Deliberately not claimed:** this is harness lifecycle/isolation remediation for already bounded arbitrary-model evidence. GAP-01 remains **IN PROGRESS** pending broader arbitrary auth/field shapes and the unavailable user-specific reproduction. GAP-03 remains **IN REVIEW** beyond the accepted 390px item state. GAP-04 remains **OPEN** pending correlated throttled navigation stress. No `READINESS.md` claim changed.

### 2026-07-22 — REVIEW CHECKPOINT READY 008: Review 008 earliest-lifecycle cleanup remediation

**Claim boundary:** ready for independent review, not self-certified. This checkpoint addresses Review 008's two earliest-failure cleanup windows only. GAP-01, GAP-03, and GAP-04 remain open; `READINESS.md` is unchanged.

**Exact files changed since checkpoint 007:**

- `scripts/validate-dashboard-browser-prisma.mjs`
- `scripts/validate-dashboard-arbitrary-browser.mjs`
- `docs/PARITY_REMEDIATION_PROGRESS.md`

**Review 008 blockers addressed:**

1. The Prisma gate now enters one outer lifecycle `try/finally` before a stopped container is started. Readiness, credential capture, NUL-shape validation, user/password assertions, URL construction, database creation, migrations, seed, build, browser, and persistence all run under that restoration scope. Gate ownership is set before `docker start`, covering ambiguous startup outcomes. Cleanup inspects current state, unconditionally runs `dropdb --if-exists --force` for the unique gate-owned name whenever PostgreSQL is running, independently verifies absence, then restores an initially stopped container. Cleanup steps continue and aggregate errors.
2. The arbitrary gate no longer allocates its temporary root at module initialization. It enters `try/finally`, allocates the root, and only then executes fingerprinting and source-cache assertions. Conditional cleanup handles failures before fingerprint capture as well as later failures. `ARBITRARY_BROWSER_FORCE_PREFLIGHT_FAILURE=1` now throws immediately after allocation and proves the root is still removed.

**Exact verification source hash:**

- Aggregate SHA-256 over the same eight participating implementation/config/test files as checkpoint 007: `56988cf72b27fd601c8cd717c216d7df92c748aa23d0fcf15801dfec51ee5be6`.
- Both final clean-build matrices recomputed this exact hash.

**Claimed commands/evidence:**

1. From an initially stopped container, `PARITY_POSTGRES_PASSWORD='' node scripts/validate-dashboard-browser-prisma.mjs` intentionally exited 1 at credential validation, unconditionally attempted unique-name drop/absence verification, and restored PostgreSQL to stopped. Repeated at the final hash with the same result.
2. `ARBITRARY_BROWSER_FORCE_PREFLIGHT_FAILURE=1 node scripts/validate-dashboard-arbitrary-browser.mjs` intentionally exited 1 immediately after temporary-root allocation; no `tks-arbitrary-browser-*` directory remained. Repeated at the final hash.
3. Focused disposable-Prisma browser success passed with 1,376 events, zero unexpected errors, direct PostgreSQL persistence, unconditional drop/absence, and stopped-state restoration.
4. Formal matrix pass 1: `rm -rf .output && npm run test:dashboard:browser:matrix` — seeded 1,376 events, fresh 1,380, Prisma 1,376, arbitrary 278; every mode reported zero navigation aborts and zero unexpected request/response/console errors. All disposable resources and the temporarily started PostgreSQL container were cleaned/restored.
5. Formal matrix pass 2: the identical command passed at the identical hash with independent disposable resources and the same event/error outcomes.
6. `npm test` — 39 files, 145 tests passed.
7. `npx tsc --noEmit`, `npm run lint`, and focused Prettier checks passed.
8. Final cleanup found PostgreSQL stopped, no browser/app/profile/source-copy process or directory, and no arbitrary marker in the authoritative Nitro cache.

**Deliberately not claimed:** this checkpoint only closes lifecycle windows identified by Review 008. It does not broaden arbitrary fields/auth, responsive route coverage, or cancellation stress. GAP-01 remains **IN PROGRESS**, GAP-03 remains **IN REVIEW**, GAP-04 remains **OPEN**, and no `READINESS.md` row changed.

### 2026-07-22 — REVIEW CHECKPOINT READY 009: Review 009 interrupted-container database cleanup

**Claim boundary:** ready for independent review, not self-certified. This checkpoint addresses Review 009's single interrupted-container database leak. It does not expand or close GAP-01, GAP-03, or GAP-04; `READINESS.md` remains unchanged.

**Exact files changed since checkpoint 008:**

- `scripts/validate-dashboard-browser-prisma.mjs`
- `docs/PARITY_REMEDIATION_PROGRESS.md`

**Review 009 blocker addressed:**

- Cleanup now records the exact initial container state, inspects state again in `finally`, and if PostgreSQL was stopped during the gate it starts and readiness-probes it solely for cleanup. It then unconditionally drops the unique database name and verifies absence. Finally it restores the exact initial state: initially stopped returns to stopped; initially running remains running, including when cleanup had to restart it.
- Added `PARITY_POSTGRES_STOP_AFTER_CREATE_PROBE=1`. The gate creates the unique database, deliberately stops PostgreSQL, throws, then its own cleanup restarts PostgreSQL, drops/verifies the database, and restores stopped state.

**Exact verification source hash:**

- Aggregate SHA-256 over the same eight participating implementation/config/test files: `c142bdfd52423ab470196c3f92518d46fbe708113fb5fba0cdac1418fbdd0b97`.
- Both final clean-build matrices recomputed this exact hash.

**Claimed commands/evidence:**

1. From stopped state, `PARITY_POSTGRES_STOP_AFTER_CREATE_PROBE=1 node scripts/validate-dashboard-browser-prisma.mjs` intentionally exited 1 after database creation/container stop. Gate cleanup restarted PostgreSQL, dropped and absence-checked the unique database, and restored stopped state. A bounded catalog check after restart found zero parity databases.
2. From an intentionally running initial state, `PARITY_POSTGRES_PASSWORD='' node scripts/validate-dashboard-browser-prisma.mjs` intentionally exited 1 and left PostgreSQL running with zero parity databases; the test orchestration then restored the pre-test stopped state.
3. Formal matrix pass 1: `rm -rf .output && npm run test:dashboard:browser:matrix` — seeded 1,376 events, fresh 1,380, Prisma 1,376, arbitrary 278; zero navigation aborts and zero unexpected request/response/console errors. Disposable resources were removed and PostgreSQL returned to stopped.
4. Formal matrix pass 2: the identical command passed at the identical hash with independent disposable resources and the same outcomes.
5. `npm test` — 39 files, 145 tests passed; TypeScript, lint, and Prettier passed.
6. Final inspection found no parity process/profile/source copy/database and PostgreSQL stopped.

**Deliberately not claimed:** this is database cleanup remediation only. GAP-01 remains **IN PROGRESS**, GAP-03 remains **IN REVIEW**, GAP-04 remains **OPEN**, and no `READINESS.md` row changed.

### 2026-07-22 — REVIEW CHECKPOINT READY 010: Review 010 cleanup-readiness failure remediation

**Claim boundary:** ready for independent review, not self-certified. This checkpoint addresses Review 010's single nested cleanup-readiness failure. GAP-01, GAP-03, and GAP-04 remain open; `READINESS.md` remains unchanged.

**Exact files changed since checkpoint 009:**

- `scripts/validate-dashboard-browser-prisma.mjs`
- `docs/PARITY_REMEDIATION_PROGRESS.md`

**Review 010 blocker addressed:**

- Cleanup now marks PostgreSQL running immediately after a successful cleanup `docker start`, before readiness is checked. A readiness error is recorded but does not skip unique-name drop or absence verification.
- After database cleanup attempts, container state is freshly inspected. The gate then stops a container that was initially stopped or starts one that was initially running, followed by a final fresh-state assertion.
- Added `PARITY_POSTGRES_CLEANUP_READINESS_FAILURE_PROBE=1`. Combined with the post-create stop probe, cleanup successfully starts the container and reaches actual readiness, then deliberately reports readiness failure. Despite that error it drops/verifies the unique database and restores stopped state before propagating failure.

**Exact verification source hash:**

- Aggregate SHA-256 over the same eight participating implementation/config/test files: `d831016190845bbdb67f78691a42ccf21b197f6a94771fbfbafa211ff0df8241`.
- Both final clean-build matrices recomputed this exact hash.

**Claimed commands/evidence:**

1. `PARITY_POSTGRES_STOP_AFTER_CREATE_PROBE=1 PARITY_POSTGRES_CLEANUP_READINESS_FAILURE_PROBE=1 node scripts/validate-dashboard-browser-prisma.mjs` intentionally exited 1 with the cleanup-readiness marker. A bounded restart/catalog check found zero parity databases and PostgreSQL stopped.
2. Focused normal Prisma browser passed with 1,376 events, zero unexpected errors, direct persistence, database cleanup, and stopped-state restoration.
3. Two consecutive `rm -rf .output && npm run test:dashboard:browser:matrix` passes succeeded at the unchanged hash: seeded 1,376 events, fresh 1,380, Prisma 1,376, arbitrary 278; all modes had zero navigation aborts and zero unexpected request/response/console errors, with all disposable resources removed.
4. `npm test` — 39 files, 145 tests passed; TypeScript, lint, and Prettier passed.
5. Final inspection found no parity database/process/profile/source copy and PostgreSQL stopped.

**Deliberately not claimed:** this checkpoint repairs only the cleanup-readiness branch. GAP-01 remains **IN PROGRESS**, GAP-03 remains **IN REVIEW**, GAP-04 remains **OPEN**, and no `READINESS.md` row changed.

### 2026-07-22 — REVIEW CHECKPOINT READY 011: arbitrary auth-list/field initialization and sign-in

**Claim boundary:** ready for independent review, not self-certified. This checkpoint removes fixed `User`/`email`/`password` assumptions from dashboard initialization and sign-in and proves them with an isolated `Account`/`handle`/`secret` browser fixture. GAP-01 remains open for broader fields and the unavailable user-specific reproduction; GAP-03/GAP-04 remain open; `READINESS.md` is unchanged.

**Exact changed files:**

- `src/features/cms/types.ts`
- `src/features/cms/graphql-client.ts`
- `src/features/cms/runtime.ts`
- `src/features/cms/admin-meta-query.ts`
- `src/routes/dashboard/init.tsx`
- `src/routes/dashboard/signin.tsx`
- `scripts/validate-dashboard-browser.mjs`
- `scripts/validate-dashboard-arbitrary-browser.mjs`
- `scripts/validate-cms-admin-meta.ts`
- `tests/dashboard-generic-auth.test.ts`
- `tests/dashboard-init-route.test.ts`
- `tests/dashboard-signin-route.test.ts`
- `.cms/schema.graphql`
- `docs/PARITY_REMEDIATION_PROGRESS.md`

**Contract and implementation:**

- Added an additive public `keystone.auth` metadata contract with auth list key, identity field, secret field, session selection, and initial-item fields. The protected `adminMeta.auth` shape exposes the same added fields. GraphQL names and field names are boundary-validated before dynamic operations are built.
- `buildDashboardPasswordAuthContract` derives initial-input, initial-mutation, authentication mutation, success, and failure names from arbitrary auth metadata. `fetchDashboardPublicAuthMeta` is usable before authentication without exposing credentials or implementation state.
- `/dashboard/init` now renders configured initial fields, creates the configured auth-list item with the generated input/mutation names, and authenticates using configured identity/secret argument names and result types.
- `/dashboard/signin` loads the public auth contract, renders configured identity/secret inputs, and executes the derived authentication mutation. Current `email`/`password` IDs and behavior remain compatible.
- The disposable arbitrary fixture now defines hidden auth list `Account` with `displayName`, unique `handle`, and password `secret`, plus creatable `Project`. Browser automation discovers public auth metadata, initializes Account through `createInitialAccount`, signs out, proves a direct `authenticateAccountWithPassword` request/result, signs in through the rendered `handle`/`secret` UI, then discovers and persists Project through AdminMeta.

**Exact checkpoint source hash:**

- Aggregate SHA-256 over the thirteen implementation/generated/test files above (excluding this mutable ledger): `52febcc88686e22f37186c6f700e182c0b2fcfe7f0a8bac141ea29e7d1406893`.
- Both formal clean-build matrices recomputed this exact hash.

**Claimed commands/evidence:**

1. RED: `npx vitest run tests/dashboard-generic-auth.test.ts` failed because `buildDashboardPasswordAuthContract` did not exist.
2. Focused generic auth/init/sign-in tests — 7 tests across three files passed, including arbitrary mutation/input/result names and failure messages.
3. `npm run test:cms` — complete memory CMS validation passed, including public auth metadata and the existing auth/session matrix.
4. Arbitrary browser passed with Account initialization, sign-out, direct authentication request/result, rendered handle/secret sign-in, AdminMeta Project create/reload/raw persistence, 388 events, zero navigation aborts, and zero unexpected request/response/console errors. Temporary source/cache/profile cleanup stayed intact.
5. Formal matrix pass 1: `rm -rf .output && npm run test:dashboard:browser:matrix` — seeded 1,344 events, fresh 1,348, Prisma 1,344, arbitrary 388; all modes reported zero navigation aborts and zero unexpected request/response/console errors. Prisma persistence/database/state restoration and arbitrary isolation passed.
6. Formal matrix pass 2: the identical command passed at the identical hash with independent disposable resources and the same outcomes.
7. `npm test` — 40 files, 148 tests passed; TypeScript, lint, and focused Prettier checks passed.
8. Final cleanup found no parity process/profile/source copy/database and PostgreSQL stopped.

**Deliberately not claimed:** signup/reset routes and arbitrary non-scalar/advanced field automation are not covered by this slice. The supplied user's exact failing environment remains unavailable. GAP-01 remains **IN PROGRESS**, GAP-03 remains **IN REVIEW**, GAP-04 remains **OPEN**, and no `READINESS.md` row changed.

### 2026-07-22 — REVIEW CHECKPOINT READY 012: Review 012 persisted-control hydration synchronization

**Claim boundary:** ready for independent review, not self-certified. This checkpoint repairs Review 012's arbitrary-form hydration race and addresses its auth-contract hardening notes. GAP-01, GAP-03, and GAP-04 remain open; `READINESS.md` is unchanged.

**Exact files changed since checkpoint 011:**

- `src/features/cms/graphql-client.ts`
- `src/features/cms/runtime.ts`
- `scripts/validate-dashboard-browser.mjs`
- `scripts/validate-cms-admin-meta.ts`
- `tests/dashboard-generic-auth.test.ts`
- `.cms/schema.graphql`
- `docs/PARITY_REMEDIATION_PROGRESS.md`

**Review 012 blocker and IMPORTANT findings addressed:**

- After returned-ID navigation/reload, the arbitrary browser loop now waits independently for every editable text/integer input value and checkbox state to equal its submitted value before retaining the explicit UI assertion and raw GraphQL persistence assertion. Label-heading readiness can no longer race hydrated controls.
- Public pre-auth metadata now uses a narrower additive `PublicAuthMeta` type that omits `sessionData`; protected `adminMeta.auth` retains session selection. Pre-auth routes receive only operation-shaping field names.
- Added four executable negative-name cases covering malicious/invalid auth list, identity, secret, and initial-field GraphQL names.
- Direct arbitrary authentication now asserts the authenticated item ID equals the exact ID returned by `createInitialAccount`; rendered UI sign-in still independently reaches the authenticated dashboard.

**Exact verification source hash:**

- Aggregate SHA-256 over the same thirteen participating implementation/generated/test files as checkpoint 011: `c811a09b96d8bc43608baaae587abed2afcb7b7daf9818f2e3cb3f0d62c13800`.
- Both clean-build matrices recomputed this exact hash.

**Claimed commands/evidence:**

1. Focused generic auth/init/sign-in suite — 11/11 passed, including all invalid-name categories.
2. `npm run test:cms` — passed, including narrow public auth metadata and existing auth/session behavior.
3. Focused arbitrary browser passed with Account/handle/secret init/sign-in, matching authenticated Account ID, per-control Project reload synchronization, raw GraphQL persistence, 388 events, zero navigation aborts, and zero unexpected request/response/console errors.
4. Formal matrix pass 1: `rm -rf .output && npm run test:dashboard:browser:matrix` — seeded 1,344 events, fresh 1,348, Prisma 1,344, arbitrary 388; all modes clean with resource/state cleanup.
5. Formal matrix pass 2: the identical command passed at the identical hash with independent disposable resources and identical event/error outcomes.
6. `npm test` — 40 files, 152 tests passed; TypeScript, lint, and focused Prettier checks passed.
7. Final inspection found no parity process/profile/source copy/database and PostgreSQL stopped.

**Deliberately not claimed:** this synchronizes covered controls but does not add arbitrary advanced/non-scalar field support or reproduce the unavailable user environment. GAP-01 remains **IN PROGRESS**, GAP-03 remains **IN REVIEW**, GAP-04 remains **OPEN**, and no `READINESS.md` row changed.

### 2026-07-22 — REVIEW CHECKPOINT READY 013: disposable derived sibling dashboard oracle

**Claim boundary:** ready for independent review, not self-certified. Review 013 verified checkpoint 012 with no blockers. This checkpoint addresses GAP-02's broken executable comparison target by deriving a temporary compatibility fixture; GAP-02 is now **IN REVIEW**, not closed. GAP-01 remains **IN PROGRESS**, GAP-03 remains **IN REVIEW**, GAP-04 remains **OPEN**, and `READINESS.md` is unchanged.

**Exact changed files:**

- `scripts/validate-sibling-oracle.mjs`
- `scripts/lib/bounded-child.mjs`
- `docs/SIBLING_ORACLE_FIXTURE.md`
- `package.json`
- `docs/PARITY_REMEDIATION_PROGRESS.md`

**Derived-oracle contract:**

- `/Users/junaid/Code/next-keystone-starter` remains read-only. The gate fingerprints it, copies it to a unique temporary root without dependencies, generated output, environment files, or Git metadata, and verifies the source fingerprint again after cleanup.
- The fixture patch is limited to the sibling's six schema-incompatible AdminMeta selections: list `initialFilter`/`hideNavigation`, create `fieldPosition`/`isRequired`, item `isRequired`, and list `fieldPosition`. Missing values are derived from schema-supported `isHidden`, `isNonNull`, and documented form-position defaults. The direct source defect and fixture-only intended contract are documented separately in `docs/SIBLING_ORACLE_FIXTURE.md`.
- The gate installs dependencies only in the temporary copy, creates and migrates a unique `nks_oracle_<pid>_<timestamp>` PostgreSQL database, and runs the copied sibling's production build and server.
- Real Firefox WebDriver BiDi initializes the first administrator, loads dashboard home, Todo list, Todo create form, and a created Todo item, signs out, signs in through the rendered form, and reloads the item. It rejects the dashboard error boundary, invalid AdminMeta behavior, browser HTTP 500s, and console errors. A direct PostgreSQL query ties the returned Todo ID to the exact persisted label.
- App/Firefox process groups, the unique database, temporary source/profile, and temporarily started PostgreSQL state are cleaned/restored. The bounded child helper now gives successful child groups their configured TERM grace to quiesce before classifying surviving descendants; a real sibling Next build exposed transient post-leader group activity. Existing stubborn-descendant rejection remains covered by `tests/bounded-child.test.ts`.

**Exact checkpoint source hash:**

- Aggregate SHA-256 over the four participating implementation/config/fixture-document files above, excluding this mutable ledger and using `shasum -a 256 <files> | shasum -a 256`: `b2072492a7501fc76a3a9692f0f5f8e5a7b915ccd5be2c6206f153dd89860640`.
- Both formal derived-oracle passes recomputed this exact hash before/after execution.

**Claimed commands/evidence:**

1. Baseline evidence remains the dissertation's clean disposable sibling reproduction: direct init/auth/`createTodo` worked while the unmodified dashboard emitted six invalid AdminMeta fields and rendered “Something went wrong.” During implementation, an incorrectly narrowed first patch still rendered “No lists configured”; retaining the final list-view removal at the exact schema location made the derived UI healthy.
2. Formal pass 1: `npm run test:sibling:oracle` — sibling production build/migrations passed; Firefox completed init/sign-in/home/list/create/item with 227 observed events and zero browser HTTP 500/console errors; direct PostgreSQL persistence passed; all resources were removed/restored.
3. Formal pass 2: the identical command passed at the identical hash with a new copy/database/profile and the same 227/zero-error result.
4. `npx vitest run tests/bounded-child.test.ts` — 4/4 passed, including successful-leader stubborn-descendant cleanup.
5. `npm test` — 40 files, 152 tests passed. `npm run test:cms`, lint, TypeScript, and focused Prettier checks passed.
6. Final independent-state inspection found zero `nks_oracle_%` databases, temporary fixture directories, sibling gate/app/browser processes, or installed `node_modules` in the authoritative sibling. PostgreSQL was restored to stopped.

**Review 013 IMPORTANT notes preserved:** arbitrary checkbox waits currently rely on the generator's `true` invariant; public auth names are a stable API contract; a focused public-vs-protected metadata test remains a useful future hardening addition. Signup/reset and advanced/non-scalar arbitrary fields remain outside the accepted checkpoint 012 boundary.

**Deliberately not claimed:** no authoritative sibling file was repaired; the fixture freezes intended behavior without pretending the source dashboard is healthy. GAP-02 awaits independent acceptance. The unavailable user-specific GAP-01 case is not claimed reproduced. GAP-01, GAP-03, and GAP-04 are not closed, and `READINESS.md` is unchanged.

### 2026-07-22 — REVIEW CHECKPOINT READY 014: real-ID responsive route-state matrix

**Claim boundary:** ready for independent review, not self-certified. This expands GAP-03 evidence from one accepted 390px item state to a production-shaped five-width route/state matrix and repairs two additional overflow defects found by that matrix. GAP-03 remains **IN REVIEW**, not closed. GAP-01 remains **IN PROGRESS**, GAP-02 awaits checkpoint 013 review, GAP-04 remains **OPEN**, and `READINESS.md` is unchanged.

**Exact changed files:**

- `scripts/validate-dashboard-browser.mjs`
- `scripts/validate-dashboard-browser-prisma.mjs`
- `src/components/dashboard/page-breadcrumbs.tsx`
- `src/routes/dashboard/$listKey.$id.tsx`
- `docs/PARITY_REMEDIATION_PROGRESS.md`

**Responsive contract and repairs:**

- The disposable-Prisma Firefox flow now updates its real-CUID Todo to a deliberately long unbroken persisted label, then verifies home, Todo list, Todo create, and Todo item routes at 320, 375, 390, 768, and 1440 CSS pixels.
- At every width it additionally opens/toggles the left sidebar and opens/cancels the real Todo delete alert dialog. Each of the resulting 30 states records route, inner width, document/body scroll widths, and bounded visible overflow offenders; document/body width must remain within one pixel of the viewport.
- RED at 320px: the item header action row expanded the document to 385px. `PageBreadcrumbs` now permits constrained/wrapping action content and auto minimum header height; the item action group is min-width-safe and wraps rather than forcing min-content width.
- RED at 768px with the persisted long label: the item breadcrumb expanded the document to 1,693px. The breadcrumb side now participates in flex shrinking, clips overflow, and truncates the current-page label while retaining its full DOM text/accessibility content.
- The final hydrated 390px state retains the existing accessible-name and keyboard-focus checks. The visible-name test now uses `textContent`, correctly counting visually hidden accessible label text rather than treating `sr-only` button names as absent.
- Direct PostgreSQL verification now expects the same exact long responsive Todo label set by the browser; realistic CUID length and the existing Role/User/TodoImage rows remain required.

**Exact checkpoint source hash:**

- Aggregate SHA-256 over the four implementation/harness files above, excluding this mutable ledger and using `shasum -a 256 <files> | shasum -a 256`: `a78e6bcc9815ee48361faa188a4d9516b9db122d8dc37d6c265499d397b8d611`.
- Both clean-build matrices recomputed this exact hash after execution.

**Claimed commands/evidence:**

1. Focused production-shaped Prisma run passed all 30 responsive states, direct PostgreSQL persistence, and the existing CRUD/document/relationship/accessibility flow with 3,166 events, zero navigation aborts, and zero unexpected request/response/console errors.
2. Formal clean-build matrix pass 1: seeded 1,344 events/one legacy responsive state; fresh 1,348/one; Prisma 3,166/30; arbitrary Account/Project 388. Every mode reported zero navigation aborts and zero unexpected request/response/console errors. Prisma database and container state and arbitrary source/profile resources were cleaned/restored.
3. Formal clean-build matrix pass 2 passed at the identical hash with independent disposable resources and identical state/event/error counts.
4. `npm test` — 40 files, 152 tests passed. `npm run test:cms`, lint, TypeScript, and focused Prettier checks passed.
5. Final in-gate database absence checks passed and PostgreSQL returned to stopped; no disposable browser/profile/source process remained.

**Deliberately not claimed:** this is executable overflow/responsiveness evidence, not an independent acceptance or a complete visual/accessibility audit. It does not supply paired screenshots, screen-reader review, zoom/high-contrast/reduced-motion coverage, or every right-sidebar/relationship-sheet state under GAP-11. GAP-03 remains **IN REVIEW** pending oversight. GAP-01 and GAP-04 are not closed, and `READINESS.md` is unchanged.

### 2026-07-22 — REVIEW CHECKPOINT READY 015: Reviews 014/015 blockers and correlated request cancellation

**Claim boundary:** ready for independent review, not self-certified. This checkpoint is limited to accepted-gate remediation: the derived sibling lifecycle blockers from Review 014, responsive false-pass blockers from Review 015, and GAP-04 request-correlated cancellation behavior. GAP-02, GAP-03, and GAP-04 remain **IN REVIEW**; GAP-01 remains **IN PROGRESS**; `READINESS.md` is unchanged.

**Independent hashes by review boundary** (lexically sorted file contents concatenated into SHA-256; this mutable ledger excluded):

- Sibling lifecycle/oracle boundary — `5d7d01d94ad4bb356ded22c18b69dcfb7477aa98e82b9d7abd4719c25955c8ed` over `docs/SIBLING_ORACLE_FIXTURE.md`, `scripts/fixtures/firefox-launcher-exit.mjs`, and `scripts/validate-sibling-oracle.mjs`.
- Responsive false-pass boundary — `dbacc1a36b34507a811009a73c9c70fc61ae59259ddefc31cf1ee6d2654986d0` over `scripts/validate-dashboard-browser-prisma.mjs`, `scripts/validate-dashboard-browser.mjs`, `src/components/dashboard/page-breadcrumbs.tsx`, `src/components/ui/alert-dialog.tsx`, `src/components/ui/sheet.tsx`, `src/components/ui/sidebar.tsx`, and `src/routes/dashboard/$listKey.$id.tsx`.
- GAP-04 boundary — `4f80daaf2070a54bd7fd2316be36513789e60e8456bbe211c2a60b403ca1c7d8` over `scripts/fixtures/firefox-launcher-exit.mjs`, `scripts/validate-nitro-error-runtime.mjs`, `src/server/error-handler.ts`, `src/server/nitro-plugin.ts`, `src/server/parity-fault-handler.ts`, `src/server/parity-fault-plugin.ts`, `src/server/parity-fault-state.ts`, and `tests/nitro-error-handler.test.ts`.

**Review 014 blocker remediation:**

1. Sibling database cleanup records startup separately, attempts readiness/drop/absence as independent phases, restores/asserts fresh container state, and reports cleanup failures without skipping later cleanup.
2. Post-create-stop and forced cleanup-readiness-failure probes both fail intentionally while leaving zero `nks_oracle_%` databases; the forced launcher-exit probe fails intentionally while exact-profile TERM/KILL cleanup removes escaped Firefox/profile state.
3. The Todo ID is CUID-shape validated before SQL interpolation. The browser rejects unexpected fetch failures, every HTTP 4xx/5xx response, and console errors; `NS_BINDING_ABORTED` caused by expected Next navigation supersession remains explicitly counted.
4. `docs/SIBLING_ORACLE_FIXTURE.md` now states that Todo creation is scoped direct GraphQL rather than UI submission and bounds the six synthetic compatibility defaults to the checked-in sibling.
5. A final normal oracle passed init/sign-in/home/list/create/item with 227 events, 13 expected navigation aborts, and zero unexpected browser fetch/4xx/console errors; the authoritative sibling fingerprint remained unchanged.

**Review 015 blocker remediation:**

1. The responsive gate now evaluates all visible crossing elements before truncating pass evidence, asserts zero unexpected offenders, and records narrow reasons/counts for only closed off-canvas sidebars and table descendants inside bounded horizontal scroll regions.
2. Header/main, active mobile or desktop sidebar, alert dialog, and every overlay action rectangle must remain horizontally bounded. Mobile focus containment/return, trigger `aria-expanded`, desktop restoration waits, and explicit sheet/alert-dialog modal semantics are executable.
3. The persisted stress value combines realistic spaced text with a truly unbroken alphanumeric token. The browser and direct SQL require the exact value plus exact CUID shape.
4. The final disposable-Prisma Firefox run passed all 30 states and existing CRUD/document/relationship/a11y checks with 3,166 events and zero unexpected request/response/console errors.

**GAP-04 correlated cancellation evidence:**

1. Structured error context accepts only bounded safe request IDs and pathnames without query strings; malformed/log-expanding IDs become `null`.
2. Nine throttled Firefox requests carry unique request IDs, terminate with browser `NS_BINDING_ABORTED` and no HTTP completion while real create/item/list navigation supersedes them, then correlate to Nitro hook observations with authoritative disconnected state and no `[cms][server-error]` output.
3. One equivalently throttled request completes with HTTP 200. A raw `ECONNRESET` request with live aborted/destroyed state remains quiet. A genuine fault retains correlated JSON HTTP 500 and `[cms][server-error]` output.
4. Fault routes/plugins remain build-conditional; a final ordinary production build contains no parity-fault markers. The forced launcher-exit probe fails intentionally and leaves no exact-profile Firefox process/profile or fault build output.
5. `npm run test:nitro:errors` passed the 13 focused unit assertions plus the production Firefox acceptance above.

**Broad integration evidence:** `npm test` passed 42 files/160 tests; `npm run test:cms`, lint, TypeScript, and repository-wide Prettier checks passed. The arbitrary Account/Project Firefox fixture passed with 520 events and zero unexpected request/response/console errors. Two integrated disposable-Prisma runs passed after document-agent stabilization; the final exact responsive hash run retained 3,166 events/30 states and zero unexpected errors.

**Explicit product-slice exclusions:** document/component/relationship additions are TypeScript/build/focused-unit clean but still lack their dedicated browser/Prisma acceptance; field-zoo's latest opt-in run is not green; the schema workflow has focused migration-safety/CMS checks but not its disposable PostgreSQL state machine; Openfront canary is a separate active handoff and is not accepted here. None of those product slices contributes to the three hashes or claims above.

**Deliberately not claimed:** no GAP is closed. GAP-02 remains bounded by a derived fixture rather than a repaired authoritative sibling; GAP-03 remains narrower than full GAP-11 visual/a11y coverage; GAP-04 awaits independent acceptance. GAP-01 remains **IN PROGRESS** and `READINESS.md` is unchanged.

**Post-publication integration notice:** the sibling hash remains current. Parallel field-zoo isolation work subsequently changed `scripts/validate-dashboard-browser.mjs` and `vite.config.ts`; therefore checkpoint 015's responsive and GAP-04 hashes must not be accepted as current until integration freezes those files, includes `vite.config.ts` in the relevant boundary, reruns the exact-hash Prisma/Nitro gates, and publishes replacement hashes. This notice prevents adjacent product work from silently invalidating review evidence.

### 2026-07-22 — REVIEW CHECKPOINT 016 SUPERSEDED: `opensource.builders` disposable runtime canary

**Current review status:** **CHANGES REQUIRED; do not accept this checkpoint.** Oversight verified the backend/schema/auth/CRUD/rollback path but found that the dashboard check followed redirects and asserted only HTTP 200, allowing a sign-in redirect to false-pass as model-route usability. Parallel `os.org` generalization changed the script after the declared hash, and the later provisional two-profile run left `openfront-runtime-canary-*` entries in source `node_modules/.cache/jiti` because the fixture symlinked full dependencies while its cache scan omitted Jiti. A replacement checkpoint must isolate/restore Vite/Nitro/Jiti caches, assert source-cache absence/fingerprint, assert the exact final model URL/rendered content/no sign-in or error boundary, then run both profiles at one formatted unchanged hash with verified cleanup.

**Original claim boundary (superseded):** this product slice attempted to prove one real Openfront consumer transplant and rollback path; it did not prove `os.org`, production credentials/data/providers, or close GAP-13. `READINESS.md` remains unchanged.

**Superseded source hash:** `887530d38636ad55cc1ce298503342d446794c4522c259429f4d16ccff1699b3` for the prior `scripts/validate-openfront-runtime-canary.mjs`. This hash is retained only as historical backend evidence and is no longer current/reviewable.

**Executable boundary:** the gate copies the current starter runtime to a unique disposable fixture, transplants eight real read-only `opensource.builders` model initializers, generates CMS/GraphQL/Prisma/TypeScript artifacts, migrates and seeds unique PostgreSQL, starts a bounded Vite runtime, authenticates with password auth, obtains the session cookie, loads the real Open Source Applications dashboard route, resolves seeded category/application/capability relationships, performs domain create/update/reload, captures a pre-CRUD custom-format dump, restores it into an independent database, and proves the post-cutover row is absent after rollback.

**Historical cleanup evidence only:** the prior pass removed its databases/process/temp fixture, but cleanup is not accepted because source `node_modules/.cache/jiti/openfront-runtime-canary-*` residue remained. The provisional `c113…` profile hash is product/route/backend evidence only and is not a cleanup-accepted checkpoint.

**Deliberately not claimed:** this is a synthetic disposable transplant of real model initializers, not an in-place production migration. Existing production objects, external storage/SMTP/provider credentials, domain routes beyond the tested admin/runtime boundary, and `os.org` remain outstanding. GAP-13 is **IN PROGRESS**, not closed.

### 2026-07-24 — REVIEW CHECKPOINT READY 017: frozen responsive and correlated-cancellation replacement hashes

**Claim boundary:** ready for independent review, not self-certified. This replaces only checkpoint 015's superseded responsive/GAP-04 sub-boundaries. GAP-03 and GAP-04 remain **IN REVIEW**; no GAP is closed and `READINESS.md` is unchanged.

**Responsive sorted boundary and exact hash:** `a61a761864c32bf5c2ace68c901bc74f656024a07950167f55737f875a712d33` over `scripts/validate-dashboard-browser-prisma.mjs`, `scripts/validate-dashboard-browser.mjs`, `src/components/dashboard/page-breadcrumbs.tsx`, `src/components/ui/alert-dialog.tsx`, `src/components/ui/sheet.tsx`, `src/components/ui/sidebar.tsx`, `src/routes/dashboard/$listKey.$id.tsx`, and `vite.config.ts` in lexical order.

**GAP-04 sorted boundary and exact hash:** `7037f10d15235b84770b3452232f71b443ad550d56aaad8efa00cd63dbcfb2a0` over `scripts/fixtures/firefox-launcher-exit.mjs`, `scripts/validate-nitro-error-runtime.mjs`, `src/server/error-handler.ts`, `src/server/nitro-plugin.ts`, `src/server/parity-fault-handler.ts`, `src/server/parity-fault-plugin.ts`, `src/server/parity-fault-state.ts`, `tests/nitro-error-handler.test.ts`, and `vite.config.ts` in lexical order.

**RED → repair evidence:** the first provisional responsive replacement run was correctly rejected when the dashboard entered its real error boundary with `relatedList is not defined` during inline relationship-card rendering. `RelationshipValueCard` now receives/destructures its metadata-derived `relatedList`, focused relationship tests pass, and no error boundary appears. GAP-04 replacement attempts were correctly rejected when an in-progress MCP route used non-literal `createFileRoute('/api/mcp-transport/$transport' as never)`, causing TanStack route crawling to fail. The route now uses the exact literal with typed `params.transport`; normal production build, MCP focused test, and TypeScript pass before the Nitro runs.

**Two unchanged-hash passes:** responsive pass 1 and pass 2 each used a fresh disposable Prisma database and passed 3,166 Firefox events, all 30 route/sidebar/dialog states, CRUD/document/relationship/a11y coverage, zero expected navigation aborts, and zero unexpected request/response/console errors. Hash `a61a761…` was recomputed unchanged before/after each. GAP-04 pass 1 and pass 2 each proved nine correlated `NS_BINDING_ABORTED` request IDs with authoritative disconnect state and no product-error log, one throttled HTTP 200 completion, one quiet raw `ECONNRESET`, and one visible correlated genuine JSON/log 500. Hash `7037f10d…` was recomputed unchanged after both.

**Cleanup:** no `tks_parity_browser_%`/`nks_oracle_%`/canary database remained, no dashboard/Nitro app or exact-profile Firefox process remained, and no `tks-firefox-*`/`tks-abort-stress-*` profile remained. PostgreSQL was already running for parallel isolated work and was left running rather than disrupting it. The failed provisional hashes `0d1de392…`/`e6dacf43…` are RED/integration history only and are not published as accepted evidence.

**Deliberately not claimed:** this does not close GAP-03's wider GAP-11 manual/visual boundaries or GAP-04 before independent acceptance. GAP-01 remains **IN PROGRESS**, GAP-02 remains **IN REVIEW**, and `READINESS.md` remains unchanged.

### 2026-07-24 — REVIEW CHECKPOINT 018 SUPERSEDED: bounded GAP-09 auth/session/reset continuity

**Current review status:** **CHANGES REQUIRED; do not accept this checkpoint.** The auth owner was still implementing oversight's reset-enumeration and stale-report/cleanup blockers while this entry was published, so the declared source hash was already non-current. A replacement checkpoint must freeze after those repairs, regenerate evidence without stale PASS behavior, rerun focused/two-process/type/build gates at the same hash, and verify cleanup.

**Superseded historical source manifest hash:** `c75c5e11bb9463a33109c9426c9a0b666bac8714a2ac28c5d508e2e40804007f`, the SHA-256 of the prior per-file SHA-256 manifest for `cms.config.ts`, `src/features/cms/config.ts`, `src/features/cms/auth/graphql.ts`, `src/features/cms/auth/rate-limit.ts`, `src/features/cms/auth/session.ts`, `scripts/validate-cms-auth-continuity.mjs`, `scripts/validate-cms-auth-continuity-worker.ts`, `tests/cms-auth-rate-limit.test.ts`, `tests/cms-password-reset.test.ts`, and `tests/cms-session-security.test.ts`. Shared `package.json`, mutable report `reports/gap-09-auth-continuity.md`, this ledger, and `READINESS.md` are excluded; the report hash is `713227016e93096ab84b6868535ec71ce4a405899fca500bbd5db9abfff79f7c`.

**Historical executable boundary only:** the prior `npm run test:cms:auth:continuity` run created a unique disposable PostgreSQL/container and separate Node workers, then proved fresh init, sign-in, same-secret cross-process cookie hydration, sign-out cookie deletion/anonymous state, arbitrary `Account.handle`/credential auth, reset redemption plus replay/25-hour expiry/generic unknown identity, secret-rotation invalidation, declared replacement legacy-HMAC continuity, trusted-proxy HTTPS/HTTP Secure semantics, and bounded generic login failures/rate limiting. Focused auth suites pass 9 tests; `npm run test:cms:auth`, production build, TypeScript, ESLint, and Prettier pass in integration.

**Cleanup/security:** no continuity worker/container/temp directory remains; generated evidence redacts cookies/tokens/passwords and contains no secret values.

**Explicit remaining boundaries:** reset-enumeration and stale-report/cleanup blockers require a new current run; rate limiting is process-local rather than shared/edge-backed; SMTP is GAP-10; incompatible sibling Iron cookies intentionally do not survive cutover; clock skew and real proxy deployment need staging; stateless sign-out clears the browser cookie but cannot immediately revoke a retained bearer token without stored-session/revocation policy. GAP-09 remains **IN PROGRESS**, not closed.

### 2026-07-24 — REVIEW CHECKPOINT 019 SUPERSEDED: secured model-agnostic MCP mutation boundary

**Current review status:** **CHANGES REQUIRED; do not accept this checkpoint.** Oversight found that authenticated low-privilege users could enumerate all registry lists, fields, and generated mutation names through `listModels`/`getFieldsForType` even when mutation operations were denied. It also found that the 64 KiB guard called `request.text()` for chunked requests without `Content-Length`, buffering an unbounded body before rejection. A replacement requires session-aware metadata filtering with editor non-disclosure tests, incremental bounded stream reading/cancellation with chunked oversized evidence/audit, and a new frozen hash. Boolean `confirmed: true` remains protocol gating, not proof of human approval UX.

**Superseded historical boundary:** the prior run proved the server/protocol mutation core and audit controls, not complete AI-sidebar confirmation UX or deployment transport operations. GAP-12 remains **IN PROGRESS**; `READINESS.md` is unchanged.

**Exact sorted aggregate hash:** `952e19235a0f7ab6b54219b035e5eab6875231006fc9312d4d0a6ef6d7e627a8` over `src/features/cms/mcp.ts`, `src/routes/api/mcp-transport/$transport.ts`, `tests/mcp-mutations.test.ts`, and `tests/mcp-security-worker.ts` in lexical order. Per-file hashes: MCP module `782d6614c1f52e41def04761ca3c09bbb2b9f45dbc05354771a7debc1ddcd182`; route `52a0a5d37dc3d3c766323f3418c3e9b1484976c5ccc4af886fbf257c3c053e37`; focused test `85e56b1825b775a5c35afbe8b3ca9d9a1fdbe2d4ac5e296b9f957a5fb50b7866`; security worker `fe9918f82f993410c1a97da8931cfe01632aa0b3cacace902efc1f4188b1b969`.

**Executable evidence:** focused Vitest passes; TypeScript, MCP ESLint, and ordinary production build pass. The security worker proves authenticated+confirmed metadata-derived create/update/delete with returned Todo ID and persisted update/delete, while anonymous, access-denied, unconfirmed, invalid-operation, invalid-field, malformed-JSON-RPC, and cross-origin calls are denied. One hundred bounded audit events contain no credential/payload leakage. The streamable HTTP route uses exact literal `createFileRoute('/api/mcp-transport/$transport')` and typed `params.transport`; the earlier non-literal cast was the real route-crawl RED repaired before checkpoint 017.

**Deliberately not claimed:** the historical hash is mutation-core evidence only and is non-current/non-accepted. It does not prove metadata non-disclosure, bounded chunked transport, end-user AI-sidebar confirmation/review UX, remote MCP deployment/session affinity, shared audit persistence, or every custom GraphQL extension. GAP-12 is not closed and `READINESS.md` is unchanged.

### 2026-07-24 — REVIEW CHECKPOINT READY 020: replacement GAP-09 auth/session/reset continuity

**Claim boundary:** ready for independent review, not self-certified. This replaces superseded checkpoint 018 after reset-enumeration and report/cleanup hardening. GAP-09 remains **IN REVIEW**, not closed; `READINESS.md` is unchanged.

**Exact frozen manifest:** `a2161cdfd9573abc5fe43c06ddcb3a06eb456eea457751130b24d90b1b6d69f2`, the SHA-256 of the ordered per-file SHA-256 manifest for `cms.config.ts`, `src/features/cms/config.ts`, `src/features/cms/auth/graphql.ts`, `src/features/cms/auth/rate-limit.ts`, `src/features/cms/auth/session.ts`, `scripts/validate-cms-auth-continuity.mjs`, `scripts/validate-cms-auth-continuity-worker.ts`, `tests/cms-auth-rate-limit.test.ts`, `tests/cms-password-reset.test.ts`, and `tests/cms-session-security.test.ts`. Mutable report hash: `12b92b622fff86a42c61472dba48f081eff99bdb914680d2dc7c4c0116a8377f`.

**Replacement evidence:** `npm run test:cms:auth:continuity`, 9 focused auth tests, `npm run test:cms:auth`, TypeScript, and ordinary production build all passed with manifest `a2161cdf…` unchanged before/after. In addition to the prior two-process init/sign-in/same-secret hydration/sign-out/arbitrary Account/reset replay+expiry/secret rotation/legacy replacement/proxy/rate evidence, the replacement proves reset request non-enumeration for known versus unknown identities. The report is removed/initialized before work, writes explicit `Status: FAILED` on failure, writes PASS only after acceptance+cleanup, and asserts no cookie/token/secret leakage.

**Cleanup:** exact worker command inspection found no Node/npm/tsx continuity worker; no `tks-gap09-*` container, GAP-09 temp directory, or disposable resource remained. A broad shell self-match was correctly rejected as a verifier false positive; the process-specific check was clean.

**Remaining boundaries:** rate limiting remains process-local; production shared/edge enforcement, real proxy/clock staging, SMTP, incompatible sibling Iron-cookie migration, and immediate retained-bearer revocation remain explicit. GAP-09 is not closed.

### 2026-07-24 — REVIEW CHECKPOINT 021 SUPERSEDED: isolated safe schema-change state machine

**Current review status:** **CHANGES REQUIRED; do not accept this checkpoint.** Oversight found that the gate's exec/Docker operations had no bounded timeout/termination contract, so the published “bounded” claim was false and early lifecycle hangs could escape cleanup. The owner began timeout/lifecycle remediation after publication, making `b1c6f61b…` stale. A replacement requires bounded child/Docker execution, earliest-failure cleanup evidence, a new full run at one frozen hash, and the existing cache/artifact/residue assertions.

**Superseded historical boundary:** the prior state machine is substantive sudo GraphQL/Prisma-adapter CRUD evidence, not rendered dashboard/browser CRUD. GAP-14 returns to **IN PROGRESS**; `READINESS.md` is unchanged.

**Exact frozen aggregate:** `b1c6f61bea95d8f6f7c26f1b48f876332cc85dfa0f53dcd100f07bd80786fe29` over the sorted per-file SHA-256 manifest for `docs/plans/gap-14-schema-workflow.md`, `scripts/cms-generate.ts`, `scripts/cms-migrate.ts`, `scripts/validate-cms-schema-workflow.mjs`, `scripts/validate-cms-workflow-runtime.ts`, `src/features/cms/migration-safety.ts`, and `tests/cms-migration-safety.test.ts`. Dynamic PASS report hash: `850ef7f34a1e50dd15b5d02e81699c9de97a8c80fbd73405766ef9997e878f23`; run hash `47d58894b067776e14be586a4380bafbb307ec13c265e878f536851bd5012930`.

**Executable boundary:** unique disposable PostgreSQL and a temporary source copy progress through baseline → add → data-preserving rename → type change → relationship → removal blocked by the destructive guard → explicit acknowledgement after backup → revert. Every meaningful phase regenerates/checks artifacts and Prisma Client and exercises fresh-process sudo GraphQL CRUD; temporary-copy production builds and final Prisma migration status pass. `pg_dump`/`pg_restore` verifies populated field/relation rollback rather than a same-database query.

**False-pass/cleanup hardening:** a prior interrupted run writes `Status: FAILED` rather than preserving stale PASS. Writable Vite/Nitro/Jiti caches are fixture-local; source cache snapshots use external tar archives so fixture deletion cannot erase restoration data. PASS is written only after source generated-artifact/schema and writable-cache fingerprints restore byte-identically. No fixture/container/process/external `gap14-cache-*` snapshot or `gap14-` source marker remains. Frozen `vite.config.ts` stayed unchanged at `c72b9186…1166e2`; focused tests (3 files/6 tests) and Prettier pass.

**Deliberately not claimed:** the historical hash is non-current/non-accepted and does not prove bounded process safety, rendered dashboard migration UX, production backup operators, cross-database/version upgrades, or automatic watcher orchestration. GAP-14 is not closed and `READINESS.md` is unchanged.

### 2026-07-24 — REVIEW CHECKPOINT READY 022: bounded safe schema-change replacement

**Claim boundary:** ready for independent review, not self-certified. This replaces superseded checkpoint 021 with finite process/lifecycle controls. CRUD evidence remains fresh-process sudo GraphQL/Prisma-adapter, not rendered dashboard/browser CRUD. GAP-14 remains **IN REVIEW**; `READINESS.md` is unchanged.

**Exact frozen aggregate:** `dca7feb34a020eb3326a0eecbfc579282ae30888cac401c4d359b0fb040c1774` over the sorted per-file SHA-256 manifest for `docs/plans/gap-14-schema-workflow.md`, `scripts/cms-generate.ts`, `scripts/cms-migrate.ts`, `scripts/validate-cms-schema-workflow.mjs`, `scripts/validate-cms-workflow-runtime.ts`, `src/features/cms/migration-safety.ts`, and `tests/cms-migration-safety.test.ts`. PASS report hash `2552491527911b137738f7244ab00da8f1edce4967099ccc7fa057d7be2a2228`; run hash `e4d46ae2df3d64cca65b826bb1c5d1fd046458a2f7ce99b9d045893505136a83`.

**Replacement evidence:** all child exec, Docker, tar snapshot, Prisma migration, production build, and process-inspection operations have finite timeout/termination settings; `scripts/cms-migrate.ts` has its own bounded execution contract. The timeout probe terminates a deliberately hanging child, and the preflight failure probe verifies explicit FAILED report plus fixture/container/process/external-snapshot cleanup before database startup. The full baseline → add → data-preserving rename → type → relationship → destructive removal blocked → explicit allow after backup → revert workflow passes, including fresh Prisma Client, sudo GraphQL CRUD, temporary-copy builds, migration status, and pg_dump/restore data verification.

**Cleanup:** source generated-artifact/schema and writable-cache fingerprints restore exactly; external tar snapshots prevent fixture deletion from erasing restore data. No fixture/container/process/`gap14-cache-*` snapshot/source marker remains. Frozen `vite.config.ts` stayed `c72b9186…1166e2`; focused tests (3 files/6 tests) and Prettier pass.

**Deliberately not claimed:** this does not prove rendered migration UI, production backup operations, every database/version transition, or watcher automation. GAP-14 is not closed and `READINESS.md` is unchanged.

### 2026-07-24 — REVIEW CHECKPOINT READY 023: custom-view graph and field-zoo browser boundary

**Claim boundary:** ready for independent review, not self-certified. This proves an isolated memory-backed field-zoo/custom-module browser workflow plus normal arbitrary-model regression; it does not claim editable image/file or a full Prisma field-zoo. GAP-06/GAP-07 remain **IN REVIEW**; `READINESS.md` is unchanged.

**Exact frozen aggregate:** `59f29269a1d581789733630a1fe455e2a7a1614764d4abe940cdb7724f8fc6bb`, the SHA-256 of the sorted per-file hash manifest for `scripts/cms-generate.ts`, `scripts/validate-dashboard-arbitrary-browser.mjs`, `src/components/dashboard/keystone-list-table.tsx`, `src/components/dashboard/views/registry.tsx`, `src/features/cms/admin-meta.ts`, `src/features/cms/view-order.ts`, and `tests/dashboard-specialized-controller-wiring.test.ts`. Shared/generated files are excluded from the aggregate but observed frozen as: shared browser `da694752…f1171`, Prisma wrapper `f3affab1…cd2c`, Vite `c72b9186…166e2`, package `29b85d3f…5cde`, generated view order `014b3dd9…cec`, and generated view modules `cc8ed5e0…d11`.

**Executable evidence:** field-zoo Firefox passes 586 events with zero unexpected request/response/console errors. The captured create mutation and UI/raw reload assert exact text, textarea, checkbox, select, multiselect, integer, float, decimal, bigInt, local-time-to-UTC timestamp, JSON, document, one/many relationship, and scalar virtual behavior; raw `ratio === 3.5` is explicitly asserted. Image/file are intentionally hidden/read-only and separately asserted rather than implied editable.

**Custom-view evidence:** the real browser requires custom Field and Cell markers plus exact relationship-card `data-custom-card-marker`/`CARD:Zoo relation` rendering. A separate generated fixture contract executes the custom controller and proves its distinct `controller:` mutation serialization and rehydration rather than relying on built-in controller tests. The normal arbitrary Project flow then passes 520 events/zero unexpected errors, proving no fixture-only regression.

**Stability/cleanup:** TypeScript, focused tests (2 files/5 tests), production build, and Prettier pass with source hashes unchanged before/after. Shared browser source contains no field-zoo branch residue; no source-cache fixture marker, temporary source/profile, WebDriver/app process, or disposable fixture remains.

**Deliberately not claimed:** this does not prove custom npm-package resolution in every deployment, editable image/file upload in this fixture, all virtual return shapes, or a Prisma-backed all-field zoo. GAP-06/GAP-07 are not closed and `READINESS.md` is unchanged.

### 2026-07-24 — REVIEW CHECKPOINT READY 024: isolated GAP-05/GAP-08 advanced-document browser + Prisma proof

**Claim boundary:** ready for independent oversight review/rerun, not self-certified closure. This checkpoint covers only the disposable copied fixture and the Article/Author document schema defined by the gate. GAP-05 and GAP-08 remain **IN REVIEW**; `READINESS.md` is unchanged. No shared browser/Prisma harness, Vite/Nitro/server file, field-zoo infrastructure, ledger, or frozen file was changed.

**Exact frozen files and SHA-256:**

- `package.json`: `29b85d3fbb59915d004f93a5b671ade5aa5114eee5196a4dd9646ebc843e5cde`
- `scripts/validate-dashboard-advanced-document-browser.mjs`: `54d5813a2989101e072e4733808864cb1ef3b67936969a9b6152a798531023a8`
- `src/components/dashboard/rich-document-editor.tsx`: `2888679f54d0ecfc110b0f54d98da261c893c33baf6a4a5ea2ae35b7ef2fde74`
- `src/components/dashboard/relationship-field-editor.tsx`: `55efb0963042bd69733f9720f553037a5f2cdb1a7e72b4939de960c60305f426`
- `tests/dashboard-document-view.test.ts`: `0a7bbce8acef09065724ab3dfa00f9f8ec434054312aac2121a5dca6efd29aa6`

The gate's own unchanged-file assertions reported `owned-file hash 15d26085a83cc7fde130dd793cdefc51671e3cbc81daa77d78b50e48a27f9cf8` over its `package.json`/advanced-gate manifest and `protected-editor hash f0d5290855135f58b051ae324c0bc4fb52b5a94ea202f0d4f52d7ea50a1b9a87` over the protected editor/view/focused-test set. The five changed implementation/config/test files above, in listed order using the gate's `filename + bytes` method, additionally hash to `f0688d34c27937ca50666a4819f66e92bc1786207581f375671bf6df46a7c42b`.

**Commands and results:**

1. `npm run test:dashboard:browser:advanced-document` — passed. It generated CMS artifacts, generated Prisma Client, synchronized the unique database, built the isolated fixture, and completed the browser/Prisma proof. Result: created Article `cmrywb4wd00018suzxqs576a6`; 191 Firefox events; 0 network failures; 0 console errors; database `tks_gap0508_76452_1784894840903`.
2. `npx vitest run tests/dashboard-document-view.test.ts` — 1 file, 7 tests passed.
3. `node --check scripts/validate-dashboard-advanced-document-browser.mjs` — passed.
4. Focused `npx prettier --check` over the checkpoint files — passed.

**Explicit evidence scope:**

- **UI/browser:** Firefox BiDi created and edited a layout `[2,1]`, component-block `message`, nested `tone`/`count`, inline relationship, and component-block relationship; asserted returned-ID navigation, rendered labels, UI reload, and component/nested-prop reload.
- **Raw GraphQL/PostgreSQL:** captured create/update GraphQL variables and IDs; independently queried persisted document JSON and relationship state after reload; verified PostgreSQL-backed relationship cardinality/ownership and no residual rollback records.
- **Rollback:** invalid document structure and invalid nested relationship/cardinality writes were rejected; valid pre-existing state remained intact in raw persistence checks.
- **Cleanup:** after the run, no matching app/Firefox/gate process, `tks-gap0508-*` temporary/profile directory, or `tks_gap0508_*` PostgreSQL database remained. The shared PostgreSQL container was preserved.

Oversight may now independently rerun the exact command and compare the frozen hashes above. No owned implementation files will be edited further during review.

### Integration status before checkpoint 025

Checkpoint 017, replacement auth checkpoint 020, bounded schema checkpoint 022, checkpoint 023, and checkpoint 024 are independently accepted within their stated bounded claims; GAP-05/GAP-08 remain open beyond checkpoint 024's isolated fixture. Checkpoint 019 remains superseded pending replacement MCP review. The provisional Openfront `3c6d1182…` and `c1137920…` evidence is rejected/superseded; REVIEW CHECKPOINT READY 025 now supplies the replacement bounded commands, process-group cleanup, failure probe, and external post-finally fingerprints at frozen aggregate `8d9d386f…` within its stated scope.

### 2026-07-24 — REVIEW CHECKPOINT READY 025: frozen Openfront two-profile bounded runtime replacement

**Claim boundary:** ready for independent oversight review, not self-certified closure. This checkpoint covers only the disposable read-only-source compatibility canary for `opensource.builders` and `os.org`; it makes no `READINESS.md`, release, or closure claim. The prior `3c6d1182…` and `c1137920…` runs are historical rejected/superseded cleanup evidence.

**Exact frozen five-file hashes and aggregate:**

- `scripts/validate-openfront-runtime-canary.mjs`: `87314143ecc75419472c607d17d60759eed0dcb21367e8ab888813c0310434ec`
- `scripts/run-openfront-runtime-canary-checkpoint.mjs`: `ed711eb9b4778725d7157574aafabb5535e679950097ddbfba90a4ff190cef5f`
- `scripts/validate-openfront-runtime-canary-bounds.mjs`: `413c04de2094dd346d7c1bd5cc9501b2fc92e6854f2685da1576b9cf5c053dca`
- `scripts/fixtures/hanging-fault-build.mjs`: `57128a64097bc657c297f7ad5acc4ef02184fd080d51595c0268f4a85279f05c`
- `scripts/fixtures/openfront-vite-launcher.mjs`: `4a01ba6f81896e3b5f8ea7da8ab0c5f2bd3663112331741750b31be18ba631b5`
- Frozen aggregate over those five files: `8d9d386f03ea81fce7338db8672b9299aec77aa099d969e2a9ae891fe99aa3df`

Accepted bounded-child helper hashes remained unchanged: `a1406154260e65edf6268b1203400b24342c075b755a7a980f27072b71726ee4` and `cdf70ae6ab2e533a19726d591799aa11304d09a218449e96dd819c7655b0bd78`.

**Execution and failure-probe evidence:** the parent wrapper ran exactly once in serial order: (1) `opensource.builders` intentional failure after Vite readiness, (2) normal `opensource.builders`, (3) normal `os.org`. The failure phase returned nonzero after deterministically observing real stubborn PID `94412` from the TERM-ignoring non-detached descendant in the owned Vite launcher process group. TERM→KILL group cleanup completed. The parent then externally verified cache fingerprint/marker absence, accepted-hash stability, PostgreSQL database absence, container dump absence, temporary-fixture absence, BLOCKED report finalization, and process absence before continuing.

**Two-profile evidence:**

- `opensource.builders`: authenticated final pathname `/dashboard/open-source-applications`; rendered `Open Source Applications` and seeded `Starter Replacement`; no sign-in/error-boundary text; category/application/capability relationships; domain CRUD and PostgreSQL persistence; pre-CRUD custom-format dump restored into an independent rollback database with the seeded relationship retained and post-cutover row absent.
- `os.org`: authenticated final pathname `/dashboard/products`; rendered `Products` and seeded `Canary Platform`; no sign-in/error-boundary text; product/price/instance/subscription/user relationships; domain CRUD and PostgreSQL persistence; pre-CRUD custom-format dump restored into an independent rollback database with the seeded relationship retained and post-cutover row absent.
- Both normal profiles completed bounded Vite launcher process-group cleanup and passed at the same frozen aggregate.

**External final cleanup:** after each child exited, source-cache fingerprint was `69f78ecf2c1eb03a439d46c21f56eec1c878c581b1dcc1d83c0d4ed0232f9c60` before/after; no Jiti/Vite/Nitro/TanStack canary markers, `tks_openfront_*_canary_*` database, `/tmp/tks_openfront_*_canary_*.dump`, `.cms-temp/openfront-runtime-canary-*` fixture, or matching process remained. Reports: `reports/openfront-runtime-cutover-canary-opensource-builders.md`, `reports/openfront-runtime-cutover-canary-os-org.md`, and `reports/openfront-runtime-canary-checkpoint-025.md`.

**Explicit exclusions:** generated permissive access is compatibility scaffolding only and does not establish source access-policy parity. Sibling consumer repositories remained read-only. External provider continuity, real provider credentials/objects, production data, in-place migration, production domain cutover, MCP, schema, field-zoo, document, and other parity gates remain outside this canary. No `READINESS.md` or release/closure implication is made.

### 2026-07-24 — REVIEW CHECKPOINT READY 026: secured GAP-12 MCP replacement

**Claim boundary:** ready for independent review, not self-certified closure. This replacement supersedes checkpoint 019 and covers the model-agnostic MCP transport/mutation security boundary in the memory-backed executable worker plus a production build. It does not claim full MCP lifecycle/spec parity: the handler advertises fixed protocol version `2024-11-05`, does not validate or negotiate initialize parameters, and does not implement MCP session lifecycle management, while its empty HTTP 202 notification acknowledgement follows newer Streamable HTTP transport behavior. It also does not prove human approval UX, completion-route integration, persistent external-database durability, or release readiness. GAP-12 remains **IN REVIEW** and `READINESS.md` is unchanged.

**Exact sorted manifest:** `tests/mcp-mutations.test.ts` `31502bd6f94d60ec9c378919db0e23c708d98facb2bd97cf703d4c81c67b16be`; `tests/mcp-security-worker.ts` `49d413cf4fbf32e1103f14f38fc98918e12c43dd9ca54c019b91a9eff2634fff`; `src/features/cms/mcp.ts` `ad406fd7288e455612fb2ee17e4f760b697524760635cd6d29007c9965d29bd4`; `src/routes/api/mcp-transport/$transport.ts` `ae728c06176c2ce13fd53e4b74cbcbacb69d8ce64bd4e9ae58e260f1e7c606e6`. The SHA-256 of that sorted per-file manifest is `4e7159e512f820c5a4160b679039c132dcd07039c661baa43ec49c918004aca1`.

**Executable behavior:** the worker passes create → update → authenticated reread → delete and returns created IDs/data. Anonymous calls, list-filter denial, foreign-item mutation, unconfirmed mutation, unknown operations, injected fields, invalid fields, and cross-origin requests are denied. Editor-visible metadata retains permitted Role query policy while omitting denied mutation names and protected `User.password` metadata. Operation selection is derived from the exact generated metadata allowlist rather than arbitrary GraphQL.

**Transport/resource controls:** `confirmed: true` is required as a protocol boolean for mutation requests. The incremental body reader cancels a no-`Content-Length` stream over 64 KiB; responses over 256 KiB are denied; selection count is capped at 32 fields and list `take` at 100. JSON-RPC parse/request/params/method failures are structured; initialized notifications return HTTP 202 with an empty body; missing/invalid IDs remain distinct; unknown transport returns 404 and unsupported HTTP methods return 405. These assertions cover the tested route subset, not protocol-version negotiation, initialize-parameter validation, session IDs, resumability, reconnection, or complete Streamable HTTP interoperability.

**Audit/non-disclosure:** the bounded 100-entry audit contains only fixed metadata, allowed operation/transport fields, and a hashed request ID. Arguments, cookies, bearer/session tokens, mutation data, provider credentials, and error messages are excluded. The executable worker reports 100 redacted entries and no credential leakage.

**Verification:** exactly one `npm run build` passed at the frozen hashes, including client/SSR/Nitro output and route crawling of the exact literal MCP route. Post-build focused Vitest passed 1/1; the executable security worker, targeted ESLint, and formatting passed. A provider-owned TypeScript narrowing defect then blocked the first shared typecheck; the provider owner repaired only that file, confirmed no MCP hash changed, and `npx tsc --noEmit` passed without rerunning the build.

**Cleanup:** the worker uses only the memory adapter and deletes its created persistence/response-bound fixtures. No MCP process, temporary file, database, or MCP cache marker remains, and no secret appears in the report/output. The standard production `.output` is retained as the intended build artifact.

**Deliberately not claimed:** `confirmed: true` is transport gating, not evidence of human review or approval. AI-sidebar confirmation UX, completion-route rewiring, shared/durable or multi-instance audit storage and export/retention operations, remote deployment/proxy/session-affinity behavior, protocol negotiation and session lifecycle, persistent external-database/cross-process durability, complete MCP/Streamable HTTP interoperability, and broader release closure remain open.

### 2026-07-24 — REVIEW CHECKPOINT READY 027: bounded GAP-10 provider continuity

**Claim boundary:** ready for independent oversight review, not GAP closure. This checkpoint freezes the provider/storage/mail/mutation-state slice at one exact eight-file aggregate and proves only bounded local provider emulation plus local application behavior. GAP-10 remains **IN REVIEW / EXTERNAL PARTIAL**; `READINESS.md` is unchanged.

**Exact frozen eight-file aggregate:** `10a4fd530551c9f1e1d54bdd96b11133fcae0709ba8eb7f21de7e8dcc94b6104`, computed from the lexically sorted paths using `filename + NUL + file bytes + NUL`:

- `scripts/validate-gap10-provider-continuity.ts`: `4cf44cf8c9c748de684f9dae6aece8e9b9ea48796452d330472a8eedc624d0e1`
- `src/features/cms/mutation-state.ts`: `01fcfeefc918fc10ba6dc99538fb1972cff920f8f3c139dbebe76b0704028627`
- `src/features/cms/password-reset-mail.ts`: `3f360b101532ae8531c364e96d55c04c004d1cded55d611388e7827fd6930300`
- `src/features/cms/runtime.ts`: `f2fa1663175dca6e67872f4bfc4796a474ff8117e9f7d01a72f5a22100224d60`
- `src/features/cms/storage-config.ts`: `2abfc2bdc16787830d947929d38277c6c8da8ac9e73d5eb991f06c42de1368e0`
- `src/features/cms/storage.ts`: `e3adb32d7d19152ee663b951638751fd74a67d92021323fccb09c23e579d963a`
- `tests/cms-mutation-state.test.ts`: `3c0da80527e967016709cdd67dc20aa439797e83fbe2b25db5e5a557b6ea4505`
- `tests/cms-password-reset-mail.test.ts`: `070083c72f648a997cfd66fc14d8efc51195c742805de9079607f8bc7ee551b1`

**Execution gates:** exactly one normal `npm run build` passed at the unchanged aggregate. The full `npx tsx scripts/validate-gap10-provider-continuity.ts` harness passed; `npm run test:providers:local` passed storage and SMTP wire checks; focused Vitest passed 2 files/6 tests; global `npx tsc --noEmit`, targeted ESLint, and targeted Prettier passed.

**Deterministic local evidence:** strict SigV4 existing-object readback; exact 256 KiB file/stream boundary and oversized rejection; invalid request-timeout rejection before provider I/O; deliberately hanging S3-compatible PUT/DELETE bounded rejection with no new object, preserved delete target, and cleanup; multipart image persistence, dimensions, signed URL readback, and deletion; failed mutation orphan rollback; SMTP delivery, retry budget/delay, exhaustion, invalid credentials, invalid timeout/retry configuration before connection, stalled greeting/socket bounded rejection, and no delivery. Retry and timeout caps are finite and documented in source.

**Cleanup and redaction:** the harness externally verifies tracked provider sockets close, no provider process remains, no `gap10-provider-continuity-*` directory remains, no local object remains beyond `public/files/.gitkeep`, and no synthetic object residue remains. Reports/logs/generated output contain no concrete synthetic credentials, SMTP body/recipient values, or reset message tokens. A prior scanner RED was a false positive on the public configuration key/error identifier `SMTP_PASSWORD`, not a credential value; the corrected value-only scan passed.

**Explicit external boundary:** the S3-compatible HTTP server and SMTP server are synthetic loopback wire emulators. No real S3 credentials, buckets, existing production objects, external SMTP account, external network, email deliverability, distributed retry coordination, staging deployment, production deployment, or provider-specific cutover was exercised. Local existing-object/readback and retry evidence must not be read as real-provider parity; password-reset redaction is not a claim of reset-enumeration or production auth parity. No GAP-10 closure or `READINESS.md` implication is made.

Provider files are now frozen and handed off for independent review at the exact aggregate above.

## Current next action

Checkpoints 026 and 027 are independently accepted within their secured-MCP and local-provider boundaries; GAP-10 remains external-partial and all frozen files stay unchanged. Continue serially in usable-parity order: GAP-01 arbitrary create/auth shapes plus an honest user-specific reproduction blocker, metadata-derived GAP-08 rollback matrices, GAP-12 human confirmation UX, GAP-11 critical route/error/accessibility states, then GAP-13 real access-policy/production cutover. Keep `READINESS.md` unchanged and do not imply closure from bounded checkpoints.

### 2026-07-24 — REVIEW CHECKPOINT READY 028: bounded GAP-01 arbitrary create/auth compatibility

**Claim boundary:** ready for formal oversight ledger review under the recorded runtime-disposition exception, not self-certified GAP closure. This checkpoint proves the frozen memory-adapter GAP-01 matrix for two materially different auth/model shapes across two clean-build passes. It does not reproduce the unavailable user-specific environment, does not produce realistic IDs, and makes no `READINESS.md`, release, broad-schema, external-database, or production claim.

**Accepted source boundaries and aggregates:** aggregates are SHA-256 over the lexically sorted file contents, matching the accepted runner reports.

- Product `ui.labelField` repair aggregate: `fe6c2572950ce76d558fc2aa5997598f63c4465e6f7d888719dc232045e51da1`.
  - `scripts/validate-cms-admin-meta.ts`: `232df7f0dc28b4c6da9c093de3f71441d196e3ff8b8ece98a2e9955ce586e3be`
  - `scripts/validate-cms-config.ts`: `45ab1bba189b770fb8104e3c5b57186ad8a8bd7210398820471099a67b1e1377`
  - `src/features/cms/config.ts`: `817d4745fc0baac32b150f7fe2f9da8996926b61f5c790f5618e8c72e7015c7a`
  - `src/features/cms/types.ts`: `612bde498b80d9f5599add057dc8bb044a822b75ead2b557315c0878ce461a2b`
- GAP-01 runtime-eight aggregate: `ee2f93e02389f01769273aef2aa76296a18851c91a936ded06e53d3f0f04cf1d`.
- Current nine-file aggregate including the authorized typed-catch test edit: `b14f165ac8edca140beaa11379433ebcc869164de586976eeb371237c850bea9`.
- Expanded eleven-file aggregate including declarations: `67cde5df31d2db955247db1845800c204c347a755b83ad747d25944842f767e4`.
  - `scripts/fixtures/gap01-nonzero-child.mjs`: `7dab8c41676964dcf8ae2880655d2f76b681efe107482f3a955ac59a3c43ac36`
  - `scripts/fixtures/gap01-overflow-child.mjs`: `22153d1cd0a624994762b9231b1e956e645de911b0b8765ae2b5c0d8c25d38c3`
  - `scripts/fixtures/gap01-stubborn-child.mjs`: `a8c9297e638cfbc3c7f723cb63065037d4038816edb7c16198456cb050d18e09`
  - `scripts/fixtures/gap01-successful-descendant.mjs`: `01f2a23fa8932f26366d71e38bd4fdaa9e3cf36256f549d08eb497431b840785`
  - `scripts/gap01-bounded-capture.d.mts`: `0016934e49f9bdb4611f28531373567f7b1230c0aa3b172038aea9dbe98dec8f`
  - `scripts/gap01-bounded-capture.mjs`: `180a6b28b35dfc3b362becc91c77fdae4d685dbef6cdb0c76f0ad6764abbf449`
  - `scripts/gap01-contract.d.mts`: `4f66fb49d2c656e6a8029e4153ad5ec9378aca149028483d9ac1717279b7ded5`
  - `scripts/gap01-contract.mjs`: `41d83364a3da2701202e6471d833d46a1673b9eaceff93875927664a55addb9b`
  - `scripts/gap01-user-probe-runner.mjs`: `9ab32542678598ecb6e21175cbae6ff81610ea99d7e7ccf7aa516c5871eb9bd5`
  - `scripts/validate-gap01-arbitrary-shapes.mjs`: `3893d3f93f36b53bf3fd9208cd1b6523d0e60d4ef8708fffd3ff802145a5cab8`
  - `tests/gap01-arbitrary-shapes.test.ts`: `4a7092269d9b7af1620696b91d1d936b6c42401641ad09005acfd1b8a164a731`
- Accepted checkpoint-017 responsive/Prisma/CUID boundary remained exact: `a61a761864c32bf5c2ace68c901bc74f656024a07950167f55737f875a712d33`.

The prior nine-file aggregate `b73eee3ef052348347bb232c61cedb273f9f594e10eef9d155110066bbcc1d58` is superseded only because the authorized typing repair changed the test member; all eight runtime files remained unchanged. Focused GAP-01 tests passed 28/28, global TypeScript passed with exact `.mjs` declarations and a typed `Gap01CapturedChildError` catch, and the stale non-evidence capture-test directory was removed.

**Accepted later runtime pair:** `/tmp/gap01-wrapper-authorized-20260724-202328.log` and `/tmp/gap01-wrapper-authorized-20260724-202328.report`, exit `0`. Before/after product, runtime-eight, current-nine, expanded-eleven, and `a61` hashes are exact. The copied source fingerprint was `68a2f8bdd26df91651798de54ce2135b0fe10524305cf478fc9c7bc3aec6c00b` for every shape. The built-in matrix completed:

- pass 1 `staff-inventory`: `Inventory`, `Memo`; artifact `ea355cf828134ba4e068d8e52b80b77c8d03e790a78fec20b3b1c1e18edfd210`; 544 events; 0 expected navigation aborts;
- pass 1 `operator-article`: `Article`, `QueueItem`; artifact `7b24a3458247381f91d3cff5b47cee78d9e865c193ad3a555c8972e97bcc1c0c`; 544 events; 0 expected navigation aborts;
- pass 2 `staff-inventory`: `Inventory`, `Memo`; artifact `aa5102898c1d7b1e371b24a4ae37c2eff5a7360c5da54c4eb6accd649466b823`; 544 events; 0 expected navigation aborts;
- pass 2 `operator-article`: `Article`, `QueueItem`; artifact `81f8d81078f170e14ff849bb9dd02ea5ee9618a1de1dce38d4e553ed3374ba84`; 544 events; 0 expected navigation aborts.

**Exact bounded browser assertions:** for each shape the frozen source proves pre-init availability, generic public auth metadata, post-signout signin navigation, anonymous `adminMeta` denial with `KS_ACCESS_DENIED`/access-denied semantics and no shape-list leakage, and a separately transported anonymous create denial using the generated input and mutation root. Authenticated metadata contains exactly the permitted creatable lists, omits the denied list and protected password-reset fields, and excludes hidden inaccessible scalar fields from editable create inputs. The matrix independently captures actual HTTP status/body, operation definition, generated create root, variables, response ID, returned ID, and route ID; it requires `DashboardCreate`, exact submitted values, independent returned-ID/route-ID equality, rendered persistence, and raw reload persistence. Invalid label/integer values classify as GraphQL validation failure. Denied-list query operations are omitted while direct create capability remains present and access-denied. No unexpected request, response, or console error was accepted.

**Product defect repair:** `normaliseList` now honors Keystone-standard `ui.labelField` for nonconventional scalar fields while preserving existing top-level `labelField` precedence and safe conventional/id fallback. Normalized UI metadata retains the resolved field. Focused normalization and AdminMeta validators, targeted lint/format, and exactly one product production build passed at the unchanged product aggregate. This repairs the real tenth-run Memo/Article normalization defect rather than weakening or renaming the fixture.

**Transparent protocol exception:** preserve and disclose `/tmp/gap01-wrapper-eleventh-20260724152037.log` and `/tmp/gap01-wrapper-eleventh-20260724152037.report`. Its actual gate log is also full GREEN: two passes × both shapes, each 544 events/0 aborts, with unchanged runtime sources. Its custom outer observer falsely labelled the envelope RED because it initially calculated `runtime8` from GAP-10 provider files and failed to parse the complete two-by-two summary. A later direct runner instruction produced the accepted pair above, so two actual gate invocations occurred despite the exact-one-invocation requirement. Oversight accepted this as an explicit operational exception because both executions were GREEN at unchanged boundaries, with no edits, concurrency, or retry-to-green behavior. This exception must remain visible and is not precedent for silent reruns.

**Cleanup and exclusions:** oversight independently verified no residual app, Firefox, WebDriver, GAP child, new fixture/profile/capture-test directory, or new evidence directory after process exit; historical named RED evidence remains preserved. Source cache fingerprints and marker checks passed within the frozen wrapper, and no source or accepted aggregate changed. The successful run removed its own evidence root. The user-specific failure remains explicitly **not reproduced** because the required fixture/configuration, command/commit, database/runtime, versions, and matching trace were not supplied. Memory-adapter IDs are synthetic; realistic Prisma/CUID evidence is cited only through the external accepted `a61a761…` boundary. GAP-01 remains bounded to these two shapes and this runtime, and `READINESS.md` remains unchanged.

## Current next action after checkpoint 028

Submit checkpoint 028 for formal oversight ledger review without rerunning or editing its frozen files. Once accepted, release the next serialized heavy slot to the metadata-derived GAP-08 relationship ownership/cardinality/rollback matrix, followed by GAP-12 human confirmation UX, GAP-11 critical route/error/accessibility states, and GAP-13 real access-policy/production cutover. No broad GAP-01 closure or user-specific reproduction claim follows from this checkpoint.

### 2026-07-27 — REVIEW CHECKPOINT READY 029: GAP-12 human approval wiring and GAP-11 field semantics

**Claim boundary:** ready for independent review, not GAP closure. This integrates the already accepted secured MCP boundary into the authenticated dashboard completion route and adds a deliberate human review step. It also repairs a concrete label/control defect across built-in dashboard field views. `READINESS.md` is unchanged.

**Replacement exact integrated 21-file aggregate:** `b9bdffe9adf6e2dac48b17289e81dceb49a40907034e74203ee8e74cb708a607`, calculated over lexically sorted paths as `filename + NUL + bytes + NUL`. It supersedes the initially submitted 19-file aggregate after independent review correctly reproduced action-tampering, nested-secret-summary, and composite-control naming blockers. The member paths are `scripts/validate-dashboard-completion.ts`; `src/components/dashboard/{ai-chat-sidebar,chat-mode,dashboard-layout,enhanced-form-fields,field-value-editor,file-field-editor,keystone-list-table,relationship-field-editor,rich-document-editor}.tsx`; all eight built-in view files changed here (`checkbox`, `document`, `json`, `number`, `password`, `select`, `text`, `timestamp`); `src/features/cms/dashboard-completion.ts`; `src/routes/api/completion.ts`; and `tests/dashboard-field-state-contracts.test.ts`.

**GAP-12 behavior:** authenticated prompts using explicit `create <list> <JSON>`, `update <list> {"where": {...}, "data": {...}}`, or `delete <list> <JSON>` syntax resolve lists and generated operations from access-filtered AdminMeta and re-evaluate operation access before proposal issuance; create also respects AdminMeta `hideCreate`. The first request only returns a pending proposal. The sidebar presents an accessible alert-dialog-style review card with the exact operation summary and separate Confirm/Cancel controls; cancellation records a no-change message. A process-local HMAC binds the full reviewed tool/list/operation/arguments/summary payload plus a unique issuance nonce and timestamp; confirmation rejects missing, expired, modified, or already-used proposals before MCP execution. Valid confirmation invokes the strict generated-operation MCP tool path with `confirmed: true`, retains MCP access/field/operation allowlisting and audit behavior, then invalidates dashboard queries. Recursive sensitive-key redaction covers direct and nested password/secret/token/credential/API-key values in summaries.

**GAP-11 behavior:** editable built-in text/textarea, JSON, checkbox, select/multiselect/segmented/radio, password, number/autoincrement, timestamp, document/Slate, relationship, and file/image controls now expose deterministic `field-<path>` targets. Read-mode labels no longer claim nonexistent controls. Base UI checkbox roots, list select-all/row selectors, segmented/radio groups with option names isolated from the outer field label, password confirmation/status, timestamp subcontrols, nullable select controls, AI prompt/send/close/toggle controls, and the visual Slate editor have explicit names, states, groups, or associations.

**Executable evidence:** final-source `npm run test:dashboard:ai` proves that AdminMeta-hidden editor create is rejected without operation proposal or MCP audit, ordinary proposal creation emits no MCP audit event, a tampered proposal and a replayed valid approval are rejected before MCP execution, valid confirmation creates persistent memory data through MCP, the allowed audit event exists, delete confirmation cleans up the created row, anonymous completion remains denied, and direct plus nested secret summary text is redacted. Focused Vitest passes the MCP suite plus 14 controller/markup tests, including explicit Base UI checkbox and composite-group naming contracts. The seeded Firefox dashboard flow passed at 390px while exercising the visible assistant proposal/cancellation card, field label targets, accessible names, keyboard focus, persistence, relationships, and zero unexpected request/response/console errors; its temporary assertions were removed afterward so the separately accepted checkpoint-017 aggregate returned exactly to `a61a761864c32bf5c2ace68c901bc74f656024a07950167f55737f875a712d33`. Final-source TypeScript passes; replacement aggregate lint/format/build/full-suite reruns are required by oversight before acceptance.

**Deliberately not claimed:** the completion parser is intentionally bounded explicit syntax, not an LLM or arbitrary natural-language planner. Approval state is client-carried and relies on the same authenticated/access-controlled mutation boundary; it is not a signed durable workflow or a substitute for authorization. No screen-reader session, complete keyboard traversal, zoom, high-contrast, reduced-motion, external provider, multi-instance audit, or production deployment is claimed. Independent review must rerun at the aggregate before either GAP status can advance.

## Current next action after checkpoint 029

Independently review the replacement 21-file aggregate and rerun the completion/security/field-markup/build gates without editing it. Then continue GAP-11 screen-reader/zoom/full-keyboard route states and GAP-13 real access-policy/production-shaped cutover. Keep the accepted checkpoint-017 browser aggregate unchanged and keep `READINESS.md` authoritative.

### 2026-07-27 — REVIEW CHECKPOINT READY 030: bounded production runtime baseline

**Claim boundary:** ready for independent review, not GAP-16 closure. This checkpoint adds a concrete Node/Nitro production baseline and an executable built-server check. It does not claim Linux/container portability, production load, complete observability, or deployment acceptance. `READINESS.md` is unchanged.

**Replacement exact 16-file aggregate:** `6f7e75e074e97827eaad111eb051b1d6b2dbd2a08fb41935fccb21a5c6ed75a1`, superseding earlier aggregates after independent probes exposed static-log noise, caller-controlled request-ID disclosure, chunked body-limit bypass, concurrent readiness work, and external-image CSP incompatibility. It is calculated over lexically sorted paths as `filename + NUL + bytes + NUL`. Members: `.env.example`, `docs/PRODUCTION.md`, `package.json`, `public/manifest.json`, `scripts/validate-production-baseline.mjs`, `src/features/cms/health.ts`, `src/routeTree.gen.ts`, `src/routes/__root.tsx`, `src/routes/api/{graphql,health,ready}.ts`, `src/server/{error-handler,nitro-plugin,request-limits,request-observability}.ts`, and `tests/cms-production-baseline.test.ts`.

**Runtime behavior:** `GET /api/health` is cache-disabled liveness without persistence I/O. `GET /api/ready` performs a sudo count through the configured generic first-list adapter and returns fixed HTTP 503 output on failure; its deadline is bounded to 100–30,000 ms with a 5-second default. Concurrent probes share at most one in-flight persistence operation, preventing timeout storms from multiplying uncancellable adapter work. Production responses receive CSP (`frame-ancestors 'none'`, `object-src 'none'`, same-origin defaults), frame denial, MIME-sniff prevention, permissions/referrer/COOP policy, and secure-request HSTS. Every response and structured error context receives a generated ID or deterministic hash of a syntactically safe caller ID, so arbitrary caller values are not reflected or logged. Production (or explicit `CMS_REQUEST_LOGS=1`) emits structured completion records for dynamic/API requests containing only request ID, method, pathname, status, and duration—never query strings, headers, cookies, or bodies. Successful known static roots and `/assets/` are excluded to bound volume and prevent asset names from polluting error signals; their 4xx/5xx failures remain logged, and dynamic paths remain logged even when they end in an asset-like extension.

**Limits and metadata:** declared or chunked GraphQL bodies above configurable `CMS_GRAPHQL_MAX_BODY_BYTES` (25 MiB default, minimum 1 KiB) receive structured HTTP 413 before Yoga parsing; accepted bodies are buffered up to that bound. CSP image sources include the validated `S3_ENDPOINT` origin and optional comma-separated HTTP(S) `CMS_CSP_IMG_ORIGINS`. Root metadata includes a professional title/description, light/dark theme colors, color scheme, favicon, touch icon, and corrected manifest. `docs/PRODUCTION.md` documents same-target build requirements, required runtime configuration, probes, logs, headers, the bounded validation command, and explicit remaining release gates.

**Executable evidence:** final-source `npm run build` passed and generated both routes. `npm run test:production:baseline` launched the built server in production mode on an ephemeral loopback port and passed liveness/readiness, fixed response shape, no-store, security headers/provider image origin, HSTS proxy behavior, hashed/generated request IDs, metadata, 413 rejection, structured request output, query-secret non-disclosure, successful-static suppression with static-404 logging, and owned process-group cleanup. The same gate first proves an abort deadline against a hanging HTTP response and bounded TERM-to-KILL group absence against a TERM-resistant descendant. Focused Vitest passes 7/7 helper/response/error-context tests, including declared and chunked oversize. The final built-source seeded Firefox gate passes 1,376 events with zero unexpected request/response/console errors after request buffering and static-log exclusion; TypeScript and targeted/full ESLint pass. Prettier passes on maintained files.

**Deliberately not claimed:** CSP currently permits inline scripts/styles required by the present hydration/theme path and is not a nonce-based strict CSP. Accepted GraphQL requests are buffered up to the configured cap; provider upload limits remain separate. Readiness timeout bounds the response and shares in-flight work but cannot cancel every underlying third-party driver operation. No target-Linux artifact, container image, cold-start budget, GraphQL depth/complexity analysis, representative load/pagination/pool exhaustion, distributed metrics/traces/alerts, external provider staging, production-sized migration, or disaster-recovery drill was executed.

## Current next action after checkpoint 030

Independently recompute and rerun checkpoint 030 on its exact aggregate. In parallel, finish checkpoint 029 review and GAP-15 classification. Next GAP-16 work should be a target-Linux/container build plus representative disposable-PostgreSQL load/failure evidence, not more helper-only expansion.

### 2026-07-27 — REVIEW CHECKPOINT READY 031: classified repository hard-code inventory

**Claim boundary:** ready for independent review, not GAP-15 closure. This is a static policy/inventory gate. It does not run a browser, server, or database and does not turn static fixture markers into runtime evidence. `READINESS.md` is unchanged.

**Exact three-file aggregate:** `0f7efce157f9c94aadb6204db0dd4bf525fca8fc84e5e2d7a3959513444907b9`, calculated over lexically sorted paths as `filename + NUL + bytes + NUL`: `scripts/gap15-hardcode-allowlist.json` (`5112594a…`), `scripts/validate-gap15-hardcodes.ts` (`432591eb…`), and `tests/gap15-hardcode-audit.test.ts` (`4071d81f…`).

**Policy behavior:** TypeScript AST traversal scans static string/template literals while excluding generated/build/dependency trees and the policy files themselves. Any starter model/list/route/seed/persona/generated-operation/migration/table literal in generic `src` outside demo models, shared `scripts/lib`, GAP-01/GAP-08 generic infrastructure, arbitrary-browser runners, or runtime-dependency checks is a hard failure and cannot be allowlisted. Elsewhere, every occurrence must belong to one exact `expected-demo` or `expected-source-oracle` file entry with a reason, expected count, and match fingerprint; new, removed, moved, recategorized, stale, duplicate, unsafe-path, source-oracle misuse, or fingerprint-drift entries fail.

**Current inventory and bounded bindings:** the checked inventory contains 300 direct literal matches in 47 classified files: 42 replaceable demo fixtures/contracts and five source-oracle/cutover files. Five evidence bindings verify exact source markers for the externally accepted two-shape AdminMeta memory-browser boundary, UUID schema generation, autoincrement schema generation, mapped list/field schema fixtures, and singleton memory/GraphQL wiring. Every binding records its evidence kind and browser scope; four explicitly have `browserScope: none`, and the arbitrary binding states that its browser evidence is external, memory-only, two-shape, and not realistic-ID breadth.

**Executable evidence:** six focused Vitest cases pass positive inventory and red cases for generic leakage, unclassified/stale entries, source-oracle misuse, fingerprint drift, and evidence-marker drift. Direct `npx tsx scripts/validate-gap15-hardcodes.ts`, repository TypeScript, full ESLint, Prettier, and the full 51-file/227-test suite pass.

**Deliberately not claimed:** the scanner recognizes a bounded starter vocabulary and static literals, not all possible semantic coupling. It does not execute or broaden the accepted arbitrary browser run. UUID, autoincrement, mapped, and singleton evidence is static or memory-only as explicitly labelled; there is no corresponding browser/PostgreSQL matrix here. Existing demo-specific primary acceptance remains classified rather than parameterized away. GAP-15 therefore remains in review and cannot close until those runtime/browser shapes are executable.

## Current next action after checkpoint 031

Independently review the exact scanner/allowlist/test aggregate and its red cases. After acceptance, wire the direct scanner command into the shared package gate without changing checkpoint 030 mid-review, then build browser/PostgreSQL fixtures for the four explicitly non-browser schema shapes.

### 2026-07-27 — CHECKPOINT 030 replacement after Review 036

**Claim boundary:** replacement submission for independent review only; GAP-16 and `READINESS.md` remain unchanged.

The exact 16-file checkpoint-030 aggregate is now `329b4740cc0fd48c9c935724f4223ed5c142da55764b9d884c262187ebcd34d8` using the existing lexical `filename + NUL + bytes + NUL` method. The only changed checkpoint member is `scripts/validate-production-baseline.mjs` at `6a4732147fdf607c5701ccf1d07888bc4ae0a1ecd8305a6ba354272cfef76f0c`. Its fetch deadline now remains active through complete response-body buffering rather than ending when headers arrive. The named gate includes an HTTP adversary that emits headers and a partial JSON body but never completes; the body read aborts within the configured deadline and owned sockets are destroyed. The gate, focused production tests 7/7, exact build, seeded Firefox acceptance (1,376 events; zero unexpected request/response/console errors), full Vitest 51/236, TypeScript, lint, format, and `cms:check` pass. This replacement does not broaden the production claims listed in checkpoint 030.

### 2026-07-27 — CHECKPOINT 031 replacement after Review 033

**Claim boundary:** replacement static-policy submission for independent review only; GAP-15 and `READINESS.md` remain unchanged.

The exact three-file checkpoint-031 aggregate is now `1220ee27b197211e95bd9f351a2cb3acfa481da4b468fc84647cbe30416101b7`: `scripts/gap15-hardcode-allowlist.json` `45a7f700ab0f8c69bd9333aa0087b9a268c1bd34405d9da8d7b700af58700da4`, `scripts/validate-gap15-hardcodes.ts` `1249bfaa44133a407eb19cf05a77623aabbd08b19b6aa0a781b5eda957dcc60b`, and `tests/gap15-hardcode-audit.test.ts` `06ec1f36e854a6d82658917ae6d4c72c895961d125b1c13a936abef1550162cf`. It addresses Review 033 with embedded GraphQL/generated tokens, statically folded strings/templates, model identifiers, root config collection, strict runtime enum/schema validation, fail-closed path ownership, comment-free executable evidence markers, and whole-source fingerprints. Twelve adversarial/positive focused tests pass. The current inventory is 620 assumptions across 48 exact files (42 demo, six source-oracle) with five bounded bindings and zero scanner browser/database runs.

Generic dashboard signup and reset routes now derive create/auth/reset operation and field names from public auth metadata, and the generic-auth regression uses an arbitrary `Account` contract. Those generic files have no starter assumptions and were removed from both approved demo-path policy and the allowlist rather than rubber-stamped. Direct scanner, full 51-file/236-test Vitest, TypeScript, lint, format, `cms:check`, and production build pass. This remains a bounded static vocabulary and does not establish the missing browser/PostgreSQL schema-shape matrix.
