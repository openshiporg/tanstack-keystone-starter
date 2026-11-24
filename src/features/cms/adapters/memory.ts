import {
  assertFieldWriteAccess,
  assertItemAccess,
  assertOperationAccess,
  assertRelatedItemsExistAndAccessible,
  findRelatedItemsByWhereUnique,
  getAccessFilter,
} from '../access'
import { accessDenied, relationshipFailure, validationFailure } from '../errors'
import {
  cleanupDeletedItemFiles,
  cleanupReplacedFiles,
} from '../file-lifecycle'
import { hashPasswordSync } from '../auth/password'
import {
  flushDeferredAfterOperationHooks,
  resolveInputForMutation,
  runAfterDeleteOperationHooks,
  runBeforeDeleteOperationHooks,
  runBeforeOperationHooks,
  runOrDeferAfterOperationHooks,
  validateDelete,
  validateResolvedInput,
} from '../hooks'
import { CmsMutationState, withMutationState } from '../mutation-state'
import { cmsLists } from '../registry'
import type { CmsField, CmsList } from '../types'
import cmsConfig from '../../../../cms.config'
import { resolveWhereUnique } from '../where-unique'
import type { CmsAdapter, CmsContext, CmsItem, CmsMemorySeed } from './types'

type Store = CmsMemorySeed

type RelationRef = {
  listKey: string
  fieldPath: string
}

let runtimeLists = cmsLists
let listByKey = Object.fromEntries(runtimeLists.map((list) => [list.key, list]))

function hashPasswordSyncWithField(field: CmsField, secret: string) {
  if (!field.password?.kdf) return hashPasswordSync(secret, field)
  throw new Error(
    `Custom async-only password KDF is not supported in memory sync writes for ${field.path}`,
  )
}

function buildFreshStore(lists: CmsList[] = runtimeLists): Store {
  return Object.fromEntries(lists.map((list) => [list.key, []]))
}

function resolveBootstrapStore(lists: CmsList[] = runtimeLists): Store {
  const mode = process.env.CMS_BOOTSTRAP_MODE?.toLowerCase()
  console.info(`[cms][memory] bootstrap mode=${mode || 'seeded(default)'}`)
  if (mode === 'fresh') return buildFreshStore(lists)
  const configuredSeed = cmsConfig.memory?.seed
  return Object.fromEntries(
    lists.map((list) => [list.key, configuredSeed?.[list.key] ?? []]),
  )
}

let store: Store = cloneStore(resolveBootstrapStore(runtimeLists))
let idCounters = getInitialCounters(store)
let transactionQueue = Promise.resolve()

function cloneValue<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  return JSON.parse(JSON.stringify(value)) as T
}

function cloneStore(source: Store): Store {
  return Object.fromEntries(
    Object.entries(source).map(([listKey, items]) => [
      listKey,
      items.map((item) => cloneValue(item)),
    ]),
  )
}

function getInitialCounters(source: Store) {
  return Object.fromEntries(
    Object.entries(source).map(([listKey, items]) => [
      listKey,
      items.length + 1,
    ]),
  )
}

function cloneCounters(source: Record<string, number>) {
  return { ...source }
}

export function resetMemoryAdapter(seed?: Store, lists: CmsList[] = cmsLists) {
  runtimeLists = lists
  listByKey = Object.fromEntries(runtimeLists.map((list) => [list.key, list]))
  const source = seed ?? resolveBootstrapStore(runtimeLists)
  store = cloneStore(source)
  idCounters = getInitialCounters(store)
  transactionQueue = Promise.resolve()
}

export function getMemoryStoreSnapshot() {
  return cloneStore(store)
}

function parseRelationRef(ref: string): RelationRef {
  const [listKey, fieldPath] = ref.split('.')
  if (!listKey) {
    throw new Error(`Invalid relationship ref ${ref}`)
  }
  return { listKey, fieldPath }
}

function getField(list: CmsList, fieldPath: string) {
  return list.fields.find((field) => field.path === fieldPath)
}

function requireField(list: CmsList, fieldPath: string) {
  const field = getField(list, fieldPath)
  if (!field) throw new Error(`Unknown field ${list.key}.${fieldPath}`)
  return field
}

function getItems(listKey: string) {
  store[listKey] ??= []
  return store[listKey]
}

function getItem(listKey: string, id: string) {
  return getItems(listKey).find((item) => item.id === id) ?? null
}

