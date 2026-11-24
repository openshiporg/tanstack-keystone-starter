import type { CmsContext, CmsSessionStrategy } from './adapters'
import { getGraphQLNames, pluralizeLabel } from './gql-names'
import type {
  CmsField,
  CmsFieldGroup,
  CmsFieldGroupUiConfig,
  CmsList,
  CmsListDbConfig,
  CmsListFilterabilityControl,
  CmsListOrderabilityControl,
  CmsResolvedRelationshipMetadata,
} from './types'
import type { CmsFieldConfig } from './fields'
import { validateStructureSchema } from './structure'
import type { StructureSchema } from './structure'

export type CmsDbConfig = {
  provider?: 'postgresql' | 'sqlite' | 'mysql'
  url?: string
  prismaModelOrder?: string[]
  enableLogging?: boolean | string[]
  idField?: { kind?: 'uuid' | 'cuid' | 'autoincrement' }
  shadowDatabaseUrl?: string
  useMigrations?: boolean
  extendPrismaSchema?: (schema: string) => string
}

export type CmsAuthInitFirstItem = {
  fields: string[]
  itemData?: Record<string, unknown>
  skipKeystoneWelcome?: boolean
}

export type CmsAuthRateLimit = {
  maxAttempts: number
  windowMs: number
}

export type CmsAuthConfig = {
  listKey: string
  identityField: string
  secretField: string
  rateLimit?: {
    login?: CmsAuthRateLimit
    passwordReset?: CmsAuthRateLimit
  }
  initFirstItem?: CmsAuthInitFirstItem
  passwordResetLink?: CmsAuthTokenLinkConfig
  magicAuthLink?: CmsAuthTokenLinkConfig
  sessionData?: string
}

export type CmsAuthTokenLinkConfig = {
  sendToken: (args: {
    token: string
    identity: string
    itemId: string | number | bigint
    context: CmsContext
  }) => void | Promise<void>
  tokensValidForMins?: number
}

export type CmsServerConfig = {
  port?: number
  host?: string
  cors?: unknown
  healthCheck?: boolean | { path?: string }
  maxFileSize?: number
  extendExpressApp?: unknown
  extendHttpServer?: unknown
}

export type CmsGraphQLConfig = {
  path?: string
  playground?: boolean
  apolloConfig?: unknown
  debug?: boolean
  queryLimits?: unknown
  schemaPath?: string
  maxTake?: number
  extendGraphqlSchema?: unknown
}

export type CmsUiConfig = {
  basePath?: string
  isAccessAllowed?: (context: {
    session?: unknown
    sessionStrategy?: unknown
  }) => boolean | Promise<boolean>
  isDisabled?: boolean
  getAdditionalFiles?: unknown
  pageMiddleware?: unknown
  publicPages?: string[]
  [key: string]: unknown
}

export type CmsConfig = {
  db?: CmsDbConfig
  lists: Record<string, CmsListConfig>
  session?: CmsSessionStrategy<{ listKey?: string; itemId: string }>
  auth?: CmsAuthConfig
  memory?: {
    seed?: Record<string, Array<Record<string, unknown> & { id: string }>>
  }
  storage?: Record<string, unknown>
  ui?: CmsUiConfig
  server?: CmsServerConfig
  graphql?: CmsGraphQLConfig
}

export type NormalizedCmsConfig = Omit<
  CmsConfig,
  'db' | 'graphql' | 'server' | 'ui'
> & {
  db: CmsDbConfig &
    Required<
      Pick<
        CmsDbConfig,
        | 'provider'
        | 'url'
        | 'enableLogging'
        | 'idField'
        | 'shadowDatabaseUrl'
        | 'extendPrismaSchema'
      >
    >
  graphql: CmsGraphQLConfig &
    Required<
      Pick<
        CmsGraphQLConfig,
        'path' | 'playground' | 'schemaPath' | 'extendGraphqlSchema'
      >
    >
  server: CmsServerConfig &
    Required<
      Pick<
        CmsServerConfig,
        | 'port'
        | 'cors'
        | 'maxFileSize'
        | 'extendExpressApp'
        | 'extendHttpServer'
      >
    >
  ui: CmsUiConfig &
    Required<
      Pick<
        CmsUiConfig,
        | 'basePath'
        | 'isAccessAllowed'
        | 'isDisabled'
        | 'getAdditionalFiles'
        | 'pageMiddleware'
        | 'publicPages'
      >
    >
}

export type FieldGroupConfig = {
  label: string
  description?: string
  fields: string[]
  ui?: CmsFieldGroupUiConfig
}

export type KeystoneFieldGroupConfig = {
  label: string
  description?: string
  ui?: CmsFieldGroupUiConfig
  fields: Record<string, CmsFieldConfig>
}

export type CmsListConfig = Partial<
  Omit<CmsList, 'key' | 'fields' | 'groups' | 'graphql' | 'db' | 'ui'>
> & {
  fields: Record<string, CmsFieldConfig>
  groups?: FieldGroupConfig[]
  graphql?: Partial<CmsList['graphql']>
  db?: CmsListDbConfig
  ui?: CmsList['ui']
}

type CmsFieldGroupSentinel = {
  fields: string[]
  label: string
  description: string
  ui?: CmsFieldGroupUiConfig
}

function noop() {}
function emptyArray() {
  return []
}

function identity<T>(value: T) {
  return value
}

function defaultUiAccessAllowed({
  session,
  sessionStrategy,
}: {
  session?: unknown
  sessionStrategy?: unknown
}) {
  if (!sessionStrategy) return true
  return session !== undefined
}

