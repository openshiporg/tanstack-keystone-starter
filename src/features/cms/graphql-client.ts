import { cache } from 'react'

import {
  officialFilterParamsFromSearch,
  parseOfficialFilterParam,
} from '@/components/dashboard/filter-param-compat'
import {
  buildGraphQLMultipartFormData,
  hasGraphQLFileUpload,
} from './graphql-upload-client'
import { adminMetaGraphQLQuery } from './admin-meta-query'
import { filterTypesForField as sharedFilterTypesForField } from './dashboard-filter-types'
import { getGraphQLNames } from './gql-names'
import type {
  AdminMeta,
  AdminMetaField,
  AdminMetaList,
  FieldOption,
  GraphQLNames,
} from './types'

export type DashboardGraphQLError = {
  message: string
  path?: Array<string | number>
  extensions?: Record<string, unknown>
}

type GraphQLResponse<TData> = {
  data?: TData
  errors?: DashboardGraphQLError[]
}

export function dashboardGraphQLErrorMessage(error: DashboardGraphQLError) {
  const originalError = error.extensions?.originalError
  const originalMessage =
    originalError &&
    typeof originalError === 'object' &&
    !Array.isArray(originalError) &&
    typeof (originalError as { message?: unknown }).message === 'string'
      ? (originalError as { message: string }).message.trim()
      : ''
  const path = error.path?.length ? ` (${error.path.join('.')})` : ''
  return `${error.message}${originalMessage ? ` ${originalMessage}` : ''}${path}`
}

export type KeystoneAdminMetaGraphQLData = {
  keystone: {
    adminMeta: AdminMeta
  }
}

export type DashboardField = AdminMetaField & {
  kind: string
  options?: FieldOption[]
  defaultValue?: unknown
  graphql?: {
    isNonNull?: Array<'read' | 'create' | 'update'>
  }
}

export type DashboardList = Omit<AdminMetaList, 'fields' | 'description'> & {
  description: string
  fields: DashboardField[]
  fieldMap: Record<string, DashboardField>
}

export type DashboardListSummary = DashboardList & {
  count: number
  singletonItemId?: string | null
}

export type DashboardListItem = Record<string, unknown> & { id: string }

export type DashboardListPageData = {
  list: DashboardList
  items: DashboardListItem[]
  count: number
  page: number
  pageSize: number
  selectedFields: DashboardField[]
  selectedFieldPaths: string[]
  sortBy: string
}

export type DashboardItemFieldMeta = {
  isNonNull: Array<'read' | 'create' | 'update'>
  fieldMeta: Record<string, unknown> | null
  createView?: {
    fieldMode: 'edit' | 'read' | 'hidden'
    fieldPosition: 'form' | 'sidebar'
    isRequired?: boolean
  }
  itemView?: {
    fieldMode: 'edit' | 'read' | 'hidden'
    fieldPosition: 'form' | 'sidebar'
    isRequired?: boolean
  }
}

export type DashboardItemActionMeta = {
  actionMode: 'enabled' | 'disabled' | 'hidden'
  navigation: 'follow' | 'refetch' | 'return'
  hidePrompt: boolean
  hideToast: boolean
}

export type DashboardItemPageData = {
  list: DashboardList
  item: DashboardListItem
  selectedFields: DashboardField[]
  fieldMetaByPath: Record<string, DashboardItemFieldMeta>
  actionMetaByKey: Record<string, DashboardItemActionMeta>
  title: string
}

export type DashboardCreatePageData = {
  list: DashboardList
  selectedFields: DashboardField[]
  fieldMetaByPath: Record<string, DashboardItemFieldMeta>
}

export type DashboardRelationshipOption = {
  id: string
  label: string
  data?: Record<string, unknown>
}

export type DashboardRelationshipOptionConfig = {
  labelField?: string
  searchFields?: string[]
  extraSelection?: string[]
}

export type DashboardRelationshipOptionsResult = {
  items: DashboardRelationshipOption[]
  count: number
}

export type DashboardAuthUser = Record<string, unknown> & {
  id: string
  listPath: string
  label?: string | null
  identity?: string | null
  name?: string | null
  email?: string | null
}

export type DashboardAuthState = {
  authenticatedItem: DashboardAuthUser | null
  redirectToInit: boolean
}

export type DashboardGraphQLOptions = {
  endpoint?: string
  fetcher?: typeof fetch
  headers?: HeadersInit
}

export const dashboardQueryKeys = {
  adminMeta: ['dashboard', 'adminMeta'] as const,
  overview: ['dashboard', 'overview'] as const,
  listPage: (listPath: string, searchState: Record<string, unknown>) =>
    [
      'dashboard',
      'listPage',
      listPath,
      stableSearchState(searchState),
    ] as const,
  itemPage: (listPath: string, id: string) =>
    ['dashboard', 'itemPage', listPath, id] as const,
  createPage: (listPath: string) =>
    ['dashboard', 'createPage', listPath] as const,
  relationshipOptions: (
    listKey: string,
    search: string,
    take = 20,
    skip = 0,
    config?: DashboardRelationshipOptionConfig,
  ) =>
    [
      'dashboard',
      'relationshipOptions',
      listKey,
      search,
      take,
      skip,
      stableSearchState({
        labelField: config?.labelField ?? '',
        searchFields: (config?.searchFields ?? []).join(','),
        extraSelection: (config?.extraSelection ?? []).join(','),
      }),
    ] as const,
}

