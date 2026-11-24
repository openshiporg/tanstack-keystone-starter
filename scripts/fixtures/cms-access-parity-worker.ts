import assert from 'node:assert/strict'

import { createCmsContext } from '../../src/features/cms/runtime'

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

const loginContext = await createCmsContext(
  new Request('http://cms.test/api/graphql', { method: 'POST' }),
)
const login = await loginContext.graphql.raw({
  query: /* GraphQL */ `
    mutation AccessParityLogin {
      authenticateUserWithPassword(
        email: "ed@example.com"
        password: "password"
      ) {
        __typename
        ... on UserAuthenticationWithPasswordSuccess {
          sessionToken
        }
      }
    }
  `,
})
assert.deepEqual(
  login.errors,
  undefined,
  'editor login should not return errors',
)
const authResult = asRecord(login.data?.authenticateUserWithPassword)
assert.equal(
  authResult.__typename,
  'UserAuthenticationWithPasswordSuccess',
  'editor fixture should authenticate',
)
const token = String(authResult.sessionToken ?? '')
assert(token.length > 20, 'editor login should return a session token')

const editorContext = await createCmsContext(
  new Request('http://cms.test/api/graphql', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  }),
)
const nested = await editorContext.graphql.raw({
  query: /* GraphQL */ `
    query AdversarialNestedAccess {
      users {
        id
        email
      }
      roles(orderBy: [{ name: asc }]) {
        id
        name
        assignedTo {
          id
          email
        }
        assignedToCount
      }
    }
  `,
})
assert.deepEqual(
  nested.errors,
  undefined,
  'authorized nested reads should not produce access errors',
)
const data = asRecord(nested.data)
const users = data.users as Array<Record<string, unknown>>
assert.deepEqual(
  users.map((item) => item.email),
  ['ed@example.com'],
  'top-level User access filter should expose only the editor',
)
const roles = data.roles as Array<Record<string, unknown>>
const nestedUsers = roles.flatMap((role) =>
  (role.assignedTo as Array<Record<string, unknown>>).map((item) => item.email),
)
assert(
  !nestedUsers.includes('ada@example.com'),
  'nested Role.assignedTo must not bypass the User query access filter',
)
for (const role of roles) {
  assert.equal(
    role.assignedToCount,
    (role.assignedTo as unknown[]).length,
    'relationship counts must use the same target-list access filter as items',
  )
}

const anonymousContext = await createCmsContext(
  new Request('http://cms.test/api/graphql', {
    method: 'POST',
    headers: { 'x-cms-anonymous': 'true' },
  }),
)
const denied = await anonymousContext.graphql.raw({
  query: /* GraphQL */ `
    query ReadDenialParity {
      user(where: { id: "user_admin" }) {
        id
      }
      users {
        id
      }
      usersCount
    }
  `,
})
assert.deepEqual(
  denied.errors,
  undefined,
  'denied reads should hide results rather than emit access errors',
)
assert.equal(denied.data?.user, null)
assert.deepEqual(denied.data?.users, [])
assert.equal(denied.data?.usersCount, 0)

console.log(
  JSON.stringify({
    adapter: editorContext.adapter.kind,
    topLevelUsers: users.length,
    nestedUsers: nestedUsers.length,
    readDenial: 'null-empty-zero',
  }),
)
