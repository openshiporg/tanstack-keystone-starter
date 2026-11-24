# Backend parity readiness review (Keystone parity snapshot)

Date: 2026-05-11

## Review
- Correct:
  - **Config/generation backbone is in place**: canonical config + generated artifacts + drift/delegate checks are operational (`npm run cms:check` passed locally).
  - **GraphQL CRUD surface is broad for current scope**: single + many mutations are generated and resolved for all lists (`src/features/cms/runtime.ts:412-417`, `:651-698`).
  - **Context API parity foundation exists**: `context.db`, `context.query`, `context.prisma`, and `context.graphql.raw/run/schema` are implemented (`src/features/cms/runtime.ts:546-577`, `src/features/cms/adapters/types.ts:61-71`).
  - **Dynamic model compatibility improved**: Keystone-shaped model files/DSL are supported and validated via dynamic scripts (`scripts/validate-cms-dynamic-model.ts:22-40`).
  - **Prisma adapter is list-driven and preflighted** with clear missing-delegate errors (`src/features/cms/adapters/prisma.ts:55-63`), and dynamic fixture runtime validation passes (`scripts/validate-cms-prisma-runtime-fixture.ts:34-40`).
  - **Transactions exist at adapter level** (memory rollback + Prisma interactive tx) (`src/features/cms/adapters/memory.ts:639-648`, `src/features/cms/adapters/prisma.ts:363-368`).

- Blocker:
  - **Not yet Keystone-backend-ready for production parity** due to missing critical domains:
    1) real auth/session/password behavior,
    2) storage/upload/image/file/document parity,
    3) full mutation/error semantics and internal/public schema split.

- Note:
  - **Current readiness level**: strong backend foundation, but still **partial parity** (roughly late-mid implementation stage, not feature-complete).
  - **Security/dev-mode caveat is still active**: fallback admin session + `x-cms-user-id` header behavior remains (`src/features/cms/runtime.ts:608-621`).

## Done vs Missing

### Done (high-value parity already landed)
1. Config-first runtime + deterministic `.cms/*` generation/check path.
2. Dynamic list initialization and Keystone-like model compatibility layer.
3. GraphQL Yoga endpoint with list CRUD/many CRUD + adminMeta.
4. Access/hook foundations and relationship mutation support (connect/set/disconnect + nested create coverage).
5. Memory + Prisma adapters with transaction support and delegate preflight.
6. Dynamic-model validations (memory + Prisma preflight + Prisma-like runtime fixture).

### Missing (highest parity gaps)
1. **Auth/session parity**: real login/session lifecycle, secure cookies/strategy, and true password hashing/verification are incomplete.
2. **Storage/upload parity**: image/file upload semantics and backed storage are not implemented; image/document/password are still stub-like in schema mapping (`src/features/cms/prisma-schema.ts:20-23`, `:30-33`).
3. **Real arbitrary-model Prisma proof**: dynamic runtime currently uses a Prisma-like fixture client, not a temporary real generated Prisma client/database path (`scripts/validate-cms-prisma-runtime-fixture.ts:34-40`).
4. **Internal/public schema split and request-aware context seams**: no true internal schema path equivalent yet.
5. **Keystone many-mutation error semantics**: current many ops are sequential loops with fail-fast behavior (`src/features/cms/runtime.ts:651-698`), not ordered all-settled semantics.

## Risk hotspots
1. **Security semantics divergence**
   - Dev fallback auth path can mask real auth/session bugs and is unsafe for production assumptions (`src/features/cms/runtime.ts:608-621`).
2. **Data-model semantic drift vs Keystone**
   - Password/image/document mappings are still simplified stubs (`src/features/cms/prisma-schema.ts:20-23`, `:30-33`; `src/features/cms/adapters/prisma.ts:77`).
3. **Mutation correctness/atomicity expectations**
   - Many mutations are not implementing Keystone-style all-settled behavior and can produce different failure semantics (`src/features/cms/runtime.ts:651-698`).
4. **Dynamic Prisma confidence gap**
   - Runtime behavior is tested with fixture delegates, but not yet proven via ephemeral real Prisma client generation path.

## Next 3 implementation slices
1. **Auth/session + password slice (highest impact)**
   - Implement secure session strategy and real password hash/verify path; remove reliance on fallback admin/header auth for parity paths.
2. **Real temporary Prisma client validation slice**
   - Add opt-in ephemeral schema/client generation + disposable DB validation for arbitrary promoted lists; keep canonical schema untouched.
3. **Schema/context semantics slice**
   - Add true internal/public schema seam + context transaction/internal/withRequest parity surfaces and align many-mutation error semantics closer to Keystone.

## Validation signals checked
- `npm run cms:check` → passed
- `npm run test:cms` → passed
- `npm run test:cms:dynamic` → passed

## Input file note
- Requested `plan.md` was not present in this repo path at review time; `progress.md` exists but is largely empty placeholder.