import { graphql } from 'graphql'

import { createCmsPrismaClient } from '../src/features/cms/prisma-client'
import {
  getCmsGraphQLSchema,
  createCmsContext,
} from '../src/features/cms/runtime'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

async function execute(source: string) {
  const schema = getCmsGraphQLSchema()
  const context = (await createCmsContext(undefined, schema)).sudo()
  const result = await graphql({ schema, source, contextValue: context })
  if (result.errors?.length)
    throw new Error(result.errors.map((error) => error.message).join('\n'))
  return asRecord(result.data)
}

async function main() {
  assert(
    process.env.CMS_ADAPTER === 'prisma',
    'source cutover runtime validation requires CMS_ADAPTER=prisma',
  )

  const prisma = createCmsPrismaClient()
  const [directTodo, connectionDetails] = await Promise.all([
    prisma.todo.findUnique({ where: { id: 'source_todo' } }),
    prisma.$queryRawUnsafe<unknown[]>(
      'SELECT current_database() AS database, current_user AS username, COUNT(*)::int AS todo_count FROM "Todo" GROUP BY current_database(), current_user',
    ),
  ])
  await prisma.$disconnect()
  assert(
    directTodo?.label === 'Source migration todo',
    `source Todo was not visible through the generated Prisma client: label=${String(directTodo?.label)} connection=${JSON.stringify(connectionDetails)}`,
  )

  const before = await execute(/* GraphQL */ `
    query ValidateSourceDataBeforeReplacementWrite {
      todo(where: { id: "source_todo" }) {
        id
        label
        budget
        largeNumber
        metadata
        tags
        description {
          document(hydrateRelationships: false)
        }
        assignedTo {
          id
          email
        }
        todoImages {
          id
          altText
          imagePath
        }
      }
    }
  `)
  const todo = asRecord(before.todo)
  assert(
    todo.label === 'Source migration todo',
    `source Todo label was lost: ${JSON.stringify(before)}`,
  )
  assert(
    Number(todo.budget) === 42.5,
    `source Decimal value was not preserved: ${String(todo.budget)}`,
  )
  assert(
    todo.largeNumber === '9007199254740993',
    'source BigInt value was not preserved',
  )
  assert(
    JSON.stringify(todo.tags) === JSON.stringify(['migration', 'cutover']),
    'source multiselect JSON value was not preserved',
  )
  assert(
    asRecord(todo.metadata).origin === 'next-keystone-starter',
    'source JSON metadata was not preserved',
  )
  assert(
    Array.isArray(asRecord(todo.description).document),
    'source document JSON was not readable through the replacement runtime',
  )
  assert(
    asRecord(todo.assignedTo).id === 'source_user',
    'source to-one relationship was not preserved',
  )
  const todoImages = Array.isArray(todo.todoImages) ? todo.todoImages : []
  assert(
    asRecord(todoImages[0]).id === 'source_image',
    'source many-to-many relationship row was not preserved',
  )

  const updated = await execute(/* GraphQL */ `
    mutation ValidateReplacementWriteOnSourceData {
      updateTodo(
        where: { id: "source_todo" }
        data: {
          label: "Replacement-updated source todo"
          tags: ["migration", "cutover", "replacement"]
        }
      ) {
        id
        label
        tags
        todoImages {
          id
        }
      }
    }
  `)
  const updatedTodo = asRecord(updated.updateTodo)
  assert(
    updatedTodo.label === 'Replacement-updated source todo',
    'replacement runtime could not update a source-created Todo',
  )
  assert(
    Array.isArray(updatedTodo.todoImages) &&
      asRecord(updatedTodo.todoImages[0]).id === 'source_image',
    'replacement update disturbed the source many-to-many relationship',
  )

  console.log(
    'Source cutover runtime validation passed: representative source data read and updated through the TanStack Prisma/GraphQL runtime.',
  )
}

await main()
