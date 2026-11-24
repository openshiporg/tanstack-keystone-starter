# Exhaustive parity gap dissertation: TanStack Keystone Starter versus Next Keystone Starter

**Audit date:** 2026-07-20  
**Audited repository:** `/Users/junaid/Code/tanstack-keystone-starter`  
**Read-only comparison target:** `/Users/junaid/Code/next-keystone-starter`  
**Readiness authority:** `READINESS.md` remains the repository's only readiness verdict. This dissertation does not overwrite or supersede it.  
**Disposition:** **NO-GO for a parity/cutover claim; implementation-grade remediation handoff is ready.**

## 1. Executive verdict

The replacement is much more substantial than a shell. Its generated Prisma and GraphQL schemas are source-compatible with the four lists in the sibling; current-source builds succeed; direct GraphQL CRUD works; all four current lists can be created through the replacement dashboard; fresh initialization can create an administrator and then a Todo; and the same all-list dashboard creates work against a freshly migrated, seeded, disposable PostgreSQL database. The audit therefore did **not** reproduce a current replacement create mutation failure under the bounded seeded-memory, fresh-memory, or Prisma conditions tested.

That finding must not be misreported as “create is fine.” The user's observed failure can still be state- or environment-specific: an old generated artifact, a stale Vite/Nitro bundle, a schema/client/migration mismatch, different model definitions, an access/session state, production storage configuration, or a viewport/form state can select a path not represented by the successful fixtures. More importantly, the repository's named browser gate is not reliable enough to close the report. After rebuilding current source, the checked-in browser script failed before submission because it tried to move the pointer to `(970, 2019)` in a `1440 × 2000` viewport. A temporary audit-only 4000/5000-pixel viewport allowed the same create to proceed. Thus the current gate can fail for harness geometry rather than application behavior, while a stale pre-existing `.output` can pass without proving current source.

The most consequential runtime surprise is in the authoritative sibling itself. A clean temporary copy, current sibling dependencies, a disposable PostgreSQL database, all seven sibling migrations, and bounded Next development runtime showed that direct sibling GraphQL initialization, authentication, and `createTodo` succeed. The sibling dashboard, however, cannot load its create form. `features/dashboard/actions/getAdminMetaAction.ts:15-83` asks the sibling GraphQL schema for `initialFilter`, `hideNavigation`, create-view `fieldPosition`, and create/item `isRequired`; the generated sibling `schema.graphql` does not expose those fields. The browser renders “Something went wrong,” and `/dashboard/todos/create` returns the dashboard error state. The replacement's locally extended AdminMeta exposes those fields and therefore avoids this exact sibling defect. This means “the sibling” is an authoritative source comparison, but not a currently executable golden UI oracle. Parity work must preserve intended sibling behavior without reproducing this broken contract.

The replacement remains materially short of exhaustive parity in advanced document editing, custom `ui.views` loading, comprehensive field/browser coverage, external provider continuity, production-sized migration evidence, consumer runtime cutovers, accessibility, mobile layout, AI/MCP behavior, observability, and development-loop safety. The Prisma browser flow also found a real mobile regression: at a 390-pixel viewport the item page's document width was 487 pixels. The main `aside`, ID card, and grouped sections inherited a 471-pixel min-content width. The same run emitted an unhandled Nitro/H3 `AbortError` with status 500 after a client-aborted response. Both contradict a blanket “clean responsive browser” interpretation.

### Highest-severity findings

1. **P0, unproved/environment-specific:** the user's current create failure was not reproduced, but the checked-in browser gate cannot reliably arbitrate it. Current-source create needs an environment matrix and request-level evidence, not a single seeded-memory script.
2. **P0, broken comparison oracle:** the actual sibling dashboard cannot reach create because its AdminMeta query and generated Keystone schema disagree. Direct sibling GraphQL create still works, localizing the sibling failure to dashboard metadata loading.
3. **P1, broken responsive behavior:** real Prisma/CUID data expands the replacement Todo item page to 487 pixels on a 390-pixel viewport. Seeded short IDs conceal this.
4. **P1, broken/unproved runtime cleanliness:** a production-shaped Prisma browser flow logged an unhandled server `AbortError`/500 after a client-aborted request.
5. **P1, missing:** advanced document layout, component-block, and relationship insertion/editing remains far behind the sibling's 10,863-line document view tree.
6. **P1, missing/broken:** custom `ui.views` has metadata-shaped code but no generated module import/loading pipeline; passing model/schema compatibility does not prove custom cells, cards, or fields render.
7. **P1, missing:** the replacement AI sidebar explicitly refuses create/update/delete, while the sibling contains MCP-backed GraphQL mutation tooling.
8. **P1, unproved:** storage/SMTP tests use bounded local protocol servers and source-shaped configuration, not existing production objects, realistic size limits, credentials, delivery, retries, or cutover.
9. **P1, unproved:** `opensource.builders` and `os.org` pass schema/model initialization but have not passed replacement dashboard/auth/provider runtime cutovers.
10. **P2, process risk:** schema add/revert migration generation works, but a revert immediately generates destructive `DROP COLUMN` SQL. There is no automatic watcher/HMR contract or rollback guard around model edits.

## 2. Classification and severity model

Every conclusion uses two independent labels.

| Capability status | Meaning |
|---|---|
| **Missing** | No implementation of the target capability was found. |
| **Broken** | Source or executable behavior directly failed. |
| **Intentional difference** | The replacement deliberately uses another framework or contract and can be acceptable only with explicit migration acceptance. |
| **Unproved** | Plausible implementation or passing narrow tests exist, but no evidence covers the release claim. |
| **Verified for covered contract** | A named, bounded scenario passed; the wording deliberately limits its scope. |

