# Representative Openfront compatibility

Run:

```bash
npm run test:openfront-consumers
```

The gate reads sibling repositories without editing them. By default it validates:

- `../opensource.builders`: 8 lists, 82 normalized fields
- `../os.org`: 7 lists, 75 normalized fields

Set `OPENFRONT_CONSUMER_DIRS` to a platform-delimited list of other consumer roots.

## What the gate proves

For each consumer, the script:

1. bundles the unchanged model registry and GraphQL schema extension with esbuild;
2. aliases Keystone core, access, and field imports to this repository's local compatibility modules;
3. applies the consumer's source-shaped User auth/reset configuration;
4. initializes every list and relationship;
5. builds the replacement GraphQL schema, including auth and the consumer extension;
6. compares it with the consumer's committed `schema.graphql` using GraphQL's breaking/dangerous-change analysis;
7. generates a Prisma schema and runs Prisma 7 `migrate diff` against the consumer's committed `schema.prisma`.

The current result is zero missing source GraphQL types, zero breaking changes, zero dangerous changes, and zero Prisma SQL for both consumers.

## Compatibility fixes established by this gate

- Keystone-style consonant-`y` plurals (`Category` → `Categories`, `Capability` → `Capabilities`)
- deterministic ownership for paired one-to-one relationships
- relationship fields in one-to-one `WhereUniqueInput` contracts
- `timestamp({ defaultValue: { kind: 'now' } })` → Prisma `@default(now())`
- source-shaped auth reset fields and GraphQL operations
- direct consumer GraphQL schema extensions

## Limits

This is a static executable contract gate, not a production cutover. It does not edit either consumer, run their storefronts, execute provider integrations, migrate production-sized data, or prove their custom dynamic integration hooks. Each consumer still needs its own disposable-database cutover, runtime/browser acceptance, provider continuity checks, and restore rehearsal before removing Keystone or Next packages.
