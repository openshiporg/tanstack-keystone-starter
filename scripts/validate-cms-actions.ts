import { graphql } from 'graphql'

import { config, group, list } from '../src/features/cms/keystone/core'
import { allowAll } from '../src/features/cms/keystone/access'
import { text } from '../src/features/cms/keystone/fields'
import { initialiseLists } from '../src/features/cms/config'
import {
  memoryCmsAdapter,
  resetMemoryAdapter,
  setCmsAdapterForTests,
} from '../src/features/cms/adapters'
import {
  buildCmsContext,
  createCmsContext,
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
} from '../src/features/cms/runtime'
import { makeExecutableSchema } from '@graphql-tools/schema'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

const actionsConfig = config({
  db: { provider: 'sqlite', url: 'file:./actions-fixture.db' },
  lists: {
    Task: list({
      access: {
        operation: {
          query: allowAll,
          create: allowAll,
          update: allowAll,
          delete: allowAll,
        },
      },
      actions: {
        archive: {
          access: () => true,
          resolve: async ({ where }, context) => {
            return context.adapter.update('Task', {
              where,
              data: { title: 'Archived task' },
              context,
            })
          },
          ui: {
            label: 'Archive',
            messages: {
              success: 'Archived {singular}.',
            },
            itemView: {
              navigation: 'refetch',
              hideToast: true,
            },
          },
        },
        disableForDone: {
          access: () => true,
          resolve: async ({ where }, context) =>
            context.adapter.findUnique('Task', where, context),
          ui: {
            label: 'Disable For Done',
            itemView: {
              actionMode: ({ item }) =>
                item?.title === 'done' ? 'disabled' : 'enabled',
            },
          },
        },
      },
      ui: { searchFields: ['title'] },
      fields: {
        ...group({
          label: 'Task details',
          description: 'Dynamic AdminMeta fixture',
          fields: {
            title: text({
              validation: { isRequired: true },
              isNonNull: [true, true],
              search: 'insensitive',
              ui: { views: './fixtures/task-title-view' },
              itemView: {
                fieldMode: ({ item }) =>
                  item?.title === 'done' ? 'read' : 'edit',
                fieldPosition: ({ item }) =>
                  item?.title === 'done' ? 'sidebar' : 'form',
              },
            }),
          },
        }),
      },
    }),
  },
})

