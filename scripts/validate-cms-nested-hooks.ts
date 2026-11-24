import { graphql } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
  setCmsAdapterForTests,
} from '../src/features/cms/adapters'
import type { CmsContext } from '../src/features/cms/adapters'
import { initialiseLists } from '../src/features/cms/config'
import { config, list } from '../src/features/cms/keystone/core'
import { allowAll } from '../src/features/cms/keystone/access'
import { relationship, text } from '../src/features/cms/keystone/fields'
import {
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

const nestedHookConfig = config({
  lists: {
    Parent: list({
      access: {
        operation: {
          query: allowAll,
          create: allowAll,
          update: allowAll,
          delete: allowAll,
        },
      },
      fields: {
        name: text({
          validation: { isRequired: true },
          isNonNull: [true, true],
        }),
        slug: text({ isIndexed: 'unique' }),
        children: relationship({ ref: 'Child.parent', many: true }),
      },
      hooks: {
        afterOperation: ({ operation, item }) => {
          if (operation !== 'create') return
          const globalState = globalThis as typeof globalThis & {
            __cmsNestedHookEvents?: string[]
          }
          globalState.__cmsNestedHookEvents ??= []
          globalState.__cmsNestedHookEvents.push(`parent:${String(item.name)}`)
        },
      },
    }),
    Child: list({
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
          isIndexed: 'unique',
        }),
        parent: relationship({ ref: 'Parent.children' }),
      },
      hooks: {
        afterOperation: ({ operation, item }) => {
          if (operation !== 'create') return
          const globalState = globalThis as typeof globalThis & {
            __cmsNestedHookEvents?: string[]
          }
          globalState.__cmsNestedHookEvents ??= []
          globalState.__cmsNestedHookEvents.push(`child:${String(item.title)}`)
        },
      },
    }),
  },
})

const operationHookConfig = config({
  lists: {
    HookedThing: list({
      access: {
        operation: {
          query: allowAll,
          create: allowAll,
          update: allowAll,
          delete: allowAll,
        },
      },
      fields: {
        name: text({
          validation: { isRequired: true },
          isNonNull: [true, true],
          hooks: {
            validate: {
              create: ({ resolvedData }) => {
                if (resolvedData.name === 'deny-create')
                  throw new Error('field create denied')
              },
              update: ({ resolvedData }) => {
                if (resolvedData.name === 'deny-update')
                  throw new Error('field update denied')
              },
              delete: ({ item }) => {
                if (item?.name === 'deny-delete')
                  throw new Error('field delete denied')
              },
            },
          },
        }),
      },
      hooks: {
        validate: {
          create: ({ resolvedData }) => {
            if (resolvedData.name === 'deny-create-list')
              throw new Error('list create denied')
          },
          update: ({ resolvedData }) => {
            if (resolvedData.name === 'deny-update-list')
              throw new Error('list update denied')
          },
          delete: ({ item }) => {
            if (item?.name === 'deny-delete-list')
              throw new Error('list delete denied')
          },
        },
        beforeOperation: ({ operation, item }) => {
          if (operation !== 'delete') return
          const state = globalThis as typeof globalThis & {
            __cmsIsolatedDeleteHookEvents?: string[]
          }
          state.__cmsIsolatedDeleteHookEvents ??= []
          state.__cmsIsolatedDeleteHookEvents.push(
            `before:${String(item?.name)}`,
          )
        },
        afterOperation: ({ operation, item }) => {
          if (operation !== 'delete') return
          const state = globalThis as typeof globalThis & {
            __cmsIsolatedDeleteHookEvents?: string[]
          }
          state.__cmsIsolatedDeleteHookEvents ??= []
          state.__cmsIsolatedDeleteHookEvents.push(`after:${String(item.name)}`)
        },
      },
    }),
  },
})

