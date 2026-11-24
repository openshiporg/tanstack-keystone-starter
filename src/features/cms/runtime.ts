import {
  GraphQLError,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  Kind,
  OperationTypeNode,
  astFromValue,
  execute,
  graphql,
  parse,
  print,
  validate,
} from 'graphql'
import type {
  ArgumentNode,
  ConstValueNode,
  DocumentNode,
  ExecutionResult,
  FragmentDefinitionNode,
  GraphQLArgument,
  GraphQLArgumentConfig,
  GraphQLEnumType,
  GraphQLField,
  GraphQLFieldConfig,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLOutputType,
  GraphQLType,
  GraphQLUnionType,
  ListTypeNode,
  NamedTypeNode,
  TypeNode,
  ValueNode,
} from 'graphql'
import { makeExecutableSchema, mergeSchemas } from '@graphql-tools/schema'
import { sanitizeUrl } from '@braintree/sanitize-url'
import type { IResolvers } from '@graphql-tools/utils'

import {
  evaluateActionMode,
  evaluateFieldMode,
  evaluateFieldPosition,
  getAdminMetaForContext,
} from './admin-meta'
import {
  assertCursorAccess,
  assertFilterAccess,
  assertOperationAccess,
  assertOrderByAccess,
  canReadField,
  getAccessFilter,
  getOperationAccess,
  unreadableFieldValue,
} from './access'
import { getCmsAdapter } from './adapters'
import { addAuthGraphQLSchema } from './auth/graphql'
import { isPasswordHash } from './auth/password'
import type {
  CmsContext,
  CmsItem,
  CmsSession,
  CmsTransactionOptions,
} from './adapters'
import {
  accessDenied,
  configFailure,
  resolverFailure,
  validationFailure,
} from './errors'
import { getGraphQLNames } from './gql-names'
import {
  deleteStoredObject,
  getSignedStorageUrl,
  storedGraphQLUploadResponse,
} from './storage'
import { getStorageConfig, getStorageConfigs } from './storage-config'
import {
  buildStructureGraphQLTypes,
  structureFieldValue,
  structureRelationshipReferences,
  structureResolverMap,
} from './structure'
import type { StructureSchema } from './structure'
import type { CmsStorageConfig } from './storage-config'
import cmsConfig from '../../../cms.config'
import { cmsLists } from './registry'
import { CmsMutationState, withMutationState } from './mutation-state'
import type {
  AdminMeta,
  AdminMetaAction,
  AdminMetaField,
  AdminMetaGroup,
  AdminMetaList,
  CmsField,
  CmsList,
  CmsListActionConfig,
  FieldModeConfig,
  FieldViewConfig,
  GraphQLNames,
} from './types'

export type CmsExtendGraphqlSchema = (
  baseSchema: GraphQLSchema,
) => GraphQLSchema
export type CmsGraphQLSchemaKind = 'public' | 'internal'

export type { CmsContext, CmsSession } from './adapters'

type RelationRef = {
  listKey: string
  fieldPath: string
}

function graphQLNamesForLists(lists: CmsList[]) {
  return Object.fromEntries(
    lists.map((list) => [list.key, getGraphQLNames(list.key, list.plural)]),
  ) as Record<string, GraphQLNames>
}

const graphQLNamesByListKey = graphQLNamesForLists(cmsLists)

const nonOrderableKinds = new Set<CmsField['kind']>([
  'document',
  'structure',
  'json',
  'image',
  'file',
  'relationship',
  'password',
  'multiselect',
])
const nonFilterableKinds = new Set<CmsField['kind']>([
  'document',
  'structure',
  'image',
  'file',
  'json',
  'multiselect',
])

const orderDirectionEnum = 'enum OrderDirection { asc desc }'

const commonTypeDefs = /* GraphQL */ `
  scalar JSON
  scalar Upload
  scalar DateTime
  scalar CalendarDay
  scalar Decimal
  scalar BigInt

  enum ImageExtension {
    png
    jpg
    gif
    webp
  }

  input FileFieldInput {
    upload: Upload!
  }

  input ImageFieldInput {
    upload: Upload!
  }

  type FileFieldOutput {
    filename: String!
    filesize: Int!
    url: String!
  }

  type ImageFieldOutput {
    id: ID!
    url: String!
    extension: ImageExtension!
    filesize: Int!
    width: Int!
    height: Int!
  }

  type PasswordState {
    isSet: Boolean!
  }

  input PasswordFilter {
    isSet: Boolean!
  }

  ${orderDirectionEnum}

  input IDFilter {
    equals: ID
    in: [ID!]
    notIn: [ID!]
    lt: ID
    lte: ID
    gt: ID
    gte: ID
    not: IDFilter
  }

  enum QueryMode {
    default
    insensitive
  }

  input NestedStringFilter {
    equals: String
    in: [String!]
    notIn: [String!]
    lt: String
    lte: String
    gt: String
    gte: String
    contains: String
    startsWith: String
    endsWith: String
    not: NestedStringFilter
  }

  input StringFilter {
    equals: String
    in: [String!]
    notIn: [String!]
    lt: String
    lte: String
    gt: String
    gte: String
    contains: String
    startsWith: String
    endsWith: String
    mode: QueryMode
    not: NestedStringFilter
  }

  input StringNullableFilter {
    equals: String
    in: [String!]
    notIn: [String!]
    lt: String
    lte: String
    gt: String
    gte: String
    contains: String
    startsWith: String
    endsWith: String
    mode: QueryMode
    not: StringNullableFilter
  }

  input BooleanFilter {
    equals: Boolean
    not: BooleanFilter
  }

  input IntFilter {
    equals: Int
    in: [Int!]
    notIn: [Int!]
    lt: Int
    lte: Int
    gt: Int
    gte: Int
    not: IntFilter
  }

  input IntNullableFilter {
    equals: Int
    in: [Int!]
    notIn: [Int!]
    lt: Int
    lte: Int
    gt: Int
    gte: Int
    not: IntNullableFilter
  }

  input FloatFilter {
    equals: Float
    in: [Float!]
    notIn: [Float!]
    lt: Float
    lte: Float
    gt: Float
    gte: Float
    not: FloatFilter
  }

  input FloatNullableFilter {
    equals: Float
    in: [Float!]
    notIn: [Float!]
    lt: Float
    lte: Float
    gt: Float
    gte: Float
    not: FloatNullableFilter
  }

  input DateTimeFilter {
    equals: DateTime
    in: [DateTime!]
    notIn: [DateTime!]
    lt: DateTime
    lte: DateTime
    gt: DateTime
    gte: DateTime
    not: DateTimeFilter
  }

  input DateTimeNullableFilter {
    equals: DateTime
    in: [DateTime!]
    notIn: [DateTime!]
    lt: DateTime
    lte: DateTime
    gt: DateTime
    gte: DateTime
    not: DateTimeNullableFilter
  }

  input CalendarDayFilter {
    equals: CalendarDay
    in: [CalendarDay!]
    notIn: [CalendarDay!]
    lt: CalendarDay
    lte: CalendarDay
    gt: CalendarDay
    gte: CalendarDay
    not: CalendarDayFilter
  }

  input CalendarDayNullableFilter {
    equals: CalendarDay
    in: [CalendarDay!]
    notIn: [CalendarDay!]
    lt: CalendarDay
    lte: CalendarDay
    gt: CalendarDay
    gte: CalendarDay
    not: CalendarDayNullableFilter
  }

  input DecimalFilter {
    equals: Decimal
    in: [Decimal!]
    notIn: [Decimal!]
    lt: Decimal
    lte: Decimal
    gt: Decimal
    gte: Decimal
    not: DecimalFilter
  }

  input DecimalNullableFilter {
    equals: Decimal
    in: [Decimal!]
    notIn: [Decimal!]
    lt: Decimal
    lte: Decimal
    gt: Decimal
    gte: Decimal
    not: DecimalNullableFilter
  }

  input BigIntFilter {
    equals: BigInt
    in: [BigInt!]
    notIn: [BigInt!]
    lt: BigInt
    lte: BigInt
    gt: BigInt
    gte: BigInt
    not: BigIntFilter
  }

  input BigIntNullableFilter {
    equals: BigInt
    in: [BigInt!]
    notIn: [BigInt!]
    lt: BigInt
    lte: BigInt
    gt: BigInt
    gte: BigInt
    not: BigIntNullableFilter
  }

  input StringListFilter {
    equals: [String!]
    has: String
    hasSome: [String!]
    hasEvery: [String!]
    isEmpty: Boolean
  }

  input IntListFilter {
    equals: [Int!]
    has: Int
    hasSome: [Int!]
    hasEvery: [Int!]
    isEmpty: Boolean
  }

  type KeystoneMeta {
    adminMeta: KeystoneAdminMeta!
    auth: PublicAuthMeta
  }

  type KeystoneAdminMeta {
    views: [String!]!
    isAccessAllowed: Boolean!
    auth: AuthMeta
    lists: [KeystoneAdminUIListMeta!]!
    list(key: String!): KeystoneAdminUIListMeta
    itemList(key: String!, itemId: ID!): KeystoneAdminUIListMeta
  }

  type PublicAuthMeta {
    listKey: String!
    identityField: String!
    secretField: String!
    initFirstItemFields: [String!]!
  }

  type AuthMeta {
    listKey: String!
    identityField: String!
    secretField: String!
    sessionData: String!
    initFirstItemFields: [String!]!
  }

  type KeystoneAdminUIGraphQLNames {
    outputTypeName: String!
    whereInputName: String!
    whereUniqueInputName: String!
    createInputName: String!
    createMutationName: String!
    createManyMutationName: String!
    relateToOneForCreateInputName: String!
    relateToManyForCreateInputName: String!
    itemQueryName: String!
    listQueryName: String!
    listQueryCountName: String!
    listOrderName: String!
    updateInputName: String!
    updateMutationName: String!
    updateManyInputName: String!
    updateManyMutationName: String!
    relateToOneForUpdateInputName: String!
    relateToManyForUpdateInputName: String!
    deleteMutationName: String!
    deleteManyMutationName: String!
  }

  type KeystoneAdminUIGraphQL {
    names: KeystoneAdminUIGraphQLNames!
  }

  type KeystoneAdminUIListMeta {
    key: String!
    initialSort: KeystoneAdminUISort
    initialFilter: JSON
    path: String!
    label: String!
    singular: String!
    plural: String!
    description: String
    initialColumns: [String!]!
    initialSearchFields: [String!]!
    pageSize: Int!
    labelField: String!
    isSingleton: Boolean!
    isHidden: Boolean!
    hideNavigation: Boolean!
    hideCreate: Boolean!
    hideDelete: Boolean!
    itemQueryName: String!
    listQueryName: String!
    fields: [KeystoneAdminUIFieldMeta!]!
    field(key: String!): KeystoneAdminUIFieldMeta
    groups: [KeystoneAdminUIFieldGroupMeta!]!
    actions: [ActionMeta!]!
    graphql: KeystoneAdminUIGraphQL!
  }

  type ActionMeta {
    key: String!
    label: String!
    icon: String
    messages: ActionMessages!
    graphql: ActionGraphQL!
    itemView: ActionItemViewMeta!
    listView: ActionListViewMeta!
  }

  type ActionMessages {
    promptTitle: String!
    promptTitleMany: String!
    prompt: String!
    promptMany: String!
    promptConfirmLabel: String!
    promptConfirmLabelMany: String!
    fail: String!
    failMany: String!
    success: String!
    successMany: String!
  }

  type ActionGraphQL {
    names: ActionGraphQLNames!
  }

  type ActionGraphQLNames {
    one: String!
    many: String!
  }

  type ActionItemViewMeta {
    actionMode: String!
    navigation: String!
    hidePrompt: Boolean!
    hideToast: Boolean!
  }

  type ActionListViewMeta {
    actionMode: String!
  }

  type KeystoneAdminUISort {
    field: String!
    direction: KeystoneAdminUISortDirection!
  }

  enum KeystoneAdminUISortDirection {
    ASC
    DESC
  }

  enum KeystoneAdminUIFieldMetaIsNonNull {
    read
    create
    update
  }

  type KeystoneAdminUIFieldMeta {
    key: String!
    path: String!
    label: String!
    description: String
    fieldMeta: JSON
    itemField: JSON
    isOrderable: Boolean!
    isFilterable: Boolean!
    viewsIndex: Int!
    customViewsIndex: Int
    search: QueryMode
    isNonNull: [KeystoneAdminUIFieldMetaIsNonNull!]
    createView: KeystoneAdminUIFieldMetaCreateView!
    itemView(id: ID): KeystoneAdminUIFieldMetaItemView
    listView: KeystoneAdminUIFieldMetaListView!
  }

  type KeystoneAdminUIFieldMetaCreateView {
    fieldMode: KeystoneAdminUIFieldMetaCreateViewFieldMode!
    fieldPosition: String!
    isRequired: Boolean!
  }

  enum KeystoneAdminUIFieldMetaCreateViewFieldMode {
    edit
    hidden
  }

  type KeystoneAdminUIFieldMetaItemView {
    fieldMode: KeystoneAdminUIFieldMetaItemViewFieldMode
    fieldPosition: KeystoneAdminUIFieldMetaItemViewFieldPosition
    isRequired: Boolean!
  }

  enum KeystoneAdminUIFieldMetaItemViewFieldMode {
    edit
    read
    hidden
  }

  enum KeystoneAdminUIFieldMetaItemViewFieldPosition {
    form
    sidebar
  }

  type KeystoneAdminUIFieldMetaListView {
    fieldMode: KeystoneAdminUIFieldMetaListViewFieldMode!
    fieldPosition: String!
  }

  enum KeystoneAdminUIFieldMetaListViewFieldMode {
    read
    hidden
  }

  type KeystoneAdminUIFieldGroupMeta {
    label: String!
    description: String
    fields: [KeystoneAdminUIFieldMeta!]!
  }
`

function parseJsonLiteral(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value)
    case Kind.NULL:
      return null
    case Kind.LIST:
      return ast.values.map(parseJsonLiteral)
    case Kind.OBJECT:
      return Object.fromEntries(
        ast.fields.map((field) => [
          field.name.value,
          parseJsonLiteral(field.value),
        ]),
      )
    case Kind.ENUM:
      return ast.value
    case Kind.VARIABLE:
      return undefined
  }
}

const jsonScalar = new GraphQLScalarType({
  name: 'JSON',
  description:
    'Arbitrary JSON value used by CMS JSON, document, image, and Keystone fieldMeta objects.',
  serialize: (value: unknown) => value,
  parseValue: (value: unknown) => value,
  parseLiteral: parseJsonLiteral,
})

const uploadScalar = new GraphQLScalarType({
  name: 'Upload',
  description:
    'Upload scalar placeholder for Keystone-compatible file/image inputs. Accepts GraphQL multipart upload values for file/image mutations.',
  serialize: () => {
    throw new GraphQLError('Upload values cannot be serialized')
  },
  parseValue: (value: unknown) => value,
  parseLiteral: () => {
    throw new GraphQLError('Upload literal values are not supported')
  },
})

function normalizeDateTimeScalarValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return value.toISOString()
  const parsed = Date.parse(String(value))
  if (!Number.isFinite(parsed))
    throw new GraphQLError('DateTime cannot represent an invalid value')
  return new Date(parsed).toISOString()
}

function normalizeCalendarDayScalarValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const normalized =
    value instanceof Date ? value.toISOString().slice(0, 10) : String(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized))
    throw new GraphQLError(
      'CalendarDay cannot represent a non full-date ISO8601 value',
    )
  const parsed = new Date(`${normalized}T00:00:00.000Z`)
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  )
    throw new GraphQLError('CalendarDay cannot represent an invalid date')
  return normalized
}

function normalizeDecimalScalarValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value)
  if (!/^-?\d+(\.\d+)?$/.test(normalized))
    throw new GraphQLError('Decimal cannot represent an invalid value')
  return normalized
}

function normalizeBigIntScalarValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  try {
    return BigInt(String(value)).toString()
  } catch {
    throw new GraphQLError('BigInt cannot represent an invalid value')
  }
}

const dateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  serialize: (value: unknown) => normalizeDateTimeScalarValue(value),
  parseValue: (value: unknown) => normalizeDateTimeScalarValue(value),
  parseLiteral: (ast) => {
    if (ast.kind !== Kind.STRING)
      throw new GraphQLError('DateTime literals must be strings')
    return normalizeDateTimeScalarValue(ast.value)
  },
})

