import { graphql, printSchema } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
  setCmsAdapterForTests,
} from '../src/features/cms/adapters'
import { getAdminMeta } from '../src/features/cms/admin-meta'
import { config, initialiseLists, list } from '../src/features/cms/config'
import { allowAll } from '../src/features/cms/keystone/access'
import { multiselect, select, text } from '../src/features/cms/keystone/fields'
import { printCmsPrismaSchema } from '../src/features/cms/prisma-schema'
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

let rejectedDuplicateEnumOptions = false
try {
  initialiseLists(
    config({
      lists: {
        InvalidSelectThing: list({
          fields: {
            status: select({
              type: 'enum',
              options: [
                { label: 'Open', value: 'OPEN' },
                { label: 'Still Open', value: 'OPEN' },
              ],
            }),
          },
        }),
      },
    }),
  )
} catch (error) {
  rejectedDuplicateEnumOptions =
    error instanceof Error &&
    error.message.includes('select options must not contain duplicate values')
}
assert(
  rejectedDuplicateEnumOptions,
  'enum-mode select should reject duplicate option values at config time',
)

let rejectedDuplicateMultiselectOptions = false
try {
  initialiseLists(
    config({
      lists: {
        InvalidMultiselectThing: list({
          fields: {
            tags: multiselect({
              options: [
                { label: 'Feature', value: 'feature' },
                { label: 'Still Feature', value: 'feature' },
              ],
            }),
          },
        }),
      },
    }),
  )
} catch (error) {
  rejectedDuplicateMultiselectOptions =
    error instanceof Error &&
    error.message.includes(
      'multiselect options must not contain duplicate values',
    )
}
assert(
  rejectedDuplicateMultiselectOptions,
  'multiselect should reject duplicate option values at config time',
)

const lists = initialiseLists(
  config({
    lists: {
      SelectThing: list({
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
          priorityBand: select({
            type: 'integer',
            defaultValue: 2,
            options: [
              { label: 'Low', value: 1 },
              { label: 'Medium', value: 2 },
              { label: 'High', value: 3 },
            ],
            db: { isUnique: true },
          }),
          workflowState: select({
            type: 'enum',
            defaultValue: 'OPEN',
            options: [
              { label: 'Open', value: 'OPEN' },
              { label: 'Closed', value: 'CLOSED' },
            ],
            db: { isUnique: true },
          }),
          tags: multiselect({
            options: [
              { label: 'Feature', value: 'feature' },
              { label: 'Urgent', value: 'urgent' },
            ],
            defaultValue: ['feature'],
          }),
          scoreBands: multiselect({
            type: 'integer',
            options: [
              { label: 'One', value: 1 },
              { label: 'Two', value: 2 },
              { label: 'Three', value: 3 },
            ],
            defaultValue: [1],
          }),
          workflowStates: multiselect({
            type: 'enum',
            options: [
              { label: 'Open', value: 'OPEN' },
              { label: 'Closed', value: 'CLOSED' },
            ],
            defaultValue: ['OPEN'],
          }),
        },
      }),
    },
  }),
)

setCmsAdapterForTests(memoryCmsAdapter)
resetMemoryAdapter(
  {
    SelectThing: [
      {
        id: 'select_1',
        name: 'Ada',
        priorityBand: 2,
        workflowState: 'OPEN',
        tags: ['feature'],
        scoreBands: [1],
        workflowStates: ['OPEN'],
      },
    ],
  },
  lists,
)

const adminMeta = getAdminMeta(lists)
const selectListMeta = adminMeta.listsByKey.SelectThing
assert(
  selectListMeta.fieldsByKey.priorityBand.fieldMeta.type === 'integer',
  'admin meta should preserve integer select type metadata',
)
assert(
  selectListMeta.fieldsByKey.workflowState.fieldMeta.type === 'enum',
  'admin meta should preserve enum select type metadata',
)
assert(
  selectListMeta.fieldsByKey.scoreBands.fieldMeta.type === 'integer',
  'admin meta should preserve integer multiselect type metadata',
)
assert(
  selectListMeta.fieldsByKey.workflowStates.fieldMeta.type === 'enum',
  'admin meta should preserve enum multiselect type metadata',
)

const prismaSchema = printCmsPrismaSchema(lists, {
  provider: 'sqlite',
  url: 'file:./select-fixture.db',
})
assert(
  prismaSchema.includes('priorityBand Int? @default(2) @unique') ||
    prismaSchema.includes('priorityBand Int? @unique @default(2)'),
  'Prisma schema should emit integer-mode select fields as Int columns with numeric defaults',
)
assert(
  prismaSchema.includes('workflowState String? @default("OPEN") @unique') ||
    prismaSchema.includes('workflowState String? @unique @default("OPEN")'),
  'Prisma schema should keep enum-mode select storage as String while preserving enum defaults',
)

