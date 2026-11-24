# GAP-08 metadata-derived relationship matrix — bounded candidate plan

## Status and authority

This is a static/focused candidate plan, not runtime evidence and not a checkpoint. `docs/PARITY_GAP_DISSERTATION.md` controls the claim. Checkpoint 024 remains accepted only for its isolated advanced-document plus one nested rollback shape; checkpoint 028 remains accepted only for its two fresh-memory arbitrary create/auth shapes. `READINESS.md` is unchanged.

No build, PostgreSQL matrix, app server, Firefox, Prisma generation/push, or other heavy command belongs to the static phase. Integration and oversight explicitly keep the heavy slot blocked; this revision requests fresh static review and does not infer clearance.

## Frozen boundaries

The candidate adds new GAP-08-only files. It must not edit:

- checkpoint-024 files (`package.json`, the accepted advanced-document gate, rich document/relationship editors, document view, and accepted focused document test);
- checkpoint-028 product/runtime/current-nine/expanded-eleven files;
- checkpoint-017 `a61a761…` shared browser/responsive files;
- shared Vite/Nitro/browser infrastructure;
- `docs/PARITY_REMEDIATION_PROGRESS.md`, `docs/PARITY_REMEDIATION_OVERSIGHT.md`, or `READINESS.md`.

A product defect found by the later heavy candidate is a RED disposition. The fixture must not be renamed, relaxed, or special-cased around the defect, and frozen/shared product source must not be changed without explicit oversight disposition.

## Static candidate

The focused boundary consists of:

- `scripts/gap08-relationship-contract.mjs` and its declaration: pure validation and matrix/scenario derivation from normalized `AdminMetaList.resolvedDbFields`, field AdminMeta, GraphQL names, and generated Prisma schema text;
- `scripts/fixtures/gap08-cms.config.ts`: synthetic fixture with three two-sided pairs and custom model/FK/join mappings;
- `scripts/validate-gap08-relationship-metadata.ts`: non-database validator;
- `tests/gap08-relationship-matrix.test.ts`: focused unit/static contract tests.

The fixture has no starter-domain model names. The six endpoint cases are discovered and sorted from metadata rather than listed by model name:

| Local shape | Endpoint count | Expected ownership |
| --- | ---: | --- |
| one-to-one | 2 | one `own`, one `inverse` |
| one-to-many | 1 | `inverse` |
| many-to-one | 1 | `own` |
| many-to-many | 2 | two `shared` |

Each related list exposes `id` plus a non-ID unique scalar selector. Every list has a custom Prisma model mapping; owned endpoints have custom FK column mappings; the many-to-many pair has a custom relation/join name. The contract rejects missing opposites, contradictory cardinality, contradictory ownership/FK metadata, missing schema ownership, missing arbitrary unique selectors, incomplete pair coverage, empty GraphQL/UI names or paths, and any missing/duplicate/mismatched model-level `@@map` binding.

Requiredness is pair-derived but operation-specific. Each endpoint records local and reciprocal `create` and `update`/item requiredness separately. `required-create` follows only create requiredness. Disconnect and delete invariant selection follows only explicit local `required.update` or reciprocal `required.opposite.update`; create-only requiredness does not suppress an otherwise eligible disconnect/delete. The exact 76-scenario fixture plan emits rejection/product-RED cases for local update-required disconnect/delete-related and inverse-side update-required disconnect/delete-local bypasses. Deletion is split into unambiguous `delete-local` (`parentDelta: -1`) and `delete-related` (`relatedDelta: -1`) scenarios; all rejection deltas are exactly zero.

The delete/disconnect oracle is an explicit replacement-fixture invariant and bounded replacement-product finding. It is not a blanket Keystone parity statement and does not claim that historical official Keystone relationship configuration independently defines delete-required behavior.

### Preserved static RED history

1. The initial test-first run REDed because the new relationship contract module did not yet exist.
2. Oversight's first static review blocked heavy work because successful required disconnect and ambiguous delete deltas were incorrect, opposite requiredness was absent, `@@map` was not schema-bound, executable names could be empty, and physical join naming was not distinguished from relationship metadata.
3. The first focused run for the first revision intentionally REDed 3/6 tests on those missing contracts before implementation.
4. Oversight's second static review kept heavy blocked because scenario selection collapsed create/update requiredness and the concurrency design used direct PostgreSQL writes instead of CMS mutations.
5. The first focused run for this second revision intentionally REDed 3/8 tests on create-only eligibility, replacement-fixture invariant labeling, and the missing after-write GraphQL handshake. No heavy command ran during any RED.

## Later heavy candidate (requires explicit integration/oversight clearance)

