import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { handleCompletionRequest } from '../src/routes/api/completion'
import { handleGraphQLRequest } from '../src/routes/api/graphql'
import { getDashboardAuthState } from '../src/features/cms/dashboard-auth'
import { resolveDashboardRedirect } from '../src/features/cms/dashboard-route-guards'

function readSetCookie(headers: Headers) {
  return headers.get('set-cookie') ?? headers.get('Set-Cookie') ?? ''
}

async function graphqlPost(
  query: string,
  variables?: Record<string, unknown>,
  headers?: HeadersInit,
) {
  const request = new Request('http://tanstack-keystone.local/api/graphql', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...Object.fromEntries(new Headers(headers)),
    },
    body: JSON.stringify({ query, variables }),
  })
  return handleGraphQLRequest(request)
}

async function completionPost(body: unknown, headers?: HeadersInit) {
  const request = new Request('http://tanstack-keystone.local/api/completion', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...Object.fromEntries(new Headers(headers)),
    },
    body: JSON.stringify(body),
  })
  return handleCompletionRequest(request)
}

async function main() {
  const rootRouteSource = await readFile(
    new URL('../src/routes/__root.tsx', import.meta.url),
    'utf8',
  )
  assert.match(
    rootRouteSource,
    /HeadContent/,
    'root route should render HeadContent for TanStack Start document head management',
  )
  assert.match(
    rootRouteSource,
    /Scripts/,
    'root route should render Scripts so the dashboard hydrates correctly',
  )
  assert.match(
    rootRouteSource,
    /app\/globals\.css\?url/,
    'root route should load the global stylesheet asset for dashboard CSS/Tailwind',
  )
  assert.doesNotMatch(
    rootRouteSource,
    /Hello "__root"!/,
    'root route should not still render the placeholder __root content',
  )

  const authMutation = await graphqlPost(
    /* GraphQL */ `
      mutation ValidateDashboardHttpAuth($email: String!, $password: String!) {
        authenticateUserWithPassword(email: $email, password: $password) {
          __typename
          ... on UserAuthenticationWithPasswordSuccess {
            sessionToken
          }
          ... on UserAuthenticationWithPasswordFailure {
            message
          }
        }
      }
    `,
    { email: 'ada@example.com', password: 'password' },
    { 'x-cms-disable-dev-auth-fallback': 'true' },
  )
  assert.equal(
    authMutation.status,
    200,
    'GraphQL auth mutation should return HTTP 200',
  )
  const authPayload = (await authMutation.json()) as {
    data?: {
      authenticateUserWithPassword?: {
        __typename?: string
        sessionToken?: string
        message?: string
      }
    }
    errors?: Array<{ message?: string }>
  }
  assert.equal(
    authPayload.errors?.length ?? 0,
    0,
    'GraphQL auth mutation should not return GraphQL errors',
  )
  assert.equal(
    authPayload.data?.authenticateUserWithPassword?.__typename,
    'UserAuthenticationWithPasswordSuccess',
    authPayload.data?.authenticateUserWithPassword?.message ??
      'expected successful dashboard auth mutation',
  )
  const cookie = readSetCookie(authMutation.headers)
  assert.match(
    cookie,
    /keystonejs-session=/i,
    'GraphQL auth mutation should write a session cookie over HTTP',
  )

  const authState = await getDashboardAuthState(
    new Request('http://tanstack-keystone.local/dashboard', {
      headers: { cookie },
    }),
  )
  const authenticatedItem = authState.authenticatedItem
  assert(
    authenticatedItem,
    'session cookie should hydrate dashboard auth state on a real Request',
  )
  assert.equal(
    authenticatedItem.id,
    'user_admin',
    'session cookie should hydrate dashboard auth state on a real Request',
  )
  assert.equal(
    authenticatedItem.isAccessAllowed,
    true,
    'session cookie auth state should include the generic UI access decision',
  )

  const completionDenied = await completionPost(
    { prompt: 'Who am I?' },
    { 'x-cms-disable-dev-auth-fallback': 'true' },
  )
  assert.equal(
    completionDenied.status,
    403,
    'anonymous dashboard completion HTTP request should be rejected',
  )
  const deniedPayload = (await completionDenied.json()) as { error?: string }
  assert.match(
    String(deniedPayload.error),
    /signed in/i,
    'anonymous dashboard completion HTTP error should explain signin requirement',
  )

  const completionAllowed = await completionPost(
    { prompt: 'Who am I?' },
    { cookie, 'x-cms-disable-dev-auth-fallback': 'true' },
  )
  assert.equal(
    completionAllowed.status,
    200,
    'authenticated dashboard completion HTTP request should return 200',
  )
  const completionPayload = (await completionAllowed.json()) as {
    data?: { message?: string }
  }
  assert.match(
    String(completionPayload.data?.message),
    /signed in as/i,
    'authenticated dashboard completion response should describe the current user',
  )

  assert.deepEqual(
    resolveDashboardRedirect({
      pathname: '/dashboard',
      publicSignupsAllowed: false,
      authenticatedItem: null,
      redirectToInit: false,
    }),
    { to: '/dashboard/signin', search: { from: '/dashboard' } },
    'anonymous protected dashboard routes should redirect to signin with from',
  )

  assert.deepEqual(
    resolveDashboardRedirect({
      pathname: '/dashboard/signin',
      searchFrom: '/dashboard/todos',
      publicSignupsAllowed: true,
      authenticatedItem: {
        id: 'user_admin',
        isAccessAllowed: true,
      },
      redirectToInit: false,
    }),
    { to: '/dashboard/todos' },
    'authenticated users visiting public auth routes should be redirected back to dashboard targets',
  )

  assert.deepEqual(
    resolveDashboardRedirect({
      pathname: '/dashboard/signin',
      searchFrom: '/dashboard/signin',
      publicSignupsAllowed: true,
      authenticatedItem: {
        id: 'user_admin',
        isAccessAllowed: true,
      },
      redirectToInit: false,
    }),
    { to: '/dashboard' },
    'authenticated users visiting signin with a signin from target should be redirected to dashboard instead of looping',
  )

  assert.deepEqual(
    resolveDashboardRedirect({
      pathname: '/dashboard/users',
      publicSignupsAllowed: true,
      authenticatedItem: {
        id: 'user_limited',
        isAccessAllowed: false,
      },
      redirectToInit: false,
    }),
    { to: '/dashboard/no-access' },
    'authenticated users without dashboard access should be redirected to no-access',
  )

  assert.deepEqual(
    resolveDashboardRedirect({
      pathname: '/dashboard/no-access',
      publicSignupsAllowed: true,
      authenticatedItem: null,
      redirectToInit: false,
    }),
    { to: '/dashboard/signin' },
    'anonymous no-access visits should still redirect to signin without preserving a no-access from target',
  )

  assert.deepEqual(
    resolveDashboardRedirect({
      pathname: '/dashboard/todos',
      publicSignupsAllowed: true,
      authenticatedItem: null,
      redirectToInit: true,
    }),
    { to: '/dashboard/init' },
    'first-item mode should redirect protected dashboard routes to init',
  )

  console.log('Dashboard HTTP acceptance validation passed.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
