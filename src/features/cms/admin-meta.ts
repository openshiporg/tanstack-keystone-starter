import type { CmsContext, CmsItem } from './adapters'
import { getGraphQLNames } from './gql-names'
import { cmsLists, getCmsListByPath } from './registry'
import {
  customViewIndexForField,
  generateViewOrder,
  viewIndexForField,
} from './view-order'
import type {
  ActionMode,
  ActionModeConfig,
  AdminMeta,
  AdminMetaAction,
  AdminMetaField,
  AdminMetaList,
  CmsActionMessages,
  CmsField,
  CmsList,
  CmsListAccessOperation,
  CmsListFilterOperation,
  FieldMode,
  FieldModeConfig,
  FieldPositionConfig,
} from './types'

const fieldKindToViewsIndex: Record<CmsField['kind'], string> = {
  id: 'id',
  text: 'text',
  password: 'password',
  checkbox: 'checkbox',
  select: 'select',
  multiselect: 'multiselect',
  relationship: 'relationship',
  document: 'document',
  structure: 'structure',
  timestamp: 'timestamp',
  calendarDay: 'calendarDay',
  integer: 'integer',
  float: 'float',
  decimal: 'decimal',
  bigInt: 'bigInt',
  json: 'json',
  image: 'image',
  file: 'file',
  virtual: 'virtual',
}

function staticFieldMode(
  view: { fieldMode?: FieldModeConfig } | undefined,
  fallback: FieldModeConfig,
  defaultMode: FieldMode,
) {
  const fieldMode = view?.fieldMode
  if (typeof fieldMode === 'string') return fieldMode
  return typeof fallback === 'string' ? fallback : defaultMode
}

function staticBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function relationshipMetadata(
  field: CmsField,
  list: CmsList,
  lists: CmsList[] = cmsLists,
) {
  const resolvedRelationship = list.resolvedDbFields?.[field.path]?.relationship
  const refListKey = resolvedRelationship?.refListKey
  const refFieldKey = resolvedRelationship?.refFieldKey
  const refList = refListKey
    ? lists.find((entry) => entry.key === refListKey)
    : undefined
  if (!refListKey || !refList) return {}

  const labelField = refList.fields.some(
    (candidate) => candidate.path === refList.labelField,
  )
    ? refList.labelField
    : 'id'
  const searchFields = (
    refList.initialSearchFields?.length
      ? refList.initialSearchFields
      : [labelField]
  ).filter((path) =>
    refList.fields.some((candidate) => candidate.path === path),
  )
  const ui =
    field.fieldMeta?.ui &&
    typeof field.fieldMeta.ui === 'object' &&
    !Array.isArray(field.fieldMeta.ui)
      ? (field.fieldMeta.ui as Record<string, unknown>)
      : {}
  const displayMode =
    ui.displayMode === 'count' ||
    ui.displayMode === 'table' ||
    ui.displayMode === 'cards'
      ? ui.displayMode
      : 'select'
  const relatedListCreateEnabled = isListOperationEnabled(refList, 'create')
  const hideCreate =
    typeof ui.hideCreate === 'boolean'
      ? ui.hideCreate
      : !relatedListCreateEnabled

  if (!hideCreate && !relatedListCreateEnabled) {
    throw new Error(
      `${list.key}.${field.path} has ui.hideCreate: false, but the related list ${refList.key} has graphql.omit.create: true`,
    )
  }

  if (
    displayMode === 'count' &&
    staticFieldMode(field.itemView, 'edit', 'edit') !== 'read'
  ) {
    throw new Error(
      `displayMode: 'count' on relationship fields requires itemView.fieldMode to be 'read' but ${list.key}.${field.path} does not have this set`,
    )
  }

  if (displayMode === 'table') {
    if (!refFieldKey) {
      throw new Error(
        `Using a two-sided relationship (ref must specify "List.fieldKey", not just "List") is required when using displayMode: 'table' for relationship fields but ${list.key}.${field.path} has ref: ${JSON.stringify(field.ref)}`,
      )
    }
    if (staticFieldMode(field.itemView, 'edit', 'edit') !== 'read') {
      throw new Error(
        `displayMode: 'table' on relationship fields currently requires itemView.fieldMode to be 'read' but ${list.key}.${field.path} does not have this set`,
      )
    }
    for (const key of Array.isArray(ui.columns) ? ui.columns : []) {
      if (!refList.fields.some((candidate) => candidate.path === key)) {
        throw new Error(
          `The field "${refList.key}.${String(key)}" does not exist, configured as a column for "${list.key}.${field.path}"`,
        )
      }
    }
    const initialSort =
      ui.initialSort &&
      typeof ui.initialSort === 'object' &&
      !Array.isArray(ui.initialSort)
        ? (ui.initialSort as Record<string, unknown>)
        : null
    if (
      initialSort?.field &&
      !refList.fields.some((candidate) => candidate.path === initialSort.field)
    ) {
      throw new Error(
        `The field "${refList.key}.${String(initialSort.field)}" does not exist, configured as the initialSort field for "${list.key}.${field.path}"`,
      )
    }
  }

  return {
    refListKey,
    refListPath: refList.path,
    refFieldKey,
    many: field.many ?? false,
    hideCreate,
    refLabelField:
      typeof ui.labelField === 'string' ? ui.labelField : labelField,
    refSearchFields: Array.isArray(ui.searchFields)
      ? ui.searchFields
      : searchFields.length
        ? searchFields
        : [labelField],
    displayMode,
    ...(displayMode === 'table'
      ? {
          columns: Array.isArray(ui.columns) ? ui.columns : null,
          initialSort: ui.initialSort ?? refList.initialSort ?? null,
        }
      : {}),
    ...(displayMode === 'select' || displayMode === 'cards'
      ? {
          filter: ui.filter ?? null,
          sort: ui.sort ?? refList.initialSort ?? null,
        }
      : {}),
    ...(displayMode === 'cards'
      ? {
          cardFields: Array.isArray(ui.cardFields) ? ui.cardFields : null,
          inlineCreate: ui.inlineCreate ?? null,
          inlineEdit: ui.inlineEdit ?? null,
          inlineConnect: ui.inlineConnect ?? null,
          linkToItem: ui.linkToItem ?? null,
          removeMode: ui.removeMode ?? null,
        }
      : {}),
  }
}

