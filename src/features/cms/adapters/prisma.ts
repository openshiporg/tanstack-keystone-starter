import { createCmsPrismaClient } from '../prisma-client'
import type { PrismaClient } from '../prisma-client'
import { resolveCmsPrismaDatasourceUrl } from '../prisma-schema'

import {
  assertFieldWriteAccess,
  assertItemAccess,
  assertOperationAccess,
  findRelatedItemsByWhereUnique,
  getAccessFilter,
} from '../access'
import {
  accessDenied,
  configFailure,
  cmsGraphQLError,
  relationshipFailure,
  validationFailure,
} from '../errors'
import {
  cleanupDeletedItemFiles,
  cleanupReplacedFiles,
} from '../file-lifecycle'
import { getStorageConfig } from '../storage-config'
import { getSignedStorageUrl } from '../storage'
import { getPasswordFieldKdf, validatePasswordInput } from '../auth/password'
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
import { cmsConfig, cmsLists } from '../registry'
import type { CmsField, CmsList } from '../types'
import { resolveWhereUnique } from '../where-unique'
import {
  assertPrismaDelegatesForLists,
  isPrismaCmsDelegate,
  prismaDelegateNameForList,
} from './prisma-preflight'
import type { CmsAdapter, CmsContext, CmsItem } from './types'

type PrismaDelegate = {
  findUnique: (args: Record<string, unknown>) => Promise<unknown>
  findFirst: (args: Record<string, unknown>) => Promise<unknown>
  findMany: (args: Record<string, unknown>) => Promise<unknown[]>
  count: (args: Record<string, unknown>) => Promise<number>
  create: (args: Record<string, unknown>) => Promise<unknown>
  update: (args: Record<string, unknown>) => Promise<unknown>
  delete: (args: Record<string, unknown>) => Promise<unknown>
}

type RelationRef = {
  listKey: string
  fieldPath: string
}

type PrismaLike = Record<string, unknown> & {
  $transaction?: <T>(
    fn: (transactionPrisma: PrismaLike) => Promise<T>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: string },
  ) => Promise<T>
}

type PrismaAdapterOptions = {
  prisma?: PrismaClient
  lists?: CmsList[]
  inTransaction?: boolean
}

let sharedPrisma: PrismaClient | undefined

