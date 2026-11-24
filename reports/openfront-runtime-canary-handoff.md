# Openfront runtime canary handoff

- Status: **REVIEW CHECKPOINT READY 025 — PASS within bounded compatibility scope**
- Frozen canary aggregate: `8d9d386f03ea81fce7338db8672b9299aec77aa099d969e2a9ae891fe99aa3df`
- Replacement canary script SHA-256: `87314143ecc75419472c607d17d60759eed0dcb21367e8ab888813c0310434ec`
- Both profiles passed at this unchanged replacement aggregate after the failure probe and external post-finally checks.
- `3c6d1182…` and `c1137920…` are historical rejected/superseded cleanup evidence.
- The earlier `c4f20476a3b3ef42f9d9c3656677a50418bd474ee43eddc3a73c59e2d051caa8` run is historical backend/route evidence only.
- Access boundary: the generated permissive access scaffold is compatibility-only; it is not source access-policy parity.

## Consumer boundaries

| Consumer | Source (read-only) | Dashboard evidence | Domain evidence | Report |
|---|---|---|---|---|
| `opensource.builders` | `/Users/junaid/Code/opensource.builders` | Rendered `Open Source Applications` with seeded `Starter Replacement` at final `/dashboard/open-source-applications`; no sign-in/error-boundary text | Auth, Category/Application/Capability CRUD and relationships, PostgreSQL persistence, dump/restore rollback | `reports/openfront-runtime-cutover-canary-opensource-builders.md` |
| `os.org` | `/Users/junaid/Code/os.org` | Rendered `Products` with seeded `Canary Platform` at final `/dashboard/products`; no sign-in/error-boundary text | Auth, Product/Price/Instance/Subscription CRUD and relationships, PostgreSQL persistence, dump/restore rollback | `reports/openfront-runtime-cutover-canary-os-org.md` |

## Cleanup verification

After both runs:

- No `tks_openfront_*_canary_*` PostgreSQL databases remain.
- No canary Vite/validation processes remain.
- No `.cms-temp/openfront-runtime-canary-*` fixtures remain.
- No canary markers remain in `.tanstack`, Vite/Nitro caches, or `.output`.
- `npm run cms:check` and `node --check scripts/validate-openfront-runtime-canary.mjs` pass.

This is the formal REVIEW CHECKPOINT READY 025 handoff for both representative consumer runtime boundaries. See `reports/openfront-runtime-canary-checkpoint-025.md` for the frozen five-file hashes, aggregate, failure-probe evidence, and explicit exclusions. This checkpoint does not imply `READINESS.md`, release, or closure; external provider continuity and source access-policy parity remain outside this bounded compatibility canary.
