import type { CmsField, CmsPasswordFieldKdf, FieldKind } from '../types'
import { getStructureInitialValue, resolveStructureValue } from '../structure'
import type { StructureSchema } from '../structure'

export type CmsFieldConfig = Omit<CmsField, 'path' | 'graphql'> & {
  path?: string
  graphql?: Partial<CmsField['graphql']>
}

type KeystoneUiOptions = {
  createView?: CmsFieldConfig['createView']
  itemView?: CmsFieldConfig['itemView']
  listView?: CmsFieldConfig['listView']
  description?: string
  [key: string]: unknown
}

type KeystoneFieldFactoryOptions = Omit<
  CmsFieldConfig,
  'kind' | 'path' | 'createView' | 'itemView' | 'listView' | 'fieldMeta' | 'db'
> & {
  ui?: KeystoneUiOptions
  createView?: CmsFieldConfig['createView']
  itemView?: CmsFieldConfig['itemView']
  listView?: CmsFieldConfig['listView']
  fieldMeta?: Record<string, unknown>
  db?: CmsFieldConfig['db']
  graphql?: CmsFieldConfig['graphql']
  isIndexed?: 'unique' | boolean
  storage?: string
  transformName?: (originalFilename: string) => string | Promise<string>
  precision?: number
  scale?: number
  formatting?: unknown
  links?: unknown
  layouts?: unknown
  dividers?: unknown
  relationships?: Record<string, unknown>
  componentBlocks?: Record<string, unknown>
  [key: string]: unknown
}

type PasswordFieldOptions = KeystoneFieldFactoryOptions & {
  validation?: {
    isRequired?: boolean
    rejectCommon?: boolean
    match?: { regex: RegExp; explanation?: string }
    length?: {
      min?: number
      max?: number
    }
  }
  kdf?: CmsPasswordFieldKdf
}

type FieldFactoryOptions = KeystoneFieldFactoryOptions

type RelationshipFieldOptions = FieldFactoryOptions & {
  ref: string
  many?: boolean
}

type DocumentFieldOptions = FieldFactoryOptions & {
  formatting?:
    | boolean
    | {
        inlineMarks?: boolean | Record<string, boolean>
        listTypes?: boolean | Record<string, boolean>
        alignment?: boolean | Record<string, boolean>
        headingLevels?: readonly (1 | 2 | 3 | 4 | 5 | 6)[] | boolean
        blockTypes?: boolean | Record<string, boolean>
        softBreaks?: boolean
      }
  links?: boolean
  dividers?: boolean
  layouts?: readonly (readonly [number, ...number[]])[]
  relationships?: Record<string, unknown>
  componentBlocks?: Record<string, unknown>
}

export type StructureFieldOptions = FieldFactoryOptions & {
  schema: StructureSchema
  db?: FieldFactoryOptions['db'] & { map?: string }
}

function splitUiOptions(ui: KeystoneUiOptions | undefined) {
  if (!ui)
    return {
      viewOptions: {},
      uiMetadata: undefined as Record<string, unknown> | undefined,
    }
  const {
    createView,
    itemView,
    listView,
    description: _description,
    ...uiMetadata
  } = ui
  return {
    viewOptions: { createView, itemView, listView },
    uiMetadata: Object.keys(uiMetadata).length ? uiMetadata : undefined,
  }
}

function defaultStorageFieldPrismaSchema(kind: FieldKind) {
  if (kind === 'image') {
    return (fieldPath: string) => `
      ${fieldPath}_id String?
      ${fieldPath}_extension String?
      ${fieldPath}_filesize Int?
      ${fieldPath}_width Int?
      ${fieldPath}_height Int?
    `
  }
  if (kind === 'file') {
    return (fieldPath: string) => `
      ${fieldPath}_filesize Int?
      ${fieldPath}_filename String?
    `
  }
  return undefined
}

