# TanStack Keystone runnability review

Date: 2026-05-12

## Current dev server

A VibeGhost session is running the app in memory mode:

- Session: `f2139d14-0a74-4fcd-8788-dfcda1569f54`
- Command: `CMS_ADAPTER=memory npm run dev`
- URL: `http://localhost:3001/`

Vite selected port `3001` because `3000` was already occupied.

## Memory mode

```bash
cd /Users/junaid/code/tanstack-keystone-starter
CMS_ADAPTER=memory npm run dev
```

Seeded sign-in:

- Email: `ada@example.com`
- Password: `password`

Dashboard flow:

- Unauthenticated `GET /dashboard` redirects to `/dashboard/signin?from=%2Fdashboard`.
- `GET /dashboard/signin` returns 200.
- After GraphQL auth mutation sets the `keystonejs-session` cookie, `GET /dashboard` returns 200.

## Prisma mode

```bash
cd /Users/junaid/code/tanstack-keystone-starter
DATABASE_URL=postgresql://junaid@localhost:55432/tanstack_keystone npm run db:push
DATABASE_URL=postgresql://junaid@localhost:55432/tanstack_keystone npm run db:seed
DATABASE_URL=postgresql://junaid@localhost:55432/tanstack_keystone CMS_ADAPTER=prisma npm run dev
```

## Smoke checks run

```bash
npm run lint
npm run build
npm run cms:check
npm run test:cms
npm run test:cms:auth
npm run test:cms:dynamic
```

All passed.

## Manual HTTP checks

Unauthenticated route guard:

```bash
curl -s -I -H 'Accept: text/html' http://localhost:3001/dashboard
# HTTP/1.1 307
# location: /dashboard/signin?from=%2Fdashboard
```

Sign in and dashboard access:

```bash
rm -f /tmp/tks-cookies.txt
curl -s -i -c /tmp/tks-cookies.txt \
  -H 'Content-Type: application/json' \
  --data '{"query":"mutation { authenticateUserWithPassword(email: \"ada@example.com\", password: \"password\") { __typename ... on UserAuthenticationWithPasswordSuccess { sessionToken item { id email } } ... on UserAuthenticationWithPasswordFailure { message } } }"}' \
  http://localhost:3001/api/graphql

curl -s -I -b /tmp/tks-cookies.txt -H 'Accept: text/html' http://localhost:3001/dashboard
# HTTP/1.1 200
```

## Fixed in this pass

- Dashboard client no longer assumes `list.graphql.names` exists in the raw adminMeta query response.
- `normalizeAdminMeta()` now computes `graphql.names`/`gqlNames` locally, matching the Next starter's `getAdminMetaAction` enhancement.
- Dashboard routes now have TanStack Start route-guard parity for:
  - first-user init redirect,
  - unauthenticated signin redirect,
  - authenticated signin bounce,
  - no-access redirect.
- Added `/dashboard/init` and `/dashboard/no-access` routes.
- Sign-in page now performs the real `authenticateUserWithPassword` mutation and uses the HttpOnly session cookie emitted by the GraphQL endpoint.
- Dashboard SSR/in-process GraphQL disables development fallback auth so the dashboard behaves like a real admin surface instead of silently authenticating as the seed admin.
