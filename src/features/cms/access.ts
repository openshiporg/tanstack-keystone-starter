import { assertInputObjectType, coerceInputValue } from 'graphql'
import type { CmsContext, CmsItem } from './adapters'
import {
  accessDenied,
  accessReturnFailure,
  configFailure,
  extensionFailure,
  filterDenied,
  relationshipFailure,
} from './errors'
import { cmsLists } from './registry'
import type {
  CmsField,
  CmsFieldFilterabilityControl,
  CmsFieldOrderabilityControl,
  CmsList,
  CmsListAccessOperation,
  CmsListItemOperation,
} from './types'
import { resolveWhereUnique } from './where-unique'

export type AccessFilterOperation = Extract<
  CmsListAccessOperation,
  'query' | 'update' | 'delete'
>
export type FieldAccessOperation = 'read' | 'create' | 'update'
export type ItemAccessOperation = CmsListItemOperation

function getRuntimeLists(context?: Pick<CmsContext, '__internal'>) {
  return context?.__internal.lists ?? cmsLists
}

function getList(
  listKey: string,
  context?: Pick<CmsContext, '__internal'>,
): CmsList {
  const list = getRuntimeLists(context).find((entry) => entry.key === listKey)
  if (!list) throw configFailure(`Unknown CMS list ${listKey}`, { listKey })
  return list
}

function getField(list: CmsList, fieldPath: string): CmsField {
  const field = list.fields.find((entry) => entry.path === fieldPath)
  if (!field)
    throw configFailure(`Unknown field ${list.key}.${fieldPath}`, {
      listKey: list.key,
      fieldPath,
    })
  return field
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

export function isSudoContext(
  context: Pick<CmsContext, '__internal'> | undefined,
): boolean {
  return context?.__internal.sudo === true
}

async function evaluateAccessValue<TArgs extends Record<string, unknown>>(
  access: unknown,
  args: TArgs,
  phase: string,
): Promise<unknown> {
  if (typeof access !== 'function') return access
  try {
    return await (access as (args: TArgs) => unknown | Promise<unknown>)(args)
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error))
    throw extensionFailure([{ error: wrapped, tag: phase }], 'Access control', {
      phase,
    })
  }
}

function validateBoolean(value: unknown, phase: string): boolean {
  if (typeof value !== 'boolean')
    throw accessReturnFailure([{ tag: phase, returned: typeof value }], {
      phase,
    })
  return value
}

function validateFilter(
  value: unknown,
  phase: string,
): boolean | Record<string, unknown> {
  if (typeof value === 'boolean') return value
  if (isRecord(value)) return value
  throw accessReturnFailure(
    `${phase} must return a boolean or where filter object, received ${Array.isArray(value) ? 'array' : typeof value}`,
    { phase },
  )
}

function coerceAndValidateFilterValueShape(
  listKey: string,
  filterValue: unknown,
  context: CmsContext,
  phase: string,
): Record<string, unknown> {
  const list = getList(listKey, context)
  const schema = context.sudo().graphql.schema
  const whereInputType = schema.getType(
    list.graphql?.names?.whereInputName ?? `${list.key}WhereInput`,
  )
  if (!whereInputType) {
    throw accessReturnFailure(
      `${phase} could not find GraphQL input type ${list.graphql?.names?.whereInputName ?? `${list.key}WhereInput`}`,
      { phase, listKey },
    )
  }

  const whereInput = assertInputObjectType(whereInputType)
  const issues: string[] = []
  const coerced = coerceInputValue(
    filterValue,
    whereInput,
    (path, invalidValue, error) => {
      const renderedPath =
        path.length > 0 ? path.map(String).join('.') : '(root)'
      issues.push(
        `${renderedPath}: ${error.message}${invalidValue === undefined ? '' : ` (received ${JSON.stringify(invalidValue)})`}`,
      )
    },
  )

  if (issues.length > 0) {
    throw accessReturnFailure(
      `${phase} returned an invalid GraphQL where filter for ${listKey}\n${issues.map((issue) => `  - ${issue}`).join('\n')}`,
      { phase, listKey },
    )
  }

  return asRecord(coerced)
}