function normalizeDbConfig(
  db: CmsDbConfig | undefined,
): NormalizedCmsConfig['db'] {
  const provider = db?.provider ?? 'postgresql'
  if (!['postgresql', 'sqlite', 'mysql'].includes(provider)) {
    throw new TypeError(
      '"db.provider" only supports "sqlite", "postgresql" or "mysql"',
    )
  }

  return {
    ...db,
    provider,
    url: db?.url ?? 'postgres://',
    shadowDatabaseUrl: db?.shadowDatabaseUrl ?? '',
    extendPrismaSchema: db?.extendPrismaSchema ?? identity,
    idField: db?.idField ?? { kind: 'cuid' },
    enableLogging:
      db?.enableLogging === true
        ? ['query']
        : db?.enableLogging === false
          ? []
          : (db?.enableLogging ?? []),
  }
}

function normalizeGraphqlConfig(
  graphql: CmsGraphQLConfig | undefined,
): NormalizedCmsConfig['graphql'] {
  if (graphql?.path !== undefined && graphql.path !== '/api/graphql') {
    throw new TypeError(
      'TanStack route generation only supports graphql.path "/api/graphql"',
    )
  }
  if (graphql?.apolloConfig !== undefined) {
    throw new TypeError(
      'graphql.apolloConfig is not supported by the GraphQL Yoga runtime',
    )
  }
  if (graphql?.queryLimits !== undefined) {
    throw new TypeError(
      'graphql.queryLimits is not supported; configure an explicit Yoga validation policy instead',
    )
  }
  return {
    ...graphql,
    path: graphql?.path ?? '/api/graphql',
    playground: graphql?.playground ?? process.env.NODE_ENV !== 'production',
    schemaPath: graphql?.schemaPath ?? 'schema.graphql',
    extendGraphqlSchema: graphql?.extendGraphqlSchema ?? identity,
  }
}

function normalizeServerConfig(
  server: CmsServerConfig | undefined,
): NormalizedCmsConfig['server'] {
  if (
    server?.extendExpressApp !== undefined &&
    server.extendExpressApp !== noop
  ) {
    throw new TypeError(
      'server.extendExpressApp is not supported by the Fetch/Nitro runtime',
    )
  }
  if (
    server?.extendHttpServer !== undefined &&
    server.extendHttpServer !== noop
  ) {
    throw new TypeError(
      'server.extendHttpServer is not supported by the Fetch/Nitro runtime',
    )
  }
  if (
    typeof server?.healthCheck === 'object' &&
    server.healthCheck.path !== undefined &&
    server.healthCheck.path !== '/api/health'
  ) {
    throw new TypeError(
      'TanStack route generation only supports server.healthCheck.path "/api/health"',
    )
  }
  if (
    server?.maxFileSize !== undefined &&
    (!Number.isSafeInteger(server.maxFileSize) || server.maxFileSize <= 0)
  ) {
    throw new TypeError('server.maxFileSize must be a positive safe integer')
  }
  const cors =
    server?.cors === true
      ? { origin: true, credentials: true }
      : server?.cors === false
        ? null
        : (server?.cors ?? null)

  return {
    ...server,
    port: server?.port ?? 3000,
    cors,
    maxFileSize: server?.maxFileSize ?? 200 * 1024 * 1024,
    extendExpressApp: server?.extendExpressApp ?? noop,
    extendHttpServer: server?.extendHttpServer ?? noop,
  }
}

function normalizeUiConfig(
  ui: CmsUiConfig | undefined,
): NormalizedCmsConfig['ui'] {
  if (
    ui?.getAdditionalFiles !== undefined &&
    ui.getAdditionalFiles !== emptyArray
  ) {
    throw new TypeError(
      'ui.getAdditionalFiles is not supported by the Vite dashboard build',
    )
  }
  if (ui?.pageMiddleware !== undefined && ui.pageMiddleware !== noop) {
    throw new TypeError(
      'ui.pageMiddleware is not supported by the TanStack Router dashboard',
    )
  }
  if (ui?.publicPages !== undefined && ui.publicPages.length > 0) {
    throw new TypeError(
      'ui.publicPages is not supported by the TanStack Router dashboard',
    )
  }
  return {
    ...ui,
    basePath: typeof ui?.basePath === 'string' ? ui.basePath : '',
    isAccessAllowed: ui?.isAccessAllowed ?? defaultUiAccessAllowed,
    isDisabled: ui?.isDisabled ?? false,
    getAdditionalFiles: ui?.getAdditionalFiles ?? emptyArray,
    pageMiddleware: ui?.pageMiddleware ?? noop,
    publicPages: Array.isArray(ui?.publicPages) ? ui.publicPages : [],
  }
}

export function normalizeCmsConfig(cmsConfig: CmsConfig): NormalizedCmsConfig {
  return {
    ...cmsConfig,
    db: normalizeDbConfig(cmsConfig.db),
    graphql: normalizeGraphqlConfig(cmsConfig.graphql),
    server: normalizeServerConfig(cmsConfig.server),
    ui: normalizeUiConfig(cmsConfig.ui),
  }
}

export function config(cmsConfig: CmsConfig) {
  return normalizeCmsConfig(cmsConfig)
}

export function list(listConfig: CmsListConfig) {
  return { ...listConfig }
}

let groupIndex = 0