const calendarDayScalar = new GraphQLScalarType({
  name: 'CalendarDay',
  serialize: (value: unknown) => normalizeCalendarDayScalarValue(value),
  parseValue: (value: unknown) => normalizeCalendarDayScalarValue(value),
  parseLiteral: (ast) => {
    if (ast.kind !== Kind.STRING)
      throw new GraphQLError('CalendarDay literals must be strings')
    return normalizeCalendarDayScalarValue(ast.value)
  },
})

const decimalScalar = new GraphQLScalarType({
  name: 'Decimal',
  serialize: (value: unknown) => normalizeDecimalScalarValue(value),
  parseValue: (value: unknown) => normalizeDecimalScalarValue(value),
  parseLiteral: (ast) => {
    if (
      ast.kind !== Kind.STRING &&
      ast.kind !== Kind.INT &&
      ast.kind !== Kind.FLOAT
    )
      throw new GraphQLError('Decimal literals must be numeric or strings')
    return normalizeDecimalScalarValue(ast.value)
  },
})

const bigIntScalar = new GraphQLScalarType({
  name: 'BigInt',
  serialize: (value: unknown) => normalizeBigIntScalarValue(value),
  parseValue: (value: unknown) => normalizeBigIntScalarValue(value),
  parseLiteral: (ast) => {
    if (ast.kind !== Kind.STRING && ast.kind !== Kind.INT)
      throw new GraphQLError('BigInt literals must be integers or strings')
    return normalizeBigIntScalarValue(ast.value)
  },
})

function parseRelationRef(ref: string): RelationRef {
  const [listKey, fieldPath] = ref.split('.')
  if (!listKey) {
    throw new Error(`Invalid relationship ref ${ref}`)
  }
  return { listKey, fieldPath }
}

function resolvedRelationshipMetadata(field: CmsField, list?: CmsList) {
  return list?.resolvedDbFields?.[field.path]?.relationship
}

function relatedListKeyForField(field: CmsField, list?: CmsList) {
  const resolved = resolvedRelationshipMetadata(field, list)
  if (resolved?.refListKey) return resolved.refListKey
  if (field.kind !== 'relationship' || !field.ref) return undefined
  return parseRelationRef(field.ref).listKey
}

function isOmitted(
  value: unknown,
  operation?: 'read' | 'create' | 'update' | 'query' | 'delete',
) {
  if (value === true) return true
  if (
    !operation ||
    (value !== null && typeof value === 'object' && !Array.isArray(value))
  )
    return operation
      ? Boolean((value as Record<string, unknown>)[operation])
      : false
  return false
}

function isRelationshipRefVisible(
  field: CmsField,
  list: CmsList,
  listsByKey: Record<string, CmsList | undefined>,
  kind: CmsGraphQLSchemaKind,
) {
  if (field.kind !== 'relationship') return true
  const refListKey = relatedListKeyForField(field, list)
  if (!refListKey) return false
  const refList = listsByKey[refListKey]
  if (!refList) return false
  return !(kind === 'public' && refList.graphql?.omit === true)
}

function relationshipArgsSDL(
  namesByListKey: Record<string, GraphQLNames>,
  field: CmsField,
  list?: CmsList,
) {
  if (field.kind !== 'relationship') return ''
  const refListKey = relatedListKeyForField(field, list)
  if (!refListKey) return ''
  const names = namesByListKey[refListKey]
  return `(where: ${names.whereInputName}! = {}, orderBy: [${names.listOrderName}!]! = [], take: Int, skip: Int! = 0, cursor: ${names.whereUniqueInputName})`
}

function applyReadNonNull(outputType: string, field: CmsField) {
  if (field.graphql?.isNonNull?.read !== true) return outputType
  return outputType.endsWith('!') ? outputType : `${outputType}!`
}

function selectEnumTypeName(list: CmsList | undefined, field: CmsField) {
  const listKey = list?.key ?? 'Cms'
  const fieldKey = field.path.charAt(0).toUpperCase() + field.path.slice(1)
  return `${listKey}${fieldKey}Type`
}

function selectEnumFilterInputName(list: CmsList | undefined, field: CmsField) {
  return `${selectEnumTypeName(list, field)}NullableFilter`
}

function selectEnumValues(field: CmsField) {
  return (field.options ?? [])
    .map((option) => option.value)
    .filter((value): value is string => typeof value === 'string')
}

function multiselectEnumTypeName(list: CmsList | undefined, field: CmsField) {
  const listKey = list?.key ?? 'Cms'
  const fieldKey = field.path.charAt(0).toUpperCase() + field.path.slice(1)
  return `${listKey}${fieldKey}Enum`
}

function multiselectEnumFilterInputName(
  list: CmsList | undefined,
  field: CmsField,
) {
  return `${multiselectEnumTypeName(list, field)}Filter`
}

function multiselectEnumValues(field: CmsField) {
  return (field.options ?? [])
    .map((option) => option.value)
    .filter((value): value is string => typeof value === 'string')
}

function structureSchemaForField(field: CmsField) {
  return field.fieldMeta?.structureSchema as StructureSchema | undefined
}

function structureTypesForField(field: CmsField, list?: CmsList) {
  const schema = structureSchemaForField(field)
  return schema && list
    ? buildStructureGraphQLTypes(list.key, field.path, schema)
    : undefined
}

function fieldOutputType(
  field: CmsField,
  kind: CmsGraphQLSchemaKind = 'public',
  list?: CmsList,
): string | null {
  if (kind === 'public' && isOmitted(field.graphql?.omit, 'read')) return null
  if (field.kind === 'virtual')
    return applyReadNonNull(field.graphQLReturnType ?? 'String', field)
  if (field.kind === 'id') return 'ID!'
  if (field.kind === 'relationship') {
    const refListKey = relatedListKeyForField(field, list)
    if (!refListKey) return null
    return applyReadNonNull(field.many ? `[${refListKey}!]` : refListKey, field)
  }
  if (field.kind === 'password') return applyReadNonNull('PasswordState', field)
  if (field.kind === 'image') return applyReadNonNull('ImageFieldOutput', field)
  if (field.kind === 'file') return applyReadNonNull('FileFieldOutput', field)
  if (field.kind === 'document')
    return applyReadNonNull(
      `${list?.key ?? 'Cms'}_${field.path}_Document`,
      field,
    )
  if (field.kind === 'structure') {
    const structureTypes = structureTypesForField(field, list)
    return structureTypes
      ? applyReadNonNull(structureTypes.outputType, field)
      : null
  }
  if (field.kind === 'checkbox') return applyReadNonNull('Boolean', field)
  if (field.kind === 'select' && field.fieldMeta?.type === 'enum')
    return applyReadNonNull(selectEnumTypeName(list, field), field)
  if (field.kind === 'select' && field.fieldMeta?.type === 'integer')
    return applyReadNonNull('Int', field)
  if (field.kind === 'integer') return applyReadNonNull('Int', field)
  if (field.kind === 'float') return applyReadNonNull('Float', field)
  if (field.kind === 'timestamp') return applyReadNonNull('DateTime', field)
  if (field.kind === 'calendarDay')
    return applyReadNonNull('CalendarDay', field)
  if (field.kind === 'decimal') return applyReadNonNull('Decimal', field)
  if (field.kind === 'bigInt') return applyReadNonNull('BigInt', field)
  if (field.kind === 'json') return applyReadNonNull('JSON', field)
  if (field.kind === 'multiselect' && field.fieldMeta?.type === 'enum')
    return `[${multiselectEnumTypeName(list, field)}!]`
  if (field.kind === 'multiselect' && field.fieldMeta?.type === 'integer')
    return '[Int!]'
  if (field.kind === 'multiselect') return '[String!]'
  return applyReadNonNull('String', field)
}

function fieldInputType(
  field: CmsField,
  operation: 'create' | 'update',
  namesByListKey: Record<string, GraphQLNames> = graphQLNamesByListKey,
  kind: CmsGraphQLSchemaKind = 'public',
  list?: CmsList,
): string | null {
  if (kind === 'public' && isOmitted(field.graphql?.omit, operation))
    return null
  if (field.kind === 'id' || field.kind === 'virtual') return null
  if (field.kind === 'relationship') {
    const refListKey = relatedListKeyForField(field, list)
    if (!refListKey) return null
    const names = namesByListKey[refListKey]
    return field.many
      ? operation === 'create'
        ? names.relateToManyForCreateInputName
        : names.relateToManyForUpdateInputName
      : operation === 'create'
        ? names.relateToOneForCreateInputName
        : names.relateToOneForUpdateInputName
  }
  if (field.kind === 'checkbox') return 'Boolean'
  if (field.kind === 'select' && field.fieldMeta?.type === 'enum')
    return selectEnumTypeName(list, field)
  if (field.kind === 'select' && field.fieldMeta?.type === 'integer')
    return 'Int'
  if (field.kind === 'integer') return 'Int'
  if (field.kind === 'float') return 'Float'
  if (field.kind === 'timestamp') return 'DateTime'
  if (field.kind === 'calendarDay') return 'CalendarDay'
  if (field.kind === 'decimal') return 'Decimal'
  if (field.kind === 'bigInt') return 'BigInt'
  if (field.kind === 'multiselect' && field.fieldMeta?.type === 'enum')
    return `[${multiselectEnumTypeName(list, field)}!]`
  if (field.kind === 'multiselect' && field.fieldMeta?.type === 'integer')
    return '[Int!]'
  if (field.kind === 'multiselect') return '[String!]'
  if (field.kind === 'image') return 'ImageFieldInput'
  if (field.kind === 'file') return 'FileFieldInput'
  if (field.kind === 'structure') {
    const structureTypes = structureTypesForField(field, list)
    return structureTypes
      ? operation === 'create'
        ? structureTypes.createInputType
        : structureTypes.updateInputType
      : null
  }
  if (['json', 'document'].includes(field.kind)) return 'JSON'
  return 'String'
}

function usesNullableScalarFilter(field: CmsField) {
  if (field.db?.isNullable === true) return true
  if (field.db?.isNullable === false) return false
  if (
    field.graphql?.isNonNull?.create === true ||
    field.isNonNull?.[0] === true
  )
    return false
  if (field.kind === 'text' || field.kind === 'checkbox') return false
  return field.validation?.isRequired !== true
}

function fieldFilterType(
  field: CmsField,
  namesByListKey: Record<string, GraphQLNames> = graphQLNamesByListKey,
  list?: CmsList,
): string | null {
  if (
    field.graphql?.isEnabled?.filter === false ||
    field.isFilterable === false ||
    nonFilterableKinds.has(field.kind)
  )
    return null
  if (field.kind === 'id') return 'IDFilter'
  if (field.kind === 'checkbox') return 'BooleanFilter'
  if (field.kind === 'select' && field.fieldMeta?.type === 'enum')
    return selectEnumFilterInputName(list, field)
  if (field.kind === 'select' && field.fieldMeta?.type === 'integer')
    return usesNullableScalarFilter(field) ? 'IntNullableFilter' : 'IntFilter'
  if (field.kind === 'integer')
    return usesNullableScalarFilter(field) ? 'IntNullableFilter' : 'IntFilter'
  if (field.kind === 'float')
    return usesNullableScalarFilter(field)
      ? 'FloatNullableFilter'
      : 'FloatFilter'
  if (field.kind === 'decimal')
    return usesNullableScalarFilter(field)
      ? 'DecimalNullableFilter'
      : 'DecimalFilter'
  if (field.kind === 'bigInt')
    return usesNullableScalarFilter(field)
      ? 'BigIntNullableFilter'
      : 'BigIntFilter'
  if (field.kind === 'timestamp')
    return usesNullableScalarFilter(field)
      ? 'DateTimeNullableFilter'
      : 'DateTimeFilter'
  if (field.kind === 'calendarDay')
    return usesNullableScalarFilter(field)
      ? 'CalendarDayNullableFilter'
      : 'CalendarDayFilter'
  if (field.kind === 'multiselect' && field.fieldMeta?.type === 'enum')
    return multiselectEnumFilterInputName(list, field)
  if (field.kind === 'multiselect' && field.fieldMeta?.type === 'integer')
    return 'IntListFilter'
  if (field.kind === 'multiselect') return 'StringListFilter'
  if (field.kind === 'password')
    return field.validation?.isRequired === true ? null : 'PasswordFilter'
  if (field.kind === 'relationship') {
    const refListKey = relatedListKeyForField(field, list)
    if (!refListKey) return null
    return field.many
      ? `${refListKey}ManyRelationFilter`
      : namesByListKey[refListKey].whereInputName
  }
  if (['text', 'select'].includes(field.kind))
    return usesNullableScalarFilter(field)
      ? 'StringNullableFilter'
      : 'StringFilter'
  return null
}

function fieldUniqueInputType(field: CmsField, list?: CmsList): string | null {
  if (field.kind === 'id') return 'ID'
  if (field.kind === 'relationship') {
    const relationship = list
      ? resolvedRelationshipMetadata(field, list)
      : undefined
    const refListKey = list ? relatedListKeyForField(field, list) : undefined
    return relationship?.relationKind === 'one' && refListKey
      ? `${refListKey}WhereUniqueInput`
      : null
  }
  if (field.db?.isUnique !== true || field.kind === 'virtual') return null
  if (field.kind === 'checkbox') return 'Boolean'
  if (field.kind === 'select' && field.fieldMeta?.type === 'enum')
    return selectEnumTypeName(list, field)
  if (field.kind === 'select' && field.fieldMeta?.type === 'integer')
    return 'Int'
  if (field.kind === 'integer') return 'Int'
  if (field.kind === 'float') return 'Float'
  if (field.kind === 'timestamp') return 'DateTime'
  if (field.kind === 'calendarDay') return 'CalendarDay'
  if (field.kind === 'decimal') return 'Decimal'
  if (field.kind === 'bigInt') return 'BigInt'
  if (['json', 'document', 'structure', 'image', 'file'].includes(field.kind))
    return 'JSON'
  if (field.kind === 'multiselect') return '[String!]'
  return 'String'
}

const knownDocumentNodeTypes = new Set([
  'text',
  'link',
  'relationship',
  'paragraph',
  'heading',
  'blockquote',
  'layout-area',
  'code',
  'divider',
  'list-item',
  'list-item-content',
  'ordered-list',
  'unordered-list',
  'layout',
  'component-block',
  'component-block-prop',
  'component-inline-prop',
])

const blockDocumentNodeTypes = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'layout-area',
  'code',
  'divider',
  'list-item',
  'list-item-content',
  'ordered-list',
  'unordered-list',
  'layout',
  'component-block',
  'component-block-prop',
  'component-inline-prop',
])

const containerDocumentNodeTypes = new Set([
  'link',
  'relationship',
  ...blockDocumentNodeTypes,
])

const strictBasicBlockNodeTypes = new Set([
  'blockquote',
  'layout-area',
  'code',
  'divider',
  'list-item',
  'list-item-content',
  'ordered-list',
  'unordered-list',
])

type CmsDocumentNode = {
  type?: string
  children?: CmsDocumentNode[]
  text?: string
  level?: number
  relationship?: string
  data?: unknown
  [key: string]: unknown
}

const defaultDocumentValue = [
  { type: 'paragraph', children: [{ text: '' }] },
] satisfies CmsDocumentNode[]

const documentTextMarkKeys = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'code',
  'superscript',
  'subscript',
  'keyboard',
  'insertMenu',
] as const

function hasOnlyAllowedDocumentKeys(
  record: Record<string, unknown>,
  allowedKeys: string[],
) {
  return Object.keys(record).every((key) => allowedKeys.includes(key))
}

function isDocumentRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function isValidDocumentUrl(value: string) {
  const sanitized = sanitizeUrl(value)
  return value === sanitized || value === encodeURI(sanitized)
}

