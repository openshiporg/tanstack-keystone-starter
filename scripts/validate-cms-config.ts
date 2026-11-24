import { config, group, list } from '../src/features/cms/keystone/core'
import { initialiseLists } from '../src/features/cms/config'
import {
  image,
  integer,
  relationship,
  text,
} from '../src/features/cms/keystone/fields'
import { Role } from '../src/features/cms/models/Role'
import { Todo } from '../src/features/cms/models/Todo'
import { TodoImage } from '../src/features/cms/models/TodoImage'
import { User } from '../src/features/cms/models/User'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function expectRelationshipInitFailure(run: () => unknown, message: string) {
  let failure: unknown = null
  try {
    run()
  } catch (error) {
    failure = error
  }
  assert(
    failure instanceof Error,
    'expected relationship initialization to fail',
  )
  assert(
    failure.message.includes(message),
    `expected relationship initialization failure to include: ${message}`,
  )
}

function main() {
  const minimalConfig = config({
    lists: {
      Post: list({
        fields: {
          title: text(),
        },
      }),
    },
  })

  const dbConfig = minimalConfig.db
  const graphqlConfig = minimalConfig.graphql
  const serverConfig = minimalConfig.server
  const uiConfig = minimalConfig.ui

  assert(
    dbConfig.provider === 'postgresql',
    'config() should default db.provider to postgresql',
  )
  assert(dbConfig.url === 'postgres://', 'config() should default db.url')
  assert(
    dbConfig.idField?.kind === 'cuid',
    'config() should default db.idField.kind to cuid',
  )
  assert(
    Array.isArray(dbConfig.enableLogging) &&
      dbConfig.enableLogging.length === 0,
    'config() should normalize db.enableLogging=false/undefined to []',
  )
  assert(
    graphqlConfig.path === '/api/graphql',
    'config() should default graphql.path to /api/graphql',
  )
  assert(
    graphqlConfig.schemaPath === 'schema.graphql',
    'config() should default graphql.schemaPath',
  )
  assert(
    serverConfig.port === 3000,
    'config() should default server.port to 3000',
  )
  assert(
    serverConfig.maxFileSize === 200 * 1024 * 1024,
    'config() should default server.maxFileSize to 200 MiB',
  )
  assert(
    uiConfig.basePath === '',
    'config() should default ui.basePath to an empty string',
  )
  assert(
    Array.isArray(uiConfig.publicPages) && uiConfig.publicPages.length === 0,
    'config() should default ui.publicPages to []',
  )

  const initializedMinimal = initialiseLists(minimalConfig)
  const labelDefaultLists = initialiseLists(
    config({
      lists: {
        LabelDefault: list({
          fields: { title: text(), name: text(), label: text() },
        }),
        NameDefault: list({ fields: { title: text(), name: text() } }),
        TitleDefault: list({ fields: { title: text() } }),
        IdDefault: list({ fields: { code: integer(), summary: text() } }),
      },
    }),
  )
  assert(
    labelDefaultLists.map((entry) => entry.labelField).join(',') ===
      'label,name,title,id',
    'list labelField defaults should follow Keystone label/name/title/id precedence instead of selecting an arbitrary first field',
  )

  const configuredLabelFieldLists = initialiseLists(
    config({
      lists: {
        UiLabelField: list({
          ui: { labelField: 'subject' },
          fields: { subject: text(), rank: integer() },
        }),
        TopLevelLabelField: list({
          labelField: 'headline',
          fields: { headline: text(), rank: integer() },
        }),
        LabelFieldPrecedence: list({
          labelField: 'legacyLabel',
          ui: { labelField: 'keystoneLabel' },
          fields: { legacyLabel: text(), keystoneLabel: text() },
        }),
        InvalidUiLabelField: list({
          ui: { labelField: 'missingField' },
          fields: { title: text() },
        }),
        MissingLabelField: list({
          fields: { subject: text(), rank: integer() },
        }),
      },
    }),
  )
  const labelFieldByListKey = Object.fromEntries(
    configuredLabelFieldLists.map((entry) => [entry.key, entry.labelField]),
  )
  assert(
    labelFieldByListKey.UiLabelField === 'subject',
    'initialiseLists() should honor Keystone-standard ui.labelField for nonconventional scalar field names',
  )
  assert(
    configuredLabelFieldLists.find((entry) => entry.key === 'UiLabelField')?.ui
      .labelField === 'subject',
    'initialiseLists() should retain its resolved labelField in normalized ui metadata',
  )
  assert(
    labelFieldByListKey.TopLevelLabelField === 'headline',
    'initialiseLists() should preserve legacy top-level labelField support',
  )
  assert(
    labelFieldByListKey.LabelFieldPrecedence === 'legacyLabel',
    'legacy top-level labelField should take precedence over ui.labelField for backward compatibility',
  )
  assert(
    labelFieldByListKey.InvalidUiLabelField === 'title',
    'an invalid ui.labelField should retain the existing safe conventional-field fallback',
  )
  assert(
    labelFieldByListKey.MissingLabelField === 'id',
    'a missing labelField should retain the existing safe id fallback',
  )
  assert(
    initializedMinimal[0]?.initialColumns.join(',') === 'title',
    'initialiseLists() should default list initialColumns from the label field and cap to Keystone-like defaults',
  )
  assert(
    initializedMinimal[0]?.initialSearchFields?.join(',') === 'title',
    'initialiseLists() should default list initialSearchFields from readable/filterable text-like fields, preferring the label field',
  )
  assert(
    initializedMinimal[0]?.fields[0]?.path === 'id',
    'initialiseLists() should inject the reserved id field automatically',
  )
  assert(
    initializedMinimal[0]?.ui?.labels?.label === 'Posts',
    'initialiseLists() should expose Keystone-like ui.labels.label metadata on lists',
  )
  assert(
    initializedMinimal[0]?.ui?.labels?.singular === 'Post',
    'initialiseLists() should expose Keystone-like ui.labels.singular metadata on lists',
  )
  assert(
    initializedMinimal[0]?.ui?.labels?.plural === 'Posts',
    'initialiseLists() should expose Keystone-like ui.labels.plural metadata on lists',
  )
  assert(
    initializedMinimal[0]?.ui?.labels?.path === 'posts',
    'initialiseLists() should expose Keystone-like ui.labels.path metadata on lists',
  )
  assert(
    initializedMinimal[0]?.graphql?.names?.itemQueryName === 'post',
    'initialiseLists() should expose Keystone-like graphql.names metadata on lists',
  )
  assert(
    initializedMinimal[0]?.prisma?.types?.listQueryName === 'posts',
    'initialiseLists() should expose Keystone-like prisma.types metadata on lists',
  )
  assert(
    initializedMinimal[0]?.prisma?.listKey === 'post',
    'initialiseLists() should expose Keystone-like prisma.listKey metadata on lists',
  )
  assert(
    initializedMinimal[0]?.ui?.searchableFields?.title === 'default',
    'initialiseLists() should expose searchableFields metadata for readable/filterable text fields',
  )
  assert(
    initializedMinimal[0]?.ui?.triviallySearchableFields?.join(',') === 'title',
    'initialiseLists() should expose triviallySearchableFields metadata for default text search fields',
  )

  const loggingEnabled = config({
    db: { enableLogging: true },
    lists: { Post: list({ fields: { title: text() } }) },
  })
  assert(
    Array.isArray(loggingEnabled.db.enableLogging) &&
      loggingEnabled.db.enableLogging[0] === 'query',
    'config() should normalize db.enableLogging=true to ["query"]',
  )

  const metadataInitialized = initialiseLists(
    config({
      lists: {
        Post: list({
          graphql: { cacheHint: { maxAge: 60 } },
          db: {
            map: 'blog_posts',
            extendPrismaSchema: (schema) => `${schema}\n// extended`,
          },
          fields: {
            title: text({
              db: { isUnique: true, isIndexed: true, prismaDefault: '"draft"' },
            }),
          },
        }),
      },
    }),
  )
  const metadataPost = metadataInitialized[0]
  assert(
    (metadataPost.cacheHint as { maxAge?: number }).maxAge === 60,
    'initialiseLists() should retain Keystone-like list cacheHint metadata',
  )
  assert(
    metadataPost.prisma.mapping === 'blog_posts',
    'initialiseLists() should retain Keystone-like prisma.mapping metadata on lists',
  )
  assert(
    typeof metadataPost.prisma.extendPrismaSchema === 'function',
    'initialiseLists() should retain Keystone-like prisma.extendPrismaSchema metadata on lists',
  )
  assert(
    metadataPost.prisma
      .extendPrismaSchema('model Post {}')
      .includes('// extended'),
    'initialiseLists() should preserve callable prisma.extendPrismaSchema metadata',
  )
  assert(
    metadataPost.resolvedDbFields.id.kind === 'id',
    'initialiseLists() should expose a resolvedDbFields entry for the injected id field',
  )
  assert(
    metadataPost.resolvedDbFields.id.isUnique === true,
    'initialiseLists() should mark the injected id field as unique in resolvedDbFields',
  )
  assert(
    metadataPost.resolvedDbFields.title.kind === 'text',
    'initialiseLists() should expose configured field kinds in resolvedDbFields',
  )
  assert(
    metadataPost.resolvedDbFields.title.isUnique === true,
    'initialiseLists() should carry field db.isUnique metadata into resolvedDbFields',
  )
  assert(
    metadataPost.resolvedDbFields.title.isIndexed === true,
    'initialiseLists() should carry field db.isIndexed metadata into resolvedDbFields',
  )
  assert(
    metadataPost.resolvedDbFields.title.prismaDefault === '"draft"',
    'initialiseLists() should carry field db.prismaDefault metadata into resolvedDbFields',
  )
  assert(
    metadataPost.resolvedDbFields.title.hasExtendPrismaSchema === false,
    'initialiseLists() should record field-level extendPrismaSchema presence in resolvedDbFields',
  )

  const groupedLists = initialiseLists(
    config({
      lists: {
        Post: list({
          fields: {
            title: text(),
            ...group({
              label: 'Meta',
              description: 'Group description',
              fields: {
                slug: text(),
              },
            }),
          },
        }),
      },
    }),
  )
  assert(
    groupedLists[0]?.groups?.[0]?.label === 'Meta',
    'group() sentinel metadata should survive initialization into list.groups',
  )
  assert(
    groupedLists[0]?.groups?.[0]?.fields.join(',') === 'slug',
    'group() should preserve grouped field order during initialization',
  )

  let reservedIdRejected = false
  try {
    initialiseLists(
      config({
        lists: {
          Post: list({
            fields: {
              id: text(),
              title: text(),
            },
          }),
        },
      }),
    )
  } catch (error) {
    reservedIdRejected = true
    assert(
      String(error).includes('"fields.id" is reserved by Keystone'),
      'fields.id rejection should explain the Keystone reserved-field rule',
    )
  }
  assert(
    reservedIdRejected,
    'initialiseLists() should reject user-defined fields.id',
  )

  let singletonIdFieldRejected = false
  try {
    initialiseLists(
      config({
        lists: {
          Settings: list({
            isSingleton: true,
            db: { idField: { kind: 'uuid' } },
            fields: {
              title: text(),
            },
          }),
        },
      }),
    )
  } catch (error) {
    singletonIdFieldRejected = true
    assert(
      String(error).includes('conflicts with singleton defaults'),
      'singleton db.idField rejection should explain the singleton conflict',
    )
  }
  assert(
    singletonIdFieldRejected,
    'initialiseLists() should reject db.idField on singleton lists',
  )

  let nestedGroupsRejected = false
  try {
    group({
      label: 'Outer',
      fields: {
        ...group({
          label: 'Inner',
          fields: {
            title: text(),
          },
        }),
      },
    })
  } catch (error) {
    nestedGroupsRejected = true
    assert(
      String(error).includes('groups cannot be nested'),
      'nested groups rejection should explain that groups cannot be nested',
    )
  }
  assert(nestedGroupsRejected, 'group() should reject nested groups')

  let invalidStorageRejected = false
  try {
    initialiseLists(
      config({
        storage: {
          valid_images: {
            kind: 'local',
            type: 'image',
            storagePath: 'public/files',
            serverRoute: '/files',
          },
        },
        lists: {
          UploadThing: list({
            fields: {
              title: text(),
              cover: image({ storage: 'missing_images' }),
            },
          }),
        },
      }),
    )
  } catch (error) {
    invalidStorageRejected =
      error instanceof Error &&
      error.message.includes(
        'has storage set to "missing_images" but no storage configuration named "missing_images" exists.',
      )
  }
  assert(
    invalidStorageRejected,
    'file/image fields should reject unknown configured storage keys during list initialization',
  )

  const omitInitialized = initialiseLists(
    config({
      lists: {
        HiddenPost: list({
          graphql: {
            omit: { query: true, create: false, update: true, delete: true },
          },
          fields: {
            title: text({
              graphql: { omit: { read: true, create: false, update: true } },
            }),
            body: text(),
          },
        }),
      },
    }),
  )
  const hiddenPost = omitInitialized[0]
  assert(
    hiddenPost.graphql.isEnabled.query === false,
    'initialiseLists() should retain list graphql.isEnabled.query metadata from omit config',
  )
  assert(
    hiddenPost.graphql.isEnabled.create === true,
    'initialiseLists() should retain list graphql.isEnabled.create metadata from omit config',
  )
  const hiddenTitle = hiddenPost.fields.find((field) => field.path === 'title')
  assert(
    hiddenTitle,
    'initialiseLists() should preserve the configured title field',
  )
  assert(
    hiddenTitle.graphql.isEnabled.read === false,
    'initialiseLists() should retain field graphql.isEnabled.read metadata from omit config',
  )
  assert(
    hiddenTitle.graphql.isEnabled.create === true,
    'initialiseLists() should retain field graphql.isEnabled.create metadata from omit config',
  )
  assert(
    hiddenTitle.graphql.isEnabled.filter === false,
    'initialiseLists() should disable field filtering when read is omitted',
  )

  const requiredInitialized = initialiseLists(
    config({
      lists: {
        RequiredPost: list({
          fields: {
            title: text({
              validation: { isRequired: true },
              isNonNull: [true, true],
            }),
            summary: text(),
          },
        }),
        SearchPost: list({
          labelField: 'headline',
          fields: {
            headline: text(),
            category: text({ isFilterable: false }),
            status: text(),
            count: integer(),
          },
        }),
        ReadNonNullPost: list({
          fields: {
            title: text({
              graphql: {
                isNonNull: { read: true, create: false, update: false },
              },
            }),
          },
        }),
      },
    }),
  )
  const requiredPost = requiredInitialized.find(
    (listEntry) => listEntry.key === 'RequiredPost',
  )
  const searchPost = requiredInitialized.find(
    (listEntry) => listEntry.key === 'SearchPost',
  )
  const readNonNullPost = requiredInitialized.find(
    (listEntry) => listEntry.key === 'ReadNonNullPost',
  )
  assert(
    requiredPost,
    'initialiseLists() should preserve RequiredPost for non-null metadata checks',
  )
  assert(
    searchPost,
    'initialiseLists() should preserve SearchPost for search metadata checks',
  )
  assert(
    searchPost.ui.searchableFields,
    'SearchPost should expose searchable field metadata',
  )
  assert(
    searchPost.ui.triviallySearchableFields,
    'SearchPost should expose trivially searchable field metadata',
  )
  assert(
    readNonNullPost,
    'initialiseLists() should preserve ReadNonNullPost for read non-null metadata checks',
  )
  const requiredTitle = requiredPost.fields.find(
    (field) => field.path === 'title',
  )
  assert(
    requiredTitle,
    'initialiseLists() should preserve required fields for non-null metadata checks',
  )
  assert(
    requiredTitle.graphql.isNonNull.create === true,
    'initialiseLists() should retain field graphql.isNonNull.create metadata from required field config',
  )
  assert(
    requiredTitle.graphql.isNonNull.update === true,
    'initialiseLists() should retain field graphql.isNonNull.update metadata from required field config',
  )
  assert(
    requiredTitle.graphql.isNonNull.read === false,
    'initialiseLists() should currently default field graphql.isNonNull.read metadata to false unless explicitly modeled otherwise',
  )
  const readNonNullTitle = readNonNullPost.fields.find(
    (field) => field.path === 'title',
  )
  assert(
    readNonNullTitle,
    'initialiseLists() should preserve explicitly read-non-null fields',
  )
  assert(
    readNonNullTitle.graphql.isNonNull.read === true,
    'initialiseLists() should retain explicit field graphql.isNonNull.read metadata when configured',
  )
  assert(
    searchPost.initialSearchFields?.join(',') === 'headline,status',
    'initialiseLists() should default initialSearchFields from readable/filterable text/select fields and exclude non-filterable/non-text fields',
  )
  assert(
    searchPost.ui.searchableFields.headline === 'default',
    'initialiseLists() should expose searchableFields metadata for label-field text search',
  )
  assert(
    searchPost.ui.searchableFields.status === 'default',
    'initialiseLists() should expose searchableFields metadata for other searchable text fields',
  )
  assert(
    !('category' in searchPost.ui.searchableFields),
    'initialiseLists() should exclude non-filterable fields from searchableFields metadata',
  )
  assert(
    searchPost.ui.triviallySearchableFields.join(',') === 'headline,status',
    'initialiseLists() should expose triviallySearchableFields for readable/filterable text search fields',
  )

  const realLists = initialiseLists(
    config({
      storage: {
        my_images: {
          kind: 'local',
          type: 'image',
          storagePath: 'public/files',
          serverRoute: '/files',
        },
      },
      lists: {
        User,
        Role,
        Todo,
        TodoImage,
      },
    }),
  )
  const userList = realLists.find((entry) => entry.key === 'User')
  const roleList = realLists.find((entry) => entry.key === 'Role')
  const todoList = realLists.find((entry) => entry.key === 'Todo')
  const todoImageList = realLists.find((entry) => entry.key === 'TodoImage')
  assert(
    userList && roleList && todoList && todoImageList,
    'initialiseLists() should preserve real relationship lists for initialized metadata checks',
  )

  const userRoleRelationship = userList.resolvedDbFields.role.relationship
  assert(userRoleRelationship, 'User.role should resolve relationship metadata')
  assert(
    userRoleRelationship.refListKey === 'Role',
    'resolvedDbFields should expose refListKey for User.role',
  )
  assert(
    userRoleRelationship.refFieldKey === 'assignedTo',
    'resolvedDbFields should expose refFieldKey for User.role',
  )
  assert(
    userRoleRelationship.many === false,
    'resolvedDbFields should expose cardinality for User.role',
  )
  assert(
    userRoleRelationship.oppositeExists === true,
    'resolvedDbFields should expose oppositeExists for User.role',
  )
  assert(
    userRoleRelationship.oppositeMany === true,
    'resolvedDbFields should expose oppositeMany for User.role',
  )
  assert(
    userRoleRelationship.relationKind === 'many',
    'resolvedDbFields should expose relationKind for one-to-many relationships like User.role',
  )
  assert(
    userRoleRelationship.ownership === 'own',
    'resolvedDbFields should expose ownership for the FK-owning side of User.role',
  )
  assert(
    userRoleRelationship.foreignKeyFieldName === 'roleId',
    'resolvedDbFields should expose foreignKeyFieldName for owned one-sided relationships like User.role',
  )
  assert(
    userRoleRelationship.foreignKeyScalarType === 'String',
    'resolvedDbFields should expose foreignKeyScalarType String for owned relationships targeting string-id lists like User.role -> Role',
  )
  assert(
    userRoleRelationship.referencesFieldPath === 'id',
    'resolvedDbFields should expose referencesFieldPath for owned one-sided relationships like User.role',
  )
  assert(
    userRoleRelationship.referencedDbColumnName === 'id',
    'resolvedDbFields should expose referencedDbColumnName for owned one-sided relationships like User.role',
  )
  assert(
    userRoleRelationship.onDelete === 'SetNull',
    'resolvedDbFields should expose onDelete metadata for owned one-sided relationships like User.role',
  )
  assert(
    userRoleRelationship.relatedIdFieldKind === 'cuid',
    'resolvedDbFields should expose relatedIdFieldKind for string-id relationships like User.role -> Role',
  )
  assert(
    userRoleRelationship.refListVisibleInPublicGraph === true,
    'resolvedDbFields should expose public-graph visibility for the related list on User.role',
  )
  assert(
    userRoleRelationship.oppositeFieldVisibleInPublicGraph === true,
    'resolvedDbFields should expose public-graph visibility for the opposite field on User.role',
  )

  const roleAssignedToRelationship =
    roleList.resolvedDbFields.assignedTo.relationship
  assert(
    roleAssignedToRelationship,
    'Role.assignedTo should resolve relationship metadata',
  )
  assert(
    roleAssignedToRelationship.refListKey === 'User',
    'resolvedDbFields should expose refListKey for Role.assignedTo',
  )
  assert(
    roleAssignedToRelationship.refFieldKey === 'role',
    'resolvedDbFields should expose refFieldKey for Role.assignedTo',
  )
  assert(
    roleAssignedToRelationship.many === true,
    'resolvedDbFields should expose cardinality for Role.assignedTo',
  )
  assert(
    roleAssignedToRelationship.oppositeMany === false,
    'resolvedDbFields should expose oppositeMany for Role.assignedTo',
  )
  assert(
    roleAssignedToRelationship.ownership === 'inverse',
    'resolvedDbFields should expose inverse ownership for Role.assignedTo',
  )
  assert(
    roleAssignedToRelationship.foreignKeyFieldName === undefined,
    'resolvedDbFields should not expose foreignKeyFieldName for inverse relationship sides like Role.assignedTo',
  )
  assert(
    roleAssignedToRelationship.relatedIdFieldKind === 'cuid',
    'resolvedDbFields should expose relatedIdFieldKind for inverse string-id relationships like Role.assignedTo -> User',
  )

  const todoAssignedToRelationship =
    todoList.resolvedDbFields.assignedTo.relationship
  assert(
    todoAssignedToRelationship,
    'Todo.assignedTo should resolve relationship metadata',
  )
  assert(
    todoAssignedToRelationship.refListKey === 'User',
    'resolvedDbFields should expose refListKey for Todo.assignedTo',
  )
  assert(
    todoAssignedToRelationship.refFieldKey === 'tasks',
    'resolvedDbFields should expose refFieldKey for Todo.assignedTo',
  )
  assert(
    todoAssignedToRelationship.ownership === 'own',
    'resolvedDbFields should expose ownership for Todo.assignedTo',
  )
  assert(
    todoAssignedToRelationship.foreignKeyFieldName === 'assignedToId',
    'resolvedDbFields should expose foreignKeyFieldName for owned one-sided relationships like Todo.assignedTo',
  )
  assert(
    todoAssignedToRelationship.foreignKeyScalarType === 'String',
    'resolvedDbFields should expose foreignKeyScalarType String for owned relationships targeting string-id lists like Todo.assignedTo -> User',
  )
  assert(
    todoAssignedToRelationship.referencesFieldPath === 'id',
    'resolvedDbFields should expose referencesFieldPath for owned one-sided relationships like Todo.assignedTo',
  )
  assert(
    todoAssignedToRelationship.onDelete === 'SetNull',
    'resolvedDbFields should expose onDelete metadata for owned one-sided relationships like Todo.assignedTo',
  )
  assert(
    todoAssignedToRelationship.relatedIdFieldKind === 'cuid',
    'resolvedDbFields should expose relatedIdFieldKind for owned string-id relationships like Todo.assignedTo -> User',
  )
  assert(
    todoAssignedToRelationship.relationName === 'Todo_assignedTo',
    'resolvedDbFields should derive a stable relation name from the owning endpoint when db.relationName is omitted',
  )

  const todoImagesRelationship =
    todoList.resolvedDbFields.todoImages.relationship
  assert(
    todoImagesRelationship,
    'Todo.todoImages should resolve relationship metadata',
  )
  assert(
    todoImagesRelationship.refListKey === 'TodoImage',
    'resolvedDbFields should expose refListKey for Todo.todoImages',
  )
  assert(
    todoImagesRelationship.refFieldKey === 'todos',
    'resolvedDbFields should expose refFieldKey for Todo.todoImages',
  )
  assert(
    todoImagesRelationship.many === true,
    'resolvedDbFields should expose cardinality for Todo.todoImages',
  )
  assert(
    todoImagesRelationship.oppositeMany === true,
    'resolvedDbFields should expose oppositeMany for Todo.todoImages',
  )
  assert(
    todoImagesRelationship.relationKind === 'manyToMany',
    'resolvedDbFields should expose manyToMany relationKind for Todo.todoImages',
  )
  assert(
    todoImagesRelationship.ownership === 'shared',
    'resolvedDbFields should expose shared ownership for many-to-many relationships like Todo.todoImages',
  )
  assert(
    todoImagesRelationship.foreignKeyFieldName === undefined,
    'resolvedDbFields should not expose foreignKeyFieldName for shared many-to-many relationships like Todo.todoImages',
  )
  assert(
    todoImagesRelationship.relatedIdFieldKind === 'cuid',
    'resolvedDbFields should expose relatedIdFieldKind for shared many-to-many relationships like Todo.todoImages -> TodoImage',
  )
  assert(
    todoImagesRelationship.relationName === 'Todo_todoImages',
    'resolvedDbFields should derive stable many-to-many relationName metadata from arbitrary endpoints',
  )
  assert(
    todoImagesRelationship.joinTableName === 'Todo_todoImages',
    'resolvedDbFields should expose joinTableName metadata for shared many-to-many relationships like Todo.todoImages',
  )
  assert(
    todoImagesRelationship.joinTableNearForeignKey === 'todoImages',
    'resolvedDbFields should expose joinTableNearForeignKey metadata for shared many-to-many relationships like Todo.todoImages',
  )
  assert(
    todoImagesRelationship.joinTableFarForeignKey === 'todos',
    'resolvedDbFields should expose joinTableFarForeignKey metadata for shared many-to-many relationships like Todo.todoImages',
  )
  assert(
    todoImagesRelationship.joinTableNearReferencedFieldPath === 'id',
    'resolvedDbFields should expose joinTableNearReferencedFieldPath for shared many-to-many relationships like Todo.todoImages -> Todo',
  )
  assert(
    todoImagesRelationship.joinTableFarReferencedFieldPath === 'id',
    'resolvedDbFields should expose joinTableFarReferencedFieldPath for shared many-to-many relationships like Todo.todoImages -> TodoImage',
  )
  assert(
    todoImagesRelationship.joinTableNearReferencedDbColumnName === 'id',
    'resolvedDbFields should expose joinTableNearReferencedDbColumnName for shared many-to-many relationships like Todo.todoImages -> Todo',
  )
  assert(
    todoImagesRelationship.joinTableFarReferencedDbColumnName === 'id',
    'resolvedDbFields should expose joinTableFarReferencedDbColumnName for shared many-to-many relationships like Todo.todoImages -> TodoImage',
  )
  assert(
    todoImagesRelationship.joinTableNearForeignKeyScalarType === 'String',
    'resolvedDbFields should expose joinTableNearForeignKeyScalarType for shared many-to-many relationships targeting string-id lists like Todo.todoImages -> Todo',
  )
  assert(
    todoImagesRelationship.joinTableFarForeignKeyScalarType === 'String',
    'resolvedDbFields should expose joinTableFarForeignKeyScalarType for shared many-to-many relationships targeting string-id lists like Todo.todoImages -> TodoImage',
  )
  assert(
    todoImagesRelationship.joinTableNearIdFieldKind === 'cuid',
    'resolvedDbFields should expose joinTableNearIdFieldKind for shared many-to-many relationships like Todo.todoImages -> Todo',
  )
  assert(
    todoImagesRelationship.joinTableFarIdFieldKind === 'cuid',
    'resolvedDbFields should expose joinTableFarIdFieldKind for shared many-to-many relationships like Todo.todoImages -> TodoImage',
  )

  const todoImageTodosRelationship =
    todoImageList.resolvedDbFields.todos.relationship
  assert(
    todoImageTodosRelationship,
    'TodoImage.todos should resolve relationship metadata',
  )
  assert(
    todoImageTodosRelationship.refListKey === 'Todo',
    'resolvedDbFields should expose refListKey for TodoImage.todos',
  )
  assert(
    todoImageTodosRelationship.refFieldKey === 'todoImages',
    'resolvedDbFields should expose refFieldKey for TodoImage.todos',
  )
  assert(
    todoImageTodosRelationship.ownership === 'shared',
    'resolvedDbFields should expose shared ownership for TodoImage.todos',
  )
  assert(
    todoImageTodosRelationship.relatedIdFieldKind === 'cuid',
    'resolvedDbFields should expose relatedIdFieldKind for shared many-to-many relationships like TodoImage.todos -> Todo',
  )
  assert(
    todoImageTodosRelationship.relationName === 'Todo_todoImages',
    'both relationship endpoints should share the same derived relation name',
  )
  assert(
    todoImageTodosRelationship.joinTableName === 'Todo_todoImages',
    'resolvedDbFields should expose joinTableName metadata for shared many-to-many relationships like TodoImage.todos',
  )
  assert(
    todoImageTodosRelationship.joinTableNearForeignKey === 'todos',
    'resolvedDbFields should expose joinTableNearForeignKey metadata for shared many-to-many relationships like TodoImage.todos',
  )
  assert(
    todoImageTodosRelationship.joinTableFarForeignKey === 'todoImages',
    'resolvedDbFields should expose joinTableFarForeignKey metadata for shared many-to-many relationships like TodoImage.todos',
  )
  assert(
    todoImageTodosRelationship.joinTableNearReferencedFieldPath === 'id',
    'resolvedDbFields should expose joinTableNearReferencedFieldPath for shared many-to-many relationships like TodoImage.todos -> TodoImage',
  )
  assert(
    todoImageTodosRelationship.joinTableFarReferencedFieldPath === 'id',
    'resolvedDbFields should expose joinTableFarReferencedFieldPath for shared many-to-many relationships like TodoImage.todos -> Todo',
  )
  assert(
    todoImageTodosRelationship.joinTableNearReferencedDbColumnName === 'id',
    'resolvedDbFields should expose joinTableNearReferencedDbColumnName for shared many-to-many relationships like TodoImage.todos -> TodoImage',
  )
  assert(
    todoImageTodosRelationship.joinTableFarReferencedDbColumnName === 'id',
    'resolvedDbFields should expose joinTableFarReferencedDbColumnName for shared many-to-many relationships like TodoImage.todos -> Todo',
  )
  assert(
    todoImageTodosRelationship.joinTableNearForeignKeyScalarType === 'String',
    'resolvedDbFields should expose joinTableNearForeignKeyScalarType for shared many-to-many relationships targeting string-id lists like TodoImage.todos -> TodoImage',
  )
  assert(
    todoImageTodosRelationship.joinTableFarForeignKeyScalarType === 'String',
    'resolvedDbFields should expose joinTableFarForeignKeyScalarType for shared many-to-many relationships targeting string-id lists like TodoImage.todos -> Todo',
  )
  assert(
    todoImageTodosRelationship.joinTableNearIdFieldKind === 'cuid',
    'resolvedDbFields should expose joinTableNearIdFieldKind for shared many-to-many relationships like TodoImage.todos -> TodoImage',
  )
  assert(
    todoImageTodosRelationship.joinTableFarIdFieldKind === 'cuid',
    'resolvedDbFields should expose joinTableFarIdFieldKind for shared many-to-many relationships like TodoImage.todos -> Todo',
  )
  assert(
    todoImageTodosRelationship.refListVisibleInPublicGraph === true,
    'resolvedDbFields should expose public-graph visibility for TodoImage.todos related list',
  )
  assert(
    todoImageTodosRelationship.oppositeFieldVisibleInPublicGraph === true,
    'resolvedDbFields should expose public-graph visibility for TodoImage.todos opposite field',
  )

  const autoincrementManyToManyLists = initialiseLists(
    config({
      db: { idField: { kind: 'autoincrement' } },
      lists: {
        EventThing: list({
          fields: {
            counters: relationship({
              ref: 'CounterThing.events',
              many: true,
              db: { relationName: 'EventThingCounters' },
            }),
          },
        }),
        CounterThing: list({
          fields: {
            events: relationship({
              ref: 'EventThing.counters',
              many: true,
              db: { relationName: 'EventThingCounters' },
            }),
          },
        }),
      },
    }),
  )
  const autoincrementEventThingList = autoincrementManyToManyLists.find(
    (entry) => entry.key === 'EventThing',
  )
  assert(
    autoincrementEventThingList,
    'initialiseLists() should preserve EventThing for autoincrement many-to-many metadata checks',
  )
  const eventCountersRelationship =
    autoincrementEventThingList.resolvedDbFields.counters.relationship
  assert(
    eventCountersRelationship,
    'EventThing.counters should resolve relationship metadata',
  )
  assert(
    eventCountersRelationship.joinTableNearIdFieldKind === 'autoincrement',
    'resolvedDbFields should expose autoincrement joinTableNearIdFieldKind for shared many-to-many relationships like EventThing.counters -> EventThing',
  )
  assert(
    eventCountersRelationship.joinTableFarIdFieldKind === 'autoincrement',
    'resolvedDbFields should expose autoincrement joinTableFarIdFieldKind for shared many-to-many relationships like EventThing.counters -> CounterThing',
  )
  assert(
    eventCountersRelationship.joinTableNearReferencedFieldPath === 'id',
    'resolvedDbFields should expose autoincrement joinTableNearReferencedFieldPath for shared many-to-many relationships like EventThing.counters -> EventThing',
  )
  assert(
    eventCountersRelationship.joinTableFarReferencedFieldPath === 'id',
    'resolvedDbFields should expose autoincrement joinTableFarReferencedFieldPath for shared many-to-many relationships like EventThing.counters -> CounterThing',
  )
  assert(
    eventCountersRelationship.joinTableNearReferencedDbColumnName === 'id',
    'resolvedDbFields should expose autoincrement joinTableNearReferencedDbColumnName for shared many-to-many relationships like EventThing.counters -> EventThing',
  )
  assert(
    eventCountersRelationship.joinTableFarReferencedDbColumnName === 'id',
    'resolvedDbFields should expose autoincrement joinTableFarReferencedDbColumnName for shared many-to-many relationships like EventThing.counters -> CounterThing',
  )
  assert(
    eventCountersRelationship.joinTableNearForeignKeyScalarType === 'Int',
    'resolvedDbFields should expose Int joinTableNearForeignKeyScalarType for shared many-to-many relationships targeting autoincrement-id lists like EventThing.counters -> EventThing',
  )
  assert(
    eventCountersRelationship.joinTableFarForeignKeyScalarType === 'Int',
    'resolvedDbFields should expose Int joinTableFarForeignKeyScalarType for shared many-to-many relationships targeting autoincrement-id lists like EventThing.counters -> CounterThing',
  )

  const hiddenRelationshipLists = initialiseLists(
    config({
      lists: {
        HiddenThing: list({
          graphql: { omit: true },
          fields: {
            label: text(),
            publicRelations: relationship({
              ref: 'PublicRelationThing.hiddenRef',
              many: true,
            }),
          },
        }),
        PublicRelationThing: list({
          fields: {
            title: text(),
            hiddenRef: relationship({ ref: 'HiddenThing.publicRelations' }),
          },
        }),
      },
    }),
  )
  const publicRelationThing = hiddenRelationshipLists.find(
    (entry) => entry.key === 'PublicRelationThing',
  )
  assert(
    publicRelationThing,
    'initialiseLists() should preserve PublicRelationThing for visibility metadata checks',
  )
  const hiddenRefRelationship =
    publicRelationThing.resolvedDbFields.hiddenRef.relationship
  assert(
    hiddenRefRelationship,
    'PublicRelationThing.hiddenRef should resolve relationship metadata',
  )
  assert(
    hiddenRefRelationship.refListVisibleInPublicGraph === false,
    'resolvedDbFields should expose when a related list is omitted from the public graph',
  )
  assert(
    hiddenRefRelationship.oppositeFieldVisibleInPublicGraph === true,
    'resolvedDbFields should still expose opposite field read visibility metadata when the opposite field itself remains readable in local config',
  )

  const oppositeFieldOmittedLists = initialiseLists(
    config({
      lists: {
        PublicParent: list({
          fields: {
            title: text(),
            children: relationship({ ref: 'PublicChild.parent', many: true }),
          },
        }),
        PublicChild: list({
          fields: {
            title: text(),
            parent: relationship({
              ref: 'PublicParent.children',
              graphql: { omit: { read: true } },
            }),
          },
        }),
      },
    }),
  )
  const visibleParentList = oppositeFieldOmittedLists.find(
    (entry) => entry.key === 'PublicParent',
  )
  assert(
    visibleParentList,
    'initialiseLists() should preserve PublicParent for opposite-field visibility metadata checks',
  )
  const visibleChildrenRelationship =
    visibleParentList.resolvedDbFields.children.relationship
  assert(
    visibleChildrenRelationship,
    'VisibleParent.children should resolve relationship metadata',
  )
  assert(
    visibleChildrenRelationship.refListVisibleInPublicGraph === true,
    'resolvedDbFields should keep refListVisibleInPublicGraph true when the related list remains public',
  )
  assert(
    visibleChildrenRelationship.oppositeFieldVisibleInPublicGraph === false,
    'resolvedDbFields should expose when the opposite relationship field is omitted from public read',
  )

  expectRelationshipInitFailure(
    () =>
      initialiseLists(
        config({
          lists: {
            BrokenThing: list({
              fields: {
                related: relationship({ ref: 'MissingList.related' }),
              },
            }),
          },
        }),
      ),
    'BrokenThing.related points to missing related list MissingList',
  )

  expectRelationshipInitFailure(
    () =>
      initialiseLists(
        config({
          lists: {
            Settings: list({
              isSingleton: true,
              fields: {
                title: text(),
              },
            }),
            Post: list({
              fields: {
                settings: relationship({ ref: 'Settings' }),
              },
            }),
          },
        }),
      ),
    'Post.settings points to a singleton list, Settings, which is not allowed',
  )

  expectRelationshipInitFailure(
    () =>
      initialiseLists(
        config({
          lists: {
            Settings: list({
              isSingleton: true,
              fields: {
                title: text(),
                posts: relationship({ ref: 'Post.settings', many: true }),
              },
            }),
            Post: list({
              fields: {
                settings: relationship({ ref: 'Settings.posts' }),
              },
            }),
          },
        }),
      ),
    'Post.settings points to a singleton list, Settings, which is not allowed',
  )

  expectRelationshipInitFailure(
    () =>
      initialiseLists(
        config({
          lists: {
            Parent: list({
              fields: {
                related: relationship({ ref: 'Child.missingBackref' }),
              },
            }),
            Child: list({
              fields: {
                label: text(),
              },
            }),
          },
        }),
      ),
    'Parent.related points to missing opposite field Child.missingBackref',
  )

  expectRelationshipInitFailure(
    () =>
      initialiseLists(
        config({
          lists: {
            Parent: list({
              fields: {
                related: relationship({ ref: 'Child.label' }),
              },
            }),
            Child: list({
              fields: {
                label: text(),
              },
            }),
          },
        }),
      ),
    'Parent.related points to Child.label, but that field is not a relationship',
  )

  expectRelationshipInitFailure(
    () =>
      initialiseLists(
        config({
          lists: {
            Tag: list({
              fields: {
                posts: relationship({
                  ref: 'Post.tags',
                  many: true,
                  db: { foreignKey: { map: 'tag_post_id' } },
                }),
              },
            }),
            Post: list({
              fields: {
                tags: relationship({ ref: 'Tag.posts', many: true }),
              },
            }),
          },
        }),
      ),
    'Tag.posts uses db.foreignKey, but foreignKey mapping is only supported for owned single relationships',
  )

  expectRelationshipInitFailure(
    () =>
      initialiseLists(
        config({
          lists: {
            Role: list({
              fields: {
                members: relationship({ ref: 'User.role', many: true }),
              },
            }),
            User: list({
              fields: {
                role: relationship({
                  ref: 'Role.members',
                  db: { relationName: 'UserRole' },
                }),
              },
            }),
          },
        }),
      ),
    'User.role uses db.relationName, but relationName is only supported on many relationships',
  )

  expectRelationshipInitFailure(
    () =>
      initialiseLists(
        config({
          lists: {
            Category: list({
              fields: {
                title: text(),
                mentor: relationship({
                  ref: 'Category',
                  db: { relationName: 'CategoryMentor' },
                }),
              },
            }),
          },
        }),
      ),
    'Category.mentor uses db.relationName, but relationName is only supported on many relationships',
  )

  expectRelationshipInitFailure(
    () =>
      initialiseLists(
        config({
          lists: {
            Author: list({
              fields: {
                posts: relationship({
                  ref: 'Post.author',
                  many: true,
                  db: { relationName: 'AuthorPosts' },
                }),
              },
            }),
            Post: list({
              fields: {
                author: relationship({ ref: 'Author.posts' }),
              },
            }),
          },
        }),
      ),
    'You can only set db.relationName on one side of a many to many relationship, but db.relationName is set on Author.posts which is the many side of a many to one relationship with Post.author',
  )

  expectRelationshipInitFailure(
    () =>
      initialiseLists(
        config({
          lists: {
            Tag: list({
              fields: {
                posts: relationship({
                  ref: 'Post.tags',
                  many: true,
                  db: { relationName: 'TagPosts' },
                }),
              },
            }),
            Post: list({
              fields: {
                tags: relationship({
                  ref: 'Tag.posts',
                  many: true,
                  db: { relationName: 'PostTags' },
                }),
              },
            }),
          },
        }),
      ),
    'You can only set db.relationName on one side of a many to many relationship, but db.relationName is set on both Tag.posts and Post.tags',
  )

  expectRelationshipInitFailure(
    () =>
      initialiseLists(
        config({
          lists: {
            User: list({
              fields: {
                profile: relationship({
                  ref: 'Profile.user',
                  db: { foreignKey: true },
                }),
              },
            }),
            Profile: list({
              fields: {
                user: relationship({
                  ref: 'User.profile',
                  db: { foreignKey: true },
                }),
              },
            }),
          },
        }),
      ),
    'You can only set db.foreignKey on one side of a one to one relationship, but foreignKey is set on both User.profile and Profile.user',
  )

  expectRelationshipInitFailure(
    () =>
      initialiseLists(
        config({
          lists: {
            Category: list({
              fields: {
                peers: relationship({
                  ref: 'Category.inversePeers',
                  many: true,
                  db: { relationName: 'CategoryPeers' },
                }),
                inversePeers: relationship({
                  ref: 'Category.peers',
                  many: true,
                  db: { relationName: 'CategoryInversePeers' },
                }),
              },
            }),
          },
        }),
      ),
    'You can only set db.relationName on one side of a many to many relationship, but db.relationName is set on both Category.peers and Category.inversePeers',
  )

  expectRelationshipInitFailure(
    () =>
      initialiseLists(
        config({
          lists: {
            Parent: list({
              fields: {
                related: relationship({ ref: 'Child.backref' }),
              },
            }),
            Child: list({
              fields: {
                backref: relationship({ ref: 'OtherThing.related' }),
              },
            }),
            OtherThing: list({
              fields: {
                related: relationship({ ref: 'Child.backref' }),
              },
            }),
          },
        }),
      ),
    'Parent.related points to Child.backref, but Child.backref points to "OtherThing.related" instead of "Parent.related"',
  )

  expectRelationshipInitFailure(
    () =>
      initialiseLists(
        config({
          lists: {
            Post: list({
              fields: {
                tags: relationship({ ref: 'Tag', many: true }),
              },
            }),
            Tag: list({
              fields: {
                from_Post_tags: text(),
              },
            }),
          },
        }),
      ),
    'Post.tags points to the list Tag, Keystone needs to a create a relationship field at Tag.from_Post_tags to support the relationship at Post.tags but Tag already has a field named from_Post_tags',
  )

  expectRelationshipInitFailure(
    () =>
      initialiseLists(
        config({
          lists: {
            Todo: list({
              fields: {
                assignedTo: relationship({ ref: 'User.tasks' }),
              },
            }),
            User: list({
              fields: {
                tasks: relationship({ ref: 'Todo.owner', many: true }),
                owner: relationship({ ref: 'Todo.assignedTo' }),
              },
            }),
          },
        }),
      ),
    'Todo.assignedTo points to User.tasks, but User.tasks points to "Todo.owner" instead of "Todo.assignedTo"',
  )

  const oneSidedLists = initialiseLists(
    config({
      lists: {
        Tag: list({
          fields: {
            name: text(),
          },
        }),
        Post: list({
          fields: {
            primaryTag: relationship({ ref: 'Tag' }),
            tags: relationship({ ref: 'Tag', many: true }),
            namedTags: relationship({
              ref: 'Tag',
              many: true,
              db: { relationName: 'PostNamedTags' },
            }),
          },
        }),
      },
    }),
  )
  const postList = oneSidedLists.find((entry) => entry.key === 'Post')
  assert(
    postList,
    'initialiseLists() should preserve Post for one-sided relationship metadata checks',
  )
  const primaryTagRelationship =
    postList.resolvedDbFields.primaryTag.relationship
  assert(
    primaryTagRelationship,
    'Post.primaryTag should resolve relationship metadata',
  )
  assert(
    primaryTagRelationship.refListKey === 'Tag',
    'one-sided relationships should preserve refListKey when ref only names the list',
  )
  assert(
    primaryTagRelationship.refFieldKey === undefined,
    'one-sided relationships should not require refFieldKey when ref only names the list',
  )
  assert(
    primaryTagRelationship.oppositeExists === false,
    'one-sided relationships should report oppositeExists false when no opposite field is named',
  )
  assert(
    primaryTagRelationship.ownership === 'own',
    'one-sided single relationships should remain FK-owning',
  )
  assert(
    primaryTagRelationship.foreignKeyFieldName === 'primaryTagId',
    'one-sided single relationships should still derive foreignKeyFieldName',
  )

  const tagsRelationship = postList.resolvedDbFields.tags.relationship
  assert(tagsRelationship, 'Post.tags should resolve relationship metadata')
  assert(
    tagsRelationship.refListKey === 'Tag',
    'one-sided many relationships should preserve refListKey when ref only names the list',
  )
  assert(
    tagsRelationship.refFieldKey === undefined,
    'one-sided many relationships should not require refFieldKey when ref only names the list',
  )
  assert(
    tagsRelationship.oppositeExists === false,
    'one-sided many relationships should report oppositeExists false when no opposite field is named',
  )
  assert(
    tagsRelationship.ownership === 'inverse',
    'one-sided many relationships should preserve inverse-style ownership metadata locally',
  )
  assert(
    tagsRelationship.foreignKeyFieldName === undefined,
    'one-sided many relationships should not derive foreignKeyFieldName on the many side',
  )

  const namedTagsRelationship = postList.resolvedDbFields.namedTags.relationship
  assert(
    namedTagsRelationship,
    'Post.namedTags should resolve relationship metadata',
  )
  assert(
    namedTagsRelationship.refListKey === 'Tag',
    'one-sided named many relationships should preserve refListKey when ref only names the list',
  )
  assert(
    namedTagsRelationship.refFieldKey === undefined,
    'one-sided named many relationships should not require refFieldKey when ref only names the list',
  )
  assert(
    namedTagsRelationship.oppositeExists === false,
    'one-sided named many relationships should report oppositeExists false when no opposite field is named',
  )
  assert(
    namedTagsRelationship.relationKind === 'many',
    'one-sided named many relationships should preserve relationKind many',
  )
  assert(
    namedTagsRelationship.ownership === 'inverse',
    'one-sided named many relationships should preserve inverse-style ownership metadata locally',
  )
  assert(
    namedTagsRelationship.relationName === 'PostNamedTags',
    'one-sided named many relationships should preserve explicit relationName metadata',
  )
  assert(
    namedTagsRelationship.foreignKeyFieldName === undefined,
    'one-sided named many relationships should not derive foreignKeyFieldName on the many side',
  )
  assert(
    namedTagsRelationship.foreignKeyMap === undefined,
    'one-sided named many relationships should not derive foreignKeyMap on the many side',
  )
  assert(
    namedTagsRelationship.relationArgs === undefined,
    'one-sided named many relationships should not derive owned relationArgs on the many side',
  )

  const selfLists = initialiseLists(
    config({
      lists: {
        Category: list({
          fields: {
            title: text(),
            parent: relationship({ ref: 'Category.children' }),
            children: relationship({ ref: 'Category.parent', many: true }),
            mentor: relationship({ ref: 'Category' }),
            peers: relationship({ ref: 'Category', many: true }),
            namedPeers: relationship({
              ref: 'Category',
              many: true,
              db: { relationName: 'CategoryNamedPeers' },
            }),
          },
        }),
      },
    }),
  )
  const categoryList = selfLists.find((entry) => entry.key === 'Category')
  assert(
    categoryList,
    'initialiseLists() should preserve Category for self-referential relationship metadata checks',
  )

  const parentRelationship = categoryList.resolvedDbFields.parent.relationship
  assert(
    parentRelationship,
    'Category.parent should resolve relationship metadata',
  )
  assert(
    parentRelationship.refListKey === 'Category',
    'self two-sided relationships should preserve refListKey',
  )
  assert(
    parentRelationship.refFieldKey === 'children',
    'self two-sided relationships should preserve refFieldKey',
  )
  assert(
    parentRelationship.oppositeExists === true,
    'self two-sided relationships should detect the opposite field',
  )
  assert(
    parentRelationship.oppositeMany === true,
    'self two-sided relationships should preserve oppositeMany metadata',
  )
  assert(
    parentRelationship.isSelfReferential === true,
    'self two-sided relationships should be marked self-referential',
  )
  assert(
    parentRelationship.ownership === 'own',
    'self two-sided single-to-many relationships should keep own-side ownership on the single side',
  )
  assert(
    parentRelationship.foreignKeyFieldName === 'parentId',
    'self two-sided single-to-many relationships should derive a self foreignKeyFieldName on the owning side',
  )

  const childrenRelationship =
    categoryList.resolvedDbFields.children.relationship
  assert(
    childrenRelationship,
    'Category.children should resolve relationship metadata',
  )
  assert(
    childrenRelationship.refListKey === 'Category',
    'self inverse relationships should preserve refListKey',
  )
  assert(
    childrenRelationship.refFieldKey === 'parent',
    'self inverse relationships should preserve refFieldKey',
  )
  assert(
    childrenRelationship.isSelfReferential === true,
    'self inverse relationships should be marked self-referential',
  )
  assert(
    childrenRelationship.ownership === 'inverse',
    'self inverse relationships should preserve inverse ownership metadata',
  )
  assert(
    childrenRelationship.foreignKeyFieldName === undefined,
    'self inverse relationships should not derive foreignKeyFieldName on the many side',
  )

  const mentorRelationship = categoryList.resolvedDbFields.mentor.relationship
  assert(
    mentorRelationship,
    'Category.mentor should resolve relationship metadata',
  )
  assert(
    mentorRelationship.refListKey === 'Category',
    'self one-sided single relationships should preserve refListKey',
  )
  assert(
    mentorRelationship.refFieldKey === undefined,
    'self one-sided single relationships should not require refFieldKey',
  )
  assert(
    mentorRelationship.oppositeExists === false,
    'self one-sided single relationships should report oppositeExists false',
  )
  assert(
    mentorRelationship.isSelfReferential === true,
    'self one-sided single relationships should be marked self-referential',
  )
  assert(
    mentorRelationship.foreignKeyFieldName === 'mentorId',
    'self one-sided single relationships should derive foreignKeyFieldName',
  )

  const peersRelationship = categoryList.resolvedDbFields.peers.relationship
  assert(
    peersRelationship,
    'Category.peers should resolve relationship metadata',
  )
  assert(
    peersRelationship.refListKey === 'Category',
    'self one-sided many relationships should preserve refListKey',
  )
  assert(
    peersRelationship.refFieldKey === undefined,
    'self one-sided many relationships should not require refFieldKey',
  )
  assert(
    peersRelationship.oppositeExists === false,
    'self one-sided many relationships should report oppositeExists false',
  )
  assert(
    peersRelationship.isSelfReferential === true,
    'self one-sided many relationships should be marked self-referential',
  )
  assert(
    peersRelationship.foreignKeyFieldName === undefined,
    'self one-sided many relationships should not derive foreignKeyFieldName',
  )

  const namedPeersRelationship =
    categoryList.resolvedDbFields.namedPeers.relationship
  assert(
    namedPeersRelationship,
    'Category.namedPeers should resolve relationship metadata',
  )
  assert(
    namedPeersRelationship.refListKey === 'Category',
    'self one-sided named many relationships should preserve refListKey',
  )
  assert(
    namedPeersRelationship.refFieldKey === undefined,
    'self one-sided named many relationships should not require refFieldKey',
  )
  assert(
    namedPeersRelationship.oppositeExists === false,
    'self one-sided named many relationships should report oppositeExists false',
  )
  assert(
    namedPeersRelationship.isSelfReferential === true,
    'self one-sided named many relationships should be marked self-referential',
  )
  assert(
    namedPeersRelationship.relationKind === 'many',
    'self one-sided named many relationships should preserve relationKind many',
  )
  assert(
    namedPeersRelationship.ownership === 'inverse',
    'self one-sided named many relationships should preserve inverse-style ownership metadata locally',
  )
  assert(
    namedPeersRelationship.relationName === 'CategoryNamedPeers',
    'self one-sided named many relationships should preserve explicit relationName metadata',
  )
  assert(
    namedPeersRelationship.foreignKeyFieldName === undefined,
    'self one-sided named many relationships should not derive foreignKeyFieldName',
  )
  assert(
    namedPeersRelationship.foreignKeyMap === undefined,
    'self one-sided named many relationships should not derive foreignKeyMap',
  )
  assert(
    namedPeersRelationship.relationArgs === undefined,
    'self one-sided named many relationships should not derive owned relationArgs',
  )

  const namedManyOneSideOnlyLists = initialiseLists(
    config({
      lists: {
        Tag: list({
          fields: {
            posts: relationship({
              ref: 'Post.tags',
              many: true,
              db: { relationName: 'TagPosts' },
            }),
          },
        }),
        Post: list({
          fields: {
            tags: relationship({ ref: 'Tag.posts', many: true }),
          },
        }),
      },
    }),
  )
  const namedManyTagList = namedManyOneSideOnlyLists.find(
    (entry) => entry.key === 'Tag',
  )
  const unnamedManyPostList = namedManyOneSideOnlyLists.find(
    (entry) => entry.key === 'Post',
  )
  assert(
    namedManyTagList,
    'initialiseLists() should preserve Tag for one-sided named many-to-many metadata checks',
  )
  assert(
    unnamedManyPostList,
    'initialiseLists() should preserve Post for one-sided named many-to-many metadata checks',
  )

  const namedManyTagPostsRelationship =
    namedManyTagList.resolvedDbFields.posts.relationship
  assert(
    namedManyTagPostsRelationship,
    'NamedManyTag.posts should resolve relationship metadata',
  )
  assert(
    namedManyTagPostsRelationship.relationKind === 'manyToMany',
    'one-sided explicit many-to-many relationName should preserve manyToMany relationKind on the named side',
  )
  assert(
    namedManyTagPostsRelationship.ownership === 'shared',
    'one-sided explicit many-to-many relationName should preserve shared ownership on the named side',
  )
  assert(
    namedManyTagPostsRelationship.relationName === 'TagPosts',
    'one-sided explicit many-to-many relationName should be preserved on the named side',
  )
  assert(
    namedManyTagPostsRelationship.joinTableName === 'TagPosts',
    'one-sided explicit many-to-many relationName should determine joinTableName on the named side',
  )
  assert(
    namedManyTagPostsRelationship.foreignKeyFieldName === undefined,
    'one-sided explicit many-to-many relationName should not invent owned foreignKeyFieldName on the named side',
  )
  assert(
    namedManyTagPostsRelationship.foreignKeyMap === undefined,
    'one-sided explicit many-to-many relationName should not invent owned foreignKeyMap on the named side',
  )
  assert(
    namedManyTagPostsRelationship.relationArgs === undefined,
    'one-sided explicit many-to-many relationName should not invent owned relationArgs on the named side',
  )

  const unnamedManyPostTagsRelationship =
    unnamedManyPostList.resolvedDbFields.tags.relationship
  assert(
    unnamedManyPostTagsRelationship,
    'UnnamedManyPost.tags should resolve relationship metadata',
  )
  assert(
    unnamedManyPostTagsRelationship.relationKind === 'manyToMany',
    'one-sided explicit many-to-many relationName should preserve manyToMany relationKind on the unnamed opposite side',
  )
  assert(
    unnamedManyPostTagsRelationship.ownership === 'shared',
    'one-sided explicit many-to-many relationName should preserve shared ownership on the unnamed opposite side',
  )
  assert(
    unnamedManyPostTagsRelationship.relationName === 'TagPosts',
    'one-sided explicit many-to-many relationName should propagate to the unnamed opposite side',
  )
  assert(
    unnamedManyPostTagsRelationship.joinTableName === 'TagPosts',
    'one-sided explicit many-to-many relationName should determine joinTableName on the unnamed opposite side',
  )
  assert(
    unnamedManyPostTagsRelationship.foreignKeyFieldName === undefined,
    'one-sided explicit many-to-many relationName should not invent owned foreignKeyFieldName on the unnamed opposite side',
  )
  assert(
    unnamedManyPostTagsRelationship.foreignKeyMap === undefined,
    'one-sided explicit many-to-many relationName should not invent owned foreignKeyMap on the unnamed opposite side',
  )
  assert(
    unnamedManyPostTagsRelationship.relationArgs === undefined,
    'one-sided explicit many-to-many relationName should not invent owned relationArgs on the unnamed opposite side',
  )

  const sameNameSelfManyToManyLists = initialiseLists(
    config({
      lists: {
        Category: list({
          fields: {
            peers: relationship({
              ref: 'Category.inversePeers',
              many: true,
              db: { relationName: 'CategoryPeers' },
            }),
            inversePeers: relationship({
              ref: 'Category.peers',
              many: true,
              db: { relationName: 'CategoryPeers' },
            }),
          },
        }),
      },
    }),
  )
  const sameNameSelfCategoryList = sameNameSelfManyToManyLists.find(
    (entry) => entry.key === 'Category',
  )
  assert(
    sameNameSelfCategoryList,
    'initialiseLists() should preserve Category for same-name self many-to-many metadata checks',
  )

  const sameNamePeersRelationship =
    sameNameSelfCategoryList.resolvedDbFields.peers.relationship
  assert(
    sameNamePeersRelationship,
    'same-name peers should resolve relationship metadata',
  )
  assert(
    sameNamePeersRelationship.refListKey === 'Category',
    'same-name self many-to-many relationships should preserve refListKey',
  )
  assert(
    sameNamePeersRelationship.refFieldKey === 'inversePeers',
    'same-name self many-to-many relationships should preserve opposite refFieldKey',
  )
  assert(
    sameNamePeersRelationship.oppositeExists === true,
    'same-name self many-to-many relationships should detect the opposite field',
  )
  assert(
    sameNamePeersRelationship.oppositeMany === true,
    'same-name self many-to-many relationships should preserve oppositeMany',
  )
  assert(
    sameNamePeersRelationship.isSelfReferential === true,
    'same-name self many-to-many relationships should be marked self-referential',
  )
  assert(
    sameNamePeersRelationship.relationKind === 'manyToMany',
    'same-name self many-to-many relationships should preserve manyToMany relationKind',
  )
  assert(
    sameNamePeersRelationship.ownership === 'shared',
    'same-name self many-to-many relationships should preserve shared ownership locally',
  )
  assert(
    sameNamePeersRelationship.relationName === 'CategoryPeers',
    'same-name self many-to-many relationships should preserve the shared explicit relationName locally',
  )
  assert(
    sameNamePeersRelationship.joinTableName === 'CategoryPeers',
    'same-name self many-to-many relationships should preserve joinTableName locally',
  )
  assert(
    sameNamePeersRelationship.foreignKeyFieldName === undefined,
    'same-name self many-to-many relationships should not invent owned foreignKeyFieldName',
  )
  assert(
    sameNamePeersRelationship.foreignKeyMap === undefined,
    'same-name self many-to-many relationships should not invent owned foreignKeyMap',
  )
  assert(
    sameNamePeersRelationship.relationArgs === undefined,
    'same-name self many-to-many relationships should not invent owned relationArgs',
  )

  const sameNameInversePeersRelationship =
    sameNameSelfCategoryList.resolvedDbFields.inversePeers.relationship
  assert(
    sameNameInversePeersRelationship,
    'same-name inversePeers should resolve relationship metadata',
  )
  assert(
    sameNameInversePeersRelationship.refListKey === 'Category',
    'same-name self many-to-many inverse relationships should preserve refListKey',
  )
  assert(
    sameNameInversePeersRelationship.refFieldKey === 'peers',
    'same-name self many-to-many inverse relationships should preserve opposite refFieldKey',
  )
  assert(
    sameNameInversePeersRelationship.oppositeExists === true,
    'same-name self many-to-many inverse relationships should detect the opposite field',
  )
  assert(
    sameNameInversePeersRelationship.oppositeMany === true,
    'same-name self many-to-many inverse relationships should preserve oppositeMany',
  )
  assert(
    sameNameInversePeersRelationship.isSelfReferential === true,
    'same-name self many-to-many inverse relationships should be marked self-referential',
  )
  assert(
    sameNameInversePeersRelationship.relationKind === 'manyToMany',
    'same-name self many-to-many inverse relationships should preserve manyToMany relationKind',
  )
  assert(
    sameNameInversePeersRelationship.ownership === 'shared',
    'same-name self many-to-many inverse relationships should preserve shared ownership locally',
  )
  assert(
    sameNameInversePeersRelationship.relationName === 'CategoryPeers',
    'same-name self many-to-many inverse relationships should preserve the shared explicit relationName locally',
  )
  assert(
    sameNameInversePeersRelationship.joinTableName === 'CategoryPeers',
    'same-name self many-to-many inverse relationships should preserve joinTableName locally',
  )
  assert(
    sameNameInversePeersRelationship.foreignKeyFieldName === undefined,
    'same-name self many-to-many inverse relationships should not invent owned foreignKeyFieldName',
  )
  assert(
    sameNameInversePeersRelationship.foreignKeyMap === undefined,
    'same-name self many-to-many inverse relationships should not invent owned foreignKeyMap',
  )
  assert(
    sameNameInversePeersRelationship.relationArgs === undefined,
    'same-name self many-to-many inverse relationships should not invent owned relationArgs',
  )

  const oneToOneForeignKeyLists = initialiseLists(
    config({
      lists: {
        User: list({
          fields: {
            profile: relationship({
              ref: 'Profile.user',
              db: { foreignKey: { map: 'profile_id' } },
            }),
          },
        }),
        Profile: list({
          fields: {
            user: relationship({ ref: 'User.profile' }),
          },
        }),
      },
    }),
  )
  const oneToOneUserList = oneToOneForeignKeyLists.find(
    (entry) => entry.key === 'User',
  )
  const oneToOneProfileList = oneToOneForeignKeyLists.find(
    (entry) => entry.key === 'Profile',
  )
  assert(
    oneToOneUserList,
    'initialiseLists() should preserve User for one-to-one foreignKey ownership metadata checks',
  )
  assert(
    oneToOneProfileList,
    'initialiseLists() should preserve Profile for one-to-one foreignKey ownership metadata checks',
  )

  const userProfileRelationship =
    oneToOneUserList.resolvedDbFields.profile.relationship
  assert(
    userProfileRelationship,
    'User.profile should resolve relationship metadata',
  )
  assert(
    userProfileRelationship.relationKind === 'one',
    'one-to-one relationships should preserve relationKind one on the foreignKey-owning side',
  )
  assert(
    userProfileRelationship.ownership === 'own',
    'one-to-one relationships should preserve own ownership on the foreignKey-owning side',
  )
  assert(
    userProfileRelationship.foreignKeyFieldName === 'profileId',
    'one-to-one relationships should derive foreignKeyFieldName on the foreignKey-owning side',
  )
  assert(
    userProfileRelationship.foreignKeyMap === 'profile_id',
    'one-to-one relationships should preserve db.foreignKey.map on the foreignKey-owning side',
  )
  assert(
    userProfileRelationship.foreignKeyScalarType === 'String',
    'one-to-one relationships should preserve String foreignKeyScalarType for default id fields',
  )
  assert(
    userProfileRelationship.referencesFieldPath === 'id',
    'one-to-one relationships should preserve referencesFieldPath on the foreignKey-owning side',
  )
  assert(
    userProfileRelationship.referencedDbColumnName === 'id',
    'one-to-one relationships should preserve referencedDbColumnName on the foreignKey-owning side',
  )
  assert(
    userProfileRelationship.onDelete === 'SetNull',
    'one-to-one relationships should preserve onDelete on the foreignKey-owning side',
  )
  assert(
    userProfileRelationship.onUpdate === 'Cascade',
    'one-to-one relationships should preserve onUpdate on the foreignKey-owning side',
  )
  const oneToOneRelationArgs = userProfileRelationship.relationArgs
  if (!oneToOneRelationArgs) {
    throw new Error(
      'one-to-one relationships should preserve structured relationArgs on the foreignKey-owning side',
    )
  }
  assert(
    'referencesFieldPath' in oneToOneRelationArgs,
    'one-to-one relationships should preserve structured relationArgs on the foreignKey-owning side',
  )
  assert(
    'onDelete' in oneToOneRelationArgs,
    'one-to-one relationships should preserve structured relationArgs.onDelete on the foreignKey-owning side',
  )
  assert(
    'onUpdate' in oneToOneRelationArgs,
    'one-to-one relationships should preserve structured relationArgs.onUpdate on the foreignKey-owning side',
  )

  const profileUserRelationship =
    oneToOneProfileList.resolvedDbFields.user.relationship
  assert(
    profileUserRelationship,
    'Profile.user should resolve relationship metadata',
  )
  assert(
    profileUserRelationship.relationKind === 'one',
    'one-to-one relationships should preserve relationKind one on the non-owning side',
  )
  assert(
    profileUserRelationship.ownership === 'inverse',
    'one-to-one relationships should preserve inverse ownership on the non-owning side when the opposite side owns the foreign key',
  )
  assert(
    profileUserRelationship.foreignKeyFieldName === undefined,
    'one-to-one relationships should not derive foreignKeyFieldName on the non-owning side when the opposite side owns the foreign key',
  )

  const mappedManyToManyLists = initialiseLists(
    config({
      lists: {
        MappedCategory: list({
          db: { map: 'mapped_categories' },
          fields: {
            posts: relationship({
              ref: 'MappedPost.categories',
              many: true,
              db: { relationName: 'MappedPostCategories' },
            }),
          },
        }),
        MappedPost: list({
          db: { map: 'mapped_posts' },
          fields: {
            categories: relationship({
              ref: 'MappedCategory.posts',
              many: true,
              db: { relationName: 'MappedPostCategories' },
            }),
          },
        }),
      },
    }),
  )
  const mappedCategoryList = mappedManyToManyLists.find(
    (entry) => entry.key === 'MappedCategory',
  )
  const mappedPostListForMany = mappedManyToManyLists.find(
    (entry) => entry.key === 'MappedPost',
  )
  assert(
    mappedCategoryList,
    'initialiseLists() should preserve MappedCategory for mapped many-to-many metadata checks',
  )
  assert(
    mappedPostListForMany,
    'initialiseLists() should preserve MappedPost for mapped many-to-many metadata checks',
  )
  const mappedCategoryPostsRelationship =
    mappedCategoryList.resolvedDbFields.posts.relationship
  assert(
    mappedCategoryPostsRelationship,
    'mapped Category.posts should resolve relationship metadata',
  )
  assert(
    mappedCategoryPostsRelationship.relationKind === 'manyToMany',
    'resolvedDbFields should preserve manyToMany relationKind for mapped many-to-many relationships like MappedCategory.posts',
  )
  assert(
    mappedCategoryPostsRelationship.ownership === 'shared',
    'resolvedDbFields should preserve shared ownership for mapped many-to-many relationships like MappedCategory.posts',
  )
  assert(
    mappedCategoryPostsRelationship.foreignKeyFieldName === undefined,
    'resolvedDbFields should not invent owned foreignKeyFieldName for mapped many-to-many relationships like MappedCategory.posts',
  )
  assert(
    mappedCategoryPostsRelationship.foreignKeyMap === undefined,
    'resolvedDbFields should not invent owned foreignKeyMap for mapped many-to-many relationships like MappedCategory.posts',
  )
  assert(
    mappedCategoryPostsRelationship.relationArgs === undefined,
    'resolvedDbFields should not invent owned relationArgs for mapped many-to-many relationships like MappedCategory.posts',
  )
  assert(
    mappedCategoryPostsRelationship.onDelete === undefined,
    'resolvedDbFields should not invent owned onDelete metadata for mapped many-to-many relationships like MappedCategory.posts',
  )
  assert(
    mappedCategoryPostsRelationship.onUpdate === undefined,
    'resolvedDbFields should not invent owned onUpdate metadata for mapped many-to-many relationships like MappedCategory.posts',
  )
  assert(
    mappedCategoryPostsRelationship.relationName === 'MappedPostCategories',
    'resolvedDbFields should preserve explicit relationName for mapped many-to-many relationships like MappedCategory.posts',
  )
  assert(
    mappedCategoryPostsRelationship.refListPrismaMapping === 'mapped_posts',
    'resolvedDbFields should preserve refListPrismaMapping for mapped many-to-many relationships like MappedCategory.posts',
  )
  assert(
    mappedCategoryPostsRelationship.joinTableName === 'MappedPostCategories',
    'resolvedDbFields should preserve joinTableName for mapped many-to-many relationships like MappedCategory.posts',
  )
  assert(
    mappedCategoryPostsRelationship.joinTableNearForeignKey === 'posts',
    'resolvedDbFields should preserve joinTableNearForeignKey for mapped many-to-many relationships like MappedCategory.posts',
  )
  assert(
    mappedCategoryPostsRelationship.joinTableFarForeignKey === 'categories',
    'resolvedDbFields should preserve joinTableFarForeignKey for mapped many-to-many relationships like MappedCategory.posts',
  )
  assert(
    mappedCategoryPostsRelationship.joinTableNearForeignKeyScalarType ===
      'String',
    'resolvedDbFields should preserve String joinTableNearForeignKeyScalarType for mapped many-to-many relationships like MappedCategory.posts',
  )
  assert(
    mappedCategoryPostsRelationship.joinTableFarForeignKeyScalarType ===
      'String',
    'resolvedDbFields should preserve String joinTableFarForeignKeyScalarType for mapped many-to-many relationships like MappedCategory.posts',
  )
  assert(
    mappedCategoryPostsRelationship.joinTableNearReferencedDbColumnName ===
      'id',
    'resolvedDbFields should preserve joinTableNearReferencedDbColumnName for mapped many-to-many relationships like MappedCategory.posts',
  )
  assert(
    mappedCategoryPostsRelationship.joinTableFarReferencedDbColumnName === 'id',
    'resolvedDbFields should preserve joinTableFarReferencedDbColumnName for mapped many-to-many relationships like MappedCategory.posts',
  )
  const mappedPostCategoriesRelationship =
    mappedPostListForMany.resolvedDbFields.categories.relationship
  assert(
    mappedPostCategoriesRelationship,
    'mapped Post.categories should resolve relationship metadata',
  )
  assert(
    mappedPostCategoriesRelationship.relationKind === 'manyToMany',
    'resolvedDbFields should preserve manyToMany relationKind for mapped many-to-many relationships like MappedPost.categories',
  )
  assert(
    mappedPostCategoriesRelationship.ownership === 'shared',
    'resolvedDbFields should preserve shared ownership for mapped many-to-many relationships like MappedPost.categories',
  )
  assert(
    mappedPostCategoriesRelationship.foreignKeyFieldName === undefined,
    'resolvedDbFields should not invent owned foreignKeyFieldName for mapped many-to-many relationships like MappedPost.categories',
  )
  assert(
    mappedPostCategoriesRelationship.foreignKeyMap === undefined,
    'resolvedDbFields should not invent owned foreignKeyMap for mapped many-to-many relationships like MappedPost.categories',
  )
  assert(
    mappedPostCategoriesRelationship.relationArgs === undefined,
    'resolvedDbFields should not invent owned relationArgs for mapped many-to-many relationships like MappedPost.categories',
  )
  assert(
    mappedPostCategoriesRelationship.onDelete === undefined,
    'resolvedDbFields should not invent owned onDelete metadata for mapped many-to-many relationships like MappedPost.categories',
  )
  assert(
    mappedPostCategoriesRelationship.onUpdate === undefined,
    'resolvedDbFields should not invent owned onUpdate metadata for mapped many-to-many relationships like MappedPost.categories',
  )
  assert(
    mappedPostCategoriesRelationship.relationName === 'MappedPostCategories',
    'resolvedDbFields should preserve explicit relationName for mapped many-to-many relationships like MappedPost.categories',
  )
  assert(
    mappedPostCategoriesRelationship.refListPrismaMapping ===
      'mapped_categories',
    'resolvedDbFields should preserve refListPrismaMapping for mapped many-to-many relationships like MappedPost.categories',
  )
  assert(
    mappedPostCategoriesRelationship.joinTableName === 'MappedPostCategories',
    'resolvedDbFields should preserve joinTableName for mapped many-to-many relationships like MappedPost.categories',
  )
  assert(
    mappedPostCategoriesRelationship.joinTableNearForeignKey === 'categories',
    'resolvedDbFields should preserve joinTableNearForeignKey for mapped many-to-many relationships like MappedPost.categories',
  )
  assert(
    mappedPostCategoriesRelationship.joinTableFarForeignKey === 'posts',
    'resolvedDbFields should preserve joinTableFarForeignKey for mapped many-to-many relationships like MappedPost.categories',
  )
  assert(
    mappedPostCategoriesRelationship.joinTableNearForeignKeyScalarType ===
      'String',
    'resolvedDbFields should preserve String joinTableNearForeignKeyScalarType for mapped many-to-many relationships like MappedPost.categories',
  )
  assert(
    mappedPostCategoriesRelationship.joinTableFarForeignKeyScalarType ===
      'String',
    'resolvedDbFields should preserve String joinTableFarForeignKeyScalarType for mapped many-to-many relationships like MappedPost.categories',
  )
  assert(
    mappedPostCategoriesRelationship.joinTableNearReferencedDbColumnName ===
      'id',
    'resolvedDbFields should preserve joinTableNearReferencedDbColumnName for mapped many-to-many relationships like MappedPost.categories',
  )
  assert(
    mappedPostCategoriesRelationship.joinTableFarReferencedDbColumnName ===
      'id',
    'resolvedDbFields should preserve joinTableFarReferencedDbColumnName for mapped many-to-many relationships like MappedPost.categories',
  )

  const mappedRelationshipLists = initialiseLists(
    config({
      lists: {
        MappedCategory: list({
          db: { map: 'mapped_categories' },
          fields: {
            title: text(),
          },
        }),
        MappedPost: list({
          fields: {
            category: relationship({
              ref: 'MappedCategory',
              db: { foreignKey: { map: 'mapped_category_id' } },
            }),
          },
        }),
      },
    }),
  )
  const mappedPostList = mappedRelationshipLists.find(
    (entry) => entry.key === 'MappedPost',
  )
  assert(
    mappedPostList,
    'initialiseLists() should preserve MappedPost for relationship mapping metadata checks',
  )
  const mappedCategoryRelationship =
    mappedPostList.resolvedDbFields.category.relationship
  assert(
    mappedCategoryRelationship,
    'mapped Post.category should resolve relationship metadata',
  )
  assert(
    mappedCategoryRelationship.refListPrismaMapping === 'mapped_categories',
    'resolvedDbFields should expose refListPrismaMapping from the related list when db.map is configured',
  )
  assert(
    mappedCategoryRelationship.foreignKeyMap === 'mapped_category_id',
    'resolvedDbFields should expose foreignKeyMap from db.foreignKey.map for owned relationships',
  )

  const mappedAutoincrementRelationshipLists = initialiseLists(
    config({
      db: { idField: { kind: 'autoincrement' } },
      lists: {
        MappedCounterRole: list({
          db: { map: 'mapped_counter_roles' },
          fields: {
            members: relationship({
              ref: 'MappedCounterUser.role',
              many: true,
            }),
          },
        }),
        MappedCounterUser: list({
          db: { map: 'mapped_counter_users' },
          fields: {
            role: relationship({
              ref: 'MappedCounterRole.members',
              db: { foreignKey: { map: 'mapped_counter_role_id' } },
            }),
          },
        }),
      },
    }),
  )
  const mappedCounterUserList = mappedAutoincrementRelationshipLists.find(
    (entry) => entry.key === 'MappedCounterUser',
  )
  assert(
    mappedCounterUserList,
    'initialiseLists() should preserve MappedCounterUser for autoincrement relationship mapping metadata checks',
  )
  const mappedCounterRoleRelationship =
    mappedCounterUserList.resolvedDbFields.role.relationship
  assert(
    mappedCounterRoleRelationship,
    'mapped CounterUser.role should resolve relationship metadata',
  )
  assert(
    mappedCounterRoleRelationship.relatedIdFieldKind === 'autoincrement',
    'resolvedDbFields should preserve relatedIdFieldKind for autoincrement mapped owned relationships',
  )
  assert(
    mappedCounterRoleRelationship.foreignKeyScalarType === 'Int',
    'resolvedDbFields should preserve Int foreignKeyScalarType for autoincrement mapped owned relationships',
  )
  assert(
    mappedCounterRoleRelationship.referencedDbColumnName === 'id',
    'resolvedDbFields should expose referencedDbColumnName for autoincrement mapped owned relationships',
  )
  assert(
    mappedCounterRoleRelationship.foreignKeyMap === 'mapped_counter_role_id',
    'resolvedDbFields should expose foreignKeyMap from db.foreignKey.map for autoincrement mapped owned relationships',
  )

  const mappedAutoincrementManyToManyLists = initialiseLists(
    config({
      db: { idField: { kind: 'autoincrement' } },
      lists: {
        MappedCounterCategory: list({
          db: { map: 'mapped_counter_categories' },
          fields: {
            posts: relationship({
              ref: 'MappedCounterPost.categories',
              many: true,
              db: { relationName: 'MappedCounterPostCategories' },
            }),
          },
        }),
        MappedCounterPost: list({
          db: { map: 'mapped_counter_posts' },
          fields: {
            categories: relationship({
              ref: 'MappedCounterCategory.posts',
              many: true,
              db: { relationName: 'MappedCounterPostCategories' },
            }),
          },
        }),
      },
    }),
  )
  const mappedCounterCategoryList = mappedAutoincrementManyToManyLists.find(
    (entry) => entry.key === 'MappedCounterCategory',
  )
  const mappedCounterPostListForMany = mappedAutoincrementManyToManyLists.find(
    (entry) => entry.key === 'MappedCounterPost',
  )
  assert(
    mappedCounterCategoryList,
    'initialiseLists() should preserve MappedCounterCategory for mapped autoincrement many-to-many metadata checks',
  )
  assert(
    mappedCounterPostListForMany,
    'initialiseLists() should preserve MappedCounterPost for mapped autoincrement many-to-many metadata checks',
  )
  const mappedCounterCategoryPostsRelationship =
    mappedCounterCategoryList.resolvedDbFields.posts.relationship
  assert(
    mappedCounterCategoryPostsRelationship,
    'mapped CounterCategory.posts should resolve relationship metadata',
  )
  assert(
    mappedCounterCategoryPostsRelationship.relationKind === 'manyToMany',
    'resolvedDbFields should preserve manyToMany relationKind for mapped autoincrement many-to-many relationships like MappedCounterCategory.posts',
  )
  assert(
    mappedCounterCategoryPostsRelationship.ownership === 'shared',
    'resolvedDbFields should preserve shared ownership for mapped autoincrement many-to-many relationships like MappedCounterCategory.posts',
  )
  assert(
    mappedCounterCategoryPostsRelationship.foreignKeyFieldName === undefined,
    'resolvedDbFields should not invent owned foreignKeyFieldName for mapped autoincrement many-to-many relationships like MappedCounterCategory.posts',
  )
  assert(
    mappedCounterCategoryPostsRelationship.foreignKeyMap === undefined,
    'resolvedDbFields should not invent owned foreignKeyMap for mapped autoincrement many-to-many relationships like MappedCounterCategory.posts',
  )
  assert(
    mappedCounterCategoryPostsRelationship.relationArgs === undefined,
    'resolvedDbFields should not invent owned relationArgs for mapped autoincrement many-to-many relationships like MappedCounterCategory.posts',
  )
  assert(
    mappedCounterCategoryPostsRelationship.onDelete === undefined,
    'resolvedDbFields should not invent owned onDelete metadata for mapped autoincrement many-to-many relationships like MappedCounterCategory.posts',
  )
  assert(
    mappedCounterCategoryPostsRelationship.onUpdate === undefined,
    'resolvedDbFields should not invent owned onUpdate metadata for mapped autoincrement many-to-many relationships like MappedCounterCategory.posts',
  )
  assert(
    mappedCounterCategoryPostsRelationship.relationName ===
      'MappedCounterPostCategories',
    'resolvedDbFields should preserve explicit relationName for mapped autoincrement many-to-many relationships like MappedCounterCategory.posts',
  )
  assert(
    mappedCounterCategoryPostsRelationship.refListPrismaMapping ===
      'mapped_counter_posts',
    'resolvedDbFields should preserve refListPrismaMapping for mapped autoincrement many-to-many relationships like MappedCounterCategory.posts',
  )
  assert(
    mappedCounterCategoryPostsRelationship.joinTableName ===
      'MappedCounterPostCategories',
    'resolvedDbFields should preserve joinTableName for mapped autoincrement many-to-many relationships like MappedCounterCategory.posts',
  )
  assert(
    mappedCounterCategoryPostsRelationship.joinTableNearIdFieldKind ===
      'autoincrement',
    'resolvedDbFields should preserve autoincrement joinTableNearIdFieldKind for mapped autoincrement many-to-many relationships like MappedCounterCategory.posts',
  )
  assert(
    mappedCounterCategoryPostsRelationship.joinTableFarIdFieldKind ===
      'autoincrement',
    'resolvedDbFields should preserve autoincrement joinTableFarIdFieldKind for mapped autoincrement many-to-many relationships like MappedCounterCategory.posts',
  )
  assert(
    mappedCounterCategoryPostsRelationship.joinTableNearForeignKeyScalarType ===
      'Int',
    'resolvedDbFields should preserve Int joinTableNearForeignKeyScalarType for mapped autoincrement many-to-many relationships like MappedCounterCategory.posts',
  )
  assert(
    mappedCounterCategoryPostsRelationship.joinTableFarForeignKeyScalarType ===
      'Int',
    'resolvedDbFields should preserve Int joinTableFarForeignKeyScalarType for mapped autoincrement many-to-many relationships like MappedCounterCategory.posts',
  )
  assert(
    mappedCounterCategoryPostsRelationship.joinTableNearReferencedDbColumnName ===
      'id',
    'resolvedDbFields should preserve joinTableNearReferencedDbColumnName for mapped autoincrement many-to-many relationships like MappedCounterCategory.posts',
  )
  assert(
    mappedCounterCategoryPostsRelationship.joinTableFarReferencedDbColumnName ===
      'id',
    'resolvedDbFields should preserve joinTableFarReferencedDbColumnName for mapped autoincrement many-to-many relationships like MappedCounterCategory.posts',
  )
  const mappedCounterPostCategoriesRelationship =
    mappedCounterPostListForMany.resolvedDbFields.categories.relationship
  assert(
    mappedCounterPostCategoriesRelationship,
    'mapped CounterPost.categories should resolve relationship metadata',
  )
  assert(
    mappedCounterPostCategoriesRelationship.relationKind === 'manyToMany',
    'resolvedDbFields should preserve manyToMany relationKind for mapped autoincrement many-to-many relationships like MappedCounterPost.categories',
  )
  assert(
    mappedCounterPostCategoriesRelationship.ownership === 'shared',
    'resolvedDbFields should preserve shared ownership for mapped autoincrement many-to-many relationships like MappedCounterPost.categories',
  )
  assert(
    mappedCounterPostCategoriesRelationship.foreignKeyFieldName === undefined,
    'resolvedDbFields should not invent owned foreignKeyFieldName for mapped autoincrement many-to-many relationships like MappedCounterPost.categories',
  )
  assert(
    mappedCounterPostCategoriesRelationship.foreignKeyMap === undefined,
    'resolvedDbFields should not invent owned foreignKeyMap for mapped autoincrement many-to-many relationships like MappedCounterPost.categories',
  )
  assert(
    mappedCounterPostCategoriesRelationship.relationArgs === undefined,
    'resolvedDbFields should not invent owned relationArgs for mapped autoincrement many-to-many relationships like MappedCounterPost.categories',
  )
  assert(
    mappedCounterPostCategoriesRelationship.onDelete === undefined,
    'resolvedDbFields should not invent owned onDelete metadata for mapped autoincrement many-to-many relationships like MappedCounterPost.categories',
  )
  assert(
    mappedCounterPostCategoriesRelationship.onUpdate === undefined,
    'resolvedDbFields should not invent owned onUpdate metadata for mapped autoincrement many-to-many relationships like MappedCounterPost.categories',
  )
  assert(
    mappedCounterPostCategoriesRelationship.relationName ===
      'MappedCounterPostCategories',
    'resolvedDbFields should preserve explicit relationName for mapped autoincrement many-to-many relationships like MappedCounterPost.categories',
  )
  assert(
    mappedCounterPostCategoriesRelationship.refListPrismaMapping ===
      'mapped_counter_categories',
    'resolvedDbFields should preserve refListPrismaMapping for mapped autoincrement many-to-many relationships like MappedCounterPost.categories',
  )
  assert(
    mappedCounterPostCategoriesRelationship.joinTableName ===
      'MappedCounterPostCategories',
    'resolvedDbFields should preserve joinTableName for mapped autoincrement many-to-many relationships like MappedCounterPost.categories',
  )
  assert(
    mappedCounterPostCategoriesRelationship.joinTableNearIdFieldKind ===
      'autoincrement',
    'resolvedDbFields should preserve autoincrement joinTableNearIdFieldKind for mapped autoincrement many-to-many relationships like MappedCounterPost.categories',
  )
  assert(
    mappedCounterPostCategoriesRelationship.joinTableFarIdFieldKind ===
      'autoincrement',
    'resolvedDbFields should preserve autoincrement joinTableFarIdFieldKind for mapped autoincrement many-to-many relationships like MappedCounterPost.categories',
  )
  assert(
    mappedCounterPostCategoriesRelationship.joinTableNearForeignKeyScalarType ===
      'Int',
    'resolvedDbFields should preserve Int joinTableNearForeignKeyScalarType for mapped autoincrement many-to-many relationships like MappedCounterPost.categories',
  )
  assert(
    mappedCounterPostCategoriesRelationship.joinTableFarForeignKeyScalarType ===
      'Int',
    'resolvedDbFields should preserve Int joinTableFarForeignKeyScalarType for mapped autoincrement many-to-many relationships like MappedCounterPost.categories',
  )
  assert(
    mappedCounterPostCategoriesRelationship.joinTableNearReferencedDbColumnName ===
      'id',
    'resolvedDbFields should preserve joinTableNearReferencedDbColumnName for mapped autoincrement many-to-many relationships like MappedCounterPost.categories',
  )
  assert(
    mappedCounterPostCategoriesRelationship.joinTableFarReferencedDbColumnName ===
      'id',
    'resolvedDbFields should preserve joinTableFarReferencedDbColumnName for mapped autoincrement many-to-many relationships like MappedCounterPost.categories',
  )

  const autoincrementRelationshipLists = initialiseLists(
    config({
      db: { idField: { kind: 'autoincrement' } },
      lists: {
        CounterThing: list({
          fields: {
            title: text(),
          },
        }),
        EventThing: list({
          fields: {
            counter: relationship({ ref: 'CounterThing' }),
            counters: relationship({ ref: 'CounterThing', many: true }),
          },
        }),
      },
    }),
  )
  const eventThingList = autoincrementRelationshipLists.find(
    (entry) => entry.key === 'EventThing',
  )
  assert(
    eventThingList,
    'initialiseLists() should preserve EventThing for autoincrement relationship metadata checks',
  )
  const counterRelationship =
    eventThingList.resolvedDbFields.counter.relationship
  assert(
    counterRelationship,
    'EventThing.counter should resolve relationship metadata',
  )
  assert(
    counterRelationship.refListKey === 'CounterThing',
    'autoincrement relationships should preserve refListKey',
  )
  assert(
    counterRelationship.relatedIdFieldKind === 'autoincrement',
    'autoincrement relationships should expose relatedIdFieldKind from the related list id field',
  )
  assert(
    counterRelationship.foreignKeyFieldName === 'counterId',
    'autoincrement owned relationships should still derive foreignKeyFieldName',
  )
  assert(
    counterRelationship.foreignKeyScalarType === 'Int',
    'autoincrement owned relationships should expose foreignKeyScalarType Int',
  )
  const counterRelationArgs = counterRelationship.relationArgs
  assert(
    counterRelationArgs,
    'autoincrement owned relationships should expose structured relationArgs',
  )
  assert(
    counterRelationArgs.relationName === 'EventThing_counter',
    'owned relationships should derive relationArgs.relationName from arbitrary list and field names',
  )
  assert(
    'referencesFieldPath' in counterRelationArgs,
    'autoincrement owned relationships should expose structured relationArgs.referencesFieldPath',
  )
  assert(
    'onDelete' in counterRelationArgs,
    'autoincrement owned relationships should expose structured relationArgs.onDelete',
  )
  assert(
    'onUpdate' in counterRelationArgs,
    'autoincrement owned relationships should expose structured relationArgs.onUpdate',
  )
  assert(
    counterRelationship.referencesFieldPath === 'id',
    'autoincrement owned relationships should expose referencesFieldPath',
  )
  assert(
    counterRelationship.onDelete === 'SetNull',
    'autoincrement owned relationships should expose onDelete metadata',
  )
  assert(
    counterRelationship.onUpdate === 'Cascade',
    'autoincrement owned relationships should expose onUpdate metadata',
  )

  const countersRelationship =
    eventThingList.resolvedDbFields.counters.relationship
  assert(
    countersRelationship,
    'EventThing.counters should resolve relationship metadata',
  )
  assert(
    countersRelationship.refListKey === 'CounterThing',
    'autoincrement to-many relationships should preserve refListKey',
  )
  assert(
    countersRelationship.relatedIdFieldKind === 'autoincrement',
    'autoincrement to-many relationships should expose relatedIdFieldKind from the related list id field',
  )
  assert(
    countersRelationship.foreignKeyFieldName === undefined,
    'autoincrement to-many relationships should not derive foreignKeyFieldName on the many side',
  )

  console.info('CMS config normalization validation passed.')
}

main()