export function group(groupConfig: FieldGroupConfig): FieldGroupConfig
export function group(
  groupConfig: KeystoneFieldGroupConfig,
): Record<string, CmsFieldConfig | CmsFieldGroupSentinel>
export function group(
  groupConfig: FieldGroupConfig | KeystoneFieldGroupConfig,
): FieldGroupConfig | Record<string, CmsFieldConfig | CmsFieldGroupSentinel> {
  if (Array.isArray(groupConfig.fields)) return groupConfig as FieldGroupConfig

  const keys = Object.keys(groupConfig.fields)
  if (keys.some((key) => key.startsWith('__group'))) {
    throw new Error('groups cannot be nested')
  }

  return {
    [`__group${groupIndex++}`]: {
      fields: keys,
      label: groupConfig.label,
      description: groupConfig.description ?? '',
      ui: groupConfig.ui,
    } satisfies CmsFieldGroupSentinel,
    ...groupConfig.fields,
  }
}

function labelFromKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase())
}

function defaultPath(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
}

function defaultPlural(label: string) {
  return pluralizeLabel(label)
}

function getListGraphqlEnablement(
  omit:
    | boolean
    | { query?: boolean; create?: boolean; update?: boolean; delete?: boolean }
    | undefined,
  defaults?: {
    filter?: CmsListFilterabilityControl
    orderBy?: CmsListOrderabilityControl
  },
) {
  const defaultFilter = defaults?.filter ?? true
  const defaultOrderBy = defaults?.orderBy ?? true
  if (omit === undefined) {
    return {
      type: true,
      query: true,
      create: true,
      update: true,
      delete: true,
      filter: defaultFilter,
      orderBy: defaultOrderBy,
    }
  }
  if (typeof omit === 'boolean') {
    const enabled = !omit
    return {
      type: enabled,
      query: enabled,
      create: enabled,
      update: enabled,
      delete: enabled,
      filter: enabled ? defaultFilter : false,
      orderBy: enabled ? defaultOrderBy : false,
    }
  }
  return {
    type: true,
    query: !omit.query,
    create: !omit.create,
    update: !omit.update,
    delete: !omit.delete,
    filter: defaultFilter,
    orderBy: defaultOrderBy,
  }
}

function getFieldGraphqlEnablement(
  field: CmsFieldConfig,
  listEnablement: ReturnType<typeof getListGraphqlEnablement>,
) {
  const omit = field.graphql?.omit
  const supportsFiltering = ![
    'document',
    'image',
    'file',
    'json',
    'multiselect',
  ].includes(field.kind)
  const supportsOrdering = ![
    'document',
    'json',
    'image',
    'file',
    'relationship',
    'password',
    'multiselect',
  ].includes(field.kind)
  const filterEnabled =
    field.isFilterable === false
      ? false
      : supportsFiltering && listEnablement.filter
  const orderEnabled =
    field.isOrderable === false
      ? false
      : supportsOrdering && listEnablement.orderBy

  if (typeof omit === 'boolean') {
    const enabled = !omit
    return {
      type: enabled,
      read: enabled,
      create: enabled,
      update: enabled,
      filter: enabled ? filterEnabled : false,
      orderBy: enabled ? orderEnabled : false,
    }
  }

  const read = !omit?.read
  return {
    type: true,
    read,
    create: !omit?.create,
    update: !omit?.update,
    filter: read ? filterEnabled : false,
    orderBy: read ? orderEnabled : false,
  }
}

function getFieldGraphqlNonNull(field: CmsFieldConfig) {
  const configuredNonNull = field.graphql?.isNonNull
  const read = configuredNonNull?.read === true
  const create =
    configuredNonNull?.create !== undefined
      ? configuredNonNull.create === true
      : field.validation?.isRequired === true || field.isNonNull?.[0] === true
  const update =
    configuredNonNull?.update !== undefined
      ? configuredNonNull.update === true
      : field.isNonNull?.[1] === true
  return {
    read,
    create,
    update,
  }
}

function idField(
  kind: CmsDbConfig['idField'] = { kind: 'cuid' },
  listEnablement = getListGraphqlEnablement(undefined),
): CmsField {
  return {
    path: 'id',
    kind: 'id',
    label: 'ID',
    fieldMeta: { idFieldKind: kind.kind ?? 'cuid' },
    createView: { fieldMode: 'hidden' },
    listView: { fieldMode: 'read' },
    itemView: { fieldMode: 'read' },
    graphql: {
      isEnabled: {
        type: listEnablement.type,
        read: listEnablement.query,
        create: false,
        update: false,
        filter: listEnablement.filter,
        orderBy: listEnablement.orderBy,
      },
      isNonNull: {
        read: true,
        create: false,
        update: false,
      },
    },
  }
}

export function normaliseField(
  path: string,
  fieldConfig: CmsFieldConfig,
  listEnablement = getListGraphqlEnablement(undefined),
): CmsField {
  return {
    path,
    label: labelFromKey(path),
    ...fieldConfig,
    graphql: {
      ...(fieldConfig.graphql ?? {}),
      isEnabled: getFieldGraphqlEnablement(fieldConfig, listEnablement),
      isNonNull: getFieldGraphqlNonNull(fieldConfig),
    },
  }
}

function groupMetadata(fieldConfig: CmsFieldConfig) {
  const fieldGroup = fieldConfig.fieldMeta?.group
  return fieldGroup &&
    typeof fieldGroup === 'object' &&
    !Array.isArray(fieldGroup)
    ? (fieldGroup as { label?: unknown; description?: unknown })
    : undefined
}

