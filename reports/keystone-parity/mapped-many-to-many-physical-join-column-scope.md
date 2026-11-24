# Mapped Many-to-Many Physical Join-Column Scope

## Verdict
Physical mapped many-to-many join-column DB names are currently **out of scope locally**.

This repo supports and proves **descriptive** many-to-many relationship metadata, including:
- relation name / join table name
- side-aware near/far join foreign-key labels
- side-aware related-list Prisma mapping
- side-aware ID-kind and scalar-type metadata
- referenced DB column invariants (`id`)
- explicit proof that mapped many-to-many metadata remains `relationKind: 'manyToMany'`, `ownership: 'shared'`, and does not invent owned FK surfaces (`foreignKeyFieldName`, `foreignKeyMap`, `relationArgs`, `onDelete`, `onUpdate`)

It does **not** expose a local config/runtime/schema surface for:
- mapped near/far physical join-column DB names
- explicit many-to-many join-column `@map(...)` metadata
- many-to-many constraint/index names

## Evidence

### Upstream Keystone surfaces inspected
- `packages/core/src/types/next-fields.ts`
  - exposes owned-side relationship `foreignKey` mapping
  - exposes many-side `relationName`
  - does not expose a first-class local-style many-to-many join-column DB-map surface
- `packages/core/src/lib/core/prisma-schema-printer.ts`
  - prints relation fields and owned-side relation-id fields/indexes
  - does not expose a user-level named many-to-many physical join-column DB-map API surface in the local contract we are porting

### Local surfaces inspected
- `src/features/cms/types.ts`
- `src/features/cms/config.ts`
- `src/features/cms/prisma-schema.ts`

Local repo currently supports/proves:
- owned-side `db.foreignKey.map`
- many-to-many descriptive metadata (`relationName`, `joinTableName`, near/far join keys, scalar types, ID kinds, referenced DB column invariants, `refListPrismaMapping`)
- no physical join-column DB-map config surface for many-to-many
- no named relation constraint/index metadata surface

### Focused local proof already landed
- `scripts/validate-cms-config.ts`
  - reciprocal mapped string-id many-to-many proof
  - reciprocal mapped autoincrement many-to-many proof
  - explicit proof that mapped many-to-many remains shared/descriptive and does not invent owned FK or owned relation-arg metadata
- `scripts/validate-cms-prisma-schema.ts`
  - representative mapped and mapped-autoincrement many-to-many schema output proof

## Honest boundary
If future local goals require physical many-to-many join-column DB mapping, that would need a **new real config/runtime/schema surface** and fresh proof. It should not be inferred from today’s descriptive metadata.