function normalizeDocumentFeatures(
  config: Pick<
    DocumentFieldOptions,
    'formatting' | 'links' | 'dividers' | 'layouts'
  >,
) {
  const formatting =
    typeof config.formatting === 'boolean'
      ? {
          inlineMarks: config.formatting,
          listTypes: config.formatting,
          alignment: config.formatting,
          headingLevels: config.formatting,
          blockTypes: config.formatting,
          softBreaks: config.formatting,
        }
      : (config.formatting ?? {})

  const headingLevels = formatting.headingLevels
  return {
    formatting: {
      inlineMarks: {
        bold:
          typeof formatting.inlineMarks === 'boolean'
            ? formatting.inlineMarks
            : Boolean(formatting.inlineMarks?.bold),
        italic:
          typeof formatting.inlineMarks === 'boolean'
            ? formatting.inlineMarks
            : Boolean(formatting.inlineMarks?.italic),
        underline:
          typeof formatting.inlineMarks === 'boolean'
            ? formatting.inlineMarks
            : Boolean(formatting.inlineMarks?.underline),
        strikethrough:
          typeof formatting.inlineMarks === 'boolean'
            ? formatting.inlineMarks
            : Boolean(formatting.inlineMarks?.strikethrough),
        code:
          typeof formatting.inlineMarks === 'boolean'
            ? formatting.inlineMarks
            : Boolean(formatting.inlineMarks?.code),
        superscript:
          typeof formatting.inlineMarks === 'boolean'
            ? formatting.inlineMarks
            : Boolean(formatting.inlineMarks?.superscript),
        subscript:
          typeof formatting.inlineMarks === 'boolean'
            ? formatting.inlineMarks
            : Boolean(formatting.inlineMarks?.subscript),
        keyboard:
          typeof formatting.inlineMarks === 'boolean'
            ? formatting.inlineMarks
            : Boolean(formatting.inlineMarks?.keyboard),
      },
      listTypes: {
        ordered:
          typeof formatting.listTypes === 'boolean'
            ? formatting.listTypes
            : Boolean(formatting.listTypes?.ordered),
        unordered:
          typeof formatting.listTypes === 'boolean'
            ? formatting.listTypes
            : Boolean(formatting.listTypes?.unordered),
      },
      alignment: {
        center:
          typeof formatting.alignment === 'boolean'
            ? formatting.alignment
            : Boolean(formatting.alignment?.center),
        end:
          typeof formatting.alignment === 'boolean'
            ? formatting.alignment
            : Boolean(formatting.alignment?.end),
      },
      headingLevels:
        typeof headingLevels === 'boolean'
          ? headingLevels
            ? [1, 2, 3, 4, 5, 6]
            : []
          : Array.isArray(headingLevels)
            ? [...new Set(headingLevels)].sort((a, b) => a - b)
            : [],
      blockTypes: {
        blockquote:
          typeof formatting.blockTypes === 'boolean'
            ? formatting.blockTypes
            : Boolean(formatting.blockTypes?.blockquote),
        code:
          typeof formatting.blockTypes === 'boolean'
            ? formatting.blockTypes
            : Boolean(formatting.blockTypes?.code),
      },
      softBreaks: Boolean(formatting.softBreaks),
    },
    links: Boolean(config.links),
    dividers: Boolean(config.dividers),
    layouts: config.layouts ? [...config.layouts] : [],
  }
}

function field<TKind extends FieldKind>(
  kind: TKind,
  options: FieldFactoryOptions = {},
) {
  const {
    ui,
    isIndexed,
    storage,
    transformName,
    precision,
    scale,
    formatting,
    links,
    layouts,
    dividers,
    fieldMeta,
    db,
    ...rest
  } = options
  const { viewOptions, uiMetadata } = splitUiOptions(ui)
  const metadata = {
    ...(ui?.description && rest.description === undefined
      ? { uiDescription: ui.description }
      : {}),
    ...(uiMetadata ? { ui: uiMetadata } : {}),
    ...(storage !== undefined ? { storage } : {}),
    ...(transformName !== undefined ? { transformName } : {}),
    ...(precision !== undefined ? { precision } : {}),
    ...(scale !== undefined ? { scale } : {}),
    ...(formatting !== undefined ? { formatting } : {}),
    ...(links !== undefined ? { links } : {}),
    ...(layouts !== undefined ? { layouts } : {}),
    ...(dividers !== undefined ? { dividers } : {}),
    ...fieldMeta,
  }
  const defaultExtendPrismaSchema = defaultStorageFieldPrismaSchema(kind)
  const normalisedDb = {
    ...(defaultExtendPrismaSchema
      ? { extendPrismaSchema: defaultExtendPrismaSchema }
      : {}),
    ...(db ?? {}),
    ...(isIndexed === 'unique' ? { isUnique: true } : {}),
    ...(isIndexed === true ? { isIndexed: true } : {}),
  }

  return {
    kind,
    ...viewOptions,
    ...(ui?.description && rest.description === undefined
      ? { description: ui.description }
      : {}),
    ...rest,
    ...(Object.keys(metadata).length ? { fieldMeta: metadata } : {}),
    ...(Object.keys(normalisedDb).length ? { db: normalisedDb } : {}),
  } satisfies CmsFieldConfig
}

