# Production baseline

This repository emits a Nitro Node server at `.output/server/index.mjs`. Build the artifact on the same operating system and architecture used in production; the checked local build is `darwin-arm64` and is not evidence of Linux portability.

## Required deployment configuration

- Use Node.js 22 and run `npm ci`, `npm run cms:check`, tests, and `npm run build` on the deployment target.
- Set `CMS_ADAPTER=prisma`, `DATABASE_URL`, and a random `SESSION_SECRET` of at least 32 characters.
- Set trusted-proxy forwarding correctly. Secure requests, including requests reported through `X-Forwarded-Proto: https`, receive HSTS in production.
- Configure storage and SMTP with production credentials and provider-specific timeouts. Local provider emulation is not external-provider acceptance.
- Set `CMS_GRAPHQL_MAX_BODY_BYTES` for the largest accepted GraphQL or multipart request. The default is 25 MiB. Declared and chunked oversized requests receive HTTP 413 before GraphQL parsing. Accepted bodies are buffered up to this limit; provider-specific upload limits remain separate controls.
- Set `CMS_READINESS_TIMEOUT_MS` between 100 and 30,000 milliseconds. The default is 5 seconds.

## Probes

- `GET /api/health` is a cache-disabled liveness probe. It does not contact persistence.
- `GET /api/ready` checks CMS initialization and performs a bounded count through the configured adapter. Concurrent probes share at most one in-flight persistence operation. It returns HTTP 503 without exposing exception details when persistence is unavailable or the deadline expires.

Do not put either endpoint behind dashboard authentication. They intentionally return only fixed status categories.

## Request security and logs

Production responses include CSP, frame denial, MIME sniffing prevention, a restrictive permissions policy, a referrer policy, and HSTS on secure requests. The CSP image policy automatically includes the validated `S3_ENDPOINT` origin; add other required HTTP(S) image origins with comma-separated `CMS_CSP_IMG_ORIGINS`. Every response includes a bounded `X-Request-ID`; safe caller-provided IDs are replaced by a deterministic hash so arbitrary caller text is not reflected or written to logs.

Production emits structured `[cms][request]` completion records with request ID, method, pathname, status, and duration. Successful known static assets are suppressed; static failures and dynamic/API responses remain logged. Query strings, raw caller request IDs, headers, cookies, bodies, credentials, and GraphQL variables are excluded. Set `CMS_REQUEST_LOGS=1` to enable the same records outside production.

## Bounded verification

After building, run:

```sh
npm run test:production:baseline
```

The script first proves request abort deadlines and TERM-to-KILL cleanup with a hanging response and a TERM-resistant descendant. It then starts the built server on a temporary loopback port, verifies liveness/readiness, metadata, security headers, request IDs, redacted logs, and the GraphQL body limit, then verifies its owned process group is absent.

## Remaining production gates

This baseline does **not** prove a Linux/container artifact, representative load, GraphQL depth/complexity budgets, pool exhaustion behavior, distributed tracing/metrics/alerts, production-sized migration duration, external provider continuity, or staging rollback. Those remain release-specific acceptance work rather than implied framework guarantees.