function stableSearchState(searchState: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(searchState).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  )
}

export async function executeRawDashboardGraphQL<TData>(
  query: string,
  variables?: Record<string, unknown>,
  {
    endpoint = '/api/graphql',
    fetcher = fetch,
    headers,
  }: DashboardGraphQLOptions = {},
): Promise<GraphQLResponse<TData>> {
  if (typeof window === 'undefined') {
    const { executeDashboardGraphQLInProcessRaw } =
      await import('./dashboard-server')
    return executeDashboardGraphQLInProcessRaw<TData>(query, variables, headers)
  }

  const headerEntries = Object.fromEntries(new Headers(headers))
  const multipart = hasGraphQLFileUpload(variables)
  const response = await fetcher(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: multipart
      ? headerEntries
      : { 'Content-Type': 'application/json', ...headerEntries },
    body: multipart
      ? buildGraphQLMultipartFormData(query, variables)
      : JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch GraphQL from ${endpoint}: ${response.status}`,
    )
  }

  return (await response.json()) as GraphQLResponse<TData>
}

export async function executeDashboardGraphQL<TData>(
  query: string,
  variables?: Record<string, unknown>,
  options: DashboardGraphQLOptions = {},
) {
  const result = await executeRawDashboardGraphQL<TData>(
    query,
    variables,
    options,
  )

  if (result.errors?.length) {
    throw new Error(result.errors.map(dashboardGraphQLErrorMessage).join('\n'))
  }

  if (!result.data) {
    throw new Error('GraphQL response did not include data')
  }

  return result.data
}

function normalizeGraphQLNames(
  list: Partial<AdminMetaList> & Pick<AdminMetaList, 'key' | 'plural'>,
): GraphQLNames {
  return (
    list.graphql?.names ??
    list.gqlNames ??
    getGraphQLNames(list.key, list.plural)
  )
}

function normalizeAdminMeta(adminMeta: AdminMeta): {
  lists: DashboardList[]
  auth: AdminMeta['auth']
} {
  return {
    auth: adminMeta.auth ?? null,
    lists: adminMeta.lists.map((list): DashboardList => {
      const gqlNames = normalizeGraphQLNames(list)
      const fields = list.fields.map((field) => {
        const createView = field.createView as unknown as {
          fieldPosition?: 'form' | 'sidebar'
          isRequired?: boolean
        }
        const itemView = field.itemView as unknown as {
          fieldPosition?: 'form' | 'sidebar'
          isRequired?: boolean
        }
        const listView = field.listView as unknown as {
          fieldPosition?: 'form' | 'sidebar'
        }
        const key = field.key
        return {
          ...field,
          key,
          path: field.path,
          kind: String(field.fieldMeta.kind || field.viewsIndex),
          options: Array.isArray(field.fieldMeta.options)
            ? (field.fieldMeta.options as FieldOption[])
            : undefined,
          defaultValue: field.fieldMeta.defaultValue,
          graphql: { isNonNull: [...(field.isNonNull ?? [])] },
          createView: {
            ...field.createView,
            fieldPosition: createView.fieldPosition ?? 'form',
            isRequired: createView.isRequired ?? false,
          },
          itemView: {
            ...field.itemView,
            fieldPosition: itemView.fieldPosition ?? 'form',
            isRequired: itemView.isRequired ?? false,
          },
          listView: {
            ...field.listView,
            fieldPosition: listView.fieldPosition ?? 'form',
          },
        }
      })
      return {
        ...list,
        description: list.description || '',
        gqlNames,
        graphql: { names: gqlNames },
        fields,
        fieldMap: Object.fromEntries(
          fields.map((field) => [field.path, field]),
        ),
      }
    }),
  }
}

const fetchKeystoneAdminMetaCached = cache(async () => {
  const result = await executeDashboardGraphQL<KeystoneAdminMetaGraphQLData>(
    adminMetaGraphQLQuery,
  )
  return normalizeAdminMeta(result.keystone.adminMeta)
})

export async function fetchKeystoneAdminMeta(
  options: DashboardGraphQLOptions = {},
) {
  if (!options.endpoint && !options.fetcher && !options.headers)
    return fetchKeystoneAdminMetaCached()
  const result = await executeDashboardGraphQL<KeystoneAdminMetaGraphQLData>(
    adminMetaGraphQLQuery,
    undefined,
    options,
  )
  return normalizeAdminMeta(result.keystone.adminMeta)
}

export type DashboardPasswordAuthMeta = Pick<
  NonNullable<AdminMeta['auth']>,
  'listKey' | 'identityField' | 'secretField' | 'initFirstItemFields'
>

function assertGraphQLName(value: string, description: string) {
  if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(value)) {
    throw new Error(`Invalid ${description} GraphQL name: ${value}`)
  }
  return value
}

export function buildDashboardPasswordAuthContract(
  auth: DashboardPasswordAuthMeta,
) {
  const listKey = assertGraphQLName(auth.listKey, 'auth list')
  const identityField = assertGraphQLName(
    auth.identityField,
    'auth identity field',
  )
  const secretField = assertGraphQLName(auth.secretField, 'auth secret field')
  const initFirstItemFields = auth.initFirstItemFields.map((field) =>
    assertGraphQLName(field, 'initial auth field'),
  )
  return {
    listKey,
    identityField,
    secretField,
    initFirstItemFields,
    authenticateMutationName: `authenticate${listKey}WithPassword`,
    authenticationSuccessType: `${listKey}AuthenticationWithPasswordSuccess`,
    authenticationFailureType: `${listKey}AuthenticationWithPasswordFailure`,
    createInitialInputName: `CreateInitial${listKey}Input`,
    createInitialMutationName: `createInitial${listKey}`,
  }
}

export function buildDashboardPublicAuthOperations(
  auth: DashboardPasswordAuthMeta,
) {
  const contract = buildDashboardPasswordAuthContract(auth)
  const gqlNames = getGraphQLNames(contract.listKey)
  return {
    ...contract,
    createInputName: gqlNames.createInputName,
    createMutationName: gqlNames.createMutationName,
    sendPasswordResetMutationName: `send${contract.listKey}PasswordResetLink`,
    redeemPasswordResetMutationName: `redeem${contract.listKey}PasswordResetToken`,
  }
}

export async function fetchDashboardPublicAuthMeta(
  options: DashboardGraphQLOptions = {},
) {
  const result = await executeDashboardGraphQL<{
    keystone: { auth: DashboardPasswordAuthMeta | null }
  }>(
    `query DashboardPublicAuthMeta {
      keystone {
        auth {
          listKey
          identityField
          secretField
          initFirstItemFields
        }
      }
    }`,
    undefined,
    options,
  )
  return result.keystone.auth
}

export function buildDashboardAuthQuery(adminMeta: {
  auth?: AdminMeta['auth']
  lists: Array<
    Pick<DashboardList, 'key' | 'path' | 'labelField'> & {
      fields: Array<Pick<DashboardField, 'path'>>
    }
  >
}) {
  const auth = adminMeta.auth
  if (!auth) return null
  if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(auth.listKey))
    throw new Error(`Invalid auth list GraphQL name: ${auth.listKey}`)
  const authList = adminMeta.lists.find((list) => list.key === auth.listKey)
  if (!authList)
    throw new Error(`Auth list not found in admin metadata: ${auth.listKey}`)
  const fieldPaths = new Set(authList.fields.map((field) => field.path))
  const labelField = fieldPaths.has(authList.labelField)
    ? authList.labelField
    : 'id'
  const identityField = fieldPaths.has(auth.identityField)
    ? auth.identityField
    : 'id'
  return {
    listPath: authList.path,
    query: `query DashboardClientAuthState {
      authenticatedItem {
        __typename
        ... on ${auth.listKey} {
          id
          label: ${labelField}
          identity: ${identityField}
          ${auth.sessionData}
        }
      }
      redirectToInit
    }`,
  }
}

export async function fetchDashboardAuthState(
  options: DashboardGraphQLOptions = {},
): Promise<DashboardAuthState> {
  const adminMeta = await fetchKeystoneAdminMeta(options)
  const authQuery = buildDashboardAuthQuery(adminMeta)
  if (!authQuery) return { authenticatedItem: null, redirectToInit: false }

  const result = await executeDashboardGraphQL<{
    authenticatedItem: (Record<string, unknown> & { id: string }) | null
    redirectToInit: boolean
  }>(authQuery.query, undefined, options)

  return {
    redirectToInit: result.redirectToInit,
    authenticatedItem: result.authenticatedItem
      ? {
          ...result.authenticatedItem,
          id: result.authenticatedItem.id,
          listPath: authQuery.listPath,
          label:
            typeof result.authenticatedItem.label === 'string'
              ? result.authenticatedItem.label
              : null,
          identity:
            typeof result.authenticatedItem.identity === 'string'
              ? result.authenticatedItem.identity
              : null,
        }
      : null,
  }
}

export async function fetchDashboardOverview(
  options: DashboardGraphQLOptions = {},
) {
  const [adminMeta, authState] = await Promise.all([
    fetchKeystoneAdminMeta(options),
    fetchDashboardAuthState(options).catch(() => ({
      authenticatedItem: null,
      redirectToInit: false,
    })),
  ])

  if (adminMeta.lists.length === 0) {
    return {
      lists: [] satisfies DashboardListSummary[],
      authenticatedItem: authState.authenticatedItem,
    }
  }

  const listsToCount = adminMeta.lists.filter((list) => !list.isSingleton)
  const singletonLists = adminMeta.lists.filter((list) => list.isSingleton)
  const countSelections = listsToCount
    .map(
      (list) => `count_${list.key}: ${list.graphql.names.listQueryCountName}`,
    )
    .join('\n')
  const singletonSelections = singletonLists
    .map(
      (list) =>
        `singleton_${list.key}: ${list.graphql.names.listQueryName}(take: 1) { id }`,
    )
    .join('\n')
  const overviewSelections = [countSelections, singletonSelections]
    .filter(Boolean)
    .join('\n')
  const overviewData = overviewSelections
    ? await executeDashboardGraphQL<
        Record<string, number | Array<{ id: string }>>
      >(
        `query DashboardListOverview {\n${overviewSelections}\n}`,
        undefined,
        options,
      )
    : {}

  return {
    authenticatedItem: authState.authenticatedItem,
    lists: adminMeta.lists.map((list) => {
      const count = overviewData[`count_${list.key}`]
      const singletonItems = overviewData[`singleton_${list.key}`]
      return {
        ...list,
        count: typeof count === 'number' ? count : 0,
        singletonItemId: Array.isArray(singletonItems)
          ? (singletonItems[0]?.id ?? null)
          : null,
      }
    }),
  }
}

export function findDashboardListByPath(
  adminMeta: { lists: DashboardList[] },
  listPath: string,
) {
  const normalized = listPath.toLowerCase()
  return adminMeta.lists.find(
    (list) =>
      list.path === listPath ||
      list.key === listPath ||
      list.path.toLowerCase() === normalized ||
      list.key.toLowerCase() === normalized,
  )
}

function findListByPath(
  adminMeta: { lists: DashboardList[] },
  listPath: string,
) {
  return findDashboardListByPath(adminMeta, listPath)
}

export function selectedListFields(
  list: DashboardList,
  fieldsParam?: string,
  columnParam?: string | string[],
) {
  const fieldByPath = new Map(list.fields.map((field) => [field.path, field]))
  const visibleFieldPaths = list.fields
    .filter(
      (field) => field.path !== 'id' && field.listView.fieldMode !== 'hidden',
    )
    .map((field) => field.path)
  const defaultPaths =
    list.initialColumns.length > 0
      ? list.initialColumns
      : visibleFieldPaths.slice(0, 1)
  const columnPaths = Array.isArray(columnParam)
    ? columnParam.map((part) => String(part).trim()).filter(Boolean)
    : typeof columnParam === 'string' && columnParam.trim()
      ? columnParam
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
      : []
  const requestedPaths =
    typeof fieldsParam === 'string' && fieldsParam.trim()
      ? fieldsParam
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
      : columnPaths.length
        ? columnPaths
        : defaultPaths
  const selectedPaths = ['id', ...requestedPaths]

  return Array.from(new Set(selectedPaths))
    .map((fieldPath) => fieldByPath.get(fieldPath))
    .filter((field): field is DashboardField => Boolean(field))
    .filter(
      (field) => field.path === 'id' || field.listView.fieldMode !== 'hidden',
    )
}

function selectedItemFields(
  list: Pick<DashboardList, 'fields' | 'labelField'>,
) {
  const fieldByPath = new Map(list.fields.map((field) => [field.path, field]))
  const selectedPaths = [
    'id',
    list.labelField,
    ...list.fields.map((field) => field.path),
  ]
  return Array.from(new Set(selectedPaths))
    .map((fieldPath) => fieldByPath.get(fieldPath))
    .filter((field): field is DashboardField => Boolean(field))
    .filter(
      (field) => field.path === 'id' || field.itemView.fieldMode !== 'hidden',
    )
}

function labelFieldForRelationship(
  adminMeta: { lists: DashboardList[] },
  field: DashboardField,
) {
  const explicitLabelField =
    typeof field.fieldMeta.refLabelField === 'string'
      ? field.fieldMeta.refLabelField
      : undefined
  const explicitListKey =
    typeof field.fieldMeta.refListKey === 'string'
      ? field.fieldMeta.refListKey
      : undefined
  const ref =
    typeof field.fieldMeta.ref === 'string' ? field.fieldMeta.ref : undefined
  const refListKey = explicitListKey ?? ref?.split('.')[0]
  const refList = adminMeta.lists.find(
    (list) =>
      list.key === refListKey || list.path === field.fieldMeta.refListPath,
  )
  const labelField = explicitLabelField ?? refList?.labelField ?? 'id'
  const hasLabelField = refList?.fields.some(
    (candidate) => candidate.path === labelField,
  )
  return hasLabelField ? labelField : 'id'
}

function graphQLSelectionForField(
  adminMeta: { lists: DashboardList[] },
  field: DashboardField,
) {
  const controllerSelection =
    typeof field.fieldMeta.graphqlSelection === 'string'
      ? field.fieldMeta.graphqlSelection
      : undefined
  if (controllerSelection && controllerSelection.trim())
    return controllerSelection
  if (field.path === 'id') return 'id'
  if (field.kind === 'document')
    return `${field.path} { document(hydrateRelationships: true) }`
  if (field.kind === 'password') return `${field.path} { isSet }`
  if (field.kind === 'relationship') {
    const labelField = labelFieldForRelationship(adminMeta, field)
    return `${field.path} { id label: ${labelField} }`
  }
  return field.path
}

export function filterTypesForField(field: DashboardField) {
  return sharedFilterTypesForField(field)
}

function relationshipFilterIds(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [value]
  return values.map((item) => String(item).trim()).filter(Boolean)
}

function stringListFilterValue(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [value]
  return values.map((item) => String(item).trim()).filter(Boolean)
}

export function filterWhereForField(
  field: DashboardField,
  type: string,
  value: unknown,
) {
  if (field.kind === 'text') {
    const text = String(value)
    if (type === 'contains_i')
      return { [field.path]: { contains: text, mode: 'insensitive' } }
    if (type === 'not_contains_i')
      return {
        NOT: [{ [field.path]: { contains: text, mode: 'insensitive' } }],
      }
    if (type === 'is_i')
      return { [field.path]: { equals: text, mode: 'insensitive' } }
    if (type === 'not_i')
      return { NOT: [{ [field.path]: { equals: text, mode: 'insensitive' } }] }
    if (type === 'starts_with_i')
      return { [field.path]: { startsWith: text, mode: 'insensitive' } }
    if (type === 'not_starts_with_i')
      return {
        NOT: [{ [field.path]: { startsWith: text, mode: 'insensitive' } }],
      }
    if (type === 'ends_with_i')
      return { [field.path]: { endsWith: text, mode: 'insensitive' } }
    if (type === 'not_ends_with_i')
      return {
        NOT: [{ [field.path]: { endsWith: text, mode: 'insensitive' } }],
      }
    return undefined
  }
  if (field.kind === 'select') {
    const values = stringListFilterValue(value)
    if (values.length === 0) return undefined
    return type === 'not_matches'
      ? { [field.path]: { notIn: values } }
      : { [field.path]: { in: values } }
  }
  if (field.kind === 'document') {
    if (type === 'is_empty') return { [field.path]: { equals: null } }
    const text = String(value)
    if (type === 'contains') return { [field.path]: { contains: text } }
    if (type === 'not_contains')
      return { [field.path]: { not: { contains: text } } }
    return undefined
  }
  if (field.kind === 'id') {
    if (type === 'in')
      return { [field.path]: { in: stringListFilterValue(value) } }
    if (type === 'not_in')
      return { NOT: [{ [field.path]: { in: stringListFilterValue(value) } }] }
    if (type === 'is') return { [field.path]: { equals: String(value) } }
    if (type === 'not')
      return { NOT: [{ [field.path]: { equals: String(value) } }] }
    if (['gt', 'lt', 'gte', 'lte'].includes(type))
      return { [field.path]: { [type]: String(value) } }
    return undefined
  }
  if (field.kind === 'relationship') {
    const many = Boolean(field.fieldMeta.many)
    if (type === 'empty' && !many) return { [field.path]: { equals: null } }
    if (type === 'empty' && many) return { [field.path]: { none: {} } }
    if (type === 'not_empty' && !many)
      return { [field.path]: { not: { equals: null } } }
    if (type === 'not_empty' && many) return { [field.path]: { some: {} } }
    if (type === 'is')
      return { [field.path]: { id: { equals: String(value) } } }
    if (type === 'not_is')
      return { [field.path]: { not: { id: { equals: String(value) } } } }
    if (type === 'some')
      return {
        [field.path]: { some: { id: { in: relationshipFilterIds(value) } } },
      }
    if (type === 'not_some')
      return {
        [field.path]: {
          not: { some: { id: { in: relationshipFilterIds(value) } } },
        },
      }
    return undefined
  }
  if (type === 'empty' || type === 'is_empty')
    return { [field.path]: { equals: null } }
  if (type === 'not_empty') return { [field.path]: { not: { equals: null } } }
  if (field.kind === 'checkbox') {
    const checked =
      value === true || value === 'true' || value === 1 || value === '1'
    if (type === 'is') return { [field.path]: { equals: checked } }
    if (type === 'not') return { [field.path]: { equals: !checked } }
    return undefined
  }
  if (field.kind === 'integer' || field.kind === 'float') {
    if (type === 'empty') return { [field.path]: { equals: null } }
    if (type === 'not_empty') return { [field.path]: { not: { equals: null } } }
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return undefined
    if (type === 'not') return { [field.path]: { not: { equals: numeric } } }
    return { [field.path]: { [type]: numeric } }
  }
  if (field.kind === 'multiselect') {
    const values = stringListFilterValue(value)
    return type === 'not_matches'
      ? { [field.path]: { notIn: values } }
      : { [field.path]: { in: values } }
  }
  if (
    field.kind === 'decimal' ||
    field.kind === 'bigInt' ||
    field.kind === 'timestamp'
  ) {
    if (type === 'not')
      return { [field.path]: { not: { equals: String(value) } } }
    if (['equals', 'lt', 'lte', 'gt', 'gte'].includes(type))
      return { [field.path]: { [type]: String(value) } }
  }
  if (type === 'not')
    return { [field.path]: { not: { equals: String(value) } } }
  if (['equals', 'contains', 'startsWith', 'endsWith'].includes(type))
    return { [field.path]: { [type]: String(value) } }
  return undefined
}

export function buildWhere(
  list: DashboardList,
  search: string,
  filters: Record<string, unknown> = {},
  searchFieldsOverride?: string[],
) {
  const conditions: Array<Record<string, unknown>> = []
  if (isNonEmptyWhereObject(list.initialFilter))
    conditions.push(list.initialFilter)
  const trimmed = search.trim()
  if (trimmed) {
    const searchFieldPaths = searchFieldsOverride?.length
      ? searchFieldsOverride
      : list.initialSearchFields
    const searchableFields = searchFieldPaths
      .map((fieldPath) => list.fields.find((field) => field.path === fieldPath))
      .filter((field): field is DashboardField => Boolean(field))
      .filter(
        (field) =>
          field.isFilterable && ['text', 'select'].includes(field.kind),
      )
    const searchConditions: Array<Record<string, unknown>> = [
      { id: { equals: trimmed } },
    ]
    searchConditions.push(
      ...searchableFields.map((field) => ({
        [field.path]: { contains: trimmed },
      })),
    )
    conditions.push({ OR: searchConditions })
  }

  const possibleFilters = new Map<
    string,
    { field: DashboardField; type: string }
  >()
  const filterTypesByFieldPath = new Map<string, string[]>()
  for (const field of list.fields) {
    if (!field.isFilterable) continue
    const supportedTypes = filterTypesForField(field)
    filterTypesByFieldPath.set(field.path, supportedTypes)
    for (const type of supportedTypes)
      possibleFilters.set(`!${field.path}_${type}`, { field, type })
  }

  for (const [key, rawValue] of Object.entries(filters)) {
    const filter = possibleFilters.get(key)
    if (!filter) continue
    const { field, type } = filter
    let value = rawValue
    if (typeof rawValue === 'string') {
      try {
        value = JSON.parse(rawValue)
      } catch {
        value = rawValue
      }
    }
    const condition = filterWhereForField(field, type, value)
    if (condition) conditions.push(condition)
  }

  for (const rawFilter of officialFilterParamsFromSearch(filters)) {
    let matchedCondition: Record<string, unknown> | undefined
    for (const field of list.fields) {
      if (!field.isFilterable) continue
      const parsed = parseOfficialFilterParam(
        rawFilter,
        filterTypesByFieldPath.get(field.path) ?? [],
      )
      if (!parsed || parsed.fieldPath !== field.path) continue
      let value = parsed.rawValue
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value)
        } catch {}
      }
      matchedCondition = filterWhereForField(field, parsed.filterType, value)
      if (matchedCondition) break
    }
    if (matchedCondition) conditions.push(matchedCondition)
  }

  if (conditions.length === 0) return undefined
  if (conditions.length === 1) return conditions[0]
  return { AND: conditions }
}

function isNonEmptyWhereObject(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0,
  )
}

export function resolveEffectiveSortToken(
  list: DashboardList,
  sortBy?: string,
) {
  const rawSort = sortBy || ''
  if (!rawSort) {
    const configuredInitialSort: {
      field: string
      direction: 'ASC' | 'DESC'
    } | null = list.initialSort
    if (!configuredInitialSort) return ''
    const initialField = list.fields.find(
      (field) =>
        field.path === configuredInitialSort.field && field.isOrderable,
    )
    if (!initialField) return ''
    return configuredInitialSort.direction === 'DESC'
      ? `-${initialField.path}`
      : initialField.path
  }

  const legacyParts = rawSort.split(':')
  const explicitFieldPath =
    legacyParts.length === 2
      ? legacyParts[0]
      : rawSort.startsWith('-')
        ? rawSort.slice(1)
        : rawSort
  const explicitDirection =
    legacyParts.length === 2
      ? legacyParts[1]
      : rawSort.startsWith('-')
        ? 'desc'
        : 'asc'
  const explicitField = list.fields.find(
    (candidate) => candidate.path === explicitFieldPath,
  )
  if (
    explicitField?.isOrderable &&
    (explicitDirection === 'asc' || explicitDirection === 'desc')
  )
    return explicitDirection === 'desc'
      ? `-${explicitFieldPath}`
      : explicitFieldPath
  return ''
}

export function buildOrderBy(list: DashboardList, sortBy?: string) {
  const token = resolveEffectiveSortToken(list, sortBy)
  if (!token) return undefined
  const descending = token.startsWith('-')
  const fieldPath = descending ? token.slice(1) : token
  return [{ [fieldPath]: descending ? 'desc' : 'asc' }]
}

export async function fetchDashboardListPage(
  {
    listPath,
    page = 1,
    pageSize,
    search = '',
    sortBy,
    fields,
    filters,
    column,
  }: {
    listPath: string
    page?: number
    pageSize?: number
    search?: string
    sortBy?: string
    fields?: string
    filters?: Record<string, unknown>
    column?: string | string[]
  },
  options: DashboardGraphQLOptions = {},
): Promise<DashboardListPageData> {
  const adminMeta = await fetchKeystoneAdminMeta(options)
  const list = findListByPath(adminMeta, listPath)
  if (!list) throw new Error(`List not found: ${listPath}`)

  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const safePageSize =
    Number.isFinite(pageSize) && pageSize && pageSize > 0
      ? Math.floor(pageSize)
      : list.pageSize
  const selectedFields = selectedListFields(list, fields, column)
  const selectedGqlFields = selectedFields
    .map((field) => graphQLSelectionForField(adminMeta, field))
    .join('\n')
  const where = buildWhere(list, search, filters)
  const orderBy = buildOrderBy(list, sortBy)

  const data = await executeDashboardGraphQL<{
    items: DashboardListItem[]
    count: number
  }>(
    `query DashboardListItems(
      $where: ${list.graphql.names.whereInputName}! = {},
      $take: Int!,
      $skip: Int!,
      $orderBy: [${list.graphql.names.listOrderName}!]! = []
    ) {
      items: ${list.graphql.names.listQueryName}(
        where: $where,
        take: $take,
        skip: $skip,
        orderBy: $orderBy
      ) {
        ${selectedGqlFields}
      }
      count: ${list.graphql.names.listQueryCountName}(where: $where)
    }`,
    {
      where: where ?? {},
      take: safePageSize,
      skip: (safePage - 1) * safePageSize,
      orderBy: orderBy ?? [],
    },
    options,
  )

  return {
    list,
    items: data.items,
    count: data.count,
    page: safePage,
    pageSize: safePageSize,
    selectedFields,
    selectedFieldPaths: selectedFields.map((field) => field.path),
    sortBy: resolveEffectiveSortToken(list, sortBy),
  }
}

export async function fetchDashboardCreatePage(
  { listPath }: { listPath: string },
  options: DashboardGraphQLOptions = {},
): Promise<DashboardCreatePageData> {
  const adminMeta = await fetchKeystoneAdminMeta(options)
  const list = findListByPath(adminMeta, listPath)
  if (!list) throw new Error(`List not found: ${listPath}`)

  const data = await executeDashboardGraphQL<{
    keystone?: {
      adminMeta?: {
        list?: {
          fields?: Array<{
            key?: string
            path?: string
            isNonNull: Array<'read' | 'create' | 'update'>
            fieldMeta: Record<string, unknown> | null
            createView?: {
              fieldMode: 'edit' | 'read' | 'hidden'
              fieldPosition: 'form' | 'sidebar'
              isRequired?: boolean
            }
          }>
        }
      }
    }
  }>(
    `query DashboardCreatePage($listKey: String!) {
      keystone {
        adminMeta {
          list(key: $listKey) {
            fields {
              key
              path
              isNonNull
              fieldMeta
              createView {
                fieldMode
                fieldPosition
                isRequired
              }
            }
          }
        }
      }
    }`,
    { listKey: list.key },
    options,
  )

  const fieldMetaByPath = Object.fromEntries(
    (data.keystone?.adminMeta?.list?.fields ?? []).map((field) => {
      const fieldPath = field.path ?? field.key ?? ''
      return [
        fieldPath,
        {
          isNonNull: field.isNonNull,
          fieldMeta: field.fieldMeta,
          createView: field.createView,
        },
      ]
    }),
  )
  const createViewOverrides = new Map(
    Object.entries(fieldMetaByPath).map(([path, meta]) => [
      path,
      meta.createView,
    ]),
  )
  const selectedFields = selectedItemFields({
    fields: list.fields.map((field) => {
      const override = createViewOverrides.get(field.path)
      return override
        ? { ...field, createView: { ...field.createView, ...override } }
        : field
    }),
    labelField: list.labelField,
  })

  return { list, selectedFields, fieldMetaByPath }
}

export async function fetchDashboardItemPage(
  { listPath, id }: { listPath: string; id: string },
  options: DashboardGraphQLOptions = {},
): Promise<DashboardItemPageData> {
  const adminMeta = await fetchKeystoneAdminMeta(options)
  const list = findListByPath(adminMeta, listPath)
  if (!list) throw new Error(`List not found: ${listPath}`)

  const staticSelectedFields = selectedItemFields(list)
  const staticSelectedGqlFields = staticSelectedFields
    .map((field) => graphQLSelectionForField(adminMeta, field))
    .join('\n')

  const data = await executeDashboardGraphQL<{
    item: DashboardListItem | null
    keystone?: {
      adminMeta?: {
        list?: {
          fields?: Array<{
            key?: string
            path?: string
            isNonNull: Array<'read' | 'create' | 'update'>
            fieldMeta: Record<string, unknown> | null
            itemView?: {
              fieldMode: 'edit' | 'read' | 'hidden'
              fieldPosition: 'form' | 'sidebar'
              isRequired?: boolean
            }
          }>
          actions?: Array<{
            key: string
            itemView?: {
              actionMode: 'enabled' | 'disabled' | 'hidden'
              navigation: 'follow' | 'refetch' | 'return'
              hidePrompt: boolean
              hideToast: boolean
            }
          }>
        }
      }
    }
  }>(
    `query DashboardItem($where: ${list.graphql.names.whereUniqueInputName}!, $id: ID!, $listKey: String!) {
      item: ${list.graphql.names.itemQueryName}(where: $where) {
        ${staticSelectedGqlFields}
      }
      keystone {
        adminMeta {
          list: itemList(key: $listKey, itemId: $id) {
            fields {
              key
              path
              isNonNull
              fieldMeta
              itemView {
                fieldMode
                fieldPosition
                isRequired
              }
            }
            actions {
              key
              itemView {
                actionMode
                navigation
                hidePrompt
                hideToast
              }
            }
          }
        }
      }
    }`,
    { where: { id }, id, listKey: list.key },
    options,
  )

  if (!data.item && !(list.isSingleton && id === '1'))
    throw new Error(`Item not found: ${listPath}/${id}`)
  const item = data.item ?? { id }

  const fieldMetaByPath = Object.fromEntries(
    (data.keystone?.adminMeta?.list?.fields ?? []).map((field) => {
      const fieldPath = field.path ?? field.key ?? ''
      return [
        fieldPath,
        {
          isNonNull: field.isNonNull,
          fieldMeta: field.fieldMeta,
          itemView: field.itemView,
        },
      ]
    }),
  )
  const itemViewOverrides = new Map(
    Object.entries(fieldMetaByPath).map(([path, meta]) => [
      path,
      meta.itemView,
    ]),
  )
  const actionMetaByKey = Object.fromEntries(
    (data.keystone?.adminMeta?.list?.actions ?? [])
      .filter(
        (
          action,
        ): action is {
          key: string
          itemView: {
            actionMode: 'enabled' | 'disabled' | 'hidden'
            navigation: 'follow' | 'refetch' | 'return'
            hidePrompt: boolean
            hideToast: boolean
          }
        } => Boolean(action.key && action.itemView),
      )
      .map((action) => [action.key, action.itemView]),
  )
  const itemFields = list.fields.map((field) => {
    const override = itemViewOverrides.get(field.path)
    return override
      ? { ...field, itemView: { ...field.itemView, ...override } }
      : field
  })
  const selectedFields = selectedItemFields({
    fields: itemFields,
    labelField: list.labelField,
  })

  const labelValue = item[list.labelField]
  const title =
    typeof labelValue === 'string' && labelValue.trim().length > 0
      ? labelValue
      : item.id

  return {
    list,
    item,
    selectedFields,
    fieldMetaByPath,
    actionMetaByKey,
    title,
  }
}

export async function fetchDashboardRelationshipOptions(
  {
    listKey,
    search = '',
    take = 20,
    skip = 0,
    config,
  }: {
    listKey: string
    search?: string
    take?: number
    skip?: number
    config?: DashboardRelationshipOptionConfig
  },
  options: DashboardGraphQLOptions = {},
): Promise<DashboardRelationshipOptionsResult> {
  const adminMeta = await fetchKeystoneAdminMeta(options)
  const list = findDashboardListByPath(adminMeta, listKey)
  if (!list) throw new Error(`List not found: ${listKey}`)

  const requestedLabelField =
    typeof config?.labelField === 'string' ? config.labelField : undefined
  const labelField = list.fields.some(
    (field) => field.path === requestedLabelField,
  )
    ? (requestedLabelField as string)
    : list.fields.some((field) => field.path === list.labelField)
      ? list.labelField
      : 'id'
  const requestedSearchFields = Array.isArray(config?.searchFields)
    ? config.searchFields.filter((fieldPath) =>
        list.fields.some((field) => field.path === fieldPath),
      )
    : undefined
  const where = buildWhere(list, search, {}, requestedSearchFields)

  const extraSelection = Array.isArray(config?.extraSelection)
    ? config.extraSelection.filter((fieldPath) =>
        list.fields.some(
          (field) => field.path === fieldPath && field.kind !== 'password',
        ),
      )
    : []
  const extraSelectionBlock = extraSelection.length
    ? `\n        ${extraSelection.join('\n        ')}`
    : ''

  const data = await executeDashboardGraphQL<{
    items: Array<Record<string, unknown> & { id: string; label?: unknown }>
    count: number
  }>(
    `query RelationshipOptions($where: ${list.gqlNames.whereInputName}! = {}, $take: Int!, $skip: Int!) {
      items: ${list.gqlNames.listQueryName}(where: $where, take: $take, skip: $skip) {
        id
        label: ${labelField}${extraSelectionBlock}
      }
      count: ${list.gqlNames.listQueryCountName}(where: $where)
    }`,
    { where: where ?? {}, take, skip },
    options,
  )

  return {
    items: data.items.map((item) => ({
      id: item.id,
      label: String(item.label ?? item.id),
      data: item,
    })),
    count: data.count,
  }
}

export async function fetchDashboardRelationshipOptionsByIds(
  {
    listKey,
    ids,
    config,
  }: {
    listKey: string
    ids: string[]
    config?: DashboardRelationshipOptionConfig
  },
  options: DashboardGraphQLOptions = {},
): Promise<DashboardRelationshipOption[]> {
  const uniqueIds = Array.from(
    new Set(ids.map((id) => id.trim()).filter(Boolean)),
  )
  if (uniqueIds.length === 0) return []
  const adminMeta = await fetchKeystoneAdminMeta(options)
  const list = findDashboardListByPath(adminMeta, listKey)
  if (!list) throw new Error(`List not found: ${listKey}`)

  const requestedLabelField =
    typeof config?.labelField === 'string' ? config.labelField : undefined
  const labelField = list.fields.some(
    (field) => field.path === requestedLabelField,
  )
    ? (requestedLabelField as string)
    : list.fields.some((field) => field.path === list.labelField)
      ? list.labelField
      : 'id'
  const extraSelection = Array.isArray(config?.extraSelection)
    ? config.extraSelection.filter((fieldPath) =>
        list.fields.some(
          (field) => field.path === fieldPath && field.kind !== 'password',
        ),
      )
    : []
  const extraSelectionBlock = extraSelection.length
    ? `\n        ${extraSelection.join('\n        ')}`
    : ''

  const data = await executeDashboardGraphQL<{
    items: Array<Record<string, unknown> & { id: string; label?: unknown }>
  }>(
    `query RelationshipOptionsByIds($where: ${list.gqlNames.whereInputName}!, $take: Int!) {
      items: ${list.gqlNames.listQueryName}(where: $where, take: $take) {
        id
        label: ${labelField}${extraSelectionBlock}
      }
    }`,
    { where: { id: { in: uniqueIds } }, take: uniqueIds.length },
    options,
  )

  return data.items.map((item) => ({
    id: item.id,
    label: String(item.label ?? item.id),
    data: item,
  }))
}

export { adminMetaGraphQLQuery }
