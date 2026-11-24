import assert from 'node:assert/strict'
import { graphql as executeGraphql, printSchema } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
} from '../src/features/cms/adapters'
import { config, initialiseLists, list } from '../src/features/cms/config'
import { allowAll } from '../src/features/cms/keystone/access'
import { fields } from '../src/features/cms/keystone/component-blocks'
import { structure } from '../src/features/cms/keystone/fields-document'
import { text } from '../src/features/cms/keystone/fields'
import { printCmsPrismaSchema } from '../src/features/cms/prisma-schema'
import {
  buildCmsContext,
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
} from '../src/features/cms/runtime'

export const structureSchema = fields.object({
  title: fields.text({ label: 'Title', defaultValue: 'Untitled' }),
  count: fields.integer({ label: 'Count', defaultValue: 1 }),
  author: fields.relationship({
    listKey: 'Person',
    label: 'Author',
    selection: 'name',
  }),
  reviewers: fields.relationship({
    listKey: 'Person',
    label: 'Reviewers',
    selection: 'name',
    many: true,
  }),
  tags: fields.array(fields.text({ label: 'Tag', defaultValue: '' })),
  mode: fields.conditional(
    fields.select({
      label: 'Mode',
      options: [
        { label: 'Plain', value: 'plain' },
        { label: 'Featured', value: 'featured' },
      ],
      defaultValue: 'plain',
    }),
    {
      plain: fields.text({ label: 'Normal', defaultValue: 'Normal' }),
      featured: fields.object({
        emphasis: fields.checkbox({
          label: 'Emphasis',
          defaultValue: false,
        }),
      }),
    },
  ),
})

assert.throws(
  () => structure({ schema: structureSchema, isIndexed: 'unique' }),
  /isIndexed: 'unique'.*structure/,
)
assert.throws(
  () =>
    initialiseLists(
      config({
        lists: {
          Broken: list({
            fields: {
              value: structure({
                schema: {
                  kind: 'relationship',
                  listKey: 'Missing',
                  label: 'Missing',
                  many: false,
                },
              }),
            },
          }),
        },
      }),
    ),
  /Broken\.value:.*no list named "Missing" exists/,
)

const cmsConfig = config({
  db: { provider: 'sqlite', url: 'file:./structure.db' },
  lists: {
    Person: list({
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
    Page: list({
      access: {
        operation: {
          query: allowAll,
          create: allowAll,
          update: allowAll,
          delete: allowAll,
        },
      },
      fields: {
        settings: structure({
          schema: structureSchema,
          db: { map: 'settings_json' },
        }),
      },
    }),
  },
})

const lists = initialiseLists(cmsConfig)
const prismaField = printCmsPrismaSchema(lists, cmsConfig.db)
  .split('\n')
  .find((line) => line.trimStart().startsWith('settings '))
  ?.trim()
assert(prismaField, 'structure Prisma field should be generated')
resetMemoryAdapter(
  { Person: [{ id: 'person-1', name: 'Ada' }], Page: [] },
  lists,
)
const schema = makeExecutableSchema({
  typeDefs: generateCmsTypeDefsForLists(lists),
  resolvers: generateCmsResolversForLists(lists),
})
const context = buildCmsContext({
  adapter: memoryCmsAdapter,
  lists,
  schema,
  sudo: true,
})

const run = async (source: string) => {
  const result = await executeGraphql({ schema, source, contextValue: context })
  if (result.errors?.length)
    throw new Error(result.errors.map((error) => error.message).join('\n'))
  return JSON.parse(JSON.stringify(result.data))
}

const schemaSource = printSchema(schema)
for (const expected of [
  'type PageSettingsOutput',
  'structure: PageSettings',
  'json(hydrateRelationships: Boolean! = false): JSON',
  'input PageSettingsCreateInput',
  'input PageSettingsUpdateInput',
  'interface PageSettingsMode',
])
  assert(
    schemaSource.includes(expected),
    `missing structure schema contract: ${expected}`,
  )

const defaults = await run(
  `mutation { createPage(data: {}) { id settings { json } } }`,
)
assert.deepEqual(defaults.createPage.settings.json, {
  title: 'Untitled',
  count: 1,
  author: null,
  reviewers: [],
  tags: [],
  mode: { discriminant: 'plain', value: 'Normal' },
})

const created = await run(`mutation { createPage(data: { settings: {
  title: "Launch", count: 2,
  author: { connect: { id: "person-1" } },
  reviewers: { connect: [{ id: "person-1" }] },
  tags: ["cms", "parity"],
  mode: { featured: { emphasis: true } }
} }) { id settings {
  structure { title count author { id name } reviewers { id name } tags }
  raw: json
  hydrated: json(hydrateRelationships: true)
} } }`)
assert.deepEqual(created.createPage.settings.structure, {
  title: 'Launch',
  count: 2,
  author: { id: 'person-1', name: 'Ada' },
  reviewers: [{ id: 'person-1', name: 'Ada' }],
  tags: ['cms', 'parity'],
})
assert.deepEqual(created.createPage.settings.raw.author, { id: 'person-1' })
assert.deepEqual(created.createPage.settings.hydrated.author, {
  id: 'person-1',
  label: 'Ada',
  data: { name: 'Ada' },
})

const updated =
  await run(`mutation { updatePage(where: { id: "${created.createPage.id}" }, data: {
  settings: { title: "Changed" }
}) { settings { json } } }`)
assert.equal(updated.updatePage.settings.json.title, 'Changed')
assert.equal(updated.updatePage.settings.json.count, 2)
assert.deepEqual(updated.updatePage.settings.json.tags, ['cms', 'parity'])
assert.deepEqual(updated.updatePage.settings.json.author, { id: 'person-1' })

const invalid = await executeGraphql({
  schema,
  source: `mutation { createPage(data: { settings: { count: 1.5 } }) { id } }`,
  contextValue: context,
})
assert(
  invalid.errors?.some((error) =>
    error.message.includes('Int cannot represent'),
  ),
)

const introspection = await run(`query { __schema { types { kind name } } }`)
const typeKinds = Object.fromEntries(
  introspection.__schema.types
    .filter((type: { name: string }) => type.name.startsWith('PageSettings'))
    .map((type: { kind: string; name: string }) => [type.name, type.kind]),
)

console.log(
  JSON.stringify({
    schema: {
      output: 'PageSettingsOutput',
      createInput: 'PageSettingsCreateInput',
      updateInput: 'PageSettingsUpdateInput',
      conditional: 'PageSettingsMode',
      typeKinds,
      prismaField,
    },
    defaults: defaults.createPage.settings.json,
    created: created.createPage.settings,
    updated: updated.updatePage.settings.json,
  }),
)