| Severity | Release meaning |
|---|---|
| **P0** | Stop-the-line: critical CRUD/oracle/release evidence cannot be trusted. |
| **P1** | Cutover blocker for affected consumers or core administrator workflows. |
| **P2** | Significant parity, operations, accessibility, or maintainability gap. |
| **P3** | Lower-risk polish or explicitly accepted product difference. |

Static GraphQL or Prisma equality is never sufficient to label dashboard behavior, authentication, storage, hooks, generated clients, migration safety, or accessibility as parity.

## 3. Methodology, evidence boundary, and limitations

### 3.1 Direct evidence used

The audit read current source, generated artifacts, migrations, package scripts, and `READINESS.md`; read the sibling directly without Git and without editing it; rebuilt the replacement; ran current Vitest, CMS, dynamic-model, source-contract, consumer, provider, cutover, lint, and type gates; and used bounded Firefox WebDriver BiDi flows. All app/browser processes started by this audit were terminated. PostgreSQL checks used uniquely named databases in the pre-existing local `vibe-runtime-postgres` container; every audit database was dropped. The sibling was copied to `/tmp`, dependencies were installed only in that fixture, and the 1.1 GB fixture was removed.

Current runtime evidence included:

- a stale/pre-existing `.output` browser run;
- `npm run build` from current source;
- the checked-in browser script against the rebuilt output;
- audit-only temporary copies of that script with larger viewports;
- seeded-memory dashboard create for Role, User, Todo Image, and Todo;
- fresh-memory init plus first Todo create;
- real HTTP GraphQL access denial, validation failure, all-list CRUD, relationship connect/disconnect, password state, Decimal, BigInt, JSON, select, and multiselect;
- disposable PostgreSQL migration, seed, all-list dashboard creates, Todo update, document persistence, relationship card create/edit/disconnect/reconnect, and mobile diagnostics;
- a temporary schema add/revert workflow through `npm run migrate:gen`.

Sibling runtime evidence included a clean temporary source copy, `npm ci`, `keystone build --no-ui`, seven migrations on disposable PostgreSQL, bounded Next 16 runtime, fresh init/auth, direct GraphQL Todo create, and browser navigation to the create route.

### 3.2 Official framework baseline

Framework judgments were checked against current official sources:

- TanStack Start hosting: <https://tanstack.com/start/latest/docs/framework/react/guide/hosting>
- TanStack Router document head management: <https://tanstack.com/router/latest/docs/framework/react/guide/document-head-management>
- Prisma ORM 7 upgrade and required driver adapters: <https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7>
- Prisma development/production migrations: <https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production>
- GraphQL Yoga multipart uploads: <https://the-guild.dev/graphql/yoga-server/docs/features/file-uploads>
- Base UI accessibility: <https://base-ui.com/react/overview/accessibility>
- Slate persistence: <https://docs.slatejs.org/walkthroughs/06-saving-to-a-database>
- GraphQL validation and response semantics: <https://graphql.org/learn/validation/> and <https://graphql.org/learn/response/>
- Keystone access and hooks: <https://keystonejs.com/docs/config/access-control> and <https://keystonejs.com/docs/config/hooks>

These sources support, among other things, treating Prisma `migrate dev` as a development/shadow-database workflow, `migrate deploy` as a production application workflow, Yoga uploads as multipart `File`/`Blob` operations, Base UI primitives as a starting point rather than proof of application accessibility, and Slate JSON persistence as a responsibility that must be tested through storage/reload.

### 3.3 Limitations

No production credentials, existing S3 objects, external SMTP account, production dump, Safari automation permission, or user-specific failing environment was supplied. No destructive operation was run against a persistent application database. No source fix was implemented. The sibling UI could not be surveyed screen-by-screen beyond init/error states because its own AdminMeta query prevents the dashboard shell/list/create routes from loading. Consequently, many visual comparisons are source comparisons plus replacement runtime observations, not paired screenshots of two healthy apps. That limitation itself is a P0 oracle problem, not grounds for declaring parity.

The requested Pi goal could not be created because `create_goal`/`update_goal` was not exposed in this session's tool list. The user instructed the audit to proceed rather than continue looking for goal tooling.

## 4. Stop-the-line create investigation

### 4.1 Evidence chronology

| Run | Adapter/state | Result | What it proves / does not prove |
|---|---|---|---|
| Checked-in browser script before rebuild | seeded memory, old `.output` | Passed full Todo and relationship flow | Proves only that the old bundle worked. It does not prove current source. |
| `npm run build` | current source | Passed; nine CMS artifacts and Nitro output generated | Proves compilation/artifact generation, not CRUD. |
| Checked-in script after rebuild | seeded memory | Failed: pointer target `(970, 2019)` outside `1440 × 2000` | Proves the gate is geometry-fragile. It did not submit create. |
| Temporary 4000px audit viewport | seeded memory | Todo create/update/document/relationship flow passed | Proves current bundle can execute that flow when the harness reaches controls. |
| Temporary 5000px all-list flow | seeded memory | Role `role_3`, User `user_3`, Todo Image `todoimage_3`, and Todo created | Proves every current list has a working dashboard create path in this fixture. |
| Fresh-memory flow | empty memory store | Init created first admin; Todo created at `/dashboard/todos/todo_1` | Proves the bounded first-run path and immediate create. |
| Real HTTP GraphQL flow | seeded memory, real cookie | Anonymous create denied; empty Todo rejected; all four lists created/read/updated/deleted | Proves API behavior for the supplied inputs and access state. |
| Disposable PostgreSQL browser flow | eight migrations + seed | Role/User/TodoImage/Todo create succeeded with CUID IDs | Proves production-shaped adapter CRUD in a clean database. |
| Sibling direct GraphQL | seven migrations, fresh admin | `createTodo` succeeded and defaulted `assignedTo` to the admin | Proves sibling backend create is not the sibling UI failure. |
| Sibling browser create | same disposable DB | “Something went wrong”; create form never loaded | Proves the sibling dashboard metadata contract is broken. |

