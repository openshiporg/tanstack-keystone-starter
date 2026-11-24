# Batch 7 storage/upload/provider/document parity

Date: 2026-05-20

## What changed

Implemented a focused Batch 7 storage/upload/provider/document parity pass, prioritizing practical transport/runtime parity wins from:
- `reports/parity-dissertation/09-runtime-prisma-storage-upload.md`
- `reports/parity-dissertation/10-validation-acceptance-matrix.md`

### 1) Added real HTTP multipart GraphQL upload validation
- Added `scripts/validate-cms-graphql-upload-http.ts`.
- This validates the actual `/api/graphql` Yoga request path with a multipart `FormData` request using the GraphQL upload spec shape (`operations`, `map`, file part), instead of only validating in-process `graphql(...)` execution.
- The test proves the current route stack can accept multipart upload requests and persist bytes through the GraphQL mutation path.
- This closes one of the biggest practical parity gaps identified in the audit: lack of HTTP-level proof for GraphQL uploads.

### 2) Strengthened upload validation coverage by folding the HTTP proof into the normal upload suite
- Updated `package.json` so:
  - `npm run test:cms:upload`
  now runs both:
  - `scripts/validate-cms-graphql-upload.ts`
  - `scripts/validate-cms-graphql-upload-http.ts`
- This means upload parity now has both:
  - in-process GraphQL execution proof
  - route-level HTTP multipart proof

### 3) Hardened storage URL strategy parity with `generateUrl`
- Updated `src/features/cms/storage-url.ts` to honor `storage.generateUrl(path)` when provided.
- This makes the storage URL layer closer to the intended config-driven storage abstraction instead of only supporting the built-in local/S3 fallback URL formats.
- The existing local and basic S3-style URL behavior remains intact.

### 4) Added validation coverage for custom storage URL generation
- Extended `scripts/validate-cms-storage.ts` to verify that `normaliseStoredFileMetadata(...)` respects a custom `generateUrl` function.
- This gives the storage strategy abstraction a concrete regression check rather than leaving `generateUrl` typed-but-unused.

## Exact files changed

- `src/features/cms/storage-url.ts`
- `scripts/validate-cms-storage.ts`
- `scripts/validate-cms-graphql-upload-http.ts` **new**
- `package.json`

## Validations run and results

### Required validations
- `npm run lint` ✅ passed
- `npm run build` ✅ passed

### Targeted storage/upload validations
- `npm run test:cms:storage` ✅ passed
- `npm run test:cms:upload` ✅ passed
- `npm run test:cms` ✅ passed

### What the new proof covers
- local storage metadata generation
- image byte sniffing and dimension extraction
- in-process GraphQL upload mutation behavior
- real HTTP multipart GraphQL upload behavior through `/api/graphql`
- custom `generateUrl` handling in the storage URL layer

## Remaining blockers / follow-up notes

This batch intentionally focused on high-value, safe parity wins and did **not** try to solve every storage/document/provider gap.

### Improved materially in this batch
- HTTP multipart GraphQL upload parity is now proven, not just assumed.
- The storage URL abstraction now honors `generateUrl` instead of ignoring it.
- Upload validation coverage is stronger and closer to how a real client hits the route.

### Still not fully done
- No real S3 byte persistence implementation yet.
- No S3 delete/cleanup implementation yet.
- No signed URL semantics yet.
- File field behavior is still structurally present but not deeply proven through a real starter model or broader fixture matrix.
- Document field is still far from official Keystone document runtime semantics.
- File/image GraphQL input types are still broader than strict official Keystone upload-only input shapes, because tightening that without coordinated UI/runtime changes would risk regressing existing dashboard flows.

### Practical note
This batch closes one of the most visible transport gaps from the audit: the target now has a passing, route-level HTTP multipart GraphQL upload proof. The remaining storage parity work is now more clearly concentrated in provider implementation (especially S3) and deeper field/runtime semantics rather than basic upload transport uncertainty.