function normaliseInitialSort(value: CmsListConfig['initialSort']) {
  if (!value) return undefined
  return value
}

function normaliseInitialFilter(value: CmsListConfig['initialFilter']) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value
}

function defaultInitialSearchFields(fields: CmsField[], labelField: string) {
  const searchableFieldPaths = fields
    .filter((field) => field.path !== 'id')
    .filter((field) => field.graphql?.isEnabled?.read !== false)
    .filter((field) => (field.graphql?.isEnabled?.filter ?? true) === true)
    .filter((field) => field.kind === 'text' || field.kind === 'select')
    .map((field) => field.path)

  const ordered = Array.from(
    new Set([
      ...(searchableFieldPaths.includes(labelField) ? [labelField] : []),
      ...searchableFieldPaths.filter((fieldPath) => fieldPath !== labelField),
    ]),
  )

  return ordered
}

function isGroupSentinel(value: unknown): value is CmsFieldGroupSentinel {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as CmsFieldGroupSentinel).label === 'string' &&
    Array.isArray((value as CmsFieldGroupSentinel).fields),
  )
}

function extractConfiguredFieldsAndGroups(
  fields: Record<string, CmsFieldConfig | CmsFieldGroupSentinel>,
  listKey: string,
) {
  const configuredFieldEntries: Array<[string, CmsFieldConfig]> = []
  const sentinelGroups: CmsFieldGroup[] = []

  for (const [fieldKey, fieldConfig] of Object.entries(fields)) {
    if (!fieldKey.startsWith('__group')) {
      configuredFieldEntries.push([fieldKey, fieldConfig as CmsFieldConfig])
      continue
    }

    if (!isGroupSentinel(fieldConfig)) {
      throw new Error(`Invalid group metadata entry "${listKey}.${fieldKey}"`)
    }

    sentinelGroups.push({
      label: fieldConfig.label,
      description: fieldConfig.description || undefined,
      fields: [...fieldConfig.fields],
      ui: fieldConfig.ui,
    })
  }

  const fieldKeys = new Set(
    configuredFieldEntries.map(([fieldKey]) => fieldKey),
  )
  for (const groupEntry of sentinelGroups) {
    for (const fieldKey of groupEntry.fields) {
      if (!fieldKeys.has(fieldKey)) {
        throw new Error(
          `Group "${groupEntry.label}" on "${listKey}" references unknown field "${fieldKey}"`,
        )
      }
    }
  }

  return { configuredFieldEntries, sentinelGroups }
}

function normaliseGroups(
  groups: FieldGroupConfig[] | undefined,
  fields: Array<[string, CmsFieldConfig]>,
  sentinelGroups: CmsFieldGroup[],
): CmsFieldGroup[] | undefined {
  const normalisedGroups: CmsFieldGroup[] = groups
    ? groups.map((fieldGroup) => ({
        label: fieldGroup.label,
        description: fieldGroup.description,
        fields: fieldGroup.fields,
        ui: fieldGroup.ui,
      }))
    : []

  for (const sentinelGroup of sentinelGroups) {
    normalisedGroups.push({
      label: sentinelGroup.label,
      description: sentinelGroup.description,
      fields: [...sentinelGroup.fields],
      ui: sentinelGroup.ui,
    })
  }

  for (const [fieldKey, fieldConfig] of fields) {
    const fieldGroup = groupMetadata(fieldConfig)
    if (typeof fieldGroup?.label !== 'string') continue
    const existing = normalisedGroups.find(
      (entry) => entry.label === fieldGroup.label,
    )
    if (existing) {
      if (!existing.fields.includes(fieldKey)) existing.fields.push(fieldKey)
      continue
    }
    normalisedGroups.push({
      label: fieldGroup.label,
      description:
        typeof fieldGroup.description === 'string'
          ? fieldGroup.description
          : undefined,
      fields: [fieldKey],
    })
  }

  return normalisedGroups.length ? normalisedGroups : undefined
}

