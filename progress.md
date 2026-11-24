# Progress

## Status
In Progress

## Tasks
- Runtime parity audit lane: compared official Keystone access control, hooks, and context APIs (`context.db/query/graphql/sudo/transactions`) against local CMS runtime/adapters/graphql surfaces

## Files Changed
- `/Users/junaid/code/tanstack-keystone-starter/progress.md`
- `/Users/junaid/code/tanstack-keystone-starter/context.md`

## Notes
- Audited official first under `/Users/junaid/code/keystone/packages/core/src/types` plus `/lib/context/createContext.ts`, `/lib/core/access-control.ts`, and `/lib/core/hooks.ts`
- Audited local second under `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/{types,access,hooks,runtime,graphql,adapters}`
- Exact blocker ranking captured in `/Users/junaid/code/tanstack-keystone-starter/context.md`
- Noted scope issue: requested local file `src/features/cms/adapters/graphql` does not exist; nearest local GraphQL entrypoint is `src/features/cms/graphql.ts`
