# Full Keystone Parity Dissertation

Date: 2026-05-12  
Target: `/Users/junaid/code/tanstack-keystone-starter`  
Baselines:  
- Product baseline: `/Users/junaid/code/next-keystone-starter`  
- Official runtime baseline: `/Users/junaid/code/keystone`

---

## 1) Executive verdict

`tanstack-keystone-starter` has evolved into a meaningful Keystone-like system, but is still not parity-complete against either the Next starter UX or official Keystone backend semantics.

**Current state**:
- **Dashboard route surface**: mostly present
- **Dashboard behavior/controller parity**: partial
- **Backend CRUD runtime**: substantial but still divergent in semantics
- **Auth/session/reset**: implemented in custom form, still non-parity in security/runtime details
- **Prisma/storage/schema split/errors**: improved but still materially divergent

**Bottom line**: this is a strong custom CMS runtime inspired by Keystone, not yet a drop-in parity-equivalent Keystone stack.

---

## 2) Method and evidence sources

This audit combines direct code reads and existing internal parity artifacts.

### Primary direct reads used in this pass
- `tanstack-keystone-starter/cms.config.ts`
- `tanstack-keystone-starter/src/features/cms/config.ts`
- `tanstack-keystone-starter/src/features/cms/runtime.ts` (notably lines 1-260 and 520-740)
- `tanstack-keystone-starter/src/features/cms/auth/graphql.ts` (lines 1-230)
- `tanstack-keystone-starter/src/features/cms/adapters/prisma.ts` (lines 1-260)
- `next-keystone-starter/keystone.ts`

### Prior in-repo audit artifacts incorporated
- `official-keystone-parity-gap-report.md`
- `backend-parity-readiness-review.md`
- `reports/dashboard-full-parity-dissertation.md`

### Official Keystone reference areas (baseline)
- `keystone/packages/core/src/schema.ts`
- `keystone/packages/core/src/lib/system.ts`
- `keystone/packages/core/src/lib/core/initialise-lists.ts`
- `keystone/packages/core/src/lib/core/mutations/index.ts`
- `keystone/packages/core/src/lib/context/createContext.ts`
- `keystone/packages/core/src/session.ts`
- `keystone/packages/core/src/admin-ui/*`
- `keystone/packages/core/src/fields/types/*`

---

## 3) High-level parity scorecard

| Domain | Parity vs Next starter | Parity vs official Keystone | Severity |
|---|---:|---:|---|
| Dashboard routes | High | N/A | Medium |
| Dashboard UX/controller architecture | Low-Mid | N/A | **High** |
| Auth/init/reset UX behavior | Mid | Mid-Low | **High** |
| Config/list/field DSL | Mid (custom compatible) | Mid-Low | **High** |
| CRUD GraphQL surface | Mid-High | Mid | Medium |
| CRUD semantics (errors/hooks/access edge cases) | Mid | Low-Mid | **High** |
| Access control model | Mid | Mid-Low | **High** |
| Context/sudo/internal split | Mid | Mid-Low | **High** |
| Session/auth security semantics | Mid | Low-Mid | **Critical** |
| Prisma generation/migrations parity | Mid | Low-Mid | **High** |
| Storage/upload/image/file parity | Low | Low | **Critical** |
| Internal/public schema split fidelity | Mid-Low | Low-Mid | **High** |

---

## 4) Dashboard parity (UX/routes/components/field views/filtering/sorting/create/item/edit)

## 4.1 Routes
**What exists** in TanStack:
- `src/routes/dashboard/index.tsx`
- `src/routes/dashboard/$listKey.tsx`
- `src/routes/dashboard/$listKey.create.tsx`
- `src/routes/dashboard/$listKey.$id.tsx`
- `src/routes/dashboard/signin.tsx`
- `src/routes/dashboard/signup.tsx`
- `src/routes/dashboard/reset.tsx`
- `src/routes/dashboard/init.tsx`
- `src/routes/dashboard/no-access.tsx`

**Gap**: route presence is strong, but route behavior and state lifecycles still differ from source App Router + action architecture in `next-keystone-starter/features/dashboard/*`.

**Severity**: Medium

