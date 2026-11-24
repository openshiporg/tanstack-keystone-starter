const path = require('node:path')
let getIntrospectionQuery, executeGraphql

async function main() {
  const root = process.env.AUTH_ORACLE_ROOT
  globalThis.__authEvents = []
  ;({ getIntrospectionQuery, graphql: executeGraphql } = require(
    path.join(root, 'node_modules/graphql'),
  ))
  const { createAuth } = require(
    path.join(root, 'node_modules/@keystone-6/auth'),
  )
  const skipProbe = createAuth({
    listKey: 'Account',
    identityField: 'handle',
    secretField: 'credential',
    initFirstItem: {
      fields: ['handle', 'credential'],
      skipKeystoneWelcome: true,
    },
  }).withAuth({
    lists: { Account: { fields: { handle: {}, credential: {} } } },
    session: { get: async () => undefined },
    ui: {},
  })
  const initSource = skipProbe.ui.getAdditionalFiles
    .flatMap((entry) => entry())
    .find((file) => file.outputPath === 'pages/init.js').src
  const skipKeystoneWelcome = {
    configured: true,
    welcomeScreen: !initSource.includes('"enableWelcome":false'),
  }
  const { getContext } = require(
    path.join(root, 'node_modules/@keystone-6/core/context'),
  )
  const PrismaModule = require(path.join(root, 'node_modules/@prisma/client'))
  const config = require(path.join(root, '.keystone/config.js')).default
  const context = getContext(config, PrismaModule)
  context.sessionStrategy = {
    start: async () => 'session-token',
    end: async () => {},
    get: async () => undefined,
  }
  await context.prisma.account.deleteMany()
  await context.sudo().query.Account.createOne({
    data: { handle: 'operator', credential: 'correct-password' },
    query: 'id',
  })
  const raw = (query) => context.graphql.raw({ query })
  const normalise = (result) => ({
    data: result.data ?? null,
    errors:
      result.errors?.map((error) => ({
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
  const magicEvent = globalThis.__authEvents.find((x) => x.kind === 'magic')
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
  const expMagic = globalThis.__authEvents
    .filter((x) => x.kind === 'magic')
    .at(-1)
  await context.prisma.account.update({
    where: { handle: 'operator' },
    data: { magicAuthIssuedAt: new Date(Date.now() - 61_000) },
  })
  const magicExpired = normalise(
    await raw(
      `mutation { redeemAccountMagicAuthToken(handle:"operator", token:"${expMagic.token}") { __typename ... on RedeemAccountMagicAuthTokenFailure { code message } } }`,
    ),
  )
  const missingReset = normalise(
    await raw('mutation { sendAccountPasswordResetLink(handle:"missing") }'),
  )
  await raw('mutation { sendAccountPasswordResetLink(handle:"operator") }')
  const resetEvent = globalThis.__authEvents.find((x) => x.kind === 'reset')
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
  await context.prisma.account.update({
    where: { handle: 'operator' },
    data: { passwordResetIssuedAt: new Date(Date.now() - 61_000) },
  })
  const resetExpired = normalise(
    await raw(
      `query { validateAccountPasswordResetToken(handle:"operator", token:"${resetEvent.token}") { code message } }`,
    ),
  )
  await raw('mutation { sendAccountPasswordResetLink(handle:"operator") }')
  const redeemToken = globalThis.__authEvents
    .filter((x) => x.kind === 'reset')
    .at(-1).token
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
  const introspection = await executeGraphql({
    schema: context.graphql.schema,
    source: getIntrospectionQuery(),
  })
  const relevant = Object.fromEntries(
    introspection.data.__schema.types
      .filter((type) =>
        /Account.*(?:Password|Magic)|(?:PasswordReset|MagicLink)RedemptionErrorCode/.test(
          type.name,
        ),
      )
      .map((type) => [
        type.name,
        {
          kind: type.kind,
          fields: type.fields?.map((f) => [f.name, render(f.type)]) ?? null,
          possibleTypes: type.possibleTypes?.map((x) => x.name) ?? null,
          enumValues: type.enumValues?.map((x) => x.name) ?? null,
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
    .find((type) => type.name === 'Account')
    .fields.filter((field) => tokenFieldNames.includes(field.name))
    .map((field) => [field.name, render(field.type)])
  const mutation = introspection.data.__schema.types
    .find((type) => type.name === introspection.data.__schema.mutationType.name)
    .fields.filter((f) => /Account.*(?:Password|Magic)/.test(f.name))
    .map((f) => [
      f.name,
      render(f.type),
      f.args.map((a) => [a.name, render(a.type)]),
    ])
  const query = introspection.data.__schema.types
    .find((type) => type.name === introspection.data.__schema.queryType.name)
    .fields.filter((f) => /Account.*(?:Password|Magic)/.test(f.name))
    .map((f) => [
      f.name,
      render(f.type),
      f.args.map((a) => [a.name, render(a.type)]),
    ])
  const callbacks = globalThis.__authEvents.map(
    ({ kind, itemId, identity, token, context }) => ({
      kind,
      itemIdType: typeof itemId,
      identity,
      tokenLength: token.length,
      context: {
        hasSudo: typeof context.sudo === 'function',
        same: context === globalThis.__lastCallbackContext,
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
      skipKeystoneWelcome,
    }),
  )
  await context.prisma.$disconnect()
}
function render(type) {
  return type.kind === 'NON_NULL'
    ? `${render(type.ofType)}!`
    : type.kind === 'LIST'
      ? `[${render(type.ofType)}]`
      : type.name
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
