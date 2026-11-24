# Storage / AdminMeta parity worker

## Scope

This worker owns the remaining applicable portions of REAUDIT A13 and A14. It deliberately did not edit auth, documents, `src/features/cms/keystone/core.ts`, context core, or the Prisma generator.

Oracle reviewed directly: extracted `@keystone-6/core` 6.5.1 sources under `/private/tmp/tanstack-keystone-parity-packages/keystone-6-core-6.5.1/package`, especially:

- `src/lib/assets/local.ts`, `s3.ts`, `createFilesContext.ts`, and `createImagesContext.ts`
- `src/fields/types/file/index.ts` and `image/index.ts`
- `src/lib/create-admin-meta.ts` and `resolve-admin-meta.ts`
- `src/admin-ui/admin-meta-graphql.ts`

## Reconciliation

### A13 — applicable storage behavior

The existing implementation already had executable local upload/image metadata, S3 SigV4 PUT/GET/DELETE, bounded provider failures, GraphQL/HTTP upload, replacement/deletion cleanup, failed-mutation orphan rollback, and upload metadata coverage. The focused validators now additionally lock down two applicable Core contracts that were missing:

- S3 `pathPrefix` is applied consistently to public URLs, signed canonical paths, PUTs, and DELETEs.
- Storage `preserve: true` prevents replacement/deletion lifecycle cleanup.
- Local `generateUrl` now receives Core-compatible leading-slash paths.

`validate-cms-storage.ts` uses a bounded loopback fake S3 endpoint and local temporary files; `validate-gap10-provider-continuity.ts` independently verifies signatures, readback, metadata, timeout/error behavior, delete, multipart upload, and orphan rollback without external credentials.

Intentional differences remain explicit: GraphQL upload streams are buffered up to a configured finite limit rather than piped directly; provider HTTP and errors are Fetch-based rather than AWS SDK classes; target metadata includes a storage key and convenience filename/URL values; DB/object operations cannot be one atomic cross-system transaction. Cleanup is compensating and tested, not distributed transactionality.

### A14 — applicable AdminMeta behavior

The existing runtime already supported list/field/action metadata, groups, custom view indexes, item hydration, contextual field/action modes, search/filter/order capabilities, and singleton metadata. This worker fixed a genuine gap: Core 6.5.1 permits item-aware `itemView.fieldPosition`; the target type and runtime now evaluate it against the selected item, validate its result, and expose it through item-scoped AdminMeta. The search mode type now retains Core's `insensitive` mode.

`validate-cms-actions.ts` now executes a dynamic fixture proving:

- item-dependent field mode and field position,
- ordered search fields and `insensitive` search mode,
- filter/order capability metadata,
- groups and group descriptions,
- custom view indexing,
- item-dependent action visibility/mode and action GraphQL/message metadata.

`validate-cms-admin-meta.ts` remains the broader contextual modes/groups/relationship/field metadata validator.

## Non-applicable Next Admin UI APIs

The following Core public subpaths and lifecycle are intentionally **not applicable** to this TanStack/Vite dashboard and are not claimed as implemented:

- `@keystone-6/core/admin-ui/apollo`
- `@keystone-6/core/admin-ui/router`
- `@keystone-6/core/admin-ui/context`
- `@keystone-6/core/admin-ui/components`
- `@keystone-6/core/admin-ui/image`
- `@keystone-6/core/admin-ui/utils`
- generated Next.js Admin UI pages, webpack/Next field-view bundling, and the Next Admin UI plugin/build lifecycle

The applicable replacement contract is runtime AdminMeta plus target-owned TanStack routes/components. A numeric custom-view index proves metadata ordering only; it is not a claim that Keystone's generated Next module loader exists.

## Verification

Passed on the final focused implementation:

- `npx --no-install tsx scripts/validate-cms-storage.ts`
- `npx --no-install tsx scripts/validate-gap10-provider-continuity.ts`
- `npx --no-install tsx scripts/validate-cms-admin-meta.ts`
- `npx --no-install tsx scripts/validate-cms-actions.ts`
- `npx --no-install tsc --noEmit`
- targeted ESLint over all touched TS files
- targeted Prettier check over all touched TS files

No external S3 credentials, production objects, bucket policy, CDN, deployment, or production DB were used or claimed.
