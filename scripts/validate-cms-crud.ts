import { GraphQLError, graphql } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'

import { accessDenied, validationFailure } from '../src/features/cms/errors'
import {
  memoryCmsAdapter,
  resetMemoryAdapter,
  setCmsAdapterForTests,
} from '../src/features/cms/adapters'
import { config, initialiseLists, list } from '../src/features/cms/config'
import { relationship, text } from '../src/features/cms/keystone/fields'
import { cmsLists } from '../src/features/cms/registry'
import {
  buildCmsContext,
  createCmsContext,
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
  getCmsGraphQLSchema,
} from '../src/features/cms/runtime'

const schema = getCmsGraphQLSchema()

async function execute(
  source: string,
  variableValues?: Record<string, unknown>,
  contextValue?: Awaited<ReturnType<typeof createCmsContext>>,
) {
  const cmsContext =
    contextValue ??
    (await createCmsContext(new Request('http://local.test/api/graphql')))
  const result = await graphql({
    schema,
    source,
    variableValues,
    contextValue: cmsContext,
  })
  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join('\n'))
  }
  return result.data as Record<string, unknown>
}

async function executeExpectError(
  source: string,
  variableValues?: Record<string, unknown>,
  contextValue?: Awaited<ReturnType<typeof createCmsContext>>,
) {
  const cmsContext =
    contextValue ??
    (await createCmsContext(new Request('http://local.test/api/graphql')))
  const result = await graphql({
    schema,
    source,
    variableValues,
    contextValue: cmsContext,
  })
  assert(result.errors?.length, 'expected GraphQL operation to fail')
  return result.errors.map((error) => error.message).join('\n')
}

async function executeExpectGraphQLError(
  source: string,
  variableValues?: Record<string, unknown>,
  contextValue?: Awaited<ReturnType<typeof createCmsContext>>,
) {
  const cmsContext =
    contextValue ??
    (await createCmsContext(new Request('http://local.test/api/graphql')))
  const result = await graphql({
    schema,
    source,
    variableValues,
    contextValue: cmsContext,
  })
  assert(result.errors?.length, 'expected GraphQL operation to fail')
  return result.errors[0]
}