The later wrapper will be a new GAP-08-only process, invoked directly without changing `package.json`. One invocation is allowed. Any behavioral RED stops the run; there is no automatic retry or rerun-to-green.

### 1. Disposable fixture and actual metadata

1. Copy source to a unique `tks-gap08-*` root, excluding `.git`, source `.output`, and source writable dependency caches.
2. Link dependencies while excluding `.cache`, `.nitro`, `.vite`, and `.vite-temp`.
3. replace only copied `cms.config.ts` with a re-export of the synthetic fixture.
4. Use a unique `tks_gap08_<pid>_<time>` PostgreSQL database and copied-fixture-only Vite/Nitro/Jiti/TanStack cache directories.
5. Run copied-fixture CMS generation and parse the generated `.cms/admin-meta.json`, `.cms/manifest.json`, `.cms/schema.prisma`, and GraphQL names. Derive the executable endpoint matrix, pair/opposite requiredness, physical storage contract, and exact scenario deltas/rejections with the same pure contract used by focused tests.
6. Assert generated metadata/schema hashes remain fixed for the entire run. Require every executable GraphQL name, list path, label field, relationship path, mapped table, and selector to be nonempty. Do not substitute a handwritten endpoint list after generation.

### 2. Raw GraphQL and direct PostgreSQL matrix

For every derived endpoint, execute isolated setup and exact before/after snapshots. Each snapshot records all fixture model row counts, the endpoint edge count, the owning FK value or mapped join-table rows, and sentinel rows/edges that must remain unchanged.

- **to-one endpoints:** `connect` by non-ID unique selector, repeated/idempotent connect, nested `create`, eligible `disconnect`, connect+create conflict, missing ID, invalid selector shape, and an ID copied from the wrong list.
- **to-many endpoints:** `connect`, duplicate connect, nested `create`, eligible `disconnect`, replacement `set`, set+disconnect conflict, missing IDs/selectors, and cross-list ID misuse.
- **both sides:** execute the applicable sequence through both endpoints of every pair, not only through the FK-owning side. Explicit local `required.update` and reciprocal `required.opposite.update` decide whether disconnect/delete is a success or replacement-fixture required-invariant rejection; `required.create` affects only required-create.
- **exact outcomes:** successful `connect` is `{parent: 0, related: 0, edge: +1}`; nested create is `{0,+1,+1}`; replacement set and duplicate connect are `{0,0,0}`; eligible disconnect is `{0,0,-1}`; delete-local is `{-1,0,-1}`; delete-related is `{0,-1,-1}`. Invalid selectors/IDs, cross-list IDs, conflicts, rollback probes, and every required-invariant denial are rejections with `{0,0,0}` and unchanged scalar/sentinel state.
- **ownership/cardinality:** query PostgreSQL independently using mapped table/FK names already proven against exact generated model-level `@@map` directives. One-to-one must retain at most one edge; one-to-many/many-to-one and many-to-many must retain exact expected edge counts.
- **physical shared ownership:** `joinTableName` and near/far metadata remain relationship/field names, not SQL identifiers. The static contract records Prisma's implicit many-to-many v2 convention: physical table `_<relationName>`, columns `A`/`B`, with A/B assigned by lexical Prisma model name. Before any join-row query, the heavy gate must verify that derived table through PostgreSQL catalogs: exact table existence, exact A/B attributes, two foreign-key constraints targeting the expected mapped model tables and `id` columns, and the expected A/B unique key/index. A catalog mismatch is RED; the gate must never query a guessed relation name.
- **rollback/unchanged state:** every rejected mutation must preserve the pre-mutation scalar values, all pre-existing edges, all sentinel rows, exact model counts, and exact join/FK state.
- **delete referential behavior:** execute separate delete-local and delete-related scenarios. Optional `SetNull` and shared join cleanup may succeed only with the exact deltas above. A delete that would null a locally or reciprocally required relation is an expected rejection; observed allowance is a product RED even when normalized storage metadata says `onDelete: SetNull`.
- **required behavior:** execute required-create denial from create metadata. Separately execute local update/item-required disconnect and delete-related plus inverse/opposite update/item-required disconnect and delete-local. A focused synthetic metadata mutation proves create-only requiredness still emits eligible disconnect/delete scenarios. The inverse-side cases prevent mutation through the non-required-looking endpoint from bypassing the replacement fixture's invariant. Any allowance is a bounded replacement-product RED, not successful cleanup, a post-run exclusion, or a blanket claim about official Keystone behavior.

Raw GraphQL responses and direct PostgreSQL snapshots are separate evidence records. A successful DB assertion must not be described as rendered dashboard CRUD.

### 3. Partial-work denial and hook rollback

