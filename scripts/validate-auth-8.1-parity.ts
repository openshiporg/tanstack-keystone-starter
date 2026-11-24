import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { graphql, printSchema } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'

import { addAuthGraphQLSchema } from '../src/features/cms/auth/graphql'
import { hashPassword } from '../src/features/cms/auth/password'
import { config, initialiseLists } from '../src/features/cms/config'
import { createAuth } from '../src/features/cms/keystone/auth'
import { password, text } from '../src/features/cms/keystone/fields'
import {
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
} from '../src/features/cms/runtime'

const oracleRoot =
  '/private/tmp/tanstack-keystone-parity-packages/keystone-6-auth-8.1.0/package/src'
const oracle = await Promise.all([
  readFile(`${oracleRoot}/gql/getMagicAuthLinkSchema.ts`, 'utf8'),
  readFile(`${oracleRoot}/gql/getPasswordResetSchema.ts`, 'utf8'),
  readFile(`${oracleRoot}/lib/getErrorMessage.ts`, 'utf8'),
])
assert.match(oracle.join('\n'), /RedeemItemMagicAuthTokenSuccess/)
assert.match(oracle.join('\n'), /Auth token redemption failed\./)

const sent: Record<string, string[]> = { reset: [], magic: [] }
const { withAuth } = createAuth({
  listKey: 'Account',
  identityField: 'handle',
  secretField: 'credential',
  passwordResetLink: { sendToken: ({ token }) => void sent.reset.push(token) },
  magicAuthLink: { sendToken: ({ token }) => void sent.magic.push(token) },
  initFirstItem: {
    fields: ['handle', 'credential'],
    skipKeystoneWelcome: true,
  },
})
const cmsConfig = withAuth(
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
      start: async () => 'magic-session',
      end: async () => undefined,
    },
  }),
)
for (const field of [
  'passwordResetToken',
  'passwordResetIssuedAt',
  'passwordResetRedeemedAt',
  'magicAuthToken',
  'magicAuthIssuedAt',
  'magicAuthRedeemedAt',
]) {
  const value = cmsConfig.lists.Account.fields[field]
  assert(value, `missing injected ${field}`)
  assert.deepEqual(value.access, { read: false, create: false, update: false })
}
assert.equal(cmsConfig.auth?.initFirstItem?.skipKeystoneWelcome, true)

const lists = initialiseLists(cmsConfig)
const base = makeExecutableSchema({
  typeDefs: generateCmsTypeDefsForLists(lists),
  resolvers: generateCmsResolversForLists(lists),
})
const schema = addAuthGraphQLSchema(base, lists, cmsConfig.auth)
const printed = printSchema(schema)
for (const name of [
  'sendAccountMagicAuthLink',
  'redeemAccountMagicAuthToken',
  'RedeemAccountMagicAuthTokenResult',
  'RedeemAccountMagicAuthTokenSuccess',
  'RedeemAccountMagicAuthTokenFailure',
  'MagicLinkRedemptionErrorCode',
  'validateAccountPasswordResetToken',
  'ValidateAccountPasswordResetTokenResult',
  'RedeemAccountPasswordResetTokenResult',
  'PasswordResetRedemptionErrorCode',
])
  assert.match(printed, new RegExp(`\\b${name}\\b`), `missing ${name}`)

const account: Record<string, unknown> = {
  id: 'account-1',
  handle: 'operator',
  credential: await hashPassword('secret'),
}
const adapter = {
  findUnique: async (_key: string, where: Record<string, unknown>) =>
    where.handle === account.handle ? account : null,
  update: async (_key: string, args: { data: Record<string, unknown> }) =>
    Object.assign(account, args.data),
}
const context: any = {
  adapter,
  db: { Account: { findOne: async () => account, count: async () => 1 } },
  query: {},
  sessionStrategy: cmsConfig.session,
  __internal: { sudo: true, lists },
  sudo() {
    return this
  },
}
const execute = (source: string) =>
  graphql({ schema, source, contextValue: context })
