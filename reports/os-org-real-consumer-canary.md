# os.org real-consumer cutover canary

- Status: **PASS within bounded real-consumer scope**
- Disposition: **review candidate; GAP-13 remains open**
- Source (read-only): `/Users/junaid/Code/os.org`
- Source boundary SHA-256: `69e2515609cd0c15d28c2d31e83b64b5bcdbbe913e1b815caf1105cea8f81d92`
- Canary SHA-256: `a860b2ab25ef0dc30f4ae93d4d3c1a73cca6d8f26201aa830606d0299a869237`
- Worker SHA-256: `b7303041444c25e4543df654c346969977c27a6ce8ca2f1b4da18236a9dead0c`
- Prisma adapter SHA-256: `c57dc9dce17f95b347dcaf9065b822275e8533d4ed1f35d5c617db5819286b08`
- Owned four-file aggregate: `62f5b6e4a64cabb4ab5905207e6a58be080297c8c47210236079c99685d2000d`
- Source Prisma SHA-256: `1e1d2b47034201feaaa511db725f80c3f5df24448e15180313ed69627da0f35e`
- Source GraphQL SHA-256: `ccd18ba1b4aced165178d3df546e35cacbceda4510048f17221ad4c2ae689e96`
- Database/server mode: one bounded PostgreSQL 17 container with a tmpfs data directory; no application server

## Exact evidence

- **failure cleanup** — intentional post-readiness failure returned BLOCKED and externally verified container, fixture, process, source, cache, and implementation cleanup (pass).
- **source** — copied the real `os.org` access module byte-for-byte and import-adapted its seven real model initializers and auth config; source fingerprint remained unchanged.
- **migrations** — deployed all six exact source migration directories in order: 20250728190557_initial_migration, 20250730054036_add_application_field_to_product, 20250730193550_add_custom_domain_to_instance_field, 20250803194026_add_waitlists, 20250804190343_add_password_reset_tokens, 20260718120000_scope_deployment_ownership.
- **schema** — source-to-replacement Prisma diff emitted 0 SQL lines; post-cutover database drift was `none`.
- **auth** — wrong-password failure stayed generic; real User/email/password auth issued and rehydrated member/admin cookies; role-backed dashboard access denied the member and allowed the admin.
- **access** — anonymous Product/Price reads passed while protected reads/writes failed; member User/Instance/Subscription reads were owner-filtered; protected Product/Subscription/Role/User/Newsletter and foreign-owner/field writes were denied; omitted Instance owner auto-assigned the member after aligning Prisma with the existing pre-hook field-access boundary.
- **CRUD** — admin GraphQL created and updated Role, User, Product, Price, Instance, Subscription, and Newsletter records; Product and Newsletter delete markers were deleted and absence-checked.
- **persistence** — a fresh Node process reauthenticated and reloaded the created user/role, product/price, instance/subscription/user, newsletter, member-owned instance, and deletion state; direct PostgreSQL returned the same relationship graph.
- **rollback** — restored the pre-CRUD custom-format dump into an independent database, reauthenticated through the replacement runtime, recovered source product/price/member/instance/subscription relationships, and proved all selected post-cutover rows absent.
- **cleanup** — the tmpfs PostgreSQL container (with no Docker volume), fixture clone, worker processes, container dump files, and host dump were removed; source/implementation fingerprints remained exact and no fixture path leaked into starter caches.

## Explicit residual boundaries

- This is representative source-shaped data, not a sanitized production dump or production-sized timing/load evidence.
- The source auth/model files are import-adapted in a disposable fixture; this is not an in-place sibling edit or deployed package replacement.
- SMTP reset delivery and Railway deployment are deliberately stubbed and not invoked; external provider credentials, objects, delivery, and deployment continuity remain open.
- The canary executes replacement GraphQL directly in fresh Node processes. Checkpoint 025 remains the separate accepted rendered-dashboard/Vite evidence; no new browser or production build claim is made here.
- Session-cookie coexistence with the old Keystone deployment, live-write quiescence, production observation, rollback operators, and production domain traffic remain unproved.
- This report does not modify `READINESS.md`, self-close GAP-13, or authorize package removal.
