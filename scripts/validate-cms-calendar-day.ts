import assert from 'node:assert/strict'
import { graphql, printSchema } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
} from '../src/features/cms/adapters'
import { config, initialiseLists, list } from '../src/features/cms/config'
import { allowAll } from '../src/features/cms/keystone/access'
import { calendarDay, text } from '../src/features/cms/keystone/fields'
import { printCmsPrismaSchema } from '../src/features/cms/prisma-schema'
import {
  buildCmsContext,
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
} from '../src/features/cms/runtime'

const configured = (provider: 'sqlite' | 'postgresql') =>
  config({
    db: { provider },
    lists: {
      Event: list({
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
          day: calendarDay({ defaultValue: '2026-08-12', isIndexed: true }),
          uniqueDay: calendarDay({ isIndexed: 'unique' }),
        },
      }),
    },
  })

const sqliteLists = initialiseLists(configured('sqlite'))
const postgresLists = initialiseLists(configured('postgresql'))
const sqlitePrisma = printCmsPrismaSchema(sqliteLists, { provider: 'sqlite' })
const postgresPrisma = printCmsPrismaSchema(postgresLists, {
  provider: 'postgresql',
})
assert.match(sqlitePrisma, /day String\? @default\("2026-08-12"\)/)
assert.match(sqlitePrisma, /uniqueDay String\? @unique/)
assert.match(
  postgresPrisma,
  /day DateTime\? @default\("2026-08-12"\) @db\.Date/,
)
assert.match(postgresPrisma, /uniqueDay DateTime\? @unique @db\.Date/)

const schema = makeExecutableSchema({
  typeDefs: generateCmsTypeDefsForLists(sqliteLists),
  resolvers: generateCmsResolversForLists(sqliteLists),
})
const sdl = printSchema(schema)
assert.match(sdl, /scalar CalendarDay/)
assert.match(sdl, /day: CalendarDay/)
assert.match(sdl, /day: CalendarDayNullableFilter/)
assert.match(sdl, /uniqueDay: CalendarDay/)

resetMemoryAdapter({ Event: [] }, sqliteLists)
const context = buildCmsContext({
  adapter: memoryCmsAdapter,
  sudo: true,
  lists: sqliteLists,
  schema,
})
const result = await graphql({
  schema,
  contextValue: context,
  source: `mutation { createEvent(data:{name:"Launch",day:"2026-08-12",uniqueDay:"2026-08-13"}) { id day uniqueDay } }`,
})
assert.deepEqual(result.errors, undefined)
assert.equal((result.data?.createEvent as { day: string }).day, '2026-08-12')
const invalid = await graphql({
  schema,
  contextValue: context,
  source: `mutation { createEvent(data:{name:"Bad",day:"08/12/2026"}) { id } }`,
})
assert(invalid.errors?.some((error) => error.message.includes('CalendarDay')))

assert.throws(
  () => calendarDay({ defaultValue: '08/12/2026' }),
  /full-date ISO8601/,
)
console.log('CMS calendarDay parity validation passed.')
