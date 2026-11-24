import { randomBytes } from 'node:crypto'
import { GraphQLError, assertInputObjectType, parse, validate } from 'graphql'
import { mergeSchemas } from '@graphql-tools/schema'
import type { GraphQLInputType, GraphQLSchema } from 'graphql'

import type { CmsAuthConfig } from '../config'
import type { CmsContext, CmsItem } from '../adapters'
import type { CmsList } from '../types'
import { configFailure } from '../errors'
import { getPasswordFieldKdf, verifyPassword } from './password'
import { createAuthRateLimiter } from './rate-limit'

const AUTHENTICATION_FAILURE = 'Authentication failed.'
const INIT_ALREADY_COMPLETE =
  'Initial user creation is not available because users already exist.'
const INIT_CREATE_FAILED = 'Initial user creation failed.'
const INIT_SESSION_FAILED =
  'Initial user was created but the session could not be started.'

type AuthResult =
  | { __typename: string; sessionToken: string; item: CmsItem }
  | { __typename: string; message: string }

function lowerFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1)
}

function authNames(listKey: string) {
  const lower = lowerFirst(listKey)
  return {
    itemQueryName: lower,
    authenticateItemWithPassword: `authenticate${listKey}WithPassword`,
    authenticationResult: `${listKey}AuthenticationWithPasswordResult`,
    authenticationSuccess: `${listKey}AuthenticationWithPasswordSuccess`,
    authenticationFailure: `${listKey}AuthenticationWithPasswordFailure`,
    createInitialInput: `CreateInitial${listKey}Input`,
    createInitialItem: `createInitial${listKey}`,
    sendPasswordResetLink: `send${listKey}PasswordResetLink`,
    redeemPasswordResetToken: `redeem${listKey}PasswordResetToken`,
    validatePasswordResetToken: `validate${listKey}PasswordResetToken`,
    passwordResetRedemptionResult: `Redeem${listKey}PasswordResetTokenResult`,
    passwordResetValidationResult: `Validate${listKey}PasswordResetTokenResult`,
    sendMagicAuthLink: `send${listKey}MagicAuthLink`,
    redeemMagicAuthToken: `redeem${listKey}MagicAuthToken`,
    magicAuthRedemptionResult: `Redeem${listKey}MagicAuthTokenResult`,
    magicAuthSuccess: `Redeem${listKey}MagicAuthTokenSuccess`,
    magicAuthFailure: `Redeem${listKey}MagicAuthTokenFailure`,
  }
}

function findList(lists: CmsList[], listKey: string) {
  const list = lists.find((entry) => entry.key === listKey)
  if (!list) throw new Error(`Auth list ${listKey} does not exist`)
  return list
}

function graphQLInputTypeSource(type: GraphQLInputType) {
  return String(type)
}

export function getPasswordResetIssuedAtMs(value: unknown) {
  if (value instanceof Date) {
    const timestamp = value.getTime()
    return Number.isFinite(timestamp) ? timestamp : undefined
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const timestamp = new Date(value).getTime()
    return Number.isFinite(timestamp) ? timestamp : undefined
  }
  return undefined
}

function createAuthToken() {
  return randomBytes(16).toString('base64url').slice(0, 20)
}

function authTokenError(code: 'FAILURE' | 'TOKEN_EXPIRED' | 'TOKEN_REDEEMED') {
  const messages = {
    FAILURE: 'Auth token redemption failed.',
    TOKEN_EXPIRED: 'The auth token provided has expired.',
    TOKEN_REDEEMED:
      'Auth tokens are single use and the auth token provided has already been redeemed.',
  }
  return { code, message: messages[code] }
}

function createInitialInputFields(
  list: CmsList,
  auth: CmsAuthConfig,
  baseSchema: GraphQLSchema,
) {
  const createInput = assertInputObjectType(
    baseSchema.getType(`${list.key}CreateInput`),
  )
  const fields = createInput.toConfig().fields
  const allowed = new Set(auth.initFirstItem?.fields ?? [])
  return Object.entries(fields)
    .filter(([fieldKey]) => allowed.has(fieldKey))
    .map(
      ([fieldKey, field]) =>
        `${fieldKey}: ${graphQLInputTypeSource(field.type)}`,
    )
    .join('\n    ')
}

