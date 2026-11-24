# Backend/Runtime Keystone Parity Live Comparison

Scope: backend/runtime only (config surface, auth/session runtime, context API, GraphQL CRUD semantics, access/hook execution, adapter behavior), comparing:
- **Current**: `/Users/junaid/code/tanstack-keystone-starter`
- **Reference app**: `/Users/junaid/code/next-keystone-starter`
- **Official Keystone core**: `/Users/junaid/code/keystone`

---

## Executive verdict

`tanstack-keystone-starter` has a **working Keystone-like runtime kernel** (custom config/list/group, CRUD GraphQL generation, auth graph extension, context db/query APIs, Prisma+memory adapter, hooks/access pipeline), and it already mirrors much of the `next-keystone-starter` app’s backend behavior.

But parity with **official Keystone runtime contracts is partial**. Biggest backend gaps are:
1. **Storage runtime (image/file pipeline) is missing**
2. **Context capability surface is reduced** (`internal`, `withRequest`, first-class `transaction` API missing)
3. **Config normalization/defaulting is much narrower than official**
4. **Mutation execution semantics differ in key spots (especially many-mutation transactionality and error behavior)**

---

## Gap matrix (brutally concrete)

Legend: ✅ Match, 🟡 Partial, ❌ Missing

| Area | Status | TanStack source | Target reference | Concrete gap |
|---|---|---|---|---|
| Keystone entrypoint shape (`export default config`) | ✅ | `keystone.ts:1` -> `cms.config.ts` | `next-keystone-starter/keystone.ts:1-3` | Same app-level entry pattern. |
| App-level auth + initFirstItem + sessionData wiring | ✅ | `cms.config.ts:33-82` | `next-keystone-starter/features/keystone/index.ts:25-97` | Structurally equivalent for listKey/identity/secret/initFirstItem/sessionData/extendGraphqlSchema. |
| Password reset link auth extension | ❌ | (none in `cms.config.ts` / custom auth) | `next-keystone-starter/features/keystone/index.ts:46-51`; official auth package | `passwordResetLink.sendToken` hook exists in next app, not implemented in custom auth runtime. |
| Storage config passthrough in config type | 🟡 | `src/features/cms/config.ts` (`storage?: Record<string, unknown>`) | official config has typed storage strategies + field runtime integration | Type admits storage, but runtime does not consume it for image/file operations. |
| `config/list/group` API existence | ✅ | `src/features/cms/keystone/core.ts:1-21`, `src/features/cms/config.ts:44-77` | `keystone/packages/core/src/index.ts:1-9`, `schema.ts:189-213` | Present and usable. |
| `group()` behavior | 🟡 | `src/features/cms/config.ts:62-77` | `keystone/packages/core/src/schema.ts:189-209` | Custom group injects `fieldMeta.group`; official injects `__group*` synthetic fields + ui group config semantics. |
| Config defaults/validation depth | 🟡 | `src/features/cms/config.ts:95-189` | `keystone/packages/core/src/schema.ts:18-162` | Official validates reserved `fields.id`, singleton/id conflicts, server/graphql/ui/db defaults; custom has lighter list normalization only. |
| ID field policy | 🟡 | `normaliseList()` auto-adds id field (`config.ts:126-142`) | official supports `db.idField`, singleton numeric id (`schema.ts:47-55,96,126`) | No `db.idField` configurability or singleton id policy parity. |
| Generated CRUD schema surface | 🟡 | `src/features/cms/runtime.ts:36-175` + generation functions | official query/mutation schema builders in core | Strong coverage for common CRUD/filter/order types, but not full Keystone field/input nuance. |
| Context GraphQL APIs (`raw`, `run`) | ✅ | `runtime.ts` build context GraphQL API (`graphql.raw/run`) | official `createContext.ts:63-77` | Equivalent core behavior. |
| Context DB & query APIs per list | ✅ | `runtime.ts` builds `db[list]` + `query[list]` | official `createContext.ts:136-142` | Present with find/create/update/delete/count operations. |
| Context privilege escalation (`sudo`) | ✅ | `runtime.ts` context `sudo()` | official `createContext.ts:123-126` | Present. |
| Context `internal()` mode | ❌ | (absent) | official `createContext.ts:124-125` | No separate internal schema/context mode. |
| Context `withRequest()` | ❌ | (absent) | official `createContext.ts:105-117` | No request rebinding + session re-evaluation helper. |
| Context-level transaction API | ❌ | only adapter-level transaction plumbing | official `createContext.ts:85-98` `context.transaction(...)` | Missing first-class `context.transaction`. |
| Access control layers (operation/filter/item/field) | ✅ | `src/features/cms/access.ts:58-191` | official access-control pipeline (`lib/core/access-control.ts`) | All four layers modeled, including filter-object support. |
| Hook pipeline presence | ✅ | `src/features/cms/hooks.ts:54-172` | official hooks pipeline in mutations core | resolveInput/validate/before/after/create/update/delete hooks implemented. |
| Mutation access+hooks ordering | 🟡 | `adapters/prisma.ts:303-316`, `317+` | official `mutations/index.ts` | Generally aligned, but not proven identical across all edge cases/errors. |
| Many mutation execution (createMany/updateMany/deleteMany) transaction semantics | 🟡 | `runtime.ts` list resolvers map to per-item operations; db API loops per item | official batches with shared nested mutation state / consistent error semantics | Custom executes per-item operations individually; may diverge in all-or-nothing behavior and error aggregation. |
| Relationship nested write support | 🟡 | `adapters/prisma.ts:124-168` | official nested resolvers (`nested-mutation-*-resolvers.ts`) | Supports connect/create/set/disconnect basics; official handles richer nested mutation validation/error typing. |
| Relationship read resolution | ✅ | `adapters/prisma.ts:264-320+` resolveRelationship | official resolver path | Implemented (include-based hydrate + FK fallback). |
| Auth GraphQL extension (authenticate/endSession/authenticatedItem/createInitial) | ✅ | `src/features/cms/auth/graphql.ts:67-149` | official auth schema behavior | Core auth mutations/queries implemented. |
| Session strategy abstraction | ✅ | `adapters/types.ts`, `auth/session.ts` usage | official `@keystone-6/core/session` concept | Present (get/start/end). |
| Dev auth fallback shims | 🟡 | `runtime.ts` includes `x-cms-user-id` and admin fallback | not official behavior | Useful for dev; runtime behavior intentionally diverges from production Keystone defaults. |
| Prisma delegate preflight | ✅ | `adapters/prisma-preflight.ts` (referenced by `prisma.ts:10,273`) | official relies on compiled Prisma client/list init | Good safety check for model-delegate presence. |
| Image field backend runtime parity | ❌ | current image kind treated as JSON-ish scalar mapping (`runtime.ts:224-247`, `prisma.ts:80`) | official image runtime with upload processing/storage/delete hooks (`packages/core/src/fields/types/image/index.ts:1-220`) | No Upload scalar pipeline, no metadata extraction, no storage put/delete lifecycle. |
| File upload backend runtime | ❌ | (no equivalent runtime) | official file/image field runtime in core | Missing upload transport + storage lifecycle integration. |