function graphqlSelectionForField(
  field: CmsField,
  relationshipMeta: Record<string, unknown>,
) {
  const configuredSelection =
    typeof field.fieldMeta?.graphqlSelection === 'string'
      ? field.fieldMeta.graphqlSelection
      : undefined
  if (configuredSelection?.trim()) return configuredSelection
  if (field.kind === 'relationship') {
    if (relationshipMeta.displayMode === 'count') return `${field.path}Count`
    const labelField =
      typeof relationshipMeta.refLabelField === 'string'
        ? relationshipMeta.refLabelField
        : 'id'
    return `${field.path} { id label: ${labelField} }`
  }
  if (field.kind === 'structure') return {}
  if (field.kind === 'document')
    return `${field.path} { document(hydrateRelationships: true) }`
  if (field.kind === 'password') return `${field.path} { isSet }`
  if (field.kind === 'image')
    return `${field.path} { id url extension filesize width height }`
  if (field.kind === 'file') return `${field.path} { filename filesize url }`
  return field.path
}

function defaultFieldModeFromConfig(config: unknown) {
  return config &&
    typeof config === 'object' &&
    !Array.isArray(config) &&
    'defaultFieldMode' in config
    ? (config as { defaultFieldMode?: FieldModeConfig }).defaultFieldMode
    : undefined
}

function listDefaultFieldModeConfig(
  list: CmsList,
  view: 'createView' | 'itemView' | 'listView',
) {
  return defaultFieldModeFromConfig(list.ui?.[view])
}

function groupDefaultFieldModeConfig(
  list: CmsList,
  field: CmsField,
  view: 'createView' | 'itemView' | 'listView',
) {
  const group = list.groups?.find((entry) => entry.fields.includes(field.path))
  return defaultFieldModeFromConfig(group?.ui?.[view])
}

function staticListDefaultFieldMode(
  list: CmsList,
  view: 'createView' | 'itemView' | 'listView',
  fallback: FieldMode,
) {
  const configured = listDefaultFieldModeConfig(list, view)
  return typeof configured === 'string' ? configured : fallback
}

