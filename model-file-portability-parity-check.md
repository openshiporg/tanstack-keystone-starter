# Model File Portability/Parity Check

## Scope
Compared current `tanstack-keystone-starter` CMS model/runtime against:
- `next-keystone-starter` model files (`features/keystone/models/*`)
- official Keystone starter patterns (`keystone/packages/create/starter/schema.ts`)

Goal: determine whether Keystone model files can be copied with only import rewrites, and identify exact blockers (especially for Openfront/NKS model portability).

---

## Executive verdict
**Mostly yes for many list files, but not yet “drop-in Keystone model parity.”**

You can usually port NKS/Keystone list files by changing imports to local wrappers (`../keystone/core`, `../keystone/fields`, etc.).

However, true portability still breaks for Keystone features that rely on:
1. Keystone-specific field/runtime semantics not implemented in this runtime, or
2. Keystone config-level features (e.g. storage backends) that current runtime only treats as metadata.

So: **import-only migration works for a constrained subset of models** (core scalar/relationship fields + list/field access/hooks patterns already implemented), but **fails for richer Keystone-native constructs**.

---

## What already ports cleanly (import-change only)

### 1) List + field construction surface is intentionally Keystone-like
- `list`, `group`, `config` wrappers: `src/features/cms/keystone/core.ts`
- field exports mirroring Keystone names: `src/features/cms/keystone/fields.ts`
- document wrapper: `src/features/cms/keystone/fields-document.ts`

This lets NKS-style model syntax copy over with import rewrites.

### 2) NKS model patterns are already proven in-tree
Current TSK models are near-direct Keystone/NKS style equivalents:
- `src/features/cms/models/User.ts`
- `src/features/cms/models/Role.ts`
- `src/features/cms/models/Todo.ts`
- `src/features/cms/models/TodoImage.ts`

They use typical Keystone constructs:
- list-level access (`operation`, `filter`, `item`)
- field-level access (e.g. password read/update restrictions)
- field hooks (`resolveInput`)
- list hooks (`validateDelete`, `beforeOperation`, `afterOperation`)
- grouped fields (`group({...fields})`)
- relationship UI metadata (`displayMode`, `inlineCreate`, etc.)

### 3) Runtime supports many key mutation/auth/context slices already
Runtime/adapter paths show support for:
- access enforcement + filters
- nested relationship create/connect/disconnect/set
- where unique resolution
- many mutations
- hook pipeline
- password hashing

Key code:
- GraphQL runtime type/input/filter generation: `src/features/cms/runtime.ts` (esp. lines ~214-330)
- Prisma write/filter mapping: `src/features/cms/adapters/prisma.ts` (esp. lines ~72-204)

---

## Exact blockers to full model-file portability/parity

## A) `virtual` field parity is missing (major for some real Keystone schemas)
**Blocker:** no `virtual()` field factory in local field wrappers; runtime explicitly excludes virtual fields from inputs/uniques/output generation pathing.
- `FieldKind` includes `'virtual'` (`src/features/cms/types.ts`), but no `virtual` export in `src/features/cms/fields/index.ts`.
- Runtime skips virtual in key places (`src/features/cms/runtime.ts`: around lines 230, 267, 287).

Impact:
- Any NKS/Openfront model using Keystone `virtual({...graphql.field(...)})` cannot be copied as-is with import changes.

## B) File/storage/image backend semantics are not Keystone-equivalent
**Blocker:** `image({ storage: '...' })` is treated as metadata/json-like shape, not Keystone storage strategy execution.
- Field factory stores `storage` in field metadata (`src/features/cms/fields/index.ts`: lines 53-75, 68).
- Prisma treats `image` as JSON-ish payload (`src/features/cms/adapters/prisma.ts`: line ~80).
- GraphQL treats `image` as `JSON` scalar (`src/features/cms/runtime.ts`: lines ~224, 246, 271).

In official Keystone, storage is operational (upload handling, delete old assets, URL resolvers, etc.).

Impact:
- Models from Openfront/NKS that depend on real upload/storage behavior are not portable by import changes alone.
- They may compile but not functionally match Keystone behavior.

## C) Scalar fidelity differs from Keystone/Prisma native types
**Blocker:** decimal/bigInt/select/timestamp are largely represented through string-centric GraphQL/filter abstractions.
- `fieldOutputType` maps many types to `String`/`JSON` (`runtime.ts` ~214+).
- Prisma schema printer maps `decimal` and `bigInt` to `String`; multiselect/image/document/json to `Json` (`src/features/cms/prisma-schema.ts`: `scalarPrismaType`).

Impact:
- Models expecting Keystone’s native scalar semantics (especially numeric precision or BigInt behavior) may have behavioral mismatches.
- Portability “works syntactically” but not parity-level behavior.

## D) Keystone config-level features beyond list files are not fully equivalent
Even if list files copy, Keystone projects often require matching `config({...})` ecosystem:
- storage config strategies
- Admin UI/view packages and custom field view runtime
- some Keystone-specific GraphQL extension idioms

Current config has a `storage?: Record<string, unknown>` slot (`src/features/cms/config.ts`) but no Keystone-equivalent storage execution pipeline.

Impact:
- Openfront/NKS migrations involving non-trivial Keystone config cannot be solved by model file import rewrites alone.

## E) Relationship ownership/relation naming edge cases may require explicit db hints
TSK Prisma printer determines relation ownership with custom heuristics and optional `db.relationName` (`src/features/cms/prisma-schema.ts`).

Impact:
- Complex copied schemas with ambiguous/multiple relations between same models may require manual `db.relationName` adjustments or Prisma-level verification.

---

## Can copied Keystone model files work with only import changes?

### Yes (current likely-safe subset)
- Lists using: `text`, `password`, `checkbox`, `select`, `multiselect`, `integer`, `float`, `decimal`, `bigInt`, `timestamp`, `json`, `document`, `relationship`, `image` (as data field)
- Typical list/field access controls
- List + field hooks used in NKS todo/auth patterns
- Grouped fields and UI metadata declarations

### No / not parity-safe without further runtime work
- `virtual` fields
- Real Keystone storage/upload lifecycle expectations for `image`/`file`
- Keystone-precise scalar/runtime semantics for decimal/bigint/timestamp beyond current string/json abstraction
- Keystone config ecosystems that rely on official runtime internals

---

## Exact blockers for Openfront/NKS model files (actionable checklist)

- [ ] **Add Keystone-like `virtual` field support** (factory + GraphQL/output/input behavior).
- [ ] **Implement operational storage layer parity** (not just metadata): upload handlers, persisted asset references, URL resolution, cleanup semantics.
- [ ] **Decide scalar parity target** for `decimal`, `bigInt`, `timestamp` and align GraphQL + Prisma mapping.
- [ ] **Audit Openfront models for file/image expectations** (if they rely on Keystone Storage API, current runtime is a hard blocker).
- [ ] **Validate relation conflicts** in imported schemas; enforce/require explicit `db.relationName` where ambiguous.
- [ ] **Document “portable subset” contract** for contributors: which Keystone field/config features are guaranteed import-only portable.

---

## Bottom line
Current TSK is **close to Keystone-style authoring ergonomics** and already supports many auth/context/mutation primitives, but **is not yet full Keystone model portability parity**. For Openfront/NKS, import-only copying is realistic for simpler list files; anything relying on `virtual` or real storage behavior remains a concrete blocker.