import type { CmsContext, CmsItem } from './adapters'
import { configFailure, extensionFailure, validationFailure } from './errors'
import { cmsLists } from './registry'
import type {
  CmsField,
  CmsHookBaseArgs,
  CmsHookOperation,
  CmsInputHookBaseArgs,
  CmsInputHookOperation,
  CmsList,
} from './types'

type ResolveInputArgs = {
  listKey: string
  operation: CmsInputHookOperation
  inputData: Record<string, unknown>
  context: CmsContext
  item?: CmsItem | null
}

type OperationHookArgs = Omit<ResolveInputArgs, 'operation'> & {
  operation: CmsHookOperation
  resolvedData: Record<string, unknown>
}

type InputOperationHookArgs = OperationHookArgs & {
  operation: CmsInputHookOperation
}

type DeleteHookArgs = {
  listKey: string
  context: CmsContext
  item: CmsItem
}

type AfterOperationHookArgs = OperationHookArgs & {
  item: CmsItem
  originalItem?: CmsItem | null
}

function getList(
  listKey: string,
  context?: Pick<CmsContext, '__internal'>,
): CmsList {
  const list = (context?.__internal.lists ?? cmsLists).find(
    (entry) => entry.key === listKey,
  )
  if (!list) throw configFailure(`Unknown CMS list ${listKey}`, { listKey })
  return list
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function cloneInputData(data: Record<string, unknown>) {
  return { ...data }
}

function relationshipRef(field: CmsField) {
  if (field.kind !== 'relationship' || !field.ref) return null
  const [listKey, fieldPath] = field.ref.split('.')
  return listKey ? { listKey, fieldPath } : null
}

function relationshipIsRequired(
  field: CmsField,
  operation: CmsInputHookOperation,
) {
  if (field.kind !== 'relationship') return false
  const nonNullIndex = operation === 'create' ? 0 : 1
  return Boolean(
    field.validation?.isRequired === true ||
    field.graphql?.isNonNull?.[operation] === true ||
    field.isNonNull?.[nonNullIndex] === true,
  )
}

function nonemptyRelationshipInput(value: unknown, field: CmsField) {
  if (!isRecord(value)) return false
  if ('create' in value) {
    const create = value.create
    if (
      field.many ? Array.isArray(create) && create.length > 0 : isRecord(create)
    )
      return true
  }
  if ('connect' in value) {
    const connect = value.connect
    if (
      field.many
        ? Array.isArray(connect) && connect.length > 0
        : isRecord(connect)
    )
      return true
  }
  return false
}

function relationshipInputRemovesEdges(value: unknown, field: CmsField) {
  if (!isRecord(value)) return false
  if ('set' in value) return true
  if (!('disconnect' in value)) return false
  return field.many
    ? Array.isArray(value.disconnect) && value.disconnect.length > 0
    : value.disconnect === true || isRecord(value.disconnect)
}

async function validateRequiredRelationshipInput(
  args: InputOperationHookArgs,
  list: CmsList,
  resolvedData: Record<string, unknown>,
) {
  for (const field of list.fields) {
    if (field.kind !== 'relationship') continue
    const value = resolvedData[field.path]
    if (
      args.operation === 'create' &&
      relationshipIsRequired(field, 'create')
    ) {
      if (
        !(field.path in resolvedData) ||
        !nonemptyRelationshipInput(value, field)
      )
        throw validationFailure(`${list.key}.${field.path} is required`, {
          listKey: list.key,
          fieldPath: field.path,
          operation: args.operation,
        })
    }
    if (
      args.operation === 'update' &&
      relationshipIsRequired(field, 'update') &&
      relationshipInputRemovesEdges(value, field)
    )
      throw validationFailure(`${list.key}.${field.path} is required`, {
        listKey: list.key,
        fieldPath: field.path,
        operation: args.operation,
      })

    if (args.operation !== 'update' || !(field.path in resolvedData)) continue
    const ref = relationshipRef(field)
    if (!ref?.fieldPath || !relationshipInputRemovesEdges(value, field))
      continue
    const oppositeList = getList(ref.listKey, args.context)
    const oppositeField = oppositeList.fields.find(
      (candidate) => candidate.path === ref.fieldPath,
    )
    if (oppositeField && relationshipIsRequired(oppositeField, 'update'))
      throw validationFailure(
        `${oppositeList.key}.${oppositeField.path} is required`,
        {
          listKey: oppositeList.key,
          fieldPath: oppositeField.path,
          operation: args.operation,
        },
      )
  }
}

async function validateRequiredRelationshipDelete(args: DeleteHookArgs) {
  const lists = args.context.__internal.lists ?? cmsLists
  const sudoContext = args.context.sudo()
  for (const ownerList of lists) {
    for (const field of ownerList.fields) {
      const ref = relationshipRef(field)
      if (
        ref?.listKey !== args.listKey ||
        !relationshipIsRequired(field, 'update')
      )
        continue
      const owners = await sudoContext.adapter.findMany(ownerList.key, {
        where: {
          [field.path]: field.many
            ? { some: { id: { equals: args.item.id } } }
            : { id: { equals: args.item.id } },
        },
        take: 1,
        context: sudoContext,
      })
      if (owners.length > 0)
        throw validationFailure(`${ownerList.key}.${field.path} is required`, {
          listKey: ownerList.key,
          fieldPath: field.path,
          operation: 'delete',
          relatedListKey: args.listKey,
        })
    }
  }
}

function getHookBaseArgs(
  list: CmsList,
  operation: CmsHookOperation,
  context: CmsContext,
  inputData: Record<string, unknown>,
  resolvedData: Record<string, unknown>,
  item: CmsItem | null,
): CmsHookBaseArgs {
  return {
    context,
    session: context.session,
    listKey: list.key,
    operation,
    inputData,
    resolvedData,
    item,
  }
}

function getInputHookBaseArgs(
  list: CmsList,
  operation: CmsInputHookOperation,
  context: CmsContext,
  inputData: Record<string, unknown>,
  resolvedData: Record<string, unknown>,
  item: CmsItem | null,
): CmsInputHookBaseArgs {
  return getHookBaseArgs(
    list,
    operation,
    context,
    inputData,
    resolvedData,
    item,
  ) as CmsInputHookBaseArgs
}

function fieldsInDeterministicOrder(list: CmsList): CmsField[] {
  return list.fields.filter(
    (field) => field.kind !== 'id' && field.kind !== 'virtual',
  )
}

function hookFieldsForInput(
  list: CmsList,
  inputData: Record<string, unknown>,
): CmsField[] {
  return fieldsInDeterministicOrder(list).filter(
    (field) => field.path in inputData,
  )
}

function getOperationHook<THook>(
  hook: THook | Partial<Record<CmsHookOperation, THook>> | undefined,
  operation: CmsHookOperation,
): THook | undefined {
  if (!hook) return undefined
  return typeof hook === 'function'
    ? (hook as THook)
    : (hook as Partial<Record<CmsHookOperation, THook>>)[operation]
}

function getInputOperationHook<THook>(
  hook: THook | Partial<Record<CmsInputHookOperation, THook>> | undefined,
  operation: CmsInputHookOperation,
): THook | undefined {
  if (!hook) return undefined
  return typeof hook === 'function'
    ? (hook as THook)
    : (hook as Partial<Record<CmsInputHookOperation, THook>>)[operation]
}

export async function resolveInputForMutation(
  args: ResolveInputArgs,
): Promise<Record<string, unknown>> {
  const list = getList(args.listKey, args.context)
  const inputData = cloneInputData(args.inputData)
  const resolvedData = cloneInputData(args.inputData)

  const fieldErrors: Array<{ error: Error; tag: string }> = []
  const fieldResults = await Promise.all(
    fieldsInDeterministicOrder(list).map(async (field) => {
      const resolveInput = getInputOperationHook(
        field.hooks?.resolveInput,
        args.operation,
      )
      if (!resolveInput) return [field.path, undefined] as const
      try {
        const value = await resolveInput({
          ...getInputHookBaseArgs(
            list,
            args.operation,
            args.context,
            inputData,
            resolvedData,
            args.item ?? null,
          ),
          fieldKey: field.path,
          field,
        })
        return [field.path, value] as const
      } catch (error) {
        fieldErrors.push({
          error: error instanceof Error ? error : new Error(String(error)),
          tag: `${list.key}.${field.path}.hooks.resolveInput`,
        })
        return [field.path, undefined] as const
      }
    }),
  )
  if (fieldErrors.length > 0)
    throw extensionFailure(fieldErrors, 'resolveInput', {
      listKey: list.key,
      operation: args.operation,
    })
  for (const [fieldPath, value] of fieldResults) {
    if (value !== undefined) resolvedData[fieldPath] = value
  }

  const listResolveInput = getInputOperationHook(
    list.hooks?.resolveInput,
    args.operation,
  )
  let listResolvedData: Record<string, unknown> | void
  try {
    listResolvedData = await listResolveInput?.(
      getInputHookBaseArgs(
        list,
        args.operation,
        args.context,
        inputData,
        resolvedData,
        args.item ?? null,
      ),
    )
  } catch (error) {
    throw extensionFailure(
      [
        {
          error: error instanceof Error ? error : new Error(String(error)),
          tag: `${list.key}.hooks.resolveInput`,
        },
      ],
      'resolveInput',
      { listKey: list.key, operation: args.operation },
    )
  }
  if (listResolvedData !== undefined) {
    if (!isRecord(listResolvedData))
      throw validationFailure(
        `${list.key}.hooks.resolveInput must return an object or undefined`,
        { listKey: list.key, hook: 'resolveInput' },
      )
    return { ...resolvedData, ...listResolvedData }
  }

  return resolvedData
}

export async function validateResolvedInput(
  args: InputOperationHookArgs,
): Promise<void> {
  const list = getList(args.listKey, args.context)
  const inputData = cloneInputData(args.inputData)
  const resolvedData = cloneInputData(args.resolvedData)

  await validateRequiredRelationshipInput(args, list, resolvedData)

  const validationMessages: string[] = []
  const fieldErrors: Array<{ error: Error; tag: string }> = []
  await Promise.all(
    hookFieldsForInput(list, inputData).map(async (field) => {
      const validateInput =
        getOperationHook(field.hooks?.validate, args.operation) ??
        field.hooks?.validateInput
      if (!validateInput) return
      try {
        await validateInput({
          ...getInputHookBaseArgs(
            list,
            args.operation,
            args.context,
            inputData,
            resolvedData,
            args.item ?? null,
          ),
          fieldKey: field.path,
          field,
          addValidationError: (message: string) =>
            validationMessages.push(`${list.key}.${field.path}: ${message}`),
        })
      } catch (error) {
        fieldErrors.push({
          error: error instanceof Error ? error : new Error(String(error)),
          tag: `${list.key}.${field.path}.hooks.validateInput`,
        })
      }
    }),
  )
  if (fieldErrors.length > 0)
    throw extensionFailure(fieldErrors, 'validateInput', {
      listKey: list.key,
      operation: args.operation,
    })

  const listValidateInput =
    getOperationHook(list.hooks?.validate, args.operation) ??
    list.hooks?.validateInput
  try {
    await listValidateInput?.({
      ...getInputHookBaseArgs(
        list,
        args.operation,
        args.context,
        inputData,
        resolvedData,
        args.item ?? null,
      ),
      addValidationError: (message: string) =>
        validationMessages.push(`${list.key}: ${message}`),
    })
  } catch (error) {
    throw extensionFailure(
      [
        {
          error: error instanceof Error ? error : new Error(String(error)),
          tag: `${list.key}.hooks.validateInput`,
        },
      ],
      'validateInput',
      { listKey: list.key, operation: args.operation },
    )
  }
  if (validationMessages.length > 0)
    throw validationFailure(validationMessages, {
      listKey: list.key,
      operation: args.operation,
    })
}

export async function runBeforeOperationHooks(
  args: OperationHookArgs,
): Promise<void> {
  const list = getList(args.listKey, args.context)
  const inputData = cloneInputData(args.inputData)
  const resolvedData = cloneInputData(args.resolvedData)

  const fields =
    args.operation === 'delete'
      ? fieldsInDeterministicOrder(list)
      : hookFieldsForInput(list, inputData)
  const fieldErrors: Array<{ error: Error; tag: string }> = []
  await Promise.all(
    fields.map(async (field) => {
      const beforeOperation = getOperationHook(
        field.hooks?.beforeOperation,
        args.operation,
      )
      if (!beforeOperation) return
      try {
        await beforeOperation({
          ...getHookBaseArgs(
            list,
            args.operation,
            args.context,
            inputData,
            resolvedData,
            args.item ?? null,
          ),
          fieldKey: field.path,
          field,
        })
      } catch (error) {
        fieldErrors.push({
          error: error instanceof Error ? error : new Error(String(error)),
          tag: `${list.key}.${field.path}.hooks.beforeOperation`,
        })
      }
    }),
  )
  if (fieldErrors.length > 0)
    throw extensionFailure(fieldErrors, 'beforeOperation', {
      listKey: list.key,
      operation: args.operation,
    })

  const listBeforeOperation = getOperationHook(
    list.hooks?.beforeOperation,
    args.operation,
  )
  try {
    await listBeforeOperation?.(
      getHookBaseArgs(
        list,
        args.operation,
        args.context,
        inputData,
        resolvedData,
        args.item ?? null,
      ),
    )
  } catch (error) {
    throw extensionFailure(
      [
        {
          error: error instanceof Error ? error : new Error(String(error)),
          tag: `${list.key}.hooks.beforeOperation`,
        },
      ],
      'beforeOperation',
      { listKey: list.key, operation: args.operation },
    )
  }
}

export async function validateDelete(args: DeleteHookArgs): Promise<void> {
  const list = getList(args.listKey, args.context)
  await validateRequiredRelationshipDelete(args)
  const inputData: Record<string, unknown> = {}
  const resolvedData: Record<string, unknown> = {}

  const validationMessages: string[] = []
  const fieldErrors: Array<{ error: Error; tag: string }> = []
  await Promise.all(
    fieldsInDeterministicOrder(list).map(async (field) => {
      const validateDeleteHook =
        getOperationHook(field.hooks?.validate, 'delete') ??
        field.hooks?.validateDelete
      if (!validateDeleteHook) return
      try {
        await validateDeleteHook({
          ...getHookBaseArgs(
            list,
            'delete',
            args.context,
            inputData,
            resolvedData,
            args.item,
          ),
          fieldKey: field.path,
          field,
          addValidationError: (message: string) =>
            validationMessages.push(`${list.key}.${field.path}: ${message}`),
        })
      } catch (error) {
        fieldErrors.push({
          error: error instanceof Error ? error : new Error(String(error)),
          tag: `${list.key}.${field.path}.hooks.validateInput`,
        })
      }
    }),
  )
  if (fieldErrors.length > 0)
    throw extensionFailure(fieldErrors, 'validateInput', {
      listKey: list.key,
      operation: 'delete',
    })

  const listValidateDelete =
    getOperationHook(list.hooks?.validate, 'delete') ??
    list.hooks?.validateDelete
  try {
    await listValidateDelete?.({
      ...getHookBaseArgs(
        list,
        'delete',
        args.context,
        inputData,
        resolvedData,
        args.item,
      ),
      addValidationError: (message: string) =>
        validationMessages.push(`${list.key}: ${message}`),
    })
  } catch (error) {
    throw extensionFailure(
      [
        {
          error: error instanceof Error ? error : new Error(String(error)),
          tag: `${list.key}.hooks.validateInput`,
        },
      ],
      'validateInput',
      { listKey: list.key, operation: 'delete' },
    )
  }
  if (validationMessages.length > 0)
    throw validationFailure(validationMessages, {
      listKey: list.key,
      operation: 'delete',
    })
}

export async function runBeforeDeleteOperationHooks(
  args: DeleteHookArgs,
): Promise<void> {
  await runBeforeOperationHooks({
    listKey: args.listKey,
    operation: 'delete',
    inputData: {},
    resolvedData: {},
    context: args.context,
    item: args.item,
  })
}

export async function runAfterDeleteOperationHooks(
  args: DeleteHookArgs,
): Promise<void> {
  await runOrDeferAfterOperationHooks({
    listKey: args.listKey,
    operation: 'delete',
    inputData: {},
    resolvedData: {},
    context: args.context,
    item: args.item,
    originalItem: args.item,
  })
}

async function executeAfterOperationHooks(
  args: AfterOperationHookArgs,
): Promise<void> {
  const list = getList(args.listKey, args.context)
  const inputData = cloneInputData(args.inputData)
  const resolvedData = cloneInputData(args.resolvedData)
  const originalItem = args.originalItem ?? null

  const fields =
    args.operation === 'delete'
      ? fieldsInDeterministicOrder(list)
      : hookFieldsForInput(list, inputData)
  const fieldErrors: Array<{ error: Error; tag: string }> = []
  await Promise.all(
    fields.map(async (field) => {
      const afterOperation = getOperationHook(
        field.hooks?.afterOperation,
        args.operation,
      )
      if (!afterOperation) return
      try {
        await afterOperation({
          ...getHookBaseArgs(
            list,
            args.operation,
            args.context,
            inputData,
            resolvedData,
            args.item,
          ),
          item: args.item,
          originalItem,
          fieldKey: field.path,
          field,
        })
      } catch (error) {
        fieldErrors.push({
          error: error instanceof Error ? error : new Error(String(error)),
          tag: `${list.key}.${field.path}.hooks.afterOperation`,
        })
      }
    }),
  )
  if (fieldErrors.length > 0)
    throw extensionFailure(fieldErrors, 'afterOperation', {
      listKey: list.key,
      operation: args.operation,
    })

  const listAfterOperation = getOperationHook(
    list.hooks?.afterOperation,
    args.operation,
  )
  try {
    await listAfterOperation?.({
      ...getHookBaseArgs(
        list,
        args.operation,
        args.context,
        inputData,
        resolvedData,
        args.item,
      ),
      item: args.item,
      originalItem,
    })
  } catch (error) {
    throw extensionFailure(
      [
        {
          error: error instanceof Error ? error : new Error(String(error)),
          tag: `${list.key}.hooks.afterOperation`,
        },
      ],
      'afterOperation',
      { listKey: list.key, operation: args.operation },
    )
  }
}

export async function runOrDeferAfterOperationHooks(
  args: AfterOperationHookArgs,
): Promise<void> {
  if (
    args.context.__internal.deferAfterOperation &&
    args.context.__internal.mutationState
  ) {
    args.context.__internal.mutationState.defer(() =>
      executeAfterOperationHooks(args),
    )
    return
  }
  await executeAfterOperationHooks(args)
}

export async function flushDeferredAfterOperationHooks(
  context: CmsContext,
): Promise<void> {
  await context.__internal.mutationState?.flush()
}

export async function runAfterOperationHooks(
  args: AfterOperationHookArgs,
): Promise<void> {
  await executeAfterOperationHooks(args)
}