function toAdminMetaField(
  field: CmsField,
  list: CmsList,
  lists: CmsList[] = cmsLists,
  viewOrder = generateViewOrder(lists),
): AdminMetaField {
  const relationshipMeta = relationshipMetadata(field, list, lists)
  const createFallback =
    field.kind === 'id'
      ? 'hidden'
      : (groupDefaultFieldModeConfig(list, field, 'createView') ??
        staticListDefaultFieldMode(list, 'createView', 'edit'))
  const itemFallback =
    groupDefaultFieldModeConfig(list, field, 'itemView') ??
    staticListDefaultFieldMode(list, 'itemView', 'edit')
  const listFallback =
    field.kind === 'password'
      ? 'hidden'
      : (groupDefaultFieldModeConfig(list, field, 'listView') ??
        staticListDefaultFieldMode(list, 'listView', 'read'))
  return {
    key: field.path,
    path: field.path,
    label: field.label ?? field.path,
    description: field.description ?? '',
    fieldMeta: {
      kind: field.kind,
      defaultValue: field.defaultValue,
      options: field.options,
      ref: field.ref,
      many: field.many,
      validation: field.validation,
      ...field.fieldMeta,
      ...relationshipMeta,
      graphqlSelection: graphqlSelectionForField(field, relationshipMeta),
    },
    isOrderable: staticBoolean(
      field.isOrderable ?? field.graphql?.isEnabled?.orderBy,
      ![
        'document',
        'json',
        'image',
        'file',
        'relationship',
        'password',
      ].includes(field.kind),
    ),
    isFilterable: staticBoolean(
      field.isFilterable ?? field.graphql?.isEnabled?.filter,
      !['document', 'image', 'file'].includes(field.kind),
    ),
    viewsIndex: viewIndexForField(
      {
        ...field,
        viewsIndex: field.viewsIndex ?? fieldKindToViewsIndex[field.kind],
      },
      viewOrder,
    ),
    customViewsIndex:
      field.customViewsIndex ?? customViewIndexForField(field, viewOrder),
    search: field.search ?? null,
    isNonNull: [
      ...(field.graphql?.isNonNull?.create === true ||
      field.validation?.isRequired ||
      field.isNonNull?.[0] === true
        ? (['create'] as const)
        : []),
      ...(field.graphql?.isNonNull?.update === true ||
      field.isNonNull?.[1] === true
        ? (['update'] as const)
        : []),
    ],
    createView: {
      fieldMode: staticFieldMode(field.createView, createFallback, 'edit'),
      fieldPosition:
        typeof field.createView?.fieldPosition === 'string'
          ? field.createView.fieldPosition
          : 'form',
      isRequired: staticBoolean(
        field.createView?.isRequired,
        field.graphql?.isNonNull?.create ??
          (field.validation?.isRequired === true ||
            field.isNonNull?.[0] === true),
      ),
    },
    itemView: {
      fieldMode: staticFieldMode(field.itemView, itemFallback, 'edit'),
      fieldPosition:
        typeof field.itemView?.fieldPosition === 'string'
          ? field.itemView.fieldPosition
          : 'form',
      isRequired: staticBoolean(
        field.itemView?.isRequired,
        field.graphql?.isNonNull?.create ??
          (field.validation?.isRequired === true ||
            field.isNonNull?.[0] === true),
      ),
    },
    listView: {
      fieldMode: staticFieldMode(field.listView, listFallback, 'read'),
      fieldPosition:
        typeof field.listView?.fieldPosition === 'string'
          ? field.listView.fieldPosition
          : 'form',
    },
  }
}

export async function evaluateFieldMode(
  value: FieldModeConfig | undefined,
  fallback: FieldMode,
  context: CmsContext,
  item?: CmsItem | null,
) {
  if (typeof value === 'string') return value
  if (typeof value !== 'function') return fallback
  return value({ context, session: context.session, item })
}

export async function evaluateFieldPosition(
  value: FieldPositionConfig | undefined,
  fallback: 'form' | 'sidebar',
  context: CmsContext,
  item?: CmsItem | null,
) {
  if (typeof value === 'string') return value
  if (typeof value !== 'function') return fallback
  const result = await value({ context, session: context.session, item })
  if (result !== 'form' && result !== 'sidebar')
    throw new Error(
      `fieldPosition must return form or sidebar, received ${String(result)}`,
    )
  return result
}

export async function evaluateActionMode(
  value: ActionModeConfig | undefined,
  fallback: ActionMode,
  context: CmsContext,
  listKey: string,
  actionKey: string,
  item?: CmsItem | null,
) {
  if (typeof value === 'string') return value
  if (typeof value !== 'function') return fallback
  return value({ context, session: context.session, item, listKey, actionKey })
}