export async function getOperationAccess(
  listKey: string,
  operation: CmsListAccessOperation,
  context: CmsContext,
): Promise<boolean> {
  if (isSudoContext(context)) return true
  const list = getList(listKey, context)
  const configuredAccess = list.access?.operation?.[operation]
  if (configuredAccess === undefined) return true
  const phase = `${listKey}.access.operation.${operation}`
  const value = await evaluateAccessValue(
    configuredAccess,
    {
      context,
      session: context.session,
      listKey,
      operation,
    },
    phase,
  )
  return validateBoolean(value, phase)
}

export async function assertOperationAccess(
  listKey: string,
  operation: CmsListAccessOperation,
  context: CmsContext,
): Promise<void> {
  const allowed = await getOperationAccess(listKey, operation, context)
  if (!allowed)
    throw accessDenied(`Access denied: ${operation} ${listKey}`, {
      listKey,
      operation,
    })
}

export async function getAccessFilter(
  listKey: string,
  operation: AccessFilterOperation,
  context: CmsContext,
): Promise<boolean | Record<string, unknown>> {
  if (isSudoContext(context)) return true
  const list = getList(listKey, context)
  const configuredAccess = list.access?.filter?.[operation]
  if (configuredAccess === undefined) return true
  const phase = `${listKey}.access.filter.${operation}`
  const value = await evaluateAccessValue(
    configuredAccess,
    {
      context,
      session: context.session,
      listKey,
      operation,
    },
    phase,
  )
  const validated = validateFilter(value, phase)
  if (validated && typeof validated === 'object')
    return coerceAndValidateFilterValueShape(listKey, validated, context, phase)
  return validated
}

export async function getItemAccess(
  listKey: string,
  operation: ItemAccessOperation,
  context: CmsContext,
  item?: CmsItem | null,
  inputData?: Record<string, unknown>,
): Promise<boolean> {
  if (isSudoContext(context)) return true
  const list = getList(listKey, context)
  const configuredAccess = list.access?.item?.[operation]
  if (configuredAccess === undefined) return true
  const phase = `${listKey}.access.item.${operation}`
  const value = await evaluateAccessValue(
    configuredAccess,
    {
      context,
      session: context.session,
      listKey,
      operation,
      item: item ?? null,
      inputData: inputData ?? {},
    },
    phase,
  )
  return validateBoolean(value, phase)
}

export async function assertItemAccess(
  listKey: string,
  operation: ItemAccessOperation,
  context: CmsContext,
  item?: CmsItem | null,
  inputData?: Record<string, unknown>,
): Promise<void> {
  const allowed = await getItemAccess(
    listKey,
    operation,
    context,
    item,
    inputData,
  )
  if (!allowed)
    throw accessDenied(`Access denied: ${operation} ${listKey}`, {
      listKey,
      operation,
    })
}

export async function getFieldAccess(
  listKey: string,
  fieldPath: string,
  operation: FieldAccessOperation,
  context: CmsContext,
  item?: CmsItem | null,
  inputData?: Record<string, unknown>,
): Promise<boolean> {
  if (isSudoContext(context)) return true
  const list = getList(listKey, context)
  const field = getField(list, fieldPath)
  const configuredAccess = field.access?.[operation]
  if (configuredAccess === undefined) return true
  const phase = `${listKey}.${fieldPath}.access.${operation}`
  const value = await evaluateAccessValue(
    configuredAccess,
    {
      context,
      session: context.session,
      listKey,
      fieldKey: fieldPath,
      field,
      operation,
      item: item ?? null,
      inputData: inputData ?? {},
    },
    phase,
  )
  return validateBoolean(value, phase)
}

