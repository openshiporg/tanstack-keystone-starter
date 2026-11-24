import { createPrismaCmsAdapter } from '../src/features/cms/adapters/prisma'
import {
  findMissingPrismaDelegates,
  formatPrismaDelegatePreflightError,
  prismaDelegateNameForList,
} from '../src/features/cms/adapters/prisma-preflight'
import { initialiseLists } from '../src/features/cms/config'
import { config, list } from '../src/features/cms/keystone/core'
import { allowAll } from '../src/features/cms/keystone/access'
import { text } from '../src/features/cms/keystone/fields'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function delegateStub() {
  return {
    findUnique: async () => null,
    findFirst: async () => null,
    findMany: async () => [],
    count: async () => 0,
    create: async () => ({ id: 'stub' }),
    update: async () => ({ id: 'stub' }),
    delete: async () => ({ id: 'stub' }),
  }
}

const lists = initialiseLists(
  config({
    lists: {
      Product: list({
        access: {
          operation: {
            query: allowAll,
            create: allowAll,
            update: allowAll,
            delete: allowAll,
          },
        },
        fields: { name: text() },
      }),
      PublishedPost: list({
        access: {
          operation: {
            query: allowAll,
            create: allowAll,
            update: allowAll,
            delete: allowAll,
          },
        },
        fields: { title: text() },
      }),
      TodoImage: list({
        access: {
          operation: {
            query: allowAll,
            create: allowAll,
            update: allowAll,
            delete: allowAll,
          },
        },
        fields: { altText: text() },
      }),
    },
  }),
)

const prismaWithOneMissingDelegate = {
  product: delegateStub(),
  todoImage: delegateStub(),
}

const issues = findMissingPrismaDelegates(prismaWithOneMissingDelegate, lists)
assert(
  issues.length === 1,
  'preflight should aggregate missing delegates without throwing immediately',
)
assert(
  issues[0]?.listKey === 'PublishedPost',
  'preflight should identify the missing arbitrary model list',
)
assert(
  issues[0]?.delegateName === 'publishedPost',
  'preflight should derive camel-case Prisma delegates from list keys',
)
assert(
  prismaDelegateNameForList('TodoImage') === 'todoImage',
  'delegate derivation should preserve inner capitals',
)

const formatted = formatPrismaDelegatePreflightError(issues)
assert(
  formatted.includes('PublishedPost -> prisma.publishedPost'),
  'preflight error should name missing list/delegate mappings',
)

try {
  createPrismaCmsAdapter({ prisma: prismaWithOneMissingDelegate as never })
  throw new Error(
    'createPrismaCmsAdapter should preflight canonical initialized lists before runtime use',
  )
} catch (error) {
  assert(error instanceof Error, 'preflight failure should throw an Error')
  assert(
    error.message.includes('Prisma adapter preflight failed'),
    'preflight adapter creation should throw an aggregated error',
  )
}

const delegateRuntimeError = await createPrismaCmsAdapter({
  prisma: { product: delegateStub(), todoImage: delegateStub() } as never,
  lists: lists.filter((entry) => entry.key !== 'PublishedPost'),
})
try {
  await delegateRuntimeError.findMany('PublishedPost', {
    context: {
      __internal: { sudo: true, lists },
      adapter: delegateRuntimeError,
    } as never,
  })
  throw new Error(
    'delegateFor should still protect dynamic runtime calls missing a delegate',
  )
} catch (error) {
  assert(
    error instanceof Error,
    'missing runtime delegates should remain Error-compatible during resolver execution',
  )
  assert(
    error instanceof Error,
    'runtime missing delegate error should remain Error-compatible',
  )
}

console.info('CMS Prisma delegate preflight validation passed.')