async function executeRaw(
  source: string,
  variableValues?: Record<string, unknown>,
  contextValue?: Awaited<ReturnType<typeof createCmsContext>>,
) {
  const cmsContext =
    contextValue ??
    (await createCmsContext(new Request('http://local.test/api/graphql')))
  return graphql({ schema, source, variableValues, contextValue: cmsContext })
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function uniqueIds(values: string[]) {
  return Array.from(new Set(values))
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

async function main() {
  process.env.CMS_ADAPTER = 'memory'
  process.env.CMS_DEV_AUTH_FALLBACK = 'true'
  process.env.CMS_DEV_AUTH_ITEM_ID = 'user_admin'
  setCmsAdapterForTests(memoryCmsAdapter)
  resetMemoryAdapter()

  const todoList = cmsLists.find((entry) => entry.key === 'Todo')
  assert(todoList, 'Todo model should initialise from src/features/cms/models')
  const assignedToField = todoList.fields.find(
    (field) => field.path === 'assignedTo',
  )
  assert(
    typeof assignedToField?.hooks?.resolveInput === 'function',
    'Todo.assignedTo default should be configured as a field resolveInput hook',
  )
  const taskStatusGroup = todoList.groups?.find(
    (group) => group.label === 'Task Status',
  )
  assert(
    taskStatusGroup?.fields.join(',') === 'isComplete,status,priority,tags',
    'Keystone-shaped group spread metadata should survive list initialization',
  )
  const coverImageField = todoList.fields.find(
    (field) => field.path === 'coverImage',
  )
  assert(
    coverImageField?.fieldMeta?.storage === 'my_images',
    'image({ storage }) compatibility metadata should survive list initialization',
  )
  const descriptionField = todoList.fields.find(
    (field) => field.path === 'description',
  )
  assert(
    descriptionField?.fieldMeta?.formatting === true &&
      Array.isArray(descriptionField.fieldMeta.layouts),
    'document field compatibility metadata should survive list initialization',
  )
  const userEmailField = cmsLists
    .find((entry) => entry.key === 'User')
    ?.fields.find((field) => field.path === 'email')
  assert(
    userEmailField?.db?.isUnique === true,
    "isIndexed: 'unique' should map to db.isUnique",
  )

  const adminMeta = await execute(/* GraphQL */ `
    query ValidateAdminMeta {
      keystone {
        adminMeta {
          lists {
            key
            fields {
              path
              fieldMeta
            }
            groups {
              label
              description
              fields {
                path
              }
            }
          }
        }
      }
    }
  `)
  const lists = ((
    (adminMeta.keystone as Record<string, unknown>).adminMeta as Record<
      string,
      unknown
    >
  ).lists ?? []) as Array<Record<string, unknown>>
  assert(
    lists.some((entry) => entry.key === 'TodoImage'),
    'adminMeta should include TodoImage',
  )
  const todoMeta = lists.find((entry) => entry.key === 'Todo')
  const adminTaskStatusGroup = (
    (todoMeta?.groups ?? []) as Array<Record<string, unknown>>
  ).find((group) => group.label === 'Task Status')
  const adminTaskStatusFields = (
    (adminTaskStatusGroup?.fields ?? []) as Array<Record<string, unknown>>
  )
    .map((field) => field.path)
    .join(',')
  assert(
    adminTaskStatusFields === 'isComplete,status,priority,tags',
    'adminMeta should expose compatibility group metadata',
  )
  const assignedToMeta = (
    (todoMeta?.fields ?? []) as Array<Record<string, unknown>>
  ).find((field) => field.path === 'assignedTo')
  assert(
    typeof asRecord(assignedToMeta?.fieldMeta).graphqlSelection === 'string' &&
      String(asRecord(assignedToMeta?.fieldMeta).graphqlSelection).includes(
        'assignedTo',
      ),
    'adminMeta should expose controller-oriented graphqlSelection metadata for relationship fields',
  )

  const sourceCompatibleLookup = await execute(/* GraphQL */ `
    query ValidateSourceCompatibleLookup {
      user(where: { id: "user_admin" }) {
        id
        email
      }
    }
  `)
  assert(
    (sourceCompatibleLookup.user as Record<string, unknown>).email ===
      'ada@example.com',
    'findOne should accept the source schema identity field',
  )

  const emptyUniqueMessage = await executeExpectError(/* GraphQL */ `
    query ValidateEmptyWhereUnique {
      user(where: {}) {
        id
      }
    }
  `)
  assert(
    emptyUniqueMessage.includes(
      'UserWhereUniqueInput must contain exactly one unique field',
    ),
    'empty where unique input should be rejected explicitly',
  )

  const initial = await execute(/* GraphQL */ `
    query ValidateRelationships {
      todos(orderBy: [{ label: asc }]) {
        id
        label
        status
        isComplete
        assignedTo {
          id
          name
        }
        todoImages(where: { altText: { contains: "Wireframe" } }) {
          id
          altText
        }
        todoImagesCount(where: { altText: { contains: "Wireframe" } })
        secretNote {
          isSet
        }
      }
      todosCount
      users {
        id
        name
        role {
          id
          name
        }
        tasksCount
      }
      roles {
        id
        name
        assignedToCount
      }
      todoImages {
        id
        altText
        todosCount
      }
    }
  `)
  assert(Array.isArray(initial.todos), 'todos query should return a list')
  assert(initial.todosCount === 3, 'seed todosCount should be 3')
  const launchTodo = (initial.todos as Array<Record<string, unknown>>).find(
    (todo) => todo.id === 'todo_launch',
  )
  assert(
    launchTodo,
    'seed todo_launch should be present in relationship validation query',
  )
  assert(
    Array.isArray(launchTodo.todoImages) &&
      (launchTodo.todoImages as Array<Record<string, unknown>>).length === 1,
    'to-many relationship output should honor nested where args',
  )
  assert(
    launchTodo.todoImagesCount === 1,
    'relationship count field should honor nested where args',
  )

  const notFilterResult = await execute(/* GraphQL */ `
    query ValidateKeystoneNotFilterShape {
      todos(
        where: { NOT: [{ label: { equals: "Launch checklist" } }] }
        orderBy: [{ label: asc }]
      ) {
        id
        label
      }
    }
  `)
  const notFilteredTodos = notFilterResult.todos as Array<
    Record<string, unknown>
  >
  assert(
    notFilteredTodos.length >= 1 &&
      !notFilteredTodos.some((todo) => todo.label === 'Launch checklist'),
    'where.NOT should use Keystone list shape and exclude matching items',
  )

  const scalarFilterResult = await execute(/* GraphQL */ `
    query ValidateExpandedScalarFilters {
      todos(
        where: {
          label: { contains: "launch", mode: insensitive }
          budget: { gte: "1200.00", lt: "1300.00" }
          largeNumber: { gt: "9007199254740992" }
          dueDate: {
            gte: "2026-05-31T00:00:00.000Z"
            lte: "2026-06-02T00:00:00.000Z"
          }
          secretNote: { isSet: true }
        }
      ) {
        id
        label
      }
    }
  `)
  const scalarFilteredTodos = scalarFilterResult.todos as Array<
    Record<string, unknown>
  >
  assert(
    scalarFilteredTodos.length === 1 &&
      scalarFilteredTodos[0]?.id === 'todo_launch',
    'expanded scalar filters should execute for string mode, decimal, bigInt, timestamp, and password isSet fields',
  )

  const decimalOrderingResult = await execute(/* GraphQL */ `
    query ValidateDecimalOrderingFilter {
      todos(
        where: { budget: { gt: "100.00", lt: "2000.00" } }
        orderBy: [{ budget: asc }]
      ) {
        id
        budget
      }
    }
  `)
  const decimalOrderedTodos = decimalOrderingResult.todos as Array<
    Record<string, unknown>
  >
  assert(
    decimalOrderedTodos.some((todo) => todo.id === 'todo_launch'),
    'decimal comparison should treat budget as numeric ordering, not lexicographic string ordering',
  )
  assert(
    !decimalOrderedTodos.some((todo) => todo.id === 'todo_docs'),
    'decimal comparison should exclude zero-valued budgets outside the numeric range',
  )

  const timestampOrderingResult = await execute(/* GraphQL */ `
    query ValidateTimestampOrderingFilter {
      todos(where: { dueDate: { gt: "2026-05-31T12:00:00.000Z" } }) {
        id
        dueDate
      }
    }
  `)
  const timestampOrderedTodos = timestampOrderingResult.todos as Array<
    Record<string, unknown>
  >
  assert(
    timestampOrderedTodos.length === 1 &&
      timestampOrderedTodos[0]?.id === 'todo_launch',
    'timestamp comparison should use parsed date ordering rather than plain string coincidence',
  )

  const created = await execute(/* GraphQL */ `
    mutation ValidateCreate {
      createTodo(
        data: {
          label: "Adapter validation"
          todoImages: { connect: [{ id: "image_dashboard" }] }
        }
      ) {
        id
        label
        status
        priority
        isComplete
        assignedTo {
          id
        }
        todoImages {
          id
        }
      }
    }
  `)
  const invalidImageMetadataMessage = await executeExpectError(/* GraphQL */ `
    mutation ValidateImageMetadataWriteRejection {
      createTodo(
        data: {
          label: "Invalid image metadata"
          coverImage: {
            id: "manual"
            filename: "manual.png"
            extension: "png"
            filesize: 10
            storage: "my_images"
            url: "/files/manual.png"
            width: 1
            height: 1
          }
        }
      ) {
        id
      }
    }
  `)
  assert(
    invalidImageMetadataMessage.includes(
      'Field "id" is not defined by type "ImageFieldInput"',
    ) ||
      invalidImageMetadataMessage.includes(
        'coverImage must be provided as an Upload input',
      ),
    'image fields should reject handcrafted metadata writes',
  )
  const createdTodo = created.createTodo as Record<string, unknown>
  assert(createdTodo.id, 'createTodo should return an id')
  assert(
    createdTodo.status === 'todo',
    'createTodo should apply status default',
  )
  assert(
    (createdTodo.assignedTo as Record<string, unknown>).id === 'user_admin',
    'createTodo should default assignedTo from session',
  )

  const invalidNullDocumentMessage = await executeExpectError(/* GraphQL */ `
    mutation ValidateNullDocumentRejection {
      createTodo(data: { label: "Null document", description: null }) {
        id
      }
    }
  `)
  assert(
    invalidNullDocumentMessage.includes(
      'description document fields cannot be set to null',
    ),
    'document fields should reject null input with a validation failure',
  )

  const invalidDocumentMessage = await executeExpectError(/* GraphQL */ `
    mutation ValidateInvalidDocumentRejection {
      createTodo(
        data: { label: "Invalid document", description: { document: [] } }
      ) {
        id
      }
    }
  `)
  assert(
    invalidDocumentMessage.includes(
      'description must be a valid document value',
    ),
    'document fields should reject empty/invalid document payloads',
  )

  const createdDocumentTodo = await execute(/* GraphQL */ `
    mutation ValidateDocumentNormalization {
      createTodo(
        data: {
          label: "Document normalization"
          description: {
            document: [
              { type: "paragraph", children: [{ text: "Normalized document" }] }
            ]
          }
        }
      ) {
        id
        description {
          document(hydrateRelationships: true)
        }
      }
    }
  `)
  const createdDocumentTodoId = asRecord(createdDocumentTodo.createTodo)
    .id as string
  const normalizedDocument = asRecord(
    asRecord(createdDocumentTodo.createTodo).description,
  ).document
  assert(
    Array.isArray(normalizedDocument),
    'document create should return Keystone-style document output after normalization',
  )
  await execute(
    /* GraphQL */ `
      mutation CleanupDocumentNormalizationTodo($id: ID!) {
        deleteTodo(where: { id: $id }) {
          id
        }
      }
    `,
    { id: createdDocumentTodoId },
  )

  const nestedCreated = await execute(/* GraphQL */ `
    mutation ValidateNestedCreate {
      createTodo(
        data: {
          label: "Nested relationship validation"
          assignedTo: {
            create: {
              name: "Nested Assigned User"
              email: "nested-assigned@example.com"
              password: "password123"
            }
          }
          todoImages: {
            create: [
              {
                altText: "Nested image one"
                imagePath: "/images/todos/nested-one.png"
              }
              {
                altText: "Nested image two"
                imagePath: "/images/todos/nested-two.png"
              }
            ]
          }
        }
      ) {
        id
        label
        status
        assignedTo {
          id
          name
        }
        todoImages {
          id
          altText
        }
        todoImagesCount
      }
    }
  `)
  const nestedCreatedTodo = nestedCreated.createTodo as Record<string, unknown>
  assert(
    nestedCreatedTodo.status === 'todo',
    'nested parent create should still run Todo create defaults',
  )
  assert(
    (nestedCreatedTodo.assignedTo as Record<string, unknown>).name ===
      'Nested Assigned User',
    'to-one nested create should create and connect the related User',
  )
  const initialNestedUserId = (
    nestedCreatedTodo.assignedTo as Record<string, unknown>
  ).id as string
  const nestedCreateImages = (nestedCreatedTodo.todoImages ?? []) as Array<
    Record<string, unknown>
  >
  assert(
    nestedCreatedTodo.todoImagesCount === 2 && nestedCreateImages.length === 2,
    'to-many nested create should create and connect related TodoImages',
  )

  const nestedUpdated = await execute(
    /* GraphQL */ `
      mutation ValidateNestedUpdate($id: ID!) {
        updateTodo(
          where: { id: $id }
          data: {
            assignedTo: {
              create: {
                name: "Nested Update User"
                email: "nested-update@example.com"
                password: "password123"
              }
            }
            todoImages: {
              create: [
                {
                  altText: "Nested update image"
                  imagePath: "/images/todos/nested-update.png"
                }
              ]
            }
          }
        ) {
          id
          assignedTo {
            id
            name
          }
          todoImages {
            id
            altText
          }
          todoImagesCount
        }
      }
    `,
    { id: nestedCreatedTodo.id },
  )
  const nestedUpdatedTodo = nestedUpdated.updateTodo as Record<string, unknown>
  assert(
    (nestedUpdatedTodo.assignedTo as Record<string, unknown>).name ===
      'Nested Update User',
    'to-one nested create should work in update inputs',
  )
  assert(
    nestedUpdatedTodo.todoImagesCount === 3,
    'to-many nested create should append during update inputs',
  )

  const nestedEditorContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { 'x-cms-user-id': 'user_editor' },
    }),
  )
  const nestedDeniedMessage = await executeExpectError(
    /* GraphQL */ `
      mutation ValidateNestedCreateAccessDenied {
        createTodo(
          data: {
            label: "Denied nested user todo"
            assignedTo: {
              create: {
                name: "Denied Nested User"
                email: "denied-nested@example.com"
                password: "password123"
              }
            }
          }
        ) {
          id
        }
      }
    `,
    undefined,
    nestedEditorContext,
  )
  assert(
    nestedDeniedMessage.includes('Access denied: create User'),
    'nested create should run related list operation access checks',
  )

  const relatedConnectDeniedMessage = await executeExpectError(
    /* GraphQL */ `
      mutation ValidateRelatedConnectAccessDenied {
        createTodo(
          data: {
            label: "Denied related connect todo"
            assignedTo: { connect: { id: "user_admin" } }
          }
        ) {
          id
        }
      }
    `,
    undefined,
    nestedEditorContext,
  )
  assert(
    relatedConnectDeniedMessage.includes('Cannot connect User user_admin'),
    'connect should check related item query access',
  )

  const emptyToOneCreateMessage = await executeExpectError(/* GraphQL */ `
    mutation ValidateEmptyToOneRelationshipCreate {
      createTodo(
        data: { label: "Empty to-one relationship create", assignedTo: {} }
      ) {
        id
      }
    }
  `)
  assert(
    emptyToOneCreateMessage.includes(
      'You must provide "connect" or "create" in to-one relationship inputs for "create" operations.',
    ),
    'to-one relationship create should reject empty relationship inputs',
  )

  const emptyToManyCreateMessage = await executeExpectError(/* GraphQL */ `
    mutation ValidateEmptyToManyRelationshipCreate {
      createTodo(
        data: { label: "Empty to-many relationship create", todoImages: {} }
      ) {
        id
      }
    }
  `)
  assert(
    emptyToManyCreateMessage.includes(
      'You must provide at least one of "set", "connect" or "create" in to-many relationship inputs for "create" operations.',
    ),
    'to-many relationship create should reject empty relationship inputs',
  )

  const emptyToOneUpdateMessage = await executeExpectError(/* GraphQL */ `
    mutation ValidateEmptyToOneRelationshipUpdate {
      updateTodo(where: { id: "todo_launch" }, data: { assignedTo: {} }) {
        id
      }
    }
  `)
  assert(
    emptyToOneUpdateMessage.includes(
      'You must provide one of "connect", "create" or "disconnect" in to-one relationship inputs for "update" operations.',
    ),
    'to-one relationship update should reject empty relationship inputs',
  )

  const emptyToManyUpdateMessage = await executeExpectError(/* GraphQL */ `
    mutation ValidateEmptyToManyRelationshipUpdate {
      updateTodo(where: { id: "todo_launch" }, data: { todoImages: {} }) {
        id
      }
    }
  `)
  assert(
    emptyToManyUpdateMessage.includes(
      'You must provide at least one of "set", "connect", "create" or "disconnect" in to-many relationship inputs for "update" operations.',
    ),
    'to-many relationship update should reject empty relationship inputs',
  )

  const imagesBeforeRollback = await execute(/* GraphQL */ `
    query CountImagesBeforeRollback {
      todoImagesCount
    }
  `)
  const rollbackMessage = await executeExpectError(/* GraphQL */ `
    mutation ValidateNestedRollback {
      createTodo(
        data: {
          label: "Rollback nested create"
          todoImages: {
            create: [
              {
                altText: "Rollback orphan image"
                imagePath: "/images/todos/rollback-orphan.png"
              }
            ]
          }
          assignedTo: { connect: { id: "missing_nested_rollback_user" } }
        }
      ) {
        id
      }
    }
  `)
  assert(
    rollbackMessage.includes(
      'Cannot connect User missing_nested_rollback_user',
    ),
    'failed parent relationship write should surface related item existence errors',
  )
  const imagesAfterRollback = await execute(/* GraphQL */ `
    query CountImagesAfterRollback {
      todoImagesCount
      todoImages(where: { altText: { equals: "Rollback orphan image" } }) {
        id
      }
    }
  `)
  assert(
    imagesAfterRollback.todoImagesCount ===
      imagesBeforeRollback.todoImagesCount,
    'memory transaction rollback should remove nested related creates after parent failure',
  )
  assert(
    ((imagesAfterRollback.todoImages ?? []) as unknown[]).length === 0,
    'memory rollback should leave no orphan nested related item',
  )

  const nestedBeforeCleanup = await execute(
    /* GraphQL */ `
      query ReadNestedBeforeCleanup($id: ID!) {
        todo(where: { id: $id }) {
          id
          assignedTo {
            id
          }
          todoImages {
            id
          }
        }
      }
    `,
    { id: nestedCreatedTodo.id },
  )
  const nestedBeforeCleanupTodo = nestedBeforeCleanup.todo as Record<
    string,
    unknown
  >
  const nestedUserId = ((
    nestedBeforeCleanupTodo.assignedTo as Record<string, unknown> | null
  )?.id ?? null) as string | null
  const nestedImageIds = (
    (nestedBeforeCleanupTodo.todoImages ?? []) as Array<Record<string, unknown>>
  ).map((image) => image.id)
  await execute(
    /* GraphQL */ `
      mutation CleanupNestedCreate($id: ID!) {
        deleteTodo(where: { id: $id }) {
          id
        }
      }
    `,
    { id: nestedCreatedTodo.id },
  )
  for (const userId of uniqueIds(
    [initialNestedUserId, nestedUserId].filter((id): id is string =>
      Boolean(id),
    ),
  )) {
    await execute(
      /* GraphQL */ `
        mutation CleanupNestedUser($id: ID!) {
          deleteUser(where: { id: $id }) {
            id
          }
        }
      `,
      { id: userId },
    )
  }
  for (const imageId of nestedImageIds) {
    await execute(
      /* GraphQL */ `
        mutation CleanupNestedImage($id: ID!) {
          deleteTodoImage(where: { id: $id }) {
            id
          }
        }
      `,
      { id: imageId },
    )
  }

  const updated = await execute(
    /* GraphQL */ `
      mutation ValidateUpdate($id: ID!) {
        updateTodo(
          where: { id: $id }
          data: {
            isComplete: true
            todoImages: { disconnect: [{ id: "image_dashboard" }] }
          }
        ) {
          id
          isComplete
          todoImagesCount
        }
      }
    `,
    { id: createdTodo.id },
  )
  const updatedTodo = updated.updateTodo as Record<string, unknown>
  assert(
    updatedTodo.isComplete === true,
    'updateTodo should update scalar fields',
  )
  assert(
    updatedTodo.todoImagesCount === 0,
    'updateTodo should disconnect relationships',
  )

  const reconnected = await execute(
    /* GraphQL */ `
      mutation ValidateReconnect($id: ID!) {
        updateTodo(
          where: { id: $id }
          data: { todoImages: { connect: [{ id: "image_dashboard" }] } }
        ) {
          id
          todoImagesCount
        }
      }
    `,
    { id: createdTodo.id },
  )
  assert(
    (reconnected.updateTodo as Record<string, unknown>).todoImagesCount === 1,
    'updateTodo should reconnect to-many relationships',
  )

  const setEmpty = await execute(
    /* GraphQL */ `
      mutation ValidateSetEmpty($id: ID!) {
        updateTodo(where: { id: $id }, data: { todoImages: { set: [] } }) {
          id
          todoImagesCount
        }
      }
    `,
    { id: createdTodo.id },
  )
  assert(
    (setEmpty.updateTodo as Record<string, unknown>).todoImagesCount === 0,
    'updateTodo should support to-many set: []',
  )

  const deleted = await execute(
    /* GraphQL */ `
      mutation ValidateDelete($id: ID!) {
        deleteTodo(where: { id: $id }) {
          id
          label
        }
      }
    `,
    { id: createdTodo.id },
  )
  assert(
    (deleted.deleteTodo as Record<string, unknown>).id === createdTodo.id,
    'deleteTodo should return deleted item',
  )

  const createdManyTodos = await execute(/* GraphQL */ `
    mutation ValidateCreateManyTodos {
      createTodos(
        data: [
          { label: "Many validation A", status: "todo" }
          { label: "Many validation B", priority: 2 }
        ]
      ) {
        id
        label
        status
        priority
        assignedTo {
          id
        }
      }
    }
  `)
  const manyTodos = (createdManyTodos.createTodos ?? []) as Array<
    Record<string, unknown>
  >
  assert(manyTodos.length === 2, 'createTodos should return two created todos')
  assert(
    manyTodos[0]?.label === 'Many validation A',
    'createTodos should preserve input order',
  )
  assert(
    (manyTodos[0]?.assignedTo as Record<string, unknown>).id === 'user_admin',
    'createTodos should apply create defaults per item',
  )

  const updatedManyTodos = await execute(
    /* GraphQL */ `
      mutation ValidateUpdateManyTodos($data: [TodoUpdateArgs!]!) {
        updateTodos(data: $data) {
          id
          status
          isComplete
        }
      }
    `,
    {
      data: manyTodos.map((todo) => ({
        where: { id: todo.id },
        data: { status: 'done', isComplete: true },
      })),
    },
  )
  const updatedTodos = (updatedManyTodos.updateTodos ?? []) as Array<
    Record<string, unknown>
  >
  assert(
    updatedTodos.length === 2,
    'updateTodos should return two updated todos',
  )
  assert(
    updatedTodos.every(
      (todo) => todo.status === 'done' && todo.isComplete === true,
    ),
    'updateTodos should update each item',
  )

  const deletedManyTodos = await execute(
    /* GraphQL */ `
      mutation ValidateDeleteManyTodos($where: [TodoWhereUniqueInput!]!) {
        deleteTodos(where: $where) {
          id
          label
        }
      }
    `,
    { where: manyTodos.map((todo) => ({ id: todo.id })) },
  )
  const deletedTodos = (deletedManyTodos.deleteTodos ?? []) as Array<
    Record<string, unknown>
  >
  assert(
    deletedTodos.map((todo) => todo.id).join(',') ===
      manyTodos.map((todo) => todo.id).join(','),
    'deleteTodos should preserve input order',
  )

  const createdManyRoles = await execute(/* GraphQL */ `
    mutation ValidateCreateManyRoles {
      createRoles(
        data: [
          { name: "Many Validation Role A" }
          { name: "Many Validation Role B", canAccessDashboard: true }
        ]
      ) {
        id
        name
        canAccessDashboard
      }
    }
  `)
  const manyRoles = (createdManyRoles.createRoles ?? []) as Array<
    Record<string, unknown>
  >
  assert(manyRoles.length === 2, 'createRoles should return two created roles')
  assert(
    manyRoles[0]?.name === 'Many Validation Role A',
    'createRoles should preserve input order',
  )

  const updatedManyRoles = await execute(
    /* GraphQL */ `
      mutation ValidateUpdateManyRoles($data: [RoleUpdateArgs!]!) {
        updateRoles(data: $data) {
          id
          canManageRoles
        }
      }
    `,
    {
      data: manyRoles.map((role) => ({
        where: { id: role.id },
        data: { canManageRoles: true },
      })),
    },
  )
  assert(
    (
      (updatedManyRoles.updateRoles ?? []) as Array<Record<string, unknown>>
    ).every((role) => role.canManageRoles === true),
    'updateRoles should update each role',
  )

  const deletedCreatedManyRoles = await execute(
    /* GraphQL */ `
      mutation ValidateDeleteManyRoles($where: [RoleWhereUniqueInput!]!) {
        deleteRoles(where: $where) {
          id
        }
      }
    `,
    { where: manyRoles.map((role) => ({ id: role.id })) },
  )
  assert(
    (
      (deletedCreatedManyRoles.deleteRoles ?? []) as Array<
        Record<string, unknown>
      >
    )
      .map((role) => role.id)
      .join(',') === manyRoles.map((role) => role.id).join(','),
    'deleteRoles should preserve input order for successful bulk deletes',
  )

  const partialManyRolesCreated = await execute(/* GraphQL */ `
    mutation CreatePartialManyRoles {
      createRoles(
        data: [
          { name: "Partial Many Role A" }
          { name: "Partial Many Role B" }
          { name: "Partial Many Role C" }
        ]
      ) {
        id
        name
      }
    }
  `)
  const partialManyRoles = (partialManyRolesCreated.createRoles ?? []) as Array<
    Record<string, unknown>
  >
  const [partialRoleA, partialRoleB, partialRoleC] = partialManyRoles
  const settledCleanupContext = (
    await createCmsContext(new Request('http://local.test/api/graphql'))
  ).sudo()

  const settledUpdateManyRoles = await executeRaw(
    /* GraphQL */ `
      mutation ValidateUpdateManyRolesPartialFailure(
        $data: [RoleUpdateArgs!]!
      ) {
        updateRoles(data: $data) {
          id
          name
        }
      }
    `,
    {
      data: [
        {
          where: { id: partialRoleA.id },
          data: { name: 'Partial Many Updated A' },
        },
        {
          where: { id: partialRoleB.id },
          data: { assignedTo: { connect: [{ id: 'missing-user' }] } },
        },
        {
          where: { id: partialRoleC.id },
          data: { name: 'Partial Many Updated C' },
        },
      ],
    },
  )
  assert(
    settledUpdateManyRoles.errors?.length === 1,
    'updateMany should report item-level errors without failing the whole mutation',
  )
  const settledUpdatedRoles = ((
    settledUpdateManyRoles.data as Record<string, unknown>
  ).updateRoles ?? []) as Array<Record<string, unknown> | null>
  assert(
    settledUpdatedRoles.length === 3,
    'updateMany partial result should preserve input order',
  )
  assert(
    settledUpdatedRoles[0]?.name === 'Partial Many Updated A' &&
      settledUpdatedRoles[1] === null &&
      settledUpdatedRoles[2]?.name === 'Partial Many Updated C',
    'updateMany partial result should null only the failed item and preserve succeeding later items',
  )
  const postSettledUpdateRoles = await execute(
    /* GraphQL */ `
      query ValidateUpdateManyPartialPersistence(
        $a: RoleWhereUniqueInput!
        $b: RoleWhereUniqueInput!
        $c: RoleWhereUniqueInput!
      ) {
        roleA: role(where: $a) {
          id
          name
        }
        roleB: role(where: $b) {
          id
          name
        }
        roleC: role(where: $c) {
          id
          name
        }
      }
    `,
    {
      a: { id: partialRoleA.id },
      b: { id: partialRoleB.id },
      c: { id: partialRoleC.id },
    },
  )
  assert(
    (postSettledUpdateRoles.roleA as Record<string, unknown>).name ===
      'Partial Many Updated A',
    'updateMany should persist successful earlier items',
  )
  assert(
    (postSettledUpdateRoles.roleB as Record<string, unknown>).name ===
      'Partial Many Role B',
    'failed updateMany items should leave the original item unchanged',
  )
  assert(
    (postSettledUpdateRoles.roleC as Record<string, unknown>).name ===
      'Partial Many Updated C',
    'updateMany should still execute and persist successful later items after an item-level failure',
  )

  const settledDeleteManyRoles = await executeRaw(
    /* GraphQL */ `
      mutation ValidateDeleteManyRolesPartialFailure(
        $where: [RoleWhereUniqueInput!]!
      ) {
        deleteRoles(where: $where) {
          id
          name
        }
      }
    `,
    {
      where: [
        { id: partialRoleA.id },
        { id: 'role_missing' },
        { id: partialRoleC.id },
      ],
    },
  )
  assert(
    settledDeleteManyRoles.errors?.length === 1,
    'deleteMany should report item-level missing-item errors without failing the whole mutation',
  )
  const settledDeletedRoles = ((
    settledDeleteManyRoles.data as Record<string, unknown>
  ).deleteRoles ?? []) as Array<Record<string, unknown> | null>
  assert(
    settledDeletedRoles.length === 3,
    'deleteMany partial result should preserve input order',
  )
  assert(
    settledDeletedRoles[0]?.id === partialRoleA.id &&
      settledDeletedRoles[1] === null &&
      settledDeletedRoles[2]?.id === partialRoleC.id,
    'deleteMany partial result should null only the failed item and preserve succeeding later items',
  )
  const remainingPartialRoles = await settledCleanupContext.db.Role.findMany({
    where: { id: { in: [partialRoleA.id, partialRoleB.id, partialRoleC.id] } },
  })
  assert(
    remainingPartialRoles.length === 1 &&
      remainingPartialRoles[0]?.id === partialRoleB.id,
    'deleteMany should delete successful earlier and later items even when one entry fails',
  )
  await settledCleanupContext.db.Role.deleteOne({
    where: { id: partialRoleB.id },
  })

  const settledManyRoles = await executeRaw(/* GraphQL */ `
    mutation ValidateCreateManyRolesPartialFailure {
      createRoles(
        data: [
          { name: "Settled Many Role A" }
          {
            name: "Settled Invalid Relation"
            assignedTo: { connect: [{ id: "missing-user" }] }
          }
          { name: "Settled Many Role B" }
        ]
      ) {
        id
        name
      }
    }
  `)
  assert(
    settledManyRoles.errors?.length === 1,
    'createMany should report item-level errors without failing the whole mutation',
  )
  const settledRoles = ((settledManyRoles.data as Record<string, unknown>)
    .createRoles ?? []) as Array<Record<string, unknown> | null>
  assert(
    settledRoles.length === 3,
    'createMany partial result should preserve input order',
  )
  assert(
    settledRoles[0]?.name === 'Settled Many Role A' &&
      settledRoles[1] === null &&
      settledRoles[2]?.name === 'Settled Many Role B',
    'createMany partial result should null only the failed item',
  )
  const settledCleanupRoles = await settledCleanupContext.db.Role.findMany({
    where: { name: { in: ['Settled Many Role A', 'Settled Many Role B'] } },
  })
  for (const role of settledCleanupRoles) {
    await settledCleanupContext.db.Role.deleteOne({ where: { id: role.id } })
  }

  const anonymousCreateManyRoles = await executeRaw(
    /* GraphQL */ `
      mutation ValidateDeniedCreateManyRoles {
        createRoles(
          data: [{ name: "Denied Many Role A" }, { name: "Denied Many Role B" }]
        ) {
          id
          name
        }
      }
    `,
    undefined,
    await createCmsContext(
      new Request('http://local.test/api/graphql', {
        headers: { 'x-cms-anonymous': 'true' },
      }),
    ),
  )
  assert(
    anonymousCreateManyRoles.errors?.length === 2,
    'denied createMany should report one error per denied item',
  )
  const deniedManyRoles = ((
    anonymousCreateManyRoles.data as Record<string, unknown>
  ).createRoles ?? []) as Array<Record<string, unknown> | null>
  assert(
    deniedManyRoles.length === 2 &&
      deniedManyRoles.every((role) => role === null),
    'denied createMany should preserve input order and null each denied item',
  )
  assert(
    anonymousCreateManyRoles.errors.every(
      (error) => error.extensions.code === 'KS_ACCESS_DENIED',
    ),
    'denied createMany errors should preserve access-denied envelopes',
  )

  const aggregateValidationError = validationFailure([
    'Todo.label must be unique',
    'Todo.priority must be at least 1',
  ])
  assert(
    aggregateValidationError.extensions.code === 'KS_VALIDATION_FAILURE',
    'aggregate validation failures should use the Keystone-style validation failure code',
  )
  assert(
    aggregateValidationError.message ===
      'You provided invalid data for this operation.\n  - Todo.label must be unique\n  - Todo.priority must be at least 1',
    'aggregate validation failures should use the Keystone-style heading and bullet list formatting',
  )

  const normalizedAccessDenied = accessDenied('create Todo')
  assert(
    normalizedAccessDenied.extensions.code === 'KS_ACCESS_DENIED',
    'accessDenied helper should use the Keystone-style access denied code',
  )
  assert(
    normalizedAccessDenied.message === 'Access denied: create Todo',
    'accessDenied helper should prepend the official access denied heading when missing',
  )
  const preservedAccessDenied = accessDenied('Access denied: delete Todo')
  assert(
    preservedAccessDenied.message === 'Access denied: delete Todo',
    'accessDenied helper should preserve already-prefixed access denied messages without double-prefixing',
  )

  const invalidRelationshipError = await executeExpectGraphQLError(
    /* GraphQL */ `
      mutation ValidateInvalidToOneRelationshipShape {
        createTodo(
          data: {
            label: "Invalid relationship"
            assignedTo: {
              connect: { id: "user_admin" }
              create: {
                name: "Nested user"
                email: "nested-invalid@example.com"
                password: "password"
              }
            }
          }
        ) {
          id
        }
      }
    `,
    undefined,
    settledCleanupContext,
  )
  assert(
    invalidRelationshipError.extensions.code === 'KS_RELATIONSHIP_ERROR',
    'invalid nested relationship combinations should return relationship errors',
  )

  const invalidManySetDisconnectError = await executeExpectGraphQLError(
    /* GraphQL */ `
      mutation ValidateInvalidManySetDisconnectShape {
        updateTodo(
          where: { id: "todo_launch" }
          data: {
            todoImages: {
              set: [{ id: "image_wireframe" }]
              disconnect: [{ id: "image_dashboard" }]
            }
          }
        ) {
          id
        }
      }
    `,
    undefined,
    settledCleanupContext,
  )
  assert(
    invalidManySetDisconnectError.extensions.code === 'KS_RELATIONSHIP_ERROR',
    'to-many set+disconnect combinations should return relationship errors',
  )
  assert(
    invalidManySetDisconnectError.message.includes(
      'The "set" and "disconnect" fields cannot both be provided to to-many relationship inputs for "update" operations.',
    ),
    'to-many set+disconnect combinations should use the official-style relationship input wording',
  )

  const aggregatedManyRelationshipError = await executeExpectGraphQLError(
    /* GraphQL */ `
      mutation ValidateAggregatedManyRelationshipErrors {
        createTodo(
          data: {
            label: "Aggregated relationship errors"
            todoImages: {
              connect: [{ id: "missing_image_a" }, { id: "missing_image_b" }]
            }
          }
        ) {
          id
        }
      }
    `,
    undefined,
    settledCleanupContext,
  )
  assert(
    aggregatedManyRelationshipError.extensions.code === 'KS_RELATIONSHIP_ERROR',
    'to-many relationship misses should return relationship errors',
  )
  assert(
    aggregatedManyRelationshipError.message.includes(
      'An error occurred while resolving relationship fields.',
    ),
    'aggregated relationship misses should use the Keystone-style relationship error heading',
  )
  assert(
    aggregatedManyRelationshipError.message.includes('missing_image_a'),
    'aggregated relationship error should include the first missing related item',
  )
  assert(
    aggregatedManyRelationshipError.message.includes('missing_image_b'),
    'aggregated relationship error should include the later missing related item too',
  )
  assert(
    Array.isArray(aggregatedManyRelationshipError.extensions.debug),
    'aggregated relationship errors should expose debug payload entries',
  )

  const oneToOneLists = initialiseLists(
    config({
      lists: {
        Person: list({
          fields: {
            name: text(),
            pet: relationship({ ref: 'Pet.owner' }),
          },
        }),
        Pet: list({
          fields: {
            name: text(),
            owner: relationship({ ref: 'Person.pet' }),
          },
        }),
      },
    }),
  )
  const oneToOneSchema = makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(oneToOneLists),
    resolvers: generateCmsResolversForLists(oneToOneLists),
  })
  resetMemoryAdapter(
    {
      Person: [
        { id: 'person_a', name: 'Person A', pet: 'pet_1' },
        { id: 'person_b', name: 'Person B', pet: null },
      ],
      Pet: [{ id: 'pet_1', name: 'Pet 1', owner: 'person_a' }],
    },
    oneToOneLists,
  )
  const oneToOneContext = buildCmsContext({
    adapter: memoryCmsAdapter,
    sudo: true,
    internal: false,
    schema: oneToOneSchema,
    lists: oneToOneLists,
  })
  const reassignedOneToOne = await graphql({
    schema: oneToOneSchema,
    source: /* GraphQL */ `
      mutation ValidateSingleInverseReassignment {
        updatePerson(
          where: { id: "person_b" }
          data: { pet: { connect: { id: "pet_1" } } }
        ) {
          id
          pet {
            id
          }
        }
      }
    `,
    contextValue: oneToOneContext,
  })
  if (reassignedOneToOne.errors?.length)
    throw new Error(
      reassignedOneToOne.errors.map((error) => error.message).join('\n'),
    )
  const oneToOneReadContext = buildCmsContext({
    adapter: memoryCmsAdapter,
    sudo: true,
    internal: false,
    schema: oneToOneSchema,
    lists: oneToOneLists,
  })
  const oneToOneState = await graphql({
    schema: oneToOneSchema,
    source: /* GraphQL */ `
      query ValidateSingleInverseState {
        personA: person(where: { id: "person_a" }) {
          id
          pet {
            id
          }
        }
        personB: person(where: { id: "person_b" }) {
          id
          pet {
            id
          }
        }
        pet(where: { id: "pet_1" }) {
          id
          owner {
            id
          }
        }
      }
    `,
    contextValue: oneToOneReadContext,
  })
  if (oneToOneState.errors?.length)
    throw new Error(
      oneToOneState.errors.map((error) => error.message).join('\n'),
    )
  assert(
    asRecord(
      asRecord((oneToOneState.data as Record<string, unknown>).personA).pet,
    ).id == null,
    'reassigning a single-inverse relationship should clear the previous owner side',
  )
  assert(
    asRecord(
      asRecord((oneToOneState.data as Record<string, unknown>).personB).pet,
    ).id === 'pet_1',
    'reassigning a single-inverse relationship should connect the new owner side',
  )
  assert(
    asRecord(
      asRecord((oneToOneState.data as Record<string, unknown>).pet).owner,
    ).id === 'person_b',
    'reassigning a single-inverse relationship should move the inverse owner to the new item',
  )

  resetMemoryAdapter(
    {
      Person: [{ id: 'person_a', name: 'Person A', pet: 'pet_1' }],
      Pet: [{ id: 'pet_1', name: 'Pet 1', owner: 'person_a' }],
    },
    oneToOneLists,
  )
  const createdOneToOneContext = buildCmsContext({
    adapter: memoryCmsAdapter,
    sudo: true,
    internal: false,
    schema: oneToOneSchema,
    lists: oneToOneLists,
  })
  const createdOneToOne = await graphql({
    schema: oneToOneSchema,
    source: /* GraphQL */ `
      mutation ValidateCreateTimeSingleInverseReassignment {
        createPerson(
          data: { name: "Person C", pet: { connect: { id: "pet_1" } } }
        ) {
          id
          pet {
            id
          }
        }
      }
    `,
    contextValue: createdOneToOneContext,
  })
  if (createdOneToOne.errors?.length)
    throw new Error(
      createdOneToOne.errors.map((error) => error.message).join('\n'),
    )
  const createdOneToOneId = String(
    asRecord((createdOneToOne.data as Record<string, unknown>).createPerson).id,
  )
  const createdOneToOneReadContext = buildCmsContext({
    adapter: memoryCmsAdapter,
    sudo: true,
    internal: false,
    schema: oneToOneSchema,
    lists: oneToOneLists,
  })
  const createdOneToOneState = await graphql({
    schema: oneToOneSchema,
    source: /* GraphQL */ `
      query ValidateCreateTimeSingleInverseState($personId: ID!) {
        personA: person(where: { id: "person_a" }) {
          id
          pet {
            id
          }
        }
        persons: people(where: {}) {
          id
          pet {
            id
          }
        }
        pet(where: { id: "pet_1" }) {
          id
          owner {
            id
          }
        }
        personByPet: person(where: { pet: { id: "pet_1" } }) {
          id
        }
        petByOwner: pet(where: { owner: { id: $personId } }) {
          id
        }
      }
    `,
    variableValues: { personId: createdOneToOneId },
    contextValue: createdOneToOneReadContext,
  })
  if (createdOneToOneState.errors?.length)
    throw new Error(
      createdOneToOneState.errors.map((error) => error.message).join('\n'),
    )
  const createdPeople = ((createdOneToOneState.data as Record<string, unknown>)
    .persons ?? []) as Array<Record<string, unknown>>
  const createdPerson = createdPeople.find((person) => person.id !== 'person_a')
  assert(
    asRecord(
      asRecord((createdOneToOneState.data as Record<string, unknown>).personA)
        .pet,
    ).id == null,
    'create-time single-inverse reassignment should clear the previous owner side',
  )
  assert(
    asRecord(asRecord(createdPerson).pet).id === 'pet_1',
    'create-time single-inverse reassignment should connect the new owner side',
  )
  assert(
    asRecord((createdOneToOneState.data as Record<string, unknown>).personByPet)
      .id === createdPerson?.id &&
      asRecord(
        (createdOneToOneState.data as Record<string, unknown>).petByOwner,
      ).id === 'pet_1',
    'one-to-one relationship fields should execute as nested unique selectors',
  )
  assert(
    asRecord(
      asRecord((createdOneToOneState.data as Record<string, unknown>).pet)
        .owner,
    ).id === createdPerson?.id,
    'create-time single-inverse reassignment should move the inverse owner to the created item',
  )

  const manyToOneLists = initialiseLists(
    config({
      lists: {
        Team: list({
          fields: {
            name: text(),
            members: relationship({ ref: 'Member.team', many: true }),
          },
        }),
        Member: list({
          fields: {
            name: text(),
            team: relationship({ ref: 'Team.members' }),
          },
        }),
      },
    }),
  )
  const manyToOneSchema = makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(manyToOneLists),
    resolvers: generateCmsResolversForLists(manyToOneLists),
  })
  resetMemoryAdapter(
    {
      Team: [
        { id: 'team_a', name: 'Team A', members: ['member_1'] },
        { id: 'team_b', name: 'Team B', members: [] },
      ],
      Member: [{ id: 'member_1', name: 'Member 1', team: 'team_a' }],
    },
    manyToOneLists,
  )
  const manyToOneContext = buildCmsContext({
    adapter: memoryCmsAdapter,
    sudo: true,
    internal: false,
    schema: manyToOneSchema,
    lists: manyToOneLists,
  })
  const reassignedManyToOne = await graphql({
    schema: manyToOneSchema,
    source: /* GraphQL */ `
      mutation ValidateManyToOneInverseReassignment {
        updateTeam(
          where: { id: "team_b" }
          data: { members: { connect: [{ id: "member_1" }] } }
        ) {
          id
          members {
            id
          }
        }
      }
    `,
    contextValue: manyToOneContext,
  })
  if (reassignedManyToOne.errors?.length)
    throw new Error(
      reassignedManyToOne.errors.map((error) => error.message).join('\n'),
    )
  const manyToOneReadContext = buildCmsContext({
    adapter: memoryCmsAdapter,
    sudo: true,
    internal: false,
    schema: manyToOneSchema,
    lists: manyToOneLists,
  })
  const manyToOneState = await graphql({
    schema: manyToOneSchema,
    source: /* GraphQL */ `
      query ValidateManyToOneInverseState {
        teamA: team(where: { id: "team_a" }) {
          id
          members {
            id
          }
        }
        teamB: team(where: { id: "team_b" }) {
          id
          members {
            id
          }
        }
        member(where: { id: "member_1" }) {
          id
          team {
            id
          }
        }
      }
    `,
    contextValue: manyToOneReadContext,
  })
  if (manyToOneState.errors?.length)
    throw new Error(
      manyToOneState.errors.map((error) => error.message).join('\n'),
    )
  const teamAMembers = (
    (asRecord((manyToOneState.data as Record<string, unknown>).teamA).members ??
      []) as Array<Record<string, unknown>>
  ).map((member) => member.id)
  const teamBMembers = (
    (asRecord((manyToOneState.data as Record<string, unknown>).teamB).members ??
      []) as Array<Record<string, unknown>>
  ).map((member) => member.id)
  assert(
    teamAMembers.length === 0,
    'reassigning a many-to-one inverse relationship should remove the member from the previous source array',
  )
  assert(
    teamBMembers.length === 1 && teamBMembers[0] === 'member_1',
    'reassigning a many-to-one inverse relationship should add the member to the new source array',
  )
  assert(
    asRecord(
      asRecord((manyToOneState.data as Record<string, unknown>).member).team,
    ).id === 'team_b',
    'reassigning a many-to-one inverse relationship should move the inverse owner to the new source item',
  )

  resetMemoryAdapter(
    {
      Team: [{ id: 'team_a', name: 'Team A', members: ['member_1'] }],
      Member: [{ id: 'member_1', name: 'Member 1', team: 'team_a' }],
    },
    manyToOneLists,
  )
  const createdManyToOneContext = buildCmsContext({
    adapter: memoryCmsAdapter,
    sudo: true,
    internal: false,
    schema: manyToOneSchema,
    lists: manyToOneLists,
  })
  const createdManyToOne = await graphql({
    schema: manyToOneSchema,
    source: /* GraphQL */ `
      mutation ValidateCreateTimeManyToOneInverseReassignment {
        createTeam(
          data: { name: "Team C", members: { connect: [{ id: "member_1" }] } }
        ) {
          id
          members {
            id
          }
        }
      }
    `,
    contextValue: createdManyToOneContext,
  })
  if (createdManyToOne.errors?.length)
    throw new Error(
      createdManyToOne.errors.map((error) => error.message).join('\n'),
    )
  const createdManyToOneReadContext = buildCmsContext({
    adapter: memoryCmsAdapter,
    sudo: true,
    internal: false,
    schema: manyToOneSchema,
    lists: manyToOneLists,
  })
  const createdManyToOneState = await graphql({
    schema: manyToOneSchema,
    source: /* GraphQL */ `
      query ValidateCreateTimeManyToOneInverseState {
        teamA: team(where: { id: "team_a" }) {
          id
          members {
            id
          }
        }
        teams(where: {}) {
          id
          members {
            id
          }
        }
        member(where: { id: "member_1" }) {
          id
          team {
            id
          }
        }
      }
    `,
    contextValue: createdManyToOneReadContext,
  })
  if (createdManyToOneState.errors?.length)
    throw new Error(
      createdManyToOneState.errors.map((error) => error.message).join('\n'),
    )
  const createdTeams = ((createdManyToOneState.data as Record<string, unknown>)
    .teams ?? []) as Array<Record<string, unknown>>
  const createdTeam = createdTeams.find((team) => team.id !== 'team_a')
  const createdTeamMembers = (
    (asRecord(createdTeam).members ?? []) as Array<Record<string, unknown>>
  ).map((member) => member.id)
  const createTimeTeamAMembers = (
    (asRecord((createdManyToOneState.data as Record<string, unknown>).teamA)
      .members ?? []) as Array<Record<string, unknown>>
  ).map((member) => member.id)
  assert(
    createTimeTeamAMembers.length === 0,
    'create-time many-to-one inverse reassignment should remove the member from the previous source array',
  )
  assert(
    createdTeamMembers.length === 1 && createdTeamMembers[0] === 'member_1',
    'create-time many-to-one inverse reassignment should add the member to the created source array',
  )
  assert(
    asRecord(
      asRecord((createdManyToOneState.data as Record<string, unknown>).member)
        .team,
    ).id === createdTeam?.id,
    'create-time many-to-one inverse reassignment should move the inverse owner to the created source item',
  )

  resetMemoryAdapter()

  const editorContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { 'x-cms-user-id': 'user_editor' },
    }),
  )
  const editorAccess = await execute(
    /* GraphQL */ `
      query ValidateEditorAccess {
        todos(orderBy: [{ label: asc }]) {
          id
          assignedTo {
            id
          }
        }
        users {
          id
        }
      }
    `,
    undefined,
    editorContext,
  )
  const editorTodos = (editorAccess.todos ?? []) as Array<
    Record<string, unknown>
  >
  const editorUsers = (editorAccess.users ?? []) as Array<
    Record<string, unknown>
  >
  assert(
    editorTodos.length === 1 &&
      editorTodos.every(
        (todo) =>
          (todo.assignedTo as Record<string, unknown>).id === 'user_editor',
      ),
    'editor should only query assigned todos',
  )
  assert(
    editorUsers.length === 1 && editorUsers[0]?.id === 'user_editor',
    'editor should only query self',
  )

  const sudoContext = editorContext.sudo()
  const sudoAccess = await execute(
    /* GraphQL */ `
      query ValidateSudoAccess {
        todos(orderBy: [{ label: asc }]) {
          id
        }
        users(orderBy: [{ name: asc }]) {
          id
        }
      }
    `,
    undefined,
    sudoContext,
  )
  assert(
    ((sudoAccess.todos ?? []) as unknown[]).length === 3,
    'sudo should bypass Todo query filters',
  )
  assert(
    ((sudoAccess.users ?? []) as unknown[]).length === 2,
    'sudo should bypass User query filters',
  )

  const sudoUpdated = await execute(
    /* GraphQL */ `
      mutation ValidateSudoFieldAccess {
        updateTodo(
          where: { id: "todo_docs" }
          data: { assignedTo: { connect: { id: "user_admin" } } }
        ) {
          id
          assignedTo {
            id
          }
        }
      }
    `,
    undefined,
    sudoContext,
  )
  assert(
    (
      (sudoUpdated.updateTodo as Record<string, unknown>).assignedTo as Record<
        string,
        unknown
      >
    ).id === 'user_admin',
    'sudo should bypass field write access',
  )

  const anonymousContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { 'x-cms-anonymous': 'true' },
    }),
  )
  const anonymousDenied = await execute(
    /* GraphQL */ `
      query ValidateAnonymousDenied {
        todo(where: { id: "todo_docs" }) {
          id
        }
        todos {
          id
        }
        todosCount
      }
    `,
    undefined,
    anonymousContext,
  )
  assert(
    anonymousDenied.todo === null &&
      Array.isArray(anonymousDenied.todos) &&
      anonymousDenied.todos.length === 0 &&
      anonymousDenied.todosCount === 0,
    'denied reads should match Keystone hiding semantics (null, empty list, zero count) without access errors',
  )
  const anonymousSudo = await execute(
    /* GraphQL */ `
      query ValidateAnonymousSudo {
        todos {
          id
        }
      }
    `,
    undefined,
    anonymousContext.sudo(),
  )
  assert(
    ((anonymousSudo.todos ?? []) as unknown[]).length === 3,
    'anonymous sudo should bypass operation access',
  )
  assert(
    editorContext.internal().__internal.internal === true,
    'context.internal should return an internal-mode context',
  )

  const transactionCreated = await sudoContext.transaction(
    async (transactionContext) => {
      const item = await transactionContext.db.Todo.createOne({
        data: { label: 'Context transaction validation' },
      })
      const nestedItem = await transactionContext.transaction(
        async (nestedTransactionContext) => {
          const nestedTransactionCreated =
            await nestedTransactionContext.db.Todo.createOne({
              data: { label: 'Nested context transaction validation' },
            })
          const nestedCount = await nestedTransactionContext.db.Todo.count({
            where: {
              label: { equals: 'Nested context transaction validation' },
            },
          })
          assert(
            nestedCount === 1,
            'nested context.transaction should reuse the active transaction-scoped context without deadlocking',
          )
          return nestedTransactionCreated
        },
        {
          maxWait: 1000,
          timeout: 2000,
          isolationLevel: { Serializable: 'Serializable' },
        },
      )
      const count = await transactionContext.db.Todo.count({
        where: { label: { equals: 'Context transaction validation' } },
      })
      assert(
        count === 1,
        'context.transaction should expose db APIs on the transaction-scoped context',
      )
      return { item, nestedItem }
    },
    {
      maxWait: 1000,
      timeout: 2000,
      isolationLevel: { Serializable: 'Serializable' },
    },
  )
  assert(
    transactionCreated.item.id,
    'context.transaction should return callback results',
  )
  assert(
    transactionCreated.nestedItem.id,
    'nested context.transaction should return callback results',
  )
  await sudoContext.db.Todo.deleteOne({
    where: { id: transactionCreated.item.id },
  })
  await sudoContext.db.Todo.deleteOne({
    where: { id: transactionCreated.nestedItem.id },
  })

  const outerTransactionRollbackError = await sudoContext
    .transaction(
      async (transactionContext) => {
        await transactionContext.db.Todo.createOne({
          data: { label: 'Outer transaction rollback validation' },
        })
        throw new Error('outer transaction rollback sentinel')
      },
      {
        maxWait: 1000,
        timeout: 2000,
        isolationLevel: { Serializable: 'Serializable' },
      },
    )
    .catch((error) => error)
  assert(
    outerTransactionRollbackError instanceof Error,
    'outer transaction throw should propagate the original error',
  )
  assert(
    outerTransactionRollbackError.message ===
      'outer transaction rollback sentinel',
    'outer transaction throw should preserve the original error message',
  )
  const outerRollbackCount = await sudoContext.db.Todo.count({
    where: { label: { equals: 'Outer transaction rollback validation' } },
  })
  assert(
    outerRollbackCount === 0,
    'outer transaction throws should roll back transaction-scoped writes',
  )

  const nestedTransactionRollbackError = await sudoContext
    .transaction(
      async (transactionContext) => {
        await transactionContext.db.Todo.createOne({
          data: { label: 'Nested outer rollback validation' },
        })
        await transactionContext.transaction(
          async (nestedTransactionContext) => {
            await nestedTransactionContext.db.Todo.createOne({
              data: { label: 'Nested inner rollback validation' },
            })
            throw new Error('nested transaction rollback sentinel')
          },
          {
            maxWait: 1000,
            timeout: 2000,
            isolationLevel: { Serializable: 'Serializable' },
          },
        )
      },
      {
        maxWait: 1000,
        timeout: 2000,
        isolationLevel: { Serializable: 'Serializable' },
      },
    )
    .catch((error) => error)
  assert(
    nestedTransactionRollbackError instanceof Error,
    'nested transaction throw should propagate the original error',
  )
  assert(
    nestedTransactionRollbackError.message ===
      'nested transaction rollback sentinel',
    'nested transaction throw should preserve the original nested error message',
  )
  const nestedOuterRollbackCount = await sudoContext.db.Todo.count({
    where: { label: { equals: 'Nested outer rollback validation' } },
  })
  const nestedInnerRollbackCount = await sudoContext.db.Todo.count({
    where: { label: { equals: 'Nested inner rollback validation' } },
  })
  assert(
    nestedOuterRollbackCount === 0,
    'nested transaction throws should roll back outer transaction writes too',
  )
  assert(
    nestedInnerRollbackCount === 0,
    'nested transaction throws should roll back inner transaction writes',
  )

  const contextApiCreated = await sudoContext.db.Todo.createOne({
    data: { label: 'Context db validation' },
  })
  assert(
    contextApiCreated.id,
    'context.db.<list>.createOne should create an item',
  )
  const contextDbFound = await sudoContext.db.Todo.findOne({
    where: { id: contextApiCreated.id },
  })
  assert(
    contextDbFound?.label === 'Context db validation',
    'context.db.<list>.findOne should return adapter-shaped items',
  )
  const contextDbMany = await sudoContext.db.Todo.findMany({
    where: { label: { equals: 'Context db validation' } },
  })
  assert(
    contextDbMany.length === 1,
    'context.db.<list>.findMany should support where args',
  )
  const contextDbCount = await sudoContext.db.Todo.count({
    where: { label: { equals: 'Context db validation' } },
  })
  assert(
    contextDbCount === 1,
    'context.db.<list>.count should support where args',
  )
  const contextQueryFound = (await sudoContext.query.Todo.findOne({
    where: { id: contextApiCreated.id },
    query: 'id label assignedTo { id }',
  })) as Record<string, unknown>
  assert(
    contextQueryFound.label === 'Context db validation',
    'context.query.<list>.findOne should return GraphQL-shaped selections',
  )
  assert(
    asRecord(contextQueryFound.assignedTo).id === 'user_editor',
    'context.query.<list> should resolve selected relationships',
  )
  const contextQueryMany = (await sudoContext.query.Todo.findMany({
    where: { label: { equals: 'Context db validation' } },
    query: 'id label',
  })) as Array<Record<string, unknown>>
  assert(
    contextQueryMany.length === 1 &&
      contextQueryMany[0]?.label === 'Context db validation',
    'context.query.<list>.findMany should return GraphQL-shaped lists',
  )
  const contextQueryCount = await sudoContext.query.Todo.count({
    where: { label: { equals: 'Context db validation' } },
  })
  assert(
    contextQueryCount === 1,
    'context.query.<list>.count should return GraphQL count',
  )

  const contextDbManyRoles = await sudoContext.db.Role.createMany({
    data: [
      { name: 'Context DB Many Role A' },
      {
        name: 'Context DB Invalid Relation',
        assignedTo: { connect: [{ id: 'missing-user' }] },
      },
      { name: 'Context DB Many Role B' },
    ],
  }).catch((error) => error)
  assert(
    contextDbManyRoles instanceof GraphQLError,
    'context.db.createMany should surface item-level GraphQL errors when a bulk item fails',
  )
  assert(
    contextDbManyRoles.extensions.code === 'KS_RESOLVER_ERROR',
    'context.db.createMany bulk resolver failures should use the Keystone-style resolver error code',
  )
  const remainingContextDbRoles = await sudoContext.db.Role.findMany({
    where: {
      name: { in: ['Context DB Many Role A', 'Context DB Many Role B'] },
    },
  })
  assert(
    remainingContextDbRoles.length === 2,
    'context.db.createMany should still persist successful earlier and later items despite a failing middle item',
  )
  for (const role of remainingContextDbRoles)
    await sudoContext.db.Role.deleteOne({ where: { id: role.id } })

  const contextQueryManyRoles = await sudoContext.query.Role.createMany({
    data: [
      { name: 'Context Query Many Role A' },
      {
        name: 'Context Query Invalid Relation',
        assignedTo: { connect: [{ id: 'missing-user' }] },
      },
      { name: 'Context Query Many Role B' },
    ],
    query: 'id name',
  }).catch((error) => error)
  assert(
    contextQueryManyRoles instanceof GraphQLError,
    'context.query.createMany should surface item-level GraphQL errors when a bulk item fails',
  )
  assert(
    contextQueryManyRoles.extensions.code === 'KS_RESOLVER_ERROR',
    'context.query.createMany bulk resolver failures should use the Keystone-style resolver error code',
  )
  const remainingContextQueryRoles = await sudoContext.db.Role.findMany({
    where: {
      name: { in: ['Context Query Many Role A', 'Context Query Many Role B'] },
    },
  })
  assert(
    remainingContextQueryRoles.length === 2,
    'context.query.createMany should still persist successful earlier and later items despite a failing middle item',
  )
  for (const role of remainingContextQueryRoles)
    await sudoContext.db.Role.deleteOne({ where: { id: role.id } })

  assert(sudoContext.prisma === null, 'memory context.prisma should be null')
  const rawGraphql = await sudoContext.graphql.raw({ query: '{ todosCount }' })
  assert(
    !rawGraphql.errors?.length && asRecord(rawGraphql.data).todosCount === 4,
    'context.graphql.raw should execute against the CMS schema',
  )
  const runGraphql = await sudoContext.graphql.run({
    query: '{ redirectToInit }',
  })
  assert(
    runGraphql.redirectToInit === false,
    'context.graphql.run should execute extended GraphQL schema fields',
  )
  assert(
    sudoContext.graphql.schema.getQueryType()?.getFields().redirectToInit,
    'context.graphql.schema should include extended fields',
  )
  await sudoContext.db.Todo.deleteOne({ where: { id: contextApiCreated.id } })

  resetMemoryAdapter()
  const finalCount = await execute(/* GraphQL */ `
    query ValidateFinalCount {
      todosCount
      rolesCount
    }
  `)
  assert(
    finalCount.todosCount === 3,
    'todosCount should return to 3 after sudo validation reset',
  )
  assert(
    finalCount.rolesCount === 2,
    'rolesCount should return to 2 after deleteRoles',
  )

  console.info('CMS GraphQL memory CRUD validation passed.')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