export async function assertFieldAccess(
  listKey: string,
  fieldPath: string,
  operation: FieldAccessOperation,
  context: CmsContext,
  item?: CmsItem | null,
  inputData?: Record<string, unknown>,
): Promise<void> {
  const allowed = await getFieldAccess(
    listKey,
    fieldPath,
    operation,
    context,
    item,
    inputData,
  )
  if (!allowed)
    throw accessDenied(`Access denied: ${operation} ${listKey}.${fieldPath}`, {
      listKey,
      fieldPath,
      operation,
    })
}

export async function assertFieldWriteAccess(
  listKey: string,
  fieldPath: string,
  operation: Extract<FieldAccessOperation, 'create' | 'update'>,
  context: CmsContext,
  item?: CmsItem | null,
  inputData?: Record<string, unknown>,
): Promise<void> {
  await assertFieldAccess(
    listKey,
    fieldPath,
    operation,
    context,
    item,
    inputData,
  )
}

export async function canReadField(
  listKey: string,
  fieldPath: string,
  context: CmsContext,
  item?: CmsItem | null,
): Promise<boolean> {
  return getFieldAccess(listKey, fieldPath, 'read', context, item)
}

async function evaluateFieldBooleanAccessControl(args: {
  control:
    | CmsFieldFilterabilityControl
    | CmsFieldOrderabilityControl
    | undefined
  fallback: boolean | CmsFieldFilterabilityControl | CmsFieldOrderabilityControl
  phase: string
  listKey: string
  fieldPath: string
  field: CmsField
  operation: AccessFilterOperation
  context: CmsContext
}) {
  const {
    control,
    fallback,
    phase,
    listKey,
    fieldPath,
    field,
    operation,
    context,
  } = args
  const rawControl = control ?? fallback
  const raw =
    typeof rawControl === 'function'
      ? await evaluateAccessValue(
          rawControl,
          {
            context,
            session: context.session,
            listKey,
            fieldKey: fieldPath,
            field,
            operation,
          },
          phase,
        )
      : rawControl
  return validateBoolean(raw, phase)
}

async function assertFieldFilterability(
  list: CmsList,
  field: CmsField,
  operation: AccessFilterOperation,
  context: CmsContext,
) {
  const filterEnabled = field.graphql?.isEnabled?.filter
  const allowed = await evaluateFieldBooleanAccessControl({
    control: filterEnabled === false ? false : field.isFilterable,
    fallback: filterEnabled ?? true,
    phase: `${list.key}.${field.path}.isFilterable`,
    listKey: list.key,
    fieldPath: field.path,
    field,
    operation,
    context,
  })
  if (!allowed)
    throw filterDenied(
      { operation: 'filter', fieldKeys: [`${list.key}.${field.path}`] },
      { listKey: list.key, fieldPath: field.path, operation },
    )
}

async function assertFieldOrderability(
  list: CmsList,
  field: CmsField,
  operation: AccessFilterOperation,
  context: CmsContext,
) {
  const orderEnabled = field.graphql?.isEnabled?.orderBy
  const allowed = await evaluateFieldBooleanAccessControl({
    control: orderEnabled === false ? false : field.isOrderable,
    fallback: orderEnabled ?? true,
    phase: `${list.key}.${field.path}.isOrderable`,
    listKey: list.key,
    fieldPath: field.path,
    field,
    operation,
    context,
  })
  if (!allowed)
    throw filterDenied(
      { operation: 'orderBy', fieldKeys: [`${list.key}.${field.path}`] },
      { listKey: list.key, fieldPath: field.path, operation },
    )
}