---

## What already matches next-keystone-starter backend behavior

1. **Main app config structure is mirrored** (auth, stateless session, lists, graphql extension):
   - TanStack: `cms.config.ts:33-82`
   - Next starter: `features/keystone/index.ts:25-97`

2. **`redirectToInit` GraphQL extension exists in both**:
   - TanStack: `cms.config.ts:9-26`
   - Next starter: `features/keystone/mutations/index.ts:1-20`

3. **Access-rule compatible model layer exists** (User/Todo/etc declarations + granular access rules):
   - TanStack example: `src/features/cms/models/User.ts`
   - Next starter example: `features/keystone/access.ts`

---

## High-risk parity mismatches (backend/runtime)

1. **Storage/image runtime is not real Keystone-equivalent**
   - You can declare `image` fields in models, but runtime treats image values like generic JSON-ish values.
   - Official Keystone image runtime performs upload stream handling, metadata extraction, storage put/delete, and hooks (`packages/core/src/fields/types/image/index.ts`).

2. **Context contract mismatch may break ecosystem expectations**
   - Missing `internal()`, `withRequest()`, and `context.transaction()` narrows compatibility with code written for Keystone context idioms.

3. **Mutation batching semantics may differ under failure**
   - `createMany/updateMany/deleteMany` currently operate through per-item flows; official has deeper coordinated mutation machinery. Expect behavior drift in partial failure + hook timing + nested relation edge cases.

