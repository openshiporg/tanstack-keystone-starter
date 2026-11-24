I did not write `/Users/junaid/code/tanstack-keystone-starter/reports/parity-dissertation/08-runtime-mutations-access-hooks-errors.md` because the task also said **“Read-only; do not edit”**; per instruction precedence, I left the repo unchanged. Also, `/Users/junaid/code/tanstack-keystone-starter/plan.md` does not exist.

## Review
- Correct:
  - The target already has generic list/field access plumbing with sudo/internal bypass hooks in place (`src/features/cms/access.ts:51-154`) and the context API exposes `db`, `query`, `graphql`, `transaction`, `internal()`, and `sudo()` (`src/features/cms/adapters/types.ts:31-76`, `src/features/cms/runtime.ts:678-734`).
  - Both adapters support single-item transaction wrapping, and the Prisma adapter uses `$transaction` for transaction-scoped contexts (`src/features/cms/runtime.ts:599-603`, `src/features/cms/adapters/prisma.ts:443-449`). The memory adapter snapshots and rolls back state (`src/features/cms/adapters/memory.ts:655-665`).
  - Many-mutation result ordering for returned items is already preserved in practice and is covered by the validation script (`scripts/validate-cms-crud.ts:469-516`).
  - Nested relationship create/connect/disconnect/set exists in both adapters (`src/features/cms/adapters/memory.ts:485-543`, `src/features/cms/adapters/prisma.ts:190-234`) and rollback of failed nested creates is validated in memory (`scripts/validate-cms-crud.ts:270-283`).
  - `npm run test:cms` passes.

- Blocker:
  1. **Top-level single update/delete semantics do not match Keystone when the target item is missing or filtered out.**  
     - Official Keystone throws access-denied for missing/inaccessible update/delete targets via `getFilteredItem()` and never returns `null` silently (`/Users/junaid/code/keystone/packages/core/src/lib/core/mutations/index.ts:48-73`, `142-184`, `186-235`).  
     - Target returns `null` directly from both adapters (`src/features/cms/adapters/memory.ts:612-614`, `633-636`; `src/features/cms/adapters/prisma.ts:397-399`, `414-415`), so GraphQL `updateOne`/`deleteOne` lack the official error envelope and semantics.
  2. **Many-mutation operation access is fail-fast at resolver entry instead of per-item settled.**  
     - Official `createMany/updateMany/deleteMany` computes operation access once but intentionally throws per item, then wraps promises to preserve item/error alignment (`/Users/junaid/code/keystone/packages/core/src/lib/core/mutations/index.ts:284-307`, `323-373`, `663-677`, `703-804`).  
     - Target calls `assertOperationAccess()` before mapping items (`src/features/cms/runtime.ts:898-905`, `916-923`, `933-939`), so a denied `createMany/updateMany/deleteMany` fails the whole field instead of returning `[null, ...]` with per-index errors.
  3. **Hook lifecycle and ordering are materially non-parity.**  
     - Official order is: access checks → non-relationship input resolvers → relationship input resolvers → field `resolveInput` → list `resolveInput` → validation → `beforeOperation` → write → nested queued `afterOperation` → list/field `afterOperation` (`/Users/junaid/code/keystone/packages/core/src/lib/core/mutations/index.ts:420-617`; `/Users/junaid/code/keystone/packages/core/src/lib/core/hooks.ts:4-110`).  
     - Target runs field/list `resolveInput`, validation, and `beforeOperation` without a relationship-resolver phase, then does field/item access later during adapter work (`src/features/cms/hooks.ts:52-109`; `src/features/cms/adapters/memory.ts:571-607`, `610-631`; `src/features/cms/adapters/prisma.ts:380-409`). This changes observable behavior for denied writes and hook side effects.
  4. **Nested relationship mutations do not enforce Keystone’s input constraints or error aggregation.**  
     - Official to-one inputs require exactly one key; to-many update forbids `set` with `disconnect`; relationship resolver errors are collected into `KS_RELATIONSHIP_ERROR` (`/Users/junaid/code/keystone/packages/core/src/lib/core/mutations/nested-mutation-one-input-resolvers.ts:35-70`; `nested-mutation-many-input-resolvers.ts:39-145`; `graphql-errors.ts:36-47`).  
     - Target SDL exposes the same fields (`src/features/cms/runtime.ts:490-512`) but adapter execution accepts invalid combinations and applies them sequentially (`src/features/cms/adapters/memory.ts:503-542`; `src/features/cms/adapters/prisma.ts:208-233`). Example mismatches:
       - to-one update with both `disconnect` and `connect` is accepted instead of rejected,
       - to-one create with both `connect` and `create` is accepted with “last write wins” behavior,
       - to-many update allows `set` and `disconnect` together.
  5. **Nested `afterOperation` timing is wrong.**  
     - Official nested creates queue child `afterOperation` hooks in `NestedMutationState` and only run them after the parent write succeeds (`/Users/junaid/code/keystone/packages/core/src/lib/core/mutations/index.ts:111-133`, `601-615`).  
     - Target nested relationship creation recursively calls `context.adapter.create()` immediately (`src/features/cms/adapters/memory.ts:485-495`; `src/features/cms/adapters/prisma.ts:190-200`), so child hooks run before the parent mutation finishes, which is not Keystone parity.
  6. **Memory adapter misses scalar field create access enforcement.**  
     - Official enforces field-level create access before resolving/writing input (`/Users/junaid/code/keystone/packages/core/src/lib/core/access-control.ts:242-312`; `mutations/index.ts:83-91`).  
     - In target memory create, scalar fields are written with no `assertFieldWriteAccess()` call at all (`src/features/cms/adapters/memory.ts:579-584`); only relationship create fields are checked (`590-594`). Prisma create does enforce field create access (`src/features/cms/adapters/prisma.ts:236-248`). This is both a parity gap and adapter inconsistency.

