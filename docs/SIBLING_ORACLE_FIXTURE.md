# Derived sibling dashboard oracle

`next-keystone-starter` remains read-only. The executable comparison target is created only in a unique temporary directory by:

```sh
npm run test:sibling:oracle
```

## Why a derived fixture is required

The sibling dashboard queries six fields that its checked-in Keystone GraphQL schema does not expose:

- list: `initialFilter`, `hideNavigation`
- create view: `fieldPosition`, `isRequired`
- item view: `isRequired`
- list view: `fieldPosition`

The authoritative sibling therefore renders its dashboard error boundary even though direct GraphQL initialization and CRUD work.

## Bounded patch

The fixture removes only those six selections from the copied `getAdminMetaAction.ts`. It then normalizes the absent values after the response:

- `initialFilter: {}`
- `hideNavigation: list.isHidden`
- `fieldPosition: "form"`
- create/item `isRequired` from `field.isNonNull.includes("create")`

GraphQL names continue to come from the sibling's existing `getGraphQLNames` implementation. These defaults are a synthetic compatibility policy for this checked-in sibling only: its current model config has no initial-filter/navigation overrides, its consumers already fall back to `isHidden`, and create/list positions have no old-schema representation. They must not be generalized to arbitrary sibling configurations. No source file under `/Users/junaid/Code/next-keystone-starter` is modified.

## Runtime evidence and cleanup

The gate:

1. fingerprints the read-only sibling;
2. copies it without `.env`, generated output, dependencies, or Git metadata;
3. installs dependencies inside the disposable copy;
4. creates a unique PostgreSQL database and applies the sibling's checked-in migrations;
5. builds and starts the patched production app with bounded detached processes;
6. uses Firefox WebDriver BiDi to initialize the first administrator, load dashboard home/list/create, sign out, and sign in through the rendered form;
7. creates the Todo through a scoped direct GraphQL request—not the sibling UI form—then loads/reloads its item route and directly verifies the validated server-generated ID and exact label in PostgreSQL;
8. rejects GraphQL AdminMeta/error-boundary failures, unexpected browser fetch failures, HTTP 4xx/5xx responses, and console errors;
9. independently cleans tracked groups and exact-profile escaped Firefox processes, removes and absence-checks the temporary root, drops/absence-checks the database even after cleanup-readiness failure, restores the exact initial PostgreSQL state, and proves the sibling fingerprint is unchanged.

Lifecycle probes are available through `SIBLING_ORACLE_STOP_AFTER_CREATE_PROBE`, `SIBLING_ORACLE_CLEANUP_READINESS_FAILURE_PROBE`, and `SIBLING_ORACLE_FIREFOX_LAUNCHER_PROBE`.

This fixture is an intended-behavior oracle, not a modification or claim that the authoritative sibling currently runs unpatched.
