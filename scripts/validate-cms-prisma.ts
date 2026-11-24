import { createReadStream } from 'node:fs'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

import { graphql } from 'graphql'

import { setCmsAdapterForTests } from '../src/features/cms/adapters'
import { createPrismaCmsAdapter } from '../src/features/cms/adapters/prisma'
import { createCmsPrismaClient } from '../src/features/cms/prisma-client'
import { cmsLists } from '../src/features/cms/registry'
import {
  getStorageConfig,
  getStorageConfigs,
} from '../src/features/cms/storage-config'
import { storageUrl } from '../src/features/cms/storage-url'
import {
  createCmsContext,
  getCmsGraphQLSchema,
} from '../src/features/cms/runtime'

const schema = getCmsGraphQLSchema()
const prisma = createCmsPrismaClient()
const storageConfigs = getStorageConfigs()
const configuredImageStorage = storageConfigs.my_images

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function urlPath(value: string) {
  return new URL(value, 'http://local.test').pathname
}

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

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asArray(value: unknown) {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []
}

function uniqueIds(values: string[]) {
  return Array.from(new Set(values))
}

async function ensureSeedData() {
  const [usersCount, rolesCount, todosCount, todoImagesCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.role.count(),
      prisma.todo.count(),
      prisma.todoImage.count(),
    ])

  assert(
    usersCount >= 2,
    'Prisma validation expects seeded users; run npm run db:seed first',
  )
  assert(
    rolesCount >= 2,
    'Prisma validation expects seeded roles; run npm run db:seed first',
  )
  assert(
    todosCount >= 3,
    'Prisma validation expects seeded todos; run npm run db:seed first',
  )
  assert(
    todoImagesCount >= 2,
    'Prisma validation expects seeded todo images; run npm run db:seed first',
  )
}