function normalizeDocumentNode(
  value: unknown,
  fieldPath?: string,
): CmsDocumentNode | null {
  if (!value || typeof value !== 'object') {
    if (fieldPath)
      throw validationFailure(
        `Invalid document structure: ${fieldPath} contains a malformed node`,
        { fieldPath },
      )
    return null
  }
  const record = value as Record<string, unknown>
  const type = typeof record.type === 'string' ? record.type : undefined
  const text = typeof record.text === 'string' ? record.text : undefined
  if (type && !knownDocumentNodeTypes.has(type)) {
    if (fieldPath)
      throw validationFailure(
        `Invalid document structure: ${fieldPath} contains an unknown node type`,
        { fieldPath },
      )
    return null
  }
  if (
    type &&
    containerDocumentNodeTypes.has(type) &&
    !Array.isArray(record.children)
  ) {
    if (fieldPath)
      throw validationFailure(
        `Invalid document structure: ${fieldPath} ${type} nodes must include a children array`,
        { fieldPath },
      )
    return null
  }
  const children = Array.isArray(record.children)
    ? record.children
        .map((child) => normalizeDocumentNode(child, fieldPath))
        .filter((child): child is CmsDocumentNode => child !== null)
    : undefined
  if (text !== undefined) {
    const allowedTextKeys = ['type', 'text', ...documentTextMarkKeys]
    if (!hasOnlyAllowedDocumentKeys(record, allowedTextKeys)) {
      if (fieldPath)
        throw validationFailure(
          `Invalid document structure: ${fieldPath} text nodes must not include unknown fields`,
          { fieldPath },
        )
      return null
    }
    for (const key of documentTextMarkKeys) {
      const markValue = record[key]
      if (markValue !== undefined && markValue !== true) {
        if (fieldPath)
          throw validationFailure(
            `Invalid document structure: ${fieldPath} text mark values must be true or omitted`,
            { fieldPath },
          )
        return null
      }
    }
  }
  if (type === 'link') {
    const href = typeof record.href === 'string' ? record.href : ''
    if (!isValidDocumentUrl(href)) {
      if (fieldPath)
        throw validationFailure(
          `Invalid document structure: ${fieldPath} link nodes must include a valid href`,
          { fieldPath },
        )
      return null
    }
    if (!hasOnlyAllowedDocumentKeys(record, ['type', 'href', 'children'])) {
      if (fieldPath)
        throw validationFailure(
          `Invalid document structure: ${fieldPath} link nodes must not include unknown fields`,
          { fieldPath },
        )
      return null
    }
  }
  if (
    (type === 'heading' || type === 'paragraph') &&
    record.textAlign !== undefined &&
    record.textAlign !== 'center' &&
    record.textAlign !== 'end'
  ) {
    if (fieldPath)
      throw validationFailure(
        `Invalid document structure: ${fieldPath} textAlign must be center, end, or omitted`,
        { fieldPath },
      )
    return null
  }
  if (type === 'heading') {
    const level = record.level
    if (typeof level !== 'number' || ![1, 2, 3, 4, 5, 6].includes(level)) {
      if (fieldPath)
        throw validationFailure(
          `Invalid document structure: ${fieldPath} heading nodes must include a level between 1 and 6`,
          { fieldPath },
        )
      return null
    }
    if (
      !hasOnlyAllowedDocumentKeys(record, [
        'type',
        'level',
        'textAlign',
        'children',
      ])
    ) {
      if (fieldPath)
        throw validationFailure(
          `Invalid document structure: ${fieldPath} heading nodes must not include unknown fields`,
          { fieldPath },
        )
      return null
    }
  }
  if (
    type === 'relationship' &&
    !hasOnlyAllowedDocumentKeys(record, [
      'type',
      'relationship',
      'data',
      'children',
    ])
  ) {
    if (fieldPath)
      throw validationFailure(
        `Invalid document structure: ${fieldPath} relationship nodes must not include unknown fields`,
        { fieldPath },
      )
    return null
  }
  if (
    type === 'paragraph' &&
    !hasOnlyAllowedDocumentKeys(record, ['type', 'textAlign', 'children'])
  ) {
    if (fieldPath)
      throw validationFailure(
        `Invalid document structure: ${fieldPath} paragraph nodes must not include unknown fields`,
        { fieldPath },
      )
    return null
  }
  if (type === 'layout') {
    if (
      !Array.isArray(record.layout) ||
      !record.layout.every((entry) => typeof entry === 'number')
    ) {
      if (fieldPath)
        throw validationFailure(
          `Invalid document structure: ${fieldPath} layout nodes must include a numeric layout array`,
          { fieldPath },
        )
      return null
    }
    if (!hasOnlyAllowedDocumentKeys(record, ['type', 'layout', 'children'])) {
      if (fieldPath)
        throw validationFailure(
          `Invalid document structure: ${fieldPath} layout nodes must not include unknown fields`,
          { fieldPath },
        )
      return null
    }
  }
  if (type === 'component-block') {
    if (typeof record.component !== 'string' || record.component.length === 0) {
      if (fieldPath)
        throw validationFailure(
          `Invalid document structure: ${fieldPath} component-block nodes must include a component string`,
          { fieldPath },
        )
      return null
    }
    if (!isDocumentRecord(record.props)) {
      if (fieldPath)
        throw validationFailure(
          `Invalid document structure: ${fieldPath} component-block nodes must include an object props value`,
          { fieldPath },
        )
      return null
    }
    if (
      !hasOnlyAllowedDocumentKeys(record, [
        'type',
        'component',
        'props',
        'children',
      ])
    ) {
      if (fieldPath)
        throw validationFailure(
          `Invalid document structure: ${fieldPath} component-block nodes must not include unknown fields`,
          { fieldPath },
        )
      return null
    }
  }
  if (type === 'component-block-prop' || type === 'component-inline-prop') {
    const propPath = record.propPath
    if (
      propPath !== undefined &&
      (!Array.isArray(propPath) ||
        !propPath.every(
          (entry) => typeof entry === 'string' || typeof entry === 'number',
        ))
    ) {
      if (fieldPath)
        throw validationFailure(
          `Invalid document structure: ${fieldPath} ${type} nodes must include a string/number propPath array when provided`,
          { fieldPath },
        )
      return null
    }
    if (!hasOnlyAllowedDocumentKeys(record, ['type', 'propPath', 'children'])) {
      if (fieldPath)
        throw validationFailure(
          `Invalid document structure: ${fieldPath} ${type} nodes must not include unknown fields`,
          { fieldPath },
        )
      return null
    }
  }
  if (
    type &&
    strictBasicBlockNodeTypes.has(type) &&
    !hasOnlyAllowedDocumentKeys(record, ['type', 'children'])
  ) {
    if (fieldPath)
      throw validationFailure(
        `Invalid document structure: ${fieldPath} ${type} nodes must not include unknown fields`,
        { fieldPath },
      )
    return null
  }
  if (!type && text === undefined && !children?.length) {
    if (fieldPath)
      throw validationFailure(
        `Invalid document structure: ${fieldPath} contains a malformed node`,
        { fieldPath },
      )
    return null
  }
  const textMarks = Object.fromEntries(
    documentTextMarkKeys
      .filter((key) => record[key] === true)
      .map((key) => [key, true]),
  )
  return {
    ...(type ? { type } : {}),
    ...(text !== undefined ? { text } : {}),
    ...textMarks,
    ...(children ? { children } : {}),
    ...(record.textAlign === 'center' || record.textAlign === 'end'
      ? { textAlign: record.textAlign }
      : {}),
    ...(typeof record.href === 'string' ? { href: record.href } : {}),
    ...(typeof record.level === 'number' ? { level: record.level } : {}),
    ...(typeof record.relationship === 'string'
      ? { relationship: record.relationship }
      : {}),
    ...(typeof record.component === 'string'
      ? { component: record.component }
      : {}),
    ...(Array.isArray(record.propPath) ? { propPath: record.propPath } : {}),
    ...(Array.isArray(record.layout) ? { layout: record.layout } : {}),
    ...('props' in record ? { props: record.props } : {}),
    ...('data' in record ? { data: record.data } : {}),
  }
}

function documentRelationshipsConfig(field: CmsField) {
  const relationships = field.fieldMeta?.relationships
  return relationships &&
    typeof relationships === 'object' &&
    !Array.isArray(relationships)
    ? (relationships as Record<string, unknown>)
    : {}
}

function documentComponentBlocksConfig(field: CmsField) {
  const componentBlocks = field.fieldMeta?.componentBlocks
  return componentBlocks &&
    typeof componentBlocks === 'object' &&
    !Array.isArray(componentBlocks)
    ? (componentBlocks as Record<string, unknown>)
    : {}
}

function validateDocumentRelationshipNode(
  field: CmsField,
  node: CmsDocumentNode,
) {
  if (node.type !== 'relationship') return node

  const relationshipKey =
    typeof node.relationship === 'string' ? node.relationship : ''
  const relationshipConfig = relationshipKey
    ? documentRelationshipsConfig(field)[relationshipKey]
    : undefined
  if (
    !relationshipConfig ||
    typeof relationshipConfig !== 'object' ||
    Array.isArray(relationshipConfig)
  ) {
    throw validationFailure(
      `${field.path} relationship nodes must reference a configured relationship`,
      { fieldPath: field.path },
    )
  }

  const data = node.data
  if (!isDocumentRecord(data)) {
    throw validationFailure(
      `${field.path} relationship nodes must include an object payload`,
      { fieldPath: field.path },
    )
  }

  if (!hasOnlyAllowedDocumentKeys(data, ['id', 'label', 'data'])) {
    throw validationFailure(
      `${field.path} relationship node data must not include unknown fields`,
      { fieldPath: field.path },
    )
  }

  const id = data.id
  if (typeof id !== 'string' || id.length === 0) {
    throw validationFailure(
      `${field.path} relationship nodes must include a string id`,
      { fieldPath: field.path },
    )
  }
  if (
    'label' in data &&
    data.label !== undefined &&
    typeof data.label !== 'string'
  ) {
    throw validationFailure(
      `${field.path} relationship node labels must be strings when provided`,
      { fieldPath: field.path },
    )
  }
  if (
    'data' in data &&
    data.data !== undefined &&
    !isDocumentRecord(data.data)
  ) {
    throw validationFailure(
      `${field.path} relationship node data.data must be an object when provided`,
      { fieldPath: field.path },
    )
  }

  return node
}

function validateDocumentComponentBlockPropsSchema(
  value: unknown,
  schema: unknown,
  fieldPath: string,
  componentPath: string,
  listKeys: Set<string>,
): void {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw validationFailure(
      `${fieldPath} component-block props must use a valid schema`,
      { fieldPath },
    )
  }
  const config = schema as Record<string, unknown>
  const kind = typeof config.kind === 'string' ? config.kind : ''

  if (kind === 'form') {
    if (typeof config.validate === 'function' && !config.validate(value)) {
      throw validationFailure(
        `${fieldPath} component-block form prop at ${componentPath} is invalid`,
        { fieldPath },
      )
    }
    return
  }
  if (kind === 'child') return

  if (kind === 'relationship') {
    const listKey = typeof config.listKey === 'string' ? config.listKey : ''
    if (!listKey) {
      throw validationFailure(
        `${fieldPath} component-block relationship props must reference a configured list`,
        { fieldPath },
      )
    }
    const many = config.many === true
    const values = many ? value : [value]
    if (
      !Array.isArray(values) ||
      values.some(
        (entry) =>
          entry !== null &&
          (!isDocumentRecord(entry) || typeof entry.id !== 'string'),
      )
    ) {
      throw validationFailure(
        `${fieldPath} component-block relationship prop at ${componentPath} is invalid`,
        { fieldPath },
      )
    }
    return
  }

  if (kind === 'object') {
    if (!isDocumentRecord(value)) {
      throw validationFailure(
        `${fieldPath} component-block object props at ${componentPath} must be objects`,
        { fieldPath },
      )
    }
    const fields = config.fields
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      throw validationFailure(
        `${fieldPath} component-block object props at ${componentPath} must define fields`,
        { fieldPath },
      )
    }
    const fieldEntries = fields as Record<string, unknown>
    for (const key of Object.keys(value)) {
      if (!(key in fieldEntries)) {
        throw validationFailure(
          `${fieldPath} component-block object props at ${componentPath} must not include unknown fields`,
          { fieldPath },
        )
      }
    }
    for (const [key, innerSchema] of Object.entries(fieldEntries)) {
      if (!(key in value)) continue
      validateDocumentComponentBlockPropsSchema(
        value[key],
        innerSchema,
        fieldPath,
        `${componentPath}.${key}`,
        listKeys,
      )
    }
    return
  }

  if (kind === 'array') {
    if (!Array.isArray(value)) {
      throw validationFailure(
        `${fieldPath} component-block array props at ${componentPath} must be arrays`,
        { fieldPath },
      )
    }
    const element = config.element
    value.forEach((entry, index) => {
      validateDocumentComponentBlockPropsSchema(
        entry,
        element,
        fieldPath,
        `${componentPath}[${index}]`,
        listKeys,
      )
    })
    return
  }

  if (kind === 'conditional') {
    if (!isDocumentRecord(value)) {
      throw validationFailure(
        `${fieldPath} component-block conditional props at ${componentPath} must be objects`,
        { fieldPath },
      )
    }
    const discriminant = value.discriminant
    const values = config.values
    if (
      (typeof discriminant !== 'string' &&
        typeof discriminant !== 'number' &&
        typeof discriminant !== 'boolean') ||
      !values ||
      typeof values !== 'object' ||
      Array.isArray(values)
    ) {
      throw validationFailure(
        `${fieldPath} component-block conditional props at ${componentPath} must include a valid discriminant`,
        { fieldPath },
      )
    }
    const branchKey = String(discriminant)
    const branchSchema = (values as Record<string, unknown>)[branchKey]
    if (!branchSchema) {
      throw validationFailure(
        `${fieldPath} component-block conditional props at ${componentPath} must reference a configured branch`,
        { fieldPath },
      )
    }
    validateDocumentComponentBlockPropsSchema(
      value.value,
      branchSchema,
      fieldPath,
      `${componentPath}.${branchKey}`,
      listKeys,
    )
    return
  }
}

function validateDocumentComponentBlockNode(
  field: CmsField,
  node: CmsDocumentNode,
) {
  if (node.type !== 'component-block') return node

  const componentKey = typeof node.component === 'string' ? node.component : ''
  const componentBlock = componentKey
    ? documentComponentBlocksConfig(field)[componentKey]
    : undefined
  if (
    !componentBlock ||
    typeof componentBlock !== 'object' ||
    Array.isArray(componentBlock)
  ) {
    throw validationFailure(
      `${field.path} component-block nodes must reference a configured component block`,
      { fieldPath: field.path },
    )
  }

  const schema = (componentBlock as Record<string, unknown>).schema
  const lists = new Set(cmsLists.map((list) => list.key))
  validateDocumentComponentBlockPropsSchema(
    node.props,
    { kind: 'object', fields: isDocumentRecord(schema) ? schema : {} },
    field.path,
    componentKey,
    lists,
  )

  return {
    ...node,
    props: normalizeDocumentComponentProps(node.props, {
      kind: 'object',
      fields: isDocumentRecord(schema) ? schema : {},
    }),
  }
}

function normalizeDocumentComponentProps(
  value: unknown,
  schema: unknown,
): unknown {
  if (!isDocumentRecord(schema)) return value
  const kind = schema.kind
  if (kind === 'child') return null
  if (kind === 'form') return value
  if (kind === 'relationship') {
    if (schema.many === true) {
      return Array.isArray(value)
        ? value.map((entry) => ({ id: (entry as Record<string, unknown>).id }))
        : []
    }
    return value === null ? null : { id: (value as Record<string, unknown>).id }
  }
  if (kind === 'object') {
    const source = isDocumentRecord(value) ? value : {}
    const fields = isDocumentRecord(schema.fields) ? schema.fields : {}
    return Object.fromEntries(
      Object.entries(fields).flatMap(([key, childSchema]) => {
        const normalized = normalizeDocumentComponentProps(
          source[key],
          childSchema,
        )
        return normalized === undefined ? [] : [[key, normalized]]
      }),
    )
  }
  if (kind === 'array') {
    return Array.isArray(value)
      ? value.map((entry) =>
          normalizeDocumentComponentProps(entry, schema.element),
        )
      : []
  }
  if (kind === 'conditional' && isDocumentRecord(value)) {
    const values = isDocumentRecord(schema.values) ? schema.values : {}
    return {
      discriminant: normalizeDocumentComponentProps(
        value.discriminant,
        schema.discriminant,
      ),
      value: normalizeDocumentComponentProps(
        value.value,
        values[String(value.discriminant)],
      ),
    }
  }
  return value
}

function validateDocumentNodes(
  field: CmsField,
  nodes: CmsDocumentNode[],
): CmsDocumentNode[] {
  return nodes.map((node) => {
    const relationshipValidated = validateDocumentRelationshipNode(field, node)
    const validated = validateDocumentComponentBlockNode(
      field,
      relationshipValidated,
    )
    if (!Array.isArray(validated.children)) return validated
    return {
      ...validated,
      children: validateDocumentNodes(field, validated.children),
    }
  })
}

