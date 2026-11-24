# Openfront runtime cutover canary

- Status: **PASS**
- Source (read-only): `/Users/junaid/Code/opensource.builders`
- Models transplanted: User, Role, Category, ProprietaryApplication, OpenSourceApplication, Capability, ProprietaryCapability, OpenSourceCapability
- Disposable database: `tks_openfront_canary_97048_1784763746262`
- Rollback database: `tks_openfront_canary_97048_1784763746262_rollback`
- Temporary fixture: `/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/openfront-runtime-canary-uJwzRi`

## Exact evidence
- **source** — read-only source registry found at /Users/junaid/Code/opensource.builders
- **transplant** — copied 8 real Openfront model initializers into disposable starter fixture
- **database** — created disposable PostgreSQL database tks_openfront_canary_97048_1784763746262
- **generate** — generated CMS manifest, GraphQL schema, Prisma schema, and TypeScript artifacts
- **migrate** — applied generated Prisma migrations and seeded representative Openfront data
- **run** — bounded Vite runtime became ready at http://127.0.0.1:3465
- **auth** — admin password auth returned success and keystonejs-session cookie
- **dashboard** — authenticated /dashboard/open-source-applications returned 200
- **relationships** — seeded category/application/capability relationships resolved through GraphQL
- **rollback** — captured a custom-format PostgreSQL dump after migration and seed before CRUD
- **crud** — created category, proprietary application, open-source application, and capability relation
- **persistence** — updated domain data and reloaded it with its relationship from PostgreSQL
- **cleanup** — bounded Vite child exited after runtime acceptance
- **rollback** — restored pre-CRUD dump and verified relationship plus absence of post-cutover row
- **cleanup** — removed and verified rollback database tks_openfront_canary_97048_1784763746262_rollback
- **cleanup** — removed and verified disposable database tks_openfront_canary_97048_1784763746262
- **cleanup** — removed and verified temporary fixture absence
