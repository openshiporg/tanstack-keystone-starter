import { graphql } from 'graphql'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
  setCmsAdapterForTests,
} from '../src/features/cms/adapters'
import type { CmsContext } from '../src/features/cms/adapters'
import { config, initialiseLists, list } from '../src/features/cms/config'
import { text } from '../src/features/cms/keystone/fields'
import {
  getAdminMeta,
  getAdminMetaForContext,
} from '../src/features/cms/admin-meta'
import {
  createCmsContext,
  getCmsGraphQLSchema,
} from '../src/features/cms/runtime'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

async function execute(
  source: string,
  contextValue: Awaited<ReturnType<typeof createCmsContext>>,
) {
  const result = await graphql({
    schema: getCmsGraphQLSchema(),
    source,
    contextValue,
  })
  if (result.errors?.length)
    throw new Error(result.errors.map((error) => error.message).join('\n'))
  return result.data as Record<string, unknown>
}

async function main() {
  process.env.CMS_ADAPTER = 'memory'
  process.env.CMS_DEV_AUTH_FALLBACK = 'true'
  process.env.CMS_DEV_AUTH_ITEM_ID = 'user_admin'
  setCmsAdapterForTests(memoryCmsAdapter)
  resetMemoryAdapter()

  const publicContext = await createCmsContext(
    new Request('http://local.test/api/graphql'),
  )
  const publicAuth = await execute(
    /* GraphQL */ `
      query ValidatePublicAuthMeta {
        keystone {
          auth {
            listKey
            identityField
            secretField
            initFirstItemFields
          }
        }
      }
    `,
    publicContext,
  )
  const publicAuthMeta = asRecord(asRecord(publicAuth.keystone).auth)
  assert(publicAuthMeta.listKey === 'User', 'public auth list should be User')
  assert(
    publicAuthMeta.identityField === 'email',
    'public auth identity field should be email',
  )
  assert(
    publicAuthMeta.secretField === 'password',
    'public auth secret field should be password',
  )
  assert(
    JSON.stringify(publicAuthMeta.initFirstItemFields) ===
      JSON.stringify(['name', 'email', 'password']),
    'public auth metadata should include configured initial fields',
  )

  const adminContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { 'x-cms-user-id': 'user_admin' },
    }),
  )
  const editorContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { 'x-cms-user-id': 'user_editor' },
    }),
  )

  const adminMeta = await execute(
    /* GraphQL */ `
      query ValidateAdminItemFieldModes {
        keystone {
          adminMeta {
            isAccessAllowed
            list: itemList(key: "User", itemId: "user_admin") {
              hideCreate
              hideDelete
              graphql {
                names {
                  itemQueryName
                  listQueryName
                }
              }
              fields {
                key
                path
                isFilterable
                isOrderable
                isNonNull
                createView {
                  isRequired
                }
                itemView {
                  fieldMode
                }
              }
              field(key: "email") {
                key
                path
                itemField
                isFilterable
                isOrderable
                createView {
                  isRequired
                }
              }
            }
          }
        }
      }
    `,
    adminContext,
  )

  const editorMeta = await execute(
    /* GraphQL */ `
      query ValidateEditorItemFieldModes {
        keystone {
          adminMeta {
            otherUser: itemList(key: "User", itemId: "user_admin") {
              hideCreate
              hideDelete
              fields {
                key
                path
                itemView {
                  fieldMode
                }
              }
            }
            selfUser: itemList(key: "User", itemId: "user_editor") {
              fields {
                key
                path
                itemView {
                  fieldMode
                }
              }
            }
          }
        }
      }
    `,
    editorContext,
  )

  const adminMetaRoot = asRecord(asRecord(adminMeta.keystone).adminMeta)
  const adminList = asRecord(adminMetaRoot.list)
  const editorAdminMeta = asRecord(asRecord(editorMeta.keystone).adminMeta)
  const editorList = asRecord(editorAdminMeta.otherUser)
  const editorSelfList = asRecord(editorAdminMeta.selfUser)
  const adminGraphqlNames = asRecord(asRecord(adminList.graphql).names)
  assert(
    adminMetaRoot.isAccessAllowed === true,
    'admin meta should expose Keystone-style root isAccessAllowed for allowed access',
  )
  assert(
    typeof adminGraphqlNames.itemQueryName === 'string' &&
      typeof adminGraphqlNames.listQueryName === 'string',
    'admin meta should expose Keystone-style graphql.names on lists',
  )

  const adminFieldRecords = ((adminList.fields ?? []) as Array<unknown>).map(
    asRecord,
  )
  const adminEmailFieldByKey = asRecord(adminList.field)
  const adminFields = new Map(
    adminFieldRecords.map((record) => {
      const key = String(record.key ?? record.path)
      return [key, asRecord(asRecord(record).itemView).fieldMode]
    }),
  )
  const editorFields = new Map(
    ((editorList.fields ?? []) as Array<unknown>).map((field) => {
      const record = asRecord(field)
      const key = String(record.key ?? record.path)
      return [key, asRecord(asRecord(record).itemView).fieldMode]
    }),
  )
  const editorSelfFields = new Map(
    ((editorSelfList.fields ?? []) as Array<unknown>).map((field) => {
      const record = asRecord(field)
      const key = String(record.key ?? record.path)
      return [key, asRecord(asRecord(record).itemView).fieldMode]
    }),
  )

  assert(
    adminList.hideCreate === false && adminList.hideDelete === false,
    'admin user should see User list create/delete actions',
  )
  assert(
    editorList.hideCreate === true && editorList.hideDelete === true,
    'restricted editor should have User list create/delete actions hidden',
  )

  assert(
    adminFields.get('name') === 'edit',
    'admin should see User.name editable on item view',
  )
  assert(
    adminFields.get('email') === 'edit',
    'admin should see User.email editable on item view',
  )
  const adminEmailFieldMeta = adminFieldRecords.find(
    (field) => field.path === 'email' || field.key === 'email',
  )
  const adminNameFieldMeta = adminFieldRecords.find(
    (field) => field.path === 'name' || field.key === 'name',
  )
  assert(
    adminEmailFieldMeta,
    'User.email field meta should be present in admin meta',
  )
  assert(
    adminNameFieldMeta,
    'User.name field meta should be present in admin meta',
  )
  assert(
    adminEmailFieldMeta.isFilterable === false,
    'admin meta should honor normalized graphql/filter enablement for User.email filtering',
  )
  assert(
    adminEmailFieldByKey.path === 'email',
    'admin meta GraphQL keyed field lookup should return the requested field meta',
  )
  assert(
    adminEmailFieldByKey.itemField === 'ada@example.com',
    'admin meta GraphQL keyed field lookup should expose the current item field value for item-scoped lookups',
  )
  assert(
    adminEmailFieldByKey.isFilterable === false,
    'admin meta GraphQL keyed field lookup should preserve filterability metadata',
  )
  assert(
    adminEmailFieldMeta.isOrderable === false,
    'admin meta should honor normalized graphql/order enablement for User.email ordering',
  )
  assert(
    Array.isArray(adminEmailFieldMeta.isNonNull) &&
      adminEmailFieldMeta.isNonNull.includes('create') &&
      !adminEmailFieldMeta.isNonNull.includes('update'),
    'admin meta should derive create requiredness from validation without inventing update non-null metadata',
  )
  assert(
    asRecord(adminEmailFieldMeta.createView).isRequired === true,
    'admin meta should honor normalized graphql non-null metadata for User.email create requiredness',
  )
  assert(
    asRecord(adminNameFieldMeta.createView).isRequired === true,
    'admin meta should honor normalized graphql non-null metadata for User.name create requiredness',
  )
  assert(
    Array.isArray(adminNameFieldMeta.isNonNull) &&
      !adminNameFieldMeta.isNonNull.includes('read'),
    'admin meta should not invent read non-null metadata for User.name when it is not configured',
  )
  assert(
    editorFields.get('name') === 'read',
    'list.ui.itemView.defaultFieldMode should downgrade User.name to read for restricted editors',
  )
  assert(
    editorFields.get('email') === 'read',
    'list.ui.itemView.defaultFieldMode should downgrade User.email to read for restricted editors',
  )
  assert(
    editorFields.get('role') === 'read',
    'explicit field itemView config should still win for User.role',
  )
  assert(
    editorFields.get('tasks') === 'read',
    'list.ui.itemView.defaultFieldMode should also apply to relationship fields without explicit itemView overrides',
  )
  assert(
    editorFields.get('password') === 'read',
    'list.ui.itemView.defaultFieldMode should downgrade User.password to read when a restricted editor views another user',
  )
  assert(
    editorSelfFields.get('name') === 'edit',
    'list.ui.itemView.defaultFieldMode function should allow editors to edit their own User.name',
  )
  assert(
    editorSelfFields.get('email') === 'edit',
    'list.ui.itemView.defaultFieldMode function should allow editors to edit their own User.email',
  )
  assert(
    editorSelfFields.get('password') === 'edit',
    'field-level password update access should still allow self password edits',
  )
  assert(
    editorSelfFields.get('role') === 'read',
    'explicit field itemView config should still keep User.role read-only for editors on self view',
  )

  const staticAdminMeta = getAdminMeta()
  assert(
    staticAdminMeta.listsByKey.User.key === 'User',
    'admin meta source should expose listsByKey keyed by list key',
  )
  assert(
    staticAdminMeta.listsByKey.User.fieldsByKey.email.path === 'email',
    'admin meta source should expose fieldsByKey keyed by field key',
  )
  const staticUserNameField = staticAdminMeta.listsByKey.User.fieldsByKey.name
  assert(
    staticUserNameField.label === 'Name',
    'admin meta source field lookup should return full field meta objects',
  )
  const staticUserGroupWithFields = staticAdminMeta.listsByKey.User.groups.find(
    (group) => group.fields.length > 0,
  )
  if (staticUserGroupWithFields) {
    assert(
      Boolean(staticUserGroupWithFields.fields[0].field),
      'admin meta groups should retain full field references internally',
    )
    assert(
      staticUserGroupWithFields.fields[0].field?.key ===
        staticUserGroupWithFields.fields[0].key,
      'admin meta group field references should align with keyed field lookups',
    )
  }

  const contextualAdminMeta = await getAdminMetaForContext(adminContext)
  assert(
    contextualAdminMeta.listsByKey.User.key === 'User',
    'contextual admin meta should expose listsByKey keyed by list key',
  )
  assert(
    contextualAdminMeta.listsByKey.User.fieldsByKey.email.path === 'email',
    'contextual admin meta should expose fieldsByKey keyed by field key',
  )
  const contextualUserGroupWithFields =
    contextualAdminMeta.listsByKey.User.groups.find(
      (group) => group.fields.length > 0,
    )
  if (contextualUserGroupWithFields) {
    assert(
      Boolean(contextualUserGroupWithFields.fields[0].field),
      'contextual admin meta groups should retain full runtime field references internally',
    )
    assert(
      contextualUserGroupWithFields.fields[0].field.key ===
        contextualUserGroupWithFields.fields[0].key,
      'contextual admin meta group field references should align with keyed runtime field lookups',
    )
  }

  const configuredLabelAdminMeta = getAdminMeta(
    initialiseLists(
      config({
        lists: {
          Memo: list({
            ui: { labelField: 'subject' },
            fields: { subject: text(), details: text() },
          }),
        },
      }),
    ),
  )
  const memoAdminMeta = configuredLabelAdminMeta.listsByKey.Memo
  assert(
    memoAdminMeta.labelField === 'subject',
    'admin meta should expose a Keystone-standard ui.labelField configured with a nonconventional scalar name',
  )
  const editableMemoLabelField =
    memoAdminMeta.fieldsByKey[memoAdminMeta.labelField]
  assert(
    editableMemoLabelField?.path === 'subject' &&
      editableMemoLabelField.createView.fieldMode === 'edit',
    'generic editable-field lookup should resolve the configured AdminMeta label field',
  )

  const dynamicAdminMetaLists = initialiseLists(
    config({
      lists: {
        DynamicAdminMetaThing: list({
          ui: {
            hideNavigation: ({ session }) =>
              (session as { canSeeDynamicNav?: unknown } | undefined)
                ?.canSeeDynamicNav === true,
            listView: {
              initialFilter: ({ session }) =>
                (session as { narrowDynamicFilter?: unknown } | undefined)
                  ?.narrowDynamicFilter === true
                  ? { title: { contains: 'Visible' } }
                  : { title: { contains: 'All' } },
            },
          },
          fields: {
            title: text({
              isFilterable: ({ session }) =>
                Boolean(
                  (session as { canFilterDynamicTitle?: unknown } | undefined)
                    ?.canFilterDynamicTitle,
                ),
              isOrderable: ({ session }) =>
                Boolean(
                  (session as { canOrderDynamicTitle?: unknown } | undefined)
                    ?.canOrderDynamicTitle,
                ),
              createView: {
                isRequired: ({ session }) =>
                  Boolean(
                    (session as { requireDynamicTitle?: unknown } | undefined)
                      ?.requireDynamicTitle,
                  ),
              },
            }),
          },
        }),
      },
    }),
  )
  const dynamicAdminMetaContext = {
    ...adminContext,
    session: {
      canSeeDynamicNav: true,
      narrowDynamicFilter: true,
      canFilterDynamicTitle: true,
      canOrderDynamicTitle: false,
      requireDynamicTitle: true,
    },
  }
  const dynamicAdminMeta = await getAdminMetaForContext(
    dynamicAdminMetaContext as unknown as CmsContext,
    dynamicAdminMetaLists,
  )
  const dynamicList = dynamicAdminMeta.listsByKey.DynamicAdminMetaThing
  assert(
    dynamicList.hideNavigation === true,
    'contextual admin meta should evaluate dynamic hideNavigation',
  )
  assert(
    dynamicList.isHidden === true,
    'contextual admin meta should keep isHidden aligned with evaluated hideNavigation',
  )
  assert(
    asRecord(dynamicList.initialFilter).title,
    'contextual admin meta should evaluate dynamic initialFilter',
  )
  assert(
    dynamicList.fieldsByKey.title.isFilterable === true,
    'contextual admin meta should evaluate dynamic field isFilterable',
  )
  assert(
    dynamicList.fieldsByKey.title.isOrderable === false,
    'contextual admin meta should evaluate dynamic field isOrderable',
  )
  assert(
    asRecord(dynamicList.fieldsByKey.title.createView).isRequired === true,
    'contextual admin meta should evaluate dynamic createView.isRequired',
  )

  const roleEditorMeta = await execute(
    /* GraphQL */ `
      query ValidateRoleDefaultFieldMode {
        keystone {
          adminMeta {
            list: itemList(key: "Role", itemId: "role_admin") {
              fields {
                key
                path
                itemView {
                  fieldMode
                }
              }
            }
          }
        }
      }
    `,
    editorContext,
  )
  const roleFields = new Map(
    (
      (asRecord(asRecord(asRecord(roleEditorMeta.keystone).adminMeta).list)
        .fields ?? []) as Array<unknown>
    ).map((field) => {
      const record = asRecord(field)
      const key = String(record.key ?? record.path)
      return [key, asRecord(asRecord(record).itemView).fieldMode]
    }),
  )
  assert(
    roleFields.get('name') === 'read',
    'Role list itemView.defaultFieldMode should downgrade Role.name to read for restricted editors',
  )
  assert(
    roleFields.get('assignedTo') === 'read',
    'explicit Role.assignedTo itemView config should remain read',
  )

  const todoMeta = await execute(
    /* GraphQL */ `
      query ValidateDocumentFieldAdminMeta {
        keystone {
          adminMeta {
            list: itemList(key: "Todo", itemId: "todo_launch") {
              fields {
                key
                path
                fieldMeta
                isNonNull
              }
            }
          }
        }
      }
    `,
    adminContext,
  )
  const todoFields = (
    (asRecord(asRecord(asRecord(todoMeta.keystone).adminMeta).list).fields ??
      []) as Array<unknown>
  ).map(asRecord)
  const descriptionField = todoFields.find(
    (field) => field.path === 'description' || field.key === 'description',
  )
  const todoImagesField = todoFields.find(
    (field) => field.path === 'todoImages' || field.key === 'todoImages',
  )
  const secretNoteField = todoFields.find(
    (field) => field.path === 'secretNote' || field.key === 'secretNote',
  )
  assert(
    descriptionField,
    'Todo.description field meta should be present in admin meta',
  )
  assert(
    todoImagesField,
    'Todo.todoImages field meta should be present in admin meta',
  )
  assert(
    secretNoteField,
    'Todo.secretNote field meta should be present in admin meta',
  )
  const descriptionMeta = asRecord(descriptionField.fieldMeta)
  const todoImagesMeta = asRecord(todoImagesField.fieldMeta)
  const secretNoteMeta = asRecord(secretNoteField.fieldMeta)
  const documentFeatures = asRecord(descriptionMeta.documentFeatures)
  const formattingMeta = asRecord(documentFeatures.formatting)
  const inlineMarksMeta = asRecord(formattingMeta.inlineMarks)
  const listTypesMeta = asRecord(formattingMeta.listTypes)
  const alignmentMeta = asRecord(formattingMeta.alignment)
  const blockTypesMeta = asRecord(formattingMeta.blockTypes)
  assert(
    Array.isArray(descriptionField.isNonNull),
    'admin meta field should expose Keystone-style isNonNull list shape',
  )
  assert(
    descriptionMeta.graphqlSelection ===
      'description { document(hydrateRelationships: true) }',
    'document field should expose Keystone-style graphql selection in admin meta',
  )
  assert(
    Array.isArray(formattingMeta.headingLevels) &&
      formattingMeta.headingLevels.length === 6,
    'document field should expose normalized heading levels',
  )
  assert(
    inlineMarksMeta.bold === true && inlineMarksMeta.italic === true,
    'document field should expose normalized inline mark features',
  )
  assert(
    listTypesMeta.ordered === true && listTypesMeta.unordered === true,
    'document field should expose normalized list type features',
  )
  assert(
    alignmentMeta.center === true && alignmentMeta.end === true,
    'document field should expose normalized alignment features',
  )
  assert(
    blockTypesMeta.blockquote === true && blockTypesMeta.code === true,
    'document field should expose normalized block type features',
  )
  assert(
    documentFeatures.links === true,
    'document field should expose link support in admin meta',
  )
  assert(
    documentFeatures.dividers === true,
    'document field should expose divider support in admin meta',
  )
  assert(
    Array.isArray(documentFeatures.layouts) &&
      documentFeatures.layouts.length === 3,
    'document field should expose configured layout presets',
  )
  assert(
    Array.isArray(descriptionMeta.componentBlocksPassedOnServer),
    'document field should expose componentBlocksPassedOnServer in admin meta',
  )
  assert(
    asRecord(descriptionMeta.relationships),
    'document field should expose relationships metadata in admin meta',
  )
  const secretValidation = asRecord(secretNoteMeta.validation)
  const secretLength = asRecord(secretValidation.length)
  assert(
    typeof secretValidation.rejectCommon === 'boolean',
    'password field should expose rejectCommon validation metadata in admin meta',
  )
  assert(
    secretValidation.match === null ||
      typeof asRecord(secretValidation.match).explanation === 'string',
    'password field should expose match validation metadata shape in admin meta',
  )
  assert(
    typeof secretLength.min === 'number',
    'password field should expose validation length min in admin meta',
  )
  assert(
    'max' in secretLength,
    'password field should expose validation length max in admin meta',
  )
  assert(
    todoImagesMeta.displayMode === 'select' ||
      todoImagesMeta.displayMode === 'table' ||
      todoImagesMeta.displayMode === 'count' ||
      todoImagesMeta.displayMode === 'cards',
    'relationship field should expose a normalized displayMode in admin meta',
  )
  assert(
    todoImagesMeta.displayMode === 'cards',
    'Todo.todoImages should preserve cards displayMode in admin meta',
  )
  assert(
    todoImagesMeta.refListKey === 'TodoImage',
    'relationship field should expose refListKey in admin meta',
  )
  assert(
    todoImagesMeta.refFieldKey === 'todos',
    'relationship field should expose refFieldKey in admin meta',
  )
  assert(
    todoImagesMeta.hideCreate === false,
    'relationship field should expose hideCreate=false when related list create is enabled',
  )
  assert(
    Array.isArray(todoImagesMeta.refSearchFields) &&
      todoImagesMeta.refSearchFields.length > 0,
    'relationship field should expose refSearchFields in admin meta',
  )
  assert(
    Array.isArray(todoImagesMeta.cardFields) &&
      todoImagesMeta.cardFields.includes('image') &&
      todoImagesMeta.cardFields.includes('altText'),
    'cards relationship metadata should expose configured cardFields in admin meta',
  )
  assert(
    asRecord(todoImagesMeta.inlineCreate).fields &&
      Array.isArray(asRecord(todoImagesMeta.inlineCreate).fields),
    'cards relationship metadata should expose inlineCreate fields in admin meta',
  )
  assert(
    asRecord(todoImagesMeta.inlineEdit).fields &&
      Array.isArray(asRecord(todoImagesMeta.inlineEdit).fields),
    'cards relationship metadata should expose inlineEdit fields in admin meta',
  )
  assert(
    todoImagesMeta.inlineConnect === true,
    'cards relationship metadata should expose inlineConnect in admin meta',
  )
  assert(
    todoImagesMeta.linkToItem === false,
    'cards relationship metadata should expose linkToItem in admin meta',
  )
  assert(
    todoImagesMeta.removeMode === 'disconnect',
    'cards relationship metadata should expose removeMode in admin meta',
  )

  const roleAssignedToMeta = await execute(
    /* GraphQL */ `
      query ValidateRelationshipCountMeta {
        keystone {
          adminMeta {
            list: itemList(key: "Role", itemId: "role_admin") {
              fields {
                key
                path
                fieldMeta
              }
            }
          }
        }
      }
    `,
    adminContext,
  )
  const roleFieldsMeta = (
    (asRecord(asRecord(asRecord(roleAssignedToMeta.keystone).adminMeta).list)
      .fields ?? []) as Array<unknown>
  ).map(asRecord)
  const assignedToField = roleFieldsMeta.find(
    (field) => field.path === 'assignedTo' || field.key === 'assignedTo',
  )
  assert(
    assignedToField,
    'Role.assignedTo field meta should be present in admin meta',
  )
  const assignedToMeta = asRecord(assignedToField.fieldMeta)
  assert(
    assignedToMeta.displayMode === 'count' ||
      assignedToMeta.displayMode === 'select',
    'relationship field should expose normalized displayMode metadata',
  )
  assert(
    assignedToMeta.refListKey === 'User',
    'Role.assignedTo should expose User refListKey in admin meta',
  )
  assert(
    assignedToMeta.refFieldKey === 'role',
    'Role.assignedTo should expose refFieldKey in admin meta',
  )

  console.info('CMS adminMeta validation passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