function normalizeDocumentNodes(
  value: unknown,
  field?: CmsField,
): CmsDocumentNode[] {
  if (!Array.isArray(value)) {
    if (field)
      throw validationFailure(
        `Invalid document structure: ${field.path} document fields must be arrays of structured nodes`,
        { fieldPath: field.path },
      )
    return []
  }
  const nodes = value
    .map((node) => normalizeDocumentNode(node, field?.path))
    .filter((node): node is CmsDocumentNode => node !== null)
  if (
    field &&
    nodes.some(
      (node) =>
        typeof node.type === 'string' && !blockDocumentNodeTypes.has(node.type),
    )
  ) {
    throw validationFailure(
      `Invalid document structure: ${field.path} top-level document nodes must be block nodes`,
      { fieldPath: field.path },
    )
  }
  return field ? validateDocumentNodes(field, nodes) : nodes
}

async function hydrateDocumentRelationshipData(
  node: CmsDocumentNode,
  field: CmsField,
  context: CmsContext,
): Promise<CmsDocumentNode> {
  const relationshipMap = documentRelationshipsConfig(field)
  const relationshipKey =
    typeof node.relationship === 'string' ? node.relationship : undefined
  const relationshipConfig = relationshipKey
    ? relationshipMap[relationshipKey]
    : undefined
  const config =
    relationshipConfig &&
    typeof relationshipConfig === 'object' &&
    !Array.isArray(relationshipConfig)
      ? (relationshipConfig as Record<string, unknown>)
      : undefined
  const listKey =
    typeof config?.listKey === 'string' ? config.listKey : undefined
  const data =
    node.data && typeof node.data === 'object' && !Array.isArray(node.data)
      ? (node.data as Record<string, unknown>)
      : undefined
  const itemId = data?.id
  if (node.type !== 'relationship' || !listKey || typeof itemId !== 'string')
    return node

  const labelField =
    typeof config?.labelField === 'string' ? config.labelField : 'id'
  const selection =
    typeof config?.selection === 'string' && config.selection.trim()
      ? config.selection
      : ''
  const related = await context.query[listKey].findOne({
    where: { id: itemId },
    query: `${labelField}${selection ? ` ${selection}` : ''}`,
  })

  const relatedRecord =
    related && typeof related === 'object' && !Array.isArray(related)
      ? (related as Record<string, unknown>)
      : null
  return {
    ...node,
    data: relatedRecord
      ? {
          id: itemId,
          label:
            typeof relatedRecord[labelField] === 'string'
              ? relatedRecord[labelField]
              : undefined,
          data: relatedRecord,
        }
      : { id: itemId, label: undefined, data: undefined },
  }
}

async function hydrateComponentPropRelationship(
  schema: unknown,
  value: unknown,
  context: CmsContext,
): Promise<unknown> {
  if (!isDocumentRecord(schema)) return value
  if (schema.kind === 'form' || schema.kind === 'child') return value
  if (schema.kind === 'relationship') {
    const listKey = typeof schema.listKey === 'string' ? schema.listKey : ''
    const selection =
      typeof schema.selection === 'string' ? schema.selection.trim() : ''
    const list = (context.__internal.lists ?? cmsLists).find(
      (entry) => entry.key === listKey,
    )
    if (!list) return schema.many === true ? [] : null
    const labelField = list.labelField || 'id'
    const query = `${labelField}${selection ? ` ${selection}` : ''}`
    const hydrateOne = async (entry: unknown) => {
      if (!isDocumentRecord(entry) || typeof entry.id !== 'string') return null
      const related = await context.query[listKey].findOne({
        where: { id: entry.id },
        query,
      })
      if (!isDocumentRecord(related))
        return { id: entry.id, label: undefined, data: undefined }
      return {
        id: entry.id,
        label:
          typeof related[labelField] === 'string'
            ? related[labelField]
            : undefined,
        data: related,
      }
    }
    if (schema.many === true) {
      const hydrated = await Promise.all(
        (Array.isArray(value) ? value : []).map(hydrateOne),
      )
      return hydrated.filter((entry) => entry !== null)
    }
    return value === null ? null : hydrateOne(value)
  }
  if (schema.kind === 'object') {
    const source = isDocumentRecord(value) ? value : {}
    const fields = isDocumentRecord(schema.fields) ? schema.fields : {}
    return Object.fromEntries(
      await Promise.all(
        Object.entries(fields).map(async ([key, child]) => [
          key,
          source[key] === undefined
            ? undefined
            : await hydrateComponentPropRelationship(
                child,
                source[key],
                context,
              ),
        ]),
      ),
    )
  }
  if (schema.kind === 'array') {
    return Promise.all(
      (Array.isArray(value) ? value : []).map((entry) =>
        hydrateComponentPropRelationship(schema.element, entry, context),
      ),
    )
  }
  if (schema.kind === 'conditional' && isDocumentRecord(value)) {
    const values = isDocumentRecord(schema.values) ? schema.values : {}
    return {
      discriminant: value.discriminant,
      value: await hydrateComponentPropRelationship(
        values[String(value.discriminant)],
        value.value,
        context,
      ),
    }
  }
  return value
}

async function hydrateDocumentComponentBlockData(
  node: CmsDocumentNode,
  field: CmsField,
  context: CmsContext,
): Promise<CmsDocumentNode> {
  if (node.type !== 'component-block' || typeof node.component !== 'string')
    return node
  const block = documentComponentBlocksConfig(field)[node.component]
  if (!isDocumentRecord(block) || !isDocumentRecord(block.schema)) return node
  return {
    ...node,
    props: await hydrateComponentPropRelationship(
      { kind: 'object', fields: block.schema },
      node.props,
      context,
    ),
  }
}

async function hydrateDocumentNodes(
  nodes: CmsDocumentNode[],
  field: CmsField,
  context: CmsContext,
): Promise<CmsDocumentNode[]> {
  return Promise.all(
    nodes.map(async (node) => {
      const relationshipHydrated = await hydrateDocumentRelationshipData(
        node,
        field,
        context,
      )
      const hydratedNode = await hydrateDocumentComponentBlockData(
        relationshipHydrated,
        field,
        context,
      )
      if (!Array.isArray(hydratedNode.children)) return hydratedNode
      return {
        ...hydratedNode,
        children: await hydrateDocumentNodes(
          hydratedNode.children,
          field,
          context,
        ),
      }
    }),
  )
}

function normalizeDocumentInput(
  field: CmsField,
  value: unknown,
  operation: 'create' | 'update',
) {
  if (value === undefined) {
    return operation === 'create'
      ? { document: defaultDocumentValue }
      : undefined
  }
  if (value === null)
    throw validationFailure(
      `${field.path} document fields cannot be set to null`,
      { fieldPath: field.path },
    )

  const rawDocument =
    typeof value === 'object' && !Array.isArray(value) && 'document' in value
      ? (value as { document?: unknown }).document
      : value

  const document = normalizeDocumentNodes(rawDocument, field)
  if (document.length === 0)
    throw validationFailure(`${field.path} must be a valid document value`, {
      fieldPath: field.path,
    })
  return { document }
}

async function normalizeFileImageInput(
  field: CmsField,
  value: unknown,
  context: CmsContext,
) {
  if (value === null || value === undefined) return value
  const record = asRecord(value)
  if ('upload' in record) {
    const storageKey =
      typeof field.fieldMeta?.storage === 'string'
        ? field.fieldMeta.storage
        : undefined
    if (!storageKey)
      throw configFailure(
        `${field.path} requires a configured storage key for Upload input`,
        { fieldPath: field.path, operation: 'upload' },
      )
    const storage = context.__internal.storage?.[storageKey]
    if (!storage)
      throw configFailure(
        `${field.path} references unknown storage ${storageKey}`,
        { fieldPath: field.path, operation: 'upload', storageKey },
      )
    const transformName =
      typeof field.fieldMeta?.transformName === 'function'
        ? (field.fieldMeta.transformName as (
            originalFilename: string,
          ) => string | Promise<string>)
        : undefined
    return storedGraphQLUploadResponse(
      storageKey,
      record.upload,
      transformName,
      storage,
      context.__internal.mutationState
        ? (stored) =>
            context.__internal.mutationState?.deferRollback(() =>
              deleteStoredObject(storageKey, stored.filename, storage),
            )
        : undefined,
    )
  }
  throw validationFailure(`${field.path} must be provided as an Upload input`, {
    fieldPath: field.path,
  })
}

async function normalizeMutationInputData(
  list: CmsList,
  data: Record<string, unknown>,
  operation: 'create' | 'update',
  context: CmsContext,
) {
  const normalized = { ...data }
  for (const field of list.fields) {
    if (field.kind === 'document') {
      const nextValue = normalizeDocumentInput(
        field,
        normalized[field.path],
        operation,
      )
      if (nextValue !== undefined) normalized[field.path] = nextValue
      continue
    }
    if (
      (field.kind === 'image' || field.kind === 'file') &&
      field.path in normalized
    )
      normalized[field.path] = await normalizeFileImageInput(
        field,
        normalized[field.path],
        context,
      )
  }
  return normalized
}

function normalizeStoredFieldOutput(
  field: CmsField,
  value: unknown,
  context: CmsContext,
) {
  const record = asRecord(value)
  if (Object.keys(record).length === 0) return null
  const storageKey =
    typeof field.fieldMeta?.storage === 'string'
      ? field.fieldMeta.storage
      : undefined
  const storage = storageKey
    ? (context.__internal.storage?.[storageKey] ?? getStorageConfig(storageKey))
    : undefined
  if (field.kind === 'file') {
    const filename = record.filename
    const filesize = record.filesize
    const url =
      typeof filename === 'string' && storage
        ? getSignedStorageUrl(storage, filename)
        : record.url
    if (
      typeof filename !== 'string' ||
      typeof filesize !== 'number' ||
      typeof url !== 'string'
    )
      return null
    return { filename, filesize, url }
  }
  const id = record.id
  const extension = record.extension
  const filesize = record.filesize
  const filename =
    typeof record.filename === 'string'
      ? record.filename
      : typeof id === 'string' && typeof extension === 'string'
        ? `${id}.${extension}`
        : undefined
  const url =
    typeof filename === 'string' && storage
      ? getSignedStorageUrl(storage, filename)
      : record.url
  if (
    typeof id !== 'string' ||
    typeof url !== 'string' ||
    typeof extension !== 'string' ||
    typeof filesize !== 'number'
  )
    return null
  return {
    id,
    url,
    extension: ['png', 'jpg', 'gif', 'webp'].includes(extension)
      ? extension
      : 'png',
    filesize,
    width: typeof record.width === 'number' ? record.width : 0,
    height: typeof record.height === 'number' ? record.height : 0,
  }
}

function getUniqueFields(list: CmsList) {
  return list.fields.filter(
    (field) =>
      field.kind === 'id' ||
      ((field.db?.isUnique === true ||
        (field.kind === 'relationship' &&
          resolvedRelationshipMetadata(field, list)?.relationKind === 'one')) &&
        field.graphql?.isEnabled?.filter !== false),
  )
}

function isOrderable(field: CmsField) {
  return (
    field.graphql?.isEnabled?.orderBy ??
    (field.isOrderable === false ? false : !nonOrderableKinds.has(field.kind))
  )
}

function generateListTypeDefs(
  list: CmsList,
  names: GraphQLNames,
  namesByListKey: Record<string, GraphQLNames>,
  kind: CmsGraphQLSchemaKind = 'public',
  listsByKey: Record<string, CmsList> = Object.fromEntries(
    cmsLists.map((entry) => [entry.key, entry]),
  ),
) {
  const visibleFields = list.fields.filter((field) =>
    isRelationshipRefVisible(field, list, listsByKey, kind),
  )

  const enumTypeDefs = visibleFields
    .flatMap((field) => {
      if (field.kind === 'select' && field.fieldMeta?.type === 'enum') {
        const values = selectEnumValues(field)
        if (values.length === 0) return []
        const enumType = selectEnumTypeName(list, field)
        const filterType = selectEnumFilterInputName(list, field)
        return [
          `enum ${enumType} {\n    ${values.join('\n    ')}\n  }`,
          `input ${filterType} {\n    equals: ${enumType}\n    in: [${enumType}!]\n    notIn: [${enumType}!]\n    not: ${filterType}\n  }`,
        ]
      }
      if (field.kind === 'document') {
        return [
          `type ${list.key}_${field.path}_Document {\n    document(hydrateRelationships: Boolean! = false): JSON!\n  }`,
        ]
      }
      if (field.kind === 'structure')
        return structureTypesForField(field, list)?.definitions ?? []
      if (field.kind === 'multiselect' && field.fieldMeta?.type === 'enum') {
        const values = multiselectEnumValues(field)
        if (values.length === 0) return []
        const enumType = multiselectEnumTypeName(list, field)
        const filterType = multiselectEnumFilterInputName(list, field)
        return [
          `enum ${enumType} {\n    ${values.join('\n    ')}\n  }`,
          `input ${filterType} {\n    equals: [${enumType}!]\n    has: ${enumType}\n    hasSome: [${enumType}!]\n    hasEvery: [${enumType}!]\n    isEmpty: Boolean\n  }`,
        ]
      }
      if (
        field.kind === 'virtual' &&
        Array.isArray(field.fieldMeta?.virtualTypeDefs)
      )
        return field.fieldMeta.virtualTypeDefs.filter(
          (typeDef): typeDef is string => typeof typeDef === 'string',
        )
      return []
    })
    .join('\n\n  ')

  const outputFields = visibleFields
    .flatMap((field) => {
      const outputType = fieldOutputType(field, kind, list)
      if (!outputType) return []
      const fields = [
        field.kind === 'relationship' && field.many
          ? `${field.path}${relationshipArgsSDL(namesByListKey, field, list)}: ${outputType}`
          : `${field.path}: ${outputType}`,
      ]
      if (field.kind === 'relationship' && field.many) {
        const refListKey = relatedListKeyForField(field, list)
        if (!refListKey) return fields
        const relatedNames = namesByListKey[refListKey]
        fields.push(
          `${field.path}Count(where: ${relatedNames.whereInputName}! = {}): Int`,
        )
      }
      return fields
    })
    .join('\n    ')

  const whereFields = visibleFields
    .map((field) => {
      const type = fieldFilterType(field, namesByListKey, list)
      return type ? `${field.path}: ${type}` : null
    })
    .filter(Boolean)
    .join('\n    ')

  const createFields = visibleFields
    .map((field) => {
      const type = fieldInputType(field, 'create', namesByListKey, kind, list)
      return type ? `${field.path}: ${type}` : null
    })
    .filter(Boolean)
    .join('\n    ')

  const updateFields = visibleFields
    .map((field) => {
      const type = fieldInputType(field, 'update', namesByListKey, kind, list)
      return type ? `${field.path}: ${type}` : null
    })
    .filter(Boolean)
    .join('\n    ')

  const orderableFields = visibleFields.filter(isOrderable)
  const orderFields = (
    orderableFields.length
      ? orderableFields
      : visibleFields.filter((field) => field.path === 'id')
  )
    .map((field) => `${field.path}: OrderDirection`)
    .join('\n    ')

  const whereUniqueFields = getUniqueFields({ ...list, fields: visibleFields })
    .map((field) => {
      const type = fieldUniqueInputType(field, list)
      return type ? `${field.path}: ${type}` : null
    })
    .filter(Boolean)
    .join('\n    ')
  const incomingRelationships = Object.values(listsByKey).flatMap(
    (sourceList) =>
      sourceList.fields.flatMap((field) => {
        if (
          field.kind === 'relationship' &&
          relatedListKeyForField(field, sourceList) === list.key
        )
          return [{ many: field.many === true }]
        if (field.kind !== 'structure') return []
        const schema = structureSchemaForField(field)
        return schema
          ? structureRelationshipReferences(schema).filter(
              (relationship) => relationship.listKey === list.key,
            )
          : []
      }),
  )
  const hasIncomingToOne = incomingRelationships.some(
    (field) => field.many !== true,
  )
  const hasIncomingToMany = incomingRelationships.some(
    (field) => field.many === true,
  )
  const toOneInputTypeDefs = hasIncomingToOne
    ? `
  input ${names.relateToOneForCreateInputName} {
    connect: ${names.whereUniqueInputName}
    create: ${names.createInputName}
  }

  input ${names.relateToOneForUpdateInputName} {
    connect: ${names.whereUniqueInputName}
    create: ${names.createInputName}
    disconnect: Boolean
  }`
    : ''
  const toManyInputTypeDefs = hasIncomingToMany
    ? `
  input ${list.key}ManyRelationFilter {
    some: ${names.whereInputName}
    none: ${names.whereInputName}
    every: ${names.whereInputName}
  }

  input ${names.relateToManyForCreateInputName} {
    connect: [${names.whereUniqueInputName}!]
    create: [${names.createInputName}!]
  }

  input ${names.relateToManyForUpdateInputName} {
    connect: [${names.whereUniqueInputName}!]
    create: [${names.createInputName}!]
    disconnect: [${names.whereUniqueInputName}!]
    set: [${names.whereUniqueInputName}!]
  }`
    : ''

  return /* GraphQL */ `
  ${enumTypeDefs}

  type ${names.outputTypeName} {
    ${outputFields}
  }

  input ${names.whereUniqueInputName} {
    ${whereUniqueFields}
  }

  input ${names.whereInputName} {
    AND: [${names.whereInputName}!]
    OR: [${names.whereInputName}!]
    NOT: [${names.whereInputName}!]
    ${whereFields}
  }

  ${toManyInputTypeDefs}

  input ${names.createInputName} {
    ${createFields}
  }

  input ${names.updateInputName} {
    ${updateFields}
  }

  input ${names.updateManyInputName} {
    where: ${names.whereUniqueInputName}!
    data: ${names.updateInputName}!
  }

  input ${names.listOrderName} {
    ${orderFields}
  }

  ${toOneInputTypeDefs}
`
}