### 4.2 Replacement create implementation and request path

The replacement create route derives list metadata, enhances field controllers, builds defaults, validates visible editable fields, serializes controller state, and executes a dynamically named GraphQL mutation in `src/routes/dashboard/$listKey.create.tsx:65-221`. The mutation is constructed at lines 166-176 from `list.gqlNames.createInputName` and `createMutationName`; GraphQL errors are preserved into the page and toast at lines 177-185; a returned ID drives item navigation at lines 188-211. This is generic rather than Todo-specific.

The runtime builds create fields and resolvers for initialized lists in `src/features/cms/runtime.ts:2086-2182` and dispatches persistence through the selected adapter. `src/features/cms/adapters/index.ts:6-24` chooses Prisma when `CMS_ADAPTER=prisma` or `DATABASE_URL` exists and memory otherwise. The audit observed CUID IDs in the Prisma browser flow, confirming the Prisma path even though the memory module's initialization log still printed `[cms][memory] bootstrap mode=seeded` as an import side effect.

The real HTTP matrix created:

- Role with text and checkbox;
- User with required text, unique email, password, and role connect;
- Todo with required text, select, multiselect, checkbox, integer, float, Decimal, BigInt, JSON, password, and relationship connect;
- TodoImage with text, JSON, and many relationship connect.

It then read all records and inverse relationships, updated the Todo, disconnected relationships, and deleted all created rows. Anonymous create returned `KS_ACCESS_DENIED`; missing Todo label returned `KS_VALIDATION_FAILURE` with `fieldPath: "label"`. These are exact root-level outcomes, not UI symptom assertions.

### 4.3 Why the user's replacement failure can still be real

The successful fixtures eliminate “all create resolvers are globally broken” but not the following conditions:

1. **Generated artifact drift.** `npm run dev` generates at startup, but an already running Vite process does not establish a model-change watcher contract. `.cms/admin-meta.json`, `.cms/schema.graphql`, Prisma schema/client, migration state, and loaded server modules can disagree.
2. **Database drift or missing migrations.** The audit used an empty database with all eight migrations. A long-lived database may have schema drift, failed migrations, old Prisma join-table shape, or data violating new constraints.
3. **Access/session state.** The successful dashboard used a full administrator. Restricted users can legitimately see read surfaces while create is hidden or denied. A stale session payload can also retain old role permissions.
4. **Field-specific serialization.** The broad GraphQL input matrix bypasses dashboard interaction for many controllers. An arbitrary consumer model, dynamic mode, custom field, custom view, file, document component block, or relationship ownership shape can still serialize incorrectly.
5. **Storage/provider state.** Creating an item with an actual upload selects multipart and storage lifecycle paths not selected by scalar-only create.
6. **Viewport and focus state.** The fresh-build checked-in test already failed before create due to pointer geometry. A human may encounter validation below the fold, focus trapping, min-content overflow, or a disabled control and perceive a no-op.
7. **Old output.** The stale output passed before the current source was rebuilt. The inverse is equally possible in a user's local process: source may be fixed while the running bundle remains old.

**P0 acceptance criterion:** capture the user's exact command, adapter, URL, list, field values, viewport, current generated-artifact hashes, migration status, request payload/response, console, and server error; reproduce on a disposable copy/database; add that exact case to a browser matrix that always builds current source and identifies the submitted mutation.

**Executable verification:** `npm run build && npm run test:dashboard:browser` must pass without a temporary viewport patch; add seeded-memory, fresh-memory, and disposable-Prisma jobs; for each list assert a `create<List>` network request, zero GraphQL errors, returned ID, item reload, and cleanup. The current command does not meet this criterion.

## 5. Architecture and data-flow map

```text
cms.config.ts + src/features/cms/models/**
  -> initialiseLists() in src/features/cms/config.ts
  -> registry.ts / runtime.ts
  -> cms:generate
       -> .cms/manifest.json
       -> .cms/admin-meta.json
       -> .cms/schema.graphql
       -> .cms/schema.prisma + prisma/schema.prisma
       -> .cms/view-order.{json,ts}
       -> .cms/types.ts / runtime.ts
  -> Prisma 7 generator -> src/generated/prisma/**
  -> migrations -> PostgreSQL

Browser
  -> TanStack Router src/routes/dashboard/**
  -> fetch Keystone AdminMeta through /api/graphql
  -> enhanceFields() + generated view index
  -> field controller default/deserialize/validate/serialize
  -> dynamically named GraphQL CRUD operation
  -> GraphQL Yoga request/context/session
  -> operation/filter/item/field access
  -> hooks + mutation state + nested writes
  -> memory or Prisma adapter transaction
  -> storage lifecycle / password hashing / relationship synchronization
  -> result + query invalidation + route navigation
```

The sibling uses Next App Router server/client screens and server actions, but ultimately calls its Yoga/Keystone GraphQL schema. The replacement intentionally substitutes TanStack Start, local Keystone-shaped list/field factories, GraphQL Yoga 5, Prisma 7 driver adapters, Base UI, and Slate. Those are legitimate architectural differences only where the externally observable and developer-facing contracts are accepted and verified.

## 6. Complete gap taxonomy

### GAP-01 — Browser create release gate is not trustworthy

