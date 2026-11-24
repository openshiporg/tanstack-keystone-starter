# Openfront runtime cutover canary

- Consumer: **os.org**
- Canary script SHA-256: `87314143ecc75419472c607d17d60759eed0dcb21367e8ab888813c0310434ec`
- Status: **PASS**
- Source (read-only): `/Users/junaid/Code/os.org`
- Access boundary: permissive compatibility scaffold only; source access-policy parity is not claimed.
- Models transplanted: User, Role, Product, Price, Instance, Subscription, Newsletter
- Disposable database: `tks_openfront_os_org_canary_22288_1785288056385`
- Rollback database: `tks_openfront_os_org_canary_22288_1785288056385_rollback`
- Temporary fixture: `/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/openfront-runtime-canary-2gj8Ds`
- Source cache fingerprint before/after: `6ea80f59ec988442c63fc8d35d9c7d8580c08b051694c720205584d11e42f78e` / `6ea80f59ec988442c63fc8d35d9c7d8580c08b051694c720205584d11e42f78e`
- Remaining source jiti/cache markers: 0

## Exact evidence
- **source** — read-only source registry found at /Users/junaid/Code/os.org
- **transplant** — copied 7 real Openfront model initializers into disposable starter fixture
- **access-scaffold** — generated permissive access only to exercise the compatibility boundary; this is not source policy parity
- **database** — created disposable PostgreSQL database tks_openfront_os_org_canary_22288_1785288056385
- **generate** — generated CMS manifest, GraphQL schema, Prisma schema, and TypeScript artifacts
- **migrate** — applied generated Prisma migrations and seeded representative Openfront data
- **run** — bounded Vite runtime became ready at http://127.0.0.1:3505
- **auth** — admin password auth returned success and keystonejs-session cookie
- **dashboard** — rendered Products with seeded Canary Platform at final /dashboard/products pathname with no sign-in/error-boundary text
- **relationships** — seeded product/price/instance/subscription/user relationships resolved through GraphQL
- **rollback** — captured a custom-format PostgreSQL dump after migration and seed before CRUD
- **crud** — created os.org product, price, instance, and subscription relationships
- **persistence** — updated os.org domain data and reloaded it with PostgreSQL relationships
- **cleanup** — bounded Vite child exited after runtime acceptance
- **rollback** — restored os.org pre-CRUD dump and verified product/price/subscription/instance relationship plus absence of post-cutover row
- **cleanup** — removed and verified rollback database tks_openfront_os_org_canary_22288_1785288056385_rollback
- **cleanup** — removed and verified disposable database tks_openfront_os_org_canary_22288_1785288056385
- **cleanup** — removed and verified temporary fixture absence
- **cleanup** — source cache fingerprint unchanged (6ea80f59ec988442c63fc8d35d9c7d8580c08b051694c720205584d11e42f78e); jiti/cache marker absence verified after final cleanup
