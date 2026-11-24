import { config, initialiseLists, list } from '../src/features/cms/config'
import { text } from '../src/features/cms/keystone/fields'
import { document } from '../src/features/cms/keystone/fields-document'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function expectDocumentConfigError(
  messageFragment: string,
  fieldConfig: Parameters<typeof document>[0],
) {
  let threw = false
  try {
    initialiseLists(
      config({
        lists: {
          DocumentThing: list({
            fields: {
              content: document(fieldConfig),
            },
          }),
        },
      }),
    )
  } catch (error) {
    threw = error instanceof Error && error.message.includes(messageFragment)
  }
  assert(threw, `document config should reject: ${messageFragment}`)
}

expectDocumentConfigError(
  "isIndexed: 'unique' is not a supported option for field type document",
  {
    isIndexed: 'unique',
  },
)

expectDocumentConfigError('no list named "MissingList" exists', {
  relationships: {
    author: {
      listKey: 'MissingList',
      label: 'Author',
    },
  },
})

expectDocumentConfigError('must include an object schema', {
  componentBlocks: {
    hero: {
      label: 'Hero',
    } as unknown as Record<string, unknown>,
  },
})

expectDocumentConfigError(
  'has the listKey "MissingList" but no list named "MissingList" exists',
  {
    componentBlocks: {
      hero: {
        label: 'Hero',
        schema: {
          author: {
            kind: 'relationship',
            listKey: 'MissingList',
          },
        },
      } as unknown as Record<string, unknown>,
    },
  },
)

const lists = initialiseLists(
  config({
    lists: {
      User: list({
        fields: {
          name: text(),
        },
      }),
      DocumentThing: list({
        fields: {
          content: document({
            relationships: {
              author: {
                listKey: 'User',
                label: 'Author',
              },
            },
          }),
        },
      }),
    },
  }),
)

const contentField = lists
  .find((entry) => entry.key === 'DocumentThing')
  ?.fields.find((field) => field.path === 'content')
const relationships = (contentField?.fieldMeta?.relationships ?? {}) as Record<
  string,
  unknown
>
const authorRelationship = (relationships.author ?? {}) as Record<
  string,
  unknown
>
assert(
  authorRelationship.listKey === 'User',
  'document relationships should preserve listKey metadata',
)
assert(
  authorRelationship.label === 'Author',
  'document relationships should preserve label metadata',
)
assert(
  authorRelationship.labelField === null,
  'document relationships should normalize missing labelField to null',
)
assert(
  authorRelationship.selection === null,
  'document relationships should normalize missing selection to null',
)
assert(
  authorRelationship.filter === null,
  'document relationships should normalize missing filter to null',
)
assert(
  authorRelationship.sort === null,
  'document relationships should normalize missing sort to null',
)

console.info('CMS document field validation passed.')