export async function assertFilterAccess(
  listKey: string,
  operation: AccessFilterOperation,
  context: CmsContext,
  filterValue: unknown,
): Promise<void> {
  if (isSudoContext(context) || filterValue == null) return
  const list = getList(listKey, context)
  const filterRecord = asRecord(filterValue)

  for (const [fieldPath, nested] of Object.entries(filterRecord)) {
    if (['AND', 'OR', 'NOT'].includes(fieldPath)) {
      const entries = Array.isArray(nested) ? nested : [nested]
      for (const entry of entries)
        await assertFilterAccess(listKey, operation, context, entry)
      continue
    }
    const field = getField(list, fieldPath)
    await assertFieldFilterability(list, field, operation, context)
    if (isRecord(nested) && field.kind === 'relationship' && field.ref) {
      const refListKey = field.ref.split('.').at(0)
      if (refListKey) {
        for (const [operator, value] of Object.entries(nested)) {
          if (['some', 'none', 'every'].includes(operator))
            await assertFilterAccess(refListKey, operation, context, value)
        }
      }
    }
  }
}

export async function assertOrderByAccess(
  listKey: string,
  operation: AccessFilterOperation,
  context: CmsContext,
  orderBy: unknown,
): Promise<void> {
  if (isSudoContext(context) || orderBy == null) return
  const list = getList(listKey, context)
  const entries = Array.isArray(orderBy) ? orderBy : [orderBy]
  for (const entry of entries) {
    const record = asRecord(entry)
    for (const fieldPath of Object.keys(record)) {
      const field = getField(list, fieldPath)
      await assertFieldOrderability(list, field, operation, context)
    }
  }
}

export async function assertCursorAccess(
  listKey: string,
  operation: AccessFilterOperation,
  context: CmsContext,
  cursor: unknown,
): Promise<void> {
  if (isSudoContext(context) || cursor == null) return
  await assertFilterAccess(listKey, operation, context, cursor)
}

export async function assertRelatedItemsExistAndAccessible(args: {
  listKey: string
  ids: string[]
  context: CmsContext
  operation: 'connect' | 'set' | 'disconnect'
}): Promise<void> {
  const ids = Array.from(new Set(args.ids.filter(Boolean)))
  if (ids.length === 0) return
  await assertOperationAccess(args.listKey, 'query', args.context)
  for (const id of ids) {
    const item = await args.context.adapter.findUnique(
      args.listKey,
      { id },
      args.context,
    )
    if (!item)
      throw accessDenied(
        `Cannot ${args.operation} ${args.listKey} ${id}: item does not exist or is not accessible`,
        { listKey: args.listKey, operation: args.operation, itemId: id },
      )
  }
}

export async function findRelatedItemsByWhereUnique(args: {
  listKey: string
  where: unknown
  context: CmsContext
  operation: 'connect' | 'set' | 'disconnect' | 'find'
}): Promise<CmsItem[]> {
  const whereItems = Array.isArray(args.where)
    ? args.where
    : args.where
      ? [args.where]
      : []
  if (whereItems.length === 0) return []
  await assertOperationAccess(args.listKey, 'query', args.context)

  const list = getList(args.listKey, args.context)
  const items: CmsItem[] = []
  const failures: Array<{ error: Error; tag: string }> = []

  for (const where of whereItems) {
    const uniqueWhere = asRecord(where)
    resolveWhereUnique(list, uniqueWhere)
    const item = await args.context.adapter.findUnique(
      args.listKey,
      uniqueWhere,
      args.context,
    )
    if (!item) {
      const label =
        typeof uniqueWhere.id === 'string'
          ? ` ${uniqueWhere.id}`
          : Object.keys(uniqueWhere).length > 0
            ? ` ${JSON.stringify(uniqueWhere)}`
            : ''
      failures.push({
        tag: `${args.listKey}.relationship.${args.operation}`,
        error: new Error(
          `Cannot ${args.operation} ${args.listKey}${label}: item does not exist or is not accessible`,
        ),
      })
      continue
    }
    items.push(item)
  }

  if (failures.length > 0) {
    throw relationshipFailure(failures, {
      listKey: args.listKey,
      operation: args.operation,
      errorCount: failures.length,
    })
  }

  return items
}

export function unreadableFieldValue(field: CmsField): null | unknown[] {
  return field.many || field.kind === 'multiselect' ? [] : null
}