function nextId(listKey: string) {
  const next = idCounters[listKey] ?? 1
  idCounters[listKey] = next + 1
  return `${listKey.toLowerCase()}_${next}`
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function uniqueIds(values: string[]) {
  return Array.from(new Set(values))
}

function uniqueLabel(value: unknown) {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? ` ${String(value)}`
    : ''
}

function comparableUniqueValue(field: CmsField, value: unknown): unknown {
  if (field.kind !== 'relationship' || !field.ref) return value
  const relatedListKey = field.ref.split('.')[0]
  if (!relatedListKey || !listByKey[relatedListKey]) return undefined
  return getItemByWhereUnique(relatedListKey, value)?.id
}

function getItemByWhereUnique(listKey: string, where: unknown): CmsItem | null {
  const unique = resolveWhereUnique(listByKey[listKey], where)
  const comparable = comparableUniqueValue(unique.field, unique.value)
  return (
    getItems(listKey).find((item) => item[unique.fieldPath] === comparable) ??
    null
  )
}

function requireItemByWhereUnique(
  listKey: string,
  where: unknown,
  operation: 'connect' | 'set' | 'disconnect',
) {
  const unique = resolveWhereUnique(listByKey[listKey], where)
  const comparable = comparableUniqueValue(unique.field, unique.value)
  const item =
    getItems(listKey).find((entry) => entry[unique.fieldPath] === comparable) ??
    null
  if (!item)
    throw accessDenied(
      `Cannot ${operation} ${listKey}${uniqueLabel(unique.value)}: item does not exist or is not accessible`,
      { listKey, operation },
    )
  return item
}

function normalizeOrderBy(orderBy: unknown) {
  if (!orderBy) return []
  return Array.isArray(orderBy) ? orderBy.map(asRecord) : [asRecord(orderBy)]
}

function compareValues(a: unknown, b: unknown) {
  if (a === b) return 0
  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1
  return String(a).localeCompare(String(b), undefined, { numeric: true })
}

function applyOrderBy(items: CmsItem[], orderBy: unknown) {
  const orderings = normalizeOrderBy(orderBy)
  if (orderings.length === 0) return items
  return [...items].sort((left, right) => {
    for (const ordering of orderings) {
      const [fieldPath, direction] = Object.entries(ordering)[0] ?? []
      if (!fieldPath || !direction) continue
      const comparison = compareValues(left[fieldPath], right[fieldPath])
      if (comparison !== 0)
        return direction === 'desc' ? -comparison : comparison
    }
    return 0
  })
}

function applyPagination(
  items: CmsItem[],
  args: Record<string, unknown>,
  listKey: string,
) {
  let result = items
  const cursor = asRecord(args.cursor)
  if (cursor.id) {
    const index = result.findIndex((item) => item.id === cursor.id)
    // Prisma's cursor is part of the filtered query. An inaccessible or
    // otherwise missing cursor therefore yields no rows rather than silently
    // restarting pagination at the beginning.
    result = index >= 0 ? result.slice(index) : []
  }
  const skip = typeof args.skip === 'number' ? args.skip : 0
  if (skip > 0) result = result.slice(skip)
  const take = typeof args.take === 'number' ? args.take : undefined
  if (take !== undefined) {
    if (take < 0)
      throw validationFailure(`${listKey} take must be zero or greater`, {
        listKey,
        fieldPath: 'take',
      })
    const maxTake = listByKey[listKey].graphql?.maxTake
    if (typeof maxTake === 'number' && take > maxTake)
      throw validationFailure(`${listKey} take must be ${maxTake} or less`, {
        listKey,
        fieldPath: 'take',
        maxTake,
      })
    result = result.slice(0, take)
  }
  return result
}

function stringModeValue(value: string, mode: unknown): string
function stringModeValue(value: null, mode: unknown): null
function stringModeValue(value: string | null, mode: unknown): string | null
function stringModeValue(value: string | null, mode: unknown) {
  if (value === null) return null
  return mode === 'insensitive' ? value.toLocaleLowerCase() : value
}

function matchesStringFilter(value: unknown, filter: Record<string, unknown>) {
  const stringValue =
    value === null || value === undefined ? null : String(value)
  const mode = filter.mode
  const comparableValue = stringModeValue(stringValue, mode)
  const equalsValue =
    typeof filter.equals === 'string'
      ? stringModeValue(filter.equals, mode)
      : filter.equals
  const containsValue =
    typeof filter.contains === 'string'
      ? stringModeValue(filter.contains, mode)
      : undefined
  const startsWithValue =
    typeof filter.startsWith === 'string'
      ? stringModeValue(filter.startsWith, mode)
      : undefined
  const endsWithValue =
    typeof filter.endsWith === 'string'
      ? stringModeValue(filter.endsWith, mode)
      : undefined
  const inValues = Array.isArray(filter.in)
    ? filter.in.map((entry) =>
        typeof entry === 'string' ? stringModeValue(entry, mode) : entry,
      )
    : undefined
  const notInValues = Array.isArray(filter.notIn)
    ? filter.notIn.map((entry) =>
        typeof entry === 'string' ? stringModeValue(entry, mode) : entry,
      )
    : undefined

  if ('equals' in filter && comparableValue !== equalsValue) return false
  if (Array.isArray(inValues) && !inValues.includes(comparableValue))
    return false
  if (Array.isArray(notInValues) && notInValues.includes(comparableValue))
    return false
  if (
    typeof filter.lt === 'string' &&
    (comparableValue === null ||
      !(comparableValue < stringModeValue(filter.lt, mode)))
  )
    return false
  if (
    typeof filter.lte === 'string' &&
    (comparableValue === null ||
      !(comparableValue <= stringModeValue(filter.lte, mode)))
  )
    return false
  if (
    typeof filter.gt === 'string' &&
    (comparableValue === null ||
      !(comparableValue > stringModeValue(filter.gt, mode)))
  )
    return false
  if (
    typeof filter.gte === 'string' &&
    (comparableValue === null ||
      !(comparableValue >= stringModeValue(filter.gte, mode)))
  )
    return false
  // SQLite-backed Keystone uses LIKE for these operators, whose default ASCII
  // behavior is case-insensitive. The memory adapter mirrors that observable
  // contract while retaining exact case-sensitive equality/in comparisons.
  const patternValue = comparableValue?.toLocaleLowerCase() ?? null
  if (
    typeof containsValue === 'string' &&
    (patternValue === null ||
      !patternValue.includes(containsValue.toLocaleLowerCase()))
  )
    return false
  if (
    typeof startsWithValue === 'string' &&
    (patternValue === null ||
      !patternValue.startsWith(startsWithValue.toLocaleLowerCase()))
  )
    return false
  if (
    typeof endsWithValue === 'string' &&
    (patternValue === null ||
      !patternValue.endsWith(endsWithValue.toLocaleLowerCase()))
  )
    return false
  if (filter.not && matchesStringFilter(value, asRecord(filter.not)))
    return false
  return true
}

function matchesBooleanFilter(value: unknown, filter: Record<string, unknown>) {
  if ('equals' in filter && value !== filter.equals) return false
  if (filter.not && matchesBooleanFilter(value, asRecord(filter.not)))
    return false
  return true
}

function matchesPasswordFilter(
  value: unknown,
  filter: Record<string, unknown>,
) {
  if (typeof filter.isSet === 'boolean')
    return (typeof value === 'string' && value.length > 0) === filter.isSet
  return true
}

function matchesNumberFilter(value: unknown, filter: Record<string, unknown>) {
  const numberValue = typeof value === 'number' ? value : Number(value)
  if ('equals' in filter && numberValue !== filter.equals) return false
  if (Array.isArray(filter.in) && !filter.in.includes(numberValue)) return false
  if (Array.isArray(filter.notIn) && filter.notIn.includes(numberValue))
    return false
  if (typeof filter.lt === 'number' && !(numberValue < filter.lt)) return false
  if (typeof filter.lte === 'number' && !(numberValue <= filter.lte))
    return false
  if (typeof filter.gt === 'number' && !(numberValue > filter.gt)) return false
  if (typeof filter.gte === 'number' && !(numberValue >= filter.gte))
    return false
  if (filter.not && matchesNumberFilter(value, asRecord(filter.not)))
    return false
  return true
}

function decimalFromUnknown(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

function matchesDecimalFilter(value: unknown, filter: Record<string, unknown>) {
  const decimalValue = decimalFromUnknown(value)
  if ('equals' in filter && decimalValue !== decimalFromUnknown(filter.equals))
    return false
  if (
    Array.isArray(filter.in) &&
    !filter.in.some((entry) => decimalValue === decimalFromUnknown(entry))
  )
    return false
  if (
    Array.isArray(filter.notIn) &&
    filter.notIn.some((entry) => decimalValue === decimalFromUnknown(entry))
  )
    return false
  const lt = decimalFromUnknown(filter.lt)
  const lte = decimalFromUnknown(filter.lte)
  const gt = decimalFromUnknown(filter.gt)
  const gte = decimalFromUnknown(filter.gte)
  if (lt !== null && (decimalValue === null || !(decimalValue < lt)))
    return false
  if (lte !== null && (decimalValue === null || !(decimalValue <= lte)))
    return false
  if (gt !== null && (decimalValue === null || !(decimalValue > gt)))
    return false
  if (gte !== null && (decimalValue === null || !(decimalValue >= gte)))
    return false
  if (filter.not && matchesDecimalFilter(value, asRecord(filter.not)))
    return false
  return true
}

function dateTimeFromUnknown(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

function matchesDateTimeFilter(
  value: unknown,
  filter: Record<string, unknown>,
) {
  const dateTimeValue = dateTimeFromUnknown(value)
  if (
    'equals' in filter &&
    dateTimeValue !== dateTimeFromUnknown(filter.equals)
  )
    return false
  if (
    Array.isArray(filter.in) &&
    !filter.in.some((entry) => dateTimeValue === dateTimeFromUnknown(entry))
  )
    return false
  if (
    Array.isArray(filter.notIn) &&
    filter.notIn.some((entry) => dateTimeValue === dateTimeFromUnknown(entry))
  )
    return false
  const lt = dateTimeFromUnknown(filter.lt)
  const lte = dateTimeFromUnknown(filter.lte)
  const gt = dateTimeFromUnknown(filter.gt)
  const gte = dateTimeFromUnknown(filter.gte)
  if (lt !== null && (dateTimeValue === null || !(dateTimeValue < lt)))
    return false
  if (lte !== null && (dateTimeValue === null || !(dateTimeValue <= lte)))
    return false
  if (gt !== null && (dateTimeValue === null || !(dateTimeValue > gt)))
    return false
  if (gte !== null && (dateTimeValue === null || !(dateTimeValue >= gte)))
    return false
  if (filter.not && matchesDateTimeFilter(value, asRecord(filter.not)))
    return false
  return true
}

function bigIntFromUnknown(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  try {
    return BigInt(String(value))
  } catch {
    return null
  }
}

function matchesBigIntFilter(value: unknown, filter: Record<string, unknown>) {
  const bigIntValue = bigIntFromUnknown(value)
  if ('equals' in filter && bigIntValue !== bigIntFromUnknown(filter.equals))
    return false
  if (
    Array.isArray(filter.in) &&
    !filter.in.some((entry) => bigIntValue === bigIntFromUnknown(entry))
  )
    return false
  if (
    Array.isArray(filter.notIn) &&
    filter.notIn.some((entry) => bigIntValue === bigIntFromUnknown(entry))
  )
    return false
  const lt = bigIntFromUnknown(filter.lt)
  const lte = bigIntFromUnknown(filter.lte)
  const gt = bigIntFromUnknown(filter.gt)
  const gte = bigIntFromUnknown(filter.gte)
  if (lt !== null && (bigIntValue === null || !(bigIntValue < lt))) return false
  if (lte !== null && (bigIntValue === null || !(bigIntValue <= lte)))
    return false
  if (gt !== null && (bigIntValue === null || !(bigIntValue > gt))) return false
  if (gte !== null && (bigIntValue === null || !(bigIntValue >= gte)))
    return false
  if (filter.not && matchesBigIntFilter(value, asRecord(filter.not)))
    return false
  return true
}

function matchesNumberListFilter(
  value: unknown,
  filter: Record<string, unknown>,
) {
  const values = Array.isArray(value) ? value.map((entry) => Number(entry)) : []
  const equalsValues = Array.isArray(filter.equals)
    ? filter.equals.map((entry) => Number(entry))
    : undefined
  const hasValue = typeof filter.has === 'number' ? filter.has : undefined
  const hasSomeValues = Array.isArray(filter.hasSome)
    ? filter.hasSome.map((entry) => Number(entry))
    : undefined
  const hasEveryValues = Array.isArray(filter.hasEvery)
    ? filter.hasEvery.map((entry) => Number(entry))
    : undefined
  if (
    Array.isArray(equalsValues) &&
    JSON.stringify(values) !== JSON.stringify(equalsValues)
  )
    return false
  if (typeof hasValue === 'number' && !values.includes(hasValue)) return false
  if (
    Array.isArray(hasSomeValues) &&
    !hasSomeValues.some((entry) => values.includes(entry))
  )
    return false
  if (
    Array.isArray(hasEveryValues) &&
    !hasEveryValues.every((entry) => values.includes(entry))
  )
    return false
  if (
    typeof filter.isEmpty === 'boolean' &&
    (values.length === 0) !== filter.isEmpty
  )
    return false
  return true
}

function matchesStringListFilter(
  value: unknown,
  filter: Record<string, unknown>,
) {
  const values = Array.isArray(value) ? value.map(String) : []
  if (
    Array.isArray(filter.equals) &&
    JSON.stringify(values) !== JSON.stringify(filter.equals)
  )
    return false
  if (typeof filter.has === 'string' && !values.includes(filter.has))
    return false
  if (
    Array.isArray(filter.hasSome) &&
    !filter.hasSome.some((entry) => values.includes(String(entry)))
  )
    return false
  if (
    Array.isArray(filter.hasEvery) &&
    !filter.hasEvery.every((entry) => values.includes(String(entry)))
  )
    return false
  if (
    typeof filter.isEmpty === 'boolean' &&
    (values.length === 0) !== filter.isEmpty
  )
    return false
  return true
}

function isRelatedTo(item: CmsItem, fieldPath: string, id: string) {
  const value = item[fieldPath]
  if (Array.isArray(value)) return value.includes(id)
  return value === id
}

function resolveRelationshipItems(item: CmsItem, field: CmsField) {
  if (!field.ref) return []
  const ref = parseRelationRef(field.ref)
  const explicitValue = item[field.path]
  if (field.many) {
    if (Array.isArray(explicitValue)) {
      return explicitValue
        .map((id) => getItem(ref.listKey, String(id)))
        .filter((related): related is CmsItem => Boolean(related))
    }
    return getItems(ref.listKey).filter((related) =>
      isRelatedTo(related, ref.fieldPath, item.id),
    )
  }
  if (typeof explicitValue === 'string') {
    const related = getItem(ref.listKey, explicitValue)
    return related ? [related] : []
  }
  return getItems(ref.listKey)
    .filter((related) => isRelatedTo(related, ref.fieldPath, item.id))
    .slice(0, 1)
}

function matchesRelationshipFilter(
  _listKey: string,
  item: CmsItem,
  field: CmsField,
  filter: unknown,
) {
  if (!field.ref) return true
  if (filter === null) return resolveRelationshipItems(item, field).length === 0
  const filterRecord = asRecord(filter)
  const relatedItems = resolveRelationshipItems(item, field)
  if (field.many) {
    const relatedListKey = parseRelationRef(field.ref).listKey
    if (filterRecord.some)
      return relatedItems.some((related) =>
        matchesWhere(relatedListKey, related, filterRecord.some),
      )
    if (filterRecord.none)
      return !relatedItems.some((related) =>
        matchesWhere(relatedListKey, related, filterRecord.none),
      )
    if (filterRecord.every)
      return relatedItems.every((related) =>
        matchesWhere(relatedListKey, related, filterRecord.every),
      )
    return true
  }
  const related = relatedItems.at(0)
  if (!related) return false
  return matchesWhere(
    parseRelationRef(field.ref).listKey,
    related,
    filterRecord,
  )
}

function matchesFieldFilter(
  listKey: string,
  item: CmsItem,
  field: CmsField,
  filter: unknown,
) {
  if (field.kind === 'relationship')
    return matchesRelationshipFilter(listKey, item, field, filter)
  const filterRecord = asRecord(filter)
  if (field.kind === 'id') return matchesStringFilter(item.id, filterRecord)
  if (field.kind === 'select' && field.fieldMeta?.type === 'integer')
    return matchesNumberFilter(item[field.path], filterRecord)
  if (field.kind === 'multiselect' && field.fieldMeta?.type === 'integer')
    return matchesNumberListFilter(item[field.path], filterRecord)
  if (['text', 'select'].includes(field.kind))
    return matchesStringFilter(item[field.path], filterRecord)
  if (field.kind === 'timestamp' || field.kind === 'calendarDay')
    return matchesDateTimeFilter(item[field.path], filterRecord)
  if (field.kind === 'decimal')
    return matchesDecimalFilter(item[field.path], filterRecord)
  if (field.kind === 'bigInt')
    return matchesBigIntFilter(item[field.path], filterRecord)
  if (field.kind === 'checkbox')
    return matchesBooleanFilter(item[field.path], filterRecord)
  if (field.kind === 'password')
    return matchesPasswordFilter(item[field.path], filterRecord)
  if (field.kind === 'integer' || field.kind === 'float')
    return matchesNumberFilter(item[field.path], filterRecord)
  if (field.kind === 'multiselect')
    return matchesStringListFilter(item[field.path], filterRecord)
  return true
}

function matchesWhere(listKey: string, item: CmsItem, where: unknown): boolean {
  const list = listByKey[listKey]
  const filter = asRecord(where)
  if (Object.keys(filter).length === 0) return true

  if (
    Array.isArray(filter.AND) &&
    !filter.AND.every((entry) => matchesWhere(listKey, item, entry))
  )
    return false
  if (
    Array.isArray(filter.OR) &&
    !filter.OR.some((entry) => matchesWhere(listKey, item, entry))
  )
    return false
  if (
    Array.isArray(filter.NOT) &&
    filter.NOT.some((entry) => matchesWhere(listKey, item, entry))
  )
    return false

  for (const [fieldPath, fieldFilter] of Object.entries(filter)) {
    if (['AND', 'OR', 'NOT'].includes(fieldPath)) continue
    const field = getField(list, fieldPath)
    if (!field) continue
    if (!matchesFieldFilter(listKey, item, field, fieldFilter)) return false
  }
  return true
}

async function applyAccessFilter(
  items: CmsItem[],
  operation: 'query' | 'update' | 'delete',
  listKey: string,
  context: CmsContext,
) {
  const filter = await getAccessFilter(listKey, operation, context)
  if (filter === true) return items
  if (filter === false) return []
  return items.filter((item) => matchesWhere(listKey, item, filter))
}

async function assertUpdateDeleteAccess(
  item: CmsItem,
  operation: 'update' | 'delete',
  listKey: string,
  context: CmsContext,
) {
  const filtered = await applyAccessFilter([item], operation, listKey, context)
  if (filtered.length === 0)
    throw accessDenied(`Access denied: ${operation} ${listKey}`, {
      listKey,
      operation,
    })
  await assertItemAccess(listKey, operation, context, item)
}

function coerceScalarValue(field: CmsField, value: unknown) {
  if (value === null || value === undefined) return value
  if (field.kind === 'checkbox') return Boolean(value)
  if (field.kind === 'select' && field.fieldMeta?.type === 'integer')
    return Number.parseInt(String(value), 10)
  if (field.kind === 'multiselect' && field.fieldMeta?.type === 'integer')
    return Array.isArray(value)
      ? value.map((entry) => Number.parseInt(String(entry), 10))
      : []
  if (field.kind === 'integer') return Number.parseInt(String(value), 10)
  if (field.kind === 'float') return Number(value)
  if (
    [
      'decimal',
      'bigInt',
      'timestamp',
      'calendarDay',
      'select',
      'text',
      'password',
    ].includes(field.kind)
  )
    return String(value)
  if (field.kind === 'multiselect' && field.fieldMeta?.type === 'integer')
    return Array.isArray(value)
      ? value.map((entry) => Number.parseInt(String(entry), 10))
      : []
  if (field.kind === 'multiselect')
    return Array.isArray(value) ? value.map(String) : []
  return value
}

function defaultValueForField(field: CmsField) {
  if ('defaultValue' in field)
    return Array.isArray(field.defaultValue)
      ? [...field.defaultValue]
      : cloneValue(field.defaultValue)
  if (field.kind === 'password') return null
  if (field.kind === 'checkbox') return false
  if (field.kind === 'multiselect') return []
  return null
}

function validateFieldValue(
  listKey: string,
  field: CmsField,
  value: unknown,
  operation: 'create' | 'update',
) {
  if (
    field.kind === 'text' &&
    field.validation?.isRequired &&
    operation === 'create' &&
    (!value || String(value).length === 0)
  ) {
    throw validationFailure(`${listKey}.${field.path} is required`, {
      listKey,
      fieldPath: field.path,
    })
  }
  if (
    field.kind === 'password' &&
    field.validation?.isRequired &&
    operation === 'create' &&
    (value === null || value === undefined || value === '')
  ) {
    throw validationFailure(`${listKey}.${field.path} is required`, {
      listKey,
      fieldPath: field.path,
    })
  }
  if (field.kind === 'integer' && value !== null && value !== undefined) {
    const numberValue = Number(value)
    if (
      typeof field.validation?.min === 'number' &&
      numberValue < field.validation.min
    )
      throw validationFailure(
        `${listKey}.${field.path} must be at least ${field.validation.min}`,
        { listKey, fieldPath: field.path, min: field.validation.min },
      )
    if (
      typeof field.validation?.max === 'number' &&
      numberValue > field.validation.max
    )
      throw validationFailure(
        `${listKey}.${field.path} must be at most ${field.validation.max}`,
        { listKey, fieldPath: field.path, max: field.validation.max },
      )
  }
  if (
    field.kind === 'select' &&
    value !== null &&
    value !== undefined &&
    field.options &&
    !field.options.some((option) => option.value === value)
  ) {
    throw validationFailure(
      `${listKey}.${field.path} must be one of: ${field.options.map((option) => option.value).join(', ')}`,
      { listKey, fieldPath: field.path },
    )
  }
  if (field.kind === 'multiselect' && Array.isArray(value) && field.options) {
    const allowed = new Set(field.options.map((option) => option.value))
    const normalizedEntries =
      field.fieldMeta?.type === 'integer'
        ? value.map((entry) => Number.parseInt(String(entry), 10))
        : value.map((entry) => String(entry))
    const invalid = normalizedEntries.filter((entry) => !allowed.has(entry))
    if (invalid.length > 0)
      throw validationFailure(
        `${listKey}.${field.path} includes invalid options: ${invalid.join(', ')}`,
        { listKey, fieldPath: field.path, invalid },
      )
    const duplicateEntries = normalizedEntries.filter(
      (entry, index, values) =>
        values.findIndex((candidate) => candidate === entry) !== index,
    )
    if (duplicateEntries.length > 0)
      throw validationFailure(
        `${listKey}.${field.path} includes duplicate values: ${duplicateEntries.join(', ')}`,
        { listKey, fieldPath: field.path, invalid: duplicateEntries },
      )
  }
}

function assertUniqueConstraints(
  listKey: string,
  item: CmsItem,
  previousId?: string,
) {
  const list = listByKey[listKey]
  for (const field of list.fields) {
    if (field.db?.isUnique !== true) continue
    const value = item[field.path]
    if (value === null || value === undefined) continue
    const duplicate = getItems(listKey).find(
      (entry) => entry.id !== previousId && entry[field.path] === value,
    )
    if (duplicate)
      throw validationFailure(`${listKey}.${field.path} must be unique`, {
        listKey,
        fieldPath: field.path,
      })
  }
}

function syncInverseRelationship(
  listKey: string,
  item: CmsItem,
  field: CmsField,
  previousIds: string[],
  nextIds: string[],
) {
  if (!field.ref) return
  const ref = parseRelationRef(field.ref)
  const foreignList = listByKey[ref.listKey]
  const foreignField = getField(foreignList, ref.fieldPath)
  if (!foreignField) return

  const removedIds = previousIds.filter((id) => !nextIds.includes(id))
  const addedIds = nextIds.filter((id) => !previousIds.includes(id))

  for (const removedId of removedIds) {
    const foreignItem = getItem(ref.listKey, removedId)
    if (!foreignItem) continue
    if (foreignField.many) {
      foreignItem[foreignField.path] = Array.isArray(
        foreignItem[foreignField.path],
      )
        ? (foreignItem[foreignField.path] as unknown[]).filter(
            (id) => id !== item.id,
          )
        : []
    } else if (foreignItem[foreignField.path] === item.id) {
      foreignItem[foreignField.path] = null
    }
  }

  for (const addedId of addedIds) {
    const foreignItem = getItem(ref.listKey, addedId)
    if (!foreignItem)
      throw accessDenied(
        `Cannot connect ${listKey}.${field.path} to missing ${ref.listKey} ${addedId}`,
        {
          listKey,
          fieldPath: field.path,
          refListKey: ref.listKey,
          itemId: addedId,
        },
      )
    if (foreignField.many) {
      const current = Array.isArray(foreignItem[foreignField.path])
        ? (foreignItem[foreignField.path] as unknown[]).map(String)
        : []
      foreignItem[foreignField.path] = uniqueIds([...current, item.id])
    } else {
      const previousOwnerId =
        typeof foreignItem[foreignField.path] === 'string'
          ? String(foreignItem[foreignField.path])
          : null
      if (previousOwnerId && previousOwnerId !== item.id) {
        const previousOwner = getItem(listKey, previousOwnerId)
        if (previousOwner) {
          if (field.many) {
            previousOwner[field.path] = Array.isArray(previousOwner[field.path])
              ? (previousOwner[field.path] as unknown[]).filter(
                  (id) => String(id) !== foreignItem.id,
                )
              : []
          } else if (previousOwner[field.path] === foreignItem.id) {
            previousOwner[field.path] = null
          }
        }
      }
      foreignItem[foreignField.path] = item.id
    }
  }
}

function validateRelationshipInputShape(
  field: CmsField,
  inputRecord: Record<string, unknown>,
  operation: 'create' | 'update',
) {
  const keys = ['set', 'disconnect', 'connect', 'create'].filter(
    (key) => key in inputRecord,
  )
  if (keys.length === 0) {
    if (field.many) {
      throw relationshipFailure(
        `You must provide at least one of "set", "connect"${operation === 'update' ? ', "create" or "disconnect"' : ' or "create"'} in to-many relationship inputs for "${operation}" operations.`,
        { fieldPath: field.path, keys, operation },
      )
    }
    throw relationshipFailure(
      `You must provide ${operation === 'create' ? '"connect" or "create"' : 'one of "connect", "create" or "disconnect"'} in to-one relationship inputs for "${operation}" operations.`,
      { fieldPath: field.path, keys, operation },
    )
  }
  if (!field.many) {
    if (keys.length !== 1) {
      throw relationshipFailure(
        `You must provide ${operation === 'create' ? '"connect" or "create"' : 'one of "connect", "create" or "disconnect"'} in to-one relationship inputs for "${operation}" operations.`,
        { fieldPath: field.path, keys, operation },
      )
    }
    return
  }
  if (
    operation === 'update' &&
    'set' in inputRecord &&
    'disconnect' in inputRecord
  ) {
    throw relationshipFailure(
      `The "set" and "disconnect" fields cannot both be provided to to-many relationship inputs for "update" operations.`,
      { fieldPath: field.path, keys, operation },
    )
  }
}

async function createNestedRelationshipItems(
  field: CmsField,
  inputRecord: Record<string, unknown>,
  context: CmsContext,
  parentItem?: CmsItem,
) {
  if (!field.ref) return []
  const ref = parseRelationRef(field.ref)
  const createInputs = field.many
    ? Array.isArray(inputRecord.create)
      ? inputRecord.create
      : []
    : 'create' in inputRecord
      ? [inputRecord.create]
      : []
  const mutationState =
    context.__internal.mutationState ?? new CmsMutationState()
  const nestedContext = withMutationState(context, mutationState, true)
  const createdIds: string[] = []
  for (const createInput of createInputs) {
    await assertOperationAccess(ref.listKey, 'create', nestedContext)
    const nestedData = { ...asRecord(createInput) }
    const relatedList = listByKey[ref.listKey]
    const oppositeField = ref.fieldPath
      ? getField(relatedList, ref.fieldPath)
      : undefined
    if (
      parentItem &&
      oppositeField?.kind === 'relationship' &&
      oppositeField.validation?.isRequired === true &&
      !(oppositeField.path in nestedData)
    )
      nestedData[oppositeField.path] = { connect: { id: parentItem.id } }
    const created = await nestedContext.adapter.create(ref.listKey, {
      data: nestedData,
      context: nestedContext,
    })
    createdIds.push(created.id)
  }
  return createdIds
}

async function applyRelationshipInput(
  listKey: string,
  item: CmsItem,
  field: CmsField,
  input: unknown,
  context: CmsContext,
  operation: 'create' | 'update',
) {
  const inputRecord = asRecord(input)
  if (!field.ref) return
  validateRelationshipInputShape(field, inputRecord, operation)
  const ref = parseRelationRef(field.ref)

  if (field.many) {
    const previousIds = Array.isArray(item[field.path])
      ? (item[field.path] as unknown[]).map(String)
      : []
    let nextIds = previousIds
    if ('set' in inputRecord) {
      const setIds = (
        await findRelatedItemsByWhereUnique({
          listKey: ref.listKey,
          where: inputRecord.set,
          context,
          operation: 'set',
        })
      ).map((relatedItem) => relatedItem.id)
      await assertRelatedItemsExistAndAccessible({
        listKey: ref.listKey,
        ids: setIds,
        context,
        operation: 'set',
      })
      nextIds = setIds
    }
    if ('disconnect' in inputRecord) {
      const disconnectIds = (
        await findRelatedItemsByWhereUnique({
          listKey: ref.listKey,
          where: inputRecord.disconnect,
          context,
          operation: 'disconnect',
        })
      ).map((relatedItem) => relatedItem.id)
      await assertRelatedItemsExistAndAccessible({
        listKey: ref.listKey,
        ids: disconnectIds,
        context,
        operation: 'disconnect',
      })
      const disconnectIdSet = new Set(disconnectIds)
      nextIds = nextIds.filter((id) => !disconnectIdSet.has(id))
    }
    if ('connect' in inputRecord) {
      const connectIds = (
        await findRelatedItemsByWhereUnique({
          listKey: ref.listKey,
          where: inputRecord.connect,
          context,
          operation: 'connect',
        })
      ).map((relatedItem) => relatedItem.id)
      await assertRelatedItemsExistAndAccessible({
        listKey: ref.listKey,
        ids: connectIds,
        context,
        operation: 'connect',
      })
      nextIds = uniqueIds([...nextIds, ...connectIds])
    }
    if ('create' in inputRecord)
      nextIds = uniqueIds([
        ...nextIds,
        ...(await createNestedRelationshipItems(
          field,
          inputRecord,
          context,
          operation === 'update' ? item : undefined,
        )),
      ])
    item[field.path] = nextIds
    syncInverseRelationship(listKey, item, field, previousIds, nextIds)
    return
  }

  const previousId =
    typeof item[field.path] === 'string' ? String(item[field.path]) : null
  let nextRelatedId = previousId
  if (inputRecord.disconnect) nextRelatedId = null
  const connect = asRecord(inputRecord.connect)
  if (Object.keys(connect).length > 0) {
    const connectItem = requireItemByWhereUnique(
      ref.listKey,
      connect,
      'connect',
    )
    await assertRelatedItemsExistAndAccessible({
      listKey: ref.listKey,
      ids: [connectItem.id],
      context,
      operation: 'connect',
    })
    nextRelatedId = connectItem.id
  }
  if ('create' in inputRecord) {
    const [createdId] = await createNestedRelationshipItems(
      field,
      inputRecord,
      context,
      operation === 'update' ? item : undefined,
    )
    if (createdId) nextRelatedId = createdId
  }
  item[field.path] = nextRelatedId
  syncInverseRelationship(
    listKey,
    item,
    field,
    previousId ? [previousId] : [],
    nextRelatedId ? [nextRelatedId] : [],
  )
}

function writeScalarField(
  item: CmsItem,
  listKey: string,
  field: CmsField,
  value: unknown,
  operation: 'create' | 'update',
) {
  const coerced =
    field.kind === 'password'
      ? typeof value === 'string' && value.length > 0
        ? hashPasswordSyncWithField(field, value)
        : null
      : coerceScalarValue(field, value)
  validateFieldValue(listKey, field, coerced, operation)
  item[field.path] = coerced
}

export const memoryCmsAdapter: CmsAdapter = {
  kind: 'memory',
  async findUnique(listKey, where, context) {
    const item = getItemByWhereUnique(listKey, where)
    if (!item || !context) return item
    return (
      (await applyAccessFilter([item], 'query', listKey, context))[0] ?? null
    )
  },
  async findMany(listKey, args) {
    const where = args.where
    const filteredByAccess = await applyAccessFilter(
      getItems(listKey),
      'query',
      listKey,
      args.context,
    )
    const filtered = filteredByAccess.filter((item) =>
      matchesWhere(listKey, item, where),
    )
    return applyPagination(applyOrderBy(filtered, args.orderBy), args, listKey)
  },
  async count(listKey, args) {
    return this.findMany(listKey, {
      where: args.where,
      context: args.context,
    }).then((items) => items.length)
  },
  async create(listKey, args) {
    const list = listByKey[listKey]
    const mutationState =
      args.context.__internal.mutationState ?? new CmsMutationState()
    const operationContext = withMutationState(
      args.context,
      mutationState,
      args.context.__internal.deferAfterOperation ?? false,
    )
    const inputData = asRecord(args.data)
    await assertItemAccess(listKey, 'create', operationContext, null, inputData)
    for (const field of list.fields) {
      if (
        !(field.path in inputData) ||
        field.kind === 'id' ||
        field.kind === 'virtual'
      )
        continue
      await assertFieldWriteAccess(
        listKey,
        field.path,
        'create',
        operationContext,
        null,
        inputData,
      )
    }
    const data = await resolveInputForMutation({
      listKey,
      operation: 'create',
      inputData,
      context: operationContext,
    })
    await validateResolvedInput({
      listKey,
      operation: 'create',
      inputData,
      resolvedData: data,
      context: operationContext,
    })
    await runBeforeOperationHooks({
      listKey,
      operation: 'create',
      inputData,
      resolvedData: data,
      context: operationContext,
    })

    const item: CmsItem = { id: list.isSingleton ? '1' : nextId(listKey) }
    for (const field of list.fields) {
      if (
        field.kind === 'id' ||
        field.kind === 'relationship' ||
        field.kind === 'virtual'
      )
        continue
      const value =
        field.path in data ? data[field.path] : defaultValueForField(field)
      writeScalarField(item, listKey, field, value, 'create')
    }

    for (const field of list.fields.filter(
      (entry) => entry.kind === 'relationship',
    )) {
      item[field.path] = field.many ? [] : null
    }

    for (const field of list.fields.filter(
      (entry) => entry.kind === 'relationship',
    )) {
      if (!(field.path in data)) continue
      await applyRelationshipInput(
        listKey,
        item,
        field,
        data[field.path],
        operationContext,
        'create',
      )
    }

    if (
      list.isSingleton &&
      getItems(listKey).some((existing) => existing.id === '1')
    ) {
      throw accessDenied(`Access denied: create ${listKey}`, {
        listKey,
        operation: 'create',
      })
    }
    assertUniqueConstraints(listKey, item)
    getItems(listKey).push(item)

    // Relationship connect/create needs the new item to exist for inverse resolution. Re-run
    // sync now that the item has been inserted. This remains non-atomic if a later
    // nested/relationship step fails.
    for (const field of list.fields.filter(
      (entry) => entry.kind === 'relationship' && entry.path in data,
    )) {
      const currentIds = field.many
        ? Array.isArray(item[field.path])
          ? (item[field.path] as unknown[]).map(String)
          : []
        : typeof item[field.path] === 'string'
          ? [String(item[field.path])]
          : []
      syncInverseRelationship(listKey, item, field, [], currentIds)
    }

    await flushDeferredAfterOperationHooks(operationContext)
    await runOrDeferAfterOperationHooks({
      listKey,
      operation: 'create',
      inputData,
      resolvedData: data,
      context: operationContext,
      item,
    })
    return item
  },
  async update(listKey, args) {
    const list = listByKey[listKey]
    const mutationState =
      args.context.__internal.mutationState ?? new CmsMutationState()
    const operationContext = withMutationState(
      args.context,
      mutationState,
      args.context.__internal.deferAfterOperation ?? false,
    )
    const item = getItemByWhereUnique(listKey, args.where)
    if (!item)
      throw accessDenied(`Access denied: update ${listKey}`, {
        listKey,
        operation: 'update',
      })
    await assertUpdateDeleteAccess(item, 'update', listKey, operationContext)
    const originalItem = cloneValue(item)
    const inputData = asRecord(args.data)
    await assertItemAccess(listKey, 'update', operationContext, item, inputData)
    for (const field of list.fields) {
      if (
        !(field.path in inputData) ||
        field.kind === 'id' ||
        field.kind === 'virtual'
      )
        continue
      await assertFieldWriteAccess(
        listKey,
        field.path,
        'update',
        operationContext,
        item,
        inputData,
      )
    }
    const data = await resolveInputForMutation({
      listKey,
      operation: 'update',
      inputData,
      context: operationContext,
      item,
    })
    await validateResolvedInput({
      listKey,
      operation: 'update',
      inputData,
      resolvedData: data,
      context: operationContext,
      item,
    })
    await runBeforeOperationHooks({
      listKey,
      operation: 'update',
      inputData,
      resolvedData: data,
      context: operationContext,
      item,
    })

    for (const [fieldPath, value] of Object.entries(data)) {
      const field = requireField(list, fieldPath)
      if (field.kind === 'relationship')
        await applyRelationshipInput(
          listKey,
          item,
          field,
          value,
          operationContext,
          'update',
        )
      else if (field.kind !== 'id' && field.kind !== 'virtual')
        writeScalarField(item, listKey, field, value, 'update')
    }

    assertUniqueConstraints(listKey, item, item.id)
    await cleanupReplacedFiles(
      list.fields,
      originalItem,
      data,
      args.context.__internal.storage,
    )
    await flushDeferredAfterOperationHooks(operationContext)
    await runOrDeferAfterOperationHooks({
      listKey,
      operation: 'update',
      inputData,
      resolvedData: data,
      context: operationContext,
      item,
      originalItem,
    })
    return item
  },
  async delete(listKey, where, context) {
    const item = getItemByWhereUnique(listKey, where)
    if (!item)
      throw accessDenied(`Access denied: delete ${listKey}`, {
        listKey,
        operation: 'delete',
      })
    await assertUpdateDeleteAccess(item, 'delete', listKey, context)
    const list = listByKey[listKey]
    const originalItem = cloneValue(item)
    await validateDelete({ listKey, context, item: originalItem })
    await runBeforeDeleteOperationHooks({
      listKey,
      context,
      item: originalItem,
    })

    for (const field of list.fields.filter(
      (entry) => entry.kind === 'relationship',
    )) {
      const previousIds = field.many
        ? Array.isArray(item[field.path])
          ? (item[field.path] as unknown[]).map(String)
          : []
        : typeof item[field.path] === 'string'
          ? [String(item[field.path])]
          : []
      syncInverseRelationship(listKey, item, field, previousIds, [])
    }

    store[listKey] = getItems(listKey).filter((entry) => entry.id !== item.id)
    await cleanupDeletedItemFiles(
      list.fields,
      originalItem,
      context.__internal.storage,
    )
    await runAfterDeleteOperationHooks({ listKey, context, item: originalItem })
    return originalItem
  },
  async resolveRelationship(_listKey, item, field, _context, args = {}) {
    const relatedItems = resolveRelationshipItems(item, field)
    if (!field.ref) return relatedItems
    const refListKey = parseRelationRef(field.ref).listKey
    const filtered = args.where
      ? relatedItems.filter((related) =>
          matchesWhere(refListKey, related, args.where),
        )
      : relatedItems
    const ordered = args.orderBy
      ? applyOrderBy(filtered, args.orderBy)
      : filtered
    return applyPagination(ordered, args, refListKey)
  },
  async transaction(fn, _options) {
    const runTransaction = async () => {
      const storeSnapshot = cloneStore(store)
      const counterSnapshot = cloneCounters(idCounters)
      const transactionAdapter: CmsAdapter = {
        ...this,
        transaction: async (nestedFn, __options) =>
          nestedFn(transactionAdapter),
      }
      try {
        return await fn(transactionAdapter)
      } catch (error) {
        store = storeSnapshot
        idCounters = counterSnapshot
        throw error
      }
    }

    const pending = transactionQueue.then(runTransaction, runTransaction)
    transactionQueue = pending.then(
      () => undefined,
      () => undefined,
    )
    return pending
  },
}