export function text(options: FieldFactoryOptions = {}) {
  return field('text', {
    defaultValue: options.defaultValue ?? '',
    ...options,
  })
}

export function password(options: PasswordFieldOptions = {}) {
  const match = options.validation?.match
  const min = options.validation?.isRequired
    ? (options.validation.length?.min ?? 8)
    : options.validation?.length?.min
  const max = options.validation?.length?.max

  if (options.isIndexed === 'unique') {
    throw new Error(
      "isIndexed: 'unique' is not a supported option for field type password",
    )
  }
  if (min !== undefined && (!Number.isInteger(min) || min < 0)) {
    throw new Error(
      `PasswordThing.secret specifies validation.length.min: ${String(min)} but it must be a positive integer`,
    )
  }
  if (max !== undefined && (!Number.isInteger(max) || max < 0)) {
    throw new Error(
      `PasswordThing.secret specifies validation.length.max: ${String(max)} but it must be a positive integer`,
    )
  }
  if (options.validation?.isRequired && min === 0) {
    throw new Error('validation.isRequired: true and validation.length.min: 0')
  }
  if (options.validation?.isRequired && max === 0) {
    throw new Error('validation.isRequired: true and validation.length.max: 0')
  }
  if (min !== undefined && max !== undefined && min > max) {
    throw new Error(
      'validation.length.max that is less than the validation.length.min',
    )
  }

  return field('password', {
    ...options,
    fieldMeta: {
      ...(options.fieldMeta ?? {}),
      validation: {
        rejectCommon: options.validation?.rejectCommon ?? false,
        match: match
          ? {
              regex: {
                source: match.regex.source,
                flags: match.regex.flags,
              },
              explanation:
                match.explanation ?? `value must match ${match.regex}`,
            }
          : null,
        length: {
          min:
            options.validation?.length?.min ??
            (options.validation?.isRequired ? 8 : 1),
          max: options.validation?.length?.max ?? null,
        },
      },
      isNullable: options.validation?.isRequired ? false : true,
    },
    password: {
      kdf: options.kdf,
    },
  })
}

export function checkbox(options: FieldFactoryOptions = {}) {
  return field('checkbox', {
    defaultValue: options.defaultValue ?? false,
    ...options,
  })
}

export function select(options: FieldFactoryOptions = {}) {
  const selectType =
    options.type === 'integer' ||
    options.type === 'enum' ||
    options.type === 'string'
      ? options.type
      : 'string'
  if (Array.isArray(options.options)) {
    if (selectType === 'integer') {
      const invalidOption = options.options.find(
        (option) =>
          typeof option.value !== 'number' || !Number.isInteger(option.value),
      )
      if (invalidOption) {
        throw new Error(
          `select integer options must use integer numeric values`,
        )
      }
    }
    const duplicateValues = options.options
      .map((option) => option.value)
      .filter(
        (value, index, values) =>
          values.findIndex((candidate) => candidate === value) !== index,
      )
    if (duplicateValues.length > 0) {
      throw new Error(
        `select options must not contain duplicate values: ${duplicateValues.join(', ')}`,
      )
    }
  }
  return field('select', {
    ...options,
    fieldMeta: {
      ...(options.fieldMeta ?? {}),
      type: selectType,
    },
  })
}

export function multiselect(options: FieldFactoryOptions = {}) {
  const multiselectType =
    options.type === 'integer' ||
    options.type === 'enum' ||
    options.type === 'string'
      ? options.type
      : 'string'
  if (Array.isArray(options.options)) {
    if (multiselectType === 'integer') {
      const invalidOption = options.options.find(
        (option) =>
          typeof option.value !== 'number' || !Number.isInteger(option.value),
      )
      if (invalidOption) {
        throw new Error(
          `multiselect integer options must use integer numeric values`,
        )
      }
    }
    const duplicateValues = options.options
      .map((option) => option.value)
      .filter(
        (value, index, values) =>
          values.findIndex((candidate) => candidate === value) !== index,
      )
    if (duplicateValues.length > 0) {
      throw new Error(
        `multiselect options must not contain duplicate values: ${duplicateValues.join(', ')}`,
      )
    }
  }
  return field('multiselect', {
    defaultValue: options.defaultValue ?? [],
    ...options,
    fieldMeta: {
      ...(options.fieldMeta ?? {}),
      type: multiselectType,
    },
  })
}