function resolveRelationshipMetadata(
  field: CmsField,
  currentList: CmsList,
  lists: CmsList[],
): CmsResolvedRelationshipMetadata | undefined {
  if (field.kind !== 'relationship' || typeof field.ref !== 'string')
    return undefined

  const [refListKey, refFieldKey] = field.ref.split('.')
  if (!refListKey)
    throw new Error(
      `${currentList.key}.${field.path} has an invalid relationship ref: ${JSON.stringify(field.ref)}`,
    )
  const refList = lists.find((entry) => entry.key === refListKey)
  if (!refList)
    throw new Error(
      `${currentList.key}.${field.path} points to missing related list ${refListKey}`,
    )
  if (refList.isSingleton)
    throw new Error(
      `${currentList.key}.${field.path} points to a singleton list, ${refListKey}, which is not allowed`,
    )
  const oppositeField = refFieldKey
    ? refList.fields.find((candidate) => candidate.path === refFieldKey)
    : undefined
  if (!refFieldKey) {
    const syntheticOppositeFieldPath = `from_${currentList.key}_${field.path}`
    if (
      refList.fields.some(
        (candidate) => candidate.path === syntheticOppositeFieldPath,
      )
    ) {
      throw new Error(
        `${currentList.key}.${field.path} points to the list ${refListKey}, Keystone needs to a create a relationship field at ${refListKey}.${syntheticOppositeFieldPath} to support the relationship at ${currentList.key}.${field.path} but ${refListKey} already has a field named ${syntheticOppositeFieldPath}`,
      )
    }
  }
  if (refFieldKey && !oppositeField)
    throw new Error(
      `${currentList.key}.${field.path} points to missing opposite field ${refListKey}.${refFieldKey}`,
    )
  if (oppositeField && oppositeField.kind !== 'relationship')
    throw new Error(
      `${currentList.key}.${field.path} points to ${refListKey}.${refFieldKey}, but that field is not a relationship`,
    )
  const expectedOppositeRef =
    refListKey === currentList.key
      ? `${currentList.key}.${field.path}`
      : `${currentList.key}.${field.path}`
  if (
    oppositeField?.kind === 'relationship' &&
    oppositeField.ref !== expectedOppositeRef
  ) {
    throw new Error(
      `${currentList.key}.${field.path} points to ${refListKey}.${refFieldKey}, but ${refListKey}.${refFieldKey} points to ${JSON.stringify(oppositeField.ref)} instead of ${JSON.stringify(expectedOppositeRef)}`,
    )
  }
  const many = field.many === true
  if (!many && field.db?.relationName) {
    throw new Error(
      `${currentList.key}.${field.path} uses db.relationName, but relationName is only supported on many relationships`,
    )
  }
  if (many && field.db?.foreignKey) {
    throw new Error(
      `${currentList.key}.${field.path} uses db.foreignKey, but foreignKey mapping is only supported for owned single relationships`,
    )
  }
  const oppositeMany =
    oppositeField?.kind === 'relationship'
      ? oppositeField.many === true
      : undefined
  if (
    !many &&
    oppositeMany === false &&
    field.db?.foreignKey &&
    oppositeField?.kind === 'relationship' &&
    oppositeField.db?.foreignKey
  ) {
    throw new Error(
      `You can only set db.foreignKey on one side of a one to one relationship, but foreignKey is set on both ${currentList.key}.${field.path} and ${refListKey}.${refFieldKey}`,
    )
  }
  if (field.db?.relationName && many && oppositeMany === false) {
    throw new Error(
      `You can only set db.relationName on one side of a many to many relationship, but db.relationName is set on ${currentList.key}.${field.path} which is the many side of a many to one relationship with ${refListKey}.${refFieldKey}`,
    )
  }
  if (
    many &&
    oppositeMany === true &&
    field.db?.relationName &&
    oppositeField?.kind === 'relationship' &&
    oppositeField.db?.relationName &&
    oppositeField.db.relationName !== field.db.relationName
  ) {
    throw new Error(
      `You can only set db.relationName on one side of a many to many relationship, but db.relationName is set on both ${currentList.key}.${field.path} and ${refListKey}.${refFieldKey}`,
    )
  }
  const oppositeExists = Boolean(oppositeField)
  const isSelfReferential = refListKey === currentList.key
  const explicitRelationName =
    field.db?.relationName ?? oppositeField?.db?.relationName
  const currentEndpoint = `${currentList.key}.${field.path}`
  const oppositeEndpoint = `${refListKey}.${refFieldKey ?? `from_${currentList.key}_${field.path}`}`
  const inferredRelationEndpoint = !oppositeExists
    ? currentEndpoint
    : !many && oppositeMany !== false
      ? currentEndpoint
      : many && oppositeMany === false
        ? oppositeEndpoint
        : !many && oppositeMany === false
          ? field.db?.foreignKey
            ? currentEndpoint
            : oppositeField?.db?.foreignKey
              ? oppositeEndpoint
              : [currentEndpoint, oppositeEndpoint].sort()[0]
          : [currentEndpoint, oppositeEndpoint].sort()[0]
  const [relationOwnerList, relationOwnerField] =
    inferredRelationEndpoint.split('.')
  const relationName =
    explicitRelationName ?? `${relationOwnerList}_${relationOwnerField}`
  const joinTableName =
    many && (oppositeMany === true || !oppositeExists)
      ? relationName
      : undefined
  const joinTableNearForeignKey = joinTableName ? field.path : undefined
  const joinTableFarForeignKey = joinTableName
    ? refFieldKey || refList.key[0].toLowerCase() + refList.key.slice(1)
    : undefined
  const currentIdFieldKind = currentList.fields.find(
    (candidate) => candidate.path === 'id',
  )?.fieldMeta?.idFieldKind
  const relatedIdFieldKind = refList.fields.find(
    (candidate) => candidate.path === 'id',
  )?.fieldMeta?.idFieldKind
  const joinTableNearIdFieldKind = joinTableName
    ? currentIdFieldKind
    : undefined
  const joinTableFarIdFieldKind = joinTableName ? relatedIdFieldKind : undefined
  const joinTableNearReferencedFieldPath = joinTableName ? 'id' : undefined
  const joinTableFarReferencedFieldPath = joinTableName ? 'id' : undefined
  const joinTableNearReferencedDbColumnName = joinTableName ? 'id' : undefined
  const joinTableFarReferencedDbColumnName = joinTableName ? 'id' : undefined
  const refListPrismaMapping = refList.prisma?.mapping
  const foreignKeyScalarType =
    relatedIdFieldKind === 'autoincrement' ? 'Int' : 'String'
  const joinTableNearForeignKeyScalarType =
    joinTableNearIdFieldKind === 'autoincrement'
      ? 'Int'
      : joinTableName
        ? 'String'
        : undefined
  const joinTableFarForeignKeyScalarType =
    joinTableFarIdFieldKind === 'autoincrement'
      ? 'Int'
      : joinTableName
        ? 'String'
        : undefined
  const refListVisibleInPublicGraph =
    (refList.graphql?.isEnabled?.type ?? true) === true
  const oppositeFieldVisibleInPublicGraph = oppositeField
    ? (oppositeField.graphql?.isEnabled?.read ?? true) === true
    : false
  const relationKind = !oppositeExists
    ? 'many'
    : many && oppositeMany
      ? 'manyToMany'
      : many || oppositeMany
        ? 'many'
        : 'one'
  const isTwoSidedOneToOne = many === false && oppositeMany === false
  const oppositeHasForeignKey =
    oppositeField?.kind === 'relationship' &&
    oppositeField.db?.foreignKey !== undefined
  const ownership = !oppositeExists
    ? many
      ? 'inverse'
      : 'own'
    : many && oppositeMany
      ? 'shared'
      : many
        ? 'inverse'
        : isTwoSidedOneToOne
          ? oppositeHasForeignKey
            ? 'inverse'
            : currentEndpoint === inferredRelationEndpoint
              ? 'own'
              : 'inverse'
          : 'own'
  const foreignKeyFieldName =
    ownership === 'own' && !many ? `${field.path}Id` : undefined
  const configuredForeignKeyMap =
    field.db?.foreignKey && typeof field.db.foreignKey === 'object'
      ? field.db.foreignKey.map
      : undefined
  const foreignKeyMap = foreignKeyFieldName
    ? (configuredForeignKeyMap ?? field.path)
    : undefined
  const relationArgs = foreignKeyFieldName
    ? {
        relationName,
        referencesFieldPath: 'id' as const,
        onDelete: 'SetNull' as const,
        onUpdate: 'Cascade' as const,
      }
    : undefined
  const referencesFieldPath = relationArgs?.referencesFieldPath
  const referencedDbColumnName = relationArgs ? 'id' : undefined
  const onDelete = relationArgs?.onDelete
  const onUpdate = relationArgs?.onUpdate

  return {
    refListKey,
    ...(refFieldKey ? { refFieldKey } : {}),
    many,
    oppositeExists,
    ...(oppositeField?.kind === 'relationship' ? { oppositeMany } : {}),
    isSelfReferential,
    relationKind,
    ownership,
    ...(foreignKeyFieldName ? { foreignKeyFieldName } : {}),
    ...(foreignKeyMap ? { foreignKeyMap } : {}),
    ...(foreignKeyFieldName ? { foreignKeyScalarType } : {}),
    ...(referencedDbColumnName ? { referencedDbColumnName } : {}),
    ...(relationArgs ? { relationArgs } : {}),
    ...(referencesFieldPath ? { referencesFieldPath } : {}),
    ...(onDelete ? { onDelete } : {}),
    ...(onUpdate ? { onUpdate } : {}),
    ...(relatedIdFieldKind === 'cuid' ||
    relatedIdFieldKind === 'uuid' ||
    relatedIdFieldKind === 'autoincrement'
      ? { relatedIdFieldKind }
      : {}),
    ...(refListPrismaMapping ? { refListPrismaMapping } : {}),
    ...(relationName ? { relationName } : {}),
    ...(joinTableName ? { joinTableName } : {}),
    ...(joinTableNearForeignKey ? { joinTableNearForeignKey } : {}),
    ...(joinTableFarForeignKey ? { joinTableFarForeignKey } : {}),
    ...(joinTableNearReferencedFieldPath
      ? { joinTableNearReferencedFieldPath }
      : {}),
    ...(joinTableFarReferencedFieldPath
      ? { joinTableFarReferencedFieldPath }
      : {}),
    ...(joinTableNearReferencedDbColumnName
      ? { joinTableNearReferencedDbColumnName }
      : {}),
    ...(joinTableFarReferencedDbColumnName
      ? { joinTableFarReferencedDbColumnName }
      : {}),
    ...(joinTableNearForeignKeyScalarType
      ? { joinTableNearForeignKeyScalarType }
      : {}),
    ...(joinTableFarForeignKeyScalarType
      ? { joinTableFarForeignKeyScalarType }
      : {}),
    ...(joinTableNearIdFieldKind === 'cuid' ||
    joinTableNearIdFieldKind === 'uuid' ||
    joinTableNearIdFieldKind === 'autoincrement'
      ? { joinTableNearIdFieldKind }
      : {}),
    ...(joinTableFarIdFieldKind === 'cuid' ||
    joinTableFarIdFieldKind === 'uuid' ||
    joinTableFarIdFieldKind === 'autoincrement'
      ? { joinTableFarIdFieldKind }
      : {}),
    refListVisibleInPublicGraph,
    oppositeFieldVisibleInPublicGraph,
  }
}

