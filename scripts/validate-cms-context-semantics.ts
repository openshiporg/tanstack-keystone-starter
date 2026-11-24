import assert from 'node:assert/strict'
import { makeExecutableSchema } from '@graphql-tools/schema'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
} from '../src/features/cms/adapters'
import { config, initialiseLists, list } from '../src/features/cms/config'
import { text } from '../src/features/cms/keystone/fields'
import {
  buildCmsContext,
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
} from '../src/features/cms/runtime'

const lists = initialiseLists(
  config({ lists: { ContextProbe: list({ fields: { label: text() } }) } }),
)
resetMemoryAdapter({ ContextProbe: [{ id: 'one', label: 'visible' }] }, lists)
const schema = makeExecutableSchema({
  typeDefs: generateCmsTypeDefsForLists(lists),
  resolvers: generateCmsResolversForLists(lists),
})
let transactionCalls = 0
const adapter = {
  ...memoryCmsAdapter,
  prisma: { marker: 'prisma passthrough' },
  transaction: async <T>(
    fn: (transactionAdapter: typeof memoryCmsAdapter) => Promise<T>,
  ) => {
    transactionCalls++
    return fn(memoryCmsAdapter)
  },
}
const request = new Request('http://context.test/original')
const headers = new Headers()
const context = buildCmsContext({
  adapter,
  lists,
  schema,
  sudo: false,
  session: {
    itemId: 'one',
    listKey: 'ContextProbe',
    data: { marker: 'session' },
  },
  request,
  responseHeaders: headers,
})

assert.equal(context.prisma, adapter.prisma)
assert.equal(context.graphql.schema, schema)
assert.deepEqual(
  JSON.parse(
    JSON.stringify(
      (await context.graphql.raw({ query: '{ contextProbes { label } }' }))
        .data,
    ),
  ),
  {
    contextProbes: [{ label: 'visible' }],
  },
)
assert.deepEqual(
  JSON.parse(
    JSON.stringify(
      await context.graphql.run({ query: '{ contextProbes { label } }' }),
    ),
  ),
  {
    contextProbes: [{ label: 'visible' }],
  },
)
await assert.rejects(() =>
  context.graphql.run({ query: '{ definitelyMissing }' }),
)
assert.equal(context.withSession(undefined).session, undefined)
assert.equal(
  context.withSession({ itemId: 'two', listKey: 'ContextProbe', data: {} })
    .session?.itemId,
  'two',
)
assert.equal(context.sudo().__internal.sudo, true)
assert.equal(context.sudo().__internal.internal, true)
assert.equal(context.internal().__internal.internal, true)
assert.equal(context.internal().__internal.sudo, false)
assert.equal(context.sudo().session, context.session)
assert.equal(context.__internal.request, request)
assert.equal(context.__internal.responseHeaders, headers)

await context.transaction(async (transactionContext) => {
  assert.equal(
    transactionContext.__internal.lists,
    lists,
    'transaction must retain caller-local list registry',
  )
  assert.equal(transactionContext.graphql.schema, schema)
  assert.equal(transactionContext.session, context.session)
  assert.equal(transactionContext.__internal.request, request)
  assert.equal(transactionContext.__internal.responseHeaders, headers)
  assert.equal(transactionContext.__internal.sudo, false)
  assert.equal(
    transactionContext.prisma,
    null,
    'transaction context reflects the transaction adapter',
  )
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        await transactionContext.query.ContextProbe.findMany({
          query: 'label',
        }),
      ),
    ),
    [{ label: 'visible' }],
  )
})
assert.equal(transactionCalls, 1)

console.log(
  'CMS context raw/run/sudo/internal/withSession/request-state/transaction/prisma semantics passed.',
)