export function relationship(options: RelationshipFieldOptions) {
  const countMode = options.ui?.displayMode === 'count'
  return field('relationship', {
    ...options,
    ...(countMode && !options.itemView && !options.ui?.itemView
      ? { itemView: { fieldMode: 'read' } }
      : {}),
  })
}

function normalizeDocumentRelationships(
  relationships: Record<string, unknown> | undefined,
) {
  if (!relationships) return {}
  const normalized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(relationships)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const relationshipConfig = value as Record<string, unknown>
    normalized[key] = {
      ...relationshipConfig,
      labelField:
        typeof relationshipConfig.labelField === 'string'
          ? relationshipConfig.labelField
          : null,
      selection:
        typeof relationshipConfig.selection === 'string'
          ? relationshipConfig.selection
          : null,
      filter:
        relationshipConfig.filter &&
        typeof relationshipConfig.filter === 'object' &&
        !Array.isArray(relationshipConfig.filter)
          ? relationshipConfig.filter
          : null,
      sort:
        relationshipConfig.sort &&
        typeof relationshipConfig.sort === 'object' &&
        !Array.isArray(relationshipConfig.sort)
          ? relationshipConfig.sort
          : null,
    }
  }
  return normalized
}

export function document(options: DocumentFieldOptions = {}) {
  if (options.isIndexed === 'unique') {
    throw new Error(
      "isIndexed: 'unique' is not a supported option for field type document",
    )
  }
  const documentFeatures = normalizeDocumentFeatures(options)
  const relationships = normalizeDocumentRelationships(options.relationships)
  return field('document', {
    defaultValue: options.defaultValue ?? [
      { type: 'paragraph', children: [{ text: '' }] },
    ],
    ...options,
    fieldMeta: {
      documentFeatures,
      relationships,
      componentBlocksPassedOnServer: Object.keys(options.componentBlocks ?? {}),
      componentBlocks: options.componentBlocks ?? {},
      ...(options.fieldMeta ?? {}),
    },
  })
}

function operationHook<THook>(
  hook: THook | Partial<Record<'create' | 'update', THook>> | undefined,
  operation: 'create' | 'update',
) {
  if (typeof hook === 'function') return hook
  return (hook as Partial<Record<'create' | 'update', THook>> | undefined)?.[
    operation
  ]
}

export function structure({ schema, ...options }: StructureFieldOptions) {
  if (options.isIndexed === 'unique')
    throw new Error(
      "isIndexed: 'unique' is not a supported option for field type structure",
    )
  const configuredResolveInput = options.hooks?.resolveInput
  return field('structure', {
    ...options,
    defaultValue: getStructureInitialValue(schema),
    isFilterable: false,
    isOrderable: false,
    viewsIndex: '@keystone-6/fields-document/structure-views',
    db: { isNullable: false, ...(options.db ?? {}) },
    hooks: {
      ...(options.hooks ?? {}),
      resolveInput: {
        create: async (args) => {
          const value = await resolveStructureValue(
            schema,
            args.resolvedData[args.fieldKey],
            undefined,
            'create',
            args.context,
          )
          const hook = operationHook(configuredResolveInput, 'create')
          return hook
            ? hook({
                ...args,
                resolvedData: { ...args.resolvedData, [args.fieldKey]: value },
              })
            : value
        },
        update: async (args) => {
          const value = await resolveStructureValue(
            schema,
            args.resolvedData[args.fieldKey],
            args.item?.[args.fieldKey],
            'update',
            args.context,
          )
          const hook = operationHook(configuredResolveInput, 'update')
          return hook
            ? hook({
                ...args,
                resolvedData: { ...args.resolvedData, [args.fieldKey]: value },
              })
            : value
        },
      },
    },
    fieldMeta: {
      ...(options.fieldMeta ?? {}),
      structureSchema: schema,
      telemetryFieldTypeName: '@keystone-6/structure',
    },
  })
}

export function timestamp(options: FieldFactoryOptions = {}) {
  return field('timestamp', options)
}

export function calendarDay(options: FieldFactoryOptions = {}) {
  const defaultValue = options.defaultValue
  if (
    typeof defaultValue === 'string' &&
    !/^\d{4}-\d{2}-\d{2}$/.test(defaultValue)
  ) {
    throw new Error(
      `calendarDay defaultValue ${defaultValue} must be a full-date ISO8601 string such as 1970-01-01`,
    )
  }
  return field('calendarDay', options)
}

export function integer(options: FieldFactoryOptions = {}) {
  return field('integer', options)
}

export function float(options: FieldFactoryOptions = {}) {
  return field('float', options)
}

export function decimal(options: FieldFactoryOptions = {}) {
  return field('decimal', options)
}