- **Status/severity:** **Broken evidence, P0.**
- **Evidence:** `scripts/validate-dashboard-browser.mjs:332-386` hard-codes seeded Ada credentials, Todo routes, exact labels, and a 2000px desktop viewport. After current-source build it failed at a pointer coordinate before submission. A temporary larger viewport passed. The script starts `.output/server/index.mjs`, so invoking it without the package script can test stale output.
- **Root cause:** scenario and viewport are coupled to one starter form/data shape; no build fingerprint or mutation-level assertion exists before the UI outcome; short memory IDs hide production layout behavior.
- **Impact:** a passing historical report can coexist with a broken current build, and a harness failure can be mistaken for create failure.
- **Dependency:** first remediation slice; all UI claims depend on reliable evidence.
- **Acceptance:** build inside the test; use viewport-visible scrolling before pointer actions; record request/response; parameterize adapter/bootstrap/list; use realistic IDs; distinguish harness, network, validation, access, and server failures.
- **Verification:** `npm run test:dashboard:browser` plus fresh and Prisma variants must pass twice consecutively and leave no app/browser/database process.

### GAP-02 — The sibling dashboard is a broken executable oracle

- **Status/severity:** **Broken, P0, comparison-target limitation.**
- **Evidence:** sibling `features/dashboard/actions/getAdminMetaAction.ts:15-83` requests fields absent from sibling `schema.graphql:636-705`. Browser and server logs name six invalid fields. Direct sibling init/auth/create succeeds.
- **Root cause:** the custom dashboard's “exact copy” assertion is false for the installed/generated Keystone schema. Its query appears to target extended metadata that the dependency does not provide.
- **Impact:** no honest paired screen-by-screen runtime parity can be completed until the oracle starts. Copying the sibling query would regress the replacement, whose schema intentionally exposes the extension.
- **Remediation design:** freeze an “intended sibling dashboard contract” artifact: either extend sibling AdminMeta in a read-only derived fixture, or trim the sibling query in the fixture, without changing the authoritative repository. Keep direct source as design reference and mark broken sibling behavior as not-to-copy.
- **Acceptance:** derived sibling fixture loads home/list/item/create with zero invalid GraphQL fields; direct sibling source and fixture patch are documented separately.
- **Verification:** bounded fixture, disposable DB, fresh init, navigate `/dashboard/todos/create`, and assert the form rather than the error boundary.

### GAP-03 — Real-ID mobile overflow and responsive layout

- **Status/severity:** **Broken, P1.**
- **Evidence:** disposable-Prisma Firefox at 390px reported `documentWidth: 487`. Offenders included the item-page `aside`, h1, ID card, field groups, and sections, each 471px wide. `src/routes/dashboard/$listKey.$id.tsx:493-565` uses a grid/aside layout without sufficient `min-w-0`; `src/components/dashboard/relationship-field-editor.tsx:310-316` renders unbroken IDs in title/monospace description.
- **Root cause:** implicit grid min-content sizing and non-breaking identifiers. Seed IDs such as `todo_4` do not trigger it; CUIDs do.
- **Impact:** horizontal scrolling, clipped controls, degraded touch/keyboard operation, false responsive readiness.
- **Acceptance:** every route/state at 320, 375, 390, 768, and desktop has `scrollWidth <= innerWidth + 1`; long CUID/UUID/email/filename/Decimal/document content is included.
- **Verification:** real Prisma browser fixture; report widest DOM nodes on failure; screenshots for home/list/create/item/dialog/right-sidebar states.

### GAP-04 — Client-abort handling can log an unhandled 500

- **Status/severity:** **Broken/intermittent, P1.**
- **Evidence:** the production-shaped Prisma browser run completed functional operations but Nitro/H3 logged `AbortError: This operation was aborted`, `status: 500`, and `unhandled: true`. The checked-in script's final `/error|exception|unhandled/i` assertion then failed.
- **Root cause:** a response closed during navigation is surfaced as an unhandled server exception instead of an expected cancellation. Exact request was not correlated because the harness logs only aggregate events.
- **Impact:** noisy production logs, false 500 telemetry, possible error-budget alerts, and non-deterministic browser gate failures.
- **Acceptance:** request IDs correlate browser navigation aborts and server logs; expected aborts are handled without 500/unhandled output; genuine resolver failures remain visible.
- **Verification:** repeatedly navigate create/item/list during in-flight queries under throttling and assert no unhandled server exception.

### GAP-05 — Advanced document parity is missing

- **Status/severity:** **Missing/partial, P1.**
- **Evidence:** current `src/components/dashboard/views/document.tsx` is 536 lines and `rich-document-editor.tsx` is 586 lines. It supports useful core editing and JSON fallback. The sibling `features/dashboard/views/document/**` is approximately 10,863 lines with dedicated layout, relationship, component-block, paste, normalization, toolbar-state, and block primitive modules. Current `READINESS.md` itself leaves layout/component/relationship insertion open.
- **Root cause:** the replacement implemented a Slate core subset, while retaining metadata/runtime shapes for broader Keystone document features.
- **Impact:** consumer documents can persist as JSON yet be impossible to author or safely edit. “Schema compatible” can silently become content-authoring loss.
- **Acceptance:** formatting flags gate controls; layouts preserve configured ratios; component blocks validate and edit schema fields; inline relationships search/insert/edit/hydrate; paste HTML/Markdown is normalized; unknown nodes round-trip without loss; read-only rendering and keyboard/a11y match accepted target behavior.
- **Verification:** browser creates every configured node type, saves, queries raw document, reloads visual mode, edits nested blocks/relationships, and compares normalized JSON before/after.

### GAP-06 — Custom `ui.views` loading is not implemented end-to-end