function isListOperationOmitted(
  list: CmsList,
  operation: 'query' | 'create' | 'update' | 'delete',
  kind: CmsGraphQLSchemaKind,
) {
  return kind === 'public' && isOmitted(list.graphql?.omit, operation)
}

function generateCrudSchema(
  lists: CmsList[] = cmsLists,
  kind: CmsGraphQLSchemaKind = 'public',
) {
  const namesByListKey = graphQLNamesForLists(lists)
  const listsByKey = Object.fromEntries(
    lists.map((entry) => [entry.key, entry]),
  )
  const visibleLists = lists.filter(
    (list) => !(kind === 'public' && list.graphql?.omit === true),
  )
  const listTypeDefs = visibleLists
    .map((list) =>
      generateListTypeDefs(
        list,
        namesByListKey[list.key],
        namesByListKey,
        kind,
        listsByKey,
      ),
    )
    .join('\n')
  const queryFields = visibleLists
    .map((list) => {
      const names = namesByListKey[list.key]
      if (isListOperationOmitted(list, 'query', kind)) return ''
      return `
    ${names.itemQueryName}(where: ${list.isSingleton ? names.whereUniqueInputName : `${names.whereUniqueInputName}!`}): ${names.outputTypeName}
    ${names.listQueryName}(where: ${names.whereInputName}! = {}, orderBy: [${names.listOrderName}!]! = [], take: Int, skip: Int! = 0, cursor: ${names.whereUniqueInputName}): [${names.outputTypeName}!]
    ${names.listQueryCountName}(where: ${names.whereInputName}! = {}): Int`
    })
    .join('\n')
  const mutationFields = lists
    .map((list) => {
      const names = namesByListKey[list.key]
      const fields = []
      if (!isListOperationOmitted(list, 'create', kind))
        fields.push(
          `${names.createMutationName}(data: ${names.createInputName}!): ${names.outputTypeName}`,
          `${names.createManyMutationName}(data: [${names.createInputName}!]!): [${names.outputTypeName}]`,
        )
      if (!isListOperationOmitted(list, 'update', kind))
        fields.push(
          `${names.updateMutationName}(where: ${names.whereUniqueInputName}!, data: ${names.updateInputName}!): ${names.outputTypeName}`,
          `${names.updateManyMutationName}(data: [${names.updateManyInputName}!]!): [${names.outputTypeName}]`,
        )
      if (!isListOperationOmitted(list, 'delete', kind))
        fields.push(
          `${names.deleteMutationName}(where: ${names.whereUniqueInputName}!): ${names.outputTypeName}`,
          `${names.deleteManyMutationName}(where: [${names.whereUniqueInputName}!]!): [${names.outputTypeName}]`,
        )
      for (const [actionKey, action] of Object.entries(list.actions ?? {})) {
        const oneName = action.graphql?.singular ?? `${actionKey}${list.key}`
        const manyName =
          action.graphql?.plural ??
          `${actionKey}${list.plural.replace(/\s+/g, '')}`
        fields.push(
          `${oneName}(where: ${names.whereUniqueInputName}!): ${names.outputTypeName}`,
        )
        fields.push(
          `${manyName}(where: [${names.whereUniqueInputName}!]!): [${names.outputTypeName}]`,
        )
      }
      return fields.map((field) => `    ${field}`).join('\n')
    })
    .join('\n')

  return /* GraphQL */ `
${commonTypeDefs}
${listTypeDefs}

type Query {
  keystone: KeystoneMeta!
  ${queryFields}
}

type Mutation {
  ${mutationFields}
}
`
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asWhereUnique(value: unknown) {
  return asRecord(value)
}

function singletonItemWhereUnique(list: CmsList) {
  return list.isSingleton ? { id: '1' } : undefined
}

function singletonCountWhere(list: CmsList) {
  return list.isSingleton ? { id: { equals: '1' } } : undefined
}

function effectiveWhereUnique(list: CmsList, value: unknown) {
  const where = asWhereUnique(value)
  if (Object.keys(where).length > 0) return where
  return singletonItemWhereUnique(list) ?? where
}

function effectiveCountWhere(list: CmsList, value: unknown) {
  if (value !== undefined) return value
  return singletonCountWhere(list) ?? {}
}

function asInputList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : []
}

function parseQuerySelection(query: string | undefined, fallback = 'id') {
  return query?.trim() ? query : fallback
}

function promisesButSettledWhenAllSettledAndInOrder<T>(
  promises: Array<T | Promise<T>>,
) {
  const resultsPromise = Promise.allSettled(promises)
  return promises.map(async (_promise, index) => {
    const result = (await resultsPromise)[index]
    if (result.status === 'fulfilled') return result.value
    throw result.reason
  })
}

function documentFrom(query: string | DocumentNode) {
  return typeof query === 'string' ? parse(query) : query
}

function getRootTypeName(type: GraphQLOutputType): string {
  if (type instanceof GraphQLNonNull) {
    return getRootTypeName(type.ofType)
  }
  if (type instanceof GraphQLList) {
    return getRootTypeName(type.ofType)
  }
  return type.name
}

function getNamedOrListTypeNodeForType(
  type:
    | GraphQLScalarType
    | GraphQLObjectType<any, any>
    | GraphQLInterfaceType
    | GraphQLUnionType
    | GraphQLEnumType
    | GraphQLInputObjectType
    | GraphQLList<any>,
): NamedTypeNode | ListTypeNode {
  if (type instanceof GraphQLList) {
    return { kind: Kind.LIST_TYPE, type: getTypeNodeForType(type.ofType) }
  }
  return { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: type.name } }
}

function getTypeNodeForType(type: GraphQLType): TypeNode {
  if (type instanceof GraphQLNonNull) {
    return {
      kind: Kind.NON_NULL_TYPE,
      type: getNamedOrListTypeNodeForType(type.ofType),
    }
  }
  return getNamedOrListTypeNodeForType(type)
}

function getVariablesForGraphQLField(field: GraphQLField<any, any>) {
  const variableDefinitions = field.args.map((arg): any => ({
    kind: Kind.VARIABLE_DEFINITION,
    type: getTypeNodeForType(arg.type),
    variable: {
      kind: Kind.VARIABLE,
      name: { kind: Kind.NAME, value: arg.name },
    },
    defaultValue:
      arg.defaultValue === undefined
        ? undefined
        : (astFromValue(arg.defaultValue, arg.type) as ConstValueNode),
  }))

  const argumentNodes = field.args.map(
    (arg): ArgumentNode => ({
      kind: Kind.ARGUMENT,
      name: { kind: Kind.NAME, value: arg.name },
      value: {
        kind: Kind.VARIABLE,
        name: { kind: Kind.NAME, value: arg.name },
      },
    }),
  )

  return { variableDefinitions, argumentNodes }
}

const rawField = 'raw'
const RawScalar = new GraphQLScalarType({
  name: 'RawThingPlsDontRelyOnThisAnywhere',
  serialize: (value) => value,
})
const ReturnRawValueObjectType = new GraphQLObjectType({
  name: 'ReturnRawValue',
  fields: {
    [rawField]: {
      type: RawScalar,
      resolve(source) {
        return source
      },
    },
  },
})

type RequiredButStillAllowUndefined<
  T extends Record<string, any>,
  TKey extends keyof T = keyof T,
> = {
  [K in TKey]: T[K]
}

function argsToArgsConfig(args: readonly GraphQLArgument[]) {
  return Object.fromEntries(
    args.map((arg) => {
      const argConfig: RequiredButStillAllowUndefined<GraphQLArgumentConfig> = {
        astNode: arg.astNode,
        defaultValue: arg.defaultValue,
        deprecationReason: arg.deprecationReason,
        description: arg.description,
        extensions: arg.extensions,
        type: arg.type,
      }
      return [arg.name, argConfig]
    }),
  )
}

type OutputTypeWithoutNonNull = GraphQLObjectType | GraphQLList<OutputType>
type OutputType =
  | OutputTypeWithoutNonNull
  | GraphQLNonNull<OutputTypeWithoutNonNull>

function getTypeForField(originalType: GraphQLOutputType): OutputType {
  if (originalType instanceof GraphQLNonNull) {
    return new GraphQLNonNull(
      getTypeForField(originalType.ofType),
    ) as OutputType
  }
  if (originalType instanceof GraphQLList) {
    return new GraphQLList(getTypeForField(originalType.ofType)) as OutputType
  }
  return ReturnRawValueObjectType
}

function getSourceGivenOutputType(originalType: OutputType, value: any): any {
  if (originalType instanceof GraphQLNonNull) {
    return getSourceGivenOutputType(originalType.ofType, value)
  }
  if (value === null) return null
  if (originalType instanceof GraphQLList) {
    return value.map((entry: any) =>
      getSourceGivenOutputType(originalType.ofType, entry),
    )
  }
  return value[rawField]
}

export function makeContextDbFn(field: GraphQLField<any, unknown>) {
  const { argumentNodes, variableDefinitions } =
    getVariablesForGraphQLField(field)
  const document: DocumentNode = {
    kind: Kind.DOCUMENT,
    definitions: [
      {
        kind: Kind.OPERATION_DEFINITION,
        operation: OperationTypeNode.QUERY,
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: field.name },
              arguments: argumentNodes,
              selectionSet: {
                kind: Kind.SELECTION_SET,
                selections: [
                  {
                    kind: Kind.FIELD,
                    name: { kind: Kind.NAME, value: rawField },
                  },
                ],
              },
            },
          ],
        },
        variableDefinitions: variableDefinitions as any,
      },
    ],
  }

  const type = getTypeForField(field.type)
  const fieldConfig: RequiredButStillAllowUndefined<
    GraphQLFieldConfig<unknown, unknown>
  > = {
    args: argsToArgsConfig(field.args),
    astNode: undefined,
    deprecationReason: field.deprecationReason,
    description: field.description,
    extensions: field.extensions,
    resolve: field.resolve,
    subscribe: field.subscribe,
    type,
  }

  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        [field.name]: fieldConfig,
      },
    }),
    assumeValid: true,
  })

  return async (
    args: Record<string, unknown>,
    context: CmsContext,
    rootValue: Record<string, unknown> = {},
  ) => {
    const result = await execute({
      schema,
      document,
      contextValue: context,
      variableValues: Object.fromEntries(
        Object.entries(args).filter(([, value]) => value !== undefined),
      ),
      rootValue,
    })
    if (result.errors?.length) throw result.errors[0]
    return getSourceGivenOutputType(type, result.data![field.name])
  }
}

function wrapManyContextFailure(error: unknown, tag: string) {
  if (
    error instanceof GraphQLError &&
    error.extensions.code === 'KS_RESOLVER_ERROR'
  )
    throw error
  const wrapped = error instanceof Error ? error : new Error(String(error))
  throw resolverFailure([{ error: wrapped, tag }])
}

function contextWithAdapter(
  context: CmsContext,
  adapter = context.adapter,
): CmsContext {
  if (adapter === context.adapter) return context
  return buildCmsContext({
    adapter,
    session: context.session,
    sudo: context.__internal.sudo,
    internal: context.__internal.internal,
    schema: context.graphql.schema,
    request: context.__internal.request,
    responseHeaders: context.__internal.responseHeaders,
    lists: context.__internal.lists,
    storage: context.__internal.storage,
  })
}

async function withAdapterTransaction<T>(
  context: CmsContext,
  fn: (transactionContext: CmsContext) => Promise<T>,
  options?: CmsTransactionOptions,
) {
  return context.adapter.transaction
    ? context.adapter.transaction(
        (adapter) => fn(contextWithAdapter(context, adapter)),
        options,
      )
    : fn(context)
}

async function withMutationUploadRollback<T>(
  context: CmsContext,
  fn: (mutationContext: CmsContext) => Promise<T>,
) {
  const mutationState = new CmsMutationState()
  const mutationContext = withMutationState(context, mutationState)
  try {
    const result = await fn(mutationContext)
    mutationState.clearRollback()
    return result
  } catch (error) {
    try {
      await mutationState.rollback()
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Mutation failed and upload rollback also failed',
      )
    }
    throw error
  }
}

async function executeGraphQLField(
  context: CmsContext,
  source: string,
  variables: Record<string, unknown>,
  fieldName: string,
) {
  const result = await context.graphql.run({ query: source, variables })
  return result[fieldName]
}

export function makeContextQueryFn(
  schema: GraphQLSchema,
  operation: 'query' | 'mutation',
  field: GraphQLField<any, unknown>,
) {
  const { argumentNodes, variableDefinitions } =
    getVariablesForGraphQLField(field)
  const rootName = getRootTypeName(field.type)

  const exec = async (
    args: Record<string, unknown>,
    query: string,
    context: CmsContext,
  ) => {
    const selectionSet = (
      parse(`fragment x on ${rootName} {${query}}`)
        .definitions[0] as FragmentDefinitionNode
    ).selectionSet

    const document: DocumentNode = {
      kind: Kind.DOCUMENT,
      definitions: [
        {
          kind: Kind.OPERATION_DEFINITION,
          operation: operation as OperationTypeNode,
          selectionSet: {
            kind: Kind.SELECTION_SET,
            selections: [
              {
                kind: Kind.FIELD,
                name: { kind: Kind.NAME, value: field.name },
                arguments: argumentNodes,
                selectionSet,
              },
            ],
          },
          variableDefinitions: variableDefinitions as any,
        },
      ],
    }

    const validationErrors = validate(schema, document)
    if (validationErrors.length > 0) throw validationErrors[0]

    const result = await execute({
      schema,
      document,
      contextValue: context,
      variableValues: Object.fromEntries(
        Object.entries(args).filter(([, value]) => value !== undefined),
      ),
      rootValue: {},
    })
    if (result.errors?.length) throw result.errors[0]
    return result.data?.[field.name]
  }

  return (
    _args: { query?: string } & Record<string, unknown> = {},
    context: CmsContext,
  ) => {
    const { query, ...args } = _args
    return exec(args, query ?? 'id', context)
  }
}

function unsupportedContextOperation(
  kind: 'query' | 'mutation',
  fieldName: string,
) {
  return async () => {
    throw new Error(
      `This ${kind} is not supported by the GraphQL schema: ${fieldName}()`,
    )
  }
}

