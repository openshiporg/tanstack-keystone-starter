# Openfront runtime cutover canary

- Consumer: **opensource.builders**
- Canary script SHA-256: `87314143ecc75419472c607d17d60759eed0dcb21367e8ab888813c0310434ec`
- Status: **PASS**
- Source (read-only): `/Users/junaid/Code/opensource.builders`
- Access boundary: permissive compatibility scaffold only; source access-policy parity is not claimed.
- Models transplanted: User, Role, Category, ProprietaryApplication, OpenSourceApplication, Capability, ProprietaryCapability, OpenSourceCapability
- Disposable database: `tks_openfront_opensource_builders_canary_20821_1785287987447`
- Rollback database: `tks_openfront_opensource_builders_canary_20821_1785287987447_rollback`
- Temporary fixture: `/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/openfront-runtime-canary-DBCTnl`
- Source cache fingerprint before/after: `6ea80f59ec988442c63fc8d35d9c7d8580c08b051694c720205584d11e42f78e` / `6ea80f59ec988442c63fc8d35d9c7d8580c08b051694c720205584d11e42f78e`
- Remaining source jiti/cache markers: 0

## Exact evidence
- **source** — read-only source registry found at /Users/junaid/Code/opensource.builders
- **transplant** — copied 8 real Openfront model initializers into disposable starter fixture
- **access-scaffold** — generated permissive access only to exercise the compatibility boundary; this is not source policy parity
- **database** — created disposable PostgreSQL database tks_openfront_opensource_builders_canary_20821_1785287987447
- **generate** — generated CMS manifest, GraphQL schema, Prisma schema, and TypeScript artifacts
- **migrate** — applied generated Prisma migrations and seeded representative Openfront data
- **run** — bounded Vite runtime became ready at http://127.0.0.1:3438
- **auth** — admin password auth returned success and keystonejs-session cookie
- **dashboard** — rendered Open Source Applications with seeded Starter Replacement at final /dashboard/open-source-applications pathname with no sign-in/error-boundary text
- **relationships** — seeded category/application/capability relationships resolved through GraphQL
- **rollback** — captured a custom-format PostgreSQL dump after migration and seed before CRUD
- **crud** — created category, proprietary application, open-source application, and capability relation
- **persistence** — updated domain data and reloaded it with its relationship from PostgreSQL
- **cleanup** — bounded Vite child exited after runtime acceptance
- **rollback** — restored pre-CRUD dump and verified relationship plus absence of post-cutover row
- **cleanup** — removed and verified rollback database tks_openfront_opensource_builders_canary_20821_1785287987447_rollback
- **cleanup** — removed and verified disposable database tks_openfront_opensource_builders_canary_20821_1785287987447
- **cleanup** — removed and verified temporary fixture absence
- **cleanup** — source cache fingerprint unchanged (6ea80f59ec988442c63fc8d35d9c7d8580c08b051694c720205584d11e42f78e); jiti/cache marker absence verified after final cleanup