async function main() {
  process.env.CMS_ADAPTER = 'memory'
  setCmsAdapterForTests(memoryCmsAdapter)

  const lists = initialiseLists(nestedHookConfig)
  resetMemoryAdapter({}, lists)

  const schema = makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(lists),
    resolvers: generateCmsResolversForLists(lists),
  })
  const contextValue = {
    adapter: memoryCmsAdapter,
    session: undefined,
    __internal: { sudo: true, lists },
    sudo() {
      return this
    },
  } as unknown as CmsContext

  const globalState = globalThis as typeof globalThis & {
    __cmsNestedHookEvents?: string[]
  }
  globalState.__cmsNestedHookEvents = []

  const createdResult = await graphql({
    schema,
    source: /* GraphQL */ `
      mutation ValidateNestedAfterOperationOrder {
        createChild(
          data: {
            title: "Nested Child"
            parent: { create: { name: "Nested Parent", slug: "nested-parent" } }
          }
        ) {
          id
          title
          parent {
            id
            name
          }
        }
      }
    `,
    contextValue,
  })
  if (createdResult.errors?.length)
    throw new Error(
      createdResult.errors.map((error) => error.message).join('\n'),
    )
  const createdChild = asRecord(asRecord(createdResult.data).createChild)
  assert(
    asRecord(createdChild.parent).name === 'Nested Parent',
    'nested relationship create should create the related parent item',
  )
  assert(
    (globalState.__cmsNestedHookEvents ?? []).join(',') ===
      'parent:Nested Parent,child:Nested Child',
    'nested afterOperation hooks should be deferred until top-level success, then run before the top-level afterOperation',
  )

  globalState.__cmsNestedHookEvents = []
  const rollbackResult = await graphql({
    schema,
    source: /* GraphQL */ `
      mutation ValidateNestedAfterOperationRollback {
        createChild(
          data: {
            title: "Nested Child"
            parent: {
              create: { name: "Rollback Parent", slug: "rollback-parent" }
            }
          }
        ) {
          id
        }
      }
    `,
    contextValue,
  })
  assert(
    rollbackResult.errors?.some((error) =>
      error.message.includes('Child.title must be unique'),
    ),
    'top-level child create should still fail on duplicate unique values after nested parent create attempts',
  )
  assert(
    (globalState.__cmsNestedHookEvents ?? []).length === 0,
    'deferred nested afterOperation hooks should not run when the top-level mutation fails',
  )

  const parentLookup = await graphql({
    schema,
    source: /* GraphQL */ `
      query ValidateNestedRollbackParentAbsence {
        parents(where: { slug: { equals: "rollback-parent" } }) {
          id
          name
        }
      }
    `,
    contextValue,
  })
  if (parentLookup.errors?.length)
    throw new Error(
      parentLookup.errors.map((error) => error.message).join('\n'),
    )
  assert(
    Array.isArray(asRecord(parentLookup.data).parents) &&
      (asRecord(parentLookup.data).parents as unknown[]).length === 0,
    'failed top-level mutations should not leave nested created parent rows behind in memory transactions',
  )

  const hookLists = initialiseLists(operationHookConfig)
  resetMemoryAdapter({}, hookLists)
  const hookSchema = makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(hookLists),
    resolvers: generateCmsResolversForLists(hookLists),
  })
  const hookContext = {
    adapter: memoryCmsAdapter,
    session: undefined,
    __internal: { sudo: true, lists: hookLists },
    sudo() {
      return this
    },
  } as unknown as CmsContext

  const createdAllowed = await graphql({
    schema: hookSchema,
    source: /* GraphQL */ `
      mutation AllowedCreate {
        createHookedThing(data: { name: "allowed" }) {
          id
          name
        }
      }
    `,
    contextValue: hookContext,
  })
  if (createdAllowed.errors?.length)
    throw new Error(
      createdAllowed.errors.map((error) => error.message).join('\n'),
    )
  const allowedId = String(
    asRecord(asRecord(createdAllowed.data).createHookedThing).id,
  )
  assert(
    allowedId.length > 0,
    'operation-keyed validate hooks should still allow successful creates',
  )

  const createFieldDenied = await graphql({
    schema: hookSchema,
    source: /* GraphQL */ `
      mutation DenyCreateField {
        createHookedThing(data: { name: "deny-create" }) {
          id
        }
      }
    `,
    contextValue: hookContext,
  })
  assert(
    createFieldDenied.errors?.some((error) =>
      error.message.includes('field create denied'),
    ),
    'field hooks.validate.create should run for create operations',
  )

  const createListDenied = await graphql({
    schema: hookSchema,
    source: /* GraphQL */ `
      mutation DenyCreateList {
        createHookedThing(data: { name: "deny-create-list" }) {
          id
        }
      }
    `,
    contextValue: hookContext,
  })
  assert(
    createListDenied.errors?.some((error) =>
      error.message.includes('list create denied'),
    ),
    'list hooks.validate.create should run for create operations',
  )

  const updateFieldDenied = await graphql({
    schema: hookSchema,
    source: /* GraphQL */ `
      mutation DenyUpdateField($id: ID!) {
        updateHookedThing(where: { id: $id }, data: { name: "deny-update" }) {
          id
        }
      }
    `,
    variableValues: { id: allowedId },
    contextValue: hookContext,
  })
  assert(
    updateFieldDenied.errors?.some((error) =>
      error.message.includes('field update denied'),
    ),
    'field hooks.validate.update should run for update operations',
  )

  const updateListDenied = await graphql({
    schema: hookSchema,
    source: /* GraphQL */ `
      mutation DenyUpdateList($id: ID!) {
        updateHookedThing(
          where: { id: $id }
          data: { name: "deny-update-list" }
        ) {
          id
        }
      }
    `,
    variableValues: { id: allowedId },
    contextValue: hookContext,
  })
  assert(
    updateListDenied.errors?.some((error) =>
      error.message.includes('list update denied'),
    ),
    'list hooks.validate.update should run for update operations',
  )

  const deleteHookState = globalThis as typeof globalThis & {
    __cmsIsolatedDeleteHookEvents?: string[]
  }
  deleteHookState.__cmsIsolatedDeleteHookEvents = []

  const createdDeleteFieldDenied = await graphql({
    schema: hookSchema,
    source: /* GraphQL */ `
      mutation CreateDeleteFieldDenied {
        createHookedThing(data: { name: "deny-delete" }) {
          id
        }
      }
    `,
    contextValue: hookContext,
  })
  if (createdDeleteFieldDenied.errors?.length)
    throw new Error(
      createdDeleteFieldDenied.errors.map((error) => error.message).join('\n'),
    )
  const deleteFieldDeniedId = String(
    asRecord(asRecord(createdDeleteFieldDenied.data).createHookedThing).id,
  )

  const deleteFieldDenied = await graphql({
    schema: hookSchema,
    source: /* GraphQL */ `
      mutation DenyDeleteField($id: ID!) {
        deleteHookedThing(where: { id: $id }) {
          id
        }
      }
    `,
    variableValues: { id: deleteFieldDeniedId },
    contextValue: hookContext,
  })
  assert(
    deleteFieldDenied.errors?.some((error) =>
      error.message.includes('field delete denied'),
    ),
    'field hooks.validate.delete should run for delete operations',
  )
  assert(
    deleteHookState.__cmsIsolatedDeleteHookEvents.length === 0,
    'delete validation failures should stop before beforeOperation and afterOperation hooks',
  )

  const createdDeleteListDenied = await graphql({
    schema: hookSchema,
    source: /* GraphQL */ `
      mutation CreateDeleteListDenied {
        createHookedThing(data: { name: "deny-delete-list" }) {
          id
        }
      }
    `,
    contextValue: hookContext,
  })
  if (createdDeleteListDenied.errors?.length)
    throw new Error(
      createdDeleteListDenied.errors.map((error) => error.message).join('\n'),
    )
  const deleteListDeniedId = String(
    asRecord(asRecord(createdDeleteListDenied.data).createHookedThing).id,
  )

  const deleteListDenied = await graphql({
    schema: hookSchema,
    source: /* GraphQL */ `
      mutation DenyDeleteList($id: ID!) {
        deleteHookedThing(where: { id: $id }) {
          id
        }
      }
    `,
    variableValues: { id: deleteListDeniedId },
    contextValue: hookContext,
  })
  assert(
    deleteListDenied.errors?.some((error) =>
      error.message.includes('list delete denied'),
    ),
    'list hooks.validate.delete should run for delete operations',
  )

  const createdDeleteAllowed = await graphql({
    schema: hookSchema,
    source: /* GraphQL */ `
      mutation CreateDeleteAllowed {
        createHookedThing(data: { name: "delete-allowed" }) {
          id
        }
      }
    `,
    contextValue: hookContext,
  })
  const deleteAllowedId = String(
    asRecord(asRecord(createdDeleteAllowed.data).createHookedThing).id,
  )
  deleteHookState.__cmsIsolatedDeleteHookEvents = []
  const deleteAllowed = await graphql({
    schema: hookSchema,
    source: /* GraphQL */ `
      mutation DeleteAllowed($id: ID!) {
        deleteHookedThing(where: { id: $id }) {
          id
        }
      }
    `,
    variableValues: { id: deleteAllowedId },
    contextValue: hookContext,
  })
  if (deleteAllowed.errors?.length)
    throw new Error(
      deleteAllowed.errors.map((error) => error.message).join('\n'),
    )
  assert(
    deleteHookState.__cmsIsolatedDeleteHookEvents.join(',') ===
      'before:delete-allowed,after:delete-allowed',
    'isolated delete hooks should run beforeOperation then afterOperation after validation succeeds',
  )

  console.info('CMS nested hook deferral validation passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
