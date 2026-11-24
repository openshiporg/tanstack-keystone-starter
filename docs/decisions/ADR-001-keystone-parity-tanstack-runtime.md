# ADR-001: Build a Keystone-compatible runtime for TanStack Start

## Status
Accepted

## Date
2026-05-11

## Context

`next-keystone-starter` proves that Keystone can be used as a backend CMS engine while replacing Keystone's official admin UI with an in-app shadcn dashboard. The current starter still depends on Keystone's runtime/build pipeline:

- `keystone build --no-ui` creates generated `.keystone` artifacts.
- Keystone initializes list configs into rich list metadata.
- Keystone builds GraphQL query/mutation/adminMeta schemas dynamically.
- Keystone creates a Prisma-backed context and serves GraphQL through Yoga.
- The custom dashboard consumes Keystone's dynamic `adminMeta` and CRUD GraphQL API.

The new target is `tanstack-keystone-starter`: a TanStack Start app that keeps this “CMS inside the app” model but strips Keystone's Next-coupled runtime/admin UI dependency. The user requirement is **feature parity with Keystone's config/list/GraphQL behavior**, not a shallow `adminMeta` mock.

Keystone source has been cloned for reference at `/Users/junaid/code/keystone`. Relevant source paths include:

- `/Users/junaid/code/keystone/packages/core/src/lib/createSystem.ts`
- `/Users/junaid/code/keystone/packages/core/src/lib/core/initialise-lists.ts`
- `/Users/junaid/code/keystone/packages/core/src/lib/createGraphQLSchema.ts`
- `/Users/junaid/code/keystone/packages/core/src/lib/core/queries/*`
- `/Users/junaid/code/keystone/packages/core/src/lib/core/mutations/*`
- `/Users/junaid/code/keystone/packages/core/src/lib/core/where-inputs.ts`
- `/Users/junaid/code/keystone/packages/core/src/lib/core/access-control.ts`
- `/Users/junaid/code/keystone/packages/core/src/fields/types/*/index.ts`

Existing audit docs:

- `keystone-core-parity-audit.md`
- `dashboard-handoff-context.md`
- `docs/next-keystone-to-tanstack-start.md`

## Decision

Build a Keystone-compatible, TanStack-native runtime under `src/features/cms` instead of importing Keystone's runtime directly.

The runtime must evolve toward this pipeline:

```txt
CMS config/list/field DSL
  -> resolved config defaults
  -> initialized lists/fields
  -> adminMeta generation
  -> GraphQL type/input/filter/order generation
  -> resolver/context/access/hooks layer
  -> data adapter (Prisma in production, memory for tests/dev)
  -> GraphQL Yoga route in TanStack Start
```

Near-term, use Keystone source as a behavioral reference and implement focused compatibility slices. Long-term, avoid wholesale Keystone imports because they pull in Next/admin UI/runtime coupling and unstable internals.

## Alternatives Considered

### Import `@keystone-6/core` directly

Pros:
- Fastest path to full Keystone behavior.
- Avoids reimplementing complex access/hook/schema behavior.

Cons:
- Keystone runtime is coupled to its generated artifacts and Next/admin assumptions.
- Keeps the same abandoned/outdated dependency risk that motivated this migration.
- Likely drags internal Next dependency/security override issues into TanStack.

Rejected for the target architecture, though Keystone may still be used as a temporary oracle/reference during migration.

### Vendor Keystone internals wholesale

Pros:
- More parity than clean-room rewrite.
- Source is MIT licensed.

Cons:
- Large fork maintenance burden.
- Keystone internals are not stable API.
- Dist/build structure and generated code are hard to maintain.
- Still requires stripping Next/admin/UI paths carefully.

Rejected as default. Vendoring small MIT-noticed functions is allowed only after deliberate review.

### Clean-room Keystone-inspired runtime

Pros:
- TanStack-native and app-controlled.
- Can start small and add parity in explicit slices.
- Avoids hidden Next dependency.

Cons:
- Multi-day/multi-week effort.
- Requires careful tests against Keystone behavior.
- Parity gaps must be tracked explicitly.

Accepted.

## Consequences

- This is not a quick CRUD feature. It is a runtime extraction/rebuild project.
- Every implementation slice must preserve dynamic list-driven behavior.
- Prisma is required for a real starter milestone; in-memory is only a proving/test adapter.
- Dashboard work must wait until GraphQL/config/runtime parity is solid enough to support it.
- We need durable docs/plans so future agents continue the same architecture rather than inventing shallow mocks.