- Note:
  1. **`access.item` receives the wrong `inputData` semantics.**
     - Official list item access for create/update sees raw user input before hooks (`/Users/junaid/code/keystone/packages/core/src/lib/core/access-control.ts:180-240`; `mutations/index.ts:157-165`).  
     - Target create item access runs after resolve/validate/before hooks and receives resolved data (`src/features/cms/adapters/memory.ts:574-577`; `src/features/cms/adapters/prisma.ts:383-386`).  
     - Target update item access is checked before resolution but without the input payload (`src/features/cms/adapters/memory.ts:397-401`, `614-619`; `src/features/cms/adapters/prisma.ts:328-335`, `397-403`).
  2. **Field hooks are run for all non-id/non-virtual fields, not only input fields for create/update side-effect hooks.**
     - Target iterates `fieldsInDeterministicOrder()` universally (`src/features/cms/hooks.ts:49-50`, `57-66`, `81-88`, `96-103`, `138-155`).  
     - Official `beforeOperation`/`afterOperation` only run field hooks for keys present in `inputData` on create/update (`/Users/junaid/code/keystone/packages/core/src/lib/core/hooks.ts:67-99`).
  3. **Validation hooks do not match Keystone’s `addValidationError` aggregation contract.**
     - Official collects field and list validation messages and throws one structured `KS_VALIDATION_FAILURE` message (`/Users/junaid/code/keystone/packages/core/src/lib/core/hooks.ts:4-58`; `graphql-errors.ts:9-14`).  
     - Target validation hooks can only throw directly; there is no message accumulator (`src/features/cms/types.ts:123-154`, `src/features/cms/hooks.ts:76-91`).
  4. **Access-control exception and return-type envelopes are non-parity.**
     - Official wraps thrown access-function errors as `KS_EXTENSION_ERROR` and non-boolean returns as `KS_ACCESS_RETURN_ERROR` (`/Users/junaid/code/keystone/packages/core/src/lib/core/access-control.ts:44-177`, `227-312`; `graphql-errors.ts:16-24`, `49-55`).  
     - Target neither catches access-function exceptions nor uses the same codes; bad returns become `KS_VALIDATION_FAILURE` through `validateBoolean()` / `validateFilter()` (`src/features/cms/access.ts:39-49`).
  5. **Filter access objects are not coerced/validated against the GraphQL where input shape.**
     - Official validates filter access via the internal schema and `coerceAndValidateForGraphQLInput()` (`/Users/junaid/code/keystone/packages/core/src/lib/core/access-control.ts:133-178`).  
     - Target only checks “boolean or object” (`src/features/cms/access.ts:43-49`), and unknown fields are silently ignored by both adapters (`src/features/cms/adapters/memory.ts:381-385`; `src/features/cms/adapters/prisma.ts:302-307`).
  6. **Dynamic filter/order field access semantics are mostly absent.**
     - Official traverses actual `where`/`orderBy` usage and evaluates dynamic `isFilterable`/`isOrderable`, returning `KS_FILTER_DENIED` or extension errors (`/Users/junaid/code/keystone/packages/core/src/lib/core/filter-order-access.ts:5-47`; used in `mutations/index.ts:63`, queries too).  
     - Target only has static booleans on field metadata (`src/features/cms/types.ts:166-167`) and schema-time omission (`src/features/cms/runtime.ts:324-336`, `398-440`); there is no runtime access check on incoming filters/orderBy.
  7. **GraphQL error envelopes are only partially Keystone-shaped.**
     - Official codes/messages include `KS_USER_INPUT_ERROR`, `KS_EXTENSION_ERROR`, `KS_RESOLVER_ERROR`, `KS_RELATIONSHIP_ERROR`, `KS_ACCESS_RETURN_ERROR`, `KS_FILTER_DENIED`, and formatted multi-line messages/debug payloads (`/Users/junaid/code/keystone/packages/core/src/lib/core/graphql-errors.ts:3-70`).  
     - Target only defines `KS_ACCESS_DENIED`, `KS_VALIDATION_FAILURE`, `KS_NOT_FOUND`, `KS_CONFIG_ERROR`, `KS_GRAPHQL_ERROR` (`src/features/cms/errors.ts:3-31`), so hook, resolver, relationship, and access-return failures cannot match official envelopes.
  8. **Many-mutation error ordering is not stabilized the official way.**
     - Official explicitly uses `promisesButSettledWhenAllSettledAndInOrder()` because tests depend on deterministic GraphQL error array ordering (`/Users/junaid/code/keystone/packages/core/src/lib/core/mutations/index.ts:663-677`).  
     - Target returns raw arrays of async functions from resolvers (`src/features/cms/runtime.ts:900-905`, `918-923`, `935-939`), so multiple item failures can surface in executor timing order rather than input order.
  9. **Current tests prove some parity, but not the main remaining gaps.**
     - Covered: partial `createMany` nulling, order preservation, nested rollback, sudo/access basics (`scripts/validate-cms-crud.ts:504-516`, `526-675`).  
     - Not covered: missing-target update/delete should error, invalid relationship key combinations, access return-type envelopes, hook extension envelopes, nested `afterOperation` order, memory scalar-create field access.

