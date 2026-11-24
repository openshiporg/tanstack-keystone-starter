import { graphql } from 'graphql'

import { setCmsAdapterForTests } from '../src/features/cms/adapters'
import { createPrismaCmsAdapter } from '../src/features/cms/adapters/prisma'
import { createCmsPrismaClient } from '../src/features/cms/prisma-client'
import {
  createCmsContext,
  getCmsGraphQLSchema,
} from '../src/features/cms/runtime'

const schema = getCmsGraphQLSchema()
const prisma = createCmsPrismaClient()

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

async function execute(
  source: string,
  contextValue: Awaited<ReturnType<typeof createCmsContext>>,
) {
  const result = await graphql({ schema, source, contextValue })
  if (result.errors?.length)
    throw new Error(result.errors.map((error) => error.message).join('\n'))
  return result.data as Record<string, unknown>
}

async function main() {
  assert(
    process.env.DATABASE_URL,
    'DATABASE_URL is required for Prisma CMS auth validation',
  )
  process.env.CMS_ADAPTER = 'prisma'
  setCmsAdapterForTests(createPrismaCmsAdapter({ prisma }))
  assert(
    (await prisma.user.count()) > 0,
    'Prisma auth validation expects seeded users; run npm run db:seed first',
  )

  const anonymousContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { 'x-cms-anonymous': 'true' },
    }),
  )
  const successful = await execute(
    /* GraphQL */ `
      mutation ValidatePrismaPasswordAuth {
        authenticateUserWithPassword(
          email: "ada@example.com"
          password: "password"
        ) {
          __typename
          ... on UserAuthenticationWithPasswordSuccess {
            sessionToken
            item {
              id
              email
            }
          }
          ... on UserAuthenticationWithPasswordFailure {
            message
          }
        }
      }
    `,
    anonymousContext,
  )
  const auth = asRecord(successful.authenticateUserWithPassword)
  assert(
    auth.__typename === 'UserAuthenticationWithPasswordSuccess',
    'Prisma auth should verify seeded hashed password',
  )
  assert(
    asRecord(auth.item).id === 'user_admin',
    'Prisma auth should return authenticated user',
  )

  const tokenContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { authorization: `Bearer ${String(auth.sessionToken)}` },
    }),
  )
  const authenticated = await execute(
    /* GraphQL */ `
      query ValidatePrismaAuthenticatedItem {
        authenticatedItem {
          ... on User {
            id
            email
          }
        }
      }
    `,
    tokenContext,
  )
  assert(
    asRecord(authenticated.authenticatedItem).id === 'user_admin',
    'Prisma auth should hydrate authenticatedItem from Bearer token',
  )

  console.info('CMS Prisma auth/session validation passed.')
}

await main()
  .catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