- **Status/severity:** **Missing/broken, P1.**
- **Evidence:** `src/components/dashboard/enhance-fields.tsx:67-82` attempts to resolve `customViewsIndex`, but calls `getFieldViews(customViewsIndex, field)`. `src/components/dashboard/views/registry.tsx` prioritizes `field.kind`, returning a built-in view regardless of custom index. `scripts/cms-generate.ts` emits metadata and view-order arrays but no imports/bundle manifest for arbitrary custom modules. `src/features/cms/view-order.ts:17-43` maps built-in Keystone view paths only.
- **Root cause:** numeric metadata was modeled without the build-time module graph Keystone uses.
- **Impact:** consumer custom Field/Cell/CardValue exports can be ignored while schema/model audits pass.
- **Acceptance:** a fixture with a non-built-in `ui.views` path produces a static Vite-resolvable module map; permitted exports override the built-in; invalid/missing exports fail generation with list/field/path diagnostics; HMR/restart behavior is documented.
- **Verification:** temporary model with custom Field, Cell, and CardValue markers; generate/build; browser assert markers on create/item/list/cards; remove/revert and assert cache cleanup.

### GAP-07 — Field coverage is broad in backend but incomplete in real dashboard evidence

- **Status/severity:** **Partial/unproved, P1-P2.**

| Field | Current state | Gap |
|---|---|---|
| ID | cuid/uuid/autoincrement schema support exists | Dedicated browser behavior, non-string generated TS types, sorting/filtering across ID kinds unproved. |
| Text | Required text create verified | Textarea/display-mode metadata is not honored by `views/text.tsx`, which always renders a one-line `Input`; null/empty distinction needs parity cases. |
| Password | Hashing, reset, and set/change UI exist | Browser create required a two-step “Set password” interaction absent from the generic harness; common-password/KDF/provider behavior remains environment-specific. |
| Checkbox | Default/edit supported | Dynamic modes and screen-reader announcement beyond primitive defaults unproved. |
| Select/multiselect | GraphQL and unit/controller tests pass | Browser create/filter/clear/nullability and integer/enum option types are not comprehensively covered. |
| Integer/float/Decimal/BigInt | Dedicated number view and GraphQL create pass | Boundary precision, locale input, exponent/NaN, min/max, nullability, and browser round-trip need a fixture matrix. |
| Timestamp | View exists | Time zone, DST, seconds/milliseconds, null clear, and sibling formatting parity unproved. |
| JSON | View/runtime tests exist | Large/malformed JSON, prototype keys, accessibility, and lossless formatting browser cases incomplete. |
| Image/file | Shared `FileFieldEditor` exists and Yoga multipart helpers pass | No current file field exercises dashboard behavior; external provider, realistic files, upload cancellation, limits, old-object deletion, and rollback remain unproved. |
| Relationship | Strong Todo cards scenario passes | All cardinalities, one-to-one ownership, set/create/connect conflicts, access-hidden refs, pagination, arbitrary unique selectors, and long labels/IDs need browser coverage. |
| Document | Rich core passes | See GAP-05. |
| Virtual | Runtime scalar/composite tests pass | Current dashboard falls back to generic rendering; custom `ui.query`, composite rendering, Cell/CardValue, and error behavior are not browser-proved. |
| Custom views | Metadata-shaped only | See GAP-06. |
| Groups/positions | Current route partitions form/sidebar | Sibling create source currently puts all fields in main despite comments; dynamic position functions and mobile behavior need accepted contract tests. |

**Acceptance/verification:** generate an isolated “field zoo” fixture with every field/configuration and run create/read/update/delete, required/null/invalid, filtering, ordering, cells, cards, serialization, and accessibility in memory and Prisma. This must be a release gate, not a collection of controller unit tests.

### GAP-08 — Relationship and nested-write parity remains bounded

- **Status/severity:** **Partial-strong/unproved, P1.**
- **Evidence:** memory/dynamic/Prisma tests cover connect/create/set/disconnect, rollback, inverse reassignment, and one-to-one selectors. Firefox proves TodoImage cards create/edit/disconnect/reconnect. `READINESS.md` already admits some nested error detail differences.
- **Gaps:** all one/many ownership permutations; multiple unique selectors; nested access denial after partial work; hooks over multi-level nested creates; cyclic/self relationships; required relation disconnect; delete referential actions; transaction isolation/concurrency; custom mapped model/column names; composite IDs; production Prisma errors.
- **Acceptance:** matrix generated from relationship metadata, with expected database ownership and exact rollback counts. No nested mutation may leave rows/files after denial or failure.
- **Verification:** disposable PostgreSQL tests for each cardinality/owner side, including injected hook/storage failures and concurrent writes.

### GAP-09 — Auth/session/reset is intentionally different and not yet an accepted migration contract

- **Status/severity:** **Intentional difference plus unproved continuity, P1.**
- **Evidence:** current init/auth/session/reset tests pass; fresh browser init passes; cookies are HttpOnly/Secure/SameSite Lax in the replacement audit. `READINESS.md` keeps auth/session cookie/security acceptance open. Current `cms.config.ts:44-84` is coupled to a User/Role session selection, although the lower runtime supports configurable auth list keys.
- **Gaps:** existing sibling cookie continuity, session invalidation, key rotation, multi-instance behavior, clock skew, production HTTPS/proxy attributes, reset token continuity during cutover, rate limiting, account enumeration policy, SMTP failure/retry, and arbitrary auth-list dashboard profile behavior.
- **Acceptance:** explicit migration decision says whether old sessions survive; reset tokens are either migrated or invalidated safely; production cookie matrix and secret rotation pass; auth list names other than User render.
- **Verification:** two-process test with shared secret/database, old/new cookie fixtures, reset request/redeem/replay/expiry, proxy headers, and negative enumeration/rate cases.

### GAP-10 — Storage and provider continuity is not cutover evidence