let result = await execute(
  'mutation { sendAccountMagicAuthLink(handle:"operator") }',
)
assert.equal(result.errors, undefined)
assert.equal(sent.magic.length, 1)
assert.equal(sent.magic[0].length, 20)
result = await execute(
  `mutation { redeemAccountMagicAuthToken(handle:"operator", token:"${sent.magic[0]}") { __typename ... on RedeemAccountMagicAuthTokenSuccess { token item { id } } ... on RedeemAccountMagicAuthTokenFailure { code message } } }`,
)
assert.equal(
  (result.data as any).redeemAccountMagicAuthToken.__typename,
  'RedeemAccountMagicAuthTokenSuccess',
)
assert.equal(
  (result.data as any).redeemAccountMagicAuthToken.token,
  'magic-session',
)
result = await execute(
  `mutation { redeemAccountMagicAuthToken(handle:"operator", token:"${sent.magic[0]}") { __typename ... on RedeemAccountMagicAuthTokenFailure { code message } } }`,
)
assert.deepEqual(
  { ...(result.data as any).redeemAccountMagicAuthToken },
  {
    __typename: 'RedeemAccountMagicAuthTokenFailure',
    code: 'TOKEN_REDEEMED',
    message:
      'Auth tokens are single use and the auth token provided has already been redeemed.',
  },
)
result = await execute(
  'query { validateAccountPasswordResetToken(handle:"missing", token:"bad") { code message } }',
)
assert.deepEqual(
  { ...(result.data as any).validateAccountPasswordResetToken },
  {
    code: 'FAILURE',
    message: 'Auth token redemption failed.',
  },
)
result = await execute(
  'mutation { sendAccountPasswordResetLink(handle:"operator") }',
)
assert.equal(result.errors, undefined)
assert.equal(sent.reset[0].length, 20)
result = await execute(
  `query { validateAccountPasswordResetToken(handle:"operator", token:"${sent.reset[0]}") { code message } }`,
)
assert.equal((result.data as any).validateAccountPasswordResetToken, null)
account.passwordResetIssuedAt = new Date(Date.now() - 11 * 60_000).toISOString()
result = await execute(
  `query { validateAccountPasswordResetToken(handle:"operator", token:"${sent.reset[0]}") { code message } }`,
)
assert.equal(
  (result.data as any).validateAccountPasswordResetToken.code,
  'TOKEN_EXPIRED',
)
await execute('mutation { sendAccountPasswordResetLink(handle:"operator") }')
const resetToken = sent.reset.at(-1)!
result = await execute(
  `mutation { redeemAccountPasswordResetToken(handle:"operator", token:"${resetToken}", credential:"replacement") { code message } }`,
)
assert.equal((result.data as any).redeemAccountPasswordResetToken, null)
result = await execute(
  `mutation { redeemAccountPasswordResetToken(handle:"operator", token:"${resetToken}", credential:"replacement") { code message } }`,
)
assert.equal(
  (result.data as any).redeemAccountPasswordResetToken.code,
  'TOKEN_REDEEMED',
)

assert.throws(
  () =>
    addAuthGraphQLSchema(base, lists, {
      ...cmsConfig.auth!,
      sessionData: 'notAField',
    }),
  /sessionData option.*incorrect/s,
)

const noLinks = createAuth({
  listKey: 'Account',
  identityField: 'handle',
  secretField: 'credential',
}).withAuth(cmsConfig)
const noLinkLists = initialiseLists(noLinks)
const noLinkSchema = addAuthGraphQLSchema(
  makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(noLinkLists),
    resolvers: generateCmsResolversForLists(noLinkLists),
  }),
  noLinkLists,
  noLinks.auth,
)
assert.doesNotMatch(printSchema(noLinkSchema), /MagicAuth|PasswordReset/)
console.info('Auth 8.1 focused local contract validation passed.')