const schema = makeExecutableSchema({
  typeDefs: generateCmsTypeDefsForLists(lists),
  resolvers: generateCmsResolversForLists(lists),
})
const sdl = printSchema(schema)
assert(
  sdl.includes('priorityBand: Int'),
  'GraphQL SDL should expose integer-mode select fields as Int outputs',
)
assert(
  sdl.includes('priorityBand: IntNullableFilter'),
  'GraphQL SDL should expose optional integer-mode select fields through nullable filters',
)
assert(
  sdl.includes('priorityBand: Int'),
  'GraphQL SDL should expose integer-mode select fields in unique/create/update inputs as Int',
)
assert(
  sdl.includes('enum SelectThingWorkflowStateType {'),
  "GraphQL SDL should use Keystone's <List><Field>Type name for enum-mode select fields",
)
assert(
  sdl.includes('OPEN') && sdl.includes('CLOSED'),
  'GraphQL SDL should include enum-mode select option values',
)
assert(
  sdl.includes('workflowState: SelectThingWorkflowStateType'),
  'GraphQL SDL should expose enum-mode select fields through the generated enum type',
)
assert(
  sdl.includes('workflowState: SelectThingWorkflowStateTypeNullableFilter'),
  'GraphQL SDL should expose enum-mode select filters through the generated enum filter type',
)
assert(
  sdl.includes('scoreBands: [Int!]'),
  'GraphQL SDL should expose integer-mode multiselect fields as nullable Int lists',
)
assert(
  sdl.includes('workflowStates: [SelectThingWorkflowStatesEnum!]'),
  'GraphQL SDL should expose enum-mode multiselect fields as nullable enum lists',
)
assert(
  !sdl.includes('workflowStates: SelectThingWorkflowStatesEnumFilter'),
  'GraphQL SDL should match Keystone by omitting unsupported multiselect filters',
)

const contextValue = {
  adapter: memoryCmsAdapter,
  session: undefined,
  __internal: { sudo: true, lists },
  sudo() {
    return this
  },
} as const

const createResult = await graphql({
  schema,
  source: /* GraphQL */ `
    mutation ValidateIntegerSelectCreate {
      createSelectThing(
        data: {
          name: "Linus"
          priorityBand: 3
          workflowState: CLOSED
          tags: ["urgent"]
          scoreBands: [2, 3]
          workflowStates: [OPEN, CLOSED]
        }
      ) {
        id
        name
        priorityBand
        workflowState
        tags
        scoreBands
        workflowStates
      }
    }
  `,
  contextValue,
})
if (createResult.errors?.length)
  throw new Error(createResult.errors.map((error) => error.message).join('\n'))
const created = asRecord(asRecord(createResult.data).createSelectThing)
assert(
  created.priorityBand === 3,
  'integer-mode select should round-trip numeric GraphQL create values',
)
assert(
  created.workflowState === 'CLOSED',
  'enum-mode select should round-trip enum GraphQL create values',
)
assert(
  Array.isArray(created.tags) && created.tags[0] === 'urgent',
  'string multiselect should continue to round-trip string list values',
)
assert(
  Array.isArray(created.scoreBands) && created.scoreBands.join(',') === '2,3',
  'integer-mode multiselect should round-trip numeric list values',
)
assert(
  Array.isArray(created.workflowStates) &&
    created.workflowStates.join(',') === 'OPEN,CLOSED',
  'enum-mode multiselect should round-trip enum list values',
)

const queryResult = await graphql({
  schema,
  source: /* GraphQL */ `
    query ValidateIntegerSelectQuery {
      selectThings(
        where: {
          priorityBand: { equals: 3 }
          workflowState: { equals: CLOSED }
        }
      ) {
        id
        priorityBand
        workflowState
        scoreBands
        workflowStates
      }
    }
  `,
  contextValue,
})
if (queryResult.errors?.length)
  throw new Error(queryResult.errors.map((error) => error.message).join('\n'))
const queried = (asRecord(queryResult.data).selectThings ??
  []) as Array<unknown>
assert(
  queried.length === 1 &&
    asRecord(queried[0]).priorityBand === 3 &&
    asRecord(queried[0]).workflowState === 'CLOSED' &&
    Array.isArray(asRecord(queried[0]).scoreBands) &&
    Array.isArray(asRecord(queried[0]).workflowStates),
  'integer-mode and enum-mode scalar select filters should execute while multiselect values remain readable',
)

const invalidMultiselectCreate = await graphql({
  schema,
  source: /* GraphQL */ `
    mutation ValidateIntegerMultiselectValidation {
      createSelectThing(data: { name: "Jo", scoreBands: [2, 2] }) {
        id
      }
    }
  `,
  contextValue,
})
assert(
  invalidMultiselectCreate.errors?.length,
  'integer-mode multiselect should reject duplicate selected values',
)
assert(
  invalidMultiselectCreate.errors[0]?.message.includes(
    'includes duplicate values',
  ),
  'integer-mode multiselect duplicate validation should surface duplicate-value failures',
)

const invalidCreate = await graphql({
  schema,
  source: /* GraphQL */ `
    mutation ValidateIntegerSelectValidation {
      createSelectThing(data: { name: "Grace", priorityBand: 9 }) {
        id
      }
    }
  `,
  contextValue,
})
assert(
  invalidCreate.errors?.length,
  'integer-mode select should reject values outside the allowed option set',
)
assert(
  invalidCreate.errors[0]?.message.includes('must be one of'),
  'integer-mode select validation should surface allowed option failures',
)

console.info('CMS select field validation passed.')
