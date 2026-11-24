import { graphql } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
  setCmsAdapterForTests,
} from '../src/features/cms/adapters'
import type { CmsContext } from '../src/features/cms/adapters'
import { config, initialiseLists, list } from '../src/features/cms/config'
import { allowAll } from '../src/features/cms/keystone/access'
import {
  bigInt,
  decimal,
  relationship,
  text,
  timestamp,
} from '../src/features/cms/keystone/fields'
import {
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
} from '../src/features/cms/runtime'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const filterConfig = config({
  lists: {
    FilterThing: list({
      access: {
        operation: {
          query: allowAll,
          create: allowAll,
          update: allowAll,
          delete: allowAll,
        },
        filter: {
          query: () => ({ unknownField: { equals: 'nope' } }),
        },
      },
      fields: {
        name: text({
          validation: { isRequired: true },
          isNonNull: [true, true],
        }),
      },
    }),
    InvalidOperatorThing: list({
      access: {
        operation: {
          query: allowAll,
          create: allowAll,
          update: allowAll,
          delete: allowAll,
        },
        filter: {
          query: () => ({ name: { invalidOperator: 'nope' } }),
        },
      },
      fields: {
        name: text({
          validation: { isRequired: true },
          isNonNull: [true, true],
        }),
      },
    }),
    ScalarFilterThing: list({
      access: {
        operation: {
          query: allowAll,
          create: allowAll,
          update: allowAll,
          delete: allowAll,
        },
        filter: {
          query: () => ({
            name: { gt: 'A', mode: 'insensitive' },
            amount: { gte: '10.5', lt: '20.0' },
            bigCounter: { gt: '100', lte: '999999999999999999' },
            happenedAt: { gte: '2026-01-01T00:00:00.000Z' },
          }),
        },
      },
      fields: {
        name: text({
          validation: { isRequired: true },
          isNonNull: [true, true],
        }),
        amount: decimal(),
        bigCounter: bigInt(),
        happenedAt: timestamp(),
      },
    }),
    GraphqlDisabledFilterThing: list({
      access: {
        operation: {
          query: allowAll,
          create: allowAll,
          update: allowAll,
          delete: allowAll,
        },
        filter: {
          query: () => ({ secret: { contains: 'hidden' } }),
        },
      },
      fields: {
        secret: text({ graphql: { omit: { read: true } } }),
      },
    }),
    RelatedFilterUser: list({
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
        posts: relationship({ ref: 'RelatedFilterPost.author', many: true }),
      },
    }),
    RelatedFilterPost: list({
      access: {
        operation: {
          query: allowAll,
          create: allowAll,
          update: allowAll,
          delete: allowAll,
        },
        filter: {
          query: () => ({ author: { name: { contains: 'Ada' } } }),
        },
      },
      fields: {
        title: text({
          validation: { isRequired: true },
          isNonNull: [true, true],
        }),
        author: relationship({ ref: 'RelatedFilterUser.posts' }),
      },
    }),
    DynamicAccessThing: list({
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
          db: { isUnique: true },
          isFilterable: ({ session }) =>
            (session as { allowNameFilter?: unknown } | undefined)
              ?.allowNameFilter as boolean,
          isOrderable: ({ session }) =>
            (session as { allowNameOrder?: unknown } | undefined)
              ?.allowNameOrder as boolean,
        }),
        createdAt: timestamp({
          isOrderable: ({ session }) =>
            (session as { allowCreatedAtOrder?: unknown } | undefined)
              ?.allowCreatedAtOrder as boolean,
        }),
      },
    }),
    DynamicDefaultAccessThing: list({
      graphql: {
        defaultIsFilterable: ({ session }) =>
          (session as { allowDefaultFilter?: unknown } | undefined)
            ?.allowDefaultFilter as boolean,
        defaultIsOrderable: ({ session }) =>
          (session as { allowDefaultOrder?: unknown } | undefined)
            ?.allowDefaultOrder as boolean,
      },
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
          db: { isUnique: true },
        }),
      },
    }),
  },
})

async function execute(
  schema: ReturnType<typeof makeExecutableSchema>,
  source: string,
  contextValue: CmsContext,
) {
  return graphql({ schema, source, contextValue })
}