function defaultActionMessages(label: string): CmsActionMessages {
  const lowerLabel = label.toLowerCase()
  return {
    promptTitle: `${label} {singular}`,
    promptTitleMany: `${label} {count} {singular|plural}`,
    prompt: `Are you sure you want to ${lowerLabel} {singular} "{itemLabel}"?`,
    promptMany: `Are you sure you want to ${lowerLabel} {count} {singular|plural}?`,
    promptConfirmLabel: `Yes, ${lowerLabel} this {singular}`,
    promptConfirmLabelMany: `Yes, ${lowerLabel} {count} {singular|plural}`,
    fail: `Could not ${lowerLabel} {singular}`,
    failMany: `Could not ${lowerLabel} {countFail} {singular|plural}`,
    success: `Completed ${lowerLabel} action for {singular}`,
    successMany: `Completed ${lowerLabel} action for {countSuccess} {singular|plural}`,
  }
}

function toAdminMetaActions(list: CmsList): AdminMetaAction[] {
  return Object.entries(list.actions ?? {}).map(([actionKey, action]) => {
    return {
      key: actionKey,
      label: action.ui.label,
      icon: action.ui.icon ?? null,
      messages: {
        ...defaultActionMessages(action.ui.label),
        ...(action.ui.messages ?? {}),
      },
      graphql: {
        names: {
          one: action.graphql?.singular ?? `${actionKey}${list.key}`,
          many:
            action.graphql?.plural ??
            `${actionKey}${list.plural.replace(/\s+/g, '')}`,
        },
      },
      itemView: {
        actionMode:
          typeof action.ui.itemView?.actionMode === 'string'
            ? action.ui.itemView.actionMode
            : 'enabled',
        navigation: action.ui.itemView?.navigation ?? 'follow',
        hidePrompt: action.ui.itemView?.hidePrompt ?? false,
        hideToast: action.ui.itemView?.hideToast ?? false,
      },
      listView: {
        actionMode:
          typeof action.ui.listView?.actionMode === 'string'
            ? action.ui.listView.actionMode
            : 'enabled',
      },
    }
  })
}

async function evaluateFieldFilterOrderFlag(args: {
  field: CmsField
  list: CmsList
  context: CmsContext
  operation: CmsListFilterOperation
  kind: 'filter' | 'orderBy'
}) {
  const { field, list, context, operation, kind } = args
  const graphEnabled =
    kind === 'filter'
      ? field.graphql?.isEnabled?.filter
      : field.graphql?.isEnabled?.orderBy
  const configured = kind === 'filter' ? field.isFilterable : field.isOrderable
  const phase = `${list.key}.${field.path}.is${kind === 'filter' ? 'Filterable' : 'Orderable'}`
  const raw =
    typeof configured === 'function'
      ? await configured({
          context,
          session: context.session,
          listKey: list.key,
          fieldKey: field.path,
          field,
          operation,
        })
      : (configured ?? graphEnabled ?? true)
  if (typeof raw !== 'boolean')
    throw new Error(`${phase} must return a boolean, received ${typeof raw}`)
  return raw
}

async function evaluateAdminMetaField(
  field: CmsField,
  list: CmsList,
  meta: AdminMetaField,
  context: CmsContext,
): Promise<AdminMetaField> {
  return {
    ...meta,
    isFilterable: await evaluateFieldFilterOrderFlag({
      field,
      list,
      context,
      operation: 'query',
      kind: 'filter',
    }),
    isOrderable: await evaluateFieldFilterOrderFlag({
      field,
      list,
      context,
      operation: 'query',
      kind: 'orderBy',
    }),
    createView: {
      ...meta.createView,
      fieldMode: await evaluateFieldMode(
        field.createView?.fieldMode ??
          groupDefaultFieldModeConfig(list, field, 'createView') ??
          listDefaultFieldModeConfig(list, 'createView'),
        meta.createView.fieldMode,
        context,
      ),
      isRequired:
        typeof field.createView?.isRequired === 'function'
          ? await field.createView.isRequired({
              context,
              session: context.session,
              item: null,
            })
          : (field.createView?.isRequired ?? meta.createView.isRequired),
    },
    itemView: {
      ...meta.itemView,
      fieldMode: await evaluateFieldMode(
        field.itemView?.fieldMode ??
          groupDefaultFieldModeConfig(list, field, 'itemView') ??
          listDefaultFieldModeConfig(list, 'itemView'),
        meta.itemView.fieldMode,
        context,
      ),
    },
    listView: {
      ...meta.listView,
      fieldMode: await evaluateFieldMode(
        field.listView?.fieldMode ??
          groupDefaultFieldModeConfig(list, field, 'listView') ??
          listDefaultFieldModeConfig(list, 'listView'),
        meta.listView.fieldMode,
        context,
      ),
    },
  }
}

