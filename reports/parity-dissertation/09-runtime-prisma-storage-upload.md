## Review
- Correct:
  - The starter already has a real, config-driven Prisma artifact pipeline, not just a hand-maintained schema. `cms:generate` writes `.cms/schema.prisma`, `.cms/schema.graphql`, admin metadata, and type/runtime helpers from initialized lists (`scripts/cms-generate.ts:72-85`), and the generated Prisma schema currently matches the canonical `prisma/schema.prisma` under the repo’s normalization check (`scripts/compare-cms-prisma-schema.ts:13-21`; verified via `npm run cms:check:prisma`).
  - Prisma delegate mapping is now generic by list key rather than hard-coded to the four starter models: delegate names are derived from list keys (`src/features/cms/adapters/prisma-preflight.ts:15-18`), verified for all initialized lists by preflight (`src/features/cms/adapters/prisma-preflight.ts:24-41`) and by `npm run cms:check:prisma`.
  - The runtime already supports local persisted upload/storage for image fields, including byte-type sniffing and metadata extraction for PNG/GIF/JPEG/WebP (`src/features/cms/storage.ts:58-94`, `137-205`), plus mutation-time `Upload` handling for GraphQL variables (`src/features/cms/runtime.ts:350-366`). Both storage tests and GraphQL upload tests pass (`scripts/validate-cms-storage.ts:11-123`, `scripts/validate-cms-graphql-upload.ts:20-72`; verified via `npm run test:cms:storage` and `npm run test:cms:upload`).
  - The Prisma shape for image fields now mirrors Keystone’s multi-column pattern more closely than earlier audits: generated image fields use `<field>_id`, `_extension`, `_filesize`, `_width`, `_height` (`src/features/cms/fields/index.ts:51-67`, `prisma/schema.prisma:55-59`, `68-72`), matching official Keystone’s image field multi-column approach (`/Users/junaid/code/keystone/packages/core/src/fields/types/image/index.ts:187-196`; `/Users/junaid/code/next-keystone-starter/schema.prisma:57-61`, `71-75`).

- Fixed:
  - None. Read-only audit only.

- Blocker:
  - I did **not** write `/Users/junaid/code/tanstack-keystone-starter/reports/parity-dissertation/09-runtime-prisma-storage-upload.md` because the task also explicitly said **“Read-only; do not edit.”** Per instruction precedence, I left the repo unchanged.
  - `/Users/junaid/code/tanstack-keystone-starter/plan.md` does not exist, so only `progress.md` was available.

