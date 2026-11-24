# Independent parity remediation oversight

**Reviewer role:** Independent continuous reviewer. This file does not implement product fixes and does not replace `READINESS.md` or `docs/PARITY_GAP_DISSERTATION.md`.

**Review boundary:** Only explicit `REVIEW CHECKPOINT READY` ledger entries are eligible for closure review. Source, tests, generated-artifact behavior, runtime evidence, cleanup, and any proposed `READINESS.md` change are reviewed directly. A passing summary is not evidence by itself.

## Standing acceptance rules

- Reviews optimize for usable parity: prioritize product-breaking defects, security/data-loss/runtime safety, direct Keystone/source parity, executable consumer workflows, and genuine false-pass risks. Minor evidence polish and speculative harness hardening are bounded or deferred when they do not threaten those outcomes.
- Product slices may proceed in parallel with bounded gate remediation; a noncritical harness detail must not become an open-ended prerequisite for Openfront runtime cutover, schema-loop, custom-view/field-zoo, or advanced document/relationship work.
- Findings are classified **BLOCKING**, **IMPORTANT**, or **VERIFIED**.
- Runtime/browser/database gaps cannot be verified from static inspection alone.
- Repaired acceptance harnesses require two consecutive clean-build passes from the exact checkpoint source.
- Applicable create coverage requires seeded memory, fresh memory, and disposable Prisma evidence, including the submitted mutation, response, returned ID, persisted reload, and cleanup.
- Todo-only, fixed-ID, fixed-auth-field, stale-`.output`, oversized-viewport, swallowed-error, or source-only evidence is not exhaustive parity.
- Browser/Prisma checks must be bounded and must leave no matching app, browser, database, profile, or temporary artifact behind.
- No `READINESS.md` change is accepted unless reconciled row-by-row with the dissertation release matrix.

## Ledger watch state

- Last ledger review: 2026-07-24, through `REVIEW CHECKPOINT READY 028`.
- Formal checkpoint entries observed: **28**; superseded/replacement status is recorded in the reviews below.
- Checkpoint 015's sibling boundary remains current and was reviewed at exact hash `5d7d01d94ad4bb356ded22c18b69dcfb7477aa98e82b9d7abd4719c25955c8ed`. Responsive and GAP-04 executions passed during review, but their published hashes are now explicitly non-current because parallel field-zoo isolation changed shared `scripts/validate-dashboard-browser.mjs` and `vite.config.ts`; replacement hashes including `vite.config.ts` and exact-hash reruns are required.
- Checkpoint 016 was inspected and independently executed at historical formatted hash `887530d38636ad55cc1ce298503342d446794c4522c259429f4d16ccff1699b3`, then explicitly marked **SUPERSEDED / CHANGES REQUIRED** in the ledger. Subsequent two-profile generalization moved the script; `887530…` is backend evidence only, not a current acceptance boundary.
- Current moving-tree hashes at the end of these reviews:
  - `scripts/validate-dashboard-browser.mjs`: `72d6111932012c1350812ef253235da2866418260d743c88075b2a9510bc708a`
  - `scripts/validate-openfront-runtime-canary.mjs`: `f71f343f2984e6f84b87037b5ce69ca05d3a343342db2731c0a72bfacdd939cb`
  - `package.json`: `23ee425d6ef4025f8d3ccbc73f42880b437fb676e6967fcde43e9dbac15503ea`
  - `docs/PARITY_REMEDIATION_PROGRESS.md`: `d0f9d3de2ca7dc4e2d0e74e002952678ba5fa0f99795a4ac059ddbdb35682126`

## Review 001 — GAP-01 pointer/observer harness foundation

**Status:** **CHANGES REQUIRED; GAP-01 remains open.** This is a provisional review of the known first checkpoint context because no formal checkpoint marker existed and the source was already being extended.

**Inspected directly**

- `scripts/validate-dashboard-browser.mjs` (all 958 lines at inspection time)
- `package.json:29`
- Relevant dissertation requirements: GAP-01, GAP-03, GAP-04, GAP-15, and release matrix “P0 create”

### BLOCKING

1. **The special Todo create path does not prove create-time persistence before it mutates the record.**
   - `scripts/validate-dashboard-browser.mjs:598-613` captures `createTodo`, asserts only `variables.data.label`, the HTTP/error/ID checks shared by `captureGraphQLMutation`, and visible label text.
   - It does not reload the just-created Todo before beginning the update at `scripts/validate-dashboard-browser.mjs:616`. The later navigation/reload occurs only after label, document, and relationship values have been changed and saved.
   - The create request does not assert the submitted document or initial `assignedTo` relationship, and the created document/relationship are not queried or reloaded before update. Consequently this can pass if create silently drops those fields.
   - Required before accepting this checkpoint: assert the relevant `createTodo` variables, navigate/reload the returned ID before any update, and assert persisted label, initial document structure/content, and initial relationship. Keep the later update evidence separate.

2. **The required two clean-build passes do not apply to current checkpoint source.**
   - `package.json:29` correctly builds before the browser script, but source was subsequently changed for the all-list matrix and a focused current-source run failed before being patched.
   - No current formal checkpoint has two clean passes. Do not cite the earlier two runs for the newer source and do not close GAP-01.
   - Required at the formal checkpoint: two consecutive bounded `rm -rf .output && npm run test:dashboard:browser` passes from an unchanged source hash, followed by process/profile cleanup checks.

### IMPORTANT

1. **The fetch hook is behavior-preserving in payload identity but not in timing.**
   - `scripts/validate-dashboard-browser.mjs:166-189` awaits the original fetch and then awaits `response.clone().json()` before returning the original `Response` to application code.
   - This does not consume the original body, but it delays the application response until observer parsing completes and can turn observer slowness into application slowness. Evidence should not materially alter the path it certifies.
   - Prefer returning the original response without waiting for clone parsing, while tracking a bounded evidence promise separately. At minimum, document and test the observer failure path.

2. **Restoration is well attempted but not literally unconditional.**
   - The normal and action-failure paths restore `globalThis.fetch` in `captureGraphQLMutation`’s `finally` (`scripts/validate-dashboard-browser.mjs:208-234`). This is good.
   - Installation occurs before the `try` at line 209, and restoration itself depends on successful BiDi `evaluate` calls. A partially successful installation followed by an evaluation/protocol failure is not covered by a direct regression assertion.
   - Add a focused negative-path check that deliberately throws inside the captured action, then proves `globalThis.fetch ===` the pre-capture reference and that evidence globals are deleted while the browsing context is still alive.

3. **The direct script remains capable of stale-output evidence.**
   - `scripts/validate-dashboard-browser.mjs:888` checks only that `.output/server/index.mjs` exists. The package command builds first, but `node scripts/validate-dashboard-browser.mjs` does not.
   - The ledger correctly distinguishes the direct run as focused proof. Never promote it to current-source acceptance, and make output provenance explicit if direct invocation remains supported.

### VERIFIED (static/structural only)

1. `clickNode` calls element `scrollIntoView({ block: 'center', inline: 'center' })` before trusted BiDi pointer actions (`scripts/validate-dashboard-browser.mjs:248-280`); no oversized viewport workaround is present.
2. Each BiDi command has a 30-second timeout and clears its pending timer on response (`scripts/validate-dashboard-browser.mjs:71-114`).
3. Repository search found no `network.addDataCollector`, `network.getData`, or `network.removeDataCollector` usage in the browser harness.
4. The observer scopes capture to same-origin `/api/graphql` requests whose query contains `mutation DashboardCreate`; it clones rather than consumes the application response and records request, parsed response, and status (`scripts/validate-dashboard-browser.mjs:159-190`).
5. Captured creates assert HTTP 200, no GraphQL `errors`, and a returned item ID (`scripts/validate-dashboard-browser.mjs:208-229`).
6. `package.json:29` runs `npm run build` before the browser harness, so that named package gate does not intentionally consume stale `.output`.
7. A post-failure bounded cleanup inspection found no matching browser-test Node process, `.output/server/index.mjs` app process, test Firefox process, or `tks-firefox-*` profile. This is cleanup evidence only, not behavioral verification.

### Reviewer commands

Static and cleanup-only commands run after the implementation command was no longer active:

```text
wc -l scripts/validate-dashboard-browser.mjs docs/PARITY_REMEDIATION_OVERSIGHT.md
rg -n "network\.(addDataCollector|getData|removeDataCollector)|__dashboardOriginalFetch|scrollIntoView|Timed out waiting for" scripts/validate-dashboard-browser.mjs
rg -n "startGraphQLMutationCapture|stopGraphQLMutationCapture|captureGraphQLMutation|scrollIntoView|class BidiClient|command\(|function stopProcesses|await access\(serverEntry\)|assert\.doesNotMatch\(appLog|createNetworkEvidence|persistedDocumentResponse|test:dashboard:browser" scripts/validate-dashboard-browser.mjs package.json
shasum -a 256 scripts/validate-dashboard-browser.mjs package.json docs/PARITY_REMEDIATION_PROGRESS.md
ps -axo pid,ppid,etime,command | rg "node scripts/validate-dashboard-browser|npm run test:dashboard:browser|vite build|\.output/server/index\.mjs|Firefox.app/Contents/MacOS/firefox --headless --no-remote --profile .*/tks-firefox-" || true
find "${TMPDIR:-/tmp}" -maxdepth 1 -type d -name "tks-firefox-*" -print
```

No reviewer browser run was started because the implementation source was changing, no formal checkpoint was ready, and the latest focused run had just failed. Runtime status remains unverified by oversight.

## Review 002 — REVIEW CHECKPOINT READY 001

**Status:** **CHANGES REQUIRED.** The seeded-memory browser harness is materially stronger and passed independent runtime verification, but the checkpoint cannot be accepted while it globally filters server errors and leaves submitted all-list values unverified. GAP-01 and GAP-04 remain open.

**Inspected directly**

- `scripts/validate-dashboard-browser.mjs` (all 1,045 lines)
- `src/server/error-handler.ts` (all 95 lines)
- `src/server/nitro-plugin.ts` (all 28 lines)
- `tests/nitro-error-handler.test.ts` (all 107 lines)
- `vite.config.ts`, `package.json:29`, generated `.output/server/index.mjs` behavior, and the checkpoint ledger entry
- Aggregate source hash independently recomputed as `4a9cb7771e56fd6001707e8c7e4398aa89907e97232b00a0d7b7ed591df3ef18`

### BLOCKING

1. **A process-global `console.error` monkeypatch swallows errors using an overbroad stack heuristic.**
   - `src/server/nitro-plugin.ts:13-21` permanently replaces `console.error` for the whole process. This is outside Nitro's supported error-handler/hook boundary and affects unrelated application, dependency, background-task, and process-level logging.
   - `src/server/error-handler.ts:41-49` calls a stack “exact srvx response-close” but checks only `AbortController.abort` and `ServerResponse.<anonymous>`; it does not require an srvx/H3 module path, the expected message, or request context.
   - Independent focused proof constructed an application-originated `DOMException` whose synthetic stack contained those two generic frames but no srvx path; `shouldSuppressExpectedAbortLog([error])` returned `true`. That application error would be discarded globally.
   - This violates the dissertation's rejection of swallowed-error evidence and cannot be accepted merely because five browser loops became quiet.
   - Required: remove process-global console replacement. Handle cancellation through a supported request/error boundary or an upstream/pinned framework fix. If no supported boundary can prevent H3's pre-hook log, record a precise external framework blocker rather than muting global logging. Any fallback classifier must require framework provenance and live request-disconnect state, not generic stack labels alone.

2. **Genuine server-error reporting and response semantics have no executable production-runtime test.**
   - `vite.config.ts:14-18` replaces Nitro's built-in error handler and adds a plugin. `handleNitroRequestError` returns `undefined` for every genuine failure (`src/server/error-handler.ts:82-95`), while the plugin sets H3 `silent = true` and relies on an error hook for reporting (`src/server/nitro-plugin.ts:12,23-27`).
   - The eight unit tests exercise classifier helpers only. They do not instantiate the plugin, prove the hook is registered, prove a genuine runtime exception emits `[cms][server-error]`, or prove the replacement handler preserves the intended HTTP status/body/headers.
   - The browser flow proves only an error-free application path after log filtering. It cannot detect that real errors became silent.
   - Required: a bounded production-output fault-injection test must trigger a controlled genuine server exception and assert its HTTP contract and visible server log, then trigger the exact disconnect case and assert only that expected cancellation is omitted. Preserve Nitro's default handling explicitly for non-cancellation errors.

3. **The all-list persistence claim can pass while submitted fields are silently dropped.**
   - User create asserts request `name`, `email`, and `password`, but after create/reload checks only the email input (`scripts/validate-dashboard-browser.mjs:539-580`). It does not prove name persistence or `password { isSet }`/successful authentication.
   - Todo Image create asserts request `imagePath` and `altText`, but after create/reload checks only `altText` (`scripts/validate-dashboard-browser.mjs:586-613`). It does not prove `imagePath` persistence.
   - The Todo path now correctly proves all submitted create-time values before update; Role has only its submitted name in this scenario.
   - Required: after returned-ID reload, query/assert User name, email, and password state (or authenticate as the new user where appropriate), plus Todo Image imagePath and altText. Do not describe plural “values persisted” until all values submitted by each scenario are checked.

### IMPORTANT

1. **Current-build provenance is enforced by convention, not an artifact fingerprint.**
   - `package.json:29` builds first, which is valid for the named gate. `DASHBOARD_BROWSER_CURRENT_BUILD=1` is only a caller-controlled marker; setting it manually can still run stale `.output`.
   - Keep direct marker-based stress runs explicitly diagnostic. Never cite them as current-source evidence, and retain hash checks around formal passes.

2. **The observer is not actually origin-scoped.**
   - `scripts/validate-dashboard-browser.mjs:172-177` resolves a URL and checks only `url.pathname === '/api/graphql'`; it does not compare `url.origin` with `location.origin` despite the ledger's “same-origin” wording.
   - Add the origin comparison or narrow the claim. This is test instrumentation, but it should not capture a matching cross-origin request.

3. **This remains fixed-demo evidence, not model-agnostic GAP-01 closure.**
   - Routes, list names, labels, Ada credentials, `user_admin`, and field selectors are fixed in `scripts/validate-dashboard-browser.mjs`.
   - That is acceptable only for the checkpoint's explicit “current seeded-memory foundation” boundary. GAP-01 still requires fresh memory, disposable Prisma, realistic IDs, permitted-list discovery/AdminMeta parameterization, and cleanup evidence. Do not generalize this pass to arbitrary consumers or auth models.

4. **Disconnect classification treats `req.destroyed`/`res.destroyed` as sufficient state.**
   - `src/server/error-handler.ts:51-58` can classify any AbortError as expected once a Node request/response is destroyed, even if destruction followed a genuine application abort.
   - Prefer `signal.aborted`, explicit request `aborted`, or the narrowly proven framework close signature; if destroyed state remains, include completion/writable-finished guards and negative tests.

### VERIFIED

1. **Review 001 Todo persistence blocker is resolved.** The `createTodo` request asserts label, heading type/level/text, and `assignedTo.connect.id`; the returned-ID route is reloaded before any update; UI and raw GraphQL then assert label, document text, and Ada relationship (`scripts/validate-dashboard-browser.mjs:648-703`).
2. **Observer timing/restoration improved.** The wrapper returns the original `Response` immediately and parses only a clone asynchronously (`scripts/validate-dashboard-browser.mjs:163-195`). Installation is inside `try`, normal cleanup remains in `finally`, and a deliberate action failure proves original fetch identity plus global cleanup in the live context (`scripts/validate-dashboard-browser.mjs:214-276`).
3. **Network result assertions are meaningful for the covered creates.** Each captured mutation requires a parsed response or explicit capture error, HTTP 200, no GraphQL errors, and a returned ID matching the item route (`scripts/validate-dashboard-browser.mjs:214-242,464-482`).
4. **Geometry and bounds remain repaired.** Pointer actions scroll the element into a 1440×2000 viewport; BiDi commands have 30-second deadlines; unsupported collector APIs are absent.
5. **Two formal clean-build passes were recorded at the unchanged aggregate hash, and oversight independently ran one additional bounded clean-build pass.** Independent command `rm -rf .output && npm run test:dashboard:browser` passed with 685 observed events, one expected Firefox navigation abort, and zero captured browser request/response/console errors. This verifies the narrow seeded-memory behavior, not the correctness of global server-log filtering.
6. **Focused unit suite independently passes.** `npx vitest run tests/nitro-error-handler.test.ts` passed 8/8.
7. **Cleanup passed after independent runtime verification.** No matching browser harness, Nitro app, test Firefox process, or `tks-firefox-*` profile remained. The aggregate implementation hash remained `4a9cb7…` after the run.
8. No dependency was added, `READINESS.md` was not edited, and GAP-01/GAP-04 remain marked open in the checkpoint claim.

### Reviewer commands

```text
shasum -a 256 scripts/validate-dashboard-browser.mjs package.json src/server/error-handler.ts src/server/nitro-plugin.ts tests/nitro-error-handler.test.ts vite.config.ts
npx vitest run tests/nitro-error-handler.test.ts
npx tsx -e "...synthetic non-srvx AbortError classifier assertion..."
rm -rf .output && npm run test:dashboard:browser
rg -n "Firefox dashboard acceptance passed|AbortError|server-error|AssertionError|ERR_" /tmp/oversight-checkpoint-001-browser.log
ps -axo pid,ppid,etime,command | rg "node scripts/validate-dashboard-browser|npm run test:dashboard:browser|.output/server/index.mjs|Firefox.app/Contents/MacOS/firefox --headless --no-remote --profile .*/tks-firefox-" || true
find "${TMPDIR:-/tmp}" -maxdepth 1 -type d -name "tks-firefox-*" -print
```

## Review 003 — REVIEW CHECKPOINT READY 002

**Status:** **CHANGES REQUIRED.** Review 002's global-console, production fault-route, genuine-error, and submitted-value blockers are substantively resolved. Two narrower release-quality blockers remain in disconnect classification and standalone fault-gate artifact cleanup. GAP-01 and GAP-04 remain open.

**Inspected directly**

- `scripts/validate-dashboard-browser.mjs` (all 1,187 lines)
- `scripts/validate-nitro-error-runtime.mjs` (all 218 lines)
- `src/server/error-handler.ts`, `src/server/nitro-plugin.ts`, `src/server/parity-fault-handler.ts`, and `src/server/parity-fault-state.ts` (all lines)
- `tests/nitro-error-handler.test.ts` (all 138 lines)
- `vite.config.ts`, `package.json`, ordinary and fault-injected `.output/server` contents, and checkpoint 002's ledger claim
- Aggregate checkpoint hash independently recomputed as `6f0c30798478a9a038dcb3087a291eb7b2507036c4037c86a1737da90e4977e8`

### BLOCKING

1. **The classifier still contains unobserved, test-shaped disconnect fallbacks that can suppress an application AbortError.**
   - The real raw-socket production observation is strong: `signalAborted=true`, `requestAborted=true`, `cause.code=ECONNRESET`, message `aborted`, and an unfinished destroyed response.
   - Despite those observed authoritative flags, `requestDisconnectState` also treats `requestDestroyed && requestComplete === false` or `responseDestroyed && writableEnded === false && writableFinished === false` as sufficient by themselves (`src/server/error-handler.ts:52-71`).
   - Independent focused proof supplied an application-originated `AbortError` with `signal.aborted=false`, `req.aborted=false`, a complete/live request, and only a server-destroyed unfinished response. `isExpectedRequestAbort` returned `true`, so Nitro's sole error hook would keep it quiet.
   - This is the same class of swallowed-error risk as Review 002, moved from stack matching to speculative socket-state matching. It is not justified by the observed hook shape.
   - Required: classify from the transport error plus authoritative live disconnect flags actually observed (`event.req.signal.aborted` and/or Node `req.aborted`). Remove destroyed-only fallbacks, or provide direct framework evidence and a negative production-runtime fault proving a server-destroyed response plus application AbortError remains reportable. Add the independent counterexample as a unit regression.

2. **`npm run test:nitro:errors` leaves a fault-injected production bundle in `.output`.**
   - The build-time route condition is correct, and ordinary builds omit the endpoint. However the standalone named gate builds with `CMS_PARITY_FAULT_INJECTION_BUILD=1` and exits after runtime verification without removing or replacing `.output`.
   - Independent execution passed, then direct scan found `PARITY_TEST_GENUINE_SERVER_ERROR` and `/__parity/fault` in `.output/server/index.mjs`. This is a stale test artifact with a conditionally dangerous route, even though runtime injection requires a second environment flag.
   - Oversight restored an ordinary build and rechecked omission; the gate itself must own that cleanup on success and failure.
   - Required: orchestrate the conditional build/runtime in a bounded `try/finally` that removes the injected output or restores an ordinary output, then assert no fault marker remains. Do not depend on a later browser command to overwrite it.

### IMPORTANT

1. **Normal production still bundles test-observation bookkeeping.**
   - The route and fault marker are omitted, but `src/server/nitro-plugin.ts` statically imports `parity-fault-state`, so ordinary `.output/server/index.mjs` contains `disconnectRequestsStarted`, `lastHookObservation`, and the `CMS_PARITY_FAULT_INJECTION` check.
   - More importantly, the plugin constructs the complete observation object on every Nitro error before the recorder no-ops in normal production.
   - Guard observation construction before allocation or separate the test observer at build time. This is not an exposed endpoint, but test-only instrumentation should not tax the ordinary error path.

2. **GAP-04 stress coverage remains bounded.**
   - The raw-socket disconnect gate proves one exact Node/Nitro error shape and the browser harness now avoids accidental cancellations by waiting for network idle.
   - The dissertation still requires repeated create/item/list navigation under in-flight/throttled queries with request correlation. Keep GAP-04 open as the ledger states.

3. **The current browser matrix remains fixed-demo evidence.**
   - Full submitted-value persistence is now credible for the four current seeded lists, but list/auth names and IDs remain fixed. Fresh memory, disposable Prisma, realistic IDs, and AdminMeta-driven portability are still required for GAP-01.

### VERIFIED