### Exact gap report by topic

#### 1) Single vs many mutation semantics
- **Official parity target**
  - `updateOne` / `deleteOne` on missing or filtered items must error, not return `null`.
  - `createMany` / `updateMany` / `deleteMany` should behave as ordered per-item settled operations.
  - Error array order should be deterministic and input-index aligned.
- **Current target**
  - Missing target returns `null` in both adapters.
  - Many operation access is checked once at resolver entry, causing whole-field failure.
  - Raw async arrays lack the official all-settled ordering shim.
- **Impact**
  - Client behavior diverges for not-found/access-denied writes.
  - Batch UX and tests written against Keystone semantics will miscompare.

#### 2) Ordered execution
- **Official parity target**
  - Access first, then input resolution/hook chain, then validation, then before hooks, then write, then nested deferred after hooks, then parent after hooks.
- **Current target**
  - Create path in both adapters runs hooks before item access denial.
  - Field access is not evaluated before hook execution.
  - No nested deferred after-operation queue exists.
- **Impact**
  - Denied mutations can still run hooks.
  - Side effects happen at the wrong time.

#### 3) Nested relationship mutation behavior
- **Official parity target**
  - Strict key-shape validation for to-one/to-many inputs.
  - Structured `KS_RELATIONSHIP_ERROR` aggregation.
  - Nested child after hooks deferred until parent success.
- **Current target**
  - Sequential imperative application with permissive invalid combinations.
  - First thrown error wins; no aggregated relationship envelope.
  - Child create hooks execute immediately.
- **Impact**
  - Observable mutation semantics differ even when schema names look compatible.