function buildContextDbApi(
  list: CmsList,
  context: CmsContext,
  _kind: CmsGraphQLSchemaKind,
) {
  const names = getGraphQLNames(list.key, list.plural)
  const queryType = context.graphql.schema.getQueryType()
  const mutationType = context.graphql.schema.getMutationType()

  function schemaDerived(operation: 'query' | 'mutation', fieldName: string) {
    const rootType = operation === 'query' ? queryType : mutationType
    const field = rootType?.getFields()[fieldName]
    if (!field) return unsupportedContextOperation(operation, fieldName)
    return makeContextDbFn(field)
  }

  const fcache = {
    findOne: schemaDerived('query', names.itemQueryName),
    findMany: schemaDerived('query', names.listQueryName),
    count: schemaDerived('query', names.listQueryCountName),
    createOne: schemaDerived('mutation', names.createMutationName),
    createMany: schemaDerived('mutation', names.createManyMutationName),
    updateOne: schemaDerived('mutation', names.updateMutationName),
    updateMany: schemaDerived('mutation', names.updateManyMutationName),
    deleteOne: schemaDerived('mutation', names.deleteMutationName),
    deleteMany: schemaDerived('mutation', names.deleteManyMutationName),
  }

  return {
    findOne: (
      args: { where?: { id?: string | number | null } } = {},
      rootValue: Record<string, unknown> = {},
    ) => {
      const where = effectiveWhereUnique(list, args.where)
      return fcache.findOne({ where }, context, rootValue)
    },
    findMany: (
      args: Omit<
        Parameters<CmsContext['adapter']['findMany']>[1],
        'context'
      > = {},
      rootValue: Record<string, unknown> = {},
    ) =>
      fcache.findMany(
        {
          where: args.where,
          orderBy: args.orderBy,
          take: args.take,
          skip: args.skip,
          cursor: args.cursor,
        },
        context,
        rootValue,
      ),
    count: (
      args: { where?: unknown } = {},
      rootValue: Record<string, unknown> = {},
    ) =>
      fcache.count(
        { where: effectiveCountWhere(list, args.where) },
        context,
        rootValue,
      ) as Promise<number>,
    createOne: (
      args: { data: Record<string, unknown> },
      rootValue: Record<string, unknown> = {},
    ) => fcache.createOne({ data: args.data }, context, rootValue),
    createMany: (
      args: { data: Record<string, unknown>[] },
      rootValue: Record<string, unknown> = {},
    ) =>
      fcache
        .createMany({ data: args.data }, context, rootValue)
        .catch((error) =>
          wrapManyContextFailure(error, `${list.key}.createMany`),
        ),
    updateOne: (
      args: {
        where: { id?: string | number | null }
        data: Record<string, unknown>
      },
      rootValue: Record<string, unknown> = {},
    ) =>
      fcache.updateOne(
        { where: args.where, data: args.data },
        context,
        rootValue,
      ),
    updateMany: (
      args: {
        data: Array<{
          where: { id?: string | number | null }
          data: Record<string, unknown>
        }>
      },
      rootValue: Record<string, unknown> = {},
    ) =>
      fcache
        .updateMany({ data: args.data }, context, rootValue)
        .catch((error) =>
          wrapManyContextFailure(error, `${list.key}.updateMany`),
        ),
    deleteOne: (
      args: { where: { id?: string | number | null } },
      rootValue: Record<string, unknown> = {},
    ) => fcache.deleteOne({ where: args.where }, context, rootValue),
    deleteMany: (
      args: { where: Array<{ id?: string | number | null }> },
      rootValue: Record<string, unknown> = {},
    ) =>
      fcache
        .deleteMany({ where: args.where }, context, rootValue)
        .catch((error) =>
          wrapManyContextFailure(error, `${list.key}.deleteMany`),
        ),
  }
}

function buildContextQueryApi(
  list: CmsList,
  context: CmsContext,
  namesByListKey: Record<string, GraphQLNames>,
  kind: CmsGraphQLSchemaKind,
): CmsContext['query'][string] {
  const listKey = list.key
  const names = namesByListKey[listKey]
  const supported = {
    query: !isListOperationOmitted(list, 'query', kind),
    create: !isListOperationOmitted(list, 'create', kind),
    update: !isListOperationOmitted(list, 'update', kind),
    delete: !isListOperationOmitted(list, 'delete', kind),
  }

  const queryType = context.graphql.schema.getQueryType()
  const mutationType = context.graphql.schema.getMutationType()

  function schemaDerived(operation: 'query' | 'mutation', fieldName: string) {
    const rootType = operation === 'query' ? queryType : mutationType
    const field = rootType?.getFields()[fieldName]
    if (!field) return unsupportedContextOperation(operation, fieldName)
    return makeContextQueryFn(context.graphql.schema, operation, field)
  }

  const countSource = `query CmsContextCount($where: ${names.whereInputName}) { ${names.listQueryCountName}(where: $where) }`

  const fcache = {
    findOne: supported.query
      ? schemaDerived('query', names.itemQueryName)
      : unsupportedContextOperation('query', names.itemQueryName),
    findMany: supported.query
      ? schemaDerived('query', names.listQueryName)
      : unsupportedContextOperation('query', names.listQueryName),
    count: supported.query
      ? (args: { where?: unknown } = {}) =>
          executeGraphQLField(
            context,
            countSource,
            { where: effectiveCountWhere(list, args.where) },
            names.listQueryCountName,
          ) as Promise<number>
      : unsupportedContextOperation('query', names.listQueryCountName),
    createOne: supported.create
      ? schemaDerived('mutation', names.createMutationName)
      : unsupportedContextOperation('mutation', names.createMutationName),
    createMany: supported.create
      ? schemaDerived('mutation', names.createManyMutationName)
      : unsupportedContextOperation('mutation', names.createManyMutationName),
    updateOne: supported.update
      ? schemaDerived('mutation', names.updateMutationName)
      : unsupportedContextOperation('mutation', names.updateMutationName),
    updateMany: supported.update
      ? schemaDerived('mutation', names.updateManyMutationName)
      : unsupportedContextOperation('mutation', names.updateManyMutationName),
    deleteOne: supported.delete
      ? schemaDerived('mutation', names.deleteMutationName)
      : unsupportedContextOperation('mutation', names.deleteMutationName),
    deleteMany: supported.delete
      ? schemaDerived('mutation', names.deleteManyMutationName)
      : unsupportedContextOperation('mutation', names.deleteManyMutationName),
  }

  return {
    findOne: (
      args: { where?: { id?: string | number | null }; query?: string } = {},
    ) =>
      fcache.findOne(
        {
          where: effectiveWhereUnique(list, args.where),
          query: parseQuerySelection(args.query),
        },
        context,
      ),
    findMany: (
      args: Omit<
        Parameters<CmsContext['adapter']['findMany']>[1],
        'context'
      > & { query?: string } = {},
    ) =>
      fcache.findMany(
        {
          where: args.where,
          orderBy: args.orderBy,
          take: args.take,
          skip: args.skip,
          cursor: args.cursor,
          query: parseQuerySelection(args.query),
        },
        context,
      ),
    count: fcache.count,
    createOne: (args: { data: Record<string, unknown>; query?: string }) =>
      fcache.createOne(
        { data: args.data, query: parseQuerySelection(args.query) },
        context,
      ),
    createMany: (args: { data: Record<string, unknown>[]; query?: string }) =>
      fcache
        .createMany(
          { data: args.data, query: parseQuerySelection(args.query) },
          context,
        )
        .catch((error) =>
          wrapManyContextFailure(error, `${list.key}.createMany`),
        ),
    updateOne: (args: {
      where: { id?: string | number | null }
      data: Record<string, unknown>
      query?: string
    }) =>
      fcache.updateOne(
        {
          where: args.where,
          data: args.data,
          query: parseQuerySelection(args.query),
        },
        context,
      ),
    updateMany: (args: {
      data: Array<{
        where: { id?: string | number | null }
        data: Record<string, unknown>
      }>
      query?: string
    }) =>
      fcache
        .updateMany(
          { data: args.data, query: parseQuerySelection(args.query) },
          context,
        )
        .catch((error) =>
          wrapManyContextFailure(error, `${list.key}.updateMany`),
        ),
    deleteOne: (args: {
      where: { id?: string | number | null }
      query?: string
    }) =>
      fcache.deleteOne(
        { where: args.where, query: parseQuerySelection(args.query) },
        context,
      ),
    deleteMany: (args: {
      where: Array<{ id?: string | number | null }>
      query?: string
    }) =>
      fcache
        .deleteMany(
          { where: args.where, query: parseQuerySelection(args.query) },
          context,
        )
        .catch((error) =>
          wrapManyContextFailure(error, `${list.key}.deleteMany`),
        ),
  }
}

export function buildCmsContext({
  adapter,
  session,
  sudo,
  internal = false,
  schema,
  request,
  responseHeaders,
  lists,
  storage,
}: {
  adapter: CmsContext['adapter']
  session?: CmsSession
  sudo: boolean
  internal?: boolean
  schema?: GraphQLSchema
  request?: Request
  responseHeaders?: Headers
  lists?: CmsList[]
  storage?: Record<string, CmsStorageConfig>
}): CmsContext {
  const db: CmsContext['db'] = {}
  const query: CmsContext['query'] = {}
  const graphqlApi = {} as CmsContext['graphql']
  const runtimeLists = lists ?? cmsLists
  const runtimeStorage = storage ?? getStorageConfigs()
  const namesByListKey = graphQLNamesForLists(runtimeLists)
  const context: CmsContext = {
    adapter,
    db,
    query,
    prisma: adapter.prisma ?? null,
    graphql: graphqlApi,
    session,
    sessionStrategy: cmsConfig.session,
    transaction: async (fn, options) =>
      withAdapterTransaction(context, fn, options),
    __internal: {
      sudo,
      internal,
      lists,
      storage: runtimeStorage,
      request,
      responseHeaders,
    },
    internal: () =>
      buildCmsContext({
        adapter,
        session,
        sudo,
        internal: true,
        schema:
          lists === undefined
            ? getCmsGraphQLSchema('internal')
            : graphqlApi.schema,
        request,
        responseHeaders,
        lists,
        storage: runtimeStorage,
      }),
    sudo: () =>
      buildCmsContext({
        adapter,
        session,
        sudo: true,
        internal: true,
        schema:
          lists === undefined
            ? getCmsGraphQLSchema('internal')
            : graphqlApi.schema,
        request,
        responseHeaders,
        lists,
        storage: runtimeStorage,
      }),
    withRequest: async (
      replacementRequest,
      replacementResponseHeaders = responseHeaders,
    ) => {
      const sessionStrategyContext = buildCmsContext({
        adapter,
        session: undefined,
        sudo,
        internal,
        schema: graphqlApi.schema,
        request: replacementRequest,
        responseHeaders: replacementResponseHeaders,
        lists,
        storage: runtimeStorage,
      })
      const strategySession = await cmsConfig.session?.get({
        context: sessionStrategyContext,
      })
      const replacementSession = await hydrateCmsSession(
        strategySession,
        sessionStrategyContext,
      )
      return buildCmsContext({
        adapter,
        session: replacementSession,
        sudo,
        internal,
        schema: graphqlApi.schema,
        request: replacementRequest,
        responseHeaders: replacementResponseHeaders,
        lists,
        storage: runtimeStorage,
      })
    },
    withSession: (replacementSession) =>
      buildCmsContext({
        adapter,
        session: replacementSession,
        sudo,
        internal,
        schema: graphqlApi.schema,
        request,
        responseHeaders,
        lists,
        storage: runtimeStorage,
      }),
  }

  graphqlApi.schema = schema ?? getCmsGraphQLSchema()
  graphqlApi.raw = async ({
    query: sourceQuery,
    variables,
  }: {
    query: string | DocumentNode
    variables?: Record<string, unknown>
  }): Promise<ExecutionResult> =>
    graphql({
      schema: graphqlApi.schema,
      source:
        typeof sourceQuery === 'string'
          ? sourceQuery
          : print(documentFrom(sourceQuery)),
      contextValue: context,
      variableValues: variables,
    })
  graphqlApi.run = async ({
    query: sourceQuery,
    variables,
  }: {
    query: string | DocumentNode
    variables?: Record<string, unknown>
  }) => {
    const result = await graphqlApi.raw({ query: sourceQuery, variables })
    if (result.errors?.length) throw result.errors[0]
    return result.data ?? {}
  }

  for (const list of runtimeLists) {
    db[list.key] = buildContextDbApi(
      list,
      context,
      internal ? 'internal' : 'public',
    )
    query[list.key] = buildContextQueryApi(
      list,
      context,
      namesByListKey,
      internal ? 'internal' : 'public',
    )
  }

  return context
}

async function sessionForAuthItem(
  itemId: string,
  context: CmsContext,
): Promise<CmsSession | undefined> {
  const auth = cmsConfig.auth
  if (!auth) return undefined
  const data = await context.sudo().query[auth.listKey].findOne({
    where: { id: itemId },
    query: auth.sessionData?.trim() || 'id',
  })
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined
  return {
    itemId,
    listKey: auth.listKey,
    data: data as CmsSession['data'],
  }
}

async function hydrateCmsSession(
  strategySession:
    | { itemId?: unknown; listKey?: unknown; data?: unknown }
    | undefined,
  context: CmsContext,
): Promise<CmsSession | undefined> {
  const itemId =
    typeof strategySession?.itemId === 'string'
      ? strategySession.itemId
      : typeof strategySession?.itemId === 'number'
        ? String(strategySession.itemId)
        : undefined
  if (!itemId) return undefined
  const listKey =
    typeof strategySession?.listKey === 'string'
      ? strategySession.listKey
      : cmsConfig.auth?.listKey
  if (!listKey) return undefined
  const data = strategySession?.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return {
      itemId,
      listKey,
      data: data as CmsSession['data'],
    }
  }
  return sessionForAuthItem(itemId, context)
}

function allowDevelopmentAuthFallback(request?: Request) {
  const disabledForRequest =
    request?.headers.get('x-cms-disable-dev-auth-fallback') === 'true'
  return (
    !disabledForRequest &&
    process.env.NODE_ENV !== 'production' &&
    process.env.CMS_DEV_AUTH_FALLBACK === 'true'
  )
}

async function devFallbackSession(context: CmsContext) {
  const itemId = process.env.CMS_DEV_AUTH_ITEM_ID?.trim()
  return allowDevelopmentAuthFallback() && itemId
    ? sessionForAuthItem(itemId, context)
    : undefined
}

export async function createCmsContext(
  request?: Request,
  schema?: GraphQLSchema,
  responseHeaders?: Headers,
): Promise<CmsContext> {
  const adapter = await getCmsAdapter()
  const sessionStrategyContext = buildCmsContext({
    adapter,
    session: undefined,
    sudo: false,
    schema,
    request,
    responseHeaders,
  })
  const strategySession = await cmsConfig.session?.get({
    context: sessionStrategyContext,
  })
  const anonymous = request?.headers.get('x-cms-anonymous') === 'true'
  const requestedUserId = allowDevelopmentAuthFallback(request)
    ? (request?.headers.get('x-cms-user-id') ?? undefined)
    : undefined
  const session = anonymous
    ? undefined
    : strategySession
      ? await hydrateCmsSession(strategySession, sessionStrategyContext)
      : requestedUserId
        ? await sessionForAuthItem(requestedUserId, sessionStrategyContext)
        : allowDevelopmentAuthFallback(request)
          ? await devFallbackSession(sessionStrategyContext)
          : undefined

  // SECURITY NOTE: fallback admin and x-cms-user-id are development-only shims.
  // Real session cookies/Bearer tokens take precedence when present, and the
  // fallback is disabled by default. It only enables outside production with
  // CMS_DEV_AUTH_FALLBACK=true and CMS_DEV_AUTH_ITEM_ID names the item.
  return buildCmsContext({
    adapter,
    session,
    sudo: false,
    schema,
    request,
    responseHeaders,
  })
}