- **Status/severity:** **Unproved, P1.**
- **Evidence:** `npm run test:providers:local` passed signed force-path-style S3 protocol behavior and a live local SMTP wire delivery. GraphQL multipart tests pass. These are valuable contract tests.
- **What is missing:** external S3 provider credentials, bucket policy/CORS, existing sibling object keys/URLs, realistic image dimensions and large files, stream/buffer limits, retries/timeouts, orphan cleanup on transaction failure, signed URL clock/expiry behavior, delete permissions, CDN/custom endpoint behavior, SMTP TLS/auth/deliverability/bounces.
- **Acceptance:** inventory and read existing objects without mutation; upload/read/delete disposable objects through the real provider; define size/timeout/backpressure limits; prove rollback/orphan handling; deliver reset mail through staging provider and observe failure metrics.
- **Verification:** provider-specific staging suite with synthetic files at boundary sizes and restore-safe object prefixes.

### GAP-11 — Dashboard shell and states are not exhaustively paired

- **Status/severity:** **Partial/unproved, P1-P3.**
- **Evidence:** current dashboard components total about 11,343 TypeScript lines; sibling dashboard totals about 29,296. Both have left/right sidebars and similar shell source. Current has explicit loading/error/empty paths, filters, sorting, columns, pagination, bulk delete, dialogs, relationship sheets, theme, and AI shell. Vitest covers many URL/state helpers.
- **Missing proof:** paired home/list/item/create visuals; filtered and unfiltered empty; 404 and resolver error boundaries; loading races; bulk partial failure; all dialogs/drawers; right-sidebar resizing/toggling; responsive navigation; focus return/trap; full keyboard operation; screen-reader landmarks/live announcements; high contrast; reduced motion; zoom; typography/color/spacing tokens.
- **Accessibility caveat:** Base UI provides ARIA/focus primitives, but official Base UI documentation does not make the assembled application accessible automatically. The existing browser check only finds unnamed visible links/buttons on one Todo item and presses Tab once.
- **Acceptance:** route-state inventory with screenshots and accessibility-tree/keyboard assertions at each breakpoint. Axe or equivalent findings require human review, not blind pass/fail.
- **Verification:** bounded current and repaired-oracle sibling runs, or approved screenshots/source contract where sibling cannot run.

### GAP-12 — AI sidebar and MCP parity is missing

- **Status/severity:** **Missing/intentional downgrade, P1.**
- **Evidence:** current `src/features/cms/dashboard-completion.ts:127-151` explicitly says direct AI CRUD is not wired. The sibling `app/api/mcp-transport/[transport]/route.ts` defines list/type inspection and create/update/delete GraphQL tools. Current route inventory has completion and GraphQL but no MCP transport equivalent.
- **Impact:** the sidebars look similar while capabilities differ materially; `test:dashboard:ai` proves guidance behavior, not sibling AI parity.
- **Acceptance:** decide whether AI mutation is in parity scope. If yes, implement authenticated, access-respecting tools with confirmation, audit, input limits, same-origin cookie isolation, and no `sudo` bypass. If no, visibly label the intentional difference and remove parity wording.
- **Verification:** anonymous denial, restricted-user denial, confirmed admin CRUD, malformed tool input, cross-origin/redirect rejection, and audit record checks.

### GAP-13 — Schema equality and consumer initialization are not runtime portability

- **Status/severity:** **Verified static contract; runtime unproved, P1.**
- **Evidence:** direct source audit reports zero Prisma SQL, zero source-only GraphQL types, root signature differences, changed shared inputs, breaking changes, or dangerous changes. All four sibling list initializers match after documented normalization. `opensource.builders` and `os.org` initialize 15 lists/157 fields through aliases with zero schema differences.
- **What it does not prove:** consumer app build, dashboard routes, auth, custom schema resolvers under requests, generated Prisma Client imports, migrations on consumer data, storage, document/custom views, consumer hooks, server actions, deployment, or user workflows.
- **Acceptance:** copy each consumer to a temporary fixture, install replacement aliases, build, migrate a production-shaped sanitized dump, run auth/dashboard/domain smoke, and restore rollback. No consumer source is changed during audit; implementation should use dedicated migration branches later.
- **Verification:** per-consumer command manifest and requirement-to-runtime evidence, not only schema output.

### GAP-14 — Development schema-change loop works manually but is not safe/automatic

- **Status/severity:** **Partial, P2.**
- **Evidence:** a temporary fixture added `Role.parityAuditText`, ran `npm run migrate:gen -- --name parity_audit_add_field`, generated AdminMeta/GraphQL/Prisma artifacts and `ALTER TABLE ... ADD COLUMN`, then removed the field and generated a revert. `cms:check` passed. The revert SQL warned and executed `ALTER TABLE "Role" DROP COLUMN "parityAuditText"`.
- **Gaps:** no documented watcher ties model edits to CMS generation, Prisma Client generation, migration decision, Vite restart, and route cache invalidation. Revert is destructive by default. `db:reset:fresh` uses force reset/db push and must never be mistaken for safe migration. Custom views are not bundled. Rollback of an applied destructive migration is dump/restore, not source revert.
- **Acceptance:** one documented state machine: edit -> generate/check -> inspect diff -> named migration on disposable shadow/main -> tests -> restart/HMR boundaries -> apply; change/revert requires data-loss acknowledgement and backup/restore plan.
- **Verification:** temporary fixture add/rename/type-change/relationship/custom-view/remove cases, including populated data and failed migration recovery.

### GAP-15 — Hard-code audit is narrower than “repository-wide”

