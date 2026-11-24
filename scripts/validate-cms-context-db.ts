import {
  GraphQLID,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from 'graphql'
import { readFile } from 'node:fs/promises'

import {
  makeContextDbFn,
  makeContextQueryFn,
} from '../src/features/cms/runtime'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  const runtimePath =
    '/Users/junaid/code/tanstack-keystone-starter/src/features/cms/runtime.ts'
  const typesPath =
    '/Users/junaid/code/tanstack-keystone-starter/src/features/cms/adapters/types.ts'

  const [rawRuntimeSource, rawTypesSource] = await Promise.all([
    readFile(runtimePath, 'utf8'),
    readFile(typesPath, 'utf8'),
  ])
  const normalizeSource = (source: string) =>
    source
      .replace(/\s+/g, ' ')
      .replace(/\(\s+/g, '(')
      .replace(/,\s*\)/g, ')')
      .replace(/,\s*}/g, ' }')
  const runtimeSource = `${normalizeSource(rawRuntimeSource)}\n${rawRuntimeSource}`
  const typesSource = `${normalizeSource(rawTypesSource)}\n${rawTypesSource}`

  assert(
    typesSource.includes(
      'export type CmsContextDbRootValue = Record<string, unknown>',
    ),
    'context.db types should define a CmsContextDbRootValue helper',
  )
  assert(
    typesSource.includes(
      'findOne: (args?: { where?: CmsWhereUnique }, rootValue?: CmsContextDbRootValue) => Promise<CmsItem | null>',
    ),
    'context.db API should accept optional rootValue for findOne',
  )
  assert(
    typesSource.includes(
      "findMany: (args?: Omit<FindManyArgs, 'context'>, rootValue?: CmsContextDbRootValue) => Promise<CmsItem[]>",
    ),
    'context.db API should accept optional rootValue for findMany',
  )
  assert(
    typesSource.includes(
      'count: (args?: { where?: unknown }, rootValue?: CmsContextDbRootValue) => Promise<number>',
    ),
    'context.db API should accept optional rootValue for count',
  )
  assert(
    typesSource.includes(
      'createOne: (args: { data: Record<string, unknown> }, rootValue?: CmsContextDbRootValue) => Promise<CmsItem>',
    ),
    'context.db API should accept optional rootValue for createOne',
  )
  assert(
    typesSource.includes(
      'updateOne: (args: { where: CmsWhereUnique; data: Record<string, unknown> }, rootValue?: CmsContextDbRootValue) => Promise<CmsItem | null>',
    ),
    'context.db API should accept optional rootValue for updateOne',
  )
  assert(
    typesSource.includes(
      'deleteOne: (args: { where: CmsWhereUnique }, rootValue?: CmsContextDbRootValue) => Promise<CmsItem | null>',
    ),
    'context.db API should accept optional rootValue for deleteOne',
  )

  assert(
    runtimeSource.includes(
      'return async (args: Record<string, unknown>, context: CmsContext, rootValue: Record<string, unknown> = {}) => {',
    ),
    'makeContextDbFn should accept an optional rootValue argument',
  )
  assert(
    runtimeSource.includes('rootValue,'),
    'makeContextDbFn should forward rootValue into execute(...)',
  )
  assert(
    runtimeSource.includes('const fcache = {'),
    'buildContextDbApi should cache schema-derived executors',
  )
  assert(
    runtimeSource.includes(
      "findOne: schemaDerived('query', names.itemQueryName)",
    ),
    'buildContextDbApi should cache the findOne schema-derived executor',
  )
  assert(
    runtimeSource.includes(
      "findMany: schemaDerived('query', names.listQueryName)",
    ),
    'buildContextDbApi should cache the findMany schema-derived executor',
  )
  assert(
    runtimeSource.includes(
      "count: schemaDerived('query', names.listQueryCountName)",
    ),
    'buildContextDbApi should cache the count schema-derived executor',
  )
  assert(
    runtimeSource.includes('fcache.findOne({ where }, context, rootValue)'),
    'context.db findOne should forward rootValue into the cached executor',
  )
  assert(
    runtimeSource.includes(
      'fcache.findMany({ where: args.where, orderBy: args.orderBy, take: args.take, skip: args.skip, cursor: args.cursor }, context, rootValue)',
    ),
    'context.db findMany should forward rootValue into the cached executor',
  )
  assert(
    runtimeSource.includes(
      'fcache.count({ where: effectiveCountWhere(list, args.where) }, context, rootValue) as Promise<number>',
    ),
    'context.db count should forward rootValue into the cached executor',
  )
  assert(
    runtimeSource.includes(
      'fcache.updateOne({ where: args.where, data: args.data }, context, rootValue)',
    ),
    'context.db updateOne should forward rootValue into the cached executor',
  )
  assert(
    runtimeSource.includes(
      'fcache.deleteOne({ where: args.where }, context, rootValue)',
    ),
    'context.db deleteOne should forward rootValue into the cached executor',
  )
  assert(
    runtimeSource.includes('function makeContextQueryFn('),
    'runtime should define a local makeContextQueryFn helper for context.query parity',
  )
  assert(
    runtimeSource.includes('const rootName = getRootTypeName(field.type)'),
    'makeContextQueryFn should derive the root GraphQL type name from the field output type',
  )
  assert(
    runtimeSource.includes(
      'const validationErrors = validate(schema, document)',
    ),
    'makeContextQueryFn should validate the constructed document against the schema',
  )
  assert(
    runtimeSource.includes(
      'variableValues: Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined))',
    ),
    'makeContextQueryFn should filter undefined arg values before execution',
  )
  assert(
    runtimeSource.includes('rootValue: {},'),
    'makeContextQueryFn should execute with an explicit empty rootValue like Keystone query execution',
  )
  assert(
    runtimeSource.includes("return exec(args, query ?? 'id', context)"),
    'makeContextQueryFn should default query selections to id when none are provided',
  )
  assert(
    runtimeSource.includes(
      "function schemaDerived(operation: 'query' | 'mutation', fieldName: string)",
    ),
    'context.query should derive query executors from schema fields',
  )
  assert(
    runtimeSource.includes(
      'return makeContextQueryFn(context.graphql.schema, operation, field)',
    ),
    'context.query should use makeContextQueryFn for schema-derived execution',
  )
  assert(
    runtimeSource.includes(
      'const countSource = `query CmsContextCount($where: ${names.whereInputName}) { ${names.listQueryCountName}(where: $where) }`',
    ),
    'context.query should still cache the count source string outside the per-call function body',
  )
  assert(
    runtimeSource.includes(
      "findOne: supported.query ? schemaDerived('query', names.itemQueryName) : unsupportedContextOperation('query', names.itemQueryName)",
    ),
    'context.query should cache schema-derived findOne executors',
  )
  assert(
    runtimeSource.includes(
      "findMany: supported.query ? schemaDerived('query', names.listQueryName) : unsupportedContextOperation('query', names.listQueryName)",
    ),
    'context.query should cache schema-derived findMany executors',
  )
  assert(
    runtimeSource.includes(
      "createOne: supported.create ? schemaDerived('mutation', names.createMutationName) : unsupportedContextOperation('mutation', names.createMutationName)",
    ),
    'context.query should cache schema-derived createOne executors',
  )
  assert(
    runtimeSource.includes(
      "updateOne: supported.update ? schemaDerived('mutation', names.updateMutationName) : unsupportedContextOperation('mutation', names.updateMutationName)",
    ),
    'context.query should cache schema-derived updateOne executors',
  )
  assert(
    runtimeSource.includes(
      "deleteOne: supported.delete ? schemaDerived('mutation', names.deleteMutationName) : unsupportedContextOperation('mutation', names.deleteMutationName)",
    ),
    'context.query should cache schema-derived deleteOne executors',
  )
  const syntheticItemType = new GraphQLObjectType({
    name: 'SyntheticContextDbItem',
    fields: {
      id: { type: new GraphQLNonNull(GraphQLID) },
      label: { type: new GraphQLNonNull(GraphQLString) },
    },
  })

  const queryType = new GraphQLObjectType({
    name: 'SyntheticContextDbQuery',
    fields: {
      syntheticItem: {
        type: new GraphQLNonNull(syntheticItemType),
        args: {
          id: { type: new GraphQLNonNull(GraphQLID) },
        },
        resolve(source, args) {
          const root = source as Record<string, unknown>
          return {
            id: String(root.itemId ?? args.id),
            label: String(root.label ?? 'missing-root-value'),
          }
        },
      },
      syntheticQueryItem: {
        type: new GraphQLNonNull(syntheticItemType),
        args: {
          id: { type: new GraphQLNonNull(GraphQLID) },
          optional: { type: GraphQLString },
        },
        resolve(_source, args) {
          return {
            id: String(args.id),
            label:
              args.optional === undefined
                ? 'optional-omitted'
                : String(args.optional),
          }
        },
      },
    },
  })

  const field = queryType.getFields().syntheticItem
  assert(field, 'synthetic context.db field should exist')

  const executeContextDbField = makeContextDbFn(field)
  const result = await executeContextDbField(
    { id: 'fallback-id' },
    {} as never,
    { itemId: 42, label: 'root-value-forwarded' },
  )

  assert(
    typeof result === 'object' && result !== null,
    'makeContextDbFn should return an object result for object output fields',
  )
  assert(
    (result as Record<string, unknown>).id === '42',
    'makeContextDbFn should forward rootValue into execution so resolvers can source ids from rootValue',
  )
  assert(
    (result as Record<string, unknown>).label === 'root-value-forwarded',
    'makeContextDbFn should forward non-empty rootValue into execution so resolvers can read arbitrary rootValue fields',
  )

  const queryField = queryType.getFields().syntheticQueryItem
  assert(queryField, 'synthetic context.query field should exist')

  const querySchema = new GraphQLSchema({ query: queryType })
  const executeContextQueryField = makeContextQueryFn(
    querySchema,
    'query',
    queryField,
  )

  const defaultQueryResult = await executeContextQueryField(
    { id: 'abc', optional: undefined },
    {} as never,
  )
  assert(
    typeof defaultQueryResult === 'object' && defaultQueryResult !== null,
    'makeContextQueryFn should return an object result for object output fields',
  )
  assert(
    (defaultQueryResult as Record<string, unknown>).id === 'abc',
    'makeContextQueryFn should default query selection to id when none is provided',
  )
  assert(
    !('label' in (defaultQueryResult as Record<string, unknown>)),
    'default makeContextQueryFn selection should not include non-requested fields',
  )

  const explicitQueryResult = await executeContextQueryField(
    { id: 'xyz', optional: undefined, query: 'id label' },
    {} as never,
  )
  assert(
    (explicitQueryResult as Record<string, unknown>).id === 'xyz',
    'makeContextQueryFn should preserve explicitly selected id fields',
  )
  assert(
    (explicitQueryResult as Record<string, unknown>).label ===
      'optional-omitted',
    'makeContextQueryFn should execute successfully when undefined optional args are filtered out',
  )

  console.info('CMS context.db parity validation passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