1. **The process-global console replacement and stack suppression are gone.** Repository search found no `console.error =`, `shouldSuppressExpectedAbortLog`, or `isNodeResponseCloseAbort` implementation.
2. **Genuine production errors remain visible and retain response semantics.** Independent `npm run test:nitro:errors` passed: the injected genuine fault returned JSON 500 with `error: true`, `status: 500`, and `unhandled: true`, while `[cms][server-error]` plus the controlled marker was observed.
3. **A real transport disconnect reaches the supported Nitro hook.** The gate starts a raw Node HTTP request, waits until the handler records entry, destroys its socket, and records `HTTPError`/`aborted` with `cause.code=ECONNRESET`, authoritative aborted flags, and unfinished response state. That exact case remains quiet and the app survives.
4. **The fault route is omitted from ordinary production output.** `vite.config.ts` includes it only when `CMS_PARITY_FAULT_INJECTION_BUILD=1`. Both author and independent ordinary-output scans found no route/marker; an ordinary server returns 404 at the path.
5. **Review 002 all-list persistence blocker is resolved.** User reload asserts name/email/ID and authenticates with the submitted password; Todo Image reload asserts imagePath/altText/ID in UI and raw GraphQL. Todo and Role evidence remains intact.
6. **The observer now enforces `url.origin === location.origin`.**
7. **Navigation synchronization removes the harness-generated abort in the covered flow.** Two formal clean-build passes reported 1,376 events and zero navigation aborts. After an independently restored ordinary build, oversight's bounded direct browser run passed with the same 1,376-event, zero-abort result and all network/console checks clean.
8. **Focused tests pass.** Oversight independently ran `npx vitest run tests/nitro-error-handler.test.ts` (10/10) and the production fault gate. The aggregate source hash remained unchanged.
9. **Cleanup of live resources passed.** No matching fault harness, browser harness, Nitro app, Firefox process/profile, or temporary profile remained after oversight runs. Oversight restored ordinary `.output` after demonstrating the standalone gate's stale artifact.
10. `READINESS.md` is unchanged; checkpoint 002 correctly leaves GAP-01 and GAP-04 open.

### Reviewer commands

```text
npx vitest run tests/nitro-error-handler.test.ts
npx tsx -e "...application AbortError plus response-destroyed-only classifier counterexample..."
npm run test:nitro:errors
rg -n "PARITY_TEST_GENUINE_SERVER_ERROR|/__parity/fault" .output/server
npm run build
rg -n "PARITY_TEST_GENUINE_SERVER_ERROR|/__parity/fault" .output/server
DASHBOARD_BROWSER_CURRENT_BUILD=1 node scripts/validate-dashboard-browser.mjs
ps -axo pid,ppid,etime,command | rg "validate-dashboard-browser|validate-nitro-error-runtime|.output/server/index.mjs|Firefox.app/Contents/MacOS/firefox --headless --no-remote --profile .*/tks-firefox-" || true
find "${TMPDIR:-/tmp}" -maxdepth 1 -type d -name "tks-firefox-*" -print
```

## Review 004 — REVIEW CHECKPOINT READY 003

**Status:** **CHANGES REQUIRED.** Review 003's classifier, stale-output, and normal-build instrumentation findings are resolved and independently reproduced. One bounded-process cleanup defect remains in the fault gate's build-timeout path. GAP-01 and GAP-04 remain open.

**Inspected directly**

- `scripts/validate-nitro-error-runtime.mjs` (all lines)
- `src/server/error-handler.ts`, ordinary `nitro-plugin.ts`, conditional `parity-fault-plugin.ts`, fault handler/state, unit tests, Vite condition, package command, and browser ordinary-output scan
- Checkpoint aggregate hash independently recomputed as `9e40b54ef5ad0a6aa8eba7ad47ef499c436d6fc5407f61e5ea9cb9e4aef56e3c`

### BLOCKING

1. **The fault gate's build timeout can still leak the detached build process and recreate deleted output.**
   - `buildFaultOutput()` starts `npm run build` with `detached: true`. Its 180-second timer sends one `SIGTERM` to the process group and immediately rejects (`scripts/validate-nitro-error-runtime.mjs:33-66`).
   - It does not wait for exit, apply a grace period, send `SIGKILL`, or confirm the process group is gone. The outer `finally` can therefore remove `.output` while a build that ignored/delayed SIGTERM is still writing, after which that process can recreate the fault-injected bundle.
   - This is the same failure class as the original 240-second collector hang that leaked app/Firefox processes. A timeout is not clean merely because `reject()` returns control.
   - Required: use a bounded child runner that on timeout sends group SIGTERM, awaits a short grace period, sends group SIGKILL if still alive, awaits `exit`/`close`, and only then lets outer artifact cleanup proceed. Add a short forced hanging-build/process fixture so timeout cleanup is executable without waiting 180 seconds; assert no child/process group and no `.output` remain.

### IMPORTANT

1. `stopApp()` also sends SIGKILL without awaiting the final exit event. Current runs show no leak, but the shared bounded-child cleanup should await termination consistently for both build and app children.
2. GAP-04 is not closed by this checkpoint. The accepted classifier/fault evidence covers one raw Node disconnect; repeated throttled dashboard navigation with correlation remains outstanding exactly as the ledger states.

### VERIFIED

1. **Destroyed-only classifier fallbacks are removed.** `disconnected` now depends solely on `event.req.signal.aborted || node.req.aborted`. The independent application-AbortError/unfinished-response counterexample is a passing regression and remains reportable.
2. **Transport classification remains narrow.** Only an `AbortError` in the cause chain or exact `ECONNRESET` plus message `aborted`, combined with an authoritative abort flag, is quiet. Genuine errors on aborted requests remain reportable.
3. **Normal production error handling is cleanly separated from test observation.** The ordinary plugin imports no parity state; the conditional fault plugin alone records observations. Ordinary output contains no fault marker, route, observation identifiers, or fault environment identifier.
4. **The fault gate owns artifact cleanup on normal success and ordinary injected failure.** Author probes showed `.output` absent after both. Oversight independently ran `npm run test:nitro:errors`; it passed and left `.output` absent.
5. **Independent production evidence remains green.** The genuine fault retained JSON 500 plus a visible server log; the raw socket disconnect reached the hook with authoritative flags and stayed quiet.
6. **Independent browser evidence remains green.** Oversight ran `npm run test:dashboard:browser` after the fault gate; it rebuilt ordinary output and passed 1,376 observed events with zero navigation aborts and zero unexpected request/response/console errors.
7. **Two author clean-build browser passes used the unchanged checkpoint hash.** Focused unit tests pass 11/11.
8. Post-run process/profile checks were clean, ordinary `.output` was restored, and the aggregate source hash remained unchanged.
9. `READINESS.md` remains unchanged; GAP-01/GAP-04 remain open.

### Reviewer commands

```text
npx vitest run tests/nitro-error-handler.test.ts
npm run test:nitro:errors
 test ! -e .output
npm run test:dashboard:browser
rg -n "PARITY_TEST_GENUINE_SERVER_ERROR|/__parity/fault|disconnectRequestsStarted|lastHookObservation|CMS_PARITY_FAULT_INJECTION" .output/server
ps -axo pid,ppid,etime,command | rg "validate-dashboard-browser|validate-nitro-error-runtime|npm run build|.output/server/index.mjs|Firefox.app/Contents/MacOS/firefox --headless --no-remote --profile .*/tks-firefox-" || true
```

## Review 005 — REVIEW CHECKPOINT READY 004

**Status:** **VERIFIED for the checkpoint's bounded process-lifecycle claim.** No blocking finding remains in Review 004 remediation. This does not close GAP-01 or GAP-04.

**Inspected directly**

- `scripts/validate-nitro-error-runtime.mjs` (all lines)
- `scripts/fixtures/hanging-fault-build.mjs` (all lines)
- Checkpoint ledger, aggregate hash, process state, and `.output` state

### IMPORTANT

1. `runBoundedChild()` verifies full process-group cleanup on timeout, but if the leader exits nonzero before timeout it throws without checking for surviving descendants. `npm` normally waits for its build child, so this does not invalidate the exercised timeout blocker. Before generalizing this runner, apply the same group-absence/termination check to nonzero close outcomes.

### VERIFIED

1. **Timeout cleanup is now ordered and bounded.** The detached runner races close against timeout; timeout invokes group SIGTERM, bounded grace, group SIGKILL when needed, awaited close, then group-absence polling before outer artifact removal.
2. **App cleanup uses the same awaited primitive.** It no longer sends SIGKILL and returns without confirming exit.
3. **The hanging fixture is behaviorally meaningful.** It ignores SIGTERM and rewrites the fault marker every 25ms, so passing cleanup requires actual KILL escalation before `.output` removal.
4. **Oversight independently reproduced the forced hang path.** It exited 1 with the expected TERM/KILL diagnostic; no `hanging-fault-build.mjs` process/group and no `.output` remained.
5. **Oversight independently reran the normal fault gate.** Genuine JSON 500/log and authoritative disconnect evidence passed; no app/build process or `.output` remained.
6. Focused abort tests pass 11/11 and the aggregate source hash independently matches `863fa37979b27c3d9939f5ad3e9b1a64166e12929147a351fbf61771423a0b53`.
7. Two author clean-build browser passes at that exact hash remain valid: 1,376 events, zero navigation aborts, zero unexpected browser request/response/console errors.
8. `READINESS.md` remains unchanged and the checkpoint correctly keeps GAP-01/GAP-04 open.

### Reviewer commands

```text
CMS_PARITY_FAULT_HANGING_BUILD_PROBE=1 node scripts/validate-nitro-error-runtime.mjs
ps -axo command | rg "[h]anging-fault-build\.mjs"
test ! -e .output
npm run test:nitro:errors
test ! -e .output
npx vitest run tests/nitro-error-handler.test.ts
ps -axo pid,ppid,etime,command | rg "hanging-fault-build|validate-nitro-error-runtime|npm run build|.output/server/index.mjs" || true
```

## Review 006 — REVIEW CHECKPOINT READY 005

**Status:** **VERIFIED for the declared current-list seeded/fresh/Prisma matrix and the covered 390px real-ID repair.** No blocking finding was found within this checkpoint boundary. GAP-01, GAP-03, and GAP-04 are not closed by this evidence.

### IMPORTANT

1. **The matrix remains demo-shaped.** List routes, fields, labels, seed identities, and auth field names are fixed. The ledger correctly keeps GAP-01 open pending AdminMeta-driven permitted-list discovery and arbitrary model/auth fixtures.
2. **Responsive evidence is one repaired state at one mobile width.** The real CUID item route now passes at 390px, but dissertation acceptance still requires 320/375/390/768/desktop across home/list/create/item/dialog/sidebar states with varied long data. Keep GAP-03 open/in review and do not reconcile READINESS's broad mobile claim yet.
3. `runBoundedChild(captureOutput)` buffers output without a size cap. Current use is a small `docker inspect`, but the generic helper should enforce a maximum before reuse with untrusted/high-volume commands.
4. Credential discovery captures the container's full environment array in memory to extract two PostgreSQL values. It does not print them, but a narrower inspect query would better minimize secret exposure.
5. Browser child cleanup is awaited, but `stopProcesses()` stops children sequentially and aborts on the first cleanup exception. Future hardening should attempt all children and aggregate errors so one failed Firefox cleanup cannot skip app cleanup.

### VERIFIED

1. Fresh memory proves dashboard-to-init redirect, network-observed `createInitialUser`, returned administrator ID, authenticated dashboard entry, and all four current-list create/reload workflows using runtime-created relationship IDs.
2. Prisma orchestration uses a unique database, deploys checked-in migrations, seeds, builds current source, runs the browser with `CMS_ADAPTER=prisma`, verifies created rows with generated IDs directly in PostgreSQL, force-drops in nested `finally`, and verifies absence.
3. Database URL user/password components are encoded and passed through child environment rather than command arguments. Oversight checked the emitted server output for the full credential URL prefix and disposable database-name pattern; neither was embedded. (A raw seven-character password substring was not a valid leak test because it also occurs in dependency names.)
4. The original failed credential-less database and all later databases were absent. Author matrix passes used two distinct database names and reported zero remaining `tks_parity_browser_%` databases.
5. Oversight independently ran `npm run test:dashboard:browser:prisma`. It passed 1,376 browser events with zero navigation aborts/errors; direct PostgreSQL verification passed; the unique database, app, Firefox process/profile, and temporary profile were removed.
6. The real-ID failure was reproduced before the source repair with `innerWidth=390`, `scrollWidth=481`, and an actual CUID. Generic item/create grids now apply `min-w-0`; the item ID card wraps and breaks the identifier. Independent Prisma browser evidence passes the same overflow assertion.
7. Both formal aggregate matrix passes ran seeded, fresh, and Prisma from current builds at the unchanged hash and reported zero unexpected browser request/response/console errors.
8. The nonzero-descendant cleanup concern from Review 005 is addressed and executable probes cover nonzero-leader and hanging-leader process groups.
9. `READINESS.md` is unchanged. GAP-01 remains IN PROGRESS, GAP-03 remains IN REVIEW, and GAP-04 remains OPEN in the progress ledger.

### Reviewer commands

```text
npm run test:dashboard:browser:prisma
docker exec vibe-runtime-postgres psql -U junaid -d postgres -Atqc "SELECT count(*) FROM pg_database WHERE datname LIKE 'tks_parity_browser_%'"
# bounded secret-safe check for full encoded credential URL and disposable DB name in .output/server
ps -axo pid,ppid,etime,command | rg "validate-dashboard-browser|.output/server/index.mjs|Firefox.app/Contents/MacOS/firefox --headless --no-remote --profile .*/tks-firefox-|nonzero-descendant|hanging-fault-build" || true
find "${TMPDIR:-/tmp}" -maxdepth 1 -type d -name "tks-firefox-*" -print
```

## Review 007 — REVIEW CHECKPOINT READY 006

**Status:** **CHANGES REQUIRED.** The AdminMeta-driven Project create/persist behavior is credible and one independent run passed, but three harness-isolation/lifecycle defects block acceptance. GAP-01, GAP-03, and GAP-04 remain open; `READINESS.md` remains unchanged.

### BLOCKING

1. **Invalid captured-output options spawn and leak the child before validation.**
   - `runBoundedChild()` calls `spawn()` at `scripts/lib/bounded-child.mjs:77`, then validates `maxCapturedBytes` only at line 93.
   - Oversight invoked a long-running detached child with `captureOutput: true` and `maxCapturedBytes: 0`. The call rejected with the expected assertion, but the child process group remained alive because execution never reached the runner's cleanup path. Oversight killed that exact probe afterward.
   - Required: validate all options that can reject synchronously before `spawn()`, add an executable invalid-option regression that proves no process is created/remains, and retain the existing finite overflow tests.

2. **The arbitrary fixture mutates and leaves artifacts in the authoritative workspace through its `node_modules` symlink.**
   - `scripts/validate-dashboard-arbitrary-browser.mjs:114-118` symlinks the entire source `node_modules` into the temporary fixture. Nitro writes SSR intermediates to `node_modules/.nitro`, so the allegedly isolated build writes through that symlink.
   - Oversight hashed the source `node_modules/.nitro` tree before and after the arbitrary command; it changed. After the temporary fixture was removed, source `node_modules/.nitro/vite/services/ssr/assets/mutation-state-*.js` still contained the fixture's literal `Project: list({` configuration.
   - This contradicts the claim that the complete fixture is removed and the source workspace is unmodified, creates cross-run/cache contamination, and makes concurrent or reordered evidence unsafe.
   - Required: keep fixture-owned writable build/cache paths physically inside the disposable root (while dependencies may remain read-only/reused), assert the source cache is unchanged, and prove no arbitrary model marker or fixture path remains after success and failure.

3. **An early Firefox launcher exit can escape process-group cleanup and recreate its supposedly removed profile.**
   - On oversight's first independent arbitrary run, the spawned Firefox leader exited before BiDi readiness. A Firefox process using the exact generated `tks-firefox-RKthFU` profile was reparented to PID 1 in a different process group. Its visible argv no longer contained `--headless`.
   - `stopProcesses()` skips a child when the original PID/group no longer exists (`scripts/validate-dashboard-browser.mjs:77`), then profile removal raced the escaped process. The command failed and left both the exact Firefox process and profile behind. Oversight terminated only that profile-bound process and removed its profile. A second run passed cleanly.
   - Required: keep Firefox in the controlled foreground/process group or add exact profile-bound descendant discovery/termination for launcher-exit paths; wait for absence before removing the profile; add a forced launcher/fork failure probe. Cleanup must not match or terminate the user's normal Firefox profile.

### IMPORTANT

1. `finally` awaits `stopProcesses()` and only then removes the profile (`scripts/validate-dashboard-browser.mjs:1480-1481`). If aggregate process cleanup itself rejects, profile removal is skipped. Use nested cleanup/all-settled handling so process and filesystem cleanup are both attempted and errors are aggregated.
2. A successful `runBoundedChild` leader is not checked for surviving process-group descendants. The prior regression covers nonzero-leader descendants only. A bounded generic runner should either prove group absence on every terminal outcome or explicitly document and constrain daemonizing success as unsupported.
3. The arbitrary fixture deliberately covers only text, integer, and checkbox fields and still fixes `User`/`email`/`password` initialization. This is useful portability evidence, not exhaustive GAP-01 parity. The ledger correctly leaves GAP-01 IN PROGRESS.
4. The first independent arbitrary run's failure means the author-reported two clean passes are not sufficient to call the repaired harness stable yet. After lifecycle repair, require two new clean-build passes at one unchanged hash plus an independent run.
5. GAP-03 still has only the previously accepted 390px item-state repair, and GAP-04 still lacks correlated throttled navigation stress. Neither is advanced by this checkpoint.

### VERIFIED

1. The declared aggregate SHA-256 independently recomputes to `9132d39015e19b16d20b5a046a5e090d57c18ecc0a9157f963b0b183e0bdb501` over the seven declared implementation/config/test files.
2. The arbitrary orchestrator copies source to a unique temporary root, replaces only the copied `cms.config.ts`, runs fresh-memory production output, restores cwd/environment, and removes the fixture root in `finally`. No temporary source-copy directory remained in either independent run; only the shared-cache defect above breaks full isolation.
3. The browser flow fetches runtime AdminMeta after initialization, filters visible/create-enabled lists, derives list path/singular/GraphQL operation names/field paths and kinds, and asserts the discovered list-key contract. The create loop contains no Project-specific route, operation name, item-query name, or field path.
4. For every discovered supported field, the flow asserts submitted mutation data, HTTP 200/no GraphQL errors/returned ID, returned-ID route, UI values after navigation reload, and an AdminMeta-derived raw item query with exact persisted values.
5. Oversight's second `npm run test:dashboard:browser:arbitrary` run passed with Project discovered, 278 events, zero navigation aborts, and zero unexpected request/response/console errors. App, controlled Firefox, temporary source copy, and profile cleanup were clean on that run.
6. `npx vitest run tests/bounded-child.test.ts` passed 2/2. The shared byte ceiling correctly bounds retained stdout/stderr memory and reports finite overflow after continuing to drain the child.
7. Prisma credential discovery now returns only the two required NUL-delimited environment values through bounded captured output, rather than capturing the container's full environment. Values are not placed in command arguments or logs.
8. Browser app/Firefox cleanup now attempts all tracked child groups via `Promise.allSettled`; one tracked-child failure cannot skip attempted termination of another tracked child.
9. Oversight cleaned its exact leaked probe/browser resources and ran an ordinary source build to replace the arbitrary shared Nitro cache. Final checks found no checkpoint harness, app, controlled Firefox/profile, arbitrary temporary copy, or probe process. The checkpoint source hash remained unchanged.
10. `READINESS.md` was not modified, and the ledger explicitly keeps GAP-01 IN PROGRESS, GAP-03 IN REVIEW, and GAP-04 OPEN.

### Reviewer commands

```text
npx vitest run tests/bounded-child.test.ts
# invalid maxCapturedBytes detached-child probe; verify survival, then terminate only the probe group
npm run test:dashboard:browser:arbitrary
# compare source node_modules/.nitro before/after and scan for the fixture Project config
ps -axo pid,ppid,pgid,etime,command | rg "tks-firefox-|validate-dashboard-arbitrary|validate-dashboard-browser|.output/server/index.mjs" || true
find "${TMPDIR:-/tmp}" -maxdepth 1 -type d \( -name "tks-firefox-*" -o -name "tks-arbitrary-browser-*" \) -print
npm run build  # restore ordinary source output/cache after the isolation reproduction
```

## Review 008 — REVIEW CHECKPOINT READY 007

**Status:** **CHANGES REQUIRED.** Review 007's child-runner, writable-cache, and escaped-Firefox blockers are substantively repaired and independently exercised. Temporary PostgreSQL restoration is not failure-safe across the whole startup lifecycle, and the arbitrary fixture still allocates its temporary root before entering cleanup scope. GAP-01, GAP-03, and GAP-04 remain open; `READINESS.md` remains unchanged.

### BLOCKING

1. **A stopped PostgreSQL container is left running when credential validation fails after startup.**
   - The gate starts a previously stopped container and sets `containerStartedByGate=true` (`scripts/validate-dashboard-browser-prisma.mjs:49-58`). Its narrow readiness/credential-probe `try/catch` ends at line 82. Credential parsing and assertions occur at lines 84-97, before the database lifecycle `try/finally` begins at line 147.
   - Oversight began with `vibe-runtime-postgres` stopped and ran the gate with an explicitly empty `PARITY_POSTGRES_PASSWORD`. The gate started PostgreSQL, then correctly rejected with `PostgreSQL container password was not configured`, but the container remained running. Oversight stopped it and verified the original stopped state was restored.
   - Required: put every operation after a gate-owned start—including credential parsing/assertions and URL construction—under one outer restoration `finally`. Add a forced post-start/pre-database failure regression that proves the original running/stopped state is restored.
   - Related failure window: `databaseCreated` becomes true only after `createdb` returns successfully. If creation has taken effect but the runner rejects (for example, an ambiguous command/process-group outcome), cleanup skips `dropdb` and only reports the surviving database. Prefer unconditional `dropdb --if-exists` for the unique gate-owned name once lifecycle cleanup is active, followed by absence verification and container restoration.

2. **The arbitrary fixture's earliest preflight failures still bypass temporary-root cleanup.**
   - `temporaryRoot` is created at `scripts/validate-dashboard-arbitrary-browser.mjs:20`, but the cleanup `try/finally` does not begin until line 193.
   - Source Nitro fingerprinting and the pre-existing-marker assertion run at lines 106-111 outside that scope. If the cache is unreadable or contains the exact marker this checkpoint is designed to detect, the command exits while leaving its newly created `tks-arbitrary-browser-*` directory.
   - Required: create the temporary root inside an already-established cleanup scope (or enter `try/finally` immediately after allocation), and add a pre-build/preflight failure probe that proves no temporary root remains. The existing forced post-build failure probe is valid but does not cover this earlier window.

### IMPORTANT

1. `linkReadOnlyDependencies()` does not make dependency targets read-only; it creates writable symlinks into source packages. Current Vite/Nitro root caches are physically fixture-owned and the source Nitro fingerprint stayed unchanged, so this is not a reproduced checkpoint blocker. Keep the writable-cache exclusion list and source-tree assertions aligned with toolchain changes, or enforce actual read-only dependency reuse.
2. The exact-profile process scan is bounded to 4 MiB of `ps` output. This passed on the current process-heavy host, but a capture overflow makes process discovery fail. Nested cleanup still attempts profile removal, yet an escaped writer could then survive and recreate it. Consider a narrower OS query while preserving exact-profile matching.
3. The arbitrary field/auth and responsive/GAP-04 evidence boundaries are unchanged. This checkpoint repairs harnesses only; it does not justify closing GAP-01, GAP-03, or GAP-04.