- **Status/severity:** **Partial, P2.**
- **Evidence:** `npm run test:dependencies` passes because it scans generic runtime for starter literals. Generic resolver/dashboard routing is largely dynamic. However, `cms.config.ts`, seed, source-cutover scripts, Prisma validators, and the sole browser acceptance are heavily Todo/User/Role/fixed-ID oriented. `scripts/validate-dashboard-browser.mjs` uses `user_admin`, Ada/Ed, Todo paths, and exact field labels.
- **Impact:** generic code may be portable while release evidence is not. New model names can pass schema generation yet receive no real browser coverage.
- **Acceptance:** separate expected demo-domain literals from forbidden generic/test infrastructure assumptions; parameterize browser and Prisma suites from AdminMeta; run arbitrary lower-case, acronym, mapped, singleton, UUID, and autoincrement model fixtures.
- **Verification:** repository scanner with allowlisted model fixtures plus a generated arbitrary-model browser run.

### GAP-16 — Production readiness, observability, performance, and metadata remain open

- **Status/severity:** **Unproved, P1-P3.**
- **Evidence:** current build, lint, typecheck, source cutover, and `npm audit` baseline pass. Build uses a Nitro nightly and warns that traced output is `darwin-arm64`; optional `node-libcurl` trace resolution fails non-fatally. No application metrics/tracing/error service or load profile was identified. Current root title is `TanStack Keystone Starter` in `src/routes/__root.tsx:18-25`; sibling dashboard title is `Keystone x Next Dashboard` in `app/dashboard/layout.tsx:6-9`, and sibling explicitly links `/favicon.svg` in `app/layout.tsx:29-31`.
- **Gaps:** supported deployment matrix, Linux build artifact, cold start, request/body/upload limits, GraphQL depth/complexity, query performance, pagination scale, database pool exhaustion, structured request/error logs, health/readiness, migration telemetry, backup drills, CSP/security headers, browser metadata parity, and favicon/theme-color behavior.
- **Acceptance:** stable deployment target; build on target OS; performance budgets with representative data; metrics and redacted structured logs; alerts for GraphQL/storage/auth/migration failures; security-header and metadata checks.
- **Verification:** production-like container build, load test, failure injection, accessibility/performance trace, and rollback drill.

## 7. False-positive tests and readiness claims

Passing gates are useful only when their proof boundary is explicit.

| Claimed gate | It actually proves | It does **not** prove |
|---|---|---|
| `npm test` — 37 files, 130 tests | Component/helper contracts under Vitest | Real routing, CSS, browser events, external providers, Prisma unless explicitly mocked/invoked |
| `npm run test:cms` | Broad memory CRUD/access/hooks/auth/storage helper semantics | Production PostgreSQL behavior for every case, UI serialization, external providers |
| `npm run test:cms:dynamic` | Arbitrary-list runtime/schema and Prisma fixture/temp-client cases | Custom view module bundling, arbitrary-model dashboard flow, migrations on consumer data |
| `audit:next-source` | Source GraphQL operations/types are not removed and Prisma schema diff is empty | Dashboard behavior, extra local semantics, AdminMeta consumers, hooks/access exactness, data cutover scale |
| `audit:next-models` | Four exported initializer ASTs normalize compatibly | Runtime behavior of every callback or environment, UI modules, arbitrary external models |
| `test:openfront-consumers` | Two registries/extensions initialize and schemas compare | Either consumer runs after cutover |
| `test:providers:local` | Local protocol implementations and signatures/mail wire work | Real provider continuity or delivery |
| `test:source-cutover` | One representative dataset/migration/restore flow | Production volume, every model/constraint/object/provider |
| `npm run build` | Current source compiles to Nitro output | Runtime CRUD, target-OS portability, schema/database sync |
| browser acceptance historical pass | One seeded Todo scenario in the bundle actually executed | Current source unless rebuilt; all lists/fields; real IDs; exhaustive a11y/mobile |
| visible-control name check | No unnamed visible `button`/`a` in one state | Correct names, inputs, dialogs, landmarks, announcements, focus order, screen-reader usability |
| clean browser network/console count | The captured subscribed events had no unexpected errors | Server logs, events before subscription, aborted requests classified away, external runtime |
| `npm audit` | Known advisories in current lock at that moment | application vulnerabilities, secrets, authorization flaws, future advisories |
| lint/typecheck | Static configured source is valid | behavior; parallel audit showed lint can false-fail while `.cms-temp` exists |

The sharpest contradiction is now explained: historical browser and unit tests passed while create was reported broken because the evidence used one seeded-memory Todo and could use stale `.output`. Rebuilding made the script fail before create for viewport reasons. Larger-viewport and Prisma runs showed create succeeds in the audited environments, but also exposed mobile overflow and an unhandled server abort. The passing tests and reported failure are therefore not logically inconsistent; they select different bundles, data, adapters, users, or UI geometry.

The sibling adds another warning: its direct GraphQL create passes while its dashboard create route fails before rendering. A backend CRUD pass cannot be promoted to “users can create items.”

## 8. Ranked vertical-slice remediation plan

### Slice 1 — Make create evidence authoritative (P0)

1. Replace the Todo-only script with AdminMeta-driven scenarios for every current list.
2. Build current source within the harness and record artifact hash.
3. Run seeded memory, fresh memory, and disposable Prisma.
4. Assert network mutation payload/response and item reload.
5. Add harness-error classification and robust scroll-to-visible input.
6. Reproduce the user's exact environment once supplied.

**Exit:** the create matrix is green and the original user case has either an exact root cause or a documented non-reproduction bundle.

### Slice 2 — Repair mobile and abort behavior (P1)

Add `min-w-0`/overflow-safe grid/card rules and break long IDs/labels only where semantically safe. Correlate aborted requests and handle expected disconnects without 500 logs.