export function bigInt(options: FieldFactoryOptions = {}) {
  return field('bigInt', options)
}

export function json(options: FieldFactoryOptions = {}) {
  return field('json', options)
}

export function image(options: FieldFactoryOptions = {}) {
  return field('image', options)
}

export function file(options: FieldFactoryOptions = {}) {
  return field('file', options)
}

type VirtualGraphQLDescriptor =
  | string
  | { kind: 'list'; of: VirtualGraphQLDescriptor }
  | { kind: 'nonNull'; of: VirtualGraphQLDescriptor }
  | { kind: 'enum'; name: string; values: string[] }
  | {
      kind: 'object'
      name: string
      fields: Record<string, { type: VirtualGraphQLDescriptor }>
    }

function virtualGraphQLType(descriptor: VirtualGraphQLDescriptor): {
  type: string
  typeDefs: string[]
} {
  if (typeof descriptor === 'string') return { type: descriptor, typeDefs: [] }
  if (descriptor.kind === 'list') {
    const nested = virtualGraphQLType(descriptor.of)
    return { type: `[${nested.type}]`, typeDefs: nested.typeDefs }
  }
  if (descriptor.kind === 'nonNull') {
    const nested = virtualGraphQLType(descriptor.of)
    return { type: `${nested.type}!`, typeDefs: nested.typeDefs }
  }
  if (descriptor.kind === 'enum')
    return {
      type: descriptor.name,
      typeDefs: [
        `enum ${descriptor.name} {\n  ${descriptor.values.join('\n  ')}\n}`,
      ],
    }
  const fields = Object.entries(descriptor.fields).map(([path, entry]) => {
    const nested = virtualGraphQLType(entry.type)
    return { path, ...nested }
  })
  return {
    type: descriptor.name,
    typeDefs: [
      ...fields.flatMap((entry) => entry.typeDefs),
      `type ${descriptor.name} {\n  ${fields.map((entry) => `${entry.path}: ${entry.type}`).join('\n  ')}\n}`,
    ],
  }
}

export function virtual(
  options: FieldFactoryOptions & {
    field?:
      | string
      | {
          type: VirtualGraphQLDescriptor
          resolve?: CmsFieldConfig['resolver']
        }
    graphQLReturnType?: string
    resolver?: CmsFieldConfig['resolver']
  } = {},
) {
  const fieldDescriptor =
    options.field && typeof options.field === 'object'
      ? options.field
      : undefined
  const normalizedDescriptor = virtualGraphQLType(
    (options.graphQLReturnType ??
      fieldDescriptor?.type ??
      options.field ??
      'String') as VirtualGraphQLDescriptor,
  )
  const graphQLReturnType = normalizedDescriptor.type
  const itemViewFieldMode = options.itemView?.fieldMode ?? 'read'
  const listViewFieldMode = options.listView?.fieldMode ?? 'read'
  const uiQuery =
    typeof options.ui?.query === 'string' ? options.ui.query.trim() : ''
  const normalizedType = graphQLReturnType.replace(/!/g, '').trim()
  const baseType = normalizedType.replace(/^\[|\]$/g, '').trim()
  const scalarLikeTypes = new Set([
    'String',
    'Int',
    'Float',
    'Boolean',
    'ID',
    'JSON',
    'DateTime',
    'Decimal',
    'BigInt',
  ])
  const looksComposite = !fieldDescriptor && !scalarLikeTypes.has(baseType)

  if (
    looksComposite &&
    uiQuery.length === 0 &&
    itemViewFieldMode !== 'hidden' &&
    listViewFieldMode !== 'hidden'
  ) {
    throw new Error(
      `virtual fields with non-scalar GraphQL return types require ui.query, or ui.itemView.fieldMode and ui.listView.fieldMode to be set to 'hidden'`,
    )
  }

  return field('virtual', {
    isOrderable: false,
    isFilterable: false,
    itemView: { fieldMode: 'read', ...(options.itemView ?? {}) },
    createView: { fieldMode: 'hidden', ...(options.createView ?? {}) },
    listView: { fieldMode: 'read', ...(options.listView ?? {}) },
    ...options,
    fieldMeta: {
      ...(options.fieldMeta ?? {}),
      ...(uiQuery ? { query: uiQuery } : {}),
      ...(normalizedDescriptor.typeDefs.length
        ? { virtualTypeDefs: normalizedDescriptor.typeDefs }
        : {}),
    },
    resolver: options.resolver ?? fieldDescriptor?.resolve,
    graphQLReturnType,
  })
}