### VERIFIED

1. The aggregate SHA-256 independently recomputes to `6ef5ab90acb2860858fd3b5461c78758913d4f1d90d7a8691e9be5d569c8227b` over the eight declared implementation/config/test files.
2. **Pre-spawn validation is repaired.** Label, timeout, TERM grace, and captured-output limit validation all occur before `spawn()`. The invalid-limit test uses a marker-writing infinite child and proves the marker is never created.
3. **Successful-leader descendants are repaired.** On a zero exit, the runner checks the process group, applies bounded TERM/KILL cleanup, waits for group absence, and rejects the daemonizing command. Oversight ran the focused suite: 4/4 passed, including exact descendant-PID absence.
4. **Known writable root caches are fixture-owned.** The temporary fixture has a real `node_modules` root and real scoped roots; `.nitro`, `.vite`, `.vite-temp`, and `.cache` are not symlinked from source.
5. **Source Nitro remains byte-stable on covered success and failure paths.** Oversight independently fingerprinted `node_modules/.nitro` around both the intentional post-build failure command and a successful arbitrary browser run. Both fingerprints were unchanged; neither left `Project: list({`, a temporary path, nor a temporary fixture directory.
6. The successful arbitrary run again discovered/persisted Project from AdminMeta with 278 events, zero navigation aborts, and zero unexpected request/response/console errors. App, Firefox, profile, and fixture cleanup passed.
7. **Escaped exact-profile Firefox cleanup is credible.** Real Firefox now receives `--foreground`. The forced launcher creates a PID-1-reparented, TERM-resistant process that continuously recreates only its exact unique profile. Oversight ran `npm run test:dashboard:browser:launcher-cleanup`; it passed, killed the fixture by exact profile path, removed the profile, and left no launcher process/profile.
8. **Nested browser cleanup is repaired.** Tracked group cleanup and exact-profile cleanup are both attempted with `Promise.allSettled`; profile removal and post-removal process/filesystem verification are attempted even if an earlier cleanup rejects; errors are aggregated afterward.
9. **Normal stopped-container Prisma success restores state.** Oversight independently ran the full disposable-Prisma browser gate from a stopped container. Browser behavior and direct persistence passed, the database was dropped, the container returned to stopped, and a readiness-bounded follow-up catalog check found zero `tks_parity_browser_%` databases.
10. Final inspection found no checkpoint app, child probe, escaped launcher, Firefox test profile, arbitrary fixture, or parity database. PostgreSQL was stopped as originally observed. The checkpoint hash remained unchanged.
11. `READINESS.md` was not modified, and the ledger correctly keeps GAP-01 IN PROGRESS, GAP-03 IN REVIEW, and GAP-04 OPEN.

### Reviewer commands

```text
npx vitest run tests/bounded-child.test.ts
ARBITRARY_BROWSER_FORCE_FAILURE_AFTER_BUILD=1 npm run test:dashboard:browser:arbitrary
npm run test:dashboard:browser:arbitrary
npm run test:dashboard:browser:launcher-cleanup
# from an initially stopped container: intentional empty-password pre-database failure, inspect state, then restore it
PARITY_POSTGRES_PASSWORD='' node scripts/validate-dashboard-browser-prisma.mjs
npm run test:dashboard:browser:prisma
# readiness-bounded catalog absence check, then restore the original stopped container state
ps -axo pid,ppid,pgid,etime,command | rg "firefox-launcher-exit|tks-firefox-|validate-dashboard-(browser|arbitrary|launcher)|.output/server/index.mjs" || true
find "${TMPDIR:-/tmp}" -maxdepth 1 -type d \( -name "tks-firefox-*" -o -name "tks-arbitrary-browser-*" \) -print
```

## Review 009 — REVIEW CHECKPOINT READY 008

**Status:** **CHANGES REQUIRED.** The empty-password pre-database restoration window and arbitrary preflight temporary-root leak are repaired and independently verified. One database-cleanup failure mode remains because unique-name drop/absence is still conditional on the container already being running when cleanup begins. GAP-01, GAP-03, and GAP-04 remain open; `READINESS.md` remains unchanged.

### BLOCKING

1. **A database survives if PostgreSQL stops after creation but before cleanup.**
   - `restoreContainerAndDatabase()` inspects current state and executes `dropDisposableDatabase()` plus `verifyDatabaseRemoved()` only inside `if (running)` (`scripts/validate-dashboard-browser-prisma.mjs:88-106`). If the gate-created database exists in the stopped container's volume, cleanup skips both operations and merely calls `docker stop` again.
   - Oversight started from the normal stopped state, launched the gate, waited until its unique `tks_parity_browser_*` database appeared, then stopped the container while migration began. The gate failed as expected and returned the container to stopped, but after restarting PostgreSQL the exact database still existed (`count=1`). Oversight dropped that exact database and restored the stopped state.
   - This disproves the checkpoint's “unconditional unique-name drop/absence” claim. The database name is gate-owned even when PostgreSQL is temporarily unavailable; current running state must not silently waive cleanup.
   - Required: in final cleanup, make PostgreSQL available when necessary, readiness-probe it, unconditionally drop the unique name, verify absence, and only then restore the exact initial running/stopped state. If the initially running container stopped unexpectedly, restoration should also return it to running rather than preserve the failure state. Add a bounded forced post-create/container-stop regression that proves both database absence and original state restoration.

### IMPORTANT

1. Cleanup correctly aggregates drop, absence, and stop errors once the container is running. Preserve that behavior when adding cleanup-time restart/readiness so a drop failure cannot skip absence reporting or final state restoration.
2. The arbitrary source-cache verification is intentionally skipped in the forced failure immediately after root allocation because no cache operation has occurred. That is appropriate; the probe should continue asserting temporary-directory absence independently.
3. This checkpoint remains harness lifecycle work only. Arbitrary auth/field breadth, responsive route-state coverage, and correlated GAP-04 cancellation stress are unchanged.

### VERIFIED

1. The aggregate SHA-256 independently recomputes to `56988cf72b27fd601c8cd717c216d7df92c748aa23d0fcf15801dfec51ee5be6` over the same eight participating implementation/config/test files.
2. **All ordinary post-start operations are now within one outer `try/finally`.** Gate ownership is set before `docker start`; readiness, credential capture/parsing/assertions, URL construction, creation, migrations, seed, build, browser, and persistence are all inside the restoration scope.
3. **The original empty-password failure is repaired.** Oversight began with PostgreSQL stopped and ran `PARITY_POSTGRES_PASSWORD='' node scripts/validate-dashboard-browser-prisma.mjs`. It exited nonzero at the expected password assertion, emitted the unique-name `dropdb --if-exists` notice, verified absence, and returned the container to stopped.
4. Oversight independently restarted PostgreSQL with a bounded readiness check after that probe: both the exact logged database and all `tks_parity_browser_%` databases had count zero; PostgreSQL was returned to stopped.
5. **Normal Prisma success remains green.** Oversight ran the full disposable-Prisma browser command from a stopped state: 1,376 events, zero navigation aborts/unexpected errors, direct persistence passed, the database was dropped, and PostgreSQL returned to stopped. A follow-up catalog check found zero parity databases.
6. **Arbitrary root allocation is now immediately cleanup-scoped.** `temporaryRoot` is assigned inside the top-level `try`, and the `finally` conditionally removes it even if fingerprinting or later setup never begins.
7. `ARBITRARY_BROWSER_FORCE_PREFLIGHT_FAILURE=1 node scripts/validate-dashboard-arbitrary-browser.mjs` independently exited at the intentional point immediately after allocation. The before/after temporary-directory set and source Nitro fingerprint were identical; no fixture directory remained.
8. Review 008's earlier child-runner, source-cache, and exact-profile Firefox repairs remain unchanged at this hash. The author reports two full matrices at the exact hash; this review's focused runtime commands did not expose a regression in those accepted areas.
9. Oversight removed the exact database created by its forced container-stop reproduction. Final checks found zero parity databases or matching browser/arbitrary processes/profiles, and PostgreSQL was stopped as originally observed.
10. `READINESS.md` was not modified. GAP-01 remains IN PROGRESS, GAP-03 remains IN REVIEW, and GAP-04 remains OPEN.

### Reviewer commands

```text
PARITY_POSTGRES_PASSWORD='' node scripts/validate-dashboard-browser-prisma.mjs
ARBITRARY_BROWSER_FORCE_PREFLIGHT_FAILURE=1 node scripts/validate-dashboard-arbitrary-browser.mjs
npm run test:dashboard:browser:prisma
# forced post-create probe: stop PostgreSQL after the unique DB appears; await gate; restart/readiness-check exact DB, then clean only that DB and restore stopped state
ps -axo pid,ppid,pgid,etime,command | rg "tks-firefox-|validate-dashboard-(browser|arbitrary)|.output/server/index.mjs|validate-dashboard-browser-prisma|prisma migrate deploy" || true
find "${TMPDIR:-/tmp}" -maxdepth 1 -type d \( -name "tks-firefox-*" -o -name "tks-arbitrary-browser-*" \) -print
```

## Review 010 — REVIEW CHECKPOINT READY 009

**Status:** **CHANGES REQUIRED.** The declared forced post-create stop path now restarts PostgreSQL, readiness-probes, drops/verifies the unique database, and restores both ordinary initial states. One nested cleanup failure path still skips drop/absence and exact stopped-state restoration when cleanup startup succeeds but its readiness probe fails. GAP-01, GAP-03, and GAP-04 remain open; `READINESS.md` remains unchanged.

### BLOCKING

1. **Cleanup-start readiness failure leaves both PostgreSQL and the unique database behind.**
   - In `restoreContainerAndDatabase()`, `running` begins false. When cleanup finds PostgreSQL stopped, `docker start` and `waitForPostgresReadiness()` are in one `try`; `running=true` is assigned only after readiness succeeds (`scripts/validate-dashboard-browser-prisma.mjs:94-101`).
   - If `docker start` succeeds but readiness rejects, the container is actually running while the local flag remains false. The gate then skips both drop/absence (`if (running)`) and initially-stopped shutdown (`if (!initiallyRunning && running)`).
   - Oversight ran the supplied post-create stop probe from an initially stopped state with a bounded Docker wrapper that allowed initial readiness, then forced only cleanup `pg_isready` calls to fail. Cleanup reported the readiness error, but returned with `running_after_cleanup_readiness_failure=true` and the exact parity database still present (`count=1`). Oversight dropped only that database, removed the wrapper, and restored PostgreSQL to stopped.
   - Required: record successful cleanup startup independently of readiness. Continue attempting unique-name drop and absence checks after a successful start even when readiness reports an error, aggregate all failures, and perform final state restoration from a fresh state inspection rather than a readiness-dependent boolean. Add a forced cleanup-readiness-failure regression proving attempted drop/absence and exact state restoration; do not let one cleanup diagnostic skip later cleanup steps.

### IMPORTANT

1. If PostgreSQL is genuinely unavailable after cleanup startup, drop/absence can also fail; that is a reportable external cleanup failure. The gate must still attempt those operations and restore the initial running/stopped state rather than silently skipping them.
2. The forced probe environment variable is correctly checked only after unique database creation. Keep it test-only in the orchestration script and out of emitted production output.
3. This checkpoint remains lifecycle remediation only and does not advance the outstanding parity gap boundaries.

### VERIFIED

1. The aggregate SHA-256 independently recomputes to `c142bdfd52423ab470196c3f92518d46fbe708113fb5fba0cdac1418fbdd0b97` over the eight participating implementation/config/test files.
2. **The ordinary initially-stopped post-create interruption is repaired.** Oversight ran `PARITY_POSTGRES_STOP_AFTER_CREATE_PROBE=1 node scripts/validate-dashboard-browser-prisma.mjs` from stopped state. It intentionally failed after stopping PostgreSQL; cleanup restarted and readiness-probed it, dropped and verified the unique database, then returned it to stopped.
3. An independent bounded restart/catalog check after that probe found zero `tks_parity_browser_%` databases and restored PostgreSQL to stopped.
4. **Initially-running state is preserved on the covered failure path.** Oversight started/readiness-probed PostgreSQL, ran the empty-password pre-database failure, and observed it still running afterward with zero parity databases. Oversight then restored the pre-review stopped state.
5. Static inspection confirms that when cleanup readiness succeeds, drop and absence checks are separate guarded operations and final stop is attempted even if either reports an error.
6. The author reports two full clean-build matrices at the exact hash with the existing seeded/fresh/Prisma/arbitrary event counts and no disposable-resource residue. This focused checkpoint changed only Prisma lifecycle orchestration.
7. Oversight cleaned its exact forced-failure database and temporary Docker wrapper. Final catalog inspection found zero parity databases; no matching gate process remained; PostgreSQL was stopped as originally observed. The checkpoint hash remained unchanged.
8. `READINESS.md` was not modified. GAP-01 remains IN PROGRESS, GAP-03 remains IN REVIEW, and GAP-04 remains OPEN.

### Reviewer commands

```text
PARITY_POSTGRES_STOP_AFTER_CREATE_PROBE=1 node scripts/validate-dashboard-browser-prisma.mjs
# bounded restart/readiness/catalog absence check; restore stopped state
# initially running: PARITY_POSTGRES_PASSWORD='' node ...; verify it remains running, then restore pre-review stopped state
# cleanup-readiness failure probe: PATH wrapper allows first pg_isready success, rejects later cleanup probes; inspect state/database, then clean exact DB and wrapper
ps -axo pid,ppid,pgid,etime,command | rg "validate-dashboard-browser-prisma|prisma migrate deploy|tks-docker-wrapper|.output/server/index.mjs|tks-firefox-" || true
```

## Review 011 — REVIEW CHECKPOINT READY 010

**Status:** **VERIFIED for Review 010's cleanup-readiness and exact-state restoration claim.** No blocking finding remains in this checkpoint boundary. This acceptance closes the harness lifecycle review finding only; GAP-01, GAP-03, and GAP-04 remain open and `READINESS.md` remains unchanged.

### BLOCKING

None.

### IMPORTANT

1. A genuine PostgreSQL outage can make drop and absence verification fail even though the gate now attempts them. That must remain an explicit cleanup error/external blocker rather than being converted into a successful parity result.
2. The cleanup-readiness probe deliberately waits for actual readiness and then injects the failure marker. This is appropriate for proving control-flow continuation; the source also confirms real `waitForPostgresReadiness()` rejection enters the same catch before drop/verify attempts.
3. Checkpoint acceptance does not broaden arbitrary field/auth coverage, responsive route-state evidence, or correlated cancellation stress. Continue the remaining P0/P1 work rather than treating harness completion as parity completion.

### VERIFIED

1. The aggregate SHA-256 independently recomputes to `d831016190845bbdb67f78691a42ccf21b197f6a94771fbfbafa211ff0df8241` over the same eight participating implementation/config/test files.
2. **Cleanup startup is tracked before readiness.** After successful cleanup `docker start`, `running=true` is assigned before calling `waitForPostgresReadiness()` (`scripts/validate-dashboard-browser-prisma.mjs:95-103`).
3. **Readiness failure cannot skip database cleanup.** Readiness/injected failure is caught and recorded, then drop and absence verification execute in separate subsequent `try` blocks while `running` remains true.
4. **Final state restoration uses fresh inspection.** After database cleanup attempts, the gate calls `containerIsRunning()` again, stops when the initial state was stopped, starts when the initial state was running, and performs a final fresh-state assertion against `initiallyRunning`.
5. **Combined stopped-state probe passed independently.** Oversight ran `PARITY_POSTGRES_STOP_AFTER_CREATE_PROBE=1 PARITY_POSTGRES_CLEANUP_READINESS_FAILURE_PROBE=1 node scripts/validate-dashboard-browser-prisma.mjs` from stopped state. It intentionally exited nonzero with the cleanup-readiness marker; PostgreSQL ended stopped.
6. Oversight restarted/readiness-probed PostgreSQL after that command and found zero databases matching `tks_parity_browser_%`, then restored the stopped state.
7. **Combined initially-running probe also passed independently.** Oversight began with PostgreSQL running, ran the same post-create-stop/readiness-failure combination, and observed PostgreSQL running afterward with zero parity databases. Oversight then restored the pre-review stopped state.
8. Drop and absence remain independently attempted, and cleanup errors are aggregated only after exact-state restoration and final verification have been attempted.
9. The author reports two consecutive full clean-build matrices at the exact hash with the established seeded/fresh/Prisma/arbitrary event counts and zero unexpected browser errors or disposable-resource residue.
10. Final inspection found zero parity databases, no matching Prisma/browser process or test profile, and PostgreSQL stopped as initially observed. The checkpoint hash remained unchanged.
11. `READINESS.md` was not modified. GAP-01 remains IN PROGRESS, GAP-03 remains IN REVIEW, and GAP-04 remains OPEN.

### Reviewer commands

```text
PARITY_POSTGRES_STOP_AFTER_CREATE_PROBE=1 PARITY_POSTGRES_CLEANUP_READINESS_FAILURE_PROBE=1 node scripts/validate-dashboard-browser-prisma.mjs
# bounded restart/readiness/catalog check; restore stopped state
# repeat from initially running state; verify it remains running with zero parity DBs, then restore pre-review state
ps -axo pid,ppid,pgid,etime,command | rg "validate-dashboard-browser-prisma|prisma migrate deploy|.output/server/index.mjs|tks-firefox-" || true
```

## Review 012 — REVIEW CHECKPOINT READY 011

**Status:** **CHANGES REQUIRED.** The additive auth metadata contract, dynamic password-auth operation construction, Account initialization/sign-out/direct-auth/UI-sign-in behavior, and Project persistence all have credible source and one complete independent browser pass. The same independent command first failed on a reproducible synchronization hole in its required persisted-field UI assertion, so the checkpoint's browser gate is not yet stable enough for acceptance. GAP-01, GAP-03, and GAP-04 remain open; `READINESS.md` remains unchanged.

### BLOCKING

1. **The arbitrary persisted-create browser assertion races form hydration and failed independently.**
   - `createDashboardItem()` navigates to the returned item path and waits only for `persistedExpression`, which for Project is the label text somewhere in `document.body`. `afterReload` then immediately reads every field input and asserts exact values.
   - On oversight's first `npm run test:dashboard:browser:arbitrary`, the Account initialization, sign-out/direct auth/UI sign-in, AdminMeta discovery, Project mutation, returned-ID route, and label text all completed. The subsequent Project `title` input assertion read `''` instead of `Arbitrary Project Title 1` at `scripts/validate-dashboard-browser.mjs:805`. App/network logs contained no product error, cleanup was complete, and a second unchanged-source run passed all 388 events.
   - The source permits this false failure: heading/body label readiness does not prove controlled form inputs have hydrated. Two author passes do not remove the observed race.
   - Required: wait explicitly for the item form and each supported persisted field control to expose the submitted value/state before strict assertions, while retaining the independent raw GraphQL persistence check. Do not weaken or remove UI persistence assertions. Because this repairs the acceptance harness, require two new clean-build matrices at one unchanged hash and an independent arbitrary run.

### IMPORTANT

1. Public `keystone.auth.sessionData` exposes the configured selection string before authentication even though init/sign-in only need list, identity, secret, and initial-field names. It exposes no values and the selected schema is generally introspectable, so this is not a credential leak. Still, confirm this broader public contract is intentional and document/minimize it before consumers depend on it.
2. The focused contract tests cover valid arbitrary names but no invalid-name cases. Oversight independently proved invalid list, identity, secret, and initial-field names are rejected. Add those negative cases to prevent future interpolation regressions.
3. The direct authentication probe proves a successful result type but does not compare the returned Account item ID with the ID returned by `createInitialAccount`, and UI sign-in is inferred from the protected dashboard transition rather than captured mutation evidence. Current evidence is adequate, but tying both to the initialized ID/request would make the generic-auth proof stronger.
4. Signup/reset routes remain outside this slice and may still encode starter auth assumptions, as the ledger acknowledges. GAP-01 must remain open.

### VERIFIED

1. The thirteen-file aggregate SHA-256 independently recomputes to `52febcc88686e22f37186c6f700e182c0b2fcfe7f0a8bac141ea29e7d1406893`.
2. **The GraphQL contract is additive.** `KeystoneMeta.auth` and `KeystoneAdminMeta.auth` are nullable `AuthMeta` fields; existing metadata fields remain. Generated `.cms/schema.graphql`, runtime schema source, resolver maps, client types, and the protected AdminMeta query agree on list key, identity field, secret field, session selection, and initial-item fields.
3. **Public metadata exposes names/configuration, not credential values.** `configuredAuthMeta()` returns only configured field/list names, the session selection string, and initial field names. No password value, hash, session token, reset token, or account record is returned.
4. **Dynamic password-auth operation construction is model-agnostic for this contract.** `buildDashboardPasswordAuthContract()` validates GraphQL names for auth list, identity, secret, and every initial field before deriving create input/mutation and authentication success/failure names. Oversight's invalid-name probes rejected all four categories.
5. The derived operation names exactly match runtime `createAuth` naming for `Account`: `CreateInitialAccountInput`, `createInitialAccount`, `authenticateAccountWithPassword`, and Account success/failure result types.
6. **Init is generic within the declared scalar scope.** It loads public auth metadata before authentication, renders configured initial fields, submits a generated input/mutation, then authenticates using configured identity/secret argument names. Existing email/password input behavior remains conditional and backward-compatible.
7. **Sign-in is generic.** It loads the same public contract, renders configured identity/secret names (`handle`/`secret` in the fixture), executes the derived mutation, preserves server failure messages, and follows the existing safe redirect helper.
8. The focused suites passed independently: 7/7 across generic auth, init route, and sign-in route. `npm run test:cms` also passed, including public auth metadata plus existing auth/session validation.
9. Static browser inspection confirms the disposable fixture uses hidden `Account(displayName, handle, secret)` plus creatable Project; no User/email/password operation name is used in the arbitrary flow. The browser discovers and validates public names before building operations.
10. Oversight's second arbitrary browser run passed end-to-end: Account init, sign-out, direct authentication success, rendered handle/secret UI sign-in, AdminMeta Project create/reload/raw persistence, 388 events, zero navigation aborts, and zero unexpected request/response/console errors.
11. Both independent arbitrary attempts preserved the authoritative Nitro cache and removed the disposable source copy, app, Firefox process/profile, and temporary directories. Final checks found no parity database/process/profile; PostgreSQL remained stopped. The source hash was unchanged.
12. The ledger correctly declines exhaustive parity: arbitrary non-scalar fields, signup/reset, and the user-specific environment remain unresolved; GAP-01 stays IN PROGRESS.

### Reviewer commands