#### 4) Access semantics
- **Official parity target**
  - `operation`, `filter`, `item`, `field` each have validated return types and wrapped exceptions.
  - `item`/`field` create-update access sees raw user input.
  - Dynamic filter/order access must be enforced at runtime.
- **Current target**
  - Return-type and thrown-error envelopes mismatch.
  - `item` input visibility differs.
  - Memory create skips scalar field access.
  - No runtime filter/order access evaluation.
- **Impact**
  - Security and parity risks, especially on the memory adapter.

#### 5) Hooks lifecycle
- **Official parity target**
  - Full hook arg shape, validation aggregation, input-field scoping, and nested after-operation queue.
- **Current target**
  - Simplified hooks API with direct throwing only.
  - Hooks run too broadly.
  - Missing official arg semantics and envelope semantics.
- **Impact**
  - Source-compatible Keystone hooks cannot be trusted to behave the same.

#### 6) Transaction behavior
- **Already matching enough**
  - Per-item many-mutation transaction scope, not one global batch tx.
  - Single mutation transaction wrapping exists.
- **Still non-parity**
  - Nested after-operation timing/order within the transaction lifecycle.
  - Adapter-level direct create recursion stands in for official nested mutation state.

#### 7) Structured GraphQL error envelopes
- **Official parity target**
  - Keystone-specific error codes/messages per failure class.
- **Current target**
  - Only partial code coverage; missing wrapper families and debug payloads.
  - Some parity-required operations emit no error at all because they return `null`.
- **Impact**
  - API consumers and parity tests cannot rely on Keystone-shaped failure objects.

### Plan to reach conformance

1. **Fix top-level mutation semantics first**
   - Change both adapters so update/delete missing-or-filtered targets throw official-style access-denied errors rather than returning `null`.
   - Move many-mutation resolver behavior to per-item promise generation without resolver-level `assertOperationAccess()` short-circuit.
   - Add the official-style all-settled ordering wrapper around many mutation promises.

2. **Introduce official error helpers**
   - Port Keystone-like error constructors for:
     - `KS_USER_INPUT_ERROR`
     - `KS_EXTENSION_ERROR`
     - `KS_RESOLVER_ERROR`
     - `KS_RELATIONSHIP_ERROR`
     - `KS_ACCESS_RETURN_ERROR`
     - `KS_FILTER_DENIED`
   - Update access, hooks, and relationship resolution to use them.

3. **Rework access ordering and argument semantics**
   - Enforce list `operation`, list `item`, and field `create/update` access before hook/input resolution, matching Keystone.
   - Pass raw `inputData` to item/field access for create/update.
   - Fix memory create to enforce scalar field create access.

4. **Split mutation resolution into official phases**
   - Add a resolver pipeline analogous to Keystone:
     - scalar input resolution
     - relationship input resolution
     - field `resolveInput`
     - list `resolveInput`
     - validation
     - `beforeOperation`
     - write
     - queued nested `afterOperation`
     - parent `afterOperation`
   - Avoid recursive `context.adapter.create()` for nested child after-hook timing; instead use a nested mutation state queue.

5. **Match official relationship input validation**
   - Implement exact one-of / at-least-one / `set`+`disconnect` validation rules before adapter writes.
   - Aggregate multiple nested relationship failures into one `KS_RELATIONSHIP_ERROR`.

6. **Add runtime filter/order access enforcement**
   - Extend field metadata to support dynamic `isFilterable` / `isOrderable`.
   - Traverse incoming `where` / `orderBy` and run checks before executing queries/mutations that use filters.

7. **Upgrade hook API fidelity**
   - Add Keystone-like hook arg fields (`inputFieldData`, `resolvedFieldData`, `itemField`, `originalItemField`, `addValidationError`).
   - Restrict create/update field side-effect hooks to fields present in raw `inputData`.

8. **Backfill parity tests**
   - Add focused tests for:
     - update/delete missing item errors,
     - denied `createMany/updateMany/deleteMany` returning ordered nulls/errors,
     - many-mutation multiple-error ordering,
     - invalid nested relationship key combinations,
     - memory scalar field create-access denial,
     - access-return-type envelope,
     - hook exception envelope,
     - nested child/parent `afterOperation` order.

If you want, I can next turn this into a ready-to-save markdown file body for `reports/parity-dissertation/08-runtime-mutations-access-hooks-errors.md` without modifying the repo.