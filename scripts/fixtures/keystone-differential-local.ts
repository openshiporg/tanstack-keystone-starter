import { makeExecutableSchema } from '@graphql-tools/schema'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
} from '../../src/features/cms/adapters'
import { config, initialiseLists, list } from '../../src/features/cms/config'
import { allowAll } from '../../src/features/cms/keystone/access'
import { relationship, text } from '../../src/features/cms/keystone/fields'
import {
  buildCmsContext,
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
} from '../../src/features/cms/runtime'

const lists = initialiseLists(
  config({
    lists: {
      Person: list({
        access: {
          operation: {
            query: ({ session }) => Boolean(session),
            create: allowAll,
            update: allowAll,
            delete: allowAll,
          },
          filter: {
            query: ({ session }) =>
              session?.data?.scope === 'self'
                ? { id: { equals: session.itemId } }
                : true,
          },
        },
        fields: {
          name: text(),
          teams: relationship({ ref: 'Team.people', many: true }),
        },
      }),
      Team: list({
        access: {
          operation: {
            query: allowAll,
            create: allowAll,
            update: allowAll,
            delete: allowAll,
          },
        },
        fields: {
          name: text(),
          people: relationship({ ref: 'Person.teams', many: true }),
        },
      }),
      Probe: list({
        access: {
          operation: {
            query: allowAll,
            create: ({ session }) => {
              if (session?.data?.access === 'throw')
                throw new Error('access exploded')
              if (session?.data?.access === 'invalid') return 'invalid' as never
              return true
            },
            update: allowAll,
            delete: allowAll,
          },
        },
        hooks: {
          resolveInput: {
            create: ({ resolvedData }) => {
              ;(globalThis as any).__probeEvents?.push(
                `list:resolve:${resolvedData.label}`,
              )
              return resolvedData
            },
          },
          validate: {
            create: ({ resolvedData, addValidationError }) => {
              ;(globalThis as any).__probeEvents?.push(
                `list:validate:${resolvedData.label}`,
              )
              if (resolvedData.label === 'validate-bad')
                addValidationError('validation exploded')
            },
          },
          beforeOperation: {
            create: ({ resolvedData }) => {
              ;(globalThis as any).__probeEvents?.push(
                `list:before:${resolvedData.label}`,
              )
              if (resolvedData.label === 'before-bad')
                throw new Error('before exploded')
            },
          },
          afterOperation: {
            create: ({ item }) => {
              ;(globalThis as any).__probeEvents?.push(
                `list:after:${item?.label}`,
              )
              if (item?.label === 'after-bad') throw new Error('after exploded')
            },
          },
        },
        fields: {
          label: text({
            hooks: {
              resolveInput: {
                create: ({ resolvedData }) => {
                  ;(globalThis as any).__probeEvents?.push(
                    `field:resolve:${resolvedData.label}`,
                  )
                  return resolvedData.label
                },
              },
              validate: {
                create: ({ resolvedData }) => {
                  ;(globalThis as any).__probeEvents?.push(
                    `field:validate:${resolvedData.label}`,
                  )
                },
              },
              beforeOperation: {
                create: ({ resolvedData }) => {
                  ;(globalThis as any).__probeEvents?.push(
                    `field:before:${resolvedData.label}`,
                  )
                },
              },
              afterOperation: {
                create: ({ item }) => {
                  ;(globalThis as any).__probeEvents?.push(
                    `field:after:${item?.label}`,
                  )
                },
              },
            },
          }),
        },
      }),
    },
  }),
)
resetMemoryAdapter(
  {
    Person: [
      { id: 'person_ada', name: 'Ada', teams: ['team_admins'] },
      { id: 'person_ed', name: 'Ed', teams: [] },
      { id: 'person_zoe', name: 'Zoe', teams: [] },
    ],
    Team: [{ id: 'team_admins', name: 'Admins', people: ['person_ada'] }],
    Probe: [],
  },
  lists,
)
const schema = makeExecutableSchema({
  typeDefs: generateCmsTypeDefsForLists(lists),
  resolvers: generateCmsResolversForLists(lists),
})
const anonymous = buildCmsContext({
  adapter: memoryCmsAdapter,
  sudo: false,
  lists,
  schema,
})
const session = buildCmsContext({
  adapter: memoryCmsAdapter,
  sudo: false,
  lists,
  schema,
  session: {
    itemId: 'person_ed',
    listKey: 'Person',
    data: { scope: 'self' },
  },
})
const unrestricted = buildCmsContext({
  adapter: memoryCmsAdapter,
  sudo: false,
  lists,
  schema,
  session: {
    itemId: 'person_ed',
    listKey: 'Person',
    data: { scope: 'all' },
  },
})

