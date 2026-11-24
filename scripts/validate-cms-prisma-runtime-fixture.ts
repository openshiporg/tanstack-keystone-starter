import { graphql, printSchema } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'

import { createPrismaCmsAdapter } from '../src/features/cms/adapters/prisma'
import type { CmsContext, CmsItem } from '../src/features/cms/adapters'
import { initialiseLists } from '../src/features/cms/config'
import { allowAll } from '../src/features/cms/keystone/access'
import { config, list } from '../src/features/cms/keystone/core'
import {
  checkbox,
  integer,
  relationship,
  text,
} from '../src/features/cms/keystone/fields'
import {
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
} from '../src/features/cms/runtime'

type DelegateArgs = {
  where?: Record<string, unknown>
  data?: Record<string, unknown>
  orderBy?: Record<string, 'asc' | 'desc'>[]
  take?: number
  skip?: number
  cursor?: Record<string, unknown>
  include?: Record<string, boolean>
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T)
}

function createRuntimePrismaFixture() {
  const transactionCalls: Array<{
    options?: Record<string, unknown>
    prisma: unknown
  }> = []
  const store: Record<string, CmsItem[]> = {
    Product: [
      {
        id: 'product_seed',
        name: 'Seed Product',
        sku: 'seed-sku',
        isPublished: true,
        inventory: 5,
        posts: ['post_seed'],
      },
    ],
    PublishedPost: [
      {
        id: 'post_seed',
        title: 'Seed Post',
        slug: 'seed-post',
        product: 'product_seed',
      },
    ],
  }
  const counters: Record<string, number> = { Product: 1, PublishedPost: 1 }
  const listKeyByDelegate: Record<string, string> = {
    product: 'Product',
    publishedPost: 'PublishedPost',
  }

  function itemMatchesWhere(item: CmsItem, where: unknown): boolean {
    const filter = asRecord(where)
    if (Object.keys(filter).length === 0) return true
    if (
      Array.isArray(filter.AND) &&
      !filter.AND.every((entry) => itemMatchesWhere(item, entry))
    )
      return false
    for (const [key, rawValue] of Object.entries(filter)) {
      if (key === 'AND') continue
      const value = item[key]
      const filterValue = asRecord(rawValue)
      if (Object.keys(filterValue).length === 0) {
        if (value !== rawValue) return false
      } else {
        if ('equals' in filterValue && value !== filterValue.equals)
          return false
        if (
          typeof filterValue.contains === 'string' &&
          !String(value ?? '').includes(filterValue.contains)
        )
          return false
      }
    }
    return true
  }

  function sortItems(items: CmsItem[], orderBy: unknown) {
    const ordering = Array.isArray(orderBy)
      ? asRecord(orderBy[0])
      : asRecord(orderBy)
    const [fieldPath, direction] = Object.entries(ordering)[0] ?? []
    if (!fieldPath) return items
    return [...items].sort(
      (left, right) =>
        (direction === 'desc' ? -1 : 1) *
        String(left[fieldPath] ?? '').localeCompare(
          String(right[fieldPath] ?? ''),
          undefined,
          { numeric: true },
        ),
    )
  }

  function hydrate(
    listKey: string,
    item: CmsItem | null,
    include?: Record<string, boolean>,
  ) {
    if (!item) return null
    const hydrated = clone(item)
    if (listKey === 'Product' && include?.posts)
      hydrated.posts = store.PublishedPost.filter(
        (post) =>
          post.product === item.id ||
          (Array.isArray(item.posts) && item.posts.includes(post.id)),
      ).map(clone)
    if (listKey === 'PublishedPost' && include?.product)
      hydrated.product =
        store.Product.find((product) => product.id === item.product) ?? null
    return hydrated
  }

  function connectRelationship(
    listKey: string,
    item: CmsItem,
    relationKey: string,
    write: Record<string, unknown>,
  ) {
    const connectEntries = Array.isArray(write.connect)
      ? write.connect.map(asRecord)
      : []
    const setEntries = Array.isArray(write.set)
      ? write.set.map(asRecord)
      : undefined
    const disconnectEntries = Array.isArray(write.disconnect)
      ? write.disconnect.map(asRecord)
      : []
    if (listKey === 'Product' && relationKey === 'posts') {
      if (setEntries) {
        item.posts = setEntries.map((entry) => String(entry.id))
        for (const post of store.PublishedPost)
          post.product =
            Array.isArray(item.posts) && item.posts.includes(post.id)
              ? item.id
              : null
      }
      for (const entry of connectEntries) {
        const post = store.PublishedPost.find(
          (candidate) => candidate.id === entry.id,
        )
        if (post) {
          post.product = item.id
          item.posts = Array.from(
            new Set([
              ...(Array.isArray(item.posts) ? item.posts.map(String) : []),
              post.id,
            ]),
          )
        }
      }
      for (const entry of disconnectEntries) {
        const post = store.PublishedPost.find(
          (candidate) => candidate.id === entry.id,
        )
        if (post?.product === item.id) post.product = null
        item.posts = (Array.isArray(item.posts) ? item.posts : []).filter(
          (id) => id !== entry.id,
        )
      }
    }
    if (listKey === 'PublishedPost' && relationKey === 'product') {
      const connect = asRecord(write.connect)
      if (connect.id) item.product = String(connect.id)
      if (write.disconnect) item.product = null
    }
  }

  function applyData(
    listKey: string,
    item: CmsItem,
    data: Record<string, unknown>,
  ) {
    for (const [key, value] of Object.entries(data)) {
      const recordValue = asRecord(value)
      if (key === 'posts' || key === 'product')
        connectRelationship(listKey, item, key, recordValue)
      else item[key] = clone(value)
    }
  }

  function delegateFor(listKey: string) {
    const items = () => store[listKey]
    return {
      findUnique: async (args: DelegateArgs = {}) =>
        hydrate(
          listKey,
          items().find((item) => itemMatchesWhere(item, args.where)) ?? null,
          args.include,
        ),
      findFirst: async (args: DelegateArgs = {}) =>
        hydrate(
          listKey,
          items().find((item) => itemMatchesWhere(item, args.where)) ?? null,
          args.include,
        ),
      findMany: async (args: DelegateArgs = {}) =>
        sortItems(
          items().filter((item) => itemMatchesWhere(item, args.where)),
          args.orderBy,
        )
          .slice(
            args.skip ?? 0,
            args.take ? (args.skip ?? 0) + args.take : undefined,
          )
          .map((item) => hydrate(listKey, item, args.include)),
      count: async (args: DelegateArgs = {}) =>
        items().filter((item) => itemMatchesWhere(item, args.where)).length,
      create: async (args: DelegateArgs = {}) => {
        const item: CmsItem = {
          id: `${listKey.toLowerCase()}_${++counters[listKey]}`,
        }
        applyData(listKey, item, asRecord(args.data))
        if (listKey === 'Product' && !Array.isArray(item.posts)) item.posts = []
        store[listKey].push(item)
        return clone(item)
      },
      update: async (args: DelegateArgs = {}) => {
        const item = items().find((candidate) =>
          itemMatchesWhere(candidate, args.where),
        )
        if (!item) throw new Error(`Missing ${listKey} fixture item`)
        applyData(listKey, item, asRecord(args.data))
        return clone(item)
      },
      delete: async (args: DelegateArgs = {}) => {
        const index = items().findIndex((candidate) =>
          itemMatchesWhere(candidate, args.where),
        )
        if (index < 0) throw new Error(`Missing ${listKey} fixture item`)
        const [deleted] = store[listKey].splice(index, 1)
        return clone(deleted)
      },
    }
  }

  const delegates = Object.fromEntries(
    Object.entries(listKeyByDelegate).map(([delegateName, listKey]) => [
      delegateName,
      delegateFor(listKey),
    ]),
  ) as Record<string, unknown>

  const rootPrisma = {
    ...delegates,
    async $transaction<T>(
      fn: (transactionPrisma: Record<string, unknown>) => Promise<T>,
      options?: Record<string, unknown>,
    ) {
      transactionCalls.push({ options, prisma: rootPrisma })
      const storeSnapshot = clone(store)
      const counterSnapshot = clone(counters)
      const transactionPrisma = {
        ...delegates,
      }
      try {
        return await fn(transactionPrisma)
      } catch (error) {
        for (const key of Object.keys(store)) {
          store[key] = clone(storeSnapshot[key] ?? [])
        }
        for (const key of Object.keys(counters)) {
          counters[key] = counterSnapshot[key] ?? 0
        }
        throw error
      }
    },
    __transactionCalls: transactionCalls,
    __store: store,
  }

  return rootPrisma
}

