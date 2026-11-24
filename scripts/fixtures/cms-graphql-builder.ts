import assert from 'node:assert/strict'

import {
  graphql as executeGraphql,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
} from 'graphql'

import { graphql } from '../../src/features/cms/keystone/core'

async function main() {
  const Tier = graphql.enum({
    name: 'BuilderTier',
    values: graphql.enumValues(['ADMIN', 'EDITOR']),
  })
  const Search = graphql.inputObject({
    name: 'BuilderSearch',
    fields: {
      text: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    },
  })
  const Node = graphql.interface<{ id: string }>()({
    name: 'BuilderNode',
    fields: {
      id: graphql.interfaceField({ type: graphql.nonNull(graphql.ID) }),
    },
    resolveType: () => 'BuilderEntity',
  })
  const Entity = graphql.object<{
    id: string
    name: string
    tier: 'ADMIN' | 'EDITOR'
  }>()({
    name: 'BuilderEntity',
    interfaces: [Node],
    fields: graphql.fields<{
      id: string
      name: string
      tier: 'ADMIN' | 'EDITOR'
    }>()({
      id: graphql.field({
        type: graphql.nonNull(graphql.ID),
        resolve: (source) => (source as { id: string }).id,
      }),
      name: graphql.field({
        type: graphql.nonNull(graphql.String),
        resolve: (source) => (source as { name: string }).name,
      }),
      tier: graphql.field({
        type: graphql.nonNull(Tier),
        resolve: (source) => (source as { tier: 'ADMIN' | 'EDITOR' }).tier,
      }),
    }),
  })
  const Result = graphql.union({
    name: 'BuilderResult',
    types: [Entity],
    resolveType: () => 'BuilderEntity',
  })
  const query = graphql.object()({
    name: 'Query',
    fields: {
      alive: graphql.field({
        type: graphql.nonNull(graphql.Boolean),
        resolve: () => true,
      }),
    },
  })
  const base = new GraphQLSchema({ query: query.graphQLType })
  const extended = graphql.extend((baseSchema) => ({
    query: {
      tier: graphql.field({
        type: Tier,
        resolve: () => 'ADMIN' as const,
      }),
      search: graphql.field({
        type: Result,
        args: { where: graphql.arg({ type: graphql.nonNull(Search) }) },
        resolve: (_root, { where }) => ({
          id: 'user-1',
          name: where.text,
          tier: 'EDITOR',
        }),
      }),
      aliveAgain: graphql.field({
        type: graphql.nonNull(graphql.Boolean),
        resolve: () => Boolean(baseSchema.object('Query')),
      }),
    },
  }))(base)

  const result = await executeGraphql({
    schema: extended,
    source:
      '{ alive aliveAgain tier search(where: { text: "Ada" }) { ... on BuilderEntity { id name tier } } }',
  })
  assert.deepEqual(result.errors, undefined)
  assert.deepEqual(JSON.parse(JSON.stringify(result.data)), {
    alive: true,
    aliveAgain: true,
    tier: 'ADMIN',
    search: { id: 'user-1', name: 'Ada', tier: 'EDITOR' },
  })

  assert.equal(
    graphql.wrap.object(Entity.graphQLType).graphQLType,
    Entity.graphQLType,
  )
  assert.equal(typeof graphql.scalar, 'function')
  assert.equal(graphql.JSON.graphQLType.name, 'JSON')
  assert.equal(graphql.Upload.graphQLType.name, 'Upload')
  assert.equal(graphql.DateTime.graphQLType.name, 'DateTime')

  const baseJson = new GraphQLScalarType({
    name: 'JSON',
    serialize: (value) => value,
  })
  const schemaWithJson = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: { alive: { type: graphql.Boolean.graphQLType } },
    }),
    types: [baseJson],
  })
  const jsonExtended = graphql.extend({
    query: {
      value: graphql.field({
        type: graphql.JSON,
        resolve: () => ({ exact: true }),
      }),
    },
  })(schemaWithJson)
  const jsonResult = await executeGraphql({
    schema: jsonExtended,
    source: '{ value }',
  })
  assert.deepEqual(JSON.parse(JSON.stringify(jsonResult.data)), {
    value: { exact: true },
  })

  console.info('CMS Core 6.5.1 GraphQL construction/extension parity passed.')
}

await main()