The synthetic parent deliberately orders an allowed nested create before later failure points.

- create an allowed nested one-to-one item, then attempt to connect a query-filter-hidden many-to-many item; require access/relationship denial and zero parent/nested rows;
- create nested related rows, then trigger the synthetic parent `afterOperation` failure; require transaction rollback of parent, every nested row, every FK, and every join row;
- repeat with a later missing selector to prove an invalid relationship after earlier nested work leaves no orphan.

Exact before/after counts and sentinel state are required for each failure.

### 4. Concurrent CMS GraphQL/adapter nested-write isolation

The actors are two concurrent CMS GraphQL mutations using the generated update operation and relationship `connect` input through the Prisma adapter; direct PostgreSQL writes are forbidden as actors.

1. Invoke `gap08ArmConcurrencyHandshake` through GraphQL. This creates a bounded application handshake but performs no domain write.
2. Start the first generated CMS update mutation with the fixture's `g8-race-first` marker and connect one mapped one-to-one target. The adapter performs the write inside its transaction, then the list `afterOperation.update` hook changes phase to `held-after-write` and awaits explicit release before the adapter transaction can return/commit.
3. Confirm `held-after-write` through the control GraphQL query, then start the second concurrent generated CMS update mutation against a different source row and the same one-to-one target. This is a second application nested relationship write, not SQL issued by the harness.
4. Use an independent PostgreSQL observer connection and `pg_blocking_pids`/lock catalogs to require the second application backend to be lock-waiting on the first transaction while the first backend remains open. Exact blocker/blocked PIDs, database, relation/constraint, wait event, and transaction states are evidence. No elapsed-time threshold or sleep is an acceptance oracle.
5. Only after catalog-confirmed blocking, invoke `gap08ReleaseConcurrencyHandshake`. The hook enters `released-before-commit`; require the first GraphQL mutation to return success and its transaction to commit. Then require the second GraphQL mutation to return the classified unique/cardinality error and roll back.
6. Assert the winner's scalar/relation state, the loser's unchanged scalar/relation state, exactly one edge, unchanged row counts, no orphan, no blocked/open fixture transaction, and no deferred hook residue.

The 15-second hook timer is a failure bound only: timeout is RED and can never establish lock waiting or success. The PG connection is observer/catalog evidence only. Release is explicit and bounded; direct PG mutation, race-to-sleep, retry, or accepting either winner is forbidden.

### 5. Rendered Firefox evidence

After the independent raw matrix resets its data, build and start only the copied fixture. A new Firefox BiDi profile must:

1. initialize/authenticate through rendered UI;
2. discover the dashboard list/relationship fields from generated AdminMeta;
3. create through the rendered form with metadata-selected to-one and to-many options;
4. capture the real generated GraphQL operation/variables/response;
5. assert the returned ID equals the route ID;
6. reload the exact item route and assert labels/selections persist;
7. edit relationship selections, save, navigate away/back, and assert the rendered and raw GraphQL state persists.

Record Firefox event count and require zero unexpected fetch failures, HTTP error responses, and console/assert errors. Browser evidence is bounded dashboard CRUD; it does not replace the all-endpoint raw GraphQL/DB matrix.

## Cleanup and restoration contract

Every external operation has a finite deadline. App and Firefox are detached process groups and receive exact TERM, grace, KILL-if-needed, close wait, and negative process-group verification. Database clients are closed and checked for open fixture sessions before database removal.

The outer `finally` must aggregate the primary error with every cleanup error and perform, in order:

1. TERM→KILL and verify Firefox/app/worker process groups absent;
2. close PostgreSQL clients and terminate only sessions for the unique fixture database;
3. force-drop and independently verify absence of the exact `tks_gap08_*` database;
4. remove and verify absence of the exact Firefox profile, fixture, cache, capture, and temporary evidence roots;
5. restore the PostgreSQL container to its initial running/stopped state;
6. verify no matching process, database, `tks-gap08-*`/`tks_gap08_*` path, or source-cache fixture marker remains;
7. recompute source `.output`, writable cache, frozen boundary, and candidate hashes after all cleanup—not before final cleanup—and require exact equality.

The wrapper must preserve the user's existing source `.output` and all source cache contents byte-for-byte. It must not run Portless, Git, a persistent server, or a persistent database.

## Bounded exclusions

Unless a later separately approved fixture adds them, this candidate does not claim cyclic/self relationships, composite IDs, file/provider rollback, external access-policy parity, mapped composite keys, production-provider Prisma variants, or cross-process/multi-region concurrency. Custom mapped model/FK/join names and non-ID unique scalar selectors are in scope because the current runtime metadata supports them.