function getPrismaClient() {
  sharedPrisma ??= createCmsPrismaClient({
    url: resolveCmsPrismaDatasourceUrl(cmsConfig.db?.url),
    provider: cmsConfig.db?.provider,
  })
  return sharedPrisma
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function parseRelationRef(ref: string): RelationRef {
  const [listKey, fieldPath] = ref.split('.')
  if (!listKey) throw new Error(`Invalid relationship ref ${ref}`)
  return { listKey, fieldPath }
}

function resolvedRelationshipMetadata(
  list: CmsList | undefined,
  field: CmsField,
) {
  return list?.resolvedDbFields?.[field.path]?.relationship
}

function relatedListKeyForField(list: CmsList | undefined, field: CmsField) {
  const resolved = resolvedRelationshipMetadata(list, field)
  if (resolved?.refListKey) return resolved.refListKey
  return typeof field.ref === 'string'
    ? parseRelationRef(field.ref).listKey
    : undefined
}

function relatedFieldPathForField(list: CmsList | undefined, field: CmsField) {
  const resolved = resolvedRelationshipMetadata(list, field)
  if (resolved?.refFieldKey) return resolved.refFieldKey
  return typeof field.ref === 'string'
    ? parseRelationRef(field.ref).fieldPath
    : undefined
}

function getField(list: CmsList, fieldPath: string) {
  return list.fields.find((field) => field.path === fieldPath)
}

function delegateFor(prisma: PrismaLike, listKey: string): PrismaDelegate {
  const delegateName = prismaDelegateNameForList(listKey)
  const delegate = prisma[delegateName]
  if (!isPrismaCmsDelegate(delegate)) {
    throw configFailure(
      `Prisma adapter could not find delegate ${delegateName} for list ${listKey}. Ensure prisma/schema.prisma contains model ${listKey} and Prisma Client has been regenerated.`,
      { listKey, delegateName },
    )
  }
  return delegate as PrismaDelegate
}

function normalizeJsonValue(value: unknown) {
  return value === undefined ? undefined : value
}

function fileColumnData(field: CmsField, value: unknown) {
  if (!field.db?.extendPrismaSchema) return undefined
  if (value === null) {
    return {
      [`${field.path}_filename`]: null,
      [`${field.path}_filesize`]: null,
    }
  }
  const record = asRecord(value)
  if (!record.filename && !record.filesize) return undefined
  return {
    [`${field.path}_filename`]:
      typeof record.filename === 'string' ? record.filename : null,
    [`${field.path}_filesize`]:
      typeof record.filesize === 'number' ? record.filesize : null,
  }
}

function imageColumnData(field: CmsField, value: unknown) {
  if (!field.db?.extendPrismaSchema) return undefined
  if (value === null) {
    return {
      [`${field.path}_id`]: null,
      [`${field.path}_extension`]: null,
      [`${field.path}_filesize`]: null,
      [`${field.path}_width`]: null,
      [`${field.path}_height`]: null,
    }
  }
  const record = asRecord(value)
  if (
    !record.id &&
    !record.extension &&
    !record.filesize &&
    !record.width &&
    !record.height
  )
    return undefined
  return {
    [`${field.path}_id`]: typeof record.id === 'string' ? record.id : null,
    [`${field.path}_extension`]:
      typeof record.extension === 'string' ? record.extension : null,
    [`${field.path}_filesize`]:
      typeof record.filesize === 'number' ? record.filesize : null,
    [`${field.path}_width`]:
      typeof record.width === 'number' ? record.width : null,
    [`${field.path}_height`]:
      typeof record.height === 'number' ? record.height : null,
  }
}

function mapFieldValueForPrisma(field: CmsField, value: unknown) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (field.kind === 'id') {
    return field.fieldMeta?.idFieldKind === 'autoincrement'
      ? Number.parseInt(String(value), 10)
      : String(value)
  }
  if (field.kind === 'timestamp') return new Date(String(value))
  if (field.kind === 'calendarDay')
    return field.fieldMeta?.provider === 'sqlite'
      ? String(value)
      : new Date(`${String(value)}T00:00:00.000Z`)
  if (field.kind === 'select' && field.fieldMeta?.type === 'integer')
    return Number.parseInt(String(value), 10)
  if (field.kind === 'multiselect' && field.fieldMeta?.type === 'integer')
    return Array.isArray(value)
      ? value.map((entry) => Number.parseInt(String(entry), 10))
      : []
  if (field.kind === 'integer') return Number.parseInt(String(value), 10)
  if (field.kind === 'float') return Number(value)
  if (field.kind === 'decimal') return String(value)
  if (field.kind === 'bigInt') return String(value)
  if (field.kind === 'checkbox') return Boolean(value)
  if (field.kind === 'password') return String(value)
  if (field.kind === 'structure')
    return field.fieldMeta?.provider === 'sqlite'
      ? JSON.stringify(normalizeJsonValue(value))
      : normalizeJsonValue(value)
  if (['json', 'document', 'image', 'file', 'multiselect'].includes(field.kind))
    return normalizeJsonValue(value)
  if (['select', 'text'].includes(field.kind)) return String(value)
  return value
}