```text
npx vitest run tests/dashboard-generic-auth.test.ts tests/dashboard-init-route.test.ts tests/dashboard-signin-route.test.ts
npm run test:cms
npx tsx -e "...invalid auth-list/identity/secret/initial-field name probes..."
npm run test:dashboard:browser:arbitrary  # first run failed hydrated input timing; unchanged rerun passed 388/0
ps -axo pid,ppid,pgid,etime,command | rg "validate-dashboard-(browser|arbitrary)|.output/server/index.mjs|tks-firefox-" || true
find "${TMPDIR:-/tmp}" -maxdepth 1 -type d \( -name "tks-firefox-*" -o -name "tks-arbitrary-browser-*" \) -print
```

## Review 013 — REVIEW CHECKPOINT READY 012

**Status:** **VERIFIED for Review 012's hydration synchronization and auth-contract hardening claims.** No blocking finding remains in this checkpoint boundary. GAP-01, GAP-03, and GAP-04 remain open; `READINESS.md` remains unchanged.

### BLOCKING

None.

### IMPORTANT

1. The checkbox hydration expression currently expects `'true'`, matching the generator's current invariant that every arbitrary checkbox is submitted as true. If future fixtures generate false values, derive the expected ARIA state from `submittedValues[field.path]` rather than retaining this hidden coupling.
2. Public metadata still intentionally reveals auth list/identity/secret field names because clients need them to construct forms and operations. It exposes no selection string or values. Treat this additive public schema as a stable API contract under Hyrum's Law.
3. Protected `adminMeta.auth.sessionData` is retained by schema/query/runtime inspection and exercised by full dashboard matrices, but a focused public-vs-protected schema test would make that access-surface distinction more explicit.
4. Signup/reset and advanced/non-scalar arbitrary fields remain outside this slice. Acceptance here must not green GAP-01.

### VERIFIED

1. The thirteen-file aggregate SHA-256 independently recomputes to `c811a09b96d8bc43608baaae587abed2afcb7b7daf9818f2e3cb3f0d62c13800`.
2. **Per-control hydration synchronization is present.** After returned-ID reload, every editable text/integer field independently waits until its input value equals the submitted value; every covered checkbox independently waits for its expected checked state. Exact UI assertions remain after each wait.
3. **Raw persistence evidence is retained.** Only after all UI controls hydrate does the browser execute the AdminMeta-derived item query and deep-compare returned ID plus every submitted field value.
4. This fixes the exact Review 012 race: heading/body label readiness is no longer treated as proof that controlled form inputs are hydrated.
5. **Public auth metadata is narrowed.** Generated and runtime schemas use `PublicAuthMeta` for `KeystoneMeta.auth`; it contains list key, identity field, secret field, and initial-item fields, with no `sessionData` field. `fetchDashboardPublicAuthMeta()` requests only those fields.
6. **Protected metadata retains session selection.** `KeystoneAdminMeta.auth` remains the separate `AuthMeta` type containing `sessionData`; `adminMetaGraphQLQuery` still requests it, and runtime resolvers continue returning the configured protected metadata.
7. **All four invalid-name categories are executable tests.** The parameterized suite separately rejects invalid auth list, identity field, secret field, and initial-item field names before operation interpolation.
8. The focused generic auth/init/sign-in suites passed independently: 11/11. `npm run test:cms` passed, including the narrowed public metadata and existing auth/session behavior.
9. **Direct authentication is tied to initialization.** The browser saves the exact item ID returned by `createInitialAccount`, then requires the direct `authenticateAccountWithPassword` success result's item ID to equal it before UI sign-in.
10. **Independent runtime passed on the first requested run.** `npm run test:dashboard:browser:arbitrary` completed Account initialization, sign-out, matching-ID direct auth, rendered handle/secret sign-in, synchronized Project UI reload, and raw GraphQL persistence with 388 events, zero navigation aborts, and zero unexpected request/response/console errors.
11. The independent run preserved the authoritative Nitro fingerprint and removed its source copy, app, Firefox process/profile, and temporary directories. Final inspection found no parity database/process/profile; PostgreSQL remained stopped.
12. The author reports two clean-build full matrices at this exact hash with the established seeded/fresh/Prisma/arbitrary counts and complete disposable-resource cleanup.
13. `READINESS.md` was not modified. GAP-01 remains IN PROGRESS, GAP-03 remains IN REVIEW, and GAP-04 remains OPEN.

### Reviewer commands

```text
npx vitest run tests/dashboard-generic-auth.test.ts tests/dashboard-init-route.test.ts tests/dashboard-signin-route.test.ts
npm run test:cms
npm run test:dashboard:browser:arbitrary
ps -axo pid,ppid,pgid,etime,command | rg "validate-dashboard-(browser|arbitrary)|.output/server/index.mjs|tks-firefox-" || true
find "${TMPDIR:-/tmp}" -maxdepth 1 -type d \( -name "tks-firefox-*" -o -name "tks-arbitrary-browser-*" \) -print
```

## Review 014 — REVIEW CHECKPOINT READY 013 (derived sibling oracle)

**Status:** **CHANGES REQUIRED for gate lifecycle hardening; fixture-patch fidelity and the narrow GAP-02 route-load behavior are VERIFIED.** The authoritative sibling remains broken and unchanged. GAP-02 must remain IN REVIEW.

### BLOCKING

1. **The new sibling gate reintroduces already-rejected database cleanup sequencing.**
   - `cleanupDatabase()` places current-state inspection, optional cleanup startup, readiness, drop, and absence verification in one `try`. If cleanup startup succeeds but readiness fails, drop and absence are skipped. State restoration may stop the container while the unique database remains in its volume.
   - This is the same failure class reproduced and fixed across Reviews 009–011 in the Prisma gate. A new P0 oracle must reuse that hardened ordering rather than fork a weaker lifecycle.
   - Required: track cleanup startup before readiness, attempt drop and absence independently after a successful start, freshly restore/assert the exact initial state, and add bounded post-create-stop plus cleanup-readiness-failure probes for `nks_oracle_*`.
2. **Escaped Firefox/profile cleanup is weaker than the accepted dashboard harness.**
   - `cleanupProcesses()` checks only original process groups. It has no exact-profile process discovery/TERM-KILL fallback for a launcher that exits and reparents Firefox outside its original group—the concrete leak reproduced in Review 007.
   - The gate then removes the entire temporary root once; an escaped process can recreate its profile afterward. Cleanup errors and root removal/fingerprint verification are not fully nested/all-settled.
   - Required: reuse the exact unique-profile cleanup and post-removal absence verification already accepted in the main browser harness, without matching the user's normal Firefox profile. Add the forced launcher-exit probe to this gate or share the tested cleanup primitive.

### IMPORTANT

1. The fixture loads the sibling create form but creates Todo through direct GraphQL, not by submitting the sibling form. This satisfies GAP-02's stated “loads home/list/item/create” acceptance and creates data needed for item-route proof, but it is not evidence that the derived sibling's UI create submission works. Keep that distinction explicit.
2. The fixture's fallback values are synthetic compatibility policy, not facts read from the unchanged schema. They are faithful for the checked-in sibling: no model config supplies initial filters/hide-navigation overrides; sibling consumers already fall back from `hideNavigation` to `isHidden`; create/list positions have no old-schema variant; required checked-in fields are represented by create non-null. Do not generalize this oracle to arbitrary sibling configurations without deriving those values from source config.
3. Validate the returned Todo ID before interpolating it into the direct SQL statement. The ID is server-generated/trusted and the later regex passed, but boundary validation should precede string construction.
4. Browser collection ignores `network.fetchError` and HTTP 4xx responses, checking only HTTP 500+ and console errors. The route/body assertions make the covered flow credible, but the long-term oracle should reject unexpected transport failures consistently with the replacement gate.
5. The dissertation's later paired screenshot/DOM/a11y inventory remains outstanding. This checkpoint establishes a runnable intended-behavior fixture, not visual parity.

### VERIFIED

1. The declared hash independently recomputes to `b2072492a7501fc76a3a9692f0f5f8e5a7b915ccd5be2c6206f153dd89860640` using the documented four-file lexical order.
2. Direct inspection of unchanged sibling `schema.graphql` confirms exactly the six incompatible selections: list `initialFilter`/`hideNavigation`, create `fieldPosition`/`isRequired`, item `isRequired`, and list `fieldPosition`. Item `fieldPosition` is valid and remains queried.
3. `patchAdminMetaSource()` removes only those selections from the copied action and fails closed if any exact anchor changes. The only injected runtime normalization is the documented compatibility object; GraphQL naming remains the sibling implementation.
4. `docs/SIBLING_ORACLE_FIXTURE.md` clearly distinguishes the broken authoritative source from the disposable intended-behavior adaptation. It does not claim the sibling itself is repaired.
5. The copy excludes the authoritative sibling's `.env`, dependencies, generated output, and Git metadata; installs/builds occur under a unique temporary root. Source fingerprinting before/after includes authoritative source and environment files while intentionally excluding generated/dependency directories.
6. Oversight independently ran `npm run test:sibling:oracle`. Production build/migrations passed; Firefox loaded init, authenticated home, Todo list, Todo create, created-item route, sign-out/sign-in, and persisted-item reload with 227 events and zero browser 500/console errors. Direct PostgreSQL label verification passed.
7. The independent normal run removed its copy, installed dependencies, app/browser groups, profile, and unique database; PostgreSQL returned to stopped. The authoritative sibling gained no `node_modules`, and its source fingerprint assertion passed.
8. The bounded-child focused suite passed 4/4 after successful-process-group quiescence was added; stubborn successful descendants are still rejected after grace.
9. GAP-02 is not closed: the authoritative dashboard still emits invalid AdminMeta selections, and the derived fixture has the cleanup blockers above.

### Reviewer commands

```text
npm run test:sibling:oracle
npx vitest run tests/bounded-child.test.ts
# inspect unchanged sibling action/schema/default-consuming source
ps -axo pid,ppid,pgid,etime,command | rg "validate-sibling-oracle|nks-oracle-|next start|Firefox.app/Contents/MacOS/firefox.*firefox-profile" || true
find "${TMPDIR:-/tmp}" -maxdepth 1 -type d -name "nks-oracle-*" -print
# bounded PostgreSQL readiness/catalog check for nks_oracle_%, then restore initial stopped state
```

## Review 015 — REVIEW CHECKPOINT READY 014 (responsive route-state matrix)

**Status:** **CHANGES REQUIRED.** The 30-state loop, persisted real-ID item, five exact widths, and two source repairs are credible, and the independent Prisma run passed. The geometry contract still has false-pass paths for clipped/fixed overlay content, and the alleged unbroken stress label contains many legal break opportunities. GAP-03 remains IN REVIEW.

### BLOCKING

1. **Visible overflow offenders are collected but never asserted.**
   - `assertResponsiveState()` records up to eight visible elements whose rectangles cross the viewport, but pass/fail checks only `document.documentElement.scrollWidth` and `document.body.scrollWidth`.
   - A fixed sidebar/dialog, or any child clipped by `overflow-hidden`/`overflow-clip`, can extend beyond the viewport without increasing either document width. This is especially material because mobile Sheet and AlertDialog content are fixed overlays and the breadcrumb repair intentionally introduces clipping.
   - Required: assert state-specific key container/overlay rectangles and actionable content are within the viewport; reject unexpected visible offenders with a narrow documented allowlist for intentional off-canvas/truncated structures. Preserve document/body scroll-width checks. Emit enough per-state evidence on pass to audit the allowlist rather than discarding the array.
2. **The “long unbroken” label is not unbroken.**
   - `Responsive-${'long-unbroken-label-'.repeat(8)}end` contains repeated hyphens, which are normal CSS line-break opportunities. It is long and did expose a nowrap breadcrumb defect, but it cannot prove resilience to a genuinely unbreakable user token.
   - Required: include at least one long alphanumeric token with no whitespace/hyphen break points, plus a realistic long spaced label. Persist and verify both in the relevant UI states, while retaining the real Prisma-generated CUID.

### IMPORTANT

1. The asserted 30 states are exactly 20 route states (home/list/create/item × five widths), five item-route left-sidebar states, and five item-route delete-dialog states. Do not describe this as sidebar/dialog coverage on every route.
2. Mobile sidebar readiness proves the real Sheet exists and Escape closes it; desktop readiness proves the left sidebar `data-state` changes. It does not verify accessible dialog/title semantics, trigger expanded state, focus containment/return, or key content bounds. The current `SidebarTrigger` has an accessible name but no `aria-expanded`. Keep this under GAP-11 or strengthen the matrix.
3. Delete coverage verifies a real `role=alertdialog`, “Delete Todo” title text, Cancel, and close. It does not assert `aria-modal`, description association, initial/returned focus, action visibility, or dialog bounding rectangle. These are not implied by the width pass.
4. Desktop sidebar is clicked back after measurement without waiting for restoration to its initial state. Add an explicit restoration wait so subsequent route/width states do not inherit a transitioning sidebar.
5. Realistic-ID evidence is credible through returned-ID routing plus direct PostgreSQL `length(id) >= 20`, but record/assert the exact browser-created ID shape in the responsive report rather than relying only on length.
6. No screenshots, zoom, screen-reader, high-contrast, reduced-motion, right-sidebar, or relationship-sheet responsive evidence is added. The ledger correctly leaves broader GAP-11 work open.

### VERIFIED

1. The declared four-file hash independently recomputes to `a78e6bcc9815ee48361faa188a4d9516b9db122d8dc37d6c265499d397b8d611`.
2. The loop uses exact CSS widths 320, 375, 390, 768, and 1440 and asserts `window.innerWidth` matches each state label.
3. The 30-state count is executable and non-inflated: four distinct routes plus one left-sidebar state and one delete-dialog state per width; `responsiveEvidence.length === 30` is asserted.
4. Home, list, create, and returned-ID item routes each have state-specific readiness. List/item require the persisted long label; create requires the real field control; item is the same Prisma-created Todo used throughout CRUD evidence.
5. The browser updates that Todo to the exact responsive label and checks returned ID/label. Direct PostgreSQL verification requires the same label and a generated ID of at least 20 characters.
6. Mobile sidebar is opened through the real trigger and closed with Escape; desktop left sidebar is toggled through the real trigger; delete opens the real Todo alert dialog and Cancel closes it.
7. The PageBreadcrumbs/action changes address the observed min-content causes: shrink/overflow boundaries, wrapping actions, automatic minimum header height, and truncating the current breadcrumb while preserving full DOM text.
8. Oversight independently ran `npm run test:dashboard:browser:prisma`. It passed all 30 states plus existing CRUD/document/relationship/a11y checks with 3,166 events, zero navigation aborts, and zero unexpected request/response/console errors. Direct PostgreSQL persistence and database cleanup passed.
9. Independent cleanup found zero `tks_parity_browser_%` and `nks_oracle_%` databases, no app/oracle/browser/profile/temp-copy process or directory, and PostgreSQL stopped. Both checkpoint hashes remained unchanged.
10. GAP-03 is not closed by this review; the false-pass blockers and broader visual/a11y states remain.

### Reviewer commands

```text
npm run test:dashboard:browser:prisma
# inspect responsiveEvidence collection/assertions and exact UI sidebar/dialog implementations
ps -axo pid,ppid,pgid,etime,command | rg "validate-dashboard-browser|.output/server/index.mjs|tks-firefox-|validate-sibling-oracle|nks-oracle-" || true
find "${TMPDIR:-/tmp}" -maxdepth 1 -type d \( -name "tks-firefox-*" -o -name "nks-oracle-*" \) -print
# bounded PostgreSQL readiness/catalog check for tks_parity_browser_% and nks_oracle_%, then restore stopped state
```

## Review 016 — REVIEW CHECKPOINT READY 015 (gate remediation and correlated cancellation)

**Status:** **SIBLING LIFECYCLE VERIFIED; RESPONSIVE AND GAP-04 SUB-BOUNDARIES SUPERSEDED / AWAIT REPLACEMENT HASHES.** Their behavior passed during review, but acceptance is withheld until field freeze, inclusion of `vite.config.ts`, and exact-hash Prisma/Nitro reruns. GAP-02/03/04 remain IN REVIEW.

### VERIFIED

1. The sibling and GAP-04 hashes independently recompute exactly to `5d7d01d94ad4bb356ded22c18b69dcfb7477aa98e82b9d7abd4719c25955c8ed` and `4f80daaf2070a54bd7fd2316be36513789e60e8456bbe211c2a60b403ca1c7d8` using the checkpoint's concatenated-content method.
2. Sibling cleanup now performs state inspection/startup, readiness, drop, absence, and exact state restoration as independent phases. A readiness probe can report failure without skipping drop/absence. Exact-profile TERM/KILL cleanup supplements process-group cleanup.
3. The sibling validates the generated Todo ID before SQL interpolation and rejects unexpected fetch failures, all HTTP 4xx/5xx responses, and console errors. Documentation clearly bounds direct-GraphQL create and synthetic defaults.
4. Oversight independently ran `npm run test:sibling:oracle`: init/auth/home/list/create/item passed with 227 events, nine expected navigation aborts, zero unexpected browser fetch/4xx/console errors, exact database persistence, unchanged sibling source, and clean teardown.
5. Responsive code asserts exact generated CUID shape and an exact persisted label containing realistic spaced text plus a genuinely unbroken token. It checks document/body width, all visible unexpected offenders, state-specific key containers, fixed overlays/actions, sidebar/dialog modal semantics, expanded state, focus containment/return, and desktop restoration.
6. The overflow allowlist is narrow and state-explainable: clipped breadcrumb descendants, closed off-canvas sidebar descendants, and children of bounded explicit horizontal scrollers. Every allowed reason/count is emitted; unexpected offenders fail.
7. During review the custom-view agent changed field-zoo branches in `scripts/validate-dashboard-browser.mjs`, then isolation work also changed shared `vite.config.ts`. Oversight's full Prisma run passed all 30 states with 3,166 events and zero unexpected network/console errors, including bounded 320px mobile Sheet, 768px restored desktop sidebar, and 1440px alert dialog. This is strong behavioral evidence but no longer an acceptable exact source boundary.
8. GAP-04 executes nine unique throttled requests. Each browser request ID ends in `NS_BINDING_ABORTED` without an HTTP completion, while its application request ID reaches Nitro's hook with authoritative disconnected/aborted state and no product error log. Real create/item/list navigations settle successfully.
9. The control cases are material: an equivalent throttled request completes HTTP 200 without an error-hook observation; raw `ECONNRESET` stays quiet; genuine fault remains a correlated JSON 500 and server error log. Request IDs/pathnames are bounded and query strings are excluded.
10. Oversight independently ran `npm run test:nitro:errors`; all nine correlations, completion, disconnect, genuine fault, ordinary-build omission, browser/profile cleanup, and output cleanup passed. Because `vite.config.ts` participates in build-conditional fault isolation and changed afterward, this execution is historical behavior evidence pending the replacement exact-hash boundary.
11. Independent post-run inspection found no matching sibling/Nitro/Prisma app, browser, profile, temporary directory, or database. PostgreSQL remained running because it was already in use by parallel product work.

### IMPORTANT

1. Freeze field-zoo isolation, include `vite.config.ts` in the responsive and GAP-04 boundaries, publish replacement hashes, and rerun Prisma/Nitro at those exact hashes. The prior passing behavior should make this bounded provenance verification, not new product work.
2. The horizontal-scroller allow rule remains intentionally generic. If a future regression nests fixed/action content inside a scroller, state-specific key/action rectangle assertions must remain the controlling protection.
3. The derived sibling remains a compatibility oracle, not proof that the authoritative sibling dashboard is repaired. GAP-02's status remains bounded accordingly.
4. GAP-04's executable acceptance is now credible, but no `READINESS.md` or dissertation row changes by implication.

### Reviewer commands

```text
npm run test:sibling:oracle
npm run test:nitro:errors
npm run test:dashboard:browser:prisma
# recompute the three concatenated-content hashes
# inspect exact matching processes/profiles/temp roots and nks_oracle_*/tks_parity_browser_* databases
```

## Review 017 — REVIEW CHECKPOINT 016 SUPERSEDED (`opensource.builders` runtime cutover)

**Status:** **SUPERSEDED / CHANGES REQUIRED. Historical backend/runtime evidence is VERIFIED, but this is not a current acceptance boundary.** The dashboard false-pass below and post-hash two-profile generalization require a replacement checkpoint. GAP-13 correctly remains IN PROGRESS.

### BLOCKING

1. **The dashboard assertion materially false-passes authentication redirects and dashboard error states.**
   - The canary uses `fetch('/dashboard/<OpenSourceApplication path>', { cookie })`, follows redirects by default, and checks only final HTTP status 200.
   - An invalid session redirect to `/dashboard/signin` ends in 200 and passes. A model route rendering a 200 dashboard error boundary also passes—the exact failure class that made the authoritative sibling unusable.
   - Required for the next Openfront/os.org boundary: assert the final response URL remains the exact generated model path and was not redirected unexpectedly; assert rendered content identifies Open Source Applications/model data and excludes sign-in and dashboard error-boundary text. A real browser route assertion is preferable when client hydration is part of the claim.

### IMPORTANT

1. The transplanted source models use a generated permissive `access.ts` compatibility scaffold. This proves model initialization, session auth, GraphQL/runtime CRUD, and relationships, but not source Openfront access-policy parity. Keep this security boundary explicit; test the real access rules before any production access-control claim.
2. The runtime uses Vite development mode, not a production build of the transplanted fixture. That is acceptable for this local canary but does not establish production deployment parity.
3. Synchronous npm/Prisma/Docker commands have no explicit timeout, process cleanup targets the immediate `npx` child rather than a detached group/profile identity, and failure-path database drops suppress cleanup errors. The exact normal run was clean, but unattended CI should bound commands and surface/verify failure cleanup before treating this as a durable release gate.
4. The shared `node_modules` symlink can mutate source-side Vite/Nitro caches. The current checkpoint proves database/process/temp cleanup, not cache immutability.

### VERIFIED

1. Oversight recomputed and independently executed historical formatted hash `887530d38636ad55cc1ce298503342d446794c4522c259429f4d16ccff1699b3` before subsequent `os.org` profile edits moved the script. This verifies the recorded backend run only; it does not make the superseded checkpoint current.
2. The source registry has exactly the eight selected models; their initializers are read from `/Users/junaid/Code/opensource.builders` and rewritten only inside a unique disposable copy.
3. The fixture generates CMS, GraphQL, Prisma, and TypeScript artifacts; generates an empty-to-current migration; deploys it to a unique PostgreSQL database; generates a real Prisma client; and seeds representative role/user/category/application/capability data.
4. GraphQL transport fails on non-200 or any GraphQL errors. Password authentication returned the success union and a real session cookie.
5. Seeded category/proprietary/open-source/capability relationships were resolved through the transplanted runtime. Domain mutations created category, proprietary application, open-source application, and capability join data; an update was reloaded with the exact relationship through PostgreSQL-backed GraphQL.
6. The custom-format dump is captured before CRUD, restored into an independent database, and verified to retain the seeded relationship while excluding the post-dump `canary-app` row. This is meaningful rollback evidence rather than a same-database query.
7. Oversight's independent run passed the complete generate/migrate/auth/dashboard-status/relationships/CRUD/persistence/dump-restore flow. It verified removal of both databases, direct/Vite processes, and the unique temporary fixture afterward.
8. `os.org`, real provider credentials/objects, production data, domain routes, and in-place migration remain explicitly excluded. No broader Openfront cutover or GAP-13 closure is accepted.

