import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { sanitizeUrl } from '@braintree/sanitize-url'
import { graphql } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
} from '../src/features/cms/adapters'
import { config, initialiseLists, list } from '../src/features/cms/config'
import { allowAll } from '../src/features/cms/keystone/access'
import { document } from '../src/features/cms/keystone/fields-document'
import {
  buildCmsContext,
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
  isValidDocumentUrl,
} from '../src/features/cms/runtime'

const oracleSource = await readFile(
  '/private/tmp/tanstack-keystone-parity-packages/keystone-6-fields-document-9.1.1/package/dist/isValidURL-3d5628de.esm.js',
  'utf8',
)
assert.match(
  oracleSource,
  /url === sanitizeUrl\(url\) \|\| url === encodeURI\(sanitizeUrl\(url\)\)/,
)

const values = [
  '',
  '/relative',
  'relative/path',
  '../up',
  '#anchor',
  '?q=1',
  'https://example.com/path',
  'https://example.com/a b',
  'mailto:person@example.test',
  'tel:+15551234567',
  'ftp://example.test/file',
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  'data:text/html,unsafe',
  'vbscript:unsafe',
]
for (const value of values) {
  const sanitized = sanitizeUrl(value)
  const oracle = value === sanitized || value === encodeURI(sanitized)
  assert.equal(
    isValidDocumentUrl(value),
    oracle,
    `link validation differs from fields-document 9.1.1 for ${JSON.stringify(value)}`,
  )
}
assert.equal(isValidDocumentUrl('/relative'), true)
assert.equal(isValidDocumentUrl('javascript:alert(1)'), false)

const configured = config({
  lists: {
    MigrationPage: list({
      access: {
        operation: {
          query: allowAll,
          create: allowAll,
          update: allowAll,
          delete: allowAll,
        },
      },
      fields: { content: document({ links: true }) },
    }),
  },
})
const lists = initialiseLists(configured)
resetMemoryAdapter({ MigrationPage: [] }, lists)
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
const relativeDocument = {
  document: [
    {
      type: 'paragraph',
      children: [
        {
          type: 'link',
          href: '/relative',
          children: [{ text: 'Existing relative link' }],
        },
      ],
    },
  ],
}
const created = await graphql({
  schema,
  contextValue: context,
  source: `mutation($content: JSON) { createMigrationPage(data: { content: $content }) { id content { document } } }`,
  variableValues: { content: relativeDocument },
})
assert.equal(created.errors, undefined)
const item = (created.data as { createMigrationPage: { id: string } })
  .createMigrationPage
const updated = await graphql({
  schema,
  contextValue: context,
  source: `mutation($id: ID!, $content: JSON) { updateMigrationPage(where: { id: $id }, data: { content: $content }) { content { document } } }`,
  variableValues: { id: item.id, content: relativeDocument },
})
assert.equal(updated.errors, undefined)
assert.equal(
  (
    updated.data as {
      updateMigrationPage: {
        content: { document: Array<{ children: Array<{ href: string }> }> }
      }
    }
  ).updateMigrationPage.content.document[0].children[0].href,
  '/relative',
)

const unsafe = await graphql({
  schema,
  contextValue: context,
  source: `mutation($content: JSON) { createMigrationPage(data: { content: $content }) { id } }`,
  variableValues: {
    content: {
      document: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'link',
              href: 'javascript:alert(1)',
              children: [{ text: 'unsafe' }],
            },
          ],
        },
      ],
    },
  },
})
assert(
  unsafe.errors?.some(
    (error) => error.extensions.code === 'KS_VALIDATION_FAILURE',
  ),
)

console.info(
  'fields-document 9.1.1 sanitize-url link and relative-link migration parity passed.',
)
