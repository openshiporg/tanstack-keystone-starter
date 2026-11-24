import { getIntrospectionQuery, graphql } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { addAuthGraphQLSchema } from '../../src/features/cms/auth/graphql'
import { config, initialiseLists } from '../../src/features/cms/config'
import { createAuth } from '../../src/features/cms/keystone/auth'
import { password, text } from '../../src/features/cms/keystone/fields'
import {
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
} from '../../src/features/cms/runtime'
import { hashPassword } from '../../src/features/cms/auth/password'

type Event = {
  kind: string
  itemId: unknown
  identity: string
  token: string
  context: any
}
const events: Event[] = []
const { withAuth } = createAuth({
  listKey: 'Account',
  identityField: 'handle',
  secretField: 'credential',
  sessionData: 'id handle',
  magicAuthLink: {
    tokensValidForMins: 1,
    sendToken(args) {
      events.push({ kind: 'magic', ...args })
    },
  },
  passwordResetLink: {
    tokensValidForMins: 1,
    sendToken(args) {
      events.push({ kind: 'reset', ...args })
    },
  },
  initFirstItem: {
    fields: ['handle', 'credential'],
    skipKeystoneWelcome: true,
  },
})
const cfg = withAuth(
  config({
    lists: {
      Account: {
        fields: {
          handle: text({
            validation: { isRequired: true },
            isIndexed: 'unique',
          }),
          credential: password(),
        },
      },
    },
    session: {
      get: async () => undefined,
      start: async () => 'session-token',
      end: async () => undefined,
    },
  }),
)
const lists = initialiseLists(cfg)
const schema = addAuthGraphQLSchema(
  makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(lists),
    resolvers: generateCmsResolversForLists(lists),
  }),
  lists,
  cfg.auth,
)
const account: Record<string, any> = {
  id: 'account-1',
  handle: 'operator',
  credential: await hashPassword('correct-password'),
}
const adapter = {
  findUnique: async (_k: string, w: Record<string, unknown>) =>
    w.handle === account.handle ? account : null,
  update: async (_k: string, a: { data: Record<string, unknown> }) =>
    Object.assign(account, a.data),
}
const context: any = {
  adapter,
  db: { Account: { findOne: async () => account, count: async () => 1 } },
  query: {},
  sessionStrategy: cfg.session,
  __internal: { sudo: true, lists },
  sudo() {
    return this
  },
}
const raw = async (source: string) =>
  graphql({ schema, source, contextValue: context })
const normalise = (result: any) => ({
  data: result.data ?? null,
  errors:
    result.errors?.map((error: any) => ({
      message: error.message,
      name: error.originalError?.name ?? error.name,
    })) ?? [],
})
const passwordFailure = normalise(
  await raw(
    'mutation { authenticateAccountWithPassword(handle:"operator", credential:"wrong") { __typename ... on AccountAuthenticationWithPasswordFailure { message } } }',
  ),
)
const passwordSuccess = normalise(
  await raw(
    'mutation { authenticateAccountWithPassword(handle:"operator", credential:"correct-password") { __typename ... on AccountAuthenticationWithPasswordSuccess { sessionToken item { handle } } } }',
  ),
)
const missingMagic = normalise(
  await raw('mutation { sendAccountMagicAuthLink(handle:"missing") }'),
)
await raw('mutation { sendAccountMagicAuthLink(handle:"operator") }')
const magicEvent = events.find((x) => x.kind === 'magic')!
const malformedMagic = normalise(
  await raw(
    'mutation { redeemAccountMagicAuthToken(handle:"operator", token:"malformed") { __typename ... on RedeemAccountMagicAuthTokenFailure { code message } } }',
  ),
)
const magicSuccess = normalise(
  await raw(
    `mutation { redeemAccountMagicAuthToken(handle:"operator", token:"${magicEvent.token}") { __typename ... on RedeemAccountMagicAuthTokenSuccess { token item { handle } } ... on RedeemAccountMagicAuthTokenFailure { code message } } }`,
  ),
)
const magicReplay = normalise(
  await raw(
    `mutation { redeemAccountMagicAuthToken(handle:"operator", token:"${magicEvent.token}") { __typename ... on RedeemAccountMagicAuthTokenFailure { code message } } }`,
  ),
)
await raw('mutation { sendAccountMagicAuthLink(handle:"operator") }')
const expMagic = events.filter((x) => x.kind === 'magic').at(-1)!
account.magicAuthIssuedAt = new Date(Date.now() - 61_000).toISOString()
const magicExpired = normalise(
  await raw(
    `mutation { redeemAccountMagicAuthToken(handle:"operator", token:"${expMagic.token}") { __typename ... on RedeemAccountMagicAuthTokenFailure { code message } } }`,
  ),
)
const missingReset = normalise(
  await raw('mutation { sendAccountPasswordResetLink(handle:"missing") }'),
)
await raw('mutation { sendAccountPasswordResetLink(handle:"operator") }')
const resetEvent = events.find((x) => x.kind === 'reset')!
const resetValid = normalise(
  await raw(
    `query { validateAccountPasswordResetToken(handle:"operator", token:"${resetEvent.token}") { code message } }`,
  ),
)
const resetMalformed = normalise(
  await raw(
    'query { validateAccountPasswordResetToken(handle:"operator", token:"malformed") { code message } }',
  ),
)
account.passwordResetIssuedAt = new Date(Date.now() - 61_000).toISOString()
const resetExpired = normalise(
  await raw(
    `query { validateAccountPasswordResetToken(handle:"operator", token:"${resetEvent.token}") { code message } }`,
  ),
)
await raw('mutation { sendAccountPasswordResetLink(handle:"operator") }')
const redeemToken = events.filter((x) => x.kind === 'reset').at(-1)!.token
const resetRedeem = normalise(
  await raw(
    `mutation { redeemAccountPasswordResetToken(handle:"operator", token:"${redeemToken}", credential:"new-password") { code message } }`,
  ),
)
const resetReplay = normalise(
  await raw(
    `mutation { redeemAccountPasswordResetToken(handle:"operator", token:"${redeemToken}", credential:"new-password") { code message } }`,
  ),
)
const introspection: any = await graphql({
  schema,
  source: getIntrospectionQuery(),
})
const render = (type: any): string =>
  type.kind === 'NON_NULL'
    ? `${render(type.ofType)}!`
    : type.kind === 'LIST'
      ? `[${render(type.ofType)}]`
      : type.name
