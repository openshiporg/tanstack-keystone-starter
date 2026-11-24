import type { CmsConfig } from '../config'
import { statelessSessions, storedSessions } from '../auth/session'
import { denyAll } from './access'
import { password, timestamp } from './fields'
import type { CmsFieldConfig } from './fields'

export type CreateAuthOptions = NonNullable<CmsConfig['auth']>

type AuthUiAccessContext = {
  session?: unknown
  sudo: () => {
    db: Record<
      string,
      { count: (args?: Record<string, unknown>) => Promise<number> }
    >
  }
}

async function hasInitFirstItemConditions(
  auth: CreateAuthOptions,
  context: AuthUiAccessContext,
) {
  if (!auth.initFirstItem) return false
  if (context.session) return false
  const count = await context.sudo().db[auth.listKey].count({})
  return count === 0
}

function isUniqueIdentityField(field: Record<string, unknown>) {
  if (field.kind === 'id') return true
  if (field.isIndexed === 'unique') return true
  const db = field.db
  return Boolean(
    db &&
    typeof db === 'object' &&
    !Array.isArray(db) &&
    (db as { isUnique?: unknown }).isUnique === true,
  )
}

function isRequiredIdentityField(field: Record<string, unknown>) {
  const validation = field.validation
  const validationRecord =
    validation && typeof validation === 'object' && !Array.isArray(validation)
      ? (validation as { isRequired?: unknown })
      : undefined
  const graphql = field.graphql
  const graphqlRecord =
    graphql && typeof graphql === 'object' && !Array.isArray(graphql)
      ? (graphql as { isNonNull?: { create?: unknown } })
      : undefined
  const isNonNull = Array.isArray(field.isNonNull) ? field.isNonNull : undefined
  return (
    validationRecord?.isRequired === true ||
    graphqlRecord?.isNonNull?.create === true ||
    isNonNull?.[0] === true
  )
}

function wrapSessionStrategy(config: CmsConfig, auth: CreateAuthOptions) {
  const sessionStrategy = config.session
  if (!sessionStrategy) throw new TypeError('Missing .session configuration')
  const { get, ...rest } = sessionStrategy
  const sessionDataQuery = auth.sessionData?.trim() || 'id'

  return {
    ...rest,
    get: async ({ context }: Parameters<typeof sessionStrategy.get>[0]) => {
      const session = await get({ context })
      if (!session?.itemId) return undefined

      try {
        const data = await context.sudo().query[auth.listKey].findOne({
          where: { id: String(session.itemId) },
          query: sessionDataQuery,
        })
        if (!data || typeof data !== 'object' || Array.isArray(data))
          return undefined
        return {
          ...session,
          itemId: String(session.itemId),
          listKey:
            typeof session.listKey === 'string'
              ? session.listKey
              : auth.listKey,
          data,
        }
      } catch (error) {
        console.error(error)
        return undefined
      }
    },
  }
}

export function createAuth(auth: CreateAuthOptions) {
  function withAuth(config: CmsConfig): CmsConfig {
    if (!(auth.listKey in config.lists))
      throw new Error(`withAuth cannot find the list "${auth.listKey}"`)
    const list = config.lists[auth.listKey]
    if (!(auth.identityField in list.fields))
      throw new Error(
        `withAuth cannot find the identity field "${auth.listKey}.${auth.identityField}"`,
      )
    if (!(auth.secretField in list.fields))
      throw new Error(
        `withAuth cannot find the secret field "${auth.listKey}.${auth.secretField}"`,
      )
    for (const fieldKey of auth.initFirstItem?.fields ?? []) {
      if (!(fieldKey in list.fields))
        throw new Error(
          `initFirstItem.fields has unknown field "${auth.listKey}.${fieldKey}"`,
        )
    }
    if (!config.session) throw new TypeError('Missing .session configuration')

    const identityField = list.fields[auth.identityField] as Record<
      string,
      unknown
    >
    const secretField = list.fields[auth.secretField] as Record<string, unknown>
    if (!(identityField.kind === 'text' || identityField.kind === 'id')) {
      throw new Error(
        `withAuth requires "${auth.listKey}.${auth.identityField}" to be a text or id field`,
      )
    }
    if (!isUniqueIdentityField(identityField)) {
      throw new Error(
        `withAuth requires "${auth.listKey}.${auth.identityField}" to be uniquely searchable (for example isIndexed: 'unique')`,
      )
    }
    if (!isRequiredIdentityField(identityField)) {
      throw new Error(
        `withAuth requires "${auth.listKey}.${auth.identityField}" to be required`,
      )
    }
    if (secretField.kind !== 'password') {
      throw new Error(
        `withAuth requires "${auth.listKey}.${auth.secretField}" to be a password field`,
      )
    }

    const baseUi = config.ui ?? {}
    const originalIsAccessAllowed =
      typeof baseUi.isAccessAllowed === 'function'
        ? baseUi.isAccessAllowed
        : undefined

    const hiddenTokenFieldConfig = {
      access: { read: denyAll, create: denyAll, update: denyAll },
      listView: { fieldMode: 'hidden' as const },
      createView: { fieldMode: 'hidden' as const },
      itemView: { fieldMode: 'hidden' as const },
    }
    const tokenFields: Record<string, CmsFieldConfig> = {
      ...(auth.passwordResetLink
        ? {
            passwordResetToken:
              list.fields.passwordResetToken ??
              password(hiddenTokenFieldConfig),
            passwordResetIssuedAt:
              list.fields.passwordResetIssuedAt ??
              timestamp(hiddenTokenFieldConfig),
            passwordResetRedeemedAt:
              list.fields.passwordResetRedeemedAt ??
              timestamp(hiddenTokenFieldConfig),
          }
        : {}),
      ...(auth.magicAuthLink
        ? {
            magicAuthToken:
              list.fields.magicAuthToken ?? password(hiddenTokenFieldConfig),
            magicAuthIssuedAt:
              list.fields.magicAuthIssuedAt ??
              timestamp(hiddenTokenFieldConfig),
            magicAuthRedeemedAt:
              list.fields.magicAuthRedeemedAt ??
              timestamp(hiddenTokenFieldConfig),
          }
        : {}),
    }

    const authList = {
      ...list,
      fields: {
        ...list.fields,
        ...tokenFields,
        [auth.secretField]: {
          ...list.fields[auth.secretField],
          isFilterable: false,
          isOrderable: false,
        },
      },
    }

    return {
      ...config,
      lists: { ...config.lists, [auth.listKey]: authList },
      ui: {
        ...baseUi,
        isAccessAllowed: async (context) => {
          if (
            await hasInitFirstItemConditions(
              { ...auth, sessionData: auth.sessionData?.trim() || 'id' },
              context as AuthUiAccessContext,
            )
          ) {
            return true
          }
          return originalIsAccessAllowed
            ? originalIsAccessAllowed(context)
            : true
        },
      },
      session: wrapSessionStrategy(config, {
        ...auth,
        sessionData: auth.sessionData?.trim() || 'id',
      }),
      auth: { ...auth, sessionData: auth.sessionData?.trim() || 'id' },
    }
  }

  return { withAuth }
}

export { statelessSessions, storedSessions }
