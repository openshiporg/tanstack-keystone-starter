import type {
  CmsContext,
  CmsItem,
  CmsSession,
  CmsWhereUnique,
} from './adapters/types'

export type FieldMode = 'edit' | 'read' | 'hidden'

export type FieldModeArgs = {
  session?: CmsSession
  item?: CmsItem | null
  context?: CmsContext
}

export type FieldModeConfig =
  | FieldMode
  | ((args: FieldModeArgs) => FieldMode | Promise<FieldMode>)

export type FieldPosition = 'form' | 'sidebar'
export type FieldPositionConfig =
  | FieldPosition
  | ((args: FieldModeArgs) => FieldPosition | Promise<FieldPosition>)

export type FieldViewConfig = {
  fieldMode?: FieldModeConfig
  fieldPosition?: FieldPositionConfig
  isRequired?: boolean | ((args: FieldModeArgs) => boolean | Promise<boolean>)
}

export type ActionMode = 'enabled' | 'disabled' | 'hidden'

export type ActionModeArgs = {
  session?: CmsSession
  item?: CmsItem | null
  context?: CmsContext
  listKey: string
  actionKey: string
}

export type ActionModeConfig =
  | ActionMode
  | ((args: ActionModeArgs) => ActionMode | Promise<ActionMode>)

export type FieldOption = {
  label: string
  value: string | number
}

export type FieldKind =
  | 'id'
  | 'text'
  | 'password'
  | 'checkbox'
  | 'select'
  | 'multiselect'
  | 'relationship'
  | 'document'
  | 'structure'
  | 'timestamp'
  | 'calendarDay'
  | 'integer'
  | 'float'
  | 'decimal'
  | 'bigInt'
  | 'json'
  | 'image'
  | 'file'
  | 'virtual'

export type CmsDbFieldConfig = {
  isUnique?: boolean
  isIndexed?: boolean
  isNullable?: boolean
  updatedAt?: boolean
  /** Keep a model-field rename data-preserving by retaining the old column name. */
  map?: string
  prismaDefault?: string
  relationName?: string
  foreignKey?:
    | true
    | {
        map: string
      }
  extendPrismaSchema?: (field: string) => string
}

export type CmsResolvedRelationshipMetadata = {
  refListKey: string
  refFieldKey?: string
  many: boolean
  oppositeExists: boolean
  oppositeMany?: boolean
  isSelfReferential: boolean
  relationKind: 'one' | 'many' | 'manyToMany'
  ownership: 'own' | 'inverse' | 'shared'
  foreignKeyFieldName?: string
  foreignKeyMap?: string
  foreignKeyScalarType?: 'String' | 'Int'
  referencedDbColumnName?: 'id'
  relationArgs?: {
    relationName?: string
    referencesFieldPath: 'id'
    onDelete: 'SetNull'
    onUpdate: 'Cascade'
  }
  referencesFieldPath?: 'id'
  onDelete?: 'SetNull'
  onUpdate?: 'Cascade'
  relatedIdFieldKind?: 'cuid' | 'uuid' | 'autoincrement'
  refListPrismaMapping?: string
  relationName?: string
  joinTableName?: string
  joinTableNearForeignKey?: string
  joinTableFarForeignKey?: string
  joinTableNearReferencedFieldPath?: 'id'
  joinTableFarReferencedFieldPath?: 'id'
  joinTableNearReferencedDbColumnName?: 'id'
  joinTableFarReferencedDbColumnName?: 'id'
  joinTableNearForeignKeyScalarType?: 'String' | 'Int'
  joinTableFarForeignKeyScalarType?: 'String' | 'Int'
  joinTableNearIdFieldKind?: 'cuid' | 'uuid' | 'autoincrement'
  joinTableFarIdFieldKind?: 'cuid' | 'uuid' | 'autoincrement'
  refListVisibleInPublicGraph: boolean
  oppositeFieldVisibleInPublicGraph: boolean
}