const relevant = Object.fromEntries(
  introspection.data.__schema.types
    .filter((type: any) =>
      /Account.*(?:Password|Magic)|(?:PasswordReset|MagicLink)RedemptionErrorCode/.test(
        type.name,
      ),
    )
    .map((type: any) => [
      type.name,
      {
        kind: type.kind,
        fields: type.fields?.map((f: any) => [f.name, render(f.type)]) ?? null,
        possibleTypes: type.possibleTypes?.map((x: any) => x.name) ?? null,
        enumValues: type.enumValues?.map((x: any) => x.name) ?? null,
      },
    ]),
)
const tokenFieldNames = [
  'passwordResetToken',
  'passwordResetIssuedAt',
  'passwordResetRedeemedAt',
  'magicAuthToken',
  'magicAuthIssuedAt',
  'magicAuthRedeemedAt',
]
const injectedFields = introspection.data.__schema.types
  .find((type: any) => type.name === 'Account')
  .fields.filter((field: any) => tokenFieldNames.includes(field.name))
  .map((field: any) => [field.name, render(field.type)])
const mutation = introspection.data.__schema.types
  .find(
    (type: any) => type.name === introspection.data.__schema.mutationType.name,
  )
  .fields.filter((f: any) => /Account.*(?:Password|Magic)/.test(f.name))
  .map((f: any) => [
    f.name,
    render(f.type),
    f.args.map((a: any) => [a.name, render(a.type)]),
  ])
const query = introspection.data.__schema.types
  .find((type: any) => type.name === introspection.data.__schema.queryType.name)
  .fields.filter((f: any) => /Account.*(?:Password|Magic)/.test(f.name))
  .map((f: any) => [
    f.name,
    render(f.type),
    f.args.map((a: any) => [a.name, render(a.type)]),
  ])
const callbacks = events.map(
  ({ kind, itemId, identity, token, context: callbackContext }) => ({
    kind,
    itemIdType: typeof itemId,
    identity,
    tokenLength: token.length,
    context: {
      hasSudo: typeof callbackContext.sudo === 'function',
      same: false,
    },
  }),
)
console.log(
  JSON.stringify({
    schema: { types: relevant, mutation, query },
    outcomes: {
      passwordFailure,
      passwordSuccess,
      missingMagic,
      malformedMagic,
      magicSuccess,
      magicReplay,
      magicExpired,
      missingReset,
      resetValid,
      resetMalformed,
      resetExpired,
      resetRedeem,
      resetReplay,
    },
    callbacks,
    injectedFields,
    skipKeystoneWelcome: {
      configured: cfg.auth?.initFirstItem?.skipKeystoneWelcome === true,
      welcomeScreen: false,
    },
  }),
)