async function main() {
  process.env.CMS_ADAPTER = 'memory'
  setCmsAdapterForTests(memoryCmsAdapter)

  const lists = initialiseLists(filterConfig)
  resetMemoryAdapter(
    {
      FilterThing: [{ id: 'filter_1', name: 'Visible item' }],
      InvalidOperatorThing: [{ id: 'invalid_1', name: 'Visible item' }],
      ScalarFilterThing: [
        {
          id: 'scalar_1',
          name: 'Visible item',
          amount: '12.50',
          bigCounter: '500',
          happenedAt: '2026-02-01T00:00:00.000Z',
        },
      ],
      GraphqlDisabledFilterThing: [
        { id: 'disabled_1', secret: 'hidden value' },
      ],
      RelatedFilterUser: [{ id: 'rf_user_1', name: 'Ada Related' }],
      RelatedFilterPost: [
        {
          id: 'rf_post_1',
          title: 'Post with author filter',
          author: 'rf_user_1',
        },
      ],
      DynamicAccessThing: [
        {
          id: 'dynamic_1',
          name: 'Dynamic item',
          createdAt: '2026-02-02T10:00:00.000Z',
        },
      ],
      DynamicDefaultAccessThing: [
        { id: 'dynamic_default_1', title: 'Inherited dynamic item' },
      ],
    },
    lists,
  )

  const schema = makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(lists),
    resolvers: generateCmsResolversForLists(lists),
  })

  const context = {
    adapter: memoryCmsAdapter,
    session: undefined,
    prisma: null,
    __internal: { sudo: false, internal: false, lists },
    transaction: async <T>(fn: (context: CmsContext) => Promise<T>) =>
      fn(contextRef),
    withRequest: async () => contextRef,
    withSession: () => contextRef,
    internal: () => contextRef,
    sudo: () => ({
      ...contextRef,
      __internal: { ...contextRef.__internal, sudo: true },
    }),
    db: {},
    query: {},
    graphql: {
      schema,
      raw: async ({
        query,
        variables,
      }: Parameters<CmsContext['graphql']['raw']>[0]) =>
        graphql({
          schema,
          source: typeof query === 'string' ? query : '',
          variableValues: variables,
          contextValue: contextRef,
        }),
      run: async ({
        query,
        variables,
      }: Parameters<CmsContext['graphql']['run']>[0]) => {
        const result = await graphql({
          schema,
          source: typeof query === 'string' ? query : '',
          variableValues: variables,
          contextValue: contextRef,
        })
        if (result.errors?.length) throw result.errors[0]
        return (result.data ?? {}) as Record<string, unknown>
      },
    },
  } as unknown as CmsContext
  const contextRef = context

  const unknownFieldResult = await execute(
    schema,
    /* GraphQL */ `
      query ValidateUnknownFieldAccessFilter {
        filterThings {
          id
          name
        }
      }
    `,
    context,
  )
  assert(
    unknownFieldResult.errors?.length,
    'unknown-field access filters should fail instead of being ignored',
  )
  assert(
    unknownFieldResult.errors[0]?.message.includes(
      'invalid GraphQL where filter',
    ),
    'unknown-field access filters should fail through GraphQL where coercion',
  )
  assert(
    unknownFieldResult.errors[0]?.message.includes(
      'Field "unknownField" is not defined',
    ),
    'unknown-field access filters should surface GraphQL input field validation details',
  )

  const invalidOperatorResult = await execute(
    schema,
    /* GraphQL */ `
      query ValidateInvalidOperatorAccessFilter {
        invalidOperatorThings {
          id
          name
        }
      }
    `,
    context,
  )
  assert(
    invalidOperatorResult.errors?.length,
    'invalid-operator access filters should fail instead of being ignored',
  )
  assert(
    invalidOperatorResult.errors[0]?.message.includes(
      'invalid GraphQL where filter',
    ),
    'invalid-operator access filters should fail through GraphQL where coercion',
  )
  assert(
    invalidOperatorResult.errors[0]?.message.includes(
      'Field "invalidOperator" is not defined',
    ),
    'invalid-operator access filters should surface GraphQL operator validation details',
  )

  const scalarFilterResult = await execute(
    schema,
    /* GraphQL */ `
      query ValidateScalarAccessFilterOperators {
        scalarFilterThings {
          id
          name
        }
      }
    `,
    context,
  )
  assert(
    !scalarFilterResult.errors?.length,
    'expanded scalar access filters should be accepted for string/decimal/bigint/timestamp fields',
  )

  const graphqlDisabledFilterResult = await execute(
    schema,
    /* GraphQL */ `
      query ValidateGraphqlDisabledFilterAccess {
        graphqlDisabledFilterThings {
          id
        }
      }
    `,
    context,
  )
  assert(
    graphqlDisabledFilterResult.errors?.length,
    'access filters should fail when normalized graphql filter enablement disables a field',
  )
  assert(
    graphqlDisabledFilterResult.errors[0]?.message.includes(
      'invalid GraphQL where filter',
    ),
    'graphql-disabled filter fields should fail through GraphQL where coercion',
  )
  assert(
    graphqlDisabledFilterResult.errors[0]?.message.includes(
      'Field "secret" is not defined',
    ),
    'graphql-disabled filter fields should surface GraphQL field omission details',
  )

  const nestedRelationshipFilterResult = await execute(
    schema,
    /* GraphQL */ `
      query ValidateNestedRelationshipAccessFilter {
        relatedFilterPosts {
          id
          title
          author {
            id
            name
          }
        }
      }
    `,
    context,
  )
  assert(
    !nestedRelationshipFilterResult.errors?.length,
    'valid nested relationship access filters should pass GraphQL schema coercion',
  )
  assert(
    Array.isArray(
      (nestedRelationshipFilterResult.data as Record<string, unknown>)
        .relatedFilterPosts,
    ),
    'valid nested relationship access filters should still execute the list query',
  )

  const deniedDynamicFilterContext = {
    ...contextRef,
    session: { allowNameFilter: false, allowNameOrder: true },
  } as unknown as CmsContext
  const deniedDynamicFilterResult = await execute(
    schema,
    /* GraphQL */ `
      query ValidateDynamicFilterabilityDenied {
        dynamicAccessThings(where: { name: { contains: "Dynamic" } }) {
          id
          name
        }
      }
    `,
    deniedDynamicFilterContext,
  )
  assert(
    deniedDynamicFilterResult.errors?.length,
    'function-valued isFilterable false should deny query filters',
  )
  assert(
    deniedDynamicFilterResult.errors[0]?.message.includes(
      'You cannot filter by DynamicAccessThing.name',
    ),
    'function-valued isFilterable false should surface filter denial details',
  )

  const invalidDynamicFilterContext = {
    ...contextRef,
    session: { allowNameFilter: 'maybe' },
  } as unknown as CmsContext
  const invalidDynamicFilterResult = await execute(
    schema,
    /* GraphQL */ `
      query ValidateDynamicFilterabilityReturnType {
        dynamicAccessThings(where: { name: { contains: "Dynamic" } }) {
          id
          name
        }
      }
    `,
    invalidDynamicFilterContext,
  )
  assert(
    invalidDynamicFilterResult.errors?.length,
    'non-boolean isFilterable return values should fail',
  )
  assert(
    invalidDynamicFilterResult.errors[0]?.message.includes(
      'Invalid values returned from access control function.',
    ),
    'non-boolean isFilterable return values should surface access return failure details',
  )
  assert(
    invalidDynamicFilterResult.errors[0]?.message.includes(
      'DynamicAccessThing.name.isFilterable',
    ),
    'non-boolean isFilterable return values should identify the failing access control function',
  )

  const deniedDynamicOrderContext = {
    ...contextRef,
    session: { allowNameOrder: false },
  } as unknown as CmsContext
  const deniedDynamicOrderResult = await execute(
    schema,
    /* GraphQL */ `
      query ValidateDynamicOrderabilityDenied {
        dynamicAccessThings(orderBy: [{ name: asc }]) {
          id
          name
        }
      }
    `,
    deniedDynamicOrderContext,
  )
  assert(
    deniedDynamicOrderResult.errors?.length,
    'function-valued isOrderable false should deny orderBy',
  )
  assert(
    deniedDynamicOrderResult.errors[0]?.message.includes(
      'You cannot orderBy by DynamicAccessThing.name',
    ),
    'function-valued isOrderable false should surface order denial details',
  )

  const invalidDynamicOrderContext = {
    ...contextRef,
    session: { allowNameOrder: 'maybe' },
  } as unknown as CmsContext
  const invalidDynamicOrderResult = await execute(
    schema,
    /* GraphQL */ `
      query ValidateDynamicOrderabilityReturnType {
        dynamicAccessThings(orderBy: [{ name: asc }]) {
          id
          name
        }
      }
    `,
    invalidDynamicOrderContext,
  )
  assert(
    invalidDynamicOrderResult.errors?.length,
    'non-boolean isOrderable return values should fail',
  )
  assert(
    invalidDynamicOrderResult.errors[0]?.message.includes(
      'Invalid values returned from access control function.',
    ),
    'non-boolean isOrderable return values should surface access return failure details',
  )
  assert(
    invalidDynamicOrderResult.errors[0]?.message.includes(
      'DynamicAccessThing.name.isOrderable',
    ),
    'non-boolean isOrderable return values should identify the failing access control function',
  )

  const deniedDynamicCursorResult = await execute(
    schema,
    /* GraphQL */ `
      query ValidateDynamicCursorDenied {
        dynamicAccessThings(
          orderBy: [{ name: asc }]
          cursor: { name: "Dynamic item" }
        ) {
          id
          name
        }
      }
    `,
    deniedDynamicFilterContext,
  )
  assert(
    deniedDynamicCursorResult.errors?.length,
    'function-valued isFilterable false should deny cursor field access too',
  )
  assert(
    deniedDynamicCursorResult.errors[0]?.message.includes(
      'You cannot filter by DynamicAccessThing.name',
    ),
    'cursor access should reuse filter access checks',
  )

  const allowedDynamicContext = {
    ...contextRef,
    session: { allowNameFilter: true, allowNameOrder: true },
  } as unknown as CmsContext
  const allowedDynamicResult = await execute(
    schema,
    /* GraphQL */ `
      query ValidateDynamicFilterAndOrderAllowed {
        dynamicAccessThings(
          where: { name: { contains: "Dynamic" } }
          orderBy: [{ name: asc }]
        ) {
          id
          name
        }
      }
    `,
    allowedDynamicContext,
  )
  assert(
    !allowedDynamicResult.errors?.length,
    'function-valued filter/order access should allow matching queries when returning true',
  )

  const deniedDefaultDynamicContext = {
    ...contextRef,
    session: { allowDefaultFilter: false, allowDefaultOrder: true },
  } as unknown as CmsContext
  const deniedDefaultDynamicFilterResult = await execute(
    schema,
    /* GraphQL */ `
      query ValidateListDefaultFilterabilityDenied {
        dynamicDefaultAccessThings(
          where: { title: { contains: "Inherited" } }
        ) {
          id
          title
        }
      }
    `,
    deniedDefaultDynamicContext,
  )
  assert(
    deniedDefaultDynamicFilterResult.errors?.length,
    'list-level defaultIsFilterable false should deny inherited field filtering',
  )
  assert(
    deniedDefaultDynamicFilterResult.errors[0]?.message.includes(
      'You cannot filter by DynamicDefaultAccessThing.title',
    ),
    'list-level defaultIsFilterable false should surface inherited filter denial details',
  )

  const deniedDefaultDynamicOrderContext = {
    ...contextRef,
    session: { allowDefaultFilter: true, allowDefaultOrder: false },
  } as unknown as CmsContext
  const deniedDefaultDynamicOrderResult = await execute(
    schema,
    /* GraphQL */ `
      query ValidateListDefaultOrderabilityDenied {
        dynamicDefaultAccessThings(orderBy: [{ title: asc }]) {
          id
          title
        }
      }
    `,
    deniedDefaultDynamicOrderContext,
  )
  assert(
    deniedDefaultDynamicOrderResult.errors?.length,
    'list-level defaultIsOrderable false should deny inherited field orderBy',
  )
  assert(
    deniedDefaultDynamicOrderResult.errors[0]?.message.includes(
      'You cannot orderBy by DynamicDefaultAccessThing.title',
    ),
    'list-level defaultIsOrderable false should surface inherited order denial details',
  )

  const allowedDefaultDynamicContext = {
    ...contextRef,
    session: { allowDefaultFilter: true, allowDefaultOrder: true },
  } as unknown as CmsContext
  const allowedDefaultDynamicResult = await execute(
    schema,
    /* GraphQL */ `
      query ValidateListDefaultFilterAndOrderAllowed {
        dynamicDefaultAccessThings(
          where: { title: { contains: "Inherited" } }
          orderBy: [{ title: asc }]
        ) {
          id
          title
        }
      }
    `,
    allowedDefaultDynamicContext,
  )
  assert(
    !allowedDefaultDynamicResult.errors?.length,
    'list-level dynamic default filter/order controls should permit inherited field access when returning true',
  )

  console.info('CMS access filter validation passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