export function normaliseList(
  key: string,
  listConfig: CmsListConfig,
  cmsConfig: CmsConfig,
): CmsList {
  if ('id' in listConfig.fields) {
    throw new Error(
      `"fields.id" is reserved by Keystone, use "db.idField" for the "${key}" list`,
    )
  }
  if (listConfig.isSingleton && listConfig.db?.idField) {
    throw new Error(
      `"db.idField" on the "${key}" list conflicts with singleton defaults`,
    )
  }

  const { configuredFieldEntries, sentinelGroups } =
    extractConfiguredFieldsAndGroups(listConfig.fields, key)
  const singular = listConfig.singular ?? labelFromKey(key)
  const plural = listConfig.plural ?? defaultPlural(singular)
  const path = listConfig.path ?? defaultPath(plural)
  const label = listConfig.label ?? plural
  const listGraphqlEnablement = getListGraphqlEnablement(
    listConfig.graphql?.omit,
    {
      filter: listConfig.graphql?.defaultIsFilterable,
      orderBy: listConfig.graphql?.defaultIsOrderable,
    },
  )
  const configuredFields = configuredFieldEntries.map(
    ([fieldPath, fieldConfig]) => {
      const normalized = normaliseField(
        fieldPath,
        fieldConfig,
        listGraphqlEnablement,
      )
      return normalized.kind === 'calendarDay' ||
        normalized.kind === 'structure'
        ? {
            ...normalized,
            fieldMeta: {
              ...(normalized.fieldMeta ?? {}),
              provider: cmsConfig.db?.provider ?? 'postgresql',
            },
          }
        : normalized
    },
  )
  const fields = [
    idField(
      listConfig.db?.idField ?? cmsConfig.db?.idField,
      listGraphqlEnablement,
    ),
    ...configuredFields,
  ]
  const uiLabelField =
    typeof listConfig.ui?.labelField === 'string' &&
    fields.some((field) => field.path === listConfig.ui?.labelField)
      ? listConfig.ui.labelField
      : undefined
  const labelField =
    listConfig.labelField ??
    uiLabelField ??
    ['label', 'name', 'title'].find((fieldPath) =>
      fields.some((field) => field.path === fieldPath),
    ) ??
    'id'
  const gqlNames = getGraphQLNames(key, plural)
  const searchableFields = Object.fromEntries(
    fields
      .filter((field) => field.path !== 'id')
      .filter((field) => field.graphql?.isEnabled?.read !== false)
      .filter((field) => (field.graphql?.isEnabled?.filter ?? true) === true)
      .filter(
        (field) =>
          field.kind === 'text' ||
          field.kind === 'select' ||
          field.kind === 'relationship',
      )
      .map((field) => [
        field.path,
        field.search === 'default'
          ? 'default'
          : field.kind === 'text'
            ? 'default'
            : null,
      ]),
  ) as Record<string, 'default' | 'insensitive' | null>
  const triviallySearchableFields = Object.entries(searchableFields)
    .filter(([, value]) => value === 'default' || value === 'insensitive')
    .map(([fieldPath]) => fieldPath)
  const resolvedDbFields = Object.fromEntries(
    fields.map((field) => [
      field.path,
      {
        kind: field.kind,
        isUnique: field.db?.isUnique === true || field.kind === 'id',
        isIndexed: field.db?.isIndexed === true,
        prismaDefault: field.db?.prismaDefault,
        relationName: field.db?.relationName,
        hasExtendPrismaSchema:
          typeof field.db?.extendPrismaSchema === 'function',
      },
    ]),
  )

  return {
    key,
    path,
    label,
    singular,
    plural,
    description: listConfig.description,
    initialColumns:
      listConfig.initialColumns ??
      listConfig.ui?.listView?.initialColumns ??
      Array.from(
        new Set([
          labelField,
          ...fields
            .filter((field) => field.path !== 'id')
            .map((field) => field.path),
        ]),
      ).slice(0, 3),
    initialSearchFields:
      listConfig.initialSearchFields ??
      defaultInitialSearchFields(fields, labelField),
    initialSort: normaliseInitialSort(listConfig.initialSort),
    initialFilter: normaliseInitialFilter(listConfig.initialFilter),
    pageSize: listConfig.pageSize ?? 50,
    labelField,
    isSingleton: listConfig.isSingleton,
    isHidden:
      listConfig.isHidden ??
      (typeof listConfig.ui?.hideNavigation === 'boolean'
        ? listConfig.ui.hideNavigation
        : false),
    hideNavigation:
      listConfig.ui?.hideNavigation ?? listConfig.isHidden ?? false,
    hideCreate: listConfig.hideCreate ?? listConfig.ui?.hideCreate,
    hideDelete: listConfig.hideDelete ?? listConfig.ui?.hideDelete,
    ui: {
      ...(listConfig.ui ?? {}),
      labelField,
      labels: {
        label,
        singular,
        plural,
        path,
      },
      searchableFields,
      triviallySearchableFields,
    },
    graphql: {
      ...(listConfig.graphql ?? {}),
      maxTake: listConfig.graphql?.maxTake ?? cmsConfig.graphql?.maxTake,
      isEnabled: listGraphqlEnablement,
      names: gqlNames,
    },
    db: { ...(listConfig.db ?? {}) },
    prisma: {
      types: gqlNames,
      listKey: key[0].toLowerCase() + key.slice(1),
      mapping: listConfig.db?.map,
      extendPrismaSchema: listConfig.db?.extendPrismaSchema,
    },
    resolvedDbFields,
    cacheHint: listConfig.graphql?.cacheHint,
    access: listConfig.access,
    actions: listConfig.actions,
    hooks: listConfig.hooks,
    fields,
    groups: normaliseGroups(
      listConfig.groups,
      configuredFieldEntries,
      sentinelGroups,
    ),
  }
}