async function main() {
  assert(
    process.env.DATABASE_URL,
    'DATABASE_URL is required for Prisma CMS validation',
  )
  process.env.CMS_ADAPTER = 'prisma'
  process.env.CMS_DEV_AUTH_FALLBACK = 'true'
  process.env.CMS_DEV_AUTH_ITEM_ID = 'user_admin'
  storageConfigs.my_images = {
    kind: 'local',
    type: 'image',
    storagePath: 'public/files',
    serverRoute: '/files',
  }
  setCmsAdapterForTests(createPrismaCmsAdapter({ prisma }))

  await ensureSeedData()

  const todoList = cmsLists.find((list) => list.key === 'Todo')
  const assignedToField = todoList?.fields.find(
    (field) => field.path === 'assignedTo',
  )
  assert(
    typeof assignedToField?.hooks?.resolveInput === 'function',
    'Todo.assignedTo default should be configured as a field resolveInput hook',
  )

  const initial = await execute(/* GraphQL */ `
    query ValidatePrismaInitial {
      todos(orderBy: [{ label: asc }]) {
        id
        label
        status
        isComplete
        coverImage {
          id
          extension
          filesize
          width
          height
          url
        }
        assignedTo {
          id
          name
        }
        todoImages {
          id
          altText
          image {
            id
            extension
            filesize
            width
            height
            url
          }
        }
        todoImagesCount
        secretNote {
          isSet
        }
      }
      todosCount
      users(orderBy: [{ name: asc }]) {
        id
        name
        role {
          id
          name
        }
        tasksCount
        password {
          isSet
        }
      }
      usersCount
      roles {
        id
        name
        assignedToCount
      }
      rolesCount
      todoImages {
        id
        altText
        todosCount
      }
      todoImagesCount
    }
  `)

  assert(
    initial.todosCount === 3,
    `seed todosCount should be 3, received ${String(initial.todosCount)}`,
  )
  assert(
    initial.usersCount === 2,
    `seed usersCount should be 2, received ${String(initial.usersCount)}`,
  )
  assert(
    initial.rolesCount === 2,
    `seed rolesCount should be 2, received ${String(initial.rolesCount)}`,
  )
  assert(
    initial.todoImagesCount === 2,
    `seed todoImagesCount should be 2, received ${String(initial.todoImagesCount)}`,
  )

  const todos = asArray(initial.todos)
  assert(todos.length === 3, 'todos query should return three seeded todos')
  assert(
    todos.some((todo) => asArray(todo.todoImages).length > 0),
    'todos query should resolve to-many relationships',
  )
  assert(
    todos.every((todo) => typeof asRecord(todo.secretNote).isSet === 'boolean'),
    'password fields should expose only PasswordState.isSet',
  )
  assert(
    !todos.some((todo) => typeof todo.secretNote === 'string'),
    'password field raw values must not be exposed',
  )
  const launchTodo = todos.find((todo) => todo.id === 'todo_launch')
  const launchCoverImage = asRecord(launchTodo?.coverImage)
  assert(
    launchCoverImage.id === 'cover_launch',
    'Prisma should reconstruct Todo.coverImage id from multi-column image fields',
  )
  assert(
    launchCoverImage.extension === 'png',
    'Prisma should reconstruct Todo.coverImage extension from multi-column image fields',
  )
  assert(
    launchCoverImage.filesize === 148000,
    'Prisma should reconstruct Todo.coverImage filesize from multi-column image fields',
  )
  assert(
    launchCoverImage.width === 1200,
    'Prisma should reconstruct Todo.coverImage width from multi-column image fields',
  )
  assert(
    launchCoverImage.height === 630,
    'Prisma should reconstruct Todo.coverImage height from multi-column image fields',
  )
  const imageStorage = getStorageConfig('my_images')
  assert(imageStorage, 'my_images storage should be configured')
  assert(
    typeof launchCoverImage.url === 'string' &&
      urlPath(launchCoverImage.url) ===
        urlPath(storageUrl(imageStorage, 'cover_launch.png')),
    'Prisma should reconstruct Todo.coverImage URL from arbitrary storage config and multi-column image fields',
  )
  const dashboardImageValue = asRecord(
    asArray(launchTodo?.todoImages).find(
      (entry) => entry.id === 'image_dashboard',
    )?.image,
  )
  assert(
    dashboardImageValue.id === 'dashboard',
    'Prisma should reconstruct TodoImage.image id from multi-column image fields',
  )
  assert(
    typeof dashboardImageValue.url === 'string' &&
      urlPath(dashboardImageValue.url) ===
        urlPath(storageUrl(imageStorage, 'dashboard.png')),
    'Prisma should reconstruct TodoImage.image URL from arbitrary storage config and multi-column image fields',
  )

  const users = asArray(initial.users)
  assert(
    users.some((user) => asRecord(user.role).id === 'role_admin'),
    'users query should resolve to-one role relationship',
  )
  assert(
    users.every((user) => user.password === null),
    'user password field read access should hide PasswordState from non-sudo queries',
  )

  const filtered = await execute(/* GraphQL */ `
    query ValidatePrismaFilters {
      todos(
        where: { status: { equals: "todo" } }
        orderBy: [{ priority: desc }]
      ) {
        id
        status
        priority
      }
      todosWithSecretNote: todos(where: { secretNote: { isSet: true } }) {
        id
      }
      todosCount(where: { isComplete: { equals: false } })
      todoImages(
        where: { todos: { some: { id: { equals: "todo_launch" } } } }
      ) {
        id
      }
    }
  `)
  assert(
    asArray(filtered.todos).every((todo) => todo.status === 'todo'),
    'status filter should constrain todos',
  )
  assert(
    asArray(filtered.todosWithSecretNote).length >= 1,
    'password isSet filter should preserve todos whose secretNote is set in Prisma',
  )
  assert(
    filtered.todosCount === 3,
    'boolean count filter should include all incomplete seeded todos',
  )
  assert(
    asArray(filtered.todoImages).length === 2,
    'relationship filter should find images connected to todo_launch',
  )

  const uploadSourcePath = join(
    await mkdtemp(join(tmpdir(), 'cms-prisma-image-upload-')),
    'fixture.png',
  )
  const uploadBytes = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000030000000208060000009d74661a0000000049454e44ae426082',
    'hex',
  )
  await writeFile(uploadSourcePath, uploadBytes)
  const upload = Promise.resolve({
    filename: 'prisma-cover.png',
    mimetype: 'image/png',
    encoding: '7bit',
    createReadStream: () => Readable.from(createReadStream(uploadSourcePath)),
  })

  const image = await prisma.todoImage.create({
    data: {
      id: 'image_prisma_validation',
      altText: 'Prisma validation image',
      imagePath: '/images/todos/prisma-validation.png',
      metadata: { validation: true },
    },
  })

  const created = await execute(
    /* GraphQL */ `
      mutation ValidatePrismaCreate($imageId: ID!, $upload: Upload!) {
        createTodo(
          data: {
            label: "Prisma adapter validation"
            status: "todo"
            priority: 4
            tags: ["backend", "testing"]
            metadata: { source: "validate-cms-prisma" }
            secretNote: "super secret"
            coverImage: { upload: $upload }
            todoImages: { connect: [{ id: $imageId }] }
          }
        ) {
          id
          label
          status
          priority
          isComplete
          tags
          coverImage {
            id
            extension
            filesize
            width
            height
            url
          }
          assignedTo {
            id
          }
          todoImages {
            id
          }
          todoImagesCount
          secretNote {
            isSet
          }
        }
      }
    `,
    { imageId: image.id, upload },
  )
  const createdTodo = asRecord(created.createTodo)
  const createdId = String(createdTodo.id)
  assert(
    createdId && createdId !== 'undefined',
    'createTodo should return an id',
  )
  assert(
    createdTodo.status === 'todo',
    'createTodo should persist explicit status',
  )
  assert(
    createdTodo.isComplete === false,
    'createTodo should apply Boolean defaults through Prisma',
  )
  const createdCoverImage = asRecord(createdTodo.coverImage)
  assert(
    createdCoverImage.extension === 'png',
    'createTodo should persist uploaded coverImage extension through Prisma image columns',
  )
  assert(
    createdCoverImage.width === 3 && createdCoverImage.height === 2,
    'createTodo should persist uploaded coverImage dimensions through Prisma image columns',
  )
  assert(
    String(createdCoverImage.url).startsWith('/files/'),
    'createTodo should expose uploaded coverImage URL through Prisma image columns',
  )
  const createdCoverRow = await prisma.todo.findUniqueOrThrow({
    where: { id: createdId },
  })
  assert(
    createdCoverRow.coverImage_id === createdCoverImage.id,
    'Prisma row should store uploaded coverImage_id column',
  )
  assert(
    createdCoverRow.coverImage_extension === 'png',
    'Prisma row should store uploaded coverImage_extension column',
  )
  assert(
    createdCoverRow.coverImage_filesize === createdCoverImage.filesize,
    'Prisma row should store uploaded coverImage_filesize column',
  )
  assert(
    createdCoverRow.coverImage_width === 3,
    'Prisma row should store uploaded coverImage_width column',
  )
  assert(
    createdCoverRow.coverImage_height === 2,
    'Prisma row should store uploaded coverImage_height column',
  )
  assert(
    asRecord(createdTodo.assignedTo).id === 'user_admin',
    'createTodo should default assignedTo from session',
  )
  assert(
    createdTodo.todoImagesCount === 1,
    'createTodo should connect one image',
  )
  assert(
    asRecord(createdTodo.secretNote).isSet === true,
    'secretNote should return PasswordState.isSet=true',
  )
  assert(
    !('password' in createdTodo),
    'todo mutation should not expose unrelated password data',
  )

  const nestedCreated = await execute(/* GraphQL */ `
    mutation ValidatePrismaNestedCreate {
      createTodo(
        data: {
          label: "Prisma nested relationship validation"
          assignedTo: {
            create: {
              name: "Prisma Nested Assigned User"
              email: "prisma-nested-assigned@example.com"
              password: "password123"
            }
          }
          todoImages: {
            create: [
              {
                altText: "Prisma nested image one"
                imagePath: "/images/todos/prisma-nested-one.png"
              }
              {
                altText: "Prisma nested image two"
                imagePath: "/images/todos/prisma-nested-two.png"
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
  const nestedCreatedTodo = asRecord(nestedCreated.createTodo)
  assert(
    nestedCreatedTodo.status === 'todo',
    'nested parent create should still run Todo create defaults in Prisma',
  )
  assert(
    asRecord(nestedCreatedTodo.assignedTo).name ===
      'Prisma Nested Assigned User',
    'to-one nested create should create and connect the related User in Prisma',
  )
  const initialNestedUserId = String(asRecord(nestedCreatedTodo.assignedTo).id)
  assert(
    nestedCreatedTodo.todoImagesCount === 2 &&
      asArray(nestedCreatedTodo.todoImages).length === 2,
    'to-many nested create should create and connect related TodoImages in Prisma',
  )

  const nestedUpdated = await execute(
    /* GraphQL */ `
      mutation ValidatePrismaNestedUpdate($id: ID!) {
        updateTodo(
          where: { id: $id }
          data: {
            assignedTo: {
              create: {
                name: "Prisma Nested Update User"
                email: "prisma-nested-update@example.com"
                password: "password123"
              }
            }
            todoImages: {
              create: [
                {
                  altText: "Prisma nested update image"
                  imagePath: "/images/todos/prisma-nested-update.png"
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
  const nestedUpdatedTodo = asRecord(nestedUpdated.updateTodo)
  assert(
    asRecord(nestedUpdatedTodo.assignedTo).name === 'Prisma Nested Update User',
    'to-one nested create should work in update inputs in Prisma',
  )
  assert(
    nestedUpdatedTodo.todoImagesCount === 3,
    'to-many nested create should append during update inputs in Prisma',
  )

  const nestedEditorContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { 'x-cms-user-id': 'user_editor' },
    }),
  )
  const nestedDeniedMessage = await executeExpectError(
    /* GraphQL */ `
      mutation ValidatePrismaNestedCreateAccessDenied {
        createTodo(
          data: {
            label: "Prisma denied nested user todo"
            assignedTo: {
              create: {
                name: "Prisma Denied Nested User"
                email: "prisma-denied-nested@example.com"
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
    'nested create should run related list operation access checks in Prisma',
  )

  const relatedConnectDeniedMessage = await executeExpectError(
    /* GraphQL */ `
      mutation ValidatePrismaRelatedConnectAccessDenied {
        createTodo(
          data: {
            label: "Prisma denied related connect todo"
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
    'connect should check related item query access in Prisma',
  )

  const emptyToOneCreateMessage = await executeExpectError(/* GraphQL */ `
    mutation ValidatePrismaEmptyToOneRelationshipCreate {
      createTodo(
        data: {
          label: "Prisma empty to-one relationship create"
          assignedTo: {}
        }
      ) {
        id
      }
    }
  `)
  assert(
    emptyToOneCreateMessage.includes(
      'You must provide "connect" or "create" in to-one relationship inputs for "create" operations.',
    ),
    'to-one relationship create should reject empty relationship inputs in Prisma',
  )

  const emptyToManyCreateMessage = await executeExpectError(/* GraphQL */ `
    mutation ValidatePrismaEmptyToManyRelationshipCreate {
      createTodo(
        data: {
          label: "Prisma empty to-many relationship create"
          todoImages: {}
        }
      ) {
        id
      }
    }
  `)
  assert(
    emptyToManyCreateMessage.includes(
      'You must provide at least one of "set", "connect" or "create" in to-many relationship inputs for "create" operations.',
    ),
    'to-many relationship create should reject empty relationship inputs in Prisma',
  )

  const emptyToOneUpdateMessage = await executeExpectError(/* GraphQL */ `
    mutation ValidatePrismaEmptyToOneRelationshipUpdate {
      updateTodo(where: { id: "todo_launch" }, data: { assignedTo: {} }) {
        id
      }
    }
  `)
  assert(
    emptyToOneUpdateMessage.includes(
      'You must provide one of "connect", "create" or "disconnect" in to-one relationship inputs for "update" operations.',
    ),
    'to-one relationship update should reject empty relationship inputs in Prisma',
  )

  const emptyToManyUpdateMessage = await executeExpectError(/* GraphQL */ `
    mutation ValidatePrismaEmptyToManyRelationshipUpdate {
      updateTodo(where: { id: "todo_launch" }, data: { todoImages: {} }) {
        id
      }
    }
  `)
  assert(
    emptyToManyUpdateMessage.includes(
      'You must provide at least one of "set", "connect", "create" or "disconnect" in to-many relationship inputs for "update" operations.',
    ),
    'to-many relationship update should reject empty relationship inputs in Prisma',
  )

  const imagesBeforeRollback = await execute(/* GraphQL */ `
    query CountPrismaImagesBeforeRollback {
      todoImagesCount
    }
  `)
  const rollbackMessage = await executeExpectError(/* GraphQL */ `
    mutation ValidatePrismaNestedRollback {
      createTodo(
        data: {
          label: "Prisma rollback nested create"
          todoImages: {
            create: [
              {
                altText: "Prisma rollback orphan image"
                imagePath: "/images/todos/prisma-rollback-orphan.png"
              }
            ]
          }
          assignedTo: { connect: { id: "missing_prisma_nested_rollback_user" } }
        }
      ) {
        id
      }
    }
  `)
  assert(
    rollbackMessage.includes(
      'Cannot connect User missing_prisma_nested_rollback_user',
    ),
    'failed parent relationship write should surface related item existence errors in Prisma',
  )
  const imagesAfterRollback = await execute(/* GraphQL */ `
    query CountPrismaImagesAfterRollback {
      todoImagesCount
      todoImages(
        where: { altText: { equals: "Prisma rollback orphan image" } }
      ) {
        id
      }
    }
  `)
  assert(
    imagesAfterRollback.todoImagesCount ===
      imagesBeforeRollback.todoImagesCount,
    'Prisma transaction rollback should remove nested related creates after parent failure',
  )
  assert(
    asArray(imagesAfterRollback.todoImages).length === 0,
    'Prisma rollback should leave no orphan nested related item',
  )

  const nestedBeforeCleanup = await execute(
    /* GraphQL */ `
      query ReadPrismaNestedBeforeCleanup($id: ID!) {
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
  const nestedBeforeCleanupTodo = asRecord(nestedBeforeCleanup.todo)
  const nestedUserId = (asRecord(nestedBeforeCleanupTodo.assignedTo).id ??
    null) as string | null
  const nestedImageIds = asArray(nestedBeforeCleanupTodo.todoImages).map(
    (nestedImage) => String(nestedImage.id),
  )
  await execute(
    /* GraphQL */ `
      mutation CleanupPrismaNestedCreate($id: ID!) {
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
        mutation CleanupPrismaNestedUser($id: ID!) {
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
        mutation CleanupPrismaNestedImage($id: ID!) {
          deleteTodoImage(where: { id: $id }) {
            id
          }
        }
      `,
      { id: imageId },
    )
  }

  const updatedDisconnect = await execute(
    /* GraphQL */ `
      mutation ValidatePrismaDisconnect($id: ID!, $imageId: ID!) {
        updateTodo(
          where: { id: $id }
          data: {
            isComplete: true
            todoImages: { disconnect: [{ id: $imageId }] }
          }
        ) {
          id
          isComplete
          todoImages {
            id
          }
          todoImagesCount
        }
      }
    `,
    { id: createdId, imageId: image.id },
  )
  const disconnectedTodo = asRecord(updatedDisconnect.updateTodo)
  assert(
    disconnectedTodo.isComplete === true,
    'updateTodo should update scalar fields',
  )
  assert(
    disconnectedTodo.todoImagesCount === 0,
    'updateTodo should disconnect to-many relationships',
  )

  const updatedConnect = await execute(
    /* GraphQL */ `
      mutation ValidatePrismaReconnect($id: ID!, $imageId: ID!) {
        updateTodo(
          where: { id: $id }
          data: { todoImages: { connect: [{ id: $imageId }] } }
        ) {
          id
          todoImages {
            id
          }
          todoImagesCount
        }
      }
    `,
    { id: createdId, imageId: image.id },
  )
  const reconnectedTodo = asRecord(updatedConnect.updateTodo)
  assert(
    disconnectedTodo.id === reconnectedTodo.id,
    'reconnect should update the same todo',
  )
  assert(
    reconnectedTodo.todoImagesCount === 1,
    'updateTodo should reconnect to-many relationships',
  )

  const updatedSetEmpty = await execute(
    /* GraphQL */ `
      mutation ValidatePrismaSetEmpty($id: ID!) {
        updateTodo(where: { id: $id }, data: { todoImages: { set: [] } }) {
          id
          todoImagesCount
        }
      }
    `,
    { id: createdId },
  )
  assert(
    asRecord(updatedSetEmpty.updateTodo).todoImagesCount === 0,
    'updateTodo should support to-many set: []',
  )

  const role = await prisma.role.create({
    data: {
      id: 'role_prisma_validation',
      name: 'Prisma Validation Role',
      canCreateTodos: true,
      canAccessDashboard: true,
    },
  })

  const user = await execute(
    /* GraphQL */ `
      mutation ValidatePrismaUserCreate($roleId: ID!) {
        createUser(
          data: {
            name: "Prisma Validation User"
            email: "prisma-validation@example.com"
            password: "hidden password"
            role: { connect: { id: $roleId } }
          }
        ) {
          id
          name
          role {
            id
          }
          password {
            isSet
          }
        }
      }
    `,
    { roleId: role.id },
  )
  const createdUser = asRecord(user.createUser)
  const createdUserId = String(createdUser.id)
  assert(
    asRecord(createdUser.role).id === role.id,
    'createUser should connect a to-one role',
  )
  assert(
    createdUser.password === null,
    'createUser should respect password field read access and not expose raw values',
  )

  const userDisconnected = await execute(
    /* GraphQL */ `
      mutation ValidatePrismaUserDisconnect($id: ID!) {
        updateUser(where: { id: $id }, data: { role: { disconnect: true } }) {
          id
          role {
            id
          }
        }
      }
    `,
    { id: createdUserId },
  )
  assert(
    asRecord(userDisconnected.updateUser).role === null,
    'updateUser should disconnect a to-one relationship',
  )

  const deletedUser = await execute(
    /* GraphQL */ `
      mutation ValidatePrismaUserDelete($id: ID!) {
        deleteUser(where: { id: $id }) {
          id
          name
        }
      }
    `,
    { id: createdUserId },
  )
  assert(
    asRecord(deletedUser.deleteUser).id === createdUserId,
    'deleteUser should return the deleted user',
  )

  const deletedTodo = await execute(
    /* GraphQL */ `
      mutation ValidatePrismaDelete($id: ID!) {
        deleteTodo(where: { id: $id }) {
          id
          label
        }
      }
    `,
    { id: createdId },
  )
  assert(
    asRecord(deletedTodo.deleteTodo).id === createdId,
    'deleteTodo should return the deleted item',
  )

  const createdManyTodos = await execute(/* GraphQL */ `
    mutation ValidatePrismaCreateManyTodos {
      createTodos(
        data: [
          { label: "Prisma many validation A", status: "todo" }
          { label: "Prisma many validation B", priority: 2 }
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
  const manyTodos = asArray(createdManyTodos.createTodos)
  assert(manyTodos.length === 2, 'createTodos should create two Prisma todos')
  assert(
    manyTodos[0]?.label === 'Prisma many validation A',
    'createTodos should preserve input order in Prisma',
  )
  assert(
    asRecord(manyTodos[0]?.assignedTo).id === 'user_admin',
    'createTodos should apply Todo assignedTo default per item in Prisma',
  )

  const updatedManyTodos = await execute(
    /* GraphQL */ `
      mutation ValidatePrismaUpdateManyTodos($data: [TodoUpdateArgs!]!) {
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
  assert(
    asArray(updatedManyTodos.updateTodos).every(
      (todo) => todo.status === 'done' && todo.isComplete === true,
    ),
    'updateTodos should update each Prisma todo',
  )

  const deletedManyTodos = await execute(
    /* GraphQL */ `
      mutation ValidatePrismaDeleteManyTodos($where: [TodoWhereUniqueInput!]!) {
        deleteTodos(where: $where) {
          id
        }
      }
    `,
    { where: manyTodos.map((todo) => ({ id: todo.id })) },
  )
  assert(
    asArray(deletedManyTodos.deleteTodos)
      .map((todo) => todo.id)
      .join(',') === manyTodos.map((todo) => todo.id).join(','),
    'deleteTodos should preserve input order in Prisma',
  )

  const createdManyRoles = await execute(/* GraphQL */ `
    mutation ValidatePrismaCreateManyRoles {
      createRoles(
        data: [
          { name: "Prisma Many Validation Role A" }
          { name: "Prisma Many Validation Role B", canAccessDashboard: true }
        ]
      ) {
        id
        name
        canAccessDashboard
      }
    }
  `)
  const manyRoles = asArray(createdManyRoles.createRoles)
  assert(manyRoles.length === 2, 'createRoles should create two Prisma roles')
  assert(
    manyRoles[0]?.name === 'Prisma Many Validation Role A',
    'createRoles should preserve input order in Prisma',
  )

  const updatedManyRoles = await execute(
    /* GraphQL */ `
      mutation ValidatePrismaUpdateManyRoles($data: [RoleUpdateArgs!]!) {
        updateRoles(data: $data) {
          id
          canManageRoles
        }
      }
    `,
    {
      data: manyRoles.map((manyRole) => ({
        where: { id: manyRole.id },
        data: { canManageRoles: true },
      })),
    },
  )
  assert(
    asArray(updatedManyRoles.updateRoles).every(
      (manyRole) => manyRole.canManageRoles === true,
    ),
    'updateRoles should update each Prisma role',
  )

  const deletedCreatedManyRoles = await execute(
    /* GraphQL */ `
      mutation ValidatePrismaDeleteManyRoles($where: [RoleWhereUniqueInput!]!) {
        deleteRoles(where: $where) {
          id
        }
      }
    `,
    { where: manyRoles.map((manyRole) => ({ id: manyRole.id })) },
  )
  assert(
    asArray(deletedCreatedManyRoles.deleteRoles)
      .map((manyRole) => manyRole.id)
      .join(',') === manyRoles.map((manyRole) => manyRole.id).join(','),
    'deleteRoles should preserve input order for successful Prisma bulk deletes',
  )

  const partialManyRolesCreated = await execute(/* GraphQL */ `
    mutation CreatePrismaPartialManyRoles {
      createRoles(
        data: [
          { name: "Prisma Partial Many Role A" }
          { name: "Prisma Partial Many Role B" }
          { name: "Prisma Partial Many Role C" }
        ]
      ) {
        id
        name
      }
    }
  `)
  const partialManyRoles = asArray(partialManyRolesCreated.createRoles)
  const [partialRoleA, partialRoleB, partialRoleC] = partialManyRoles

  const settledUpdateManyRoles = await executeRaw(
    /* GraphQL */ `
      mutation ValidatePrismaUpdateManyRolesPartialFailure(
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
          data: { name: 'Prisma Partial Many Updated A' },
        },
        {
          where: { id: partialRoleB.id },
          data: { assignedTo: { connect: [{ id: 'missing-user' }] } },
        },
        {
          where: { id: partialRoleC.id },
          data: { name: 'Prisma Partial Many Updated C' },
        },
      ],
    },
  )
  assert(
    settledUpdateManyRoles.errors?.length === 1,
    'updateMany should report item-level Prisma errors without failing the whole mutation',
  )
  const settledUpdatedRoles = ((
    settledUpdateManyRoles.data as Record<string, unknown>
  ).updateRoles ?? []) as Array<Record<string, unknown> | null>
  assert(
    settledUpdatedRoles.length === 3,
    'updateMany partial Prisma result should preserve input order',
  )
  assert(
    settledUpdatedRoles[0]?.name === 'Prisma Partial Many Updated A' &&
      settledUpdatedRoles[1] === null &&
      settledUpdatedRoles[2]?.name === 'Prisma Partial Many Updated C',
    'updateMany partial Prisma result should null only the failed item and preserve succeeding later items',
  )
  const postSettledUpdateRoles = await execute(
    /* GraphQL */ `
      query ValidatePrismaUpdateManyPartialPersistence(
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
    asRecord(postSettledUpdateRoles.roleA).name ===
      'Prisma Partial Many Updated A',
    'updateMany should persist successful earlier Prisma items',
  )
  assert(
    asRecord(postSettledUpdateRoles.roleB).name ===
      'Prisma Partial Many Role B',
    'failed updateMany Prisma items should leave the original item unchanged',
  )
  assert(
    asRecord(postSettledUpdateRoles.roleC).name ===
      'Prisma Partial Many Updated C',
    'updateMany should still execute and persist successful later Prisma items after an item-level failure',
  )

  const settledDeleteManyRoles = await executeRaw(
    /* GraphQL */ `
      mutation ValidatePrismaDeleteManyRolesPartialFailure(
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
    'deleteMany should report item-level Prisma missing-item errors without failing the whole mutation',
  )
  const settledDeletedRoles = ((
    settledDeleteManyRoles.data as Record<string, unknown>
  ).deleteRoles ?? []) as Array<Record<string, unknown> | null>
  assert(
    settledDeletedRoles.length === 3,
    'deleteMany partial Prisma result should preserve input order',
  )
  assert(
    settledDeletedRoles[0]?.id === partialRoleA.id &&
      settledDeletedRoles[1] === null &&
      settledDeletedRoles[2]?.id === partialRoleC.id,
    'deleteMany partial Prisma result should null only the failed item and preserve succeeding later items',
  )
  const remainingPartialRoles = await prisma.role.findMany({
    where: {
      id: {
        in: [partialRoleA.id, partialRoleB.id, partialRoleC.id].map(String),
      },
    },
  })
  assert(
    remainingPartialRoles.length === 1 &&
      remainingPartialRoles[0]?.id === partialRoleB.id,
    'deleteMany should delete successful earlier and later Prisma items even when one entry fails',
  )
  await prisma.role.delete({ where: { id: String(partialRoleB.id) } })

  const settledManyRoles = await executeRaw(/* GraphQL */ `
    mutation ValidatePrismaCreateManyRolesPartialFailure {
      createRoles(
        data: [
          { name: "Prisma Settled Many Role A" }
          {
            name: "Prisma Settled Invalid Relation"
            assignedTo: { connect: [{ id: "missing-user" }] }
          }
          { name: "Prisma Settled Many Role B" }
        ]
      ) {
        id
        name
      }
    }
  `)
  assert(
    settledManyRoles.errors?.length === 1,
    'createMany should report item-level Prisma errors without failing the whole mutation',
  )
  const settledRoles = ((settledManyRoles.data as Record<string, unknown>)
    .createRoles ?? []) as Array<Record<string, unknown> | null>
  assert(
    settledRoles.length === 3,
    'createMany partial Prisma result should preserve input order',
  )
  assert(
    settledRoles[0]?.name === 'Prisma Settled Many Role A' &&
      settledRoles[1] === null &&
      settledRoles[2]?.name === 'Prisma Settled Many Role B',
    'createMany partial Prisma result should null only the failed item',
  )
  await prisma.role.deleteMany({
    where: {
      name: {
        in: ['Prisma Settled Many Role A', 'Prisma Settled Many Role B'],
      },
    },
  })

  const anonymousCreateManyRoles = await executeRaw(
    /* GraphQL */ `
      mutation ValidatePrismaDeniedCreateManyRoles {
        createRoles(
          data: [
            { name: "Prisma Denied Many Role A" }
            { name: "Prisma Denied Many Role B" }
          ]
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
    'denied Prisma createMany should report one error per denied item',
  )
  const deniedManyRoles = ((
    anonymousCreateManyRoles.data as Record<string, unknown>
  ).createRoles ?? []) as Array<Record<string, unknown> | null>
  assert(
    deniedManyRoles.length === 2 &&
      deniedManyRoles.every((entry) => entry === null),
    'denied Prisma createMany should preserve input order and null each denied item',
  )
  assert(
    anonymousCreateManyRoles.errors.every(
      (error) => error.extensions.code === 'KS_ACCESS_DENIED',
    ),
    'denied Prisma createMany errors should preserve access-denied envelopes',
  )

  await prisma.todoImage.delete({ where: { id: image.id } })
  await prisma.role.delete({ where: { id: role.id } })

  const editorContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { 'x-cms-user-id': 'user_editor' },
    }),
  )
  const editorAccess = await execute(
    /* GraphQL */ `
      query ValidatePrismaEditorAccess {
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
  const editorTodos = asArray(editorAccess.todos)
  const editorUsers = asArray(editorAccess.users)
  assert(
    editorTodos.length === 1 &&
      editorTodos.every(
        (todo) => asRecord(todo.assignedTo).id === 'user_editor',
      ),
    'editor should only query assigned todos in Prisma',
  )
  assert(
    editorUsers.length === 1 && editorUsers[0]?.id === 'user_editor',
    'editor should only query self in Prisma',
  )

  const sudoContext = editorContext.sudo()
  const sudoAccess = await execute(
    /* GraphQL */ `
      query ValidatePrismaSudoAccess {
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
    asArray(sudoAccess.todos).length === 3,
    'sudo should bypass Todo query filters in Prisma',
  )
  assert(
    asArray(sudoAccess.users).length === 2,
    'sudo should bypass User query filters in Prisma',
  )

  const sudoUpdated = await execute(
    /* GraphQL */ `
      mutation ValidatePrismaSudoFieldAccess {
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
    asRecord(asRecord(sudoUpdated.updateTodo).assignedTo).id === 'user_admin',
    'sudo should bypass field write access in Prisma',
  )
  await prisma.todo.update({
    where: { id: 'todo_docs' },
    data: { assignedTo: { connect: { id: 'user_editor' } } },
  })

  const anonymousContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { 'x-cms-anonymous': 'true' },
    }),
  )
  const anonymousDenied = await execute(
    /* GraphQL */ `
      query ValidatePrismaAnonymousDenied {
        todos {
          id
        }
      }
    `,
    undefined,
    anonymousContext,
  )
  assert(
    asArray(anonymousDenied.todos).length === 0,
    'anonymous queries should use Keystone denied-many hiding semantics in Prisma',
  )
  const anonymousSudo = await execute(
    /* GraphQL */ `
      query ValidatePrismaAnonymousSudo {
        todos {
          id
        }
      }
    `,
    undefined,
    anonymousContext.sudo(),
  )
  assert(
    asArray(anonymousSudo.todos).length === 3,
    'anonymous sudo should bypass operation access in Prisma',
  )

  const contextApiCreated = await sudoContext.db.Todo.createOne({
    data: { label: 'Prisma context db validation' },
  })
  assert(
    contextApiCreated.id,
    'context.db.<list>.createOne should create an item in Prisma',
  )
  const contextDbFound = await sudoContext.db.Todo.findOne({
    where: { id: contextApiCreated.id },
  })
  assert(
    contextDbFound?.label === 'Prisma context db validation',
    'context.db.<list>.findOne should return adapter-shaped Prisma items',
  )
  const contextDbCount = await sudoContext.db.Todo.count({
    where: { label: { equals: 'Prisma context db validation' } },
  })
  assert(
    contextDbCount === 1,
    'context.db.<list>.count should support Prisma where args',
  )
  const contextQueryFound = (await sudoContext.query.Todo.findOne({
    where: { id: contextApiCreated.id },
    query: 'id label assignedTo { id }',
  })) as Record<string, unknown>
  assert(
    contextQueryFound.label === 'Prisma context db validation',
    'context.query.<list>.findOne should return Prisma GraphQL-shaped selections',
  )
  assert(
    asRecord(contextQueryFound.assignedTo).id === 'user_editor',
    'context.query.<list> should resolve Prisma selected relationships',
  )
  const contextQueryCount = await sudoContext.query.Todo.count({
    where: { label: { equals: 'Prisma context db validation' } },
  })
  assert(
    contextQueryCount === 1,
    'context.query.<list>.count should return Prisma GraphQL count',
  )
  assert(
    sudoContext.prisma === prisma,
    'Prisma context.prisma should expose the configured Prisma client',
  )
  const rawGraphql = await sudoContext.graphql.raw({ query: '{ todosCount }' })
  assert(
    !rawGraphql.errors?.length && asRecord(rawGraphql.data).todosCount === 4,
    'context.graphql.raw should execute against the extended Prisma CMS schema',
  )
  const runGraphql = await sudoContext.graphql.run({
    query: '{ redirectToInit }',
  })
  assert(
    runGraphql.redirectToInit === false,
    'context.graphql.run should execute extended Prisma GraphQL schema fields',
  )
  await sudoContext.db.Todo.deleteOne({ where: { id: contextApiCreated.id } })

  const finalCount = await execute(/* GraphQL */ `
    query ValidatePrismaFinalCount {
      todosCount
      usersCount
      rolesCount
      todoImagesCount
    }
  `)
  assert(
    finalCount.todosCount === 3,
    'todosCount should return to 3 after cleanup',
  )
  assert(
    finalCount.usersCount === 2,
    'usersCount should return to 2 after cleanup',
  )
  assert(
    finalCount.rolesCount === 2,
    'rolesCount should return to 2 after cleanup',
  )
  assert(
    finalCount.todoImagesCount === 2,
    'todoImagesCount should return to 2 after cleanup',
  )

  console.info('CMS GraphQL Prisma CRUD validation passed.')
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    storageConfigs.my_images = configuredImageStorage
    setCmsAdapterForTests(undefined)
    await prisma.$disconnect()
  })