async function getAuthenticatedItem(context: CmsContext, auth: CmsAuthConfig) {
  if (!context.session?.itemId) return null
  return context.db[auth.listKey].findOne({
    where: { id: context.session.itemId },
  })
}

function failure(names: ReturnType<typeof authNames>): AuthResult {
  return {
    __typename: names.authenticationFailure,
    message: AUTHENTICATION_FAILURE,
  }
}

export function addAuthGraphQLSchema(
  baseSchema: GraphQLSchema,
  lists: CmsList[],
  auth: CmsAuthConfig | undefined,
) {
  if (!auth) return baseSchema
  const authConfig = auth
  const list = findList(lists, authConfig.listKey)
  const secretField = list.fields.find(
    (field) => field.path === authConfig.secretField,
  )
  if (secretField?.kind !== 'password')
    throw new Error(
      `${authConfig.listKey}.${authConfig.secretField} is not a password field`,
    )
  const names = authNames(authConfig.listKey)
  const initialInputFields = createInitialInputFields(list, auth, baseSchema)
  const loginRateLimiter = authConfig.rateLimit?.login
    ? createAuthRateLimiter(authConfig.rateLimit.login)
    : undefined
  const passwordResetRateLimiter = authConfig.rateLimit?.passwordReset
    ? createAuthRateLimiter(authConfig.rateLimit.passwordReset)
    : undefined
  const rateLimitKey = (
    scope: string,
    context: CmsContext,
    identity: string,
  ) => {
    const request = context.__internal.request
    const forwardedClient =
      process.env.CMS_TRUST_PROXY === 'true'
        ? request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        : undefined
    const client = forwardedClient || 'unknown-client'
    return `${scope}:${client}:${identity.trim().toLowerCase()}`
  }
  const hasInitFirstItem = Boolean(auth.initFirstItem)
  const hasPasswordReset = Boolean(auth.passwordResetLink)
  const hasMagicAuth = Boolean(auth.magicAuthLink)

  if (auth.sessionData?.trim()) {
    const query = `query CmsSessionDataValidation($id: ID!) { ${names.itemQueryName}(where: { id: $id }) { ${auth.sessionData.trim()} } }`
    let ast
    try {
      ast = parse(query)
    } catch (error) {
      throw new Error(
        `The query to get session data has a syntax error, the sessionData option in your createAuth usage is likely incorrect\n${error}`,
      )
    }
    const errors = validate(baseSchema, ast)
    if (errors.length) {
      throw new Error(
        `The query to get session data has validation errors, the sessionData option in your createAuth usage is likely incorrect\n${errors.join('\n')}`,
      )
    }
  }

  const typeDefs = /* GraphQL */ `
    type ${names.authenticationSuccess} {
      sessionToken: String!
      item: ${authConfig.listKey}!
    }

    type ${names.authenticationFailure} {
      message: String!
    }

    ${
      hasPasswordReset
        ? `type ${names.passwordResetRedemptionResult} {
      code: PasswordResetRedemptionErrorCode!
      message: String!
    }
    type ${names.passwordResetValidationResult} {
      code: PasswordResetRedemptionErrorCode!
      message: String!
    }
    enum PasswordResetRedemptionErrorCode { FAILURE TOKEN_EXPIRED TOKEN_REDEEMED }`
        : ''
    }
    ${
      hasMagicAuth
        ? `type ${names.magicAuthSuccess} { token: String! item: ${authConfig.listKey}! }
    type ${names.magicAuthFailure} { code: MagicLinkRedemptionErrorCode! message: String! }
    enum MagicLinkRedemptionErrorCode { FAILURE TOKEN_EXPIRED TOKEN_REDEEMED }
    union ${names.magicAuthRedemptionResult} = ${names.magicAuthSuccess} | ${names.magicAuthFailure}`
        : ''
    }

    union ${names.authenticationResult} = ${names.authenticationSuccess} | ${names.authenticationFailure}
    union AuthenticatedItem = ${authConfig.listKey}

    ${hasInitFirstItem ? `input ${names.createInitialInput} {\n    ${initialInputFields}\n  }` : ''}

    extend type Query {
      authenticatedItem: AuthenticatedItem
      ${hasPasswordReset ? `${names.validatePasswordResetToken}(${authConfig.identityField}: String!, token: String!): ${names.passwordResetValidationResult}` : ''}
    }

    extend type Mutation {
      endSession: Boolean!
      ${names.authenticateItemWithPassword}(${authConfig.identityField}: String!, ${authConfig.secretField}: String!): ${names.authenticationResult}
      ${hasPasswordReset ? `${names.sendPasswordResetLink}(${authConfig.identityField}: String!): Boolean!` : ''}
      ${hasPasswordReset ? `${names.redeemPasswordResetToken}(${authConfig.identityField}: String!, token: String!, ${authConfig.secretField}: String!): ${names.passwordResetRedemptionResult}` : ''}
      ${hasMagicAuth ? `${names.sendMagicAuthLink}(${authConfig.identityField}: String!): Boolean!` : ''}
      ${hasMagicAuth ? `${names.redeemMagicAuthToken}(${authConfig.identityField}: String!, token: String!): ${names.magicAuthRedemptionResult}!` : ''}
      ${hasInitFirstItem ? `${names.createInitialItem}(data: ${names.createInitialInput}!): ${names.authenticationSuccess}!` : ''}
    }
  `

  async function validateAuthToken(
    tokenType: 'passwordReset' | 'magicAuth',
    args: Record<string, string>,
    context: CmsContext,
  ) {
    const sudoContext = context.sudo()
    const authCmsList = lists.find((entry) => entry.key === authConfig.listKey)
    const tokenField = authCmsList?.fields.find(
      (field) => field.path === `${tokenType}Token`,
    )
    const item = await sudoContext.adapter.findUnique(
      authConfig.listKey,
      { [authConfig.identityField]: args[authConfig.identityField] },
      sudoContext,
    )
    const isValidToken = await verifyPassword(
      args.token,
      item?.[`${tokenType}Token`],
      tokenField,
    )
    if (!item || !isValidToken)
      return { item: null, error: authTokenError('FAILURE') }
    if (item[`${tokenType}RedeemedAt`])
      return { item, error: authTokenError('TOKEN_REDEEMED') }
    const issuedAtValue = item[`${tokenType}IssuedAt`]
    const issuedAt = getPasswordResetIssuedAtMs(issuedAtValue)
    if (issuedAt === undefined)
      throw new Error(
        `Error redeeming authToken: field ${authConfig.listKey}.${tokenType}IssuedAt isn't a valid Date object.`,
      )
    const configuredMinutes =
      tokenType === 'passwordReset'
        ? authConfig.passwordResetLink?.tokensValidForMins
        : authConfig.magicAuthLink?.tokensValidForMins
    const parsed = Number.parseFloat(String(configuredMinutes ?? ''))
    const validMinutes = parsed
      ? Math.max(1 / 6, Math.min(parsed, 60 * 24))
      : 10
    if (Date.now() - issuedAt > 1000 * 60 * validMinutes)
      return { item, error: authTokenError('TOKEN_EXPIRED') }
    return { item, error: null }
  }

  async function sendToken(
    tokenType: 'passwordReset' | 'magicAuth',
    args: Record<string, string>,
    context: CmsContext,
  ) {
    const identity = args[authConfig.identityField] ?? ''
    if (tokenType === 'passwordReset') {
      const decision = passwordResetRateLimiter?.consume(
        rateLimitKey('password-reset', context, identity),
      )
      if (decision && !decision.allowed) return true
    }
    const sudoContext = context.sudo()
    const item = await sudoContext.adapter.findUnique(
      authConfig.listKey,
      { [authConfig.identityField]: identity },
      sudoContext,
    )
    if (!item) return true
    const authCmsList = lists.find((entry) => entry.key === authConfig.listKey)
    const tokenField = authCmsList?.fields.find(
      (field) => field.path === `${tokenType}Token`,
    )
    const token = createAuthToken()
    await sudoContext.adapter.update(authConfig.listKey, {
      where: { id: item.id },
      data: {
        [`${tokenType}Token`]:
          await getPasswordFieldKdf(tokenField).hash(token),
        [`${tokenType}IssuedAt`]: new Date().toISOString(),
        [`${tokenType}RedeemedAt`]: null,
      },
      context: sudoContext,
    })
    const linkConfig =
      tokenType === 'passwordReset'
        ? authConfig.passwordResetLink
        : authConfig.magicAuthLink
    await linkConfig!.sendToken({
      token,
      identity,
      itemId: item.id,
      context,
    })
    return true
  }

  const resolvers = {
    AuthenticatedItem: {
      __resolveType() {
        return authConfig.listKey
      },
    },
    [names.authenticationResult]: {
      __resolveType(value: AuthResult) {
        return value.__typename
      },
    },
    ...(hasMagicAuth
      ? {
          [names.magicAuthRedemptionResult]: {
            __resolveType(value: { token?: string }) {
              return 'token' in value
                ? names.magicAuthSuccess
                : names.magicAuthFailure
            },
          },
        }
      : {}),
    Query: {
      authenticatedItem: (
        _root: unknown,
        _args: unknown,
        context: CmsContext,
      ) => getAuthenticatedItem(context, auth),
      ...(hasPasswordReset
        ? {
            [names.validatePasswordResetToken]: async (
              _root: unknown,
              args: Record<string, string>,
              context: CmsContext,
            ) =>
              (await validateAuthToken('passwordReset', args, context)).error,
          }
        : {}),
    },
    Mutation: {
      endSession: async (
        _root: unknown,
        _args: unknown,
        context: CmsContext,
      ) => {
        await context.sessionStrategy?.end({ context })
        return true
      },
      [names.authenticateItemWithPassword]: async (
        _root: unknown,
        args: Record<string, string>,
        context: CmsContext,
      ) => {
        if (!context.sessionStrategy)
          throw configFailure('No session strategy on context')
        const loginKey = rateLimitKey(
          'login',
          context,
          args[authConfig.identityField] ?? '',
        )
        const loginDecision = loginRateLimiter?.consume(loginKey)
        if (loginDecision && !loginDecision.allowed) return failure(names)
        const sudoContext = context.sudo()
        const authCmsList = lists.find(
          (entry) => entry.key === authConfig.listKey,
        )
        const secretCmsField = authCmsList?.fields.find(
          (field) => field.path === authConfig.secretField,
        )
        const item = await sudoContext.adapter.findUnique(
          authConfig.listKey,
          { [authConfig.identityField]: args[authConfig.identityField] },
          sudoContext,
        )
        const isValid = await verifyPassword(
          args[authConfig.secretField] ?? '',
          item?.[authConfig.secretField],
          secretCmsField,
        )
        if (!item || !isValid) return failure(names)
        loginRateLimiter?.reset(loginKey)
        const sessionToken = await context.sessionStrategy.start({
          data: { listKey: authConfig.listKey, itemId: item.id },
          context,
        })
        if (typeof sessionToken !== 'string' || sessionToken.length === 0)
          return failure(names)
        return { __typename: names.authenticationSuccess, sessionToken, item }
      },
      ...(hasPasswordReset
        ? {
            [names.sendPasswordResetLink]: async (
              _root: unknown,
              args: Record<string, string>,
              context: CmsContext,
            ) => sendToken('passwordReset', args, context),
            [names.redeemPasswordResetToken]: async (
              _root: unknown,
              args: Record<string, string>,
              context: CmsContext,
            ) => {
              const resetKey = rateLimitKey(
                'password-reset',
                context,
                args[authConfig.identityField] ?? '',
              )
              const resetDecision = passwordResetRateLimiter?.consume(resetKey)
              if (resetDecision && !resetDecision.allowed)
                return authTokenError('FAILURE')
              const sudoContext = context.sudo()
              const validation = await validateAuthToken(
                'passwordReset',
                args,
                context,
              )
              if (validation.error || !validation.item) return validation.error
              await sudoContext.adapter.update(authConfig.listKey, {
                where: { id: validation.item.id },
                data: { passwordResetRedeemedAt: new Date().toISOString() },
                context: sudoContext,
              })
              await sudoContext.adapter.update(authConfig.listKey, {
                where: { id: validation.item.id },
                data: {
                  [authConfig.secretField]: args[authConfig.secretField],
                },
                context: sudoContext,
              })
              passwordResetRateLimiter?.reset(resetKey)
              return null
            },
          }
        : {}),
      ...(hasMagicAuth
        ? {
            [names.sendMagicAuthLink]: async (
              _root: unknown,
              args: Record<string, string>,
              context: CmsContext,
            ) => sendToken('magicAuth', args, context),
            [names.redeemMagicAuthToken]: async (
              _root: unknown,
              args: Record<string, string>,
              context: CmsContext,
            ) => {
              if (!context.sessionStrategy)
                throw new Error(
                  'No session implementation available on context',
                )
              const validation = await validateAuthToken(
                'magicAuth',
                args,
                context,
              )
              if (validation.error || !validation.item) return validation.error
              const sudoContext = context.sudo()
              await sudoContext.adapter.update(authConfig.listKey, {
                where: { id: validation.item.id },
                data: { magicAuthRedeemedAt: new Date().toISOString() },
                context: sudoContext,
              })
              const token = await context.sessionStrategy.start({
                data: {
                  listKey: authConfig.listKey,
                  itemId: validation.item.id,
                },
                context,
              })
              if (typeof token !== 'string' || token.length === 0)
                return { code: 'FAILURE', message: 'Failed to start session.' }
              return { token, item: validation.item }
            },
          }
        : {}),
      ...(hasInitFirstItem
        ? {
            [names.createInitialItem]: async (
              _root: unknown,
              args: { data?: Record<string, unknown> },
              context: CmsContext,
            ) => {
              if (!context.sessionStrategy)
                throw configFailure('No session strategy on context')
              const sudoContext = context.sudo()
              const count = await sudoContext.db[authConfig.listKey].count({})
              if (count !== 0) {
                throw new GraphQLError(INIT_ALREADY_COMPLETE, {
                  extensions: {
                    code: 'CMS_INIT_ALREADY_COMPLETE',
                    listKey: authConfig.listKey,
                    count,
                  },
                })
              }

              let item: CmsItem
              try {
                item = await sudoContext.db[authConfig.listKey].createOne({
                  data: {
                    ...(auth.initFirstItem?.itemData ?? {}),
                    ...(args.data ?? {}),
                  },
                })
              } catch (error) {
                throw new GraphQLError(INIT_CREATE_FAILED, {
                  extensions: {
                    code: 'CMS_INIT_CREATE_FAILED',
                    listKey: authConfig.listKey,
                    cause:
                      error instanceof Error ? error.message : String(error),
                  },
                })
              }

              const sessionToken = await context.sessionStrategy.start({
                data: { listKey: authConfig.listKey, itemId: item.id },
                context,
              })
              if (
                typeof sessionToken !== 'string' ||
                sessionToken.length === 0
              ) {
                throw new GraphQLError(INIT_SESSION_FAILED, {
                  extensions: {
                    code: 'CMS_INIT_SESSION_FAILED',
                    listKey: authConfig.listKey,
                    itemId: item.id,
                  },
                })
              }
              return {
                __typename: names.authenticationSuccess,
                sessionToken,
                item,
              }
            },
          }
        : {}),
    },
  }

  return mergeSchemas({ schemas: [baseSchema], typeDefs, resolvers })
}
