# Relation Constraint / Index Metadata Scope

## Verdict
Named **relation constraint/index metadata** is currently **out of scope locally**.

This repo supports and proves several adjacent relationship and index surfaces:
- owned-side FK mapping via `db.foreignKey.map`
- field-level uniqueness/index semantics where they are part of field config
- descriptive many-to-many metadata (`relationName`, `joinTableName`, side-aware join labels, related-list mapping, ID-kind/scalar metadata, referenced DB column invariants)
- explicit proof that many-to-many metadata stays shared/descriptive and does not invent owned FK or owned relation-arg metadata

It does **not** expose a local config/runtime/schema surface for:
- named relation constraint metadata
- named relation index metadata
- provider/relation-mode metadata for relationships
- explicit user-level control of many-to-many physical constraint/index naming

## Evidence

### Upstream Keystone inspection
Relevant upstream files inspected:
- `packages/core/src/types/next-fields.ts`
- `packages/core/src/lib/core/prisma-schema-printer.ts`

What upstream clearly exposes in the contract we are porting:
- field/index semantics on scalar fields
- owned-side relation-id field/index generation
- owned-side FK mapping
- many-side `relationName`

What upstream does **not** expose here as a first-class local contract surface we can honestly port 1:1:
- user-configurable relation constraint names
- user-configurable relation index names for many-to-many relations
- named physical many-to-many constraint/index surfaces in the local runtime/admin metadata contract

### Local repo inspection
Relevant local files inspected:
- `src/features/cms/types.ts`
- `src/features/cms/config.ts`
- `src/features/cms/prisma-schema.ts`
- `src/features/cms/fields/index.ts`
- `scripts/validate-cms-config.ts`
- `scripts/validate-cms-prisma-schema.ts`

Local repo currently supports/proves:
- scalar/index semantics through field config (`isIndexed`, `isUnique`)
- owned-side FK metadata and Prisma schema output
- descriptive many-to-many relationship metadata
- no named relation constraint/index metadata surface

### Existing proof that narrows the adjacent scope
- `scripts/validate-cms-config.ts`
  - proves mapped many-to-many remains shared/descriptive
  - proves no invented `foreignKeyFieldName`, `foreignKeyMap`, `relationArgs`, `onDelete`, or `onUpdate` on mapped many-to-many pairs
- `scripts/validate-cms-prisma-schema.ts`
  - proves representative mapped/mapped-autoincrement many-to-many schema output

## Honest boundary
If future local goals require named relation constraint/index metadata, that needs a **new real config/runtime/schema surface** plus focused proof.

Until then, constraint/index naming remains owned by Prisma/upstream internals rather than this repo's current local parity contract.