const fixtureConfig = config({
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
      fields: {
        name: text({
          validation: { isRequired: true },
          isNonNull: [true, true],
        }),
        sku: text({ isIndexed: 'unique' }),
        isPublished: checkbox({ defaultValue: false }),
        inventory: integer({ defaultValue: 0 }),
        posts: relationship({ ref: 'PublishedPost.product', many: true }),
      },
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
      fields: {
        title: text({
          validation: { isRequired: true },
          isNonNull: [true, true],
        }),
        slug: text({ isIndexed: 'unique' }),
        product: relationship({ ref: 'Product.posts' }),
      },
    }),
  },
})

async function main() {
  const lists = initialiseLists(fixtureConfig)
  const prismaFixture = createRuntimePrismaFixture() as Record<string, unknown>
  const adapter = createPrismaCmsAdapter({
    prisma: prismaFixture as never,
    lists,
  })
  const schema = makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(lists),
    resolvers: generateCmsResolversForLists(lists),
  })
  const sdl = printSchema(schema)
  assert(
    sdl.includes('input ProductWhereUniqueInput') &&
      sdl.includes('sku: String'),
    'dynamic unique scalar fields should be exposed in WhereUniqueInput',
  )
  assert(
    sdl.includes('input PublishedPostWhereUniqueInput') &&
      sdl.includes('slug: String'),
    'relationship connect inputs should inherit unique scalar where fields',
  )

  const contextValue = {
    adapter,
    session: undefined,
    __internal: { sudo: true, lists },
    sudo() {
      return this
    },
  } as unknown as CmsContext

  const createdResult = await graphql({
    schema,
    source: /* GraphQL */ `
      mutation CreateThroughPrismaFixture {
        createProduct(
          data: {
            name: "Runtime Product"
            sku: "runtime-sku"
            inventory: 9
            posts: { connect: [{ slug: "seed-post" }] }
          }
        ) {
          id
          sku
          inventory
          posts {
            id
            slug
          }
          postsCount
        }
      }
    `,
    contextValue,
  })
  if (createdResult.errors?.length)
    throw new Error(
      createdResult.errors.map((error) => error.message).join('\n'),
    )
  const created = asRecord(asRecord(createdResult.data).createProduct)
  assert(
    created.sku === 'runtime-sku',
    'fixture Prisma adapter should create arbitrary-list scalar data',
  )
  assert(
    created.postsCount === 1,
    'fixture Prisma adapter should connect relationships by arbitrary unique scalar where values',
  )
  const createdId = String(created.id)

  const runtimeResult = await graphql({
    schema,
    source: /* GraphQL */ `
      mutation RuntimeFixtureCrud($id: ID!) {
        updateProduct(
          where: { sku: "runtime-sku" }
          data: { isPublished: true, inventory: 11 }
        ) {
          id
          sku
          isPublished
          inventory
        }
        updateProducts(
          data: [
            { where: { id: $id }, data: { name: "Runtime Product Updated" } }
          ]
        ) {
          id
          name
        }
        deleteProducts(where: [{ sku: "runtime-sku" }]) {
          id
          sku
        }
      }
    `,
    variableValues: { id: createdId },
    contextValue,
  })
  if (runtimeResult.errors?.length)
    throw new Error(
      runtimeResult.errors.map((error) => error.message).join('\n'),
    )
  const data = asRecord(runtimeResult.data)
  assert(
    asRecord(data.updateProduct).inventory === 11,
    'fixture Prisma adapter should update arbitrary-list items by unique scalar where',
  )
  assert(
    asRecord((data.updateProducts as unknown[])[0]).name ===
      'Runtime Product Updated',
    'fixture Prisma adapter should execute dynamic update-many against provided lists',
  )
  assert(
    asRecord((data.deleteProducts as unknown[])[0]).sku === 'runtime-sku',
    'fixture Prisma adapter should execute dynamic delete-many by unique scalar where',
  )

  const countResult = await graphql({
    schema,
    source: /* GraphQL */ `
      query RuntimeFixtureFindManyCount {
        products(where: { sku: { contains: "seed" } }) {
          id
          sku
        }
        productsCount(where: { sku: { contains: "seed" } })
      }
    `,
    contextValue,
  })
  if (countResult.errors?.length)
    throw new Error(countResult.errors.map((error) => error.message).join('\n'))
  assert(
    asRecord(countResult.data).productsCount === 1,
    'fixture Prisma adapter should execute arbitrary-list findMany/count filters',
  )

  const uniqueLookupResult = await graphql({
    schema,
    source: /* GraphQL */ `
      query RuntimeFixtureUniqueLookup {
        product(where: { sku: "seed-sku" }) {
          id
          sku
        }
      }
    `,
    contextValue,
  })
  if (uniqueLookupResult.errors?.length)
    throw new Error(
      uniqueLookupResult.errors.map((error) => error.message).join('\n'),
    )
  assert(
    asRecord(asRecord(uniqueLookupResult.data).product).id === 'product_seed',
    'fixture Prisma adapter should findOne by exactly one non-id unique scalar',
  )

  const multiUniqueResult = await graphql({
    schema,
    source: /* GraphQL */ `
      query RuntimeFixtureRejectMultiUnique {
        product(where: { id: "product_seed", sku: "seed-sku" }) {
          id
        }
      }
    `,
    contextValue,
  })
  assert(
    multiUniqueResult.errors?.some((error) =>
      error.message.includes(
        'ProductWhereUniqueInput must contain exactly one unique field',
      ),
    ),
    'fixture Prisma adapter should reject multi-field where unique inputs',
  )

  const emptyUniqueResult = await graphql({
    schema,
    source: /* GraphQL */ `
      mutation RuntimeFixtureRejectEmptyUnique {
        updateProduct(where: {}, data: { inventory: 12 }) {
          id
        }
      }
    `,
    contextValue,
  })
  assert(
    emptyUniqueResult.errors?.some((error) =>
      error.message.includes(
        'ProductWhereUniqueInput must contain exactly one unique field',
      ),
    ),
    'fixture Prisma adapter should reject empty where unique inputs',
  )

  const relationMultiUniqueResult = await graphql({
    schema,
    source: /* GraphQL */ `
      mutation RuntimeFixtureRejectRelationshipMultiUnique {
        createProduct(
          data: {
            name: "Invalid Unique Relation"
            sku: "invalid-unique-relation"
            posts: { connect: [{ id: "post_seed", slug: "seed-post" }] }
          }
        ) {
          id
        }
      }
    `,
    contextValue,
  })
  assert(
    relationMultiUniqueResult.errors?.some((error) =>
      error.message.includes(
        'PublishedPostWhereUniqueInput must contain exactly one unique field',
      ),
    ),
    'fixture Prisma adapter should reject relationship connect objects with multiple unique fields',
  )

  const transactionCallsBefore = (
    (prismaFixture.__transactionCalls ?? []) as Array<Record<string, unknown>>
  ).length
  const transactionResult = await adapter.transaction(
    async (transactionAdapter) => {
      const transactionCreated = await transactionAdapter.create('Product', {
        data: { name: 'Transaction Product', sku: 'txn-sku', inventory: 4 },
        context: contextValue,
      })
      const nestedCreated = await transactionAdapter.transaction(
        async (nestedAdapter) => {
          assert(
            nestedAdapter === transactionAdapter,
            'nested Prisma adapter transactions should short-circuit and reuse the active transaction adapter',
          )
          return nestedAdapter.create('Product', {
            data: {
              name: 'Nested Transaction Product',
              sku: 'txn-nested-sku',
              inventory: 6,
            },
            context: contextValue,
          })
        },
        {
          maxWait: 100,
          timeout: 200,
          isolationLevel: { Serializable: 'Serializable' },
        },
      )
      return { created: transactionCreated, nestedCreated }
    },
    {
      maxWait: 100,
      timeout: 200,
      isolationLevel: { Serializable: 'Serializable' },
    },
  )
  assert(
    asRecord(transactionResult.created).id,
    'fixture Prisma adapter should return created results from transaction callbacks',
  )
  assert(
    asRecord(transactionResult.nestedCreated).id,
    'fixture Prisma adapter should return nested created results from transaction callbacks',
  )
  const transactionCalls = (prismaFixture.__transactionCalls ?? []) as Array<
    Record<string, unknown>
  >
  const transactionCallsAfter = transactionCalls.length
  const explicitTransactionCalls = transactionCalls.slice(
    transactionCallsBefore,
  )
  assert(
    transactionCallsAfter === transactionCallsBefore + 1,
    'outer Prisma adapter transaction should add exactly one $transaction call even with nested transaction usage',
  )
  assert(
    explicitTransactionCalls.length === 1,
    'nested Prisma adapter transactions should not open an extra top-level $transaction call',
  )
  assert(
    asRecord(explicitTransactionCalls[0]?.options).maxWait === 100,
    'outer Prisma adapter transaction should forward maxWait options to $transaction',
  )
  assert(
    asRecord(explicitTransactionCalls[0]?.options).timeout === 200,
    'outer Prisma adapter transaction should forward timeout options to $transaction',
  )

  const rollbackError = await adapter
    .transaction(
      async (transactionAdapter) => {
        await transactionAdapter.create('Product', {
          data: {
            name: 'Rollback Product',
            sku: 'txn-rollback-sku',
            inventory: 1,
          },
          context: contextValue,
        })
        throw new Error('prisma transaction rollback sentinel')
      },
      {
        maxWait: 50,
        timeout: 75,
        isolationLevel: { Serializable: 'Serializable' },
      },
    )
    .catch((error) => error)
  assert(
    rollbackError instanceof Error &&
      rollbackError.message === 'prisma transaction rollback sentinel',
    'fixture Prisma adapter transaction errors should preserve the original thrown error',
  )
  const rollbackStore = (prismaFixture.__store ?? {}) as Record<
    string,
    CmsItem[]
  >
  assert(
    !rollbackStore.Product.some((item) => item.sku === 'txn-rollback-sku'),
    'fixture Prisma adapter transaction errors should roll back transaction-scoped writes',
  )

  const invalidManySetDisconnectResult = await graphql({
    schema,
    source: /* GraphQL */ `
      mutation RuntimeFixtureRejectManySetDisconnect {
        updateProduct(
          where: { sku: "seed-sku" }
          data: {
            posts: {
              set: [{ slug: "seed-post" }]
              disconnect: [{ slug: "seed-post" }]
            }
          }
        ) {
          id
        }
      }
    `,
    contextValue,
  })
  assert(
    invalidManySetDisconnectResult.errors?.some(
      (error) => error.extensions.code === 'KS_RELATIONSHIP_ERROR',
    ),
    'fixture Prisma adapter should reject to-many set+disconnect combinations',
  )

  console.info('CMS Prisma arbitrary runtime fixture validation passed.')
}

await main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