export type CmsResolvedDbField = {
  kind: FieldKind
  isUnique: boolean
  isIndexed: boolean
  prismaDefault?: string
  relationName?: string
  hasExtendPrismaSchema: boolean
  relationship?: CmsResolvedRelationshipMetadata
}

export type CmsListAccessOperation = 'query' | 'create' | 'update' | 'delete'
export type CmsListFilterOperation = Exclude<CmsListAccessOperation, 'create'>
export type CmsListItemOperation = Exclude<CmsListAccessOperation, 'query'>
export type CmsFieldAccessOperation = 'read' | 'create' | 'update'

type CmsAccessArgs = {
  context: CmsContext
  session?: CmsSession
  listKey: string
}

export type CmsOperationAccessArgs = CmsAccessArgs & {
  operation: CmsListAccessOperation
}

export type CmsFilterAccessArgs = CmsAccessArgs & {
  operation: CmsListFilterOperation
}

export type CmsItemAccessArgs = CmsAccessArgs & {
  operation: CmsListItemOperation
  item: CmsItem | null
  inputData: Record<string, unknown>
}

export type CmsFieldAccessArgs = CmsAccessArgs & {
  fieldKey: string
  field: CmsField
  operation: CmsFieldAccessOperation
  item: CmsItem | null
  inputData: Record<string, unknown>
}

export type CmsOperationAccessControl =
  | boolean
  | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
export type CmsFilterAccessControl =
  | boolean
  | Record<string, unknown>
  | ((
      args: CmsFilterAccessArgs,
    ) =>
      | boolean
      | Record<string, unknown>
      | Promise<boolean | Record<string, unknown>>)
export type CmsItemAccessControl =
  | boolean
  | ((args: CmsItemAccessArgs) => boolean | Promise<boolean>)
export type CmsFieldAccessControl =
  | boolean
  | ((args: CmsFieldAccessArgs) => boolean | Promise<boolean>)
export type CmsFieldFilterabilityControl =
  | boolean
  | ((
      args: CmsFilterAccessArgs & { fieldKey: string; field: CmsField },
    ) => boolean | Promise<boolean>)
export type CmsFieldOrderabilityControl =
  | boolean
  | ((
      args: CmsFilterAccessArgs & { fieldKey: string; field: CmsField },
    ) => boolean | Promise<boolean>)

export type CmsListAccess = {
  operation?: Partial<Record<CmsListAccessOperation, CmsOperationAccessControl>>
  filter?: Partial<Record<CmsListFilterOperation, CmsFilterAccessControl>>
  item?: Partial<Record<CmsListItemOperation, CmsItemAccessControl>>
}

export type CmsActionAccessArgs = CmsAccessArgs & {
  actionKey: string
}

export type CmsActionAccessControl =
  | boolean
  | ((args: CmsActionAccessArgs) => boolean | Promise<boolean>)

export type CmsActionResolveArgs = {
  listKey: string
  actionKey: string
  where: CmsWhereUnique
}

export type CmsActionMessages = {
  promptTitle: string
  promptTitleMany: string
  prompt: string
  promptMany: string
  promptConfirmLabel: string
  promptConfirmLabelMany: string
  fail: string
  failMany: string
  success: string
  successMany: string
}

export type CmsListActionConfig = {
  access: CmsActionAccessControl
  resolve: (
    args: CmsActionResolveArgs,
    context: CmsContext,
  ) => CmsItem | null | Promise<CmsItem | null>
  graphql?: {
    singular?: string
    plural?: string
    description?: string
  }
  ui: {
    label: string
    icon?: string | null
    messages?: Partial<CmsActionMessages>
    itemView?: {
      actionMode?: ActionModeConfig
      navigation?: 'follow' | 'refetch' | 'return'
      hidePrompt?: boolean
      hideToast?: boolean
    }
    listView?: {
      actionMode?: ActionModeConfig
    }
  }
}