function buildCrudResolvers(
  lists: CmsList[] = cmsLists,
  kind: CmsGraphQLSchemaKind = 'public',
) {
  const namesByListKey = graphQLNamesForLists(lists)
  const listsByKey = Object.fromEntries(
    lists.map((entry) => [entry.key, entry]),
  )
  const queryResolvers: Record<string, unknown> = { keystone: () => ({}) }
  const mutationResolvers: Record<string, unknown> = {}
  const typeResolvers: IResolvers = {}

  for (const list of lists) {
    if (kind === 'public' && list.graphql?.omit === true) continue
    const names = namesByListKey[list.key]
    if (!isListOperationOmitted(list, 'query', kind)) {
      queryResolvers[names.itemQueryName] = async (
        _root: unknown,
        args: Record<string, unknown>,
        context: CmsContext,
      ) => {
        if (!(await getOperationAccess(list.key, 'query', context))) return null
        await assertFilterAccess(list.key, 'query', context, args.where)
        return context.adapter.findUnique(
          list.key,
          effectiveWhereUnique(list, args.where),
          context,
        )
      }
      queryResolvers[names.listQueryName] = async (
        _root: unknown,
        args: Record<string, unknown>,
        context: CmsContext,
      ) => {
        if (!(await getOperationAccess(list.key, 'query', context))) return []
        await assertFilterAccess(list.key, 'query', context, args.where)
        await assertOrderByAccess(list.key, 'query', context, args.orderBy)
        await assertCursorAccess(list.key, 'query', context, args.cursor)
        return context.adapter.findMany(list.key, {
          ...args,
          cursor: args.cursor == null ? undefined : asWhereUnique(args.cursor),
          context,
        })
      }
      queryResolvers[names.listQueryCountName] = async (
        _root: unknown,
        args: Record<string, unknown>,
        context: CmsContext,
      ) => {
        const where = effectiveCountWhere(list, args.where)
        if (!(await getOperationAccess(list.key, 'query', context))) return 0
        await assertFilterAccess(list.key, 'query', context, where)
        return context.adapter.count(list.key, { where, context })
      }
    }

    if (!isListOperationOmitted(list, 'create', kind)) {
      mutationResolvers[names.createMutationName] = async (
        _root: unknown,
        args: Record<string, unknown>,
        context: CmsContext,
      ) => {
        await assertOperationAccess(list.key, 'create', context)
        return withMutationUploadRollback(context, async (mutationContext) => {
          const data = await normalizeMutationInputData(
            list,
            asRecord(args.data),
            'create',
            mutationContext,
          )
          return mutationContext.adapter.transaction
            ? mutationContext.adapter.transaction((adapter) =>
                adapter.create(list.key, {
                  data,
                  context: { ...mutationContext, adapter },
                }),
              )
            : mutationContext.adapter.create(list.key, {
                data,
                context: mutationContext,
              })
        })
      }
      mutationResolvers[names.createManyMutationName] = async (
        _root: unknown,
        args: Record<string, unknown>,
        context: CmsContext,
      ) => {
        return promisesButSettledWhenAllSettledAndInOrder(
          asInputList(args.data).map(async (rawData) => {
            await assertOperationAccess(list.key, 'create', context)
            return withMutationUploadRollback(
              context,
              async (mutationContext) => {
                const data = await normalizeMutationInputData(
                  list,
                  rawData,
                  'create',
                  mutationContext,
                )
                return mutationContext.adapter.transaction
                  ? mutationContext.adapter.transaction((adapter) =>
                      adapter.create(list.key, {
                        data,
                        context: { ...mutationContext, adapter },
                      }),
                    )
                  : mutationContext.adapter.create(list.key, {
                      data,
                      context: mutationContext,
                    })
              },
            )
          }),
        )
      }
    }
    if (!isListOperationOmitted(list, 'update', kind)) {
      mutationResolvers[names.updateMutationName] = async (
        _root: unknown,
        args: Record<string, unknown>,
        context: CmsContext,
      ) => {
        await assertOperationAccess(list.key, 'update', context)
        await assertFilterAccess(list.key, 'update', context, args.where)
        return withMutationUploadRollback(context, async (mutationContext) => {
          const data = await normalizeMutationInputData(
            list,
            asRecord(args.data),
            'update',
            mutationContext,
          )
          return mutationContext.adapter.transaction
            ? mutationContext.adapter.transaction((adapter) =>
                adapter.update(list.key, {
                  where: asWhereUnique(args.where),
                  data,
                  context: { ...mutationContext, adapter },
                }),
              )
            : mutationContext.adapter.update(list.key, {
                where: asWhereUnique(args.where),
                data,
                context: mutationContext,
              })
        })
      }
      mutationResolvers[names.updateManyMutationName] = async (
        _root: unknown,
        args: Record<string, unknown>,
        context: CmsContext,
      ) => {
        return promisesButSettledWhenAllSettledAndInOrder(
          asInputList(args.data).map(async (entry) => {
            await assertOperationAccess(list.key, 'update', context)
            await assertFilterAccess(list.key, 'update', context, entry.where)
            return withMutationUploadRollback(
              context,
              async (mutationContext) => {
                const data = await normalizeMutationInputData(
                  list,
                  asRecord(entry.data),
                  'update',
                  mutationContext,
                )
                return mutationContext.adapter.transaction
                  ? mutationContext.adapter.transaction((adapter) =>
                      adapter.update(list.key, {
                        where: asWhereUnique(entry.where),
                        data,
                        context: { ...mutationContext, adapter },
                      }),
                    )
                  : mutationContext.adapter.update(list.key, {
                      where: asWhereUnique(entry.where),
                      data,
                      context: mutationContext,
                    })
              },
            )
          }),
        )
      }
    }
    if (!isListOperationOmitted(list, 'delete', kind)) {
      mutationResolvers[names.deleteMutationName] = async (
        _root: unknown,
        args: Record<string, unknown>,
        context: CmsContext,
      ) => {
        await assertOperationAccess(list.key, 'delete', context)
        await assertFilterAccess(list.key, 'delete', context, args.where)
        return context.adapter.transaction
          ? context.adapter.transaction((adapter) =>
              adapter.delete(list.key, asWhereUnique(args.where), {
                ...context,
                adapter,
              }),
            )
          : context.adapter.delete(list.key, asWhereUnique(args.where), context)
      }
      mutationResolvers[names.deleteManyMutationName] = async (
        _root: unknown,
        args: Record<string, unknown>,
        context: CmsContext,
      ) => {
        return promisesButSettledWhenAllSettledAndInOrder(
          asInputList(args.where).map(async (where) => {
            await assertOperationAccess(list.key, 'delete', context)
            await assertFilterAccess(list.key, 'delete', context, where)
            return context.adapter.transaction
              ? context.adapter.transaction((adapter) =>
                  adapter.delete(list.key, asWhereUnique(where), {
                    ...context,
                    adapter,
                  }),
                )
              : context.adapter.delete(list.key, asWhereUnique(where), context)
          }),
        )
      }
    }

    for (const [actionKey, action] of Object.entries(list.actions ?? {})) {
      const singularName = action.graphql?.singular ?? `${actionKey}${list.key}`
      const pluralName =
        action.graphql?.plural ??
        `${actionKey}${list.plural.replace(/\s+/g, '')}`
      mutationResolvers[singularName] = async (
        _root: unknown,
        args: Record<string, unknown>,
        context: CmsContext,
      ) => {
        const allowed =
          typeof action.access === 'function'
            ? await action.access({
                context,
                session: context.session,
                listKey: list.key,
                actionKey,
              })
            : action.access
        if (!allowed)
          throw new Error(
            `You cannot execute action "${actionKey}" for that ${list.key}`,
          )
        return action.resolve(
          { listKey: list.key, actionKey, where: asWhereUnique(args.where) },
          context,
        )
      }
      mutationResolvers[pluralName] = async (
        _root: unknown,
        args: Record<string, unknown>,
        context: CmsContext,
      ) => {
        const allowed =
          typeof action.access === 'function'
            ? await action.access({
                context,
                session: context.session,
                listKey: list.key,
                actionKey,
              })
            : action.access
        if (!allowed)
          throw new Error(
            `You cannot execute action "${actionKey}" for that ${list.key}`,
          )
        return promisesButSettledWhenAllSettledAndInOrder(
          asInputList(args.where).map((where) =>
            action.resolve(
              { listKey: list.key, actionKey, where: asWhereUnique(where) },
              context,
            ),
          ),
        )
      }
    }

    const fieldResolvers: Record<string, unknown> = {}
    for (const field of list.fields) {
      if (kind === 'public' && isOmitted(field.graphql?.omit, 'read')) continue
      if (!isRelationshipRefVisible(field, list, listsByKey, kind)) continue
      if (field.kind === 'virtual') {
        fieldResolvers[field.path] = async (
          item: CmsItem,
          args: Record<string, unknown>,
          context: CmsContext,
        ) => {
          if (!(await canReadField(list.key, field.path, context, item)))
            return unreadableFieldValue(field)
          return field.resolver ? field.resolver(item, args, context) : null
        }
      } else if (field.kind === 'password') {
        fieldResolvers[field.path] = async (
          item: CmsItem,
          _args: unknown,
          context: CmsContext,
        ) => {
          if (!(await canReadField(list.key, field.path, context, item)))
            return null
          return { isSet: isPasswordHash(item[field.path]) }
        }
      } else if (field.kind === 'image' || field.kind === 'file') {
        fieldResolvers[field.path] = async (
          item: CmsItem,
          _args: unknown,
          context: CmsContext,
        ) => {
          if (!(await canReadField(list.key, field.path, context, item)))
            return null
          return normalizeStoredFieldOutput(field, item[field.path], context)
        }
      } else if (field.kind === 'document') {
        fieldResolvers[field.path] = async (
          item: CmsItem,
          _args: unknown,
          context: CmsContext,
        ) => {
          if (!(await canReadField(list.key, field.path, context, item)))
            return unreadableFieldValue(field)
          const value = item[field.path]
          if (value === null || value === undefined) return null
          const document =
            typeof value === 'object' &&
            !Array.isArray(value) &&
            Array.isArray((value as { document?: unknown }).document)
              ? (value as { document: unknown[] }).document
              : value
          return { document, field }
        }
      } else if (field.kind === 'structure') {
        fieldResolvers[field.path] = async (
          item: CmsItem,
          _args: unknown,
          context: CmsContext,
        ) => {
          if (!(await canReadField(list.key, field.path, context, item)))
            return unreadableFieldValue(field)
          const value = item[field.path]
          return value === null || value === undefined
            ? null
            : structureFieldValue(item, field.path)
        }
      } else if (field.kind === 'relationship') {
        fieldResolvers[field.path] = async (
          item: CmsItem,
          args: Record<string, unknown>,
          context: CmsContext,
        ) => {
          if (!(await canReadField(list.key, field.path, context, item)))
            return unreadableFieldValue(field)
          const relatedListKey = relatedListKeyForField(field, list) ?? list.key
          if (!(await getOperationAccess(relatedListKey, 'query', context)))
            return field.many ? [] : null
          await assertFilterAccess(relatedListKey, 'query', context, args.where)
          await assertOrderByAccess(
            relatedListKey,
            'query',
            context,
            args.orderBy,
          )
          await assertCursorAccess(
            relatedListKey,
            'query',
            context,
            args.cursor,
          )
          const accessFilter = await getAccessFilter(
            relatedListKey,
            'query',
            context,
          )
          if (accessFilter === false) return field.many ? [] : null
          const relationshipWhere =
            accessFilter === true
              ? args.where
              : args.where == null
                ? accessFilter
                : { AND: [accessFilter, args.where] }
          const relatedItems = await context.adapter.resolveRelationship(
            list.key,
            item,
            field,
            context,
            field.many
              ? {
                  where: relationshipWhere,
                  orderBy: args.orderBy,
                  take: typeof args.take === 'number' ? args.take : undefined,
                  skip: typeof args.skip === 'number' ? args.skip : undefined,
                  cursor:
                    args.cursor && typeof args.cursor === 'object'
                      ? args.cursor
                      : undefined,
                }
              : { where: relationshipWhere },
          )
          return field.many ? relatedItems : (relatedItems[0] ?? null)
        }
        if (field.many) {
          fieldResolvers[`${field.path}Count`] = async (
            item: CmsItem,
            args: Record<string, unknown>,
            context: CmsContext,
          ) => {
            if (!(await canReadField(list.key, field.path, context, item)))
              return 0
            const relatedListKey =
              relatedListKeyForField(field, list) ?? list.key
            if (!(await getOperationAccess(relatedListKey, 'query', context)))
              return 0
            await assertFilterAccess(
              relatedListKey,
              'query',
              context,
              args.where,
            )
            const accessFilter = await getAccessFilter(
              relatedListKey,
              'query',
              context,
            )
            if (accessFilter === false) return 0
            const relationshipWhere =
              accessFilter === true
                ? args.where
                : args.where == null
                  ? accessFilter
                  : { AND: [accessFilter, args.where] }
            const relatedItems = await context.adapter.resolveRelationship(
              list.key,
              item,
              field,
              context,
              { where: relationshipWhere },
            )
            return relatedItems.length
          }
        }
      } else {
        fieldResolvers[field.path] = async (
          item: CmsItem,
          _args: unknown,
          context: CmsContext,
        ) => {
          if (!(await canReadField(list.key, field.path, context, item)))
            return unreadableFieldValue(field)
          return item[field.path]
        }
      }
    }
    typeResolvers[list.key] = fieldResolvers
    for (const field of list.fields) {
      if (field.kind === 'structure') {
        const schema = structureSchemaForField(field)
        if (schema)
          Object.assign(
            typeResolvers,
            structureResolverMap(list.key, field.path, schema),
          )
        continue
      }
      if (field.kind !== 'document') continue
      typeResolvers[`${list.key}_${field.path}_Document`] = {
        document: async (
          value: { document: unknown; field?: CmsField },
          args: { hydrateRelationships?: boolean },
          context: CmsContext,
        ) => {
          const document = normalizeDocumentNodes(value.document)
          if (!args.hydrateRelationships || !value.field) return document
          return hydrateDocumentNodes(document, value.field, context)
        },
      }
    }
  }

  return { queryResolvers, mutationResolvers, typeResolvers }
}

const crudResolvers = buildCrudResolvers(cmsLists, 'public')

function configuredAuthMeta() {
  return cmsConfig.auth
    ? {
        listKey: cmsConfig.auth.listKey,
        identityField: cmsConfig.auth.identityField,
        secretField: cmsConfig.auth.secretField,
        sessionData: cmsConfig.auth.sessionData?.trim() || 'id',
        initFirstItemFields: cmsConfig.auth.initFirstItem?.fields ?? [],
      }
    : null
}