### Reviewer commands

```text
npm run test:openfront-runtime-canary
# inspect source registry/model initializers and generated compatibility access/config
# inspect exact canary process/temp roots and tks_openfront_canary_* databases
```

## Review 018 — REVIEW CHECKPOINT READY 017 (frozen responsive/GAP-04 replacements)

**Status:** **VERIFIED for the replacement responsive and correlated-cancellation boundaries.** Responsive hash `a61a761864c32bf5c2ace68c901bc74f656024a07950167f55737f875a712d33` and GAP-04 hash `7037f10d15235b84770b3452232f71b443ad550d56aaad8efa00cd63dbcfb2a0` both include `vite.config.ts`, recompute exactly, and passed repeated clean-build runs without source drift. This accepts executable GAP-03/GAP-04 evidence within the declared scope; it does not close broader GAP-11 or modify `READINESS.md`.

### VERIFIED

1. Integration ran two fresh disposable-Prisma passes at unchanged responsive hash `a61a761…`; each passed 3,166 Firefox events and all 30 route/sidebar/dialog states with zero unexpected request, response, console, or visible-overflow offenders. Oversight independently reran the same command at the exact hash and obtained the same 3,166-event/30-state pass.
2. The matrix retains real-CUID create/update/persistence, rich document marks, relationship card create/edit/disconnect/reconnect, 320/375/390/768/1440 widths, sidebar and delete-dialog semantics, keyboard focus, exact visible-offender rejection, and bounded exceptions only for closed off-canvas sidebars or contained horizontal table scrolling.
3. Integration ran two clean-build GAP-04 passes at unchanged hash `7037f10d…`. Oversight independently reran `npm run test:nitro:errors` at that hash: nine unique Firefox `NS_BINDING_ABORTED` requests correlated to authoritative Nitro disconnect state without product-error logs; the throttled HTTP-200 control, raw `ECONNRESET`, and genuine correlated JSON/log 500 controls all passed.
4. The provisional responsive run correctly exposed a real `relatedList is not defined` dashboard error boundary during relationship-card rendering. The final boundary receives/destructures the metadata-derived list, and the full relationship workflow now passes. Provisional hashes `0d1de392…` and `e6dacf43…` remain RED/integration history only.
5. GAP-04's initial replacement attempts correctly failed while an in-progress MCP route used a non-literal route ID and broke TanStack crawling. The route now uses the exact literal, normal production build passes, and the two Nitro passes plus oversight rerun establish that this was repaired rather than ignored.
6. After oversight runs, both hashes remained exact; no matching Prisma database, app/Nitro process, exact Firefox profile, or `tks-firefox-*`/`tks-abort-stress-*` directory remained. The already-running PostgreSQL container was left in its initial running state.

### BOUNDARIES

1. This does not supply manual screenshots, screen-reader, zoom, high-contrast, reduced-motion, or every right-sidebar/relationship-sheet state under GAP-11.
2. GAP-02 remains bounded by the accepted derived sibling oracle. GAP-01 remains in progress. No release/dissertation row or `READINESS.md` entry changes by implication.

## Provisional Review 019 — replacement two-profile Openfront handoff

**Status:** **PRODUCT/ROUTE EVIDENCE CREDIBLE; CHANGES REQUIRED FOR FINAL ACCEPTANCE.** Both `opensource.builders` and `os.org` passed at formatted unchanged script hash `c1137920bebb5bddcd4167cdcd681fbdfd788512ecbb9bb2665c7cae359c8a4e`. The new assertions close checkpoint 016's principal dashboard false pass, but the claimed cache cleanup is false.

### VERIFIED

1. Each profile derives the real source model registry into a disposable fixture, generates CMS/GraphQL/Prisma artifacts, migrates and seeds unique PostgreSQL, authenticates, and executes domain CRUD/relationships/persistence plus pre-CRUD custom-format dump restore.
2. Dashboard requests use bounded manual redirects, require final HTTP 200 at the exact generated model-list pathname, require model-specific heading and seeded record content, and reject sign-in/error-boundary text. `opensource.builders` rendered `Open Source Applications` / `Starter Replacement`; `os.org` rendered `Products` / `Canary Platform`.
3. Reports explicitly state that permissive generated access is compatibility scaffolding, not source access-policy parity. No production security-policy claim is accepted.
4. Both databases, Vite children, and temporary fixture roots were absent after the runs. The script and reports retained the same `c1137920…` hash.

### BLOCKING FINDING

1. `copyRuntime()` symlinks the entire source `node_modules`. The two-profile runs wrote disposable fixture configuration into source `node_modules/.cache/jiti`; oversight directly found many `openfront-runtime-canary-*-cms.config.*.mjs` entries, including the final fixture identifiers. The cleanup scan omitted `.cache/jiti`, so “no cache residue” is false. Recent source `.vite` writes further show that marker-only scanning is not an exact restoration proof.
2. Final acceptance requires fixture-local writable Vite/Nitro/jiti caches or exact pre-state snapshot/restore, source-cache fingerprints plus marker/path absence, targeted cleanup of existing canary residue, and both profiles rerun at one new formatted unchanged hash. `c1137920…` remains useful product/route/backend evidence, not a final cleanup boundary.

## Review 020 — REVIEW CHECKPOINT READY 018 (auth continuity)

**Status:** **SUPERSEDED / NOT REVIEWABLE AT THE PUBLISHED HASH.** Checkpoint 018 published auth manifest hash `c75c5e11bb9463a33109c9426c9a0b666bac8714a2ac28c5d508e2e40804007f` while the auth owner was actively implementing oversight-required reset non-enumeration, stale-report, and cleanup assertions. The current owned-file manifest differed immediately after publication and continued moving. The historical run remains useful bounded auth evidence, but it cannot be accepted as a frozen checkpoint.

### REQUIRED REPLACEMENT

1. Prove known and unknown `sendPasswordResetLink` requests have the same public result while only the known account stores reset state/invokes the hook and no token leaks to response/report.
2. Remove or overwrite stale PASS evidence at run start, emit explicit FAILED evidence on failure, and assert exact disposable container/temp/worker absence rather than swallowing cleanup failure.
3. Format, rerun continuity plus focused auth/build/TypeScript checks, compute a new exact manifest/report hash only after the source is frozen, and publish a replacement checkpoint. Preserve the process-local limiter, external SMTP/proxy staging, incompatible sibling Iron-cookie, and stateless bearer-revocation boundaries.

## Review 021 — REVIEW CHECKPOINT READY 019 (secured MCP mutation boundary)

**Status:** **CHANGES REQUIRED.** The generated-operation allowlist, GraphQL access enforcement, mutation confirmation flag, same-origin check, redacted bounded audit, and create/update/read/delete persistence are useful executable foundations. Two security false passes block acceptance.

### BLOCKING FINDINGS

1. `listModels` and `getFieldsForType` enumerate every registry list, readable field, and generated mutation name to any authenticated session. They filter static GraphQL enablement only; they do not evaluate that session's list operation/UI access. The worker proves an editor cannot create a Role but never checks that the same editor is prevented from discovering `Role`/`createRole`. Public model/operation metadata is an API/security boundary and must be session-aware, with a low-privilege non-disclosure test.
2. `MCP_MAX_BODY_BYTES` is not an actual memory bound when `Content-Length` is absent or false. The unauthenticated endpoint executes `await request.text()` and buffers the full body before checking encoded size. Read and cancel the request stream incrementally once the 64 KiB limit is exceeded; add a chunked oversized-body test and audit only the fixed rejection code without payload leakage.
3. `confirmed: true` is accepted only as a protocol boolean gate. It does not prove human approval, payload-bound intent, or the end-user AI-sidebar review UX; the checkpoint correctly leaves that boundary open and must not call the flag itself human confirmation.

### VERIFIED WITHIN THE REJECTED CHECKPOINT

1. The exact literal TanStack route repaired the prior route-crawl/build RED. The focused worker authenticates real seeded roles, and GraphQL access denies editor `createRole` while allowing admin Todo CRUD.
2. Mutation operation names are selected from generated list metadata rather than accepting arbitrary GraphQL text; selected fields are allowlisted and bounded, mutation calls require the boolean gate, and returned IDs/persisted update/delete are asserted.
3. Same-origin browser requests, malformed JSON-RPC, unauthenticated calls, invalid operations/fields, and unconfirmed mutations are denied. The in-memory audit is capped at 100 and its tested serialization excludes credentials, payloads, and returned data.
4. Shared audit durability, deployment transport/session affinity, custom GraphQL extensions, and end-user confirmation UX remain explicitly outside scope.

## Review 022 — REVIEW CHECKPOINT READY 020 (replacement auth continuity)

**Status:** **VERIFIED for the bounded GAP-09 auth/session/reset boundary.** Manifest `a2161cdfd9573abc5fe43c06ddcb3a06eb456eea457751130b24d90b1b6d69f2` recomputes exactly. Oversight independently reran the complete disposable-PostgreSQL continuity command at that hash; it passed, regenerated `Status: PASS`, and left no matching worker, container, or temporary directory.

### VERIFIED

1. Fresh migrated initialization returns a generated ID and session cookie; password sign-in hydrates the same seeded user in a separate Node process when the session secret is shared. Secret rotation rejects the prior token. Sign-out emits cookie deletion and a subsequent no-cookie request is anonymous.
2. The generic auth contract executes `Account(handle, credential)` without fixed User/email/password names. The bounded legacy replacement-HMAC parser is tested, while incompatible sibling Iron-cookie survival is explicitly not claimed.
3. Password reset changes the password, rejects replay with `TOKEN_REDEEMED`, rejects a 25-hour token with `TOKEN_EXPIRED`, and now compares known versus unknown reset-link requests: both return the same public Boolean, only the known account stores reset state and invokes the token hook, and no token appears in public output/report.
4. Trusted-proxy HTTPS/HTTP cookie-security behavior and generic login failure/rate-limit behavior execute. Cookies/tokens are redacted and the fixed secrets do not appear in the report.
5. The gate deletes the prior report, writes RUNNING, emits FAILED after cleanup on error, emits PASS only after acceptance and cleanup, and asserts exact named container, worker, and temporary-directory absence. Oversight's post-run manifest remained `a2161cdf…` and cleanup checks were empty.

### BOUNDARIES

1. The limiter is process-local; production multi-instance deployments require shared/edge enforcement. Real proxy/clock behavior needs staging.
2. SMTP is reviewed with provider continuity. Stateless browser sign-out cannot revoke a retained bearer without stored-session/revocation policy.
3. This acceptance is bounded executable GAP-09 evidence, not a `READINESS.md` or dissertation-row change by implication.

## Review 023 — REVIEW CHECKPOINT READY 021 (schema state machine)

**Status:** **SUPERSEDED / CHANGES REQUIRED.** The normal `b1c6f61b…` run provides strong schema/data-safety behavior, but checkpoint 021 was published while oversight-required lifecycle changes were active and therefore was already stale. Its report's “bounded state machine” claim was also false at the published hash.

### VERIFIED HISTORICAL PRODUCT EVIDENCE

1. The disposable state machine executes baseline → additive model/field → customized SQL rename preserving `db.map` data → type change → relationship → guarded destructive removal after backup → revert.
2. Generated GraphQL/AdminMeta/view-order/custom-view/types/Prisma artifacts are checked, Prisma Client is regenerated, fresh-process sudo GraphQL/Prisma CRUD executes, relation/revert production builds pass, and final migration status is clean.
3. A custom-format dump restored to a separate database preserves populated field/relation data and excludes later state. The destructive migration is rejected without explicit acknowledgement.
4. Normal cleanup restored source artifact/cache fingerprints and removed the database/container, temporary fixture, external cache snapshot, process, and marker residue. An interrupted run correctly replaced stale PASS with FAILED evidence.

### BLOCKING FINDINGS

1. `run()` used `execFileAsync` without a timeout and `docker()` used `execFileSync` without a timeout. npm, Prisma, tar, or Docker could hang forever, bypassing the asserted cleanup. Calling this bounded was a material false claim.
2. Temporary fixture/report/fingerprint/external-snapshot allocation occurred before the protected lifecycle, leaving an earliest-preflight leak window. The owner is moving these into an outer protected scope and adding finite command/Docker deadlines.
3. The schema source changed after `b1c6f61b…`; a new formatted full run, exact aggregate/report hash, timeout behavior, and zero fixture/container/process/external-snapshot/cache residue are required. Preserve the explicit sudo-GraphQL-not-browser boundary.

## Review 024 — REVIEW CHECKPOINT READY 022 (bounded schema state machine)

**Status:** **VERIFIED for the bounded GAP-14 schema/data-safety workflow.** Aggregate `dca7feb34a020eb3326a0eecbfc579282ae30888cac401c4d359b0fb040c1774` recomputes exactly. Oversight independently executed the timeout probe, earliest-preflight failure probe, and complete disposable workflow at that hash; both probes failed as intended with FAILED evidence and zero residue, then the full state machine passed and restored exact source fingerprints.

### VERIFIED

1. Baseline → additive model/field → SQL rename preserving `legacy_text` → numeric type change → relationship → removal blocked by destructive guard → explicit allow after backup → revert all execute against unique disposable PostgreSQL.
2. Each meaningful phase generates/checks GraphQL, AdminMeta, view-order/custom-view, types, Prisma schema/client artifacts and exercises fresh-process sudo GraphQL CRUD. Relation and reverted states build, and final Prisma migration status is clean.
3. The custom-format dump restores into a separate rollback database and preserves populated legacy/custom/relation data; later destructive state is not mistaken for rollback success. The rollback database is dropped and absence-checked.
4. npm/Prisma/tar/Docker/process inspection now use finite deadlines. The timeout probe kills a deliberately hanging child. The preflight probe exercises failure before database startup and leaves FAILED report evidence without fixture/container/process/external-snapshot residue.
5. PASS is emitted only after cleanup. Oversight's post-run aggregate remained exact; no `gap14-*` fixture/container/process, external `gap14-cache-*`, source marker, generated-artifact drift, or writable-cache drift remained.

### BOUNDARIES

1. CRUD is fresh-process sudo GraphQL/Prisma adapter evidence, not rendered dashboard migration UX.
2. Production backup operators, all database/version transitions, and watcher automation remain outside scope. No `READINESS.md` or dissertation row changes by implication.

## Review 025 — REVIEW CHECKPOINT READY 023 (custom views and field zoo)

**Status:** **VERIFIED for the bounded memory-backed custom-view/field-zoo workflow.** Aggregate `59f29269a1d581789733630a1fe455e2a7a1614764d4abe940cdb7724f8fc6bb` recomputes exactly. Oversight independently reran both field-zoo and normal arbitrary Firefox workflows at that hash; they passed 586 and 520 events respectively with zero unexpected request/response/console errors and no residue.

### VERIFIED

1. The captured create mutation, exact UI hydration, and raw GraphQL reload cover text, textarea, checkbox, select, multiselect, integer, float, decimal, bigint, local-date/time to exact UTC timestamp, JSON, document, one/many relationships, and scalar virtual output. Raw `ratio === 3.5` is explicitly asserted.
2. Image/file modes are asserted hidden on create and read-only on item rather than being falsely claimed editable; provider upload behavior remains a separate boundary.
3. The browser executes the generated custom `Field` and `Cell`. A relationship cards view with custom label field executes `CardValue` and asserts exact `CARD:Zoo relation` output.
4. The fixture's custom controller has observably distinct `controller:` serialization. The exact create mutation contains the prefix, persisted raw data retains it, the custom controller strips it for form rehydration, and the custom Cell sees the stored value. A focused fixture contract also directly executes the controller and exported components.
5. Field-zoo-only browser logic stays in the disposable wrapper; the accepted shared browser/Vite/Nitro boundary files remain unchanged. The normal arbitrary Account/Project workflow passes after the fixture-specific run.
6. TypeScript, focused tests, production build, and formatting passed. Oversight's post-run aggregate remained exact; no temporary fixture/profile, app/WebDriver process, or source cache marker remained.

### BOUNDARIES

1. This does not prove editable image/file in the field zoo, every virtual return shape, custom npm-package resolution in all deployments, or a Prisma-backed all-field zoo.
2. GAP-06/GAP-07 remain **IN REVIEW** pending dissertation reconciliation; no `READINESS.md` change is implied.

## Review 026 — REVIEW CHECKPOINT READY 024 (advanced document + one nested rollback)

**Status:** **VERIFIED for the bounded disposable-Prisma advanced-document workflow; not accepted as full GAP-05 or GAP-08 closure.** The five submitted file hashes recompute exactly. The owner run and oversight's independent unchanged-hash run both passed with 191 Firefox events, zero network failures, zero console errors, exact source hashes, and complete cleanup.

### VERIFIED

1. A copied fixture generates CMS/Prisma artifacts, synchronizes a unique PostgreSQL database, performs a production build, starts bounded app/Firefox process groups, initializes a real authenticated account, and exercises the rendered Article create/item dashboard.
2. Trusted Firefox interaction inserts a configured `[2,1]` layout, an inline Author relationship, and a component block. The component block starts with schema defaults, accepts nested `message`/`tone`/numeric `count` edits, and selects a relationship carrying the real seeded Author ID and label.
3. The captured `createArticle` request contains the exact layout, inline relationship ID/label, component relationship ID/label, and edited nested props; the response returns a generated Article ID and the dashboard navigates to that exact item route.
4. A new item-route navigation reloads component/layout/relationship content. A second UI edit and captured `updateArticle` survive another navigation. Authenticated raw GraphQL with relationship hydration and direct PostgreSQL JSON inspection independently retain the final component props, Author identity/label, layout ratio, and updated content.
5. An invalid document update returns GraphQL errors without replacing the valid stored document. A nested create that first creates a lead Author and then connects a missing contributor fails, and direct PostgreSQL counts prove neither the nested Author nor Article survives. This is substantive atomic rollback evidence for **one** relationship shape.
6. The harness isolates Vite/Nitro/Jiti writable caches rather than symlinking source cache directories. Owner and oversight runs left no `tks-gap0508-*` fixture/profile, process, `tks_gap0508_*` database, or source-cache fixture marker; the initially running PostgreSQL container remained running.
7. Focused document tests pass 7/7, including schema-aware metadata/default normalization and insertion after menu focus clears the Slate selection. Package, gate, product, test, shared browser/Vite/Nitro hashes remained byte-identical across oversight's run.

### IMPORTANT BOUNDARIES

1. The checkpoint wording “PostgreSQL-backed relationship cardinality/ownership” must be read narrowly. It proves one leadAuthor-create plus missing-contributor-connect rollback, not GAP-08's required metadata-generated owner/cardinality matrix, access/hook/storage failures, required disconnect/delete behavior, concurrency, mapped names, or production Prisma-error coverage. GAP-08 remains open/in review.
2. GAP-05's dissertation acceptance is broader than this gate. Paste normalization, unknown-node lossless round-trip, formatting-control gating, relationship editing after insertion, all configured node types, read-only keyboard/accessibility behavior, and before/after normalized-JSON comparison are not established here. In particular, this gate intentionally rejects an unknown node; it does not prove unknown-node round-trip. GAP-05 remains open/in review.
3. The copied fixture uses authenticated UI plus raw GraphQL/PostgreSQL checks. Raw persistence assertions must not be described as rendered dashboard operations, and this single fixture does not imply arbitrary consumer-schema coverage.

### Reviewer commands

```text
npm run test:dashboard:browser:advanced-document
npx vitest run tests/dashboard-document-view.test.ts
# compare checkpoint/product/shared hashes before and after
# inspect exact gate processes, temp/profile roots, tks_gap0508_* databases, and source cache markers
```

## Review 027 — replacement two-profile Openfront hash `3c6d1182…`

**Status:** **CHANGES REQUIRED; the cache-isolated PASS reports are a material cleanup false pass.** Product/auth/route/CRUD/rollback evidence remains credible, but hash `3c6d1182b31da575f4ef6e49a91f023c6bc604db3d15e0b54d9efbbb1806ce13` cannot be accepted as final cleanup evidence.

### BLOCKING FINDINGS

1. The success path calls `restoreSourceCaches()`, then removes `temporaryRoot`, which contains `.source-cache-snapshot`, computes the matching fingerprint, and writes PASS. The unconditional `finally` then calls `restoreSourceCaches()` **again**. That function first recursively deletes each source cache directory and restores it only if the snapshot exists. Because the snapshot was just deleted, the second call leaves `node_modules/.cache/jiti`, `node_modules/.vite`, `node_modules/.nitro`, and `.tanstack` erased **after** the asserted fingerprint and PASS report.
2. Oversight directly found all four source cache directories absent after the reported runs. The reports' equal before/after values were measured before the destructive final restore and therefore do not establish final process-exit state. This is exactly the post-assertion cleanup false-pass class the schema workflow was hardened against.
3. `run()` and `dockerExec()` use synchronous child execution without timeouts. npm, Prisma, migration, dump/restore, or Docker can hang indefinitely and prevent `finally` from running. The Vite process is not a detached process group; terminating the immediate `npx` child is not sufficient failure-path descendant cleanup evidence.
4. Existing PASS/provisional reports must be invalidated. A replacement needs idempotent one-time cache restoration or a snapshot whose lifetime extends beyond all cleanup, finite command deadlines, process-group TERM→KILL, failed-run reporting after cleanup, explicit database/process/temp absence, and an **external post-process** source-cache fingerprint check. Both consumer profiles must pass at one new formatted unchanged hash.

### RETAINED HISTORICAL EVIDENCE

The strict final-path/no-redirect/rendered model-content/sign-in-error exclusion, authentication, real model transplant, domain relationships/CRUD, persistence, and pre-CRUD dump/independent restore behavior remain useful historical product evidence. Permissive access remains compatibility scaffolding only, not source access-policy parity.

## Review 028 — REVIEW CHECKPOINT READY 025 (two-profile Openfront replacement)

**Status:** **VERIFIED for the bounded `opensource.builders` + `os.org` compatibility-runtime boundary.** Frozen aggregate `8d9d386f03ea81fce7338db8672b9299aec77aa099d969e2a9ae891fe99aa3df` recomputes over the five submitted files. Oversight observed the exact wrapper run and independently checked process/database/dump/temp/cache residue and accepted hashes after process exit.

### VERIFIED