export type CmsFieldAccess = Partial<
  Record<CmsFieldAccessOperation, CmsFieldAccessControl>
>

export type CmsHookOperation = 'create' | 'update' | 'delete'
export type CmsInputHookOperation = Exclude<CmsHookOperation, 'delete'>

export type CmsHookBaseArgs = {
  context: CmsContext
  session?: CmsSession
  listKey: string
  operation: CmsHookOperation
  inputData: Record<string, unknown>
  resolvedData: Record<string, unknown>
  item: CmsItem | null
}

export type CmsInputHookBaseArgs = Omit<CmsHookBaseArgs, 'operation'> & {
  operation: CmsInputHookOperation
}

export type CmsFieldHookArgs = CmsHookBaseArgs & {
  fieldKey: string
  field: CmsField
}

export type CmsInputFieldHookArgs = CmsInputHookBaseArgs & {
  fieldKey: string
  field: CmsField
}

export type CmsListResolveInputHook = (
  args: CmsInputHookBaseArgs,
) => Record<string, unknown> | void | Promise<Record<string, unknown> | void>
export type CmsFieldResolveInputHook = (
  args: CmsInputFieldHookArgs,
) => unknown | Promise<unknown>
export type CmsListValidationHook = (
  args: CmsHookBaseArgs & { addValidationError: (message: string) => void },
) => void | Promise<void>
export type CmsFieldValidationHook = (
  args: CmsFieldHookArgs & { addValidationError: (message: string) => void },
) => void | Promise<void>
export type CmsListOperationHook = (
  args: CmsHookBaseArgs,
) => void | Promise<void>
export type CmsFieldOperationHook = (
  args: CmsFieldHookArgs,
) => void | Promise<void>
export type CmsAfterOperationArgs = CmsHookBaseArgs & {
  item: CmsItem
  originalItem: CmsItem | null
}
export type CmsFieldAfterOperationArgs = CmsAfterOperationArgs & {
  fieldKey: string
  field: CmsField
}
export type CmsListAfterOperationHook = (
  args: CmsAfterOperationArgs,
) => void | Promise<void>
export type CmsFieldAfterOperationHook = (
  args: CmsFieldAfterOperationArgs,
) => void | Promise<void>

export type CmsOperationHookMap<THook> =
  | THook
  | Partial<Record<CmsHookOperation, THook>>
export type CmsInputOperationHookMap<THook> =
  | THook
  | Partial<Record<CmsInputHookOperation, THook>>

export type CmsListHooks = {
  resolveInput?: CmsInputOperationHookMap<CmsListResolveInputHook>
  validate?: CmsOperationHookMap<CmsListValidationHook>
  validateInput?: CmsListValidationHook
  validateDelete?: CmsListValidationHook
  beforeOperation?: CmsOperationHookMap<CmsListOperationHook>
  afterOperation?: CmsOperationHookMap<CmsListAfterOperationHook>
}

export type CmsFieldHooks = {
  resolveInput?: CmsInputOperationHookMap<CmsFieldResolveInputHook>
  validate?: CmsOperationHookMap<CmsFieldValidationHook>
  validateInput?: CmsFieldValidationHook
  validateDelete?: CmsFieldValidationHook
  beforeOperation?: CmsOperationHookMap<CmsFieldOperationHook>
  afterOperation?: CmsOperationHookMap<CmsFieldAfterOperationHook>
}

export type CmsVirtualFieldResolver = (
  item: CmsItem,
  args: Record<string, unknown>,
  context: CmsContext,
) => unknown | Promise<unknown>

export type CmsPasswordFieldKdf = {
  compare: (secret: string, hash: string) => Promise<boolean>
  hash: (secret: string) => Promise<string>
}

export type CmsGraphqlFieldEnablement = {
  type: boolean
  read: boolean
  create: boolean
  update: boolean
  filter: CmsListFilterabilityControl
  orderBy: CmsListOrderabilityControl
}

export type CmsGraphqlFieldNonNull = {
  read: boolean
  create: boolean
  update: boolean
}

