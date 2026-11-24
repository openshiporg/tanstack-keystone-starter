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
import { text } from '../src/features/cms/keystone/fields'
import {
  buildCmsContext,
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
} from '../src/features/cms/runtime'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const singletonConfig = config({
  lists: {
    SiteSettings: list({
      singular: 'Site setting',
      plural: 'Site settings',
      isSingleton: true,
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
      },
    }),
  },
})

async function main() {
  process.env.CMS_ADAPTER = 'memory'
  setCmsAdapterForTests(memoryCmsAdapter)

  const lists = initialiseLists(singletonConfig)
  resetMemoryAdapter({ SiteSettings: [] }, lists)
  const schema = makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(lists),
    resolvers: generateCmsResolversForLists(lists),
  })
  const context: CmsContext = buildCmsContext({
    adapter: memoryCmsAdapter,
    sudo: true,
    schema,
    internal: false,
    lists,
  })

  const created = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateSingletonCreate {
        createSiteSettings(data: { title: "Main site" }) {
          id
          title
        }
      }
    `,
  })
  assert(
    !created.errors?.length,
    `singleton create should succeed: ${created.errors?.[0]?.message ?? 'unknown error'}`,
  )
  const createdItem = (
    created.data as Record<string, { id: string; title: string }>
  ).createSiteSettings
  assert(createdItem.id === '1', 'singleton create should force canonical id 1')

  const findOneWithoutWhere = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      query ValidateSingletonFindOneDefault {
        siteSettings {
          id
          title
        }
      }
    `,
  })
  assert(
    !findOneWithoutWhere.errors?.length,
    `singleton item query without where should succeed: ${findOneWithoutWhere.errors?.[0]?.message ?? 'unknown error'}`,
  )
  const fetched = (
    findOneWithoutWhere.data as Record<
      string,
      { id: string; title: string } | null
    >
  ).siteSettings
  assert(
    fetched?.id === '1',
    'singleton item query should default to singleton id 1',
  )

  const countWithoutWhere = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      query ValidateSingletonCountDefault {
        sitesettingsCount
      }
    `,
  })
  assert(
    !countWithoutWhere.errors?.length,
    `singleton count without where should succeed: ${countWithoutWhere.errors?.[0]?.message ?? 'unknown error'}`,
  )
  assert(
    (countWithoutWhere.data as Record<string, number>).sitesettingsCount === 1,
    'singleton count should default to canonical singleton filter',
  )

  const secondCreate = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateSingletonSecondCreateRejected {
        createSiteSettings(data: { title: "Duplicate" }) {
          id
        }
      }
    `,
  })
  assert(secondCreate.errors?.length, 'second singleton create should fail')

  const dbFindOne = await context.db.SiteSettings.findOne({})
  assert(
    dbFindOne?.id === '1',
    'context.db.findOne should default to singleton id 1',
  )
  const dbCount = await context.db.SiteSettings.count()
  assert(dbCount === 1, 'context.db.count should default to singleton filter')

  const queryFindOne = await context.query.SiteSettings.findOne({
    query: 'id title',
  })
  assert(
    (queryFindOne as { id: string } | null)?.id === '1',
    'context.query.findOne should default to singleton id 1',
  )
  const queryCount = await context.query.SiteSettings.count()
  assert(
    queryCount === 1,
    'context.query.count should default to singleton filter',
  )

  console.info('CMS singleton validation passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