async function evaluateListUiFlag(
  value: CmsList['hideCreate'] | CmsList['hideNavigation'],
  list: CmsList,
  context: CmsContext | undefined,
  operation: CmsListAccessOperation,
) {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'function' || !context) return false
  return Boolean(
    await value({
      context,
      session: context.session,
      listKey: list.key,
      operation,
    }),
  )
}

function isListOperationEnabled(
  list: CmsList,
  operation: 'query' | 'create' | 'update' | 'delete',
) {
  const omit = list.graphql?.omit
  if (omit === true) return false
  if (
    omit &&
    typeof omit === 'object' &&
    !Array.isArray(omit) &&
    omit[operation] === true
  )
    return false
  return true
}

function defaultInitialColumns(list: CmsList) {
  const readableFieldPaths = list.fields
    .filter((field) => field.path !== 'id')
    .filter(
      (field) =>
        field.graphql?.omit !== true && field.listView?.fieldMode !== 'hidden',
    )
    .map((field) => field.path)

  return Array.from(
    new Set([
      list.labelField,
      ...readableFieldPaths.filter(
        (fieldPath) => fieldPath !== list.labelField,
      ),
    ]),
  ).slice(0, 3)
}

function isRelationshipFieldVisibleInAdminMeta(
  field: CmsField,
  list: CmsList,
  visibleLists: CmsList[],
) {
  if (field.kind !== 'relationship') return true
  const refListKey =
    list.resolvedDbFields?.[field.path]?.relationship?.refListKey
  if (!refListKey) return true
  return visibleLists.some((visibleList) => visibleList.key === refListKey)
}

function toAdminMetaList(
  list: CmsList,
  lists: CmsList[] = cmsLists,
  viewOrder = generateViewOrder(lists),
  uiOverrides?: { hideCreate?: boolean; hideDelete?: boolean },
): AdminMetaList {
  const gqlNames = getGraphQLNames(list.key, list.plural)
  const maximumPageSize = Math.min(
    list.pageSize ?? 50,
    list.graphql?.maxTake ?? Number.POSITIVE_INFINITY,
  )
  const visibleFields = list.fields.filter((field) =>
    isRelationshipFieldVisibleInAdminMeta(field, list, lists),
  )
  const visibleFieldPaths = new Set(visibleFields.map((field) => field.path))
  const adminFields = visibleFields.map((field) =>
    toAdminMetaField(field, list, lists, viewOrder),
  )
  const fieldsByKey = Object.fromEntries(
    adminFields.map((field) => [field.key, field]),
  )

  return {
    ...list,
    initialColumns: list.initialColumns.length
      ? list.initialColumns
      : defaultInitialColumns(list),
    initialSort: list.initialSort ?? null,
    initialFilter: list.initialFilter ?? null,
    pageSize: Number.isFinite(maximumPageSize)
      ? maximumPageSize
      : (list.pageSize ?? 50),
    isSingleton: list.isSingleton ?? false,
    isHidden:
      typeof list.hideNavigation === 'boolean'
        ? list.hideNavigation
        : (list.isHidden ?? false),
    hideNavigation:
      typeof list.hideNavigation === 'boolean'
        ? list.hideNavigation
        : (list.isHidden ?? false),
    hideCreate:
      uiOverrides?.hideCreate ??
      (typeof list.hideCreate === 'boolean'
        ? list.hideCreate
        : !isListOperationEnabled(list, 'create')),
    hideDelete:
      uiOverrides?.hideDelete ??
      (typeof list.hideDelete === 'boolean'
        ? list.hideDelete
        : !isListOperationEnabled(list, 'delete')),
    fields: adminFields,
    fieldsByKey,
    groups: (list.groups ?? [])
      .map((group) => ({
        label: group.label,
        description: group.description ?? null,
        fields: group.fields
          .filter((path) => visibleFieldPaths.has(path))
          .map((path) => ({ key: path, path, field: fieldsByKey[path] })),
      }))
      .filter((group) => group.fields.length > 0),
    actions: toAdminMetaActions(list),
    gqlNames,
    graphql: { names: gqlNames },
  }
}

function adminMetaVisibleLists(lists: CmsList[]) {
  return lists.filter((list) => isListOperationEnabled(list, 'query'))
}