1. The wrapper first ran an intentional `opensource.builders` failure after Vite readiness. The owned detached launcher reported real stubborn PID `94412`; Vite and the TERM-ignoring non-detached descendant shared its process group. The canary returned nonzero, TERM→KILL completed, the report was BLOCKED, and the parent still ran every external hash/cache/database/dump/fixture/process check before allowing normal profiles.
2. Both normal consumers passed at unchanged canary `87314143…34ec`, wrapper `ed711eb9…ef5f`, bounds probe `413c04de…3dca`, hanging fixture `57128a64…05c`, and launcher `4a01ba6f…31b5`. The bounded-child helpers and accepted document/responsive/Nitro files remained exact.
3. `opensource.builders` transplanted the eight real source model initializers, generated/migrated/seeded disposable PostgreSQL, authenticated, and rendered the exact final `/dashboard/open-source-applications` path containing `Open Source Applications` and `Starter Replacement`, with no sign-in/error-boundary output.
4. `os.org` transplanted seven real source model initializers and rendered the exact final `/dashboard/products` path containing `Products` and `Canary Platform`, with the same authentication/no-error checks.
5. Each profile resolved representative domain relationships, executed domain CRUD, reloaded persisted PostgreSQL-backed updates, captured a pre-CRUD custom-format dump, restored it into an independent rollback database, retained seeded relationships, and excluded post-dump CRUD rows.
6. All child/npm/Prisma/Docker operations have finite deadlines and process-group cleanup. Dump files are copied through unique container paths rather than corrupting binary data through text capture; each path is removal-checked.
7. Internal cache restoration is one-time and snapshot-manifest guarded. After each child fully exited, the parent measured identical source-cache fingerprint `69f78ecf2c1eb03a439d46c21f56eec1c878c581b1dcc1d83c0d4ed0232f9c60`, zero canary markers, zero matching database/container dump/temp fixture/process, and unchanged accepted hashes. Oversight's separate post-run checks were also empty.

### BOUNDARIES

1. Generated permissive access is compatibility scaffolding only. This does **not** prove either consumer's real source access-policy parity or production authorization posture.
2. This is a local Vite development runtime using representative seed data, not a production build, sanitized production dump, in-place migration, production provider/domain cutover, or external credential/object test.
3. `c1137920…` remains historical route/backend evidence, and `3c6d1182…` remains rejected cleanup evidence because its post-PASS `finally` could erase source caches. Only checkpoint 025 is accepted as the current bounded two-profile boundary.
4. GAP-13 remains **IN PROGRESS** beyond this canary. No `READINESS.md`, dissertation release row, or production-cutover claim changes by implication.

### Reviewer commands

```text
node scripts/run-openfront-runtime-canary-checkpoint.mjs
# inspect the full failure-probe -> opensource.builders -> os.org log
# recompute five-file aggregate and accepted canonical hashes
# inspect exact process, tks_openfront_* databases, container dumps, fixture roots, and source cache markers after wrapper exit
```

## Review 029 — REVIEW CHECKPOINT READY 026 (secured MCP replacement)

**Status:** **VERIFIED for the bounded GAP-12 authenticated MCP security/mutation/route subset.** Aggregate `4e7159e512f820c5a4160b679039c132dcd07039c661baa43ec49c918004aca1` recomputes over the four exact files. Oversight independently reran the focused test and exhaustive memory worker at those hashes; both passed and left no matching process/temp residue.

### VERIFIED

1. The exact literal TanStack route builds in normal client/SSR/Nitro production output. Unsupported transport returns 404; unsupported HTTP method returns 405 with `Allow: POST`; cross-origin browser requests are denied.
2. JSON-RPC parse, invalid request/id, method, and params errors are structured. `notifications/initialized` without an ID receives transport-level HTTP 202 with an empty body; a notification carrying an ID and a request missing an ID are rejected distinctly.
3. No arbitrary GraphQL document is accepted. Tool operations must exactly match generated registry names, selections are registry field names capped at 32, list reads cap `take` at 100, and mutation data/where remain variables rather than query interpolation.
4. Real seeded sessions authenticate an admin and restricted editor. Anonymous calls fail; editor Role mutation names are omitted while policy-permitted Role read visibility remains; protected password metadata is absent; list filters return only the editor-owned Todo; foreign-item update and Role creation are denied by GraphQL access rather than `sudo` bypass.
5. Admin create/update/read/delete returns a generated ID and exact changed data. The final read is null after deletion. This is real executable memory-adapter persistence for the process, not external-database durability.
6. Every mutation requires `confirmed: true`. Unknown operations, invalid selections, malformed JSON-RPC, unconfirmed mutation, and cross-origin requests are denied with fixed public codes.
7. A no-`Content-Length` stream is read incrementally and cancelled before all chunks after crossing 64 KiB. A generated response over 256 KiB is replaced by `MCP_RESPONSE_TOO_LARGE`; cleanup deletes the large response fixtures.
8. The audit retains at most 100 entries containing timestamp, hashed request ID, allowed tool/operation/list names, outcome, and fixed error code only. Worker assertions exclude cookies, bearer/session tokens, password/input payloads, returned records, and test secrets.
9. Exactly one normal production build passed at the frozen MCP hashes, followed by focused 1/1, executable worker, ESLint, formatting, and a green global TypeScript run after an unrelated provider-only narrowing fix. MCP hashes remained exact; oversight's own rerun also passed.

### BOUNDARIES

1. `confirmed: true` is a protocol boolean, not proof of human review, payload-bound approval, or AI-sidebar confirmation UX. Those remain open.
2. The audit is process-local memory, not durable/shared multi-instance security telemetry. MCP memory-adapter CRUD is not cross-process or external-PostgreSQL durability.
3. Full MCP lifecycle interoperability is not proved: the handler advertises fixed protocol `2024-11-05` and does not validate/negotiate initialize parameters or session lifecycle, while its Streamable HTTP notification behavior follows newer transport rules. Protocol-version negotiation/client compatibility remains an explicit boundary.
4. The 256 KiB response check bounds emitted tool output after the GraphQL result has been materialized; it is not a streaming backend-memory bound for arbitrarily large scalar values.
5. Completion-route/sidebar wiring, remote deployment/session affinity, redirect/proxy behavior, persistent audit, and custom GraphQL extensions remain outside this checkpoint. GAP-12 remains **IN REVIEW**, and checkpoint 019 remains superseded.

### Reviewer commands

```text
npm test -- --run tests/mcp-mutations.test.ts
CMS_ADAPTER=memory node --import tsx tests/mcp-security-worker.ts
# recompute sorted four-file aggregate and inspect process/temp residue
```

## Review 030 — REVIEW CHECKPOINT READY 027 (local provider continuity)

**Status:** **VERIFIED for the bounded local GAP-10 storage/SMTP/rollback boundary; external provider parity remains unproved.** The eight-file aggregate `10a4fd530551c9f1e1d54bdd96b11133fcae0709ba8eb7f21de7e8dcc94b6104` recomputes exactly. Oversight independently reran the continuity harness and focused 2-file/6-test suite at that aggregate; both passed with no process/temp/public-file residue.

### VERIFIED

1. The local S3-compatible server independently verifies the implementation's canonical SigV4 request components. A pre-existing object is signed/read without upload, and the exact 256 KiB object boundary uploads while 256 KiB + 1 byte is rejected before provider I/O for File and GraphQL stream inputs.
2. Invalid `requestTimeoutMs` values fail before a provider request. Deliberately hanging PUT and DELETE requests abort within their configured 50 ms deadlines; PUT leaves no new key, failed DELETE preserves the existing object, and a subsequent normal delete removes it.
3. Local filesystem storage writes exact bytes inside its configured root and deletes the object. Filename/path safety remains enforced by product source.
4. A real multipart GraphQL mutation stores a PNG through the S3-compatible boundary, returns exact size and 3×2 dimensions, reads it through a generated signed URL, and explicitly deletes it.
5. A mutation that uploads an image and then fails a relationship connect returns GraphQL errors and removes the uploaded orphan. `CmsMutationState` executes cleanup in reverse order, aggregates cleanup failures, and clears rollback work after success.
6. Authenticated local SMTP wire behavior covers one transient failure followed by one delivery, permanent exhaustion, bad credentials, bounded stalled greeting/socket rejection, and no delivery on failures. Retry count is capped at 5, retry delay at 60 seconds, and connection/greeting/socket timeout defaults to 30 seconds; invalid or over-cap values fail before connection.
7. The continuity harness now examines every settled cleanup result, tracks provider/SMTP sockets, verifies the scratch directory is absent, and rejects/removes non-baseline object residue. No process, `gap10-provider-continuity-*` directory, or public file beyond `.gitkeep` remained after owner or oversight runs.
8. Exactly one normal production build, the full continuity harness, existing local provider scripts, focused 6 tests, global TypeScript, targeted ESLint, and formatting passed at the unchanged aggregate.
9. The corrected output scan excludes concrete synthetic credentials/tokens/body/recipient/auth values. The earlier match on the public identifier `SMTP_PASSWORD` was correctly classified as a scanner false positive, not ignored as a credential leak.

### BOUNDARIES

1. S3 and SMTP are loopback emulators. No real credentials, bucket/account policy, CORS, existing production object inventory, TLS/auth network path, deliverability/bounces, staging, CDN, or production deployment was exercised.
2. Upload streams are bounded by bytes but intentionally buffered before persistence. Slow-client upload-stream deadlines/backpressure and large-file memory behavior remain outside this checkpoint; provider PUT/DELETE timeout begins after buffering.
3. The orphan rollback workflow uses the memory adapter. Disposable-Prisma/provider transaction failure, multi-level hooks, old-object replacement deletion, concurrent mutation races, and cleanup failure against a real provider remain open.
4. The signer test checks canonical signing and configured expiry values, not real clock skew/expiration enforcement, IAM denial modes, temporary session credentials, retries, or multipart-provider semantics.
5. SMTP retry state is per request/process, not distributed coordination. Reset-request non-enumeration belongs to checkpoint 020; this provider gate does not independently establish it.
6. GAP-10 remains **IN REVIEW / EXTERNAL PARTIAL**. No `READINESS.md` or release-row change is implied.

### Reviewer commands

```text
npx tsx scripts/validate-gap10-provider-continuity.ts
npx vitest run tests/cms-password-reset-mail.test.ts tests/cms-mutation-state.test.ts
# recompute eight-file aggregate and inspect sockets/process/temp/public-file residue
```

## GAP-01 pre-checkpoint review — first wrapper RED

**Status:** **NO CHECKPOINT / SECOND RUN BLOCKED PENDING STATIC REPAIR.** The first authorized `node scripts/validate-gap01-arbitrary-shapes.mjs` invocation failed before build or Firefox at frozen six-file aggregate `4dc9e5c2c5f310049052b07d80f7cc7870a1c2d622d52926f329236397cdeaf5`. `patchBrowserScript()` required a stale single-line bounded-child import and raised `assert.ok(script.includes(importMarker))`. The aggregate was identical after failure; the wrapper's outer `finally` completed its source-cache checks and removed its temporary fixture, and follow-up inspection found no matching process/profile/temp residue. The RED log is `/tmp/gap01-wrapper-20260724-183329.log`; this is failure evidence, not a parity pass.

Static review also caught and independently reproduced an earlier user-probe timer leak: a completed overflow child kept the runner alive until the full timeout because the Promise-race timer was not cleared. The repaired runner now reports and blocks timeout-derived evidence, caps retained output, and passed executable overflow and stubborn-descendant cleanup probes. Focused contract tests pass 27/27. These harness repairs do not establish GAP-01 product behavior.

The multiline-import transform was narrowed, disposable scripts gained pre-build syntax checks, and wrapper summaries gained list/event/abort parsing. The second authorized wrapper nevertheless REDed when the first `staff-inventory` disposable child exited nonzero at unchanged six-file aggregate `bc5f43d1fbe608a9fb42741e617258efd54c8ea36ff30c8c0463e02a19fa26d9`; accepted checkpoint-017 content hash `a61a761…` and cleanup checks remained exact. Its log/report are `/tmp/gap01-wrapper-second-20260724-184031.{log,report}`.

That RED exposed a separate false-diagnostic risk: `runBoundedChild(captureOutput: true)` throws on nonzero without returning the captured streams, while outer cleanup correctly deletes the disposable fixture. A GAP-01-local replacement now preserves a unique external report on RED, caps combined streams, validates all bounds, rejects and cleans success-descendant leakage, retains primary plus cleanup failures, and passes 28 focused tests covering nonzero output, overflow, timeout/KILL, code-zero descendant leakage, markers, and temp cleanup. Frozen shared helpers/browser files were not changed.

The third authorized wrapper at unchanged nine-file aggregate `009e93ac062fb5d8a66b6e4badc2b341529396bc9a492d72ca01f9f9e4c4cdd7` correctly preserved the previously opaque root cause. Before Firefox, fixture generation failed because generated `cms.config.ts` imported nonexistent `isSignedIn` from `src/features/cms/keystone/access.ts`; that module exports only `allowAll`, `denyAll`, and `allOperations`. Log/report: `/tmp/gap01-wrapper-third-20260724-185754.{log,report}`. Full bounded child report: `/var/folders/cl/hn3xfghd7gg2m5fr8vb1mxz80000gn/T/gap01-evidence-MKrOMW/staff-inventory-273569154234750-browser-report.json`. Aggregate and accepted `a61a761…` remained exact; no profile, cache marker, process, or disposable fixture remained. This is a harness-fixture RED, not product parity evidence.

The fixture switched to a local typed sign-in predicate and both exact generated shape configs passed bounded import evaluation. The fourth authorized wrapper at unchanged aggregate `4f26313595c10fd298028a2609062f05d64104bc817ae170dd7304ae4b0d4d04` then built successfully and launched Firefox, but REDed in `staff-inventory` before initialization because the injected anonymous metadata check expected `isAccessAllowed === false`; actual was `true`. This is expected pre-init semantics: `createAuth(...initFirstItem...)` deliberately permits the initialization UI while no auth item exists. The check therefore tested the wrong lifecycle state and could not be weakened to pass. It was moved after initial-account creation and explicit sign-out, where anonymous metadata exclusion and direct denied mutation are meaningful, while pre-init access remains available. Fourth log/report: `/tmp/gap01-wrapper-fourth-20260724-190855.{log,report}`; bounded evidence root: `/var/folders/cl/hn3xfghd7gg2m5fr8vb1mxz80000gn/T/gap01-evidence-Z2aCa5`. Aggregate and `a61a761…` remained exact; no relevant process/profile/cache/fixture residue remained.

The fifth authorized wrapper at unchanged aggregate `b24c3a630825f5d8946e25ddc1ae4c60aa4ab80e38c2935c7ad0e968fe8f38fb` REDed before build because its new static order check falsely required exactly one `await navigate('/dashboard/signin')` in the entire shared browser file; two unrelated flows legitimately contain that marker. Log/report: `/tmp/gap01-wrapper-fifth-20260724-191358.{log,report}`; evidence root: `/var/folders/cl/hn3xfghd7gg2m5fr8vb1mxz80000gn/T/gap01-evidence-mPTowP`. Cleanup and accepted hash checks passed. Global shared-file marker counts are not valid lifecycle evidence.

After position scoping and a successful dry transform, the sixth authorized wrapper at unchanged aggregate `e150a6da20a66519cbeb852f9f6c402a632800351c5015edd4d360da73c1583d` built and launched Firefox but REDed because post-signout `keystone.adminMeta` returned `data: null`, not a false/empty metadata object. This is the runtime's intended security contract: `KeystoneMeta.adminMeta` throws `KS_ACCESS_DENIED` when `ui.isAccessAllowed` is false. The harness was repaired to assert access denial and absence of list metadata after immediate sign-in-route navigation. Sixth log/report: `/tmp/gap01-wrapper-sixth-20260724-192110.{log,report}`; bounded evidence root: `/var/folders/cl/hn3xfghd7gg2m5fr8vb1mxz80000gn/T/gap01-evidence-szemLo`. Hashes and cleanup remained exact.

The seventh authorized wrapper at unchanged aggregate `3fd51c430d9f8541299cdda08279c8fb1ceee8df624ee3fe96ad974a25b29d1b` built and launched Firefox, then REDed because the injected browser-evaluation string referenced the Node-local `anonymousRequest`; it is undefined in Firefox. Identical latent bugs existed for post-auth invalid and denied-list requests, and those requests hardcoded response status 200. A tested base64/UTF-8 request-expression boundary now carries exact requests into Firefox and returns actual status/body. Seventh log/report: `/tmp/gap01-wrapper-seventh-20260724-192732.{log,report}`; evidence root: `/var/folders/cl/hn3xfghd7gg2m5fr8vb1mxz80000gn/T/gap01-evidence-mEdGPc`.

The eighth authorized wrapper at unchanged aggregate `90c6b7d877a95405ceec84ee5e38593e1c9cc3cafc183e6f808262ec4cdb5211` reached authenticated metadata and REDed because `PrivateInventory` remained present. Runtime AdminMeta intentionally includes query-enabled lists even when operation access and navigation deny them. The fixture now uses `graphql.omit.query` while retaining create under access denial; inaccessible synthetic fields are hidden from create/item/list UI. Eighth log/report: `/tmp/gap01-wrapper-eighth-20260724-193749.{log,report}`; evidence root: `/var/folders/cl/hn3xfghd7gg2m5fr8vb1mxz80000gn/T/gap01-evidence-bKzjpk`.

The ninth authorized wrapper at unchanged aggregate `71cb60fc1ddd6e9369bfbe5c49fc647fe38ce22977598904491d6ad60f8ab521` reached real create transport and correctly observed plain default-controller data, but REDed because inherited custom-Project rewrites expected a `controller:` prefix. Those two unconditional request/persistence rewrites were neutralized only in the disposable GAP-01 harness. Ninth log/report: `/tmp/gap01-wrapper-ninth-20260724-194726.{log,report}`; evidence root: `/var/folders/cl/hn3xfghd7gg2m5fr8vb1mxz80000gn/T/gap01-evidence-RIjFf2`.

The tenth authorized wrapper at unchanged aggregate `b73eee3ef052348347bb232c61cedb273f9f594e10eef9d155110066bbcc1d58` then exposed a **real product compatibility defect**. `Memo` uses Keystone-standard `ui.labelField: 'subject'` (and the other shape uses `ui.labelField: 'headline'`), but `normaliseList()` in `src/features/cms/config.ts` resolved only top-level `listConfig.labelField` before falling back to `label`/`name`/`title`/`id`. AdminMeta therefore reported `id`, and the generic create workflow could not derive a string label (`undefined !== 'string'`). Changing the fixture to top-level `labelField` would evade consumer parity and is rejected. Tenth log/report: `/tmp/gap01-wrapper-tenth-20260724-195410.{log,report}`; evidence root: `/var/folders/cl/hn3xfghd7gg2m5fr8vb1mxz80000gn/T/gap01-evidence-1UARQB`. Aggregate, `a61a761…`, process/profile/cache/temp cleanup remained exact.

### GAP-01 product and typing repair review

**Status:** **BOUNDED RUNTIME EVIDENCE VERIFIED; FORMAL CHECKPOINT PUBLICATION AND DISSERTATION RECONCILIATION PENDING.** This is not GAP closure and does not accept the unavailable user-specific reproduction by implication.

1. The four-file product repair aggregate independently recomputes to `fe6c2572950ce76d558fc2aa5997598f63c4465e6f7d888719dc232045e51da1`. `normaliseList()` now preserves legacy top-level `labelField` precedence, then accepts a valid Keystone-standard `ui.labelField`, then falls back through `label`/`name`/`title`/`id`. The type surface models `ui.labelField`; no fixture downgrade to the legacy property was made.
2. Focused config and AdminMeta validators independently pass. They cover top-level precedence, valid `ui.labelField`, invalid/missing configured fields, conventional fallback, `id`, and emitted AdminMeta for the arbitrary `subject`/`headline` shapes. Targeted ESLint and Prettier pass, and the product owner completed exactly one production build at the unchanged aggregate.
3. Two colocated `.d.mts` files now accurately resolve the GAP-01 `.mjs` imports. The focused test narrows caught `unknown` with `instanceof Gap01CapturedChildError` and rethrows unexpected errors; it does not cast or suppress `.result`. Runtime validation is retained by typing `Gap01ExpectedGraphqlEvidence.operation` as `unknown`. Oversight independently reran global TypeScript, Prettier, and all 28 focused GAP-01 tests; all passed.
4. The runtime eight-file GAP-01 boundary remains byte-identical at lexical bytes-only aggregate `ee2f93e02389f01769273aef2aa76296a18851c91a936ded06e53d3f0f04cf1d`. The current nine-file set is `b14f165ac8edca140beaa11379433ebcc869164de586976eeb371237c850bea9`; the former `b73eee3e…1d58` is superseded only because the authorized typed-catch edit changed the test member. The expanded eleven-file boundary, including declarations, is `67cde5df31d2db955247db1845800c204c347a755b83ad747d25944842f767e4`.
5. Accepted checkpoint-017 content remains `a61a761864c32bf5c2ace68c901bc74f656024a07950167f55737f875a712d33`. The stale non-formal `gap01-capture-test-uHaWMm` directory was removed; named historical `gap01-evidence-*` RED roots remain preserved; oversight found no matching process or new focused-test temp residue.
6. The accepted invocation log `/tmp/gap01-wrapper-authorized-20260724-202328.log` and report `/tmp/gap01-wrapper-authorized-20260724-202328.report` record exit 0 and the exact expected aggregates before and after. Both clean passes completed both shapes at one unchanged copied-source hash `68a2f8bdd26df91651798de54ce2135b0fe10524305cf478fc9c7bc3aec6c00b`. Each of the four shape executions reported 544 BiDi events, zero expected navigation aborts, and zero unexpected request/response/console errors.
7. The executable boundary uses actual Firefox dashboard initialization/sign-in/sign-out, AdminMeta discovery, rendered generic create routes, reload persistence, exact GraphQL operation/request/data binding, actual HTTP status/body classification, returned-ID/route-ID equality, invalid-input validation, direct denied-create access evidence, and anonymous AdminMeta denial. The creatable sets were exactly `Inventory`/`Memo` and `Article`/`QueueItem`; standard `ui.labelField` values `subject` and `headline` were exercised rather than replaced by the legacy property.
8. The wrapper verified source/build freshness, checkpoint-017 binding, copied-input stability, and exact source-cache fingerprints for `node_modules/.nitro`, `.cache/jiti`, `.vite`, `.vite-temp`, and `.tanstack`. Success removed disposable shape/evidence/profile roots. Oversight's post-run check found no matching app/browser/GAP process or new `gap01-arbitrary-*`, `gap01-capture-test-*`, or `tks-arbitrary-browser-*` directory; current product/runtime/current-nine/expanded-eleven/a61 hashes remain exact. Named historical RED evidence remains preserved.
9. **Protocol deviation, recorded rather than hidden:** two actual gate invocations occurred after authorization. The earlier `/tmp/gap01-wrapper-eleventh-20260724152037.log` is also a full green two-pass/two-shape gate; its outer `.report` says RED only because its custom observer mistakenly populated `runtime8` with unrelated GAP-10 files. Before that queued command was visible, oversight separately instructed the designated owner to execute the direct authorized command, producing the accepted later run. This violated the exact-one-invocation instruction. It did not involve a gate failure, source edit, concurrent build, stale-output retry, or rerun-to-green: both gate logs are green at the same source/product/current-nine/expanded-eleven/a61 boundaries. The extra run is therefore an operational exception, not evidence of product or harness false pass. Both log/report pairs are preserved and must be disclosed in any checkpoint.