export type CmsListFilterabilityControl =
  | boolean
  | ((args: CmsFilterAccessArgs) => boolean | Promise<boolean>)
export type CmsListOrderabilityControl =
  | boolean
  | ((args: CmsFilterAccessArgs) => boolean | Promise<boolean>)

export type CmsGraphqlListEnablement = {
  type: boolean
  query: boolean
  create: boolean
  update: boolean
  delete: boolean
  filter: CmsListFilterabilityControl
  orderBy: CmsListOrderabilityControl
}

export type CmsField = {
  path: string
  kind: FieldKind
  label?: string
  description?: string
  fieldMeta?: Record<string, unknown>
  viewsIndex?: string | number
  customViewsIndex?: number | null
  isOrderable?: CmsFieldOrderabilityControl
  isFilterable?: CmsFieldFilterabilityControl
  search?: 'default' | 'insensitive' | null
  isNonNull?: [boolean, boolean]
  createView?: FieldViewConfig
  itemView?: FieldViewConfig
  listView?: FieldViewConfig
  defaultValue?: unknown
  validation?: Record<string, unknown>
  options?: FieldOption[]
  ref?: string
  many?: boolean
  db?: CmsDbFieldConfig
  access?: CmsFieldAccess
  hooks?: CmsFieldHooks
  graphql: {
    omit?: boolean | { read?: boolean; create?: boolean; update?: boolean }
    isEnabled: CmsGraphqlFieldEnablement
    isNonNull: CmsGraphqlFieldNonNull
  }
  graphQLReturnType?: string
  resolver?: CmsVirtualFieldResolver
  password?: {
    kdf?: CmsPasswordFieldKdf
  }
}

export type CmsFieldGroupUiConfig = {
  createView?: CmsListUiFieldModeViewConfig
  itemView?: CmsListUiFieldModeViewConfig
  listView?: CmsListUiFieldModeViewConfig
  [key: string]: unknown
}

export type CmsFieldGroup = {
  label: string
  description?: string
  fields: string[]
  ui?: CmsFieldGroupUiConfig
}

export type CmsListDbConfig = {
  idField?: { kind?: 'uuid' | 'cuid' | 'autoincrement' }
  extraPrismaFields?: string[]
  map?: string
  extendPrismaSchema?: (schema: string) => string
}

export type CmsListUiFieldModeViewConfig = {
  defaultFieldMode?: FieldModeConfig
  [key: string]: unknown
}

export type CmsListUiListViewConfig = CmsListUiFieldModeViewConfig & {
  initialColumns?: string[]
  initialFilter?:
    | Record<string, unknown>
    | ((args: {
        context: CmsContext
        session?: CmsSession
      }) =>
        | Record<string, unknown>
        | null
        | Promise<Record<string, unknown> | null>)
}

export type CmsListUiConfig = {
  labelField?: string
  hideCreate?:
    | boolean
    | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
  hideDelete?:
    | boolean
    | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
  hideNavigation?:
    | boolean
    | ((args: {
        context: CmsContext
        session?: CmsSession
      }) => boolean | Promise<boolean>)
  createView?: CmsListUiFieldModeViewConfig
  itemView?: CmsListUiFieldModeViewConfig
  listView?: CmsListUiListViewConfig
  labels?: {
    label: string
    singular: string
    plural: string
    path: string
  }
  searchableFields?: Record<string, 'default' | 'insensitive' | null>
  triviallySearchableFields?: string[]
  [key: string]: unknown
}

