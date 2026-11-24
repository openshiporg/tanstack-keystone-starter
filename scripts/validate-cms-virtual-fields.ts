import { graphql, printSchema } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
  setCmsAdapterForTests,
} from '../src/features/cms/adapters'
import { initialiseLists } from '../src/features/cms/config'
import { config, list } from '../src/features/cms/keystone/core'
import { allowAll } from '../src/features/cms/keystone/access'
import { text, virtual } from '../src/features/cms/keystone/fields'
import {
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
} from '../src/features/cms/runtime'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

let rejectedVisibleCompositeWithoutQuery = false
try {
  initialiseLists(
    config({
      lists: {
        InvalidVirtualThing: list({
          fields: {
            visibleComposite: virtual({
              graphQLReturnType: 'PasswordState',
              resolver: () => ({ isSet: true }),
            }),
          },
        }),
      },
    }),
  )
} catch (error) {
  rejectedVisibleCompositeWithoutQuery =
    error instanceof Error &&
    error.message.includes(
      'virtual fields with non-scalar GraphQL return types require ui.query',
    )
}
assert(
  rejectedVisibleCompositeWithoutQuery,
  'visible non-scalar virtual fields should require ui.query unless hidden',
)

const lists = initialiseLists(
  config({
    lists: {
      VirtualThing: list({
        access: {
          operation: {
            query: allowAll,
            create: allowAll,
            update: allowAll,
            delete: allowAll,
          },
        },
        fields: {
          name: text({
            validation: { isRequired: true },
            isNonNull: [true, true],
          }),
          displayName: virtual({
            graphQLReturnType: 'String',
            resolver: (item) => `display:${String(item.name)}`,
          }),
          computedSecret: virtual({
            graphQLReturnType: 'PasswordState',
            ui: { query: '{ isSet }' },
            resolver: () => ({ isSet: true }),
          }),
        },
      }),
    },
  }),
)

setCmsAdapterForTests(memoryCmsAdapter)
resetMemoryAdapter(
  {
    VirtualThing: [{ id: 'virtual_1', name: 'Ada' }],
  },
  lists,
)

const schema = makeExecutableSchema({
  typeDefs: generateCmsTypeDefsForLists(lists),
  resolvers: generateCmsResolversForLists(lists),
})

const sdl = printSchema(schema)
assert(
  sdl.includes('displayName: String'),
  'virtual field validation should preserve scalar virtual SDL',
)
assert(
  sdl.includes('computedSecret: PasswordState'),
  'virtual field validation should preserve non-scalar virtual SDL when ui.query is provided',
)

const contextValue = {
  adapter: memoryCmsAdapter,
  session: undefined,
  __internal: { sudo: true, lists },
  sudo() {
    return this
  },
} as const

const result = await graphql({
  schema,
  source: /* GraphQL */ `
    query ValidateVirtualFieldContracts {
      virtualThings {
        id
        name
        displayName
        computedSecret {
          isSet
        }
      }
    }
  `,
  contextValue,
})
if (result.errors?.length)
  throw new Error(result.errors.map((error) => error.message).join('\n'))
const rows = (asRecord(result.data).virtualThings ?? []) as Array<unknown>
assert(rows.length === 1, 'virtual field validation should return seeded rows')
const first = asRecord(rows[0])
assert(
  first.displayName === 'display:Ada',
  'scalar virtual fields should resolve normally',
)
assert(
  asRecord(first.computedSecret).isSet === true,
  'non-scalar virtual fields should resolve when ui.query is provided',
)

console.info('CMS virtual field validation passed.')