function normalizePrismaScalarReadValue(field: CmsField, value: unknown) {
  if (value == null) return value
  if (field.kind === 'id') return String(value)
  if (field.kind === 'timestamp' && value instanceof Date)
    return value.toISOString()
  if (field.kind === 'calendarDay' && value instanceof Date)
    return value.toISOString().slice(0, 10)
  if (field.kind === 'decimal' || field.kind === 'bigInt') return String(value)
  if (field.kind === 'structure' && typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value
}

function mapPrismaItemForList(list: CmsList, item: unknown): CmsItem | null {
  if (!item || typeof item !== 'object') return null
  const mapped = { ...(item as Record<string, unknown>) }
  for (const [key, value] of Object.entries(mapped)) {
    const field = list.fields.find((candidate) => candidate.path === key)
    if (field) mapped[key] = normalizePrismaScalarReadValue(field, value)
    else if (value instanceof Date) mapped[key] = value.toISOString()
  }
  for (const field of list.fields) {
    if (field.kind === 'file' && field.db?.extendPrismaSchema) {
      const filename = mapped[`${field.path}_filename`]
      const filesize = mapped[`${field.path}_filesize`]
      const storageKey =
        typeof field.fieldMeta?.storage === 'string'
          ? field.fieldMeta.storage
          : undefined
      const storage = storageKey ? getStorageConfig(storageKey) : undefined
      mapped[field.path] =
        typeof filename === 'string' && typeof filesize === 'number'
          ? {
              filename,
              filesize,
              storage: storageKey,
              url: storage ? getSignedStorageUrl(storage, filename) : filename,
            }
          : null
      continue
    }
    if (field.kind !== 'image' || !field.db?.extendPrismaSchema) continue
    const id = mapped[`${field.path}_id`]
    const extension = mapped[`${field.path}_extension`]
    const filesize = mapped[`${field.path}_filesize`]
    const width = mapped[`${field.path}_width`]
    const height = mapped[`${field.path}_height`]
    const storageKey =
      typeof field.fieldMeta?.storage === 'string'
        ? field.fieldMeta.storage
        : undefined
    const storage = storageKey ? getStorageConfig(storageKey) : undefined
    const filename = `${id}.${extension}`
    mapped[field.path] =
      typeof id === 'string' &&
      typeof extension === 'string' &&
      typeof filesize === 'number' &&
      typeof width === 'number' &&
      typeof height === 'number'
        ? {
            id,
            extension,
            filesize,
            width,
            height,
            storage: storageKey,
            filename,
            url: storage ? getSignedStorageUrl(storage, filename) : filename,
          }
        : null
  }
  return mapped as CmsItem
}

async function mapFieldWriteValueForPrisma(field: CmsField, value: unknown) {
  if (field.kind !== 'password') return mapFieldValueForPrisma(field, value)
  const kdf = getPasswordFieldKdf(field)
  if (typeof value !== 'string' || value.length === 0) return null
  validatePasswordInput(value, field)
  return kdf.hash(value)
}

function mapPrismaItems(list: CmsList, items: unknown[]) {
  return items
    .map((item) => mapPrismaItemForList(list, item))
    .filter((item): item is CmsItem => Boolean(item))
}

function idsFromItems(items: CmsItem[]) {
  return items.map((item) => item.id).filter(Boolean)
}

function uniqueWhereForPrisma(list: CmsList, where: unknown) {
  const unique = resolveWhereUnique(list, where)
  return {
    [unique.fieldPath]: mapFieldValueForPrisma(unique.field, unique.value),
  }
}

function isRelationField(field: CmsField): field is CmsField & { ref: string } {
  return field.kind === 'relationship' && typeof field.ref === 'string'
}

function relationPrismaKey(_listKey: string, field: CmsField) {
  return field.path
}

function relationForeignKey(field: CmsField) {
  return `${field.path}Id`
}

function relationIdForPrisma(list: CmsList, id: unknown) {
  const idField = list.fields.find((field) => field.kind === 'id')
  return idField ? mapFieldValueForPrisma(idField, id) : id
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
  list: CmsList,
  field: CmsField,
  inputRecord: Record<string, unknown>,
  context: CmsContext,
  listsByKey: Record<string, CmsList>,
  parentItem?: CmsItem,
) {
  const refListKey = relatedListKeyForField(list, field)
  if (!refListKey) return []
  const relatedList = listsByKey[refListKey]
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
  const createdIds: unknown[] = []
  for (const createInput of createInputs) {
    await assertOperationAccess(refListKey, 'create', nestedContext)
    const nestedData = { ...asRecord(createInput) }
    const oppositeFieldPath = relatedFieldPathForField(list, field)
    const oppositeField = oppositeFieldPath
      ? getField(relatedList, oppositeFieldPath)
      : undefined
    if (
      parentItem &&
      oppositeField?.kind === 'relationship' &&
      oppositeField.validation?.isRequired === true &&
      !(oppositeField.path in nestedData)
    )
      nestedData[oppositeField.path] = { connect: { id: parentItem.id } }
    const created = await nestedContext.adapter.create(refListKey, {
      data: nestedData,
      context: nestedContext,
    })
    createdIds.push(relationIdForPrisma(relatedList, created.id))
  }
  return createdIds
}

async function mapRelationshipWrite(
  listKey: string,
  field: CmsField,
  input: unknown,
  operation: 'create' | 'update',
  context: CmsContext,
  listsByKey: Record<string, CmsList>,
  parentItem?: CmsItem,
) {
  const inputRecord = asRecord(input)
  const key = relationPrismaKey(listKey, field)
  const list = listsByKey[listKey]
  const refListKey = relatedListKeyForField(list, field)
  if (!refListKey) return {}
  validateRelationshipInputShape(field, inputRecord, operation)
  const relatedList = listsByKey[refListKey]
  if (field.many) {
    const ensureUniqueWhereInputs = (value: unknown) => {
      const entries = Array.isArray(value) ? value : value ? [value] : []
      for (const entry of entries) {
        resolveWhereUnique(listsByKey[refListKey], entry)
      }
    }

    const write: Record<string, unknown> = {}
    if ('set' in inputRecord) {
      ensureUniqueWhereInputs(inputRecord.set)
      const setIds = idsFromItems(
        await findRelatedItemsByWhereUnique({
          listKey: refListKey,
          where: inputRecord.set,
          context,
          operation: 'set',
        }),
      )
      write.set = setIds.map((id) => ({
        id: relationIdForPrisma(relatedList, id),
      }))
    }
    ensureUniqueWhereInputs(inputRecord.connect)
    const connectIds = idsFromItems(
      await findRelatedItemsByWhereUnique({
        listKey: refListKey,
        where: inputRecord.connect,
        context,
        operation: 'connect',
      }),
    )
    const createdIds = await createNestedRelationshipItems(
      list,
      field,
      inputRecord,
      context,
      listsByKey,
      parentItem,
    )
    if (
      connectIds.length > 0 ||
      createdIds.length > 0 ||
      'connect' in inputRecord ||
      'create' in inputRecord
    ) {
      write.connect = [...connectIds, ...createdIds].map((id) => ({
        id: relationIdForPrisma(relatedList, id),
      }))
    }
    if ('disconnect' in inputRecord && operation === 'update') {
      ensureUniqueWhereInputs(inputRecord.disconnect)
      const disconnectIds = idsFromItems(
        await findRelatedItemsByWhereUnique({
          listKey: refListKey,
          where: inputRecord.disconnect,
          context,
          operation: 'disconnect',
        }),
      )
      write.disconnect = disconnectIds.map((id) => ({
        id: relationIdForPrisma(relatedList, id),
      }))
    }
    return { [key]: write }
  }

  if ('connect' in inputRecord) {
    resolveWhereUnique(listsByKey[refListKey], inputRecord.connect)
    const [connectItem] = await findRelatedItemsByWhereUnique({
      listKey: refListKey,
      where: inputRecord.connect,
      context,
      operation: 'connect',
    })
    return {
      [key]: {
        connect: { id: relationIdForPrisma(relatedList, connectItem.id) },
      },
    }
  }
  const [createdId] = await createNestedRelationshipItems(
    list,
    field,
    inputRecord,
    context,
    listsByKey,
    parentItem,
  )
  if (createdId) return { [key]: { connect: { id: createdId } } }
  if (inputRecord.disconnect && operation === 'update')
    return { [key]: { disconnect: true } }
  return {}
}

async function mapCreateData(
  list: CmsList,
  data: Record<string, unknown>,
  context: CmsContext,
  listsByKey: Record<string, CmsList>,
) {
  const mapped: Record<string, unknown> = {}
  for (const field of list.fields) {
    if (field.kind === 'id' || field.kind === 'virtual') continue
    if (!(field.path in data)) continue
    // Caller-supplied fields were access-checked before resolveInput hooks ran.
    // Hook-injected fields are trusted server-side resolved data and must not be
    // reclassified as client input here.
    if (isRelationField(field))
      Object.assign(
        mapped,
        await mapRelationshipWrite(
          list.key,
          field,
          data[field.path],
          'create',
          context,
          listsByKey,
        ),
      )
    else {
      const columnData =
        field.kind === 'image'
          ? imageColumnData(field, data[field.path])
          : field.kind === 'file'
            ? fileColumnData(field, data[field.path])
            : undefined
      if (columnData) Object.assign(mapped, columnData)
      else
        mapped[field.path] = await mapFieldWriteValueForPrisma(
          field,
          data[field.path],
        )
    }
  }
  return mapped
}

async function mapUpdateData(
  list: CmsList,
  data: Record<string, unknown>,
  context: CmsContext,
  item: CmsItem,
  listsByKey: Record<string, CmsList>,
) {
  const mapped: Record<string, unknown> = {}
  for (const [fieldPath, value] of Object.entries(data)) {
    const field = getField(list, fieldPath)
    if (!field || field.kind === 'id' || field.kind === 'virtual') continue
    // Preserve the pre-hook field-access decision while allowing resolveInput
    // hooks to add trusted server-side values.
    if (isRelationField(field))
      Object.assign(
        mapped,
        await mapRelationshipWrite(
          list.key,
          field,
          value,
          'update',
          context,
          listsByKey,
          item,
        ),
      )
    else {
      const columnData =
        field.kind === 'image'
          ? imageColumnData(field, value)
          : field.kind === 'file'
            ? fileColumnData(field, value)
            : undefined
      if (columnData) Object.assign(mapped, columnData)
      else mapped[field.path] = await mapFieldWriteValueForPrisma(field, value)
    }
  }
  return mapped
}

function mapScalarFilter(
  field: CmsField,
  filter: unknown,
): Record<string, unknown> {
  const filterRecord = asRecord(filter)
  if (field.kind === 'password' && typeof filterRecord.isSet === 'boolean') {
    return filterRecord.isSet ? { not: null } : { equals: null }
  }
  const mapped: Record<string, unknown> = {}
  for (const [operator, rawValue] of Object.entries(filterRecord)) {
    if (operator === 'not')
      mapped.not = rawValue === null ? null : mapScalarFilter(field, rawValue)
    else if (operator === 'equals')
      mapped.equals = mapFieldValueForPrisma(field, rawValue)
    else if (operator === 'in' || operator === 'notIn')
      mapped[operator] = Array.isArray(rawValue)
        ? rawValue.map((value) => mapFieldValueForPrisma(field, value))
        : rawValue
    else if (['lt', 'lte', 'gt', 'gte'].includes(operator))
      mapped[operator] = mapFieldValueForPrisma(field, rawValue)
    else if (
      [
        'contains',
        'startsWith',
        'endsWith',
        'has',
        'hasSome',
        'hasEvery',
        'isEmpty',
        'mode',
      ].includes(operator)
    )
      mapped[operator] = rawValue
  }
  return mapped
}

function mapRelationshipWhere(
  listsByKey: Record<string, CmsList>,
  list: CmsList,
  field: CmsField,
  filter: unknown,
): Record<string, unknown> {
  if (filter === null) return { is: null }
  const filterRecord = asRecord(filter)
  const refListKey = relatedListKeyForField(list, field)
  if (field.many) {
    const mapped: Record<string, unknown> = {}
    for (const operator of ['some', 'none', 'every']) {
      if (operator in filterRecord && refListKey)
        mapped[operator] = mapWhere(
          listsByKey,
          refListKey,
          filterRecord[operator],
        )
    }
    return mapped
  }
  return {
    is: refListKey
      ? mapWhere(listsByKey, refListKey, filterRecord)
      : filterRecord,
  }
}

function mapWhere(
  listsByKey: Record<string, CmsList>,
  listKey: string,
  where: unknown,
): Record<string, unknown> {
  const list = listsByKey[listKey]
  const filter = asRecord(where)
  const mapped: Record<string, unknown> = {}

  if (Array.isArray(filter.AND))
    mapped.AND = filter.AND.map((entry) => mapWhere(listsByKey, listKey, entry))
  if (Array.isArray(filter.OR))
    mapped.OR = filter.OR.map((entry) => mapWhere(listsByKey, listKey, entry))
  if (Array.isArray(filter.NOT))
    mapped.NOT = filter.NOT.map((entry) => mapWhere(listsByKey, listKey, entry))

  for (const [fieldPath, fieldFilter] of Object.entries(filter)) {
    if (['AND', 'OR', 'NOT'].includes(fieldPath)) continue
    const field = getField(list, fieldPath)
    if (!field) continue
    const passwordFilter = asRecord(fieldFilter)
    const requiredPassword =
      field.kind === 'password' &&
      (field.graphql?.isNonNull?.create === true ||
        field.isNonNull?.[0] === true ||
        field.validation?.isRequired === true)
    if (requiredPassword && typeof passwordFilter.isSet === 'boolean') {
      if (!passwordFilter.isSet) {
        const impossibleFilter = { id: { in: [] } }
        mapped.AND = Array.isArray(mapped.AND)
          ? [...mapped.AND, impossibleFilter]
          : [impossibleFilter]
      }
      continue
    }
    if (field.kind === 'relationship')
      mapped[field.path] = mapRelationshipWhere(
        listsByKey,
        list,
        field,
        fieldFilter,
      )
    else mapped[field.path] = mapScalarFilter(field, fieldFilter)
  }

  return mapped
}

function mapOrderBy(orderBy: unknown) {
  if (!orderBy) return undefined
  const orderings = Array.isArray(orderBy)
    ? orderBy.map(asRecord)
    : [asRecord(orderBy)]
  return orderings.map((ordering) =>
    Object.fromEntries(
      Object.entries(ordering).filter(
        ([, direction]) => direction === 'asc' || direction === 'desc',
      ),
    ),
  )
}

function mergeListWhere(
  listsByKey: Record<string, CmsList>,
  listKey: string,
  userWhere: unknown,
  access: boolean | Record<string, unknown>,
) {
  if (access === false) return { id: '__cms_access_denied__' }
  const mappedUserWhere = mapWhere(listsByKey, listKey, userWhere)
  if (access === true) return mappedUserWhere
  const mappedAccess = mapWhere(listsByKey, listKey, access)
  if (Object.keys(mappedUserWhere).length === 0) return mappedAccess
  return { AND: [mappedAccess, mappedUserWhere] }
}

async function findForMutation(
  prisma: PrismaLike,
  listsByKey: Record<string, CmsList>,
  listKey: string,
  whereUnique: unknown,
  operation: 'update' | 'delete',
  context: CmsContext,
) {
  const list = listsByKey[listKey]
  const prismaWhere = uniqueWhereForPrisma(list, whereUnique)
  const access = await getAccessFilter(listKey, operation, context)
  const where =
    access === true
      ? prismaWhere
      : { AND: [prismaWhere, mergeListWhere(listsByKey, listKey, {}, access)] }
  const item = mapPrismaItemForList(
    list,
    await delegateFor(prisma, listKey).findFirst({ where }),
  )
  if (item) await assertItemAccess(listKey, operation, context, item)
  return item
}

function getIncludeForRelationship(field: CmsField) {
  if (field.kind !== 'relationship') return undefined
  return { [relationPrismaKey('', field)]: true }
}

export function createPrismaCmsAdapter(
  options: PrismaAdapterOptions = {},
): CmsAdapter {
  const prisma = (options.prisma ?? getPrismaClient()) as unknown as PrismaLike
  const lists = options.lists ?? cmsLists
  const listsByKey = Object.fromEntries(lists.map((list) => [list.key, list]))
  assertPrismaDelegatesForLists(prisma, lists)

  const adapter: CmsAdapter = {
    kind: 'prisma',
    prisma,
    async findUnique(listKey, where, context) {
      const list = listsByKey[listKey]
      const uniqueWhere = uniqueWhereForPrisma(list, where)
      const access = context
        ? await getAccessFilter(listKey, 'query', context)
        : true
      const prismaWhere =
        access === true
          ? uniqueWhere
          : {
              AND: [
                uniqueWhere,
                mergeListWhere(listsByKey, listKey, {}, access),
              ],
            }
      return mapPrismaItemForList(
        list,
        await delegateFor(prisma, listKey).findFirst({ where: prismaWhere }),
      )
    },
    async findMany(listKey, args) {
      const access = await getAccessFilter(listKey, 'query', args.context)
      const maxTake = listsByKey[listKey].graphql?.maxTake
      if (typeof args.take === 'number' && args.take < 0)
        throw validationFailure(`${listKey} take must be zero or greater`, {
          listKey,
          fieldPath: 'take',
        })
      if (
        typeof args.take === 'number' &&
        typeof maxTake === 'number' &&
        args.take > maxTake
      )
        throw validationFailure(`${listKey} take must be ${maxTake} or less`, {
          listKey,
          fieldPath: 'take',
          maxTake,
        })
      const where = mergeListWhere(listsByKey, listKey, args.where, access)
      const cursorWhere = args.cursor
        ? uniqueWhereForPrisma(listsByKey[listKey], args.cursor)
        : undefined
      const items = await delegateFor(prisma, listKey).findMany({
        where,
        orderBy: mapOrderBy(args.orderBy),
        take: args.take,
        skip: args.skip,
        cursor: cursorWhere ?? undefined,
      })
      return mapPrismaItems(listsByKey[listKey], items)
    },
    async count(listKey, args) {
      const access = await getAccessFilter(listKey, 'query', args.context)
      const where = mergeListWhere(listsByKey, listKey, args.where, access)
      return delegateFor(prisma, listKey).count({ where })
    },
    async create(listKey, args) {
      const list = listsByKey[listKey]
      const mutationState =
        args.context.__internal.mutationState ?? new CmsMutationState()
      const operationContext = withMutationState(
        args.context,
        mutationState,
        args.context.__internal.deferAfterOperation ?? false,
      )
      const inputData = asRecord(args.data)
      await assertItemAccess(
        listKey,
        'create',
        operationContext,
        null,
        inputData,
      )
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
      const resolvedData = await resolveInputForMutation({
        listKey,
        operation: 'create',
        inputData,
        context: operationContext,
      })
      await validateResolvedInput({
        listKey,
        operation: 'create',
        inputData,
        resolvedData,
        context: operationContext,
      })
      await runBeforeOperationHooks({
        listKey,
        operation: 'create',
        inputData,
        resolvedData,
        context: operationContext,
      })
      const data = await mapCreateData(
        list,
        resolvedData,
        operationContext,
        listsByKey,
      )
      if (list.isSingleton) {
        const existingSingleton = await delegateFor(prisma, listKey).findUnique(
          { where: { id: '1' } },
        )
        if (existingSingleton)
          throw accessDenied(`Access denied: create ${listKey}`, {
            listKey,
            operation: 'create',
          })
      }
      const item = await delegateFor(prisma, listKey).create({
        data: list.isSingleton ? { ...data, id: '1' } : data,
      })
      const mapped = mapPrismaItemForList(list, item)
      if (!mapped)
        throw cmsGraphQLError(
          `Failed to create ${listKey}`,
          'KS_GRAPHQL_ERROR',
          { listKey, operation: 'create' },
        )
      await flushDeferredAfterOperationHooks(operationContext)
      await runOrDeferAfterOperationHooks({
        listKey,
        operation: 'create',
        inputData,
        resolvedData,
        context: operationContext,
        item: mapped,
      })
      return mapped
    },
    async update(listKey, args) {
      const list = listsByKey[listKey]
      const mutationState =
        args.context.__internal.mutationState ?? new CmsMutationState()
      const operationContext = withMutationState(
        args.context,
        mutationState,
        args.context.__internal.deferAfterOperation ?? false,
      )
      const updateWhere = uniqueWhereForPrisma(list, args.where)
      const existing = await findForMutation(
        prisma,
        listsByKey,
        listKey,
        args.where,
        'update',
        operationContext,
      )
      if (!existing)
        throw accessDenied(`Access denied: update ${listKey}`, {
          listKey,
          operation: 'update',
        })
      const inputData = asRecord(args.data)
      await assertItemAccess(
        listKey,
        'update',
        operationContext,
        existing,
        inputData,
      )
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
          existing,
          inputData,
        )
      }
      const resolvedData = await resolveInputForMutation({
        listKey,
        operation: 'update',
        inputData,
        context: operationContext,
        item: existing,
      })
      await validateResolvedInput({
        listKey,
        operation: 'update',
        inputData,
        resolvedData,
        context: operationContext,
        item: existing,
      })
      await runBeforeOperationHooks({
        listKey,
        operation: 'update',
        inputData,
        resolvedData,
        context: operationContext,
        item: existing,
      })
      const data = await mapUpdateData(
        list,
        resolvedData,
        operationContext,
        existing,
        listsByKey,
      )
      const updated = mapPrismaItemForList(
        list,
        await delegateFor(prisma, listKey).update({ where: updateWhere, data }),
      )
      if (updated) {
        await cleanupReplacedFiles(
          list.fields,
          existing,
          resolvedData,
          operationContext.__internal.storage,
        )
        await flushDeferredAfterOperationHooks(operationContext)
        await runOrDeferAfterOperationHooks({
          listKey,
          operation: 'update',
          inputData,
          resolvedData,
          context: operationContext,
          item: updated,
          originalItem: existing,
        })
      }
      return updated
    },
    async delete(listKey, where, context) {
      const list = listsByKey[listKey]
      const deleteWhere = uniqueWhereForPrisma(list, where)
      const existing = await findForMutation(
        prisma,
        listsByKey,
        listKey,
        where,
        'delete',
        context,
      )
      if (!existing)
        throw accessDenied(`Access denied: delete ${listKey}`, {
          listKey,
          operation: 'delete',
        })
      await validateDelete({ listKey, context, item: existing })
      await runBeforeDeleteOperationHooks({ listKey, context, item: existing })
      const deleted = mapPrismaItemForList(
        list,
        await delegateFor(prisma, listKey).delete({ where: deleteWhere }),
      )
      if (deleted) {
        await cleanupDeletedItemFiles(
          list.fields,
          deleted,
          context.__internal.storage,
        )
        await runAfterDeleteOperationHooks({ listKey, context, item: deleted })
      }
      return deleted
    },
    async resolveRelationship(listKey, item, field, _context, args = {}) {
      const list = listsByKey[listKey]
      const refListKey = relatedListKeyForField(list, field)
      const refFieldPath = relatedFieldPathForField(list, field)
      if (!refListKey) return []
      const currentListId = relationIdForPrisma(list, item.id)
      if (field.many) {
        const relatedList = listsByKey[refListKey]
        const explicitIds = Array.isArray(item[field.path])
          ? (item[field.path] as unknown[]).map((id) =>
              relationIdForPrisma(relatedList, id),
            )
          : null
        const inverseField = refFieldPath
          ? relatedList.fields.find(
              (candidate) => candidate.path === refFieldPath,
            )
          : undefined
        const inverseFilter = inverseField?.many
          ? { some: { id: { equals: currentListId } } }
          : { id: { equals: currentListId } }
        const baseWhere = explicitIds
          ? { id: { in: explicitIds } }
          : refFieldPath
            ? mapWhere(listsByKey, refListKey, {
                [refFieldPath]: inverseFilter,
              })
            : {}
        const userWhere = args.where
          ? mapWhere(listsByKey, refListKey, args.where)
          : {}
        const where = Object.keys(userWhere).length
          ? { AND: [baseWhere, userWhere] }
          : baseWhere
        const cursorWhere = args.cursor
          ? uniqueWhereForPrisma(relatedList, args.cursor)
          : undefined
        const relatedItems = await delegateFor(prisma, refListKey).findMany({
          where,
          orderBy: mapOrderBy(args.orderBy),
          take: args.take,
          skip: args.skip,
          cursor: cursorWhere ?? undefined,
        })
        return mapPrismaItems(relatedList, relatedItems)
      }

      const hydrated = await delegateFor(prisma, listKey).findUnique({
        where: { id: currentListId },
        include: getIncludeForRelationship(field),
      })
      const relatedList = listsByKey[refListKey]
      const related = asRecord(hydrated)[relationPrismaKey(list.key, field)]
      const mapped = mapPrismaItemForList(relatedList, related)
      const relatedWhere = args.where
        ? mapWhere(listsByKey, refListKey, args.where)
        : undefined
      if (mapped) {
        if (!relatedWhere) return [mapped]
        const filtered = await delegateFor(prisma, refListKey).findMany({
          where: {
            AND: [
              { id: relationIdForPrisma(relatedList, mapped.id) },
              relatedWhere,
            ],
          },
        })
        return mapPrismaItems(relatedList, filtered)
      }

      const explicitValue = item[relationForeignKey(field)] ?? item[field.path]
      if (
        typeof explicitValue === 'string' ||
        typeof explicitValue === 'number'
      ) {
        const explicitRelatedId = relationIdForPrisma(
          listsByKey[refListKey],
          explicitValue,
        )
        const where = args.where
          ? {
              AND: [
                { id: explicitRelatedId },
                mapWhere(listsByKey, refListKey, args.where),
              ],
            }
          : { id: explicitRelatedId }
        const relatedItem = await delegateFor(prisma, refListKey).findFirst({
          where,
        })
        const relatedMapped = mapPrismaItemForList(
          listsByKey[refListKey],
          relatedItem,
        )
        return relatedMapped ? [relatedMapped] : []
      }
      return []
    },
    async transaction(fn, transactionOptions) {
      if (options.inTransaction || typeof prisma.$transaction !== 'function')
        return fn(adapter)
      const prismaTransactionOptions = transactionOptions
        ? {
            ...transactionOptions,
            isolationLevel:
              typeof transactionOptions.isolationLevel === 'object'
                ? transactionOptions.isolationLevel.Serializable
                : transactionOptions.isolationLevel,
          }
        : undefined
      return prisma.$transaction(async (transactionPrisma) => {
        const transactionAdapter = createPrismaCmsAdapter({
          prisma: transactionPrisma as unknown as PrismaClient,
          lists,
          inTransaction: true,
        })
        return fn(transactionAdapter)
      }, prismaTransactionOptions)
    },
  }

  return adapter
}