export type CmsList = {
  key: string
  path: string
  label: string
  singular: string
  plural: string
  description?: string
  initialColumns: string[]
  initialSearchFields: string[]
  initialSort?: { field: string; direction: 'ASC' | 'DESC' }
  initialFilter: Record<string, unknown> | null
  pageSize: number
  labelField: string
  isSingleton?: boolean
  isHidden?: boolean
  hideNavigation?: CmsListUiConfig['hideNavigation']
  hideCreate?:
    | boolean
    | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
  hideDelete?:
    | boolean
    | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
  ui: CmsListUiConfig
  graphql: {
    omit?:
      | boolean
      | {
          query?: boolean
          create?: boolean
          update?: boolean
          delete?: boolean
        }
    maxTake?: number
    defaultIsFilterable?: CmsListFilterabilityControl
    defaultIsOrderable?: CmsListOrderabilityControl
    isEnabled: CmsGraphqlListEnablement
    names: GraphQLNames
    cacheHint?: unknown
  }
  fields: CmsField[]
  groups?: CmsFieldGroup[]
  db: CmsListDbConfig
  prisma: {
    types: GraphQLNames
    listKey: string
    mapping?: string
    extendPrismaSchema?: (schema: string) => string
  }
  resolvedDbFields: Record<string, CmsResolvedDbField>
  cacheHint?: unknown
  access?: CmsListAccess
  actions?: Record<string, CmsListActionConfig>
  hooks?: CmsListHooks
}

export type GraphQLNames = {
  outputTypeName: string
  whereInputName: string
  whereUniqueInputName: string
  createInputName: string
  createMutationName: string
  createManyMutationName: string
  relateToOneForCreateInputName: string
  relateToManyForCreateInputName: string
  itemQueryName: string
  listQueryName: string
  listQueryCountName: string
  listOrderName: string
  updateInputName: string
  updateMutationName: string
  updateManyInputName: string
  updateManyMutationName: string
  relateToOneForUpdateInputName: string
  relateToManyForUpdateInputName: string
  deleteMutationName: string
  deleteManyMutationName: string
}

export type AdminMetaField = {
  key: string
  path: string
  label: string
  description?: string
  fieldMeta: Record<string, unknown>
  itemField?: unknown
  viewsIndex: number
  isOrderable: boolean
  isFilterable: boolean
  customViewsIndex?: number | null
  search?: 'default' | 'insensitive' | null
  isNonNull: Array<'read' | 'create' | 'update'>
  createView: {
    fieldMode: FieldMode
    fieldPosition: 'form' | 'sidebar'
    isRequired?: boolean
  }
  itemView: {
    fieldMode: FieldMode
    fieldPosition: 'form' | 'sidebar'
    isRequired?: boolean
  }
  listView: { fieldMode: FieldMode; fieldPosition: 'form' | 'sidebar' }
}

export type AdminMetaAction = {
  key: string
  label: string
  icon?: string | null
  messages: CmsActionMessages
  graphql: {
    names: {
      one: string
      many: string
    }
  }
  itemView: {
    actionMode: ActionMode
    navigation: 'follow' | 'refetch' | 'return'
    hidePrompt: boolean
    hideToast: boolean
  }
  listView: {
    actionMode: ActionMode
  }
}

export type AdminMetaGroupField = {
  key: string
  path: string
  field?: AdminMetaField
}

export type AdminMetaGroup = {
  label: string
  description: string | null
  fields: AdminMetaGroupField[]
}

export type AdminMetaList = Omit<
  CmsList,
  'fields' | 'groups' | 'initialSort' | 'actions' | 'graphql'
> & {
  initialSort: { field: string; direction: 'ASC' | 'DESC' } | null
  initialFilter: Record<string, unknown> | null
  hideNavigation: boolean
  fields: AdminMetaField[]
  fieldsByKey: Record<string, AdminMetaField>
  groups: AdminMetaGroup[]
  actions: AdminMetaAction[]
  gqlNames: GraphQLNames
  graphql: { names: GraphQLNames }
}

export type AdminMeta = {
  views: string[]
  lists: AdminMetaList[]
  listsByKey: Record<string, AdminMetaList>
  isAccessAllowed: boolean
  auth?: {
    listKey: string
    identityField: string
    secretField: string
    sessionData: string
    initFirstItemFields: string[]
  } | null
}