**Exit:** realistic-ID responsive matrix and repeated navigation stress are clean.

### Slice 3 — Establish a runnable target oracle (P0/P1)

Create a documented, disposable sibling fixture adaptation for AdminMeta only. Never edit the sibling. Capture baseline screenshots, DOM/a11y trees, and route behavior. Mark target bugs as excluded from parity.

**Exit:** paired route comparisons can run deterministically.

### Slice 4 — Field-zoo vertical parity (P1)

Add one isolated fixture covering every field, nullability/validation mode, groups/positions, dynamic modes, cells/cards, ID kind, and relationship shape. Drive GraphQL and dashboard CRUD against memory and Prisma.

**Exit:** every field matrix row has executable evidence.

### Slice 5 — Custom views and document advanced blocks (P1)

Implement static custom-view generation/bundling first, because document component blocks and custom cells depend on the same module boundary. Then deliver layouts, component blocks, and relationship blocks in separate document slices with JSON round-trip tests.

**Exit:** custom and advanced document content can be authored, persisted, reloaded, and rendered without loss.

### Slice 6 — Auth/storage/provider continuity (P1)

Write migration contracts, then test staging S3/SMTP and existing-object/token behavior. Add rate/size/time limits and failure observability.

**Exit:** provider and auth cutover matrices are accepted.

### Slice 7 — Consumer runtime cutovers (P1)

Use temporary copies and disposable/sanitized databases for `opensource.builders`, then `os.org`. Do not generalize from static schema parity.

**Exit:** build/auth/dashboard/domain/provider/rollback evidence exists per consumer.

### Slice 8 — Complete UI/accessibility/performance parity (P2)

With the repaired oracle and field zoo, finish all route states, keyboard/screen-reader, responsive, theme, metadata, and performance budgets.

**Exit:** release matrix below is fully green or differences are explicitly accepted.

## 9. Final parity definition

Parity means an authorized administrator and supported restricted users can complete the same accepted workflows through the replacement, with compatible persisted data and GraphQL contracts, under supported production infrastructure, without silent content loss, weaker access, broken providers, or inaccessible UI. It includes the developer workflow required to change schemas safely and the operational evidence required to deploy and roll back. It does not mean copying Next.js internals, Keystone packages, or known sibling bugs. It does not follow from equal static schemas.

A capability is at parity only when:

1. current and target/intended behavior are defined;
2. missing/broken/intentional/unproved status is resolved;
3. memory and Prisma paths pass where applicable;
4. dashboard and GraphQL paths pass where applicable;
5. access denial, validation, and failure rollback pass;
6. realistic data and providers are covered;
7. accessibility and responsive behavior are accepted;
8. migration and rollback are executable;
9. consumer impact is tested; and
10. evidence can be rerun from current source without stale artifacts or persistent processes.

## 10. Release gate matrix

| Gate | Required evidence | Current status |
|---|---|---|
| P0 create | all-list, all-adapter, fresh-init browser/API matrix; user case root cause | **OPEN — audited fixtures pass; user case and checked-in harness unresolved** |
| Runnable target | sibling intended UI fixture loads all routes | **FAILED — AdminMeta query mismatch** |
| Core CRUD | create/read/update/delete, validation/access/rollback | **Partial-strong** |
| Fields | field-zoo browser + GraphQL + Prisma | **OPEN** |
| Relationships | all cardinality/ownership/nested transaction matrix | **OPEN** |
| Document | advanced nodes/relationships/components round-trip | **FAILED/PARTIAL** |
| Custom views | generated module map and browser markers | **FAILED/MISSING** |
| Auth/session/reset | accepted cookie/token migration and production matrix | **OPEN** |
| Storage/uploads | staging provider, realistic size, existing object continuity | **OPEN** |
| Dashboard routes/states | paired route-state inventory | **OPEN; sibling oracle blocked** |
| Responsive | realistic data at breakpoint matrix | **FAILED — 487px document on 390px viewport** |
| Accessibility | keyboard, screen reader, names, focus, contrast, zoom | **OPEN** |
| AI/MCP | accepted parity scope and secured operations | **FAILED if in scope** |
| Schema workflow | add/change/revert/custom view, migration safety, cache/restart | **Partial; destructive revert risk** |
| Source cutover | representative migration + restore | **Verified for representative fixture only** |
| Consumer portability | runtime cutover for both named consumers | **OPEN; static contracts only** |
| Providers | production/staging continuity | **OPEN** |
| Security | authz review, headers, limits, audit, current dependencies | **OPEN/PARTIAL** |
| Observability | structured logs, metrics, tracing, alerts, request correlation | **MISSING/UNPROVED** |
| Performance | representative load and browser budgets | **UNPROVED** |
| Production build | supported target OS/runtime, stable deployment package | **OPEN/PARTIAL** |
| Browser metadata/theme | accepted title/favicon/theme parity | **OPEN/P3** |
| Readiness authority | `READINESS.md` remains unchanged until remediation evidence | **PRESERVED** |

## 11. Handoff conclusion

The remediation session should not begin by rewriting CRUD. It should begin by replacing the evidence harness and reproducing the user's exact state. In three clean replacement configurations, create works; in the actual sibling, dashboard create does not even render although GraphQL create works. That distinction is the central finding of this audit.

The replacement has credible foundations and unusually broad static/runtime helper coverage, but it is not at exhaustive parity. The open work is concentrated at boundaries that static schemas cannot prove: current-bundle browser evidence, realistic IDs/layout, custom UI modules, advanced documents, providers, consumer runtimes, auth continuity, operational handling, and accessibility. The ordered slices above are sufficient for a separate implementation session to move from a defensible P0 reproduction gate to verified parity without copying known sibling defects.