function validateDocumentComponentSchema(
  value: unknown,
  listKeys: Set<string>,
  path: string,
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Component schema at "${path}" must be an object`)
  }
  const schema = value as Record<string, unknown>
  const kind = typeof schema.kind === 'string' ? schema.kind : ''
  if (!kind) {
    throw new Error(`Component schema at "${path}" must include a kind`)
  }
  if (kind === 'form' || kind === 'child') {
    return
  }
  if (kind === 'relationship') {
    const listKey = typeof schema.listKey === 'string' ? schema.listKey : ''
    if (!listKey || !listKeys.has(listKey)) {
      throw new Error(
        `The relationship field at "${path}" has the listKey "${listKey}" but no list named "${listKey}" exists.`,
      )
    }
    return
  }
  if (kind === 'array') {
    validateDocumentComponentSchema(schema.element, listKeys, `${path}.array`)
    return
  }
  if (kind === 'object') {
    const fields = schema.fields
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      throw new Error(
        `Component schema at "${path}" object fields must be an object`,
      )
    }
    for (const [key, inner] of Object.entries(
      fields as Record<string, unknown>,
    )) {
      validateDocumentComponentSchema(inner, listKeys, `${path}.${key}`)
    }
    return
  }
  if (kind === 'conditional') {
    const values = schema.values
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      throw new Error(
        `Component schema at "${path}" conditional values must be an object`,
      )
    }
    for (const [key, inner] of Object.entries(
      values as Record<string, unknown>,
    )) {
      validateDocumentComponentSchema(inner, listKeys, `${path}.${key}`)
    }
    return
  }
  throw new Error(
    `Component schema at "${path}" has unsupported kind "${kind}"`,
  )
}

function validateFieldStorageMetadata(lists: CmsList[], cmsConfig: CmsConfig) {
  const storageKeys = new Set(Object.keys(cmsConfig.storage ?? {}))
  for (const entry of lists) {
    for (const field of entry.fields) {
      if (field.kind !== 'image' && field.kind !== 'file') continue
      const storageKey =
        typeof field.fieldMeta?.storage === 'string'
          ? field.fieldMeta.storage
          : ''
      if (!storageKey || !storageKeys.has(storageKey)) {
        throw new Error(
          `${entry.key}.${field.path} has storage set to "${storageKey}" but no storage configuration named "${storageKey}" exists.`,
        )
      }
    }
  }
}

function normalizeDocumentRelationshipMetadata(lists: CmsList[]) {
  const listKeys = new Set(lists.map((entry) => entry.key))
  for (const entry of lists) {
    for (const field of entry.fields) {
      if (field.kind !== 'document') continue
      const relationships = field.fieldMeta?.relationships
      if (
        relationships &&
        typeof relationships === 'object' &&
        !Array.isArray(relationships)
      ) {
        for (const [key, value] of Object.entries(relationships)) {
          if (!value || typeof value !== 'object' || Array.isArray(value))
            continue
          const relationship = value as Record<string, unknown>
          const listKey =
            typeof relationship.listKey === 'string' ? relationship.listKey : ''
          if (!listKey || !listKeys.has(listKey)) {
            throw new Error(
              `An inline relationship ${String(relationship.label ?? key)} (${key}) in the field at ${entry.key}.${field.path} has listKey set to "${listKey}" but no list named "${listKey}" exists.`,
            )
          }
        }
      }
      const componentBlocks = field.fieldMeta?.componentBlocks
      if (
        componentBlocks &&
        typeof componentBlocks === 'object' &&
        !Array.isArray(componentBlocks)
      ) {
        for (const [key, value] of Object.entries(componentBlocks)) {
          if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new Error(
              `Component block ${key} in ${entry.key}.${field.path} must be an object`,
            )
          }
          const block = value as Record<string, unknown>
          const schema = block.schema
          if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
            throw new Error(
              `Component block ${key} in ${entry.key}.${field.path} must include an object schema`,
            )
          }
          validateDocumentComponentSchema(
            { kind: 'object', fields: schema },
            listKeys,
            key,
          )
        }
      }
    }
  }
}

export function initialiseLists(cmsConfig: CmsConfig) {
  const normalizedConfig = normalizeCmsConfig(cmsConfig)
  const lists = Object.entries(normalizedConfig.lists).map(
    ([key, listConfig]) => normaliseList(key, listConfig, normalizedConfig),
  )
  const configuredOrder = normalizedConfig.db?.prismaModelOrder
  validateFieldStorageMetadata(lists, normalizedConfig)
  normalizeDocumentRelationshipMetadata(lists)
  const listKeys = new Set(lists.map((entry) => entry.key))
  for (const listEntry of lists) {
    for (const field of listEntry.fields) {
      if (field.kind !== 'structure') continue
      const schema = field.fieldMeta?.structureSchema as
        | StructureSchema
        | undefined
      if (!schema)
        throw new Error(
          `${listEntry.key}.${field.path}: structure requires a schema`,
        )
      try {
        validateStructureSchema(schema, listKeys)
      } catch (error) {
        throw new Error(
          `${listEntry.key}.${field.path}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  const orderedLists = configuredOrder?.length
    ? (() => {
        const byKey = new Map(
          lists.map((listEntry) => [listEntry.key, listEntry]),
        )
        const ordered = configuredOrder.flatMap((key) => {
          const listEntry = byKey.get(key)
          return listEntry ? [listEntry] : []
        })
        const remaining = lists.filter(
          (listEntry) => !configuredOrder.includes(listEntry.key),
        )
        return [...ordered, ...remaining]
      })()
    : lists

  for (const listEntry of orderedLists) {
    for (const field of listEntry.fields) {
      const resolved = listEntry.resolvedDbFields?.[field.path]
      if (!resolved) continue
      const relationship = resolveRelationshipMetadata(
        field,
        listEntry,
        orderedLists,
      )
      if (relationship) {
        resolved.relationship = relationship
      }
    }
  }

  return orderedLists
}
