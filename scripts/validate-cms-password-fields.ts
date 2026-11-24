import { graphql } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
  setCmsAdapterForTests,
} from '../src/features/cms/adapters'
import { config, initialiseLists, list } from '../src/features/cms/config'
import { password, text } from '../src/features/cms/keystone/fields'
import {
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
} from '../src/features/cms/runtime'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function expectPasswordConfigError(
  messageFragment: string,
  fieldConfig: Parameters<typeof password>[0],
) {
  let threw = false
  try {
    initialiseLists(
      config({
        lists: {
          PasswordThing: list({
            fields: {
              secret: password(fieldConfig),
            },
          }),
        },
      }),
    )
  } catch (error) {
    threw = error instanceof Error && error.message.includes(messageFragment)
  }
  assert(threw, `password config should reject: ${messageFragment}`)
}

expectPasswordConfigError(
  "isIndexed: 'unique' is not a supported option for field type password",
  {
    isIndexed: 'unique',
  },
)

expectPasswordConfigError('validation.length.min', {
  validation: { length: { min: -1 } },
})

expectPasswordConfigError('validation.length.max', {
  validation: { length: { max: -1 } },
})

expectPasswordConfigError(
  'validation.isRequired: true and validation.length.min: 0',
  {
    validation: { isRequired: true, length: { min: 0 } },
  },
)

expectPasswordConfigError(
  'validation.isRequired: true and validation.length.max: 0',
  {
    validation: { isRequired: true, length: { max: 0 } },
  },
)

expectPasswordConfigError(
  'validation.length.max that is less than the validation.length.min',
  {
    validation: { length: { min: 10, max: 8 } },
  },
)

const passwordLists = initialiseLists(
  config({
    lists: {
      PasswordThing: list({
        access: {
          operation: {
            query: () => true,
            create: () => true,
            update: () => true,
            delete: () => true,
          },
        },
        fields: {
          name: text(),
          weakSecret: password({
            validation: {
              rejectCommon: true,
              length: { min: 8, max: 72 },
              match: {
                regex: /^[A-Z].*\d$/,
                explanation: 'Must start with uppercase and end with a digit',
              },
            },
          }),
          secret: password({
            validation: {
              isRequired: true,
              rejectCommon: true,
              length: { min: 8, max: 72 },
            },
          }),
        },
      }),
    },
  }),
)

setCmsAdapterForTests(memoryCmsAdapter)
resetMemoryAdapter({ PasswordThing: [] }, passwordLists)
const schema = makeExecutableSchema({
  typeDefs: generateCmsTypeDefsForLists(passwordLists),
  resolvers: generateCmsResolversForLists(passwordLists),
})
const context = {
  adapter: memoryCmsAdapter,
  session: undefined,
  __internal: { sudo: true, lists: passwordLists },
  sudo() {
    return this
  },
} as const

const missingRequired = await graphql({
  schema,
  source: /* GraphQL */ `
    mutation ValidateRequiredPasswordCreate {
      createPasswordThing(
        data: { name: "Missing Secret", weakSecret: "Password1" }
      ) {
        id
      }
    }
  `,
  contextValue: context,
})
assert(
  missingRequired.errors?.length,
  'required password create should fail when the password field is omitted',
)
assert(
  missingRequired.errors[0]?.message.includes(
    'PasswordThing.secret is required',
  ),
  'required password create should surface a field-required error',
)

const created = await graphql({
  schema,
  source: /* GraphQL */ `
    mutation ValidatePasswordUnsetSemantics {
      createPasswordThing(
        data: { name: "Ada", weakSecret: "Password1", secret: "ValidSecret1" }
      ) {
        id
        secret {
          isSet
        }
        weakSecret {
          isSet
        }
      }
    }
  `,
  contextValue: context,
})
if (created.errors?.length)
  throw new Error(created.errors.map((error) => error.message).join('\n'))
const createdItem = (((created.data ?? {}) as Record<string, unknown>)
  .createPasswordThing ?? {}) as Record<string, unknown>
const createdSecret = (createdItem.secret ?? {}) as Record<string, unknown>
const createdWeakSecret = (createdItem.weakSecret ?? {}) as Record<
  string,
  unknown
>
assert(
  createdSecret.isSet === true,
  'set password fields should resolve PasswordState.isSet=true after hashing',
)
assert(
  createdWeakSecret.isSet === true,
  'validated password fields should still hash and resolve PasswordState.isSet=true',
)

for (const [label, weakSecret] of [
  ['short', 'Abc1'],
  ['long', `A${'x'.repeat(80)}1`],
  ['regex', 'password1'],
  ['common', 'password'],
] as const) {
  const result = await graphql({
    schema,
    source: /* GraphQL */ `
      mutation ValidatePasswordWriteValidation($weakSecret: String!) {
        createPasswordThing(data: { name: "${'${label}'}", weakSecret: $weakSecret, secret: "ValidSecret1" }) {
          id
        }
      }
    `,
    variableValues: { weakSecret },
    contextValue: context,
  })
  assert(
    result.errors?.length,
    `${label} password inputs should fail write-time validation before hashing`,
  )
}

console.info('CMS password field validation passed.')