## 4.2 Dashboard shell/components
TanStack equivalents exist (e.g., `src/components/dashboard/dashboard-shell.tsx`, `dashboard-sidebar.tsx`, `page-container.tsx`, `filter-bar.tsx`, `keystone-list-table.tsx`), but Next starter has a richer provider/hook/action ecosystem under `features/dashboard/components`, `context`, `hooks`, and `actions`.

**Gap**:
- Incomplete provider stack parity
- Reduced error-boundary/controller composition parity
- AI/dual-sidebar feature gap

**Severity**: High

## 4.3 Field views and controller registry parity
Next starter includes full field view registry and type-specific controllers under:
- `next-keystone-starter/features/dashboard/views/**`
- `next-keystone-starter/features/dashboard/utils/enhanceFields.ts`
- `next-keystone-starter/features/dashboard/components/Fields.tsx`

TanStack still renders many flows in simplified/custom ways rather than full controller parity.

**Impact**: directly limits create/edit/filter UX parity and long-term maintainability.

**Severity**: **Critical**

## 4.4 Filtering/sorting/list controls
TanStack runtime defines generic filter/order GraphQL inputs in `src/features/cms/runtime.ts:36-175` and field filter typing logic in `runtime.ts:250-260` onward, but dashboard-level query grammar and advanced UX in Next starter are richer (`features/dashboard/lib/buildWhereClause.ts`, `buildOrderByClause.ts`, filter components).

**Gap**:
- Advanced filter grammar/state parity incomplete
- Some list controls, bulk and edge behavior differ

**Severity**: High

## 4.5 Create/item/edit flows
Routes exist, but parity of behavior (dirty tracking, per-field controller behavior, advanced relationship/document/image interactions) remains behind Next starter’s screen/action architecture.

**Severity**: **Critical**

---

## 5) Backend runtime parity (config/list/field DSL through schema/mutations/errors/security)

## 5.1 Config/list/group DSL
TanStack has Keystone-like APIs in:
- `src/features/cms/config.ts` (`config`, `list`, `group`, `normaliseList`, defaults)
- `cms.config.ts` using `createAuth`, `statelessSessions`, `config`

This is meaningful progress toward Keystone ergonomics, but still not full official initialization pipeline parity.

**Reference contrast**: official `keystone/packages/core/src/schema.ts` + initialized system path in `lib/system.ts`/`initialise-lists.ts`.

**Severity**: High

## 5.2 GraphQL schema and semantics
TanStack runtime builds schema dynamically in `src/features/cms/runtime.ts`, including:
- Common scalars/meta/types (`runtime.ts:36-175`)
- Field output/input/filter typing (`runtime.ts:214+`)
- CRUD resolvers and context API integration (`runtime.ts:520+`, `buildCrudResolvers` around `runtime.ts:651+`)

Good progress includes many mutations and context query/db APIs; however behavior still diverges from official Keystone in mutation lifecycle, error ordering/details, and internal/public distinctions.

**Severity**: High

## 5.3 Access control / hooks
Prisma adapter uses access checks and hooks integration:
- `src/features/cms/adapters/prisma.ts:4-7` imports access/hook engines
- write mapping and mutation paths enforce operation/item/field checks

Still, parity with Keystone’s complete access semantics and lifecycle ordering remains incomplete for all edge cases.

**Severity**: High

## 5.4 Context model, sudo/internal/public schema split
TanStack has richer context than earlier versions:
- `buildCmsContext` exposes `db`, `query`, `prisma`, `graphql.raw/run/schema`, `transaction`, `internal`, `sudo`, `withRequest` (`runtime.ts:546-577` and nearby)

But official Keystone maintains stricter and deeper internal/public schema separation and subtle permission semantics in core context construction (`packages/core/src/lib/context/createContext.ts`, `lib/system.ts`).

**Severity**: High

## 5.5 Auth/session/password reset
TanStack has custom auth GraphQL extension in:
- `src/features/cms/auth/graphql.ts:79-230`
  - `authenticatedItem`
  - `authenticate<User>WithPassword`
  - `endSession`
  - `sendPasswordResetLink`
  - `redeemPasswordResetToken`
  - `createInitialUser`

Password hashing hooks into adapter path (`src/features/cms/adapters/prisma.ts:94-97`).