const denied = await anonymous.graphql.raw({
  query: `query { person(where:{id:"person_ada"}){id} people{id} peopleCount }`,
})
const nested = await session.graphql.raw({
  query: `query { people { name } teams { name people { name } peopleCount } }`,
})
const cursor = await unrestricted.graphql.raw({
  query: `query { people(orderBy:[{name:asc}], cursor:{id:"person_ada"}) { name } }`,
})
const matrix = await unrestricted.graphql.raw({
  query: `query {
    equals: people(where:{name:{equals:"Ed"}}){name}
    contains: people(where:{name:{contains:"e"}}, orderBy:[{name:asc}]){name}
    logical: people(where:{OR:[{name:{equals:"Ada"}},{name:{equals:"Zoe"}}]}, orderBy:[{name:desc}]){name}
    relationSome: people(where:{teams:{some:{name:{equals:"Admins"}}}}){name}
    relationNone: people(where:{teams:{none:{name:{equals:"Admins"}}}}, orderBy:[{name:asc}]){name}
    firstTwo: people(orderBy:[{name:asc}], take:2){name}
    offset: people(orderBy:[{name:asc}], skip:1, take:1){name}
    afterCursor: people(orderBy:[{name:asc}], cursor:{id:"person_ada"}, skip:1, take:1){name}
  }`,
})
const accessCursor = await session.graphql.raw({
  query: `query { people(orderBy:[{name:asc}], cursor:{id:"person_ada"}) { name } }`,
})
const contextQuery = await unrestricted.query.Person.findMany({
  where: { name: { contains: 'e' } },
  orderBy: [{ name: 'asc' }],
  query: 'name',
})
const contextDb = await unrestricted.db.Person.findMany({
  where: { name: { equals: 'Ed' } },
})

;(globalThis as any).__probeEvents = []
const accessThrow = await buildCmsContext({
  adapter: memoryCmsAdapter,
  sudo: false,
  lists,
  schema,
  session: { itemId: 'x', listKey: 'Probe', data: { access: 'throw' } },
}).graphql.raw({ query: 'mutation { createProbe(data:{label:"x"}) { id } }' })
const accessInvalid = await buildCmsContext({
  adapter: memoryCmsAdapter,
  sudo: false,
  lists,
  schema,
  session: { itemId: 'x', listKey: 'Probe', data: { access: 'invalid' } },
}).graphql.raw({ query: 'mutation { createProbe(data:{label:"x"}) { id } }' })
const many = await anonymous.graphql.raw({
  query:
    'mutation { createProbes(data:[{label:"good"},{label:"before-bad"},{label:"validate-bad"},{label:"after-bad"}]) { label } }',
})
const persistedProbes = await memoryCmsAdapter.findMany('Probe', {
  orderBy: [{ label: 'asc' }],
  context: unrestricted,
})
const normaliseError = (error: any) => ({
  code: error.extensions?.code ?? null,
  message: error.message.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
})

console.log(
  JSON.stringify({
    denial: {
      errors: denied.errors?.map((error) => error.extensions.code) ?? [],
      one: denied.data?.person ?? null,
      many: denied.data?.people ?? null,
      count: denied.data?.peopleCount ?? null,
    },
    nested: {
      errors: nested.errors?.map((error) => error.extensions.code) ?? [],
      top: (nested.data?.people as Array<{ name: string }>).map(
        (item) => item.name,
      ),
      teams: (
        nested.data?.teams as Array<{
          name: string
          people: Array<{ name: string }>
          peopleCount: number
        }>
      ).map((team) => ({
        name: team.name,
        people: team.people.map((item) => item.name),
        count: team.peopleCount,
      })),
    },
    cursor: (cursor.data?.people as Array<{ name: string }>).map(
      (item) => item.name,
    ),
    filtersOrderPagination: Object.fromEntries(
      Object.entries(matrix.data ?? {}).map(([key, rows]) => [
        key,
        (rows as Array<{ name: string }>).map((item) => item.name),
      ]),
    ),
    inaccessibleCursor: {
      errors: accessCursor.errors?.map((error) => error.extensions.code) ?? [],
      rows:
        (accessCursor.data?.people as Array<{ name: string }> | undefined)?.map(
          (item) => item.name,
        ) ?? null,
    },
    context: {
      query: (contextQuery as Array<{ name: string }>).map((item) => item.name),
      db: (contextDb as unknown as Array<{ name: string }>).map(
        (item) => item.name,
      ),
    },
    reconciliation: {
      accessThrow: accessThrow.errors?.map(normaliseError) ?? [],
      accessInvalid: accessInvalid.errors?.map(normaliseError) ?? [],
      manyErrors:
        many.errors?.map((error: any) => error.extensions?.code ?? null) ?? [],
      manyData: (many.data as any)?.createProbes ?? null,
      persisted: (persistedProbes as any[]).map((item) => item.label),
      hookEvents: (globalThis as any).__probeEvents,
    },
  }),
)
