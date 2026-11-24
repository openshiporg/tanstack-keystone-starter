import { graphql } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
  setCmsAdapterForTests,
} from '../src/features/cms/adapters'
import { initialiseLists } from '../src/features/cms/config'
import { allowAll } from '../src/features/cms/keystone/access'
import { config, list } from '../src/features/cms/keystone/core'
import { checkbox, text } from '../src/features/cms/keystone/fields'
import {
  buildCmsContext,
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
} from '../src/features/cms/runtime'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

const accessLists = initialiseLists(
  config({
    lists: {
      AccessRecord: list({
        access: {
          operation: {
            query: allowAll,
            create: allowAll,
            update: allowAll,
            delete: allowAll,
          },
          item: {
            update: ({ session, item }) => {
              const data = asRecord(session?.data)
              return (
                data.isAdmin === true ||
                (item?.ownerId === session?.itemId && item?.locked !== true)
              )
            },
          },
        },
        fields: {
          title: text({ validation: { isRequired: true } }),
          ownerId: text(),
          locked: checkbox({ defaultValue: false }),
          privateValue: text({
            access: {
              read: ({ context }) =>
                asRecord(context.session?.data).canReadPrivate === true,
            },
          }),
        },
      }),
    },
  }),
)

const schema = makeExecutableSchema({
  typeDefs: generateCmsTypeDefsForLists(accessLists),
  resolvers: generateCmsResolversForLists(accessLists),
})

function contextFor(
  itemId: string,
  data: Record<string, unknown>,
  sudo = false,
) {
  return buildCmsContext({
    adapter: memoryCmsAdapter,
    schema,
    lists: accessLists,
    sudo,
    session: { itemId, listKey: 'AccessActor', data },
  })
}

async function execute(
  source: string,
  contextValue: ReturnType<typeof contextFor>,
  variableValues?: Record<string, unknown>,
) {
  return graphql({ schema, source, contextValue, variableValues })
}

async function main() {
  process.env.CMS_ADAPTER = 'memory'
  setCmsAdapterForTests(memoryCmsAdapter)
  resetMemoryAdapter(
    {
      AccessRecord: [
        {
          id: 'owned_open',
          title: 'Owned open record',
          ownerId: 'editor_1',
          locked: false,
          privateValue: 'private-open',
        },
        {
          id: 'owned_locked',
          title: 'Owned locked record',
          ownerId: 'editor_1',
          locked: true,
          privateValue: 'private-locked',
        },
      ],
    },
    accessLists,
  )

  const editorContext = contextFor('editor_1', {
    isAdmin: false,
    canReadPrivate: false,
  })
  const editorRead = await execute(
    /* GraphQL */ `
      query ValidateIsolatedFieldReadAccess {
        accessRecords(orderBy: [{ title: asc }]) {
          id
          title
          privateValue
        }
      }
    `,
    editorContext,
  )
  if (editorRead.errors?.length)
    throw new Error(editorRead.errors.map((error) => error.message).join('\n'))
  const editorItems = asRecord(editorRead.data).accessRecords as unknown[]
  assert(
    editorItems.every((item) => asRecord(item).privateValue === null),
    'field read access should hide values in an isolated arbitrary-list fixture',
  )

  const sudoRead = await execute(
    /* GraphQL */ `
      query ValidateIsolatedFieldReadSudo {
        accessRecord(where: { id: "owned_locked" }) {
          privateValue
        }
      }
    `,
    contextFor('admin_1', { isAdmin: true, canReadPrivate: true }, true),
  )
  assert(
    asRecord(asRecord(sudoRead.data).accessRecord).privateValue ===
      'private-locked',
    'sudo should bypass isolated field read access',
  )

  const deniedUpdate = await execute(
    /* GraphQL */ `
      mutation ValidateIsolatedItemAccessDenied {
        updateAccessRecord(
          where: { id: "owned_locked" }
          data: { title: "Should not update" }
        ) {
          id
        }
      }
    `,
    editorContext,
  )
  assert(
    deniedUpdate.errors?.some((error) =>
      error.message.includes('Access denied'),
    ),
    'item update access should reject a locked arbitrary-list item',
  )

  const allowedUpdate = await execute(
    /* GraphQL */ `
      mutation ValidateIsolatedItemAccessAllowed {
        updateAccessRecord(
          where: { id: "owned_open" }
          data: { title: "Owned item updated" }
        ) {
          id
          title
        }
      }
    `,
    editorContext,
  )
  if (allowedUpdate.errors?.length)
    throw new Error(
      allowedUpdate.errors.map((error) => error.message).join('\n'),
    )
  assert(
    asRecord(asRecord(allowedUpdate.data).updateAccessRecord).title ===
      'Owned item updated',
    'item update access should allow an unlocked item owned by the session',
  )

  resetMemoryAdapter()
  console.log('CMS isolated item/field access validation passed.')
}

await main()