export function generateCmsResolversForLists(
  lists: CmsList[],
  kind: CmsGraphQLSchemaKind = 'public',
): IResolvers {
  const resolvers = buildCrudResolvers(lists, kind)
  return {
    JSON: jsonScalar,
    Upload: uploadScalar,
    DateTime: dateTimeScalar,
    CalendarDay: calendarDayScalar,
    Decimal: decimalScalar,
    BigInt: bigIntScalar,
    Query: resolvers.queryResolvers,
    Mutation: resolvers.mutationResolvers,
    KeystoneMeta: {
      auth: configuredAuthMeta,
      adminMeta: async (
        _parent: unknown,
        _args: unknown,
        context: CmsContext,
      ) => {
        const meta = await getAdminMetaForContext(context, lists)
        if (context.__internal.sudo) return meta
        const allowed =
          typeof cmsConfig.ui?.isAccessAllowed === 'function'
            ? await cmsConfig.ui.isAccessAllowed(context)
            : true
        if (allowed) return meta
        throw accessDenied('admin UI')
      },
    },
    KeystoneAdminMeta: {
      isAccessAllowed: (meta: AdminMeta) => meta.isAccessAllowed,
      auth: configuredAuthMeta,
      list: (meta: { lists: AdminMetaList[] }, args: { key: string }) =>
        meta.lists.find((entry) => entry.key === args.key) ?? null,
      itemList: (
        meta: { lists: AdminMetaList[] },
        args: { key: string; itemId: string },
        context: CmsContext,
      ) => adminMetaListForArgs(meta, args, context),
    },
    KeystoneAdminUIListMeta: {
      description: (list: AdminMetaList) => list.description ?? null,
      initialSearchFields: (list: AdminMetaList) =>
        list.initialSearchFields ?? [],
      itemQueryName: (list: AdminMetaList) => list.gqlNames.itemQueryName,
      listQueryName: (list: AdminMetaList) => list.gqlNames.listQueryName,
      fields: (list: RuntimeAdminMetaList) =>
        list.fields.map((field) => ({
          ...field,
          item: list.item ?? null,
          itemField: list.item?.[field.key] ?? null,
        })),
      field: (list: RuntimeAdminMetaList, args: { key: string }) => ({
        ...list.fieldsByKey[args.key],
        item: list.item ?? null,
        itemField: list.item?.[args.key] ?? null,
      }),
      actions: (list: RuntimeAdminMetaList) =>
        runtimeAdminMetaActions(list, lists),
    },
    KeystoneAdminUIFieldGroupMeta: {
      fields: (group: AdminMetaGroup) =>
        group.fields.map((entry) => entry.field),
    },
    ActionMeta: {
      messages: (action: AdminMetaAction) => action.messages,
      graphql: (action: AdminMetaAction) => action.graphql,
      itemView: async (
        action: RuntimeAdminMetaAction,
        _args: unknown,
        context: CmsContext,
      ) => ({
        ...action.itemView,
        actionMode: await evaluateActionMode(
          action.originalAction?.ui.itemView?.actionMode,
          action.itemView.actionMode,
          context,
          action.listKey ?? '',
          action.key,
          action.item ?? null,
        ),
      }),
      listView: async (
        action: RuntimeAdminMetaAction,
        _args: unknown,
        context: CmsContext,
      ) => ({
        ...action.listView,
        actionMode: await evaluateActionMode(
          action.originalAction?.ui.listView?.actionMode,
          action.listView.actionMode,
          context,
          action.listKey ?? '',
          action.key,
        ),
      }),
    },
    ActionMessages: {
      promptTitle: (messages: AdminMetaAction['messages']) =>
        messages.promptTitle,
      promptTitleMany: (messages: AdminMetaAction['messages']) =>
        messages.promptTitleMany,
      prompt: (messages: AdminMetaAction['messages']) => messages.prompt,
      promptMany: (messages: AdminMetaAction['messages']) =>
        messages.promptMany,
      promptConfirmLabel: (messages: AdminMetaAction['messages']) =>
        messages.promptConfirmLabel,
      promptConfirmLabelMany: (messages: AdminMetaAction['messages']) =>
        messages.promptConfirmLabelMany,
      fail: (messages: AdminMetaAction['messages']) => messages.fail,
      failMany: (messages: AdminMetaAction['messages']) => messages.failMany,
      success: (messages: AdminMetaAction['messages']) => messages.success,
      successMany: (messages: AdminMetaAction['messages']) =>
        messages.successMany,
    },
    ActionGraphQL: {
      names: (graphqlMeta: AdminMetaAction['graphql']) => graphqlMeta.names,
    },
    ActionGraphQLNames: {
      one: (names: AdminMetaAction['graphql']['names']) => names.one,
      many: (names: AdminMetaAction['graphql']['names']) => names.many,
    },
    ActionItemViewMeta: {
      actionMode: (view: AdminMetaAction['itemView']) => view.actionMode,
      navigation: (view: AdminMetaAction['itemView']) => view.navigation,
      hidePrompt: (view: AdminMetaAction['itemView']) => view.hidePrompt,
      hideToast: (view: AdminMetaAction['itemView']) => view.hideToast,
    },
    ActionListViewMeta: {
      actionMode: (view: AdminMetaAction['listView']) => view.actionMode,
    },
    KeystoneAdminUIFieldMeta: {
      customViewsIndex: (field: AdminMetaField) =>
        field.customViewsIndex ?? null,
      search: (field: AdminMetaField) => field.search ?? null,
      createView: (
        field: RuntimeAdminMetaField,
        _args: unknown,
        context: CmsContext,
      ) => runtimeFieldView(field, 'createView', context),
      itemView: (
        field: RuntimeAdminMetaField,
        _args: unknown,
        context: CmsContext,
      ) => runtimeFieldView(field, 'itemView', context, field.item),
      listView: (
        field: RuntimeAdminMetaField,
        _args: unknown,
        context: CmsContext,
      ) => runtimeFieldView(field, 'listView', context),
    },
    KeystoneAdminUIFieldMetaCreateView: {
      fieldMode: (view: GraphQLFieldView) => view.fieldMode,
      fieldPosition: (view: GraphQLFieldView) => view.fieldPosition,
    },
    KeystoneAdminUIFieldMetaItemView: {
      fieldMode: (view: GraphQLFieldView) => view.fieldMode,
      fieldPosition: (view: GraphQLFieldView) => view.fieldPosition,
    },
    KeystoneAdminUIFieldMetaListView: {
      fieldMode: (view: GraphQLFieldView) => view.fieldMode,
      fieldPosition: (view: GraphQLFieldView) => view.fieldPosition,
    },
    ...resolvers.typeResolvers,
  }
}

type GraphQLFieldView = Required<FieldViewConfig>
type RuntimeAdminMetaList = AdminMetaList & { item?: CmsItem | null }
type RuntimeAdminMetaField = AdminMetaField & {
  originalField?: CmsField
  originalList?: CmsList
  listKey?: string
  item?: CmsItem | null
}
type RuntimeAdminMetaAction = AdminMetaAction & {
  originalAction?: CmsListActionConfig
  listKey?: string
  item?: CmsItem | null
}

function runtimeAdminMetaActions(
  list: RuntimeAdminMetaList,
  runtimeLists: CmsList[],
) {
  const sourceList = runtimeLists.find((entry) => entry.key === list.key)
  return list.actions.map((action) => ({
    ...action,
    item: list.item ?? null,
    listKey: list.key,
    originalAction: sourceList?.actions?.[action.key],
  }))
}

function defaultFieldModeFromConfig(config: unknown) {
  return config &&
    typeof config === 'object' &&
    !Array.isArray(config) &&
    'defaultFieldMode' in config
    ? (config as { defaultFieldMode?: FieldModeConfig }).defaultFieldMode
    : undefined
}

function listDefaultFieldMode(
  list: CmsList | undefined,
  view: 'createView' | 'itemView' | 'listView',
) {
  return defaultFieldModeFromConfig(list?.ui?.[view])
}

function groupDefaultFieldMode(
  list: CmsList | undefined,
  field: CmsField | undefined,
  view: 'createView' | 'itemView' | 'listView',
) {
  if (!list || !field) return undefined
  const group = list.groups?.find((entry) => entry.fields.includes(field.path))
  return defaultFieldModeFromConfig(group?.ui?.[view])
}

function runtimeFieldView(
  field: RuntimeAdminMetaField,
  view: 'createView' | 'itemView' | 'listView',
  context: CmsContext,
  item?: CmsItem | null,
) {
  const originalField = field.originalField
  const metaView = field[view]
  if (!originalField) return metaView
  const originalView = originalField[view]
  return {
    ...metaView,
    fieldMode: evaluateFieldMode(
      originalView?.fieldMode ??
        groupDefaultFieldMode(field.originalList, originalField, view) ??
        listDefaultFieldMode(field.originalList, view),
      metaView.fieldMode,
      context,
      item,
    ),
    fieldPosition: evaluateFieldPosition(
      originalView?.fieldPosition,
      metaView.fieldPosition,
      context,
      item,
    ),
  }
}

async function adminMetaListForArgs(
  meta: { lists: AdminMetaList[] },
  args: { key: string; itemId?: string | null },
  context: CmsContext,
) {
  const list = meta.lists.find((entry) => entry.key === args.key)
  if (!list) return null
  if (!args.itemId)
    return { ...list, item: null } satisfies RuntimeAdminMetaList
  const item = await context.db[args.key].findOne({
    where: { id: args.itemId },
  })
  return { ...list, item: item ?? null } satisfies RuntimeAdminMetaList
}

export const cmsTypeDefs = generateCrudSchema()
export const generateCmsTypeDefsForLists = generateCrudSchema

export const cmsResolvers: IResolvers = {
  JSON: jsonScalar,
  Upload: uploadScalar,
  DateTime: dateTimeScalar,
  CalendarDay: calendarDayScalar,
  Decimal: decimalScalar,
  BigInt: bigIntScalar,
  PasswordState: { isSet: (state: { isSet: boolean }) => state.isSet },
  Query: crudResolvers.queryResolvers,
  Mutation: crudResolvers.mutationResolvers,
  KeystoneMeta: {
    auth: configuredAuthMeta,
    adminMeta: async (
      _parent: unknown,
      _args: unknown,
      context: CmsContext,
    ) => {
      const meta = await getAdminMetaForContext(context)
      if (context.__internal.sudo) return meta
      const allowed =
        typeof cmsConfig.ui?.isAccessAllowed === 'function'
          ? await cmsConfig.ui.isAccessAllowed(context)
          : true
      if (allowed) return meta
      throw accessDenied('admin UI')
    },
  },
  KeystoneAdminMeta: {
    isAccessAllowed: (meta: AdminMeta) => meta.isAccessAllowed,
    auth: configuredAuthMeta,
    list: (meta: { lists: AdminMetaList[] }, args: { key: string }) =>
      meta.lists.find((entry) => entry.key === args.key) ?? null,
    itemList: (
      meta: { lists: AdminMetaList[] },
      args: { key: string; itemId: string },
      context: CmsContext,
    ) => adminMetaListForArgs(meta, args, context),
  },
  KeystoneAdminUIListMeta: {
    description: (list: AdminMetaList) => list.description ?? null,
    initialSearchFields: (list: AdminMetaList) =>
      list.initialSearchFields ?? [],
    itemQueryName: (list: AdminMetaList) => list.gqlNames.itemQueryName,
    listQueryName: (list: AdminMetaList) => list.gqlNames.listQueryName,
    fields: (list: RuntimeAdminMetaList) =>
      list.fields.map((field) => ({
        ...field,
        item: list.item ?? null,
        itemField: list.item?.[field.key] ?? null,
      })),
    field: (list: RuntimeAdminMetaList, args: { key: string }) => ({
      ...list.fieldsByKey[args.key],
      item: list.item ?? null,
      itemField: list.item?.[args.key] ?? null,
    }),
    actions: (list: RuntimeAdminMetaList) =>
      runtimeAdminMetaActions(list, cmsLists),
  },
  KeystoneAdminUIFieldGroupMeta: {
    fields: (group: AdminMetaGroup) => group.fields.map((entry) => entry.field),
  },
  ActionMeta: {
    messages: (action: AdminMetaAction) => action.messages,
    graphql: (action: AdminMetaAction) => action.graphql,
    itemView: async (
      action: RuntimeAdminMetaAction,
      _args: unknown,
      context: CmsContext,
    ) => ({
      ...action.itemView,
      actionMode: await evaluateActionMode(
        action.originalAction?.ui.itemView?.actionMode,
        action.itemView.actionMode,
        context,
        action.listKey ?? '',
        action.key,
        action.item ?? null,
      ),
    }),
    listView: async (
      action: RuntimeAdminMetaAction,
      _args: unknown,
      context: CmsContext,
    ) => ({
      ...action.listView,
      actionMode: await evaluateActionMode(
        action.originalAction?.ui.listView?.actionMode,
        action.listView.actionMode,
        context,
        action.listKey ?? '',
        action.key,
      ),
    }),
  },
  ActionMessages: {
    promptTitle: (messages: AdminMetaAction['messages']) =>
      messages.promptTitle,
    promptTitleMany: (messages: AdminMetaAction['messages']) =>
      messages.promptTitleMany,
    prompt: (messages: AdminMetaAction['messages']) => messages.prompt,
    promptMany: (messages: AdminMetaAction['messages']) => messages.promptMany,
    promptConfirmLabel: (messages: AdminMetaAction['messages']) =>
      messages.promptConfirmLabel,
    promptConfirmLabelMany: (messages: AdminMetaAction['messages']) =>
      messages.promptConfirmLabelMany,
    fail: (messages: AdminMetaAction['messages']) => messages.fail,
    failMany: (messages: AdminMetaAction['messages']) => messages.failMany,
    success: (messages: AdminMetaAction['messages']) => messages.success,
    successMany: (messages: AdminMetaAction['messages']) =>
      messages.successMany,
  },
  ActionGraphQL: {
    names: (graphqlMeta: AdminMetaAction['graphql']) => graphqlMeta.names,
  },
  ActionGraphQLNames: {
    one: (names: AdminMetaAction['graphql']['names']) => names.one,
    many: (names: AdminMetaAction['graphql']['names']) => names.many,
  },
  ActionItemViewMeta: {
    actionMode: (view: AdminMetaAction['itemView']) => view.actionMode,
    navigation: (view: AdminMetaAction['itemView']) => view.navigation,
    hidePrompt: (view: AdminMetaAction['itemView']) => view.hidePrompt,
    hideToast: (view: AdminMetaAction['itemView']) => view.hideToast,
  },
  ActionListViewMeta: {
    actionMode: (view: AdminMetaAction['listView']) => view.actionMode,
  },
  KeystoneAdminUIFieldMeta: {
    customViewsIndex: (field: AdminMetaField) => field.customViewsIndex ?? null,
    search: (field: AdminMetaField) => field.search ?? null,
    createView: (
      field: RuntimeAdminMetaField,
      _args: unknown,
      context: CmsContext,
    ) => runtimeFieldView(field, 'createView', context),
    itemView: (
      field: RuntimeAdminMetaField,
      _args: unknown,
      context: CmsContext,
    ) => runtimeFieldView(field, 'itemView', context, field.item),
    listView: (
      field: RuntimeAdminMetaField,
      _args: unknown,
      context: CmsContext,
    ) => runtimeFieldView(field, 'listView', context),
  },
  KeystoneAdminUIFieldMetaCreateView: {
    fieldMode: (view: GraphQLFieldView) => view.fieldMode,
    fieldPosition: (view: GraphQLFieldView) => view.fieldPosition,
  },
  KeystoneAdminUIFieldMetaItemView: {
    fieldMode: (view: GraphQLFieldView) => view.fieldMode,
    fieldPosition: (view: GraphQLFieldView) => view.fieldPosition,
  },
  KeystoneAdminUIFieldMetaListView: {
    fieldMode: (view: GraphQLFieldView) => view.fieldMode,
    fieldPosition: (view: GraphQLFieldView) => view.fieldPosition,
  },
  ...crudResolvers.typeResolvers,
}

let cachedPublicCmsGraphQLSchema: GraphQLSchema | undefined
let cachedInternalCmsGraphQLSchema: GraphQLSchema | undefined

function buildCmsGraphQLSchema(kind: CmsGraphQLSchemaKind) {
  const crudSchema = generateCrudSchema(cmsLists, kind)
  const resolvers =
    kind === 'public'
      ? cmsResolvers
      : {
          ...cmsResolvers,
          Query: buildCrudResolvers(cmsLists, kind).queryResolvers,
          Mutation: buildCrudResolvers(cmsLists, kind).mutationResolvers,
          KeystoneMeta: cmsResolvers.KeystoneMeta,
          KeystoneAdminMeta: cmsResolvers.KeystoneAdminMeta,
          KeystoneAdminUIFieldGroupMeta:
            cmsResolvers.KeystoneAdminUIFieldGroupMeta,
          KeystoneAdminUIFieldMeta: cmsResolvers.KeystoneAdminUIFieldMeta,
          ActionMeta: cmsResolvers.ActionMeta,
          ActionMessages: cmsResolvers.ActionMessages,
          ActionGraphQL: cmsResolvers.ActionGraphQL,
          ActionGraphQLNames: cmsResolvers.ActionGraphQLNames,
          ActionItemViewMeta: cmsResolvers.ActionItemViewMeta,
          ActionListViewMeta: cmsResolvers.ActionListViewMeta,
          KeystoneAdminUIFieldMetaCreateView:
            cmsResolvers.KeystoneAdminUIFieldMetaCreateView,
          KeystoneAdminUIFieldMetaItemView:
            cmsResolvers.KeystoneAdminUIFieldMetaItemView,
          KeystoneAdminUIFieldMetaListView:
            cmsResolvers.KeystoneAdminUIFieldMetaListView,
          ...buildCrudResolvers(cmsLists, kind).typeResolvers,
        }
  const baseSchema = makeExecutableSchema<CmsContext>({
    typeDefs: crudSchema,
    resolvers,
  })
  const authSchema = addAuthGraphQLSchema(baseSchema, cmsLists, cmsConfig.auth)
  const extendGraphqlSchema = cmsConfig.graphql?.extendGraphqlSchema as
    | CmsExtendGraphqlSchema
    | undefined
  if (typeof extendGraphqlSchema !== 'function') return authSchema
  return mergeSchemas({ schemas: [extendGraphqlSchema(authSchema)] })
}

export function resetCmsGraphQLSchemaCache() {
  cachedPublicCmsGraphQLSchema = undefined
  cachedInternalCmsGraphQLSchema = undefined
}

export function getCmsGraphQLSchema(kind: CmsGraphQLSchemaKind = 'public') {
  if (kind === 'internal') {
    cachedInternalCmsGraphQLSchema ??= buildCmsGraphQLSchema('internal')
    return cachedInternalCmsGraphQLSchema
  }
  cachedPublicCmsGraphQLSchema ??= buildCmsGraphQLSchema('public')
  return cachedPublicCmsGraphQLSchema
}

export function getCmsGraphQLSchemas() {
  return {
    public: getCmsGraphQLSchema('public'),
    internal: getCmsGraphQLSchema('internal'),
  }
}