4. **Config schema under-specification**
   - Official defaults and validations for `server/graphql/ui/db` are broad; custom runtime currently normalizes mainly list metadata.

---

## Exact files most likely to need changes (implementation phase)

1. `src/features/cms/config.ts`
   - Expand config shape/defaulting/validation toward Keystone semantics.

2. `src/features/cms/runtime.ts`
   - Add context API parity (`internal`, `withRequest`, `transaction`), and align many-mutation behavior.

3. `src/features/cms/adapters/prisma.ts`
   - Align nested mutation + relationship write semantics and error behavior with official core.

4. `src/features/cms/fields/*` + `src/features/cms/runtime.ts` GraphQL type generation
   - Introduce true upload/storage field runtime (image/file).

5. `src/features/cms/auth/graphql.ts` and `src/features/cms/keystone/auth.ts`
   - Add password reset link workflow parity and any missing auth edge cases.

6. `cms.config.ts`
   - Re-enable/storage config once storage runtime exists; currently absent vs next starter.

---

## Recommended implementation order (backend/runtime only)

1. **Context contract parity first**
   - Implement `context.transaction`, `internal`, `withRequest` (low surface area, high compatibility impact).

2. **Storage/image runtime foundation**
   - Add Upload scalar handling + image/file field backend pipeline; this is the largest functional gap.

3. **Mutation semantics hardening**
   - Align many-mutation and nested relationship semantics with official failure/transaction model.

4. **Config/defaulting/validation expansion**
   - Backfill Keystone-like config guards/defaults (`db`, `graphql`, `server`, `ui`, id behavior).

5. **Auth parity polish**
   - Add password reset link/sendToken path and verify session edge-case parity.

6. **Final parity pass against next-keystone-starter use-cases**
   - Run scenario checks for init flow, auth, access filtering, relationship CRUD, image lifecycle.

---

## File evidence index

- TanStack
  - `/Users/junaid/code/tanstack-keystone-starter/keystone.ts`
  - `/Users/junaid/code/tanstack-keystone-starter/cms.config.ts`
  - `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/config.ts`
  - `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/runtime.ts`
  - `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/access.ts`
  - `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/hooks.ts`
  - `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/adapters/prisma.ts`
  - `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/auth/graphql.ts`
  - `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/keystone/auth.ts`

- Next starter
  - `/Users/junaid/code/next-keystone-starter/keystone.ts`
  - `/Users/junaid/code/next-keystone-starter/features/keystone/index.ts`
  - `/Users/junaid/code/next-keystone-starter/features/keystone/mutations/index.ts`
  - `/Users/junaid/code/next-keystone-starter/features/keystone/access.ts`

- Official Keystone
  - `/Users/junaid/code/keystone/packages/core/src/index.ts`
  - `/Users/junaid/code/keystone/packages/core/src/schema.ts`
  - `/Users/junaid/code/keystone/packages/core/src/lib/context/createContext.ts`
  - `/Users/junaid/code/keystone/packages/core/src/lib/core/mutations/index.ts`
  - `/Users/junaid/code/keystone/packages/core/src/fields/types/image/index.ts`