- Note:
  - ### Parity dissertation: Prisma / storage / upload / file / image / document

  - #### 1) Prisma schema generation and artifacts

    - **Official Keystone target**
      - Official Prisma schema printing is driven from initialized resolved DB fields, including scalar, enum, multi-field, relation ownership, mapping, native types, defaults, indexes, and whole-schema/list extensions (`/Users/junaid/code/keystone/packages/core/src/lib/core/prisma-schema-printer.ts:63-122`, `195-256`).
      - Official Prisma CLI flow is wrapped so artifacts are validated before Prisma commands run (`/Users/junaid/code/keystone/packages/core/src/scripts/prisma.ts:30-47`).

    - **Current starter**
      - The starter prints a simpler config/list-driven schema via `printCmsPrismaSchema()` (`src/features/cms/prisma-schema.ts:108-112`) and generates `.cms/schema.prisma` via `cms:generate` (`scripts/cms-generate.ts:72-85`).
      - Prisma lifecycle scripts run generation before `migrate:gen`, `dev`, and `build`, but **not** before every Prisma command: `db:generate`, `db:push`, and `migrate` call Prisma directly (`package.json:11-19`, `32-36`).

    - **Gaps vs official**
      1. **No Prisma wrapper parity for deploy/generate/push.**
         - Official Keystone validates artifacts before Prisma CLI execution (`/Users/junaid/code/keystone/packages/core/src/scripts/prisma.ts:30-47`).
         - Starter’s `db:generate`, `db:push`, and `migrate` skip `cms:generate`/`cms:check` (`package.json:12`, `32-33`).
      2. **Schema printer is materially simpler than official.**
         - No support for enum emission, native DB types, `shadowDatabaseUrl`, `@@map`, `@map`, provider-specific scalar typing, or full extension hooks comparable to official printer (`src/features/cms/prisma-schema.ts:16-112` vs official `/lib/core/prisma-schema-printer.ts:63-122`, `195-256`).
      3. **Field type lowering is intentionally lossy.**
         - `decimal` and `bigInt` print as `String`; `document`/`multiselect` print as `Json`; relation ownership is simplified (`src/features/cms/prisma-schema.ts:16-28`, `45-90`).
         - Official Keystone emits actual `Decimal`, `BigInt`, enum/native types, and proper mapped relation ids (`/Users/junaid/code/next-keystone-starter/schema.prisma:45-64`).
      4. **No generated Prisma client path or schema-path parity knobs.**
         - Official printer honors `prismaClientPath` and emits datasource names/provider-specific config (`/Users/junaid/code/keystone/packages/core/src/lib/core/prisma-schema-printer.ts:195-212`).
         - Starter hardcodes default client generator (`src/features/cms/prisma-schema.ts:108-112`).

    - **Net assessment**
      - **Status:** Partial parity.
      - **Confidence:** Good enough for current starter lists; not Keystone-complete as a schema printer/artifact system.

  - #### 2) Delegate mapping and Prisma runtime

    - **What matches well**
      - Delegate lookup is now generic and preflight-validated (`src/features/cms/adapters/prisma-preflight.ts:15-41`).
      - Error messaging instructs promotion/generation flow when delegates are missing (`src/features/cms/adapters/prisma-preflight.ts:30-35`).
      - Temporary arbitrary-model Prisma client validation exists (`scripts/validate-cms-prisma-temp-client.ts:61-113`), which is stronger than earlier parity states.

    - **Remaining gaps**
      1. **Delegate naming assumes lowerCamelCase(listKey).**
         - Works for normal Prisma client delegates, but there is no equivalent to Keystone’s deeper resolved DB field/system model ownership. It is still a convention-based mapping layer (`src/features/cms/adapters/prisma-preflight.ts:15-18`).
      2. **Prisma runtime maps several Keystone field kinds through simplified coercions.**
         - `decimal`/`bigInt` are string-backed, `document` is JSON, timestamp filters are string-based at GraphQL layer (`src/features/cms/adapters/prisma.ts:114-124`; `src/features/cms/runtime.ts:324-347`).

    - **Net assessment**
      - **Status:** Mostly acceptable for current architecture.
      - **Main risk:** not delegate discovery now, but semantic lowering of complex field kinds.

  - #### 3) Migration lifecycle parity

    - **Official Keystone target**
      - Build/validate artifacts before Prisma actions; generated schema is the system of record (`/Users/junaid/code/keystone/packages/core/src/scripts/prisma.ts:30-47`).

    - **Current starter**
      - `migrate:gen` runs `cms:generate && prisma migrate dev` (`package.json:11`).
      - `migrate` is plain `prisma migrate deploy` (`package.json:12`).
      - `db:push` and `db:generate` also run without generation/validation preflight (`package.json:32-33`).

    - **Gap**
      - **Operational drift risk:** CI or deployment can run `migrate`/`db:push` against stale generated artifacts if `cms:generate` was not run first.

    - **Net assessment**
      - **Status:** Partial parity.
      - **Priority:** Medium; mostly lifecycle hardening rather than runtime semantics.

  - #### 4) Local vs S3 storage parity

    - **Official Keystone target**
      - Storage is abstracted as a strategy with `put`, `delete`, and `url` (`/Users/junaid/code/keystone/packages/core/src/types/utils.ts:90-101`).
      - Official file/image fields depend on storage strategy behavior, and the example Next starter uses S3 for `my_images` (`/Users/junaid/code/next-keystone-starter/features/keystone/index.ts:76-87`).

    - **Current starter**
      - Storage config type admits `local` and `s3` (`src/features/cms/storage-config.ts:3-17`).
      - `storageUrl()` can format local and S3-style public URLs (`src/features/cms/storage-url.ts:9-17`).
      - **Actual byte persistence and deletion are local-only.** Non-local storage throws (`src/features/cms/storage.ts:65-69`, `96-101`).
      - Current app config uses local storage for `my_images` (`cms.config.ts:82-88`).

    - **Gaps**
      1. **No S3 `put` implementation.**
         - Runtime throws for any non-local persistence (`src/features/cms/storage.ts:67-69`).
      2. **No S3 delete implementation.**
         - Delete also throws for non-local (`src/features/cms/storage.ts:99-101`).
      3. **No signed URL semantics.**
         - Config type includes `signed.expiry` (`src/features/cms/storage-config.ts:15`) but runtime never uses it.
      4. **No provider-specific credential handling.**
         - `accessKeyId`/`secretAccessKey` are absent from starter storage config type, while source starter S3 config uses them (`/Users/junaid/code/next-keystone-starter/features/keystone/index.ts:18-23`, `76-87`).
      5. **`generateUrl` is typed but unused.**
         - `CmsStorageConfig.generateUrl` exists (`src/features/cms/storage-config.ts:11`) but `storageUrl()` ignores it (`src/features/cms/storage-url.ts:9-17`).

    - **Net assessment**
      - **Status:** Local parity slice only.
      - **Severity:** High if “official Keystone parity” includes source-starter S3 behavior.

  - #### 5) Upload scalar and multipart semantics

    - **Official Keystone target**
      - File/image inputs accept only `upload: Upload` in GraphQL field input types:
        - file: `/Users/junaid/code/keystone/packages/core/src/fields/types/file/index.ts:43-50`
        - image: `/Users/junaid/code/keystone/packages/core/src/fields/types/image/index.ts:52-59`
      - Multipart request handling is configured at server layer via `graphql-upload` middleware (`/Users/junaid/code/keystone/packages/core/src/lib/express.ts:89-106`).
      - The source Next starter explicitly disables body parsing and runs `processRequest` for multipart form-data (`/Users/junaid/code/next-keystone-starter/pages/api/graphql.ts:7-17`).

    - **Current starter**
      - GraphQL schema defines `scalar Upload` and accepts `upload` in `FileFieldInput` / `ImageFieldInput` (`src/features/cms/runtime.ts:38-64`).
      - But those input types also accept metadata fields like `id`, `filename`, `filesize`, `extension`, `storage`, `url`, `width`, `height` (`src/features/cms/runtime.ts:44-64`), which is **not** Keystone parity.
      - Upload scalar is a permissive placeholder; `parseValue` just returns the value (`src/features/cms/runtime.ts:255-265`).
      - Yoga route does not explicitly configure multipart parsing or `graphql-upload` processing (`src/features/cms/graphql.ts:8-14`; `src/routes/api/graphql.ts:5-19`).
      - The runtime compensates by accepting Node-stream-like upload objects directly in execution (`src/features/cms/storage.ts:117-125`, `238-257`) and tests upload via direct `graphql()` execution, not HTTP multipart transport (`scripts/validate-cms-graphql-upload.ts:40-54`).

    - **Gaps**
      1. **No verified HTTP multipart GraphQL transport parity.**
         - There are no route-level multipart tests; current test bypasses HTTP and injects the upload value directly (`scripts/validate-cms-graphql-upload.ts:33-54`).
      2. **Input shape is broader than Keystone.**
         - Official file/image field input is upload-only (`file/index.ts:43-50`, `image/index.ts:52-59`); starter permits metadata injection (`src/features/cms/runtime.ts:44-64`).
      3. **Upload scalar description explicitly advertises a non-Keystone fallback.**
         - It tells callers to use `/api/cms/upload` first (`src/features/cms/runtime.ts:255-257`), while Keystone’s field mutations are intended to consume multipart `Upload` directly.
      4. **No explicit multipart server configuration.**
         - Unlike source starter `processRequest()` path (`/Users/junaid/code/next-keystone-starter/pages/api/graphql.ts:14-17`), target route relies on whatever Yoga/request stack happens to provide.

    - **Net assessment**
      - **Status:** Functional in-process upload semantics; incomplete HTTP multipart parity.
      - **Severity:** High for strict Keystone client compatibility.

  - #### 6) File field behavior parity

    - **Official Keystone target**
      - File field is a storage-backed multi-field with upload-only input and output `{ filename, filesize, url }`, plus cleanup on replacement/delete (`/Users/junaid/code/keystone/packages/core/src/fields/types/file/index.ts:43-81`, `95-153`).

    - **Current starter**
      - Generic field factory supports `file()` and emits Prisma columns `<field>_filesize` and `<field>_filename` (`src/features/cms/fields/index.ts:61-67`, `174-175`).
      - Runtime GraphQL exposes `FileFieldInput` / `FileFieldOutput` (`src/features/cms/runtime.ts:44-70`).
      - Prisma adapter maps file columns into `{ filename, filesize, storage, url }` (`src/features/cms/adapters/prisma.ts:134-142`).
      - Cleanup logic for replaced/deleted file/image fields exists in both adapters through shared helpers (`src/features/cms/file-lifecycle.ts:26-52`; usages in `src/features/cms/adapters/prisma.ts:406-420` and `src/features/cms/adapters/memory.ts:629-648`).

    - **Gap**
      - **There is no real file-field usage in the starter models.**
        - `file()` exists only as a factory export (`src/features/cms/fields/index.ts:174-175`).
        - No list uses it (`grep` found no model usage).
      - So file parity is **structural but unproven**:
        - no model-backed schema coverage,
        - no runtime tests,
        - no end-to-end upload cleanup validation for `file` specifically.

    - **Net assessment**
      - **Status:** Incomplete / latent implementation.
      - **Severity:** Medium-high because behavior is present but unexercised.

  - #### 7) Image field behavior parity

    - **Official Keystone target**
      - Upload-only input, metadata sniffing from stream, storage-backed URL resolver, and cleanup on update/delete (`/Users/junaid/code/keystone/packages/core/src/fields/types/image/index.ts:52-80`, `87-144`, `163-238`).

    - **Current starter**
      - Image Prisma shape is close: id/extension/filesize/width/height columns (`src/features/cms/fields/index.ts:51-60`; `prisma/schema.prisma:55-59`, `68-72`).
      - Stored uploads derive real image metadata from bytes (`src/features/cms/storage.ts:77-94`, `137-205`).
      - GraphQL outputs `{ id, url, extension, filesize, width, height }` (`src/features/cms/runtime.ts:72-79`, `379-391`).
      - Upload tests verify PNG/GIF/JPEG/WebP metadata extraction and local persistence (`scripts/validate-cms-storage.ts:44-117`).
      - GraphQL upload test verifies mutation-driven image persistence and URL output (`scripts/validate-cms-graphql-upload.ts:44-71`).

    - **Gaps**
      1. **Image input accepts metadata injection, not just upload.**
         - Starter `ImageFieldInput` includes non-Keystone fields (`src/features/cms/runtime.ts:54-64`).
      2. **`transformName` signature is weaker than official.**
         - Official image transform gets `(originalFilename, extension)` (`/Users/junaid/code/keystone/packages/core/src/fields/types/image/index.ts:39-40`, `87-90`, `123`).
         - Starter generic field config only types `(originalFilename)` (`src/features/cms/fields/index.ts:24-25`), so extension-aware transforms are not fully representable.
      3. **No stream teeing; upload path buffers whole stream for GraphQL uploads.**
         - Official tees the stream to compute filesize and metadata without fully materializing upload content (`/image/index.ts:109-143`).
         - Starter reads full upload stream into memory via `bytesFromNodeReadable()` before storage (`src/features/cms/storage.ts:121-125`, `254-257`).
      4. **No S3-backed image parity.**
         - Current image behavior is good only for local persistence (`src/features/cms/storage.ts:67-69`).

    - **Net assessment**
      - **Status:** Strong local image parity slice, but not strict official transport/storage parity.

  - #### 8) Document field behavior parity

    - **Official Keystone target**
      - Document field is not plain JSON output. It is a required JSON-backed field with validation/default normalization and outputs an object with `document(hydrateRelationships: Boolean!)` (`/Users/junaid/code/keystone/packages/fields-document/src/index.ts:101-107`, `124-180`).
      - It rejects `null`, applies a default paragraph document, and supports rich relationship hydration metadata in admin meta (`/fields-document/src/index.ts:101-107`, `124-187`).

    - **Current starter**
      - `document()` is just a thin re-export to generic `field('document')` (`src/features/cms/keystone/fields-document.ts:1`; `src/features/cms/fields/index.ts:142-144`).
      - Runtime treats document output as raw `JSON` (`src/features/cms/runtime.ts:295-296`) and input as raw `JSON` (`src/features/cms/runtime.ts:320`).
      - Prisma prints document as nullable `Json` (`src/features/cms/prisma-schema.ts:24`) and current schema has `description Json?` (`prisma/schema.prisma:43`).
      - The Todo model uses document formatting/links/dividers/layout metadata (`src/features/cms/models/Todo.ts:84-93`), but runtime only preserves that metadata in `fieldMeta`; it does not implement official document field behavior.

    - **Gaps**
      1. **No official document GraphQL output type.**
         - Official returns `<List>_<field>_Document { document(hydrateRelationships: ...) }` (`/fields-document/src/index.ts:155-180`).
         - Starter returns raw JSON (`src/features/cms/runtime.ts:295-296`).
      2. **No document validation/normalization.**
         - Official validates structure and rejects `null` (`/fields-document/src/index.ts:101-107`).
         - Starter accepts arbitrary JSON.
      3. **Wrong nullability/default semantics.**
         - Official field is required with default paragraph structure (`/fields-document/src/index.ts:124-139`).
         - Starter schema is nullable JSON for `description` (`prisma/schema.prisma:43`).
      4. **No relationship hydration or component block semantics.**
         - None of the official document field runtime exists in starter.

    - **Net assessment**
      - **Status:** Metadata-only stub.
      - **Severity:** High; document field remains far from official Keystone.

  - #### 9) Cleanup semantics

    - **Official Keystone target**
      - File/image old assets are deleted after successful update/delete via field hooks:
        - file cleanup on changed filename (`/Users/junaid/code/keystone/packages/core/src/fields/types/file/index.ts:95-111`)
        - image cleanup on changed `id`/`extension` (`/Users/junaid/code/keystone/packages/core/src/fields/types/image/index.ts:163-185`)

    - **Current starter**
      - Shared cleanup helpers remove old image/file objects when value changes or item is deleted (`src/features/cms/file-lifecycle.ts:35-52`).
      - Both Prisma and memory adapters invoke cleanup after update/delete (`src/features/cms/adapters/prisma.ts:406-420`; `src/features/cms/adapters/memory.ts:629-648`).

    - **Gaps**
      1. **Cleanup is runtime-helper based, not field-hook native.**
         - Functionally similar, but not architecturally the same as Keystone field-owned hook behavior.
      2. **S3 cleanup is missing because non-local delete is unimplemented.**
         - Any S3-configured field would fail cleanup (`src/features/cms/storage.ts:99-101`).
      3. **No tested file cleanup parity.**
         - Image cleanup path is indirectly covered by structure, but not explicitly tested; file cleanup has no model/test coverage.

    - **Net assessment**
      - **Status:** Good local cleanup semantics for image/file values already persisted in local storage.
      - **Severity:** Medium because provider parity is incomplete.

  - #### 10) Provider-specific differences summary

    - **PostgreSQL / SQLite**
      - Official Keystone uses real `Decimal`, `BigInt`, required document semantics, and richer schema printing.
      - Starter lowers some of these to strings/JSON (`src/features/cms/prisma-schema.ts:16-28`), so provider fidelity is not equivalent.

    - **Local storage**
      - Starter is decent here:
        - local route `/files`,
        - local byte persistence,
        - URL formatting,
        - delete support,
        - image metadata extraction (`src/features/cms/storage.ts:58-108`; `src/features/cms/storage-url.ts:9-13`).

    - **S3**
      - Starter is config-shape only; no actual provider implementation (`src/features/cms/storage.ts:67-69`, `99-101`).

    - **HTTP multipart**
      - Source Next starter explicitly parses multipart requests (`/Users/junaid/code/next-keystone-starter/pages/api/graphql.ts:14-17`).
      - Starter has no equivalent explicit route middleware and no HTTP multipart route test (`src/routes/api/graphql.ts:5-19`; `src/features/cms/graphql.ts:8-14`).

  - #### Recommended staged implementation slices

    - **Slice 1 — Harden Prisma lifecycle parity**
      - Files:
        - `package.json`
        - add/extend `scripts/*` validation wrappers
      - Work:
        1. Make `db:generate`, `db:push`, and `migrate` run `cms:check` or `cms:generate` first.
        2. Decide whether `.cms/schema.prisma` or `prisma/schema.prisma` is the authoritative Prisma CLI schema path.
      - Acceptance:
        - No Prisma command can run against stale generated artifacts.

    - **Slice 2 — Strict Upload input parity**
      - Files:
        - `src/features/cms/runtime.ts`
        - tests under `scripts/validate-cms-graphql-upload.ts` or new HTTP-level upload test
      - Work:
        1. Narrow `FileFieldInput` and `ImageFieldInput` to official `upload: Upload` semantics.
        2. Remove metadata-injection fallback from public GraphQL input surface.
      - Acceptance:
        - File/image mutations accept Keystone-compatible field inputs only.

    - **Slice 3 — Real multipart HTTP transport parity**
      - Files:
        - `src/features/cms/graphql.ts`
        - `src/routes/api/graphql.ts`
        - new upload route/integration tests
      - Work:
        1. Add explicit multipart parsing support equivalent to source-starter `processRequest`.
        2. Verify with an actual HTTP multipart GraphQL request test, not direct `graphql()` execution.
      - Acceptance:
        - A Keystone-style multipart client can upload through `/api/graphql`.

    - **Slice 4 — Introduce storage strategy abstraction**
      - Files:
        - `src/features/cms/storage.ts`
        - `src/features/cms/storage-config.ts`
        - new `src/features/cms/storage/*` provider modules
      - Work:
        1. Split local and S3 implementations behind a common strategy API.
        2. Honor `generateUrl`, `signed`, endpoint/path-style options.
      - Acceptance:
        - Same image/file field runtime works for local and S3 providers.

    - **Slice 5 — S3 provider implementation**
      - Files:
        - new S3 adapter module(s)
        - `cms.config.ts`
        - provider tests
      - Work:
        1. Implement `put/delete/url` for S3-compatible backends.
        2. Support credentials and signed/public URL modes.
      - Acceptance:
        - `my_images` can be switched from local to S3 without runtime code changes.

    - **Slice 6 — Activate and test file field parity**
      - Files:
        - one starter model using `file()`
        - `src/features/cms/runtime.ts`
        - `src/features/cms/adapters/prisma.ts`
        - new tests for file upload and cleanup
      - Work:
        1. Add a real file field to a fixture/test list.
        2. Verify upload, query output, replace cleanup, and delete cleanup.
      - Acceptance:
        - File field is proven, not merely scaffolded.

    - **Slice 7 — Document field runtime parity**
      - Files:
        - `src/features/cms/keystone/fields-document.ts`
        - likely new runtime/document modules
        - `src/features/cms/runtime.ts`
        - `src/features/cms/prisma-schema.ts`
      - Work:
        1. Replace generic document stub with a real document field implementation.
        2. Enforce default document structure, null rejection, and typed GraphQL output.
        3. Add relationship hydration only if in scope.
      - Acceptance:
        - `document()` behaves like Keystone’s field, not raw JSON.

    - **Slice 8 — Image transformName and stream handling parity**
      - Files:
        - `src/features/cms/fields/index.ts`
        - `src/features/cms/storage.ts`
      - Work:
        1. Make image `transformName` extension-aware.
        2. Avoid full-buffer upload requirement where feasible.
      - Acceptance:
        - Image naming and streaming behavior closer to official Keystone.

  - #### Overall verdict

    - **Prisma schema/artifact parity:** **Partial**
      - Strong improvement over older audits, but printer/lifecycle remain simpler than official Keystone.
    - **Delegate mapping parity:** **Mostly good**
      - Generic and validated now.
    - **Migration lifecycle parity:** **Partial**
      - Needs preflight hardening on all Prisma commands.
    - **Local storage parity:** **Good for current slice**
      - Local image persistence is real and tested.
    - **S3 parity:** **Missing**
      - Config shape exists; provider implementation does not.
    - **Upload scalar/multipart parity:** **Partial**
      - In-process upload works; HTTP multipart contract is not yet proven/equivalent.
    - **Image field parity:** **Good locally, incomplete officially**
      - Strong local runtime; still broader input shape and no S3/provider parity.
    - **File field parity:** **Scaffolded, not proven**
      - Runtime pieces exist but no model/test coverage.
    - **Document field parity:** **Stub**
      - Still far from official Keystone behavior.