Major remaining parity/security issues:
- Development fallback auth path in runtime (`src/features/cms/runtime.ts` around `allowDevelopmentAuthFallback`, `createCmsContext`)
- Session strategy semantics still custom and not fully Keystone-equivalent in all security guarantees

**Severity**: **Critical**

## 5.6 GraphQL AdminMeta
AdminMeta is present and exposed via `keystone.adminMeta` types in runtime (`runtime.ts:97-175`), sufficient for current dashboard metadata needs, but not full parity with all Keystone Admin UI assumptions.

**Severity**: Medium

## 5.7 Prisma persistence/generation/migrations
TanStack has adapter preflight and dynamic delegate resolution (`src/features/cms/adapters/prisma.ts:57-66`), plus significant validation infrastructure per existing internal reports.

Remaining parity gaps vs Keystone artifact/generation pipeline:
- Full Keystone artifact lifecycle (`artifacts.ts`, schema generation expectations)
- Broader arbitrary-model proof in real generated Prisma flows

**Severity**: High

## 5.8 Storage/upload/image/file/document
Still materially behind Keystone behavior:
- No full Upload scalar + multipart and storage strategy parity equivalent
- Image/document/file still simplified compared with official field types and storage contexts

**Severity**: **Critical**

## 5.9 Virtual fields/internal-public schema/error/security semantics
Core plumbing exists but strict parity remains incomplete across:
- Virtual field semantics
- Internal vs public schema behavior exactness
- Error typing/codes/order under many-edge cases

**Severity**: High

---

## 6) Concrete difference ledger (selected, highest impact)

1. **Dashboard controller architecture gap**  
   - Missing full parity with Next field view registry/action hooks stack.  
   - Evidence: large source surface in `next-keystone-starter/features/dashboard/views/**` has no equivalent depth.

2. **Create/edit fidelity gap**  
   - Route presence exists, but behavior parity incomplete for complex fields and lifecycle UX.

3. **Auth security semantics gap**  
   - Dev fallback auth behavior still present (`src/features/cms/runtime.ts`, fallback session/header logic), creating divergence from production Keystone expectations.

4. **Storage/upload parity gap**  
   - Official Keystone storage/image/file architecture not fully implemented.

5. **Initialization/system pipeline divergence**  
   - TanStack is custom-initialized; not same as Keystone full initialize-lists/system semantics.

6. **Error semantics divergence**  
   - Many mutation/access/hook edge behaviors not fully Keystone-identical.

---

## 7) Recommended implementation order

## Phase 1 (Critical safety + fidelity)
1. Remove/strictly gate dev auth fallback paths for production parity behavior.
2. Complete storage/upload/image/file/document runtime semantics (Upload, adapters, URLs, metadata).
3. Close create/item edit behavior gaps using a field-controller registry foundation.

## Phase 2 (Core parity semantics)
4. Align hook/access/mutation lifecycle and error semantics closer to official Keystone expectations.
5. Strengthen internal/public schema split behavior and sudo/internal context fidelity.
6. Expand Prisma/artifact/generation validation for dynamic model confidence.

## Phase 3 (Product parity polish)
7. Finish list filtering/sorting/bulk interaction parity in dashboard UX.
8. Complete signup/reset/init UX-policy parity and edge-case testing matrix.
9. Finalize provider architecture/AI-sidebar parity decisions.

---

## 8) Severity map

- **Critical**: auth security semantics, storage/upload parity, create/edit controller architecture
- **High**: hooks/access/error semantic fidelity, internal/public split, Prisma generation parity, advanced list UX parity
- **Medium**: route-level behavioral drifts, AdminMeta detail completeness, shell/provider polish

---

## 9) Final dissertation conclusion

Compared to `next-keystone-starter`, TanStack has strong momentum and a broad functional surface, but is still missing deep UX/controller behavior parity. Compared to official Keystone core, TanStack has built impressive analogs (config DSL, dynamic runtime, auth GraphQL extensions, Prisma adapter transactions/context APIs), yet still diverges in crucial runtime semantics and security/storage fidelity.

The fastest path to credible parity is **not** broad feature accretion; it is disciplined closure of critical layers in order: **security/session hardening → storage/upload fidelity → field-controller create/edit parity → lifecycle/error semantics → schema/internal split exactness**.

Until those are complete, the project should be classified as **advanced Keystone-inspired implementation**, not full Keystone parity.