The bounded arbitrary-shape runtime evidence is accepted for formal checkpoint publication. GAP-01 remains **IN REVIEW**, not closed, pending dissertation reconciliation. The unavailable user-specific failure remains explicitly **not reproduced**, and memory IDs remain synthetic with accepted checkpoint-017 Prisma/CUID evidence cited only as an external combined boundary.

## Review 031 — REVIEW CHECKPOINT READY 028 (bounded GAP-01 arbitrary create/auth)

**Status:** **VERIFIED for the declared two-shape fresh-memory browser boundary; GAP-01 remains IN REVIEW.** The exact product, runtime-eight, current-nine, expanded-eleven, and accepted checkpoint-017 aggregates independently recompute. The checkpoint accurately discloses the duplicate-run protocol exception and does not claim user-specific reproduction, realistic memory IDs, broad-schema coverage, external-database execution, release readiness, or GAP closure.

### VERIFIED

1. The product repair is real rather than fixture accommodation: top-level `labelField` retains precedence, valid Keystone-standard `ui.labelField` is normalized next, and conventional/id fallback remains. The two arbitrary shapes exercise `subject` and `headline`; focused config/AdminMeta validators, lint, format, one product build, global TypeScript, and 28 focused harness tests passed at the published hashes.
2. The accepted later evidence pair has exit 0 and exact before/after aggregates. Its built-in matrix executed two clean-build passes for `Staff(loginName, passphrase, displayName)` with `Inventory`/`Memo` and `Operator(handle, pin, fullName)` with `Article`/`QueueItem`. All four executions used copied-source hash `68a2f8bdd26df91651798de54ce2135b0fe10524305cf478fc9c7bc3aec6c00b`, emitted 544 events, zero expected navigation aborts, and zero unexpected request/response/console errors.
3. Frozen executable assertions cover pre-init access, public auth shape, post-signout behavior, anonymous AdminMeta denial, protected-field exclusion, exact permitted creatable metadata, denied-list omission plus direct access-denied create, invalid-value GraphQL validation, generic rendered create/reload, raw GraphQL persistence, actual HTTP status/body, exact operation and submitted variables, returned ID, and returned-ID/route-ID equality. GraphQL sudo CRUD is not substituted for dashboard CRUD.
4. Source/build freshness, copied input, accepted `a61a761…` binding, and exact source-cache fingerprints are checked before/after. Success removed its disposable evidence/fixture/profile roots. Independent post-run inspection found no matching process or new GAP/browser temp directory, and all published aggregates remained exact; historical RED evidence remains preserved.
5. The checkpoint's duplicate-run disclosure is accurate. `/tmp/gap01-wrapper-eleventh-20260724152037.log` is a full green gate, while its custom outer report is RED because the observer used unrelated GAP-10 files for `runtime8`. The later accepted pair is independently green at the exact correct boundaries. Two executions violated the exact-one instruction, but there was no behavior RED, source change, concurrent build, stale-output retry, or repair between them. This operational exception is recorded and is not a false-pass rerun.

### BOUNDARIES

1. The matrix is fresh-memory and intentionally reports synthetic IDs. Realistic CUID/Prisma evidence is only the separately accepted checkpoint-017 boundary; this checkpoint does not produce disposable-Prisma arbitrary-shape evidence.
2. The unavailable user-specific environment remains `not-reproduced`. No concrete fixture/configuration, failing command and commit, database/runtime, versions, and matching trace were supplied.
3. Two materially different shapes substantially improve model/auth generality but do not prove every Keystone field/controller/schema combination. Full GAP-05/GAP-08 document/relationship matrices and production policy/provider boundaries remain separate.
4. No `READINESS.md` edit or dissertation row closure follows automatically.

### Reviewer evidence

```text
/tmp/gap01-wrapper-authorized-20260724-202328.{log,report}
/tmp/gap01-wrapper-eleventh-20260724152037.{log,report}
npx tsc --noEmit
npx vitest run tests/gap01-arbitrary-shapes.test.ts --testTimeout=20000
# targeted product validators/lint/format, aggregate recomputation, and post-run process/temp/cache inspection
```

No additional browser or build invocation was performed during formal review.

## GAP-08 pre-checkpoint static contract review

**Status:** **STATIC CONTRACT VERIFIED at `92ef18e3560df9cb1b8db46c4839ff878e08314fdc761533ecb279a730486b50`; heavy execution remains blocked.** Source-only implementation of a new GAP-08 wrapper is authorized for later lifecycle review.

The initial `544e1d23…` candidate was rejected for contradictory required-disconnect/delete deltas, missing reciprocal-required bypass coverage, absent exact `@@map` binding, and relation-name/physical-join conflation. The first revision `41ba4421…` was rejected because it collapsed create/update requiredness and proposed direct PostgreSQL writes rather than CMS mutations as concurrency actors. Both RED histories remain recorded in the plan.

The accepted six-file contract derives six endpoints/three reciprocal pairs and 76 scenarios (35 expected rejections) from normalized AdminMeta and generated Prisma schema. It covers both sides of one-to-one, one-to-many/many-to-one, and many-to-many relationships; mapped models/FKs; non-ID unique selectors; physical Prisma implicit-join catalog expectations; exact success/rejection row/edge deltas; local and reciprocal update-required disconnect/delete invariants; partial-work rollback; and explicit bounded exclusions. Its concurrency contract requires two CMS GraphQL/adapter mutations, an after-write/precommit hook hold, an independent PostgreSQL `pg_blocking_pids` lock oracle, explicit release, deterministic winner/loser classification, and no direct-SQL or sleep oracle.

Oversight independently passed the focused 8-test suite, metadata validator (6 endpoints, 76 scenarios, 35 rejections), global TypeScript, and exact aggregate recomputation. No build, CMS generation/push, PostgreSQL database/container, app server, or Firefox execution is accepted or authorized yet. The required-relation delete oracle is explicitly a bounded replacement-fixture invariant, not a blanket statement of official Keystone behavior.

## READINESS reconciliation

No `READINESS.md` edit has been proposed or accepted. Checkpoint 015 provides accepted sibling-lifecycle evidence, and checkpoint 017 now provides accepted frozen responsive and correlated GAP-04 executable evidence at hashes including `vite.config.ts`; GAP-02/03/04 remain **IN REVIEW** pending row-by-row dissertation reconciliation rather than closing by implication. Checkpoint 016 is superseded. Checkpoint 025 now supplies accepted bounded two-profile Openfront auth/dashboard/domain/rollback/cleanup evidence at aggregate `8d9d386f…a3df`; real source access policies, production build/data/provider/in-place cutover remain open, so GAP-13 remains **IN PROGRESS**. Checkpoint 018's auth hash is superseded; checkpoint 020 provides accepted bounded replacement auth evidence at `a2161cdf…`, while GAP-09 remains **IN REVIEW** pending dissertation reconciliation. Checkpoint 019 is superseded; checkpoint 026 supplies accepted session-aware metadata/access, bounded streaming/response, route, mutation, and redacted-audit evidence, while human confirmation UX, durable audit/data, and full protocol negotiation remain open. GAP-12 remains **IN REVIEW**. Checkpoint 028 supplies accepted two-shape fresh-memory arbitrary auth/create evidence plus the external accepted checkpoint-017 Prisma/CUID binding; the user-specific environment remains not reproduced and no arbitrary-shape disposable-Prisma claim is made, so GAP-01 remains **IN REVIEW** pending dissertation reconciliation. Checkpoint 022 supplies accepted bounded schema-workflow evidence while GAP-14 remains **IN REVIEW** pending dissertation reconciliation. Checkpoint 023 supplies accepted bounded custom-view/field-zoo evidence while GAP-06/GAP-07 remain **IN REVIEW**. Checkpoint 024 supplies accepted advanced-document and one-shape atomic nested-write evidence, but the remaining GAP-05/GAP-08 dissertation matrices stay open. Openfront's bounded replacement, secured MCP subset, and local provider continuity subset are accepted; real provider and production-cutover boundaries remain open. No release-matrix row is greened by implication.

## Review 032 — REVIEW CHECKPOINT READY 030 (replacement production baseline)

**Status:** **CHANGES REQUIRED.** This review applies only to replacement aggregate `aff4ebfc1f94635670776211a32320998a3b784cf4f740fd58d54e42bdd750c2`; superseded `d737…` is not adjudicated. The exact aggregate, focused checks, built-server baseline, and seeded Firefox behavior reproduce, but observability, secret handling, production CSP compatibility, and gate-boundedness blockers prevent acceptance. GAP-16 remains **IN PROGRESS** and `READINESS.md` remains unchanged.

### BLOCKING

1. **The static-noise repair creates a production observability blind spot and does not retain all dynamic/API logs as claimed.**
   - `shouldLogRequest()` classifies solely from pathname (`src/server/request-observability.ts:44-55`), and the response hook applies that decision before considering status (`src/server/nitro-plugin.ts:44`). Every matching static 404/500 is therefore silent, not merely successful asset noise.
   - An exact built-server probe requested `/assets/missing-oversight.js`, received HTTP 404, and found no completion record. Direct helper probes also returned `false` for `/api/report.js` and the dynamic item-shaped `/dashboard/files/item.png` while retaining `/api/graphql`.
   - The triggering browser failure was a successful asset path containing the word `error`; `scripts/validate-dashboard-browser.mjs:1942` scans the unparsed combined app log with `/(?:error|exception|unhandled)/i`. Silencing product telemetry to satisfy that raw substring assertion is a false-pass repair. The browser gate should parse structured request records/statuses, or static suppression must be status-aware and retain failed assets plus actual dynamic/API routes.

2. **Caller-controlled request IDs can carry secrets directly into response headers and structured logs.**
   - `resolveRequestId()` accepts any 1–64 character value in `[A-Za-z0-9._:-]`, and the plugin both reflects and logs it (`src/server/request-observability.ts:3-7`, `src/server/nitro-plugin.ts:21,42,48`). That alphabet includes common tokens and credential-shaped values.
   - Against the exact `aff4…` output, `X-Request-ID: synthetic-secret-token-ABC123` was preserved in the response and appeared verbatim in `[cms][request]`. Thus the claims that request records never contain header/credential values are not true for this special header.
   - Use an internally generated correlation ID, or only trust/hash an upstream ID behind an explicit trusted-proxy boundary. Align the separate error-log request-ID policy as well; `src/server/error-handler.ts` currently accepts a different 128-character range.

3. **The production CSP blocks the repository's configured S3 image path.**
   - Production emits `img-src 'self' data: blob:` (`src/server/request-observability.ts:33`). The checked configuration defaults `my_images` to the external `https://sfo3.digitaloceanspaces.com` endpoint, storage produces an external object URL, and `src/components/dashboard/file-field-editor.tsx:200-205` renders that URL directly in `<img src>`.
   - A focused configuration probe produced `https://sfo3.digitaloceanspaces.com/keystone-test/oversight.png` and confirmed its origin is absent from the image directive. The seeded browser run does not load an external stored image, so its clean console does not cover this production breakage.
   - The policy must safely admit configured image origins or route images through an allowed same-origin boundary, with a production browser assertion.

4. **The named “bounded” production gate has unbounded request and termination paths and does not prove process-group absence.**
   - `waitFor()` calls `fetch(url)` without an abort deadline, so one accepted connection that never responds bypasses its 30-second loop deadline (`scripts/validate-production-baseline.mjs:29-42`). The later readiness/root/GraphQL fetches are also unbounded.
   - After SIGKILL, `stop()` awaits the leader's `exit` without a timeout and returns when the leader exits without checking for surviving process-group descendants (`scripts/validate-production-baseline.mjs:45-64`). A TERM-resistant descendant can therefore outlive a normal leader exit.
   - Normal-path cleanup was empty in this review, but it does not establish the claimed bounded failure cleanup. Add per-request deadlines, bounded TERM→KILL handling, full group-absence verification, and forced hanging-response/stubborn-descendant probes.

### IMPORTANT BOUNDARIES

1. The readiness response deadline works, but it does not cancel losing persistence work. With a 100 ms deadline, three concurrent probes all returned fixed 503 responses while all three adapter counts were still running and completed later. This matches the checkpoint's disclosure, but repeated probes can accumulate work during a driver stall; add cancellation where supported and/or concurrency/pool protection before production-readiness acceptance.
2. The GraphQL limit is exactly a declared-`Content-Length` guard, not a transport body bound. A 2,077-byte chunked GraphQL request passed a configured 1,024-byte limit and returned HTTP 200. This is not a new blocker because checkpoint 030 explicitly excludes chunked enforcement, but the boundary must remain prominent and the gate must not be described as a general request-size limit.
3. The HSTS probe proves that the application trusts `X-Forwarded-Proto`; it does not prove a trusted proxy strips attacker-supplied forwarding headers. Deployment acceptance still requires that external boundary.

### VERIFIED

1. The 15 paths recomputed exactly to `aff4ebfc1f94635670776211a32320998a3b784cf4f740fd58d54e42bdd750c2` using lexically sorted `filename + NUL + bytes + NUL` immediately before and after the build/browser/baseline executions used for this review. Concurrent edits moved aggregate members after the verdict was appended; that later moving source is not reviewed or accepted here.
2. `npx vitest run tests/cms-production-baseline.test.ts` passed 6/6. `npx tsc --noEmit`, `npm run lint`, `npm run check`, and `npm run cms:check` passed.
3. `npm run test:dashboard:browser` rebuilt exact `aff4…` source and passed the seeded Firefox flow with 1,376 events, zero navigation aborts, and zero unexpected browser request/response/console errors.
4. `npm run test:production:baseline` passed against that exact built output. Declared oversize 413 behavior, liveness/readiness success, metadata, basic headers, and query-string omission work within the covered path.
5. Post-run inspection found no matching app, baseline/browser harness, Firefox process/profile, or temporary baseline directory. This verifies normal cleanup only, not the forced-failure paths above.

### Reviewer commands

```text
# exact 15-file filename+NUL+bytes+NUL aggregate recomputation
npx vitest run tests/cms-production-baseline.test.ts
npm run test:dashboard:browser
npm run test:production:baseline
npx tsc --noEmit
npm run lint
npm run check
npm run cms:check
# bounded exact-output probes: request-ID reflection/logging, missing-asset 404 logging,
# chunked >limit GraphQL, delayed readiness counts, configured S3 URL versus CSP
# post-run process/profile/temp inspection and final aggregate recomputation
```

## Review 033 — REVIEW CHECKPOINT READY 031 (classified hard-code inventory)

**Status:** **CHANGES REQUIRED.** The exact three-file policy aggregate recomputes, and the zero-browser/zero-database boundary is honestly stated. The current repository audit is nevertheless RED, and independent adversarial probes demonstrate multiple fail-open routes through the AST vocabulary, path-role policy, allowlist schema, and evidence-marker checks. GAP-15 remains **IN REVIEW**; `READINESS.md` remains unchanged.

### BLOCKING

1. **The submitted scanner does not pass against current source.**
   - Lexically sorted `filename + NUL + bytes + NUL` recomputes exactly to `0f7efce157f9c94aadb6204db0dd4bf525fca8fc84e5e2d7a3959513444907b9`; member hashes are `5112594a…`, `432591eb…`, and `4071d81f…` as published.
   - Direct `npx tsx scripts/validate-gap15-hardcodes.ts` exits 1. `scripts/validate-dashboard-completion.ts` now has 3 recognized matches versus the allowlisted 2/fingerprint, and `tests/cms-production-baseline.test.ts` has a new unclassified `/dashboard/users` route literal. The current report is 302 matches in 48 matched files, not the claimed 300 in 47.
   - The complete focused file consequently fails 1/6 at its checked-repository assertion; the five synthetic detection tests pass. Reconcile the settled current inventory at a replacement policy aggregate and rerun both commands. Updating counts alone is not sufficient without resolving the fail-open findings below.

2. **Real generic authentication hard-codes evade the static-literal matcher.**
   - `matchesForLiteral()` recognizes a generated name only when the complete literal satisfies anchored `graphQlName` (`scripts/validate-gap15-hardcodes.ts:135,198-219`). Generated operations/types embedded in a GraphQL document therefore disappear.
   - The checked-in generic routes `src/routes/dashboard/signup.tsx` and `src/routes/dashboard/reset.tsx` contain `createUser`, `authenticateUserWithPassword`, `UserAuthenticationWithPasswordSuccess/Failure`, `sendUserPasswordResetLink`, and `redeemUserPasswordResetToken` in static template literals, yet `scanGap15Source()` returns zero matches for both files. A synthetic forbidden-`src` GraphQL document containing the same names also audits `ok: true` with an empty allowlist.
   - Unquoted object keys/identifiers, JSX text, regular expressions, and composed values are likewise not inspected. A forbidden generic source containing `{ Todo: true }` and `'To' + 'do'` audits clean. A bounded semantic limit is acceptable, but a gate described as fail-closed for generic model/generated-operation assumptions must at least tokenize relevant names inside static documents and cover the direct AST forms used by this repository. Add red tests from the actual auth routes rather than only standalone one-token literals.

3. **Path naming, rather than infrastructure role, decides whether hard-codes can be rubber-stamped.**
   - `isForbiddenGenericPath()` protects most `src`, `scripts/lib`, filename-prefixed GAP-01/GAP-08 files, and a few exact scripts (`scripts/validate-gap15-hardcodes.ts:174-193`). Every test, most scripts, and every file under the broad `src/features/cms/models/` exemption can still be classified `expected-demo` regardless of whether it is a generic helper or primary acceptance infrastructure.
   - Exact probes all returned `ok: true` after self-derived `expected-demo` classifications for `scripts/generic-runtime.ts`, `tests/generic-runtime-helper.test.ts`, and `src/features/cms/models/runtime-helper.ts`, each containing `defaultList = 'Todo'`. This confirms that the allowlist can merely bless test/infrastructure hard-codes with a generic reason and matching count.
   - Source-oracle separation is also filename-enumerated. Misclassifying the known `scripts/validate-sibling-oracle.mjs` path correctly fails, but an equivalent renamed `scripts/new-sibling-source-oracle.mjs` is accepted as demo. Repository collection is incomplete as well: it traverses four roots and six selected root files (`scripts/validate-gap15-hardcodes.ts:526-568`) but omits maintained `vite.config.ts`; a disposable repository with its only `'Todo'` assumption there audited clean with zero scanned files.
   - Replace broad/name-based exemptions with explicit fixture ownership, forbid generic helpers and acceptance harnesses independent of renaming, make source-oracle designation fail-closed for new oracle files, and scan all maintained code/config entry points. Existing demo-primary browser checks may remain recorded debt, but their classification cannot establish parameterization.

4. **Malformed allowlist values and semantic evidence drift can pass.**
   - Runtime JSON is cast to `Gap15Allowlist`; allowed enum values are not fully validated. An unknown classification category on a non-oracle path and an unknown evidence kind with `browserScope: none` both produced issue-free reports. Straight `../` traversal does fail, but that does not make the schema fail-closed.
   - Evidence uses raw substring counts (`scripts/validate-gap15-hardcodes.ts:276-288,305-361`). Moving an exact fixture marker into a comment while removing executable fixture code still passes. The match fingerprint contains only sorted kind/value pairs, so replacing a real assertion with dead `if (false) void 'Todo'` code preserves the fingerprint and passes.
   - The external-browser binding contains source markers and narrative only; it does not bind the accepted checkpoint-028 aggregates or evidence artifacts. Current wording correctly calls it external and memory-only, but the scanner cannot detect stale or invented external evidence.
   - Validate the full JSON schema and enum domains, reject unknown fields/categories/kinds/scopes, use AST/context-aware evidence checks or immutable source/evidence hashes rather than comment-sensitive substrings, and bind any external evidence claim to the accepted immutable boundary. Add executable red cases for these counterexamples.

### VERIFIED / HONEST BOUNDARIES

1. New unclassified literals, removed/stale inventories, ordinary traversal paths, and misuse of a known source-oracle path do fail in the implemented cases. The current RED proves that recognized current-source drift is not silently accepted; it does not cure the bypasses above.
2. The five intended red-focused Vitest cases pass. `npx tsc --noEmit`, full `npm run lint`, and targeted Prettier checking of the three checkpoint files pass.
3. Browser/database scope is accurately bounded: the report hard-codes `browserRuns: 0` and `databaseRuns: 0`; four bindings say `browserScope: none`; the only browser-labelled binding says external, memory-only, two-shape, and synthetic-ID bounded. The CLI explicitly disclaims browser, server, database, breadth, and closure. No browser, server, database, Portless command, sibling edit, or Git command was used in this review.
4. UUID, autoincrement, mapped, and singleton bindings are only source/wiring markers here. They provide no browser/PostgreSQL evidence, exactly as checkpoint 031 discloses. GAP-15 cannot close on this static checkpoint.
5. `READINESS.md` remained byte-identical at SHA-256 `da348422754dbc315be5e488588394a85c8adc3a565e5e1b57a19833dc1853ff` during review.

### Reviewer commands

```text
# exact three-file filename+NUL+bytes+NUL aggregate and member hashes
npx tsx scripts/validate-gap15-hardcodes.ts                         # RED: 2 issues
npx vitest run tests/gap15-hardcode-audit.test.ts                  # RED: 1/6
npx vitest run tests/gap15-hardcode-audit.test.ts -t 'finds direct|rejects unclassified|never permits|keeps demo|fails stale evidence'  # 5/5
node --import tsx /tmp/gap15-oversight-probe.mts                   # bounded synthetic/temp-root counterexamples
npx tsc --noEmit
npm run lint
npx prettier --check scripts/gap15-hardcode-allowlist.json scripts/validate-gap15-hardcodes.ts tests/gap15-hardcode-audit.test.ts
```

## Review 034 — REVIEW CHECKPOINT READY 029 (human approval and field semantics)

**Status:** **VERIFIED for the bounded authenticated dashboard-assistant approval and field-control semantics boundary.** Final 21-file aggregate `b9bdffe9adf6e2dac48b17289e81dceb49a40907034e74203ee8e74cb708a607` recomputes exactly as lexically sorted `filename + NUL + bytes + NUL` before and after all review probes and gates. It supersedes every earlier checkpoint-029 aggregate. GAP-11 and GAP-12 remain **IN PROGRESS / IN REVIEW** beyond this boundary; `READINESS.md` is unchanged.

### VERIFIED