async function main() {
  process.env.CMS_ADAPTER = 'memory'
  setCmsAdapterForTests(memoryCmsAdapter)
  const lists = initialiseLists(actionsConfig)
  resetMemoryAdapter(
    {
      Task: [
        { id: 'task_1', title: 'todo' },
        { id: 'task_2', title: 'done' },
      ],
    },
    lists,
  )
  const schema = makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(lists),
    resolvers: generateCmsResolversForLists(lists),
  })
  const baseContext = await createCmsContext(
    new Request('http://local.test/api/graphql'),
    schema,
  )
  const context = buildCmsContext({
    adapter: baseContext.adapter,
    session: baseContext.session,
    sudo: true,
    internal: false,
    schema,
    request: baseContext.__internal.request,
    responseHeaders: baseContext.__internal.responseHeaders,
    lists,
  })

  const adminMetaResult = await graphql({
    schema,
    source: /* GraphQL */ `
      query ValidateAdminActions {
        keystone {
          adminMeta {
            list: itemList(key: "Task", itemId: "task_1") {
              initialSearchFields
              groups {
                label
                description
                fields {
                  key
                }
              }
              fields {
                key
                search
                customViewsIndex
                isOrderable
                isFilterable
                itemView {
                  fieldMode
                  fieldPosition
                }
              }
              actions {
                key
                label
                graphql {
                  names {
                    one
                    many
                  }
                }
                messages {
                  success
                }
                itemView {
                  actionMode
                  navigation
                  hideToast
                }
                listView {
                  actionMode
                }
              }
            }
            doneTask: itemList(key: "Task", itemId: "task_2") {
              fields {
                key
                itemView {
                  fieldMode
                  fieldPosition
                }
              }
              actions {
                key
                itemView {
                  actionMode
                }
              }
            }
          }
        }
      }
    `,
    contextValue: context,
  })
  if (adminMetaResult.errors?.length)
    throw new Error(
      adminMetaResult.errors.map((error) => error.message).join('\n'),
    )
  const adminMeta = asRecord(asRecord(adminMetaResult.data).keystone)
    .adminMeta as Record<string, unknown>
  const taskListMeta = asRecord(adminMeta.list)
  const taskFields = (taskListMeta.fields ?? []) as Array<
    Record<string, unknown>
  >
  const titleMeta = taskFields.find((field) => field.key === 'title')
  assert(
    JSON.stringify(taskListMeta.initialSearchFields) ===
      JSON.stringify(['title']),
    'adminMeta should preserve configured search-field order',
  )
  assert(
    asRecord(((taskListMeta.groups ?? []) as Array<unknown>)[0]).label ===
      'Task details',
    'adminMeta should preserve field groups and their order',
  )
  assert(
    titleMeta?.search === 'insensitive' &&
      typeof titleMeta.customViewsIndex === 'number' &&
      titleMeta.isOrderable === true &&
      titleMeta.isFilterable === true,
    'adminMeta should preserve insensitive search, custom view, order, and filter capabilities',
  )
  assert(
    asRecord(titleMeta?.itemView).fieldMode === 'edit' &&
      asRecord(titleMeta?.itemView).fieldPosition === 'form',
    'item AdminMeta should evaluate dynamic mode and position against the selected item',
  )
  const doneTitleMeta = (
    (asRecord(adminMeta.doneTask).fields ?? []) as Array<
      Record<string, unknown>
    >
  ).find((field) => field.key === 'title')
  assert(
    asRecord(doneTitleMeta?.itemView).fieldMode === 'read' &&
      asRecord(doneTitleMeta?.itemView).fieldPosition === 'sidebar',
    'dynamic item field mode and position should vary by selected item',
  )

  const actions = (taskListMeta.actions ?? []) as Array<Record<string, unknown>>
  const archive = actions.find((action) => action.key === 'archive')
  assert(archive, 'adminMeta should include custom actions')
  assert(
    asRecord(asRecord(archive.graphql).names).one === 'archiveTask',
    'adminMeta should derive singular GraphQL action names',
  )
  assert(
    asRecord(asRecord(archive.graphql).names).many === 'archiveTasks',
    'adminMeta should derive plural GraphQL action names',
  )
  assert(
    asRecord(archive.messages).success === 'Archived {singular}.',
    'adminMeta should expose custom success messages',
  )
  assert(
    asRecord(archive.itemView).navigation === 'refetch',
    'adminMeta should expose itemView navigation',
  )
  assert(
    asRecord(archive.itemView).hideToast === true,
    'adminMeta should expose itemView hideToast',
  )
  const doneTaskActions = (asRecord(adminMeta.doneTask).actions ?? []) as Array<
    Record<string, unknown>
  >
  const disableForDone = doneTaskActions.find(
    (action) => action.key === 'disableForDone',
  )
  assert(
    asRecord(disableForDone?.itemView).actionMode === 'disabled',
    'runtime adminMeta should evaluate actionMode functions against the current item',
  )

  const actionResult = await graphql({
    schema,
    source: /* GraphQL */ `
      mutation ValidateActionMutation {
        archiveTask(where: { id: "task_1" }) {
          id
          title
        }
      }
    `,
    contextValue: context,
  })
  if (actionResult.errors?.length)
    throw new Error(
      actionResult.errors.map((error) => error.message).join('\n'),
    )
  const archivedTask = asRecord(asRecord(actionResult.data).archiveTask)
  assert(
    archivedTask.title === 'Archived task',
    'action mutation should be added to the runtime schema and resolve through custom action handlers',
  )

  console.info('CMS actions validation passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