const adminMetaLists = adminMetaVisibleLists(cmsLists)
const cmsViewOrder = generateViewOrder(adminMetaLists)

const staticAdminMetaLists = adminMetaLists.map((list) =>
  toAdminMetaList(list, adminMetaLists, cmsViewOrder),
)

export const adminMeta: AdminMeta = {
  views: cmsViewOrder,
  lists: staticAdminMetaLists,
  listsByKey: Object.fromEntries(
    staticAdminMetaLists.map((list) => [list.key, list]),
  ),
  isAccessAllowed: true,
}

export function getAdminMeta(lists: CmsList[] = cmsLists) {
  if (lists === cmsLists) return adminMeta
  const visibleLists = adminMetaVisibleLists(lists)
  const viewOrder = generateViewOrder(visibleLists)
  const adminLists = visibleLists.map((list) =>
    toAdminMetaList(list, visibleLists, viewOrder),
  )
  return {
    views: viewOrder,
    lists: adminLists,
    listsByKey: Object.fromEntries(adminLists.map((list) => [list.key, list])),
    isAccessAllowed: true,
  }
}

export async function getAdminMetaForContext(
  context: CmsContext,
  lists: CmsList[] = cmsLists,
) {
  const visibleLists = adminMetaVisibleLists(lists)
  const viewOrder =
    visibleLists === adminMetaLists
      ? cmsViewOrder
      : generateViewOrder(visibleLists)
  const adminLists = await Promise.all(
    visibleLists.map(async (list) => {
      const meta = toAdminMetaList(list, visibleLists, viewOrder, {
        hideCreate: await evaluateListUiFlag(
          list.hideCreate,
          list,
          context,
          'create',
        ),
        hideDelete: await evaluateListUiFlag(
          list.hideDelete,
          list,
          context,
          'delete',
        ),
      })
      const runtimeFields = await Promise.all(
        list.fields
          .filter((field) =>
            isRelationshipFieldVisibleInAdminMeta(field, list, visibleLists),
          )
          .map(async (field, index) => ({
            ...(await evaluateAdminMetaField(
              field,
              list,
              meta.fields[index],
              context,
            )),
            originalField: field,
            originalList: list,
            listKey: list.key,
          })),
      )
      const runtimeFieldsByKey = Object.fromEntries(
        runtimeFields.map((field) => [field.key, field]),
      )
      return {
        ...meta,
        initialFilter:
          typeof list.ui?.listView?.initialFilter === 'function'
            ? ((await list.ui.listView.initialFilter({
                context,
                session: context.session,
              })) ?? null)
            : (list.ui?.listView?.initialFilter ?? meta.initialFilter),
        hideNavigation: await evaluateListUiFlag(
          list.hideNavigation ?? list.ui?.hideNavigation,
          list,
          context,
          'query',
        ),
        isHidden: await evaluateListUiFlag(
          list.hideNavigation ?? list.ui?.hideNavigation,
          list,
          context,
          'query',
        ),
        fields: runtimeFields,
        fieldsByKey: runtimeFieldsByKey,
        groups: meta.groups.map((group) => ({
          ...group,
          fields: group.fields.map((groupField) => ({
            ...groupField,
            field: runtimeFieldsByKey[groupField.key],
          })),
        })),
        actions: await Promise.all(
          meta.actions.map(async (actionMeta) => {
            const sourceAction = list.actions?.[actionMeta.key]
            return {
              ...actionMeta,
              itemView: {
                ...actionMeta.itemView,
                actionMode: await evaluateActionMode(
                  sourceAction?.ui.itemView?.actionMode,
                  actionMeta.itemView.actionMode,
                  context,
                  list.key,
                  actionMeta.key,
                ),
              },
              listView: {
                ...actionMeta.listView,
                actionMode: await evaluateActionMode(
                  sourceAction?.ui.listView?.actionMode,
                  actionMeta.listView.actionMode,
                  context,
                  list.key,
                  actionMeta.key,
                ),
              },
              originalAction: sourceAction,
              listKey: list.key,
            }
          }),
        ),
      }
    }),
  )

  return {
    views: viewOrder,
    isAccessAllowed: true,
    lists: adminLists,
    listsByKey: Object.fromEntries(adminLists.map((list) => [list.key, list])),
  }
}

export function getAdminMetaList(path: string) {
  const list = getCmsListByPath(path)
  return list ? toAdminMetaList(list, adminMetaLists, cmsViewOrder) : undefined
}