1. **Proposal and execution access remain fail-closed.** The completion route requires an authenticated dashboard item with UI access. Proposal issuance re-evaluates current-context list operation access for create/update/delete and also honors `hideCreate`. An independently authenticated restricted editor was denied Role create, update, and delete before any pending action, generated operation name, approval token, or MCP audit event existed. Valid confirmation still executes through the accepted generated-operation MCP path, which rechecks current request authentication plus GraphQL operation, field, filter, and item access.
2. **The reviewed payload is integrity-bound and single-use.** A process-local random HMAC key signs the complete tool/list/operation/arguments/summary payload together with a unique nonce and issue time. Independent probes proved that a JSON-round-tripped valid action succeeds, modifying either arguments or summary fails before MCP, an 11-minute-old action fails before MCP, and replaying the exact successful action produces no second mutation or audit event. Used approvals are retained until expiry in an expiry-pruned map; at 10,000 live entries confirmation fails closed instead of evicting a replay guard. The one created memory row was deleted by a separately approved action.
3. **Sensitive summaries are recursively redacted.** Direct password values and a nested relationship-create password marker were replaced by `[redacted]`; neither marker appeared in the review summary. The signed raw arguments remain client-carried for execution, while MCP audit entries remain metadata-only under checkpoint 026's accepted boundary.
4. **The human review UI is explicit.** The sidebar keeps proposal and confirmation separate, presents an alert-dialog-labelled review card with summary plus distinct Confirm/Cancel controls, records cancellation without mutation, submits the signed action only on confirmation, and invalidates dashboard query families after successful CRUD.
5. **Accessible control naming now survives rendered semantics.** Independent `dom-accessibility-api` checks over rendered enhanced fields produced checkbox root `Published`, number input `Estimate`, native radio group `Priority` with options `Low`/`High`, segmented group `Status` with options `Todo`/`Done`, nullable checkbox `Set Assignee as null`, and password status `Secret Note value status`. Composite groups own deterministic `field-<path>` IDs and names; the outer field label no longer overwrites the first option. Source inspection also confirms explicit names on list selection controls, timestamp subcontrols, password confirmation, AI controls, and the Slate editor.
6. `npm run test:dashboard:ai` passed, including no-execution proposal, tamper, replay, access-denial, redaction, valid create, and cleanup assertions. Focused Vitest passed 2 files/14 tests (`dashboard-field-state-contracts` plus secured MCP). `npx tsc --noEmit`, `npm run lint`, `npm run check`, and `npm run cms:check` passed.
7. One normal `npm run build` passed at the exact aggregate through client, SSR, and Nitro output; only the already-known non-fatal unresolved `node-libcurl` traceInclude warning appeared. The separately accepted checkpoint-017 concatenated-content aggregate remained exactly `a61a761864c32bf5c2ace68c901bc74f656024a07950167f55737f875a712d33`.
8. Post-run inspection found no matching completion/MCP/Vitest/app/Firefox process or `tks-firefox-*` profile. Oversight used only the memory adapter and created no database or persistent server. `READINESS.md` remained byte-identical at SHA-256 `da348422754dbc315be5e488588394a85c8adc3a565e5e1b57a19833dc1853ff`.

### BOUNDARIES

1. The parser intentionally supports explicit create/update/delete JSON syntax, not arbitrary natural language or an external model provider. Item/filter/field denials may still occur at confirmed MCP execution after a list-level proposal is permitted.
2. Approval keys, replay state, MCP audit, and memory data are process-local. Tokens are not durable or shared across instances, do not survive restart, and are not a production workflow/audit store. A token is not identity-bound, although confirmation always re-authenticates and re-authorizes the current request.
3. This review used executable server/memory probes and rendered accessibility-name computation, not an independent screen-reader, complete keyboard traversal, zoom, high-contrast, reduced-motion, or external deployment session. The author-reported seeded Firefox assistant card/cancellation probe remains bounded evidence; checkpoint 017 supplies the separately accepted broader responsive/Prisma browser boundary and was not modified.
4. No GAP, release row, production provider, multi-instance transport, or `READINESS.md` status changes by implication.

### Reviewer commands

```text
# exact 21-file filename+NUL+bytes+NUL aggregate and checkpoint-017 recomputation
node --import tsx --input-type=module  # bounded tamper/redaction/replay/expiry/access probes
node --import tsx --input-type=module  # rendered dom-accessibility-api control-name probe
npm run test:dashboard:ai
npx vitest run tests/dashboard-field-state-contracts.test.ts tests/mcp-mutations.test.ts
npx tsc --noEmit
npm run lint
npm run check
npm run cms:check
npm run build
# post-run aggregate, READINESS, process, and temporary-profile inspection
```

## Review 035 — REVIEW CHECKPOINT READY 030 (`d760…` replacement)

**Status:** **CHANGES REQUIRED.** This review applies only to the frozen 16-file aggregate `d760d3e08b20cd5acd07362cfd5c5b61ecb16b13916bfe729437b52dab09c491`. The request-ID, GraphQL-body, readiness-concurrency, CSP-origin, and dynamic-extension repairs are substantive, but the named production gate is still not bounded as claimed. GAP-16 remains **IN PROGRESS** and `READINESS.md` remains unchanged.

### BLOCKING

1. **`npm run test:production:baseline` still has unbounded request and cleanup paths.**
   - In the exact `d760…` member, `waitFor()` calls `fetch(url)` without an abort signal. A connection that accepts but never returns headers can therefore remain inside one fetch forever and bypass the surrounding 30-second loop deadline (`scripts/validate-production-baseline.mjs:29-42`). The later readiness, root, and GraphQL fetches are likewise unbounded.
   - `stop()` waits without a deadline after SIGKILL and checks only the leader's exit, not complete process-group absence (`scripts/validate-production-baseline.mjs:45-64`). A TERM-resistant descendant can survive when the leader exits after group SIGTERM.
   - This is unchanged from Review 032 and directly contradicts the documented “bounded verification” and claimed owned-process-group cleanup. Add per-request deadlines, bounded TERM→KILL escalation, group-absence verification, and forced hanging-response plus stubborn-descendant regressions.

### IMPORTANT

1. **Static asset failures remain intentionally unobservable in completion logs.** `shouldLogRequest()` still excludes every `/assets/` path and exact root asset independent of response status. The adversarial built-server probe returned HTTP 404 for `/assets/missing-oversight.js` with no completion record. The generic dynamic-extension repair is valid—`/api/report.js` and `/dashboard/example.js` are logged—but a missing production chunk can still break the dashboard without a completion event. Keep this explicit, or preferably suppress only successful/304 static noise while retaining static 4xx/5xx.
2. Readiness now coalesces concurrent work, but one permanently hung adapter promise permanently occupies the shared slot until process restart. This is consistent with the checkpoint's uncancellable-driver disclosure; it is not accepted as pool-exhaustion or recovery evidence.

### VERIFIED

1. The declared 16 members, now including `src/server/error-handler.ts`, recomputed exactly to `d760d3e08b20cd5acd07362cfd5c5b61ecb16b13916bfe729437b52dab09c491` using sorted `filename + NUL + bytes + NUL` before focused review execution.
2. The exact adversarial request-ID probe passed: response and error contexts both contained the same `req_<32 hex>` derivation for `synthetic-secret-token-ABC123`, and neither contained the raw caller value. Focused Vitest passed 7/7 and `npx tsc --noEmit` passed at `d760…`.
3. The unchanged runtime members independently returned 413/`PAYLOAD_TOO_LARGE` for a 2,077-byte chunked request under a 1,024-byte limit; admitted the validated S3 and additional HTTPS image origins while rejecting `javascript:`; logged dynamic `.js` paths; and did not expose the raw caller request ID in normal completion output.
4. Three concurrent 100 ms readiness probes started only one delayed adapter count; all returned fixed 503 while that single operation continued and later completed.
5. A seeded Firefox command was started while the aggregate was `d760…` and behavior passed with 1,376 events and zero unexpected errors, but a concurrent edit moved an aggregate member before the post-run hash. That execution is not promoted to stable exact-aggregate acceptance. The later moving source is outside this review.

### Reviewer commands

```text
# exact 16-file filename+NUL+bytes+NUL aggregate recomputation
node --import tsx --input-type=module  # response/error request-ID correlation probe
npx vitest run tests/cms-production-baseline.test.ts  # 7/7
npx tsc --noEmit
node --import tsx --input-type=module  # three-probe readiness coalescing check
# bounded built-output probes retained for chunked 413, CSP origins,
# dynamic/static completion logging, and caller-ID non-disclosure
npm run test:dashboard:browser  # behavior green; post-run aggregate moved concurrently
```

## Review 036 — REVIEW CHECKPOINT READY 030 (`6f7e…` replacement)

**Status:** **CHANGES REQUIRED.** This review applies only to exact 16-file aggregate `6f7e75e074e97827eaad111eb051b1d6b2dbd2a08fb41935fccb21a5c6ed75a1`. The earlier request-ID, body-size, readiness-coalescing, CSP, static-failure logging, and process-group findings are substantively repaired. One remaining response-body deadline hole means the production command is still not fully bounded as documented.

### BLOCKING

1. **The fetch deadline ends when response headers arrive, leaving every subsequent body read unbounded.**
   - `boundedFetch()` clears its AbortController timer as soon as `fetch()` resolves (`scripts/validate-production-baseline.mjs:29-38`). Fetch resolves after headers; the gate then calls `health.json()`, `ready.json()`, `validRequestId.text()`, and `oversized.json()` outside that deadline (`scripts/validate-production-baseline.mjs:128-190`).
   - An exact-function adversarial server returned HTTP 200 headers and a partial JSON body without ending. `boundedFetch(..., 100)` returned the response, but `response.json()` was still pending after 350 ms because the timer had already been cleared. The gate can therefore hang forever despite its no-headers self-probe passing.
   - Keep the controller deadline alive through body consumption, or provide bounded helpers that fetch and consume/parse within one deadline. Add a forced partial-body stall probe in addition to the current no-headers hang probe.

### VERIFIED

1. The 16 members recomputed exactly to `6f7e75e074e97827eaad111eb051b1d6b2dbd2a08fb41935fccb21a5c6ed75a1` before the build and after all checkpoint probes.
2. `npx vitest run tests/cms-production-baseline.test.ts` passed 7/7. Targeted Prettier passed. `npm run build` completed at the exact aggregate, and `npm run test:production:baseline` passed against that output.
3. The gate's no-response fetch probe aborts, and its TERM-resistant parent/descendant probe completes TERM→KILL plus process-group absence through `scripts/lib/bounded-child.mjs`. That imported helper remains at the previously accepted hash `a1406154260e65edf6268b1203400b24342c075b755a7a980f27072b71726ee4`.
4. The exact error-context probe correlated the response and error log at the same deterministic `req_<32 hex>` value without the raw caller ID.
5. A built-server adversarial run proved: raw request ID absent; configured S3/additional HTTPS CSP origins present and `javascript:` absent; a missing `/assets/*.js` 404 logged; dynamic `.js` 404 logged; and a 2,077-byte chunked body rejected with 413/`PAYLOAD_TOO_LARGE` under a 1,024-byte cap.
6. Status-aware static filtering now suppresses successful known assets while retaining all 4xx/5xx static responses. Three concurrent readiness probes still coalesce onto one adapter operation.
7. Normal review cleanup found no matching app, production-gate, stubborn-probe, or Firefox process/profile.

### EXTERNAL CURRENT-SOURCE BLOCKER

Global `npx tsc --noEmit` remains red only in concurrently changing checkpoint-031 GAP-15 files outside this 16-file aggregate. The exact checkpoint build and focused tests pass, but global TypeScript must be rerun after that owner restores its intentional RED before any broader repository acceptance.

### Reviewer commands

```text
# exact 16-file filename+NUL+bytes+NUL aggregate recomputation
npx vitest run tests/cms-production-baseline.test.ts
npm run build
npm run test:production:baseline
node --import tsx --input-type=module  # response/error ID correlation
node --input-type=module              # partial-body deadline counterexample
node --input-type=module              # built-server ID/CSP/static/dynamic/chunked probe
npx prettier --check <checkpoint-maintained files>
npx tsc --noEmit                      # RED only in moving GAP-15 files
# post-run aggregate and process/profile inspection
```

## Review 037 — REVIEW CHECKPOINT READY 030 (`329b…` final replacement)

**Status:** **VERIFIED for the declared bounded Node/Nitro production-baseline boundary.** Exact 16-file aggregate `329b4740cc0fd48c9c935724f4223ed5c142da55764b9d884c262187ebcd34d8` recomputes before and after all independent commands. Review 036's response-body deadline blocker is resolved. This does not close GAP-16 or establish Linux/container, load, complete observability, external-provider, migration, or disaster-recovery readiness. `READINESS.md` remains unchanged.

### VERIFIED

1. **The deadline now covers headers and the complete response body.** `boundedFetch()` keeps one AbortController active through `response.arrayBuffer()`, then reconstructs the bounded response for later parsing. An independent header-plus-partial-never-ending-body server rejected with `AbortError` after 104 ms under a 100 ms deadline. The gate contains and passes the same adversarial partial-body probe, in addition to its no-headers hang probe.
2. **Process cleanup is bounded and executable.** Before starting the app, the gate launches a TERM-resistant parent and descendant, uses the accepted `terminateChildGroup()` boundary for bounded TERM→KILL escalation, and verifies process-group absence. The imported helper remains byte-identical at accepted SHA-256 `a1406154260e65edf6268b1203400b24342c075b755a7a980f27072b71726ee4`.
3. **Request correlation no longer discloses caller text.** The exact response/error-context probe produced the same deterministic `req_<32 hex>` ID for a syntactically safe caller value, and neither context nor built-server logs contained the raw value. Unsafe IDs produce generated UUIDs.
4. **GraphQL size enforcement covers declared and streamed bodies within scope.** A built-server request sent 2,077 bytes with chunked transfer under a 1,024-byte cap and received structured HTTP 413/`PAYLOAD_TOO_LARGE`. The focused suite also covers declared and chunked oversize. Accepted bodies are intentionally buffered up to the configured cap; provider limits remain separate.
5. **Security headers and logging retain application behavior.** The built server admitted validated S3 and additional HTTPS image origins, rejected a `javascript:` candidate, logged both a missing static-asset 404 and a dynamic `.js` 404, and suppressed successful known-asset noise. Query text, raw request ID, cookies, headers, and bodies were absent from completion records within the exercised paths.
6. **Readiness work is bounded against probe storms.** Three concurrent 100 ms probes returned fixed 503 responses while starting exactly one delayed persistence count; that one operation later completed. A permanently hung third-party driver can still occupy the shared slot until restart, matching the explicit checkpoint boundary rather than a recovery claim.
7. **All exact-source gates passed.** Focused production Vitest passed 7/7; the full suite passed 51 files/236 tests; `npx tsc --noEmit`, `npm run lint`, `npm run check`, and `npm run cms:check` passed. `npm run test:dashboard:browser` rebuilt exact source and passed Firefox with 1,376 events, zero navigation aborts, and zero unexpected request/response/console errors. `npm run test:production:baseline` then passed against that exact output.
8. Post-run recomputation remained `329b4740…34d8`. Inspection found no matching app, browser/baseline harness, partial/hanging server, stubborn process group, Firefox process/profile, or temporary baseline artifact. `READINESS.md` remained byte-identical at SHA-256 `da348422754dbc315be5e488588394a85c8adc3a565e5e1b57a19833dc1853ff`.

### BOUNDARIES

1. CSP still permits required inline scripts/styles and is not nonce-based. HSTS correctness still depends on a deployment-controlled trusted-proxy boundary.
2. Completion logs are process output, not metrics, traces, durable distributed telemetry, alerts, or a substitute for edge/CDN logs.
3. No target-Linux artifact/container, representative load or pool exhaustion, GraphQL depth/complexity budget, production-sized migration, external-provider staging, rollback, or disaster-recovery drill is accepted by this checkpoint.
4. GAP-16 remains **IN PROGRESS**. No release row or `READINESS.md` status changes by implication.

### Reviewer commands

```text
# exact 16-file filename+NUL+bytes+NUL aggregate and member hashes
node --input-type=module              # independent partial-body deadline probe
node --import tsx --input-type=module # response/error request-ID correlation
npx vitest run tests/cms-production-baseline.test.ts
npm test
npx tsc --noEmit
npm run lint
npm run check
npm run cms:check
npm run test:dashboard:browser
npm run test:production:baseline
node --input-type=module              # built-server ID/CSP/static/dynamic/chunked probe
node --import tsx --input-type=module # concurrent-readiness coalescing probe
# post-run aggregate, READINESS, process/profile/temp inspection
```

## Review 038 — REVIEW CHECKPOINT READY 031 (`1220…` replacement)

**Status:** **CHANGES REQUIRED.** Replacement aggregate `1220ee27b197211e95bd9f351a2cb3acfa481da4b468fc84647cbe30416101b7` is exact, the direct gate and focused/global checks are green, and most Review 033 counterexamples are substantively repaired. The scanner still omits current repository source files and plausible new top-level infrastructure, several direct static forms still evade generic-path enforcement, and evidence bindings remain semantically bypassable and externally unbound. GAP-15 remains **IN REVIEW**; this static checkpoint does not close it or change `READINESS.md`.

### BLOCKING

1. **Repository collection is still selective and currently omits a recognized starter assumption.**
   - `collectRepositoryFiles()` traverses only `prisma`, `scripts`, `src`, and `tests`, then selected root config names (`scripts/validate-gap15-hardcodes.ts:875-925`). It does not recursively inventory all maintained source paths or reject unexpected root source files.
   - Current root file `tmp-inspect-hydrated-document.ts:12` contains exact `user_admin`. Direct `scanGap15Source()` classifies it as `demo-seed-id:user_admin`, but `runGap15RepositoryAudit()` never collects the file and still reports green 620/48. The same omitted file contains `todo_launch` inside a GraphQL document at line 21. Another omitted current root script, `tmp-dashboard-cdp-inspect.mjs:24`, embeds `ada@example.com` in a static browser-evaluation string.
   - A disposable `tools/generic.ts` containing `defaultList = 'Todo'` also produced `ok: true`, zero scanned files, and zero issues. `package.json` is read for evidence markers but is not scanned because `.json` is outside `sourceExtensions`; a package script containing `Todo` likewise passed with zero scanned files.
   - A repository-wide/new-entry policy cannot silently exclude current or newly introduced source-bearing locations. Traverse maintained source from the repository root with explicit generated/dependency/artifact exclusions, or reject every unapproved source path. Explicitly decide whether root `tmp-*` files and package scripts are inventory, forbidden residue, or documented exclusions.

2. **Generic infrastructure can still evade the AST matcher through direct static forms called out in Review 033.**
   - Embedded GraphQL model/generated tokens, exact model identifiers, and simple unique-constant `+`/template composition are now detected. However generic `src` probes containing JSX text `<span>Todo</span>`, regex `/\/dashboard\/todos/`, a larger static string containing `ada@example.com`, or a larger static string containing `todo_launch` all returned zero matches and `ok: true`.
   - Constant collection is file-global by identifier name (`scripts/validate-gap15-hardcodes.ts:318-384`). Adding an unrelated second scoped `const suffix` makes the declaration map ambiguous and allows `'To' + suffix` to evade folding; the shadowed-composition probe also returned zero matches and no issue.
   - This need not become an unbounded semantic analyzer, but direct JSX text, regex literals, relevant tokens inside static text, and scope-correct constant references are ordinary AST forms. Add focused generic-path RED cases or narrow the policy claim explicitly; the current “fail-closed generic infrastructure” result is not true for them.

3. **Evidence-marker drift remains fail-open beyond comments, and external evidence is still not immutably bound.**
   - Comment stripping now rejects the Review 033 comment-only marker, and per-classification source fingerprints catch same-match semantic changes in the 48 classified files. Evidence targets themselves still use comment-stripped raw substring counts (`scripts/validate-gap15-hardcodes.ts:485-526,610-708`) without a target-source hash or AST role.
   - Moving the exact `const singletonConfig = config({` marker into a string constant, or retaining it only inside `if (false)`, produced issue-free evidence reports. Several current evidence target files are not among the source-fingerprinted classifications, so this is not universally caught elsewhere.
   - The `external-browser-evidence` binding still records narrative and mutable source markers only. It does not contain the accepted checkpoint-028 aggregate, evidence-artifact hash, or immutable log/report binding, so this scanner cannot distinguish current external evidence from a stale or invented claim.
   - Bind every evidence target to immutable source/evidence hashes and apply kind-specific executable/AST validation where semantics are claimed. External evidence metadata must identify the already accepted immutable boundary; keep browser/database execution outside this static gate as currently disclosed.

### VERIFIED REMEDIATION

1. The three members recompute exactly to the submitted hashes: allowlist `45a7f700…`, scanner `1249bfaa…`, test `06ec1f36…`; lexical `filename + NUL + bytes + NUL` aggregate is `1220ee27…01b7` before and after review.
2. Direct scanner passes twice with exactly 620 assumptions in 48 classified files: 42 demo and 6 source-oracle, plus 5 bounded evidence bindings and hard-coded zero browser/database runs.
3. The complete original Review 033 adversarial set was rerun. Embedded GraphQL, renamed generic script/test/model-helper, renamed oracle, known-oracle misclassification, traversal path, unknown category/evidence kind, comment-only marker, same-literal source drift, identifier/simple composition, and `vite.config.ts` now all fail. Exact path policy plus source fingerprints prevents the prior self-derived allowlist rubber stamp for arbitrary renamed files.
4. `src/routes/dashboard/signup.tsx` and `reset.tsx` now build create/auth/reset operations from public auth metadata and contain zero scanner matches. They are absent from demo policy. `tests/dashboard-generic-auth.test.ts` uses arbitrary `Account`/`handle`/`secret` metadata, has zero scanner matches, and requires no demo classification.
5. `npx vitest run tests/gap15-hardcode-audit.test.ts` passes 12/12; the combined GAP-15/generic-auth run passes 2 files/20 tests. Global `npx tsc --noEmit`, full `npm run lint`, and full `npm run check` pass.
6. Browser/database boundaries remain honest: four bindings say `browserScope: none`; the one external browser binding remains memory-only/two-shape/synthetic-ID bounded; CLI and summary claim no local browser, server, or database execution and no closure. No browser, server, database, Portless, sibling-edit, or Git command was used in this review.
7. `READINESS.md` remained byte-identical at SHA-256 `da348422754dbc315be5e488588394a85c8adc3a565e5e1b57a19833dc1853ff`.

### Reviewer commands

```text
# exact three-file filename+NUL+bytes+NUL aggregate and member hashes
npx tsx scripts/validate-gap15-hardcodes.ts
npx vitest run tests/gap15-hardcode-audit.test.ts
npx vitest run tests/gap15-hardcode-audit.test.ts tests/dashboard-generic-auth.test.ts
node --import tsx /tmp/gap15-review033-replacement-probe.mts
node --import tsx --input-type=module # JSX/regex/embedded persona+seed probes
node --import tsx --input-type=module # direct scan of omitted current root scripts
npx tsc --noEmit
npm run lint
npm run check
# final aggregate, READINESS, process, and temporary-root inspection
```
