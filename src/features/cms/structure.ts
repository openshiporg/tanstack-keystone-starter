import type { GraphQLResolveInfo } from 'graphql'

import type { CmsContext, CmsItem } from './adapters'
import { getGraphQLNames } from './gql-names'

export type StructureGraphQLType = {
  graphQLType: { toString: () => string }
}

export type StructureFormSchema = {
  kind: 'form'
  defaultValue: unknown
  validate: (value: unknown) => boolean
  graphql: {
    input: StructureGraphQLType
    output: {
      type: StructureGraphQLType
      args?: Record<
        string,
        {
          type: StructureGraphQLType
          defaultValue?: unknown
          description?: string
        }
      >
      resolve?: unknown
    }
  }
}

export type StructureSchema =
  | StructureFormSchema
  | {
      kind: 'object'
      fields: Record<string, StructureSchema>
    }
  | { kind: 'array'; element: StructureSchema }
  | {
      kind: 'conditional'
      discriminant: StructureFormSchema
      values: Record<string, StructureSchema>
    }
  | {
      kind: 'relationship'
      listKey: string
      selection?: string
      label: string
      many: boolean
    }

export function validateStructureSchema(
  schema: StructureSchema,
  listKeys: ReadonlySet<string>,
  path: string[] = [],
  ancestors: StructureSchema[] = [],
): void {
  if (schema.kind === 'form') {
    if (
      typeof schema.validate !== 'function' ||
      !schema.graphql?.input?.graphQLType ||
      !schema.graphql?.output?.type?.graphQLType
    )
      throw new Error(
        `The form field at "${path.join('.')}" is missing its GraphQL contract.`,
      )
    return
  }
  if (schema.kind === 'relationship') {
    if (!listKeys.has(schema.listKey))
      throw new Error(
        `The relationship field at "${path.join('.')}" has the listKey "${schema.listKey}" but no list named "${schema.listKey}" exists.`,
      )
    return
  }
  if (ancestors.includes(schema))
    throw new Error(
      `The field "${path.join('.')}" is the same as it's ancestor. Use an array or conditional field for recursive structures.`,
    )
  if (schema.kind === 'array') {
    validateStructureSchema(schema.element, listKeys, [...path, 'array'], [])
    return
  }
  const nextAncestors = [...ancestors, schema]
  if (schema.kind === 'object') {
    for (const [key, child] of Object.entries(schema.fields))
      validateStructureSchema(child, listKeys, [...path, key], nextAncestors)
    return
  }
  for (const [key, child] of Object.entries(schema.values))
    validateStructureSchema(
      child,
      listKeys,
      [...path, key],
      key === String(schema.discriminant.defaultValue) ? nextAncestors : [],
    )
}

export function structureRelationshipReferences(
  schema: StructureSchema,
): Array<{ listKey: string; many: boolean }> {
  if (schema.kind === 'relationship')
    return [{ listKey: schema.listKey, many: schema.many }]
  if (schema.kind === 'form') return []
  if (schema.kind === 'array')
    return structureRelationshipReferences(schema.element)
  if (schema.kind === 'object')
    return Object.values(schema.fields).flatMap(structureRelationshipReferences)
  return Object.values(schema.values).flatMap(structureRelationshipReferences)
}

export function getStructureInitialValue(schema: StructureSchema): unknown {
  switch (schema.kind) {
    case 'form':
      return schema.defaultValue
    case 'relationship':
      return schema.many ? [] : null
    case 'array':
      return []
    case 'object':
      return Object.fromEntries(
        Object.entries(schema.fields).map(([key, value]) => [
          key,
          getStructureInitialValue(value),
        ]),
      )
    case 'conditional': {
      const discriminant = schema.discriminant.defaultValue
      return {
        discriminant,
        value: getStructureInitialValue(
          schema.values[String(discriminant)] as StructureSchema,
        ),
      }
    }
  }
}

function assertRecord(value: unknown, message: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(message)
  return value as Record<string, unknown>
}

async function connectOne(
  listKey: string,
  where: unknown,
  context: CmsContext,
  operation: string,
) {
  const item = await context.db[listKey].findOne({
    where: assertRecord(where, `Invalid ${operation} value`),
  })
  if (!item)
    throw new Error(
      `You cannot perform the '${operation}' operation on the item '${JSON.stringify(where)}'. It may not exist.`,
    )
  return { id: String(item.id) }
}

async function createOne(listKey: string, data: unknown, context: CmsContext) {
  const item = await context.db[listKey].createOne({
    data: assertRecord(data, 'Invalid create value'),
  })
  return { id: String(item.id) }
}

async function resolveRelationshipCreate(
  schema: Extract<StructureSchema, { kind: 'relationship' }>,
  value: unknown,
  context: CmsContext,
) {
  const input = assertRecord(value, 'Invalid relationship value')
  if (schema.many) {
    if (!Array.isArray(input.connect) && !Array.isArray(input.create))
      throw new Error(
        'You must provide "connect" or "create" in to-many relationship inputs for "create" operations.',
      )
    return [
      ...(await Promise.all(
        (Array.isArray(input.connect) ? input.connect : []).map((where) =>
          connectOne(schema.listKey, where, context, 'connect'),
        ),
      )),
      ...(await Promise.all(
        (Array.isArray(input.create) ? input.create : []).map((data) =>
          createOne(schema.listKey, data, context),
        ),
      )),
    ]
  }
  if (Object.keys(input).length !== 1 || (!input.connect && !input.create))
    throw new Error(
      'You must provide "connect" or "create" in to-one relationship inputs for "create" operations.',
    )
  return input.connect
    ? connectOne(schema.listKey, input.connect, context, 'connect')
    : createOne(schema.listKey, input.create, context)
}

async function resolveRelationshipUpdate(
  schema: Extract<StructureSchema, { kind: 'relationship' }>,
  value: unknown,
  previous: unknown,
  context: CmsContext,
) {
  const input = assertRecord(value, 'Invalid relationship value')
  if (!schema.many) {
    if (Object.keys(input).length !== 1)
      throw new Error(
        'You must provide one of "connect", "create" or "disconnect" in to-one relationship inputs for "update" operations.',
      )
    if (input.disconnect) return null
    if (input.connect)
      return connectOne(schema.listKey, input.connect, context, 'connect')
    if (input.create) return createOne(schema.listKey, input.create, context)
    return previous
  }
  if (
    !Array.isArray(input.connect) &&
    !Array.isArray(input.create) &&
    !Array.isArray(input.disconnect) &&
    !Array.isArray(input.set)
  )
    throw new Error(
      'You must provide at least one of "set", "connect", "create" or "disconnect" in to-many relationship inputs for "update" operations.',
    )
  if (input.set && input.disconnect)
    throw new Error(
      'The "set" and "disconnect" fields cannot both be provided to to-many relationship inputs for "update" operations.',
    )
  let result = Array.isArray(previous) ? [...previous] : []
  if (Array.isArray(input.set))
    result = await Promise.all(
      input.set.map((where) =>
        connectOne(schema.listKey, where, context, 'set'),
      ),
    )
  if (Array.isArray(input.disconnect)) {
    const removed = await Promise.all(
      input.disconnect.map((where) =>
        connectOne(schema.listKey, where, context, 'disconnect'),
      ),
    )
    const ids = new Set(removed.map((entry) => entry.id))
    result = result.filter(
      (entry) => !ids.has(String((entry as { id?: unknown } | null)?.id ?? '')),
    )
  }
  if (Array.isArray(input.connect))
    result.push(
      ...(await Promise.all(
        input.connect.map((where) =>
          connectOne(schema.listKey, where, context, 'connect'),
        ),
      )),
    )
  if (Array.isArray(input.create))
    result.push(
      ...(await Promise.all(
        input.create.map((data) => createOne(schema.listKey, data, context)),
      )),
    )
  return result
}

export async function resolveStructureValue(
  schema: StructureSchema,
  value: unknown,
  previous: unknown,
  operation: 'create' | 'update',
  context: CmsContext,
  path: Array<string | number> = [],
): Promise<unknown> {
  if (value === undefined) {
    if (operation === 'update') return previous
    return getStructureInitialValue(schema)
  }
  if (schema.kind === 'form') {
    if (schema.validate(value)) return value
    throw new Error(
      `The value of the form field at '${path.join('.')}' is invalid`,
    )
  }
  if (value === null)
    throw new Error(
      `${schema.kind[0].toUpperCase() + schema.kind.slice(1)} fields cannot be set to null but the field at '${path.join('.')}' is null`,
    )
  if (schema.kind === 'relationship')
    return operation === 'create'
      ? resolveRelationshipCreate(schema, value, context)
      : resolveRelationshipUpdate(schema, value, previous, context)
  if (schema.kind === 'array') {
    if (!Array.isArray(value))
      throw new Error(
        `The value of the array field at '${path.join('.')}' is invalid`,
      )
    const old = Array.isArray(previous) ? previous : []
    return Promise.all(
      value.map((entry, index) =>
        resolveStructureValue(
          schema.element,
          entry,
          old[index],
          operation,
          context,
          [...path, index],
        ),
      ),
    )
  }
  const input = assertRecord(value, `Invalid ${schema.kind} value`)
  if (schema.kind === 'object') {
    const old =
      previous && typeof previous === 'object' && !Array.isArray(previous)
        ? (previous as Record<string, unknown>)
        : {}
    return Object.fromEntries(
      await Promise.all(
        Object.entries(schema.fields).map(async ([key, child]) => [
          key,
          await resolveStructureValue(
            child,
            input[key],
            old[key],
            operation,
            context,
            [...path, key],
          ),
        ]),
      ),
    )
  }
  const keys = Object.keys(input)
  if (keys.length !== 1)
    throw new Error(
      `Conditional field inputs must set exactly one of the fields but the field at ${path.join('.')} has ${keys.length} fields set`,
    )
  const key = keys[0]
  const discriminant =
    (key === 'true' || key === 'false') && !schema.discriminant.validate(key)
      ? key === 'true'
      : key
  const old =
    previous && typeof previous === 'object' && !Array.isArray(previous)
      ? (previous as Record<string, unknown>)
      : undefined
  return {
    discriminant,
    value: await resolveStructureValue(
      schema.values[key] as StructureSchema,
      input[key],
      old?.discriminant === discriminant ? old.value : undefined,
      operation,
      context,
      [...path, 'value'],
    ),
  }
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function typeString(type: StructureGraphQLType) {
  return String(type.graphQLType)
}

function inputType(
  name: string,
  schema: StructureSchema,
  operation: 'create' | 'update',
  definitions: Map<string, string>,
): string {
  if (schema.kind === 'form') return typeString(schema.graphql.input)
  if (schema.kind === 'relationship') {
    const names = getGraphQLNames(schema.listKey)
    return schema.many
      ? operation === 'create'
        ? names.relateToManyForCreateInputName
        : names.relateToManyForUpdateInputName
      : operation === 'create'
        ? names.relateToOneForCreateInputName
        : names.relateToOneForUpdateInputName
  }
  if (schema.kind === 'array')
    return `[${inputType(name, schema.element, operation, definitions)}]`
  const inputName = `${name}${capitalize(operation)}Input`
  if (!definitions.has(inputName)) {
    definitions.set(inputName, '')
    const fields =
      schema.kind === 'object'
        ? Object.entries(schema.fields).map(
            ([key, child]) =>
              `${key}: ${inputType(`${name}${capitalize(key)}`, child, operation, definitions)}`,
          )
        : Object.entries(schema.values).map(
            ([key, child]) =>
              `${key}: ${inputType(`${name}${capitalize(key)}`, child, operation, definitions)}`,
          )
    definitions.set(
      inputName,
      `input ${inputName} {\n  ${fields.join('\n  ')}\n}`,
    )
  }
  return inputName
}

type StructureTypeBuild = {
  outputType: string
  createInputType: string
  updateInputType: string
  definitions: string[]
  resolvers: Record<string, Record<string, unknown>>
}

function outputType(
  name: string,
  schema: StructureSchema,
  definitions: Map<string, string>,
  resolvers: Record<string, Record<string, unknown>>,
): string {
  if (schema.kind === 'form') return typeString(schema.graphql.output.type)
  if (schema.kind === 'relationship')
    return schema.many ? `[${schema.listKey}]` : schema.listKey
  if (schema.kind === 'array')
    return `[${outputType(name, schema.element, definitions, resolvers)}]`
  if (schema.kind === 'conditional') {
    const interfaceName = name
    if (!definitions.has(interfaceName)) {
      definitions.set(interfaceName, '')
      const discriminantType = typeString(
        schema.discriminant.graphql.output.type,
      )
      definitions.set(
        interfaceName,
        `interface ${interfaceName} {\n  discriminant: ${discriminantType}\n}`,
      )
      resolvers[interfaceName] = {
        __resolveType(value: { discriminant?: unknown }) {
          return `${interfaceName}${capitalize(String(value.discriminant))}`
        },
      }
      // fields-document 9.1.1 records conditional concrete implementations as
      // unreferenced field metadata, but Core 6.5.1 does not install them in the
      // executable schema. Preserve that observable pinned behavior.
    }
    return interfaceName
  }
  const objectName = name
  if (!definitions.has(objectName)) {
    definitions.set(objectName, '')
    const fields = Object.entries(schema.fields).map(([key, child]) => {
      const childType = outputType(
        `${name}${capitalize(key)}`,
        child,
        definitions,
        resolvers,
      )
      return `${key}: ${childType}`
    })
    definitions.set(
      objectName,
      `type ${objectName} {\n  ${fields.join('\n  ')}\n}`,
    )
    resolvers[objectName] = Object.fromEntries(
      Object.entries(schema.fields).map(([key, child]) => [
        key,
        async (
          source: { value?: Record<string, unknown> },
          args: Record<string, unknown>,
          context: CmsContext,
          info: GraphQLResolveInfo,
        ) =>
          resolveStructureOutput(
            child,
            source.value?.[key],
            args,
            context,
            info,
          ),
      ]),
    )
  }
  return objectName
}

export function buildStructureGraphQLTypes(
  listKey: string,
  fieldPath: string,
  schema: StructureSchema,
): StructureTypeBuild {
  const name = `${listKey}${capitalize(fieldPath)}`
  const definitions = new Map<string, string>()
  const resolvers: Record<string, Record<string, unknown>> = {}
  const output = outputType(name, schema, definitions, resolvers)
  const createInput = inputType(name, schema, 'create', definitions)
  const updateInput = inputType(name, schema, 'update', definitions)
  const wrapper = `${name}Output`
  definitions.set(
    wrapper,
    `type ${wrapper} {\n  structure: ${output}\n  json(hydrateRelationships: Boolean! = false): JSON\n}`,
  )
  return {
    outputType: wrapper,
    createInputType: createInput,
    updateInputType: updateInput,
    definitions: [...definitions.values()].filter(Boolean),
    resolvers,
  }
}

async function resolveStructureOutput(
  schema: StructureSchema,
  value: unknown,
  args: Record<string, unknown>,
  context: CmsContext,
  info?: GraphQLResolveInfo,
): Promise<unknown> {
  if (schema.kind === 'form') {
    const resolver = schema.graphql.output.resolve as
      | ((
          source: { value: unknown },
          args: Record<string, unknown>,
          context: CmsContext,
          info: GraphQLResolveInfo,
        ) => unknown)
      | undefined
    return resolver
      ? resolver({ value }, args, context, info as GraphQLResolveInfo)
      : value
  }
  if (schema.kind === 'relationship') {
    if (schema.many) {
      const ids = Array.isArray(value)
        ? value.map((entry) => String((entry as { id?: unknown }).id))
        : []
      return context.db[schema.listKey].findMany({
        where: { id: { in: ids } },
      })
    }
    const id = (value as { id?: unknown } | null)?.id
    return id == null
      ? null
      : context.db[schema.listKey].findOne({ where: { id: String(id) } })
  }
  if (schema.kind === 'array')
    return Promise.all(
      (Array.isArray(value) ? value : []).map((entry) =>
        resolveStructureOutput(schema.element, entry, args, context, info),
      ),
    )
  if (schema.kind === 'conditional') return value
  return { value }
}

async function hydrateRelationship(
  schema: Extract<StructureSchema, { kind: 'relationship' }>,
  value: unknown,
  context: CmsContext,
) {
  const list = context.__internal.lists?.find(
    (entry) => entry.key === schema.listKey,
  )
  const labelField = list?.labelField ?? 'id'
  const query = [`__ksStructureLabel: ${labelField}`, schema.selection ?? '']
    .filter(Boolean)
    .join(' ')
  const hydrate = async (entry: unknown) => {
    const id = (entry as { id?: unknown } | null)?.id
    if (id == null) return null
    const item = (await context.query[schema.listKey].findOne({
      where: { id: String(id) },
      query,
    })) as Record<string, unknown> | null
    if (!item) return { id: String(id), label: undefined, data: undefined }
    const { __ksStructureLabel: label, ...data } = item
    return { id: String(id), label, data }
  }
  return schema.many
    ? Promise.all((Array.isArray(value) ? value : []).map(hydrate))
    : hydrate(value)
}

export async function hydrateStructureRelationships(
  schema: StructureSchema,
  value: unknown,
  context: CmsContext,
): Promise<unknown> {
  if (schema.kind === 'form') return value
  if (schema.kind === 'relationship')
    return hydrateRelationship(schema, value, context)
  if (schema.kind === 'array')
    return Promise.all(
      (Array.isArray(value) ? value : []).map((entry) =>
        hydrateStructureRelationships(schema.element, entry, context),
      ),
    )
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  if (schema.kind === 'conditional')
    return {
      discriminant: record.discriminant,
      value: await hydrateStructureRelationships(
        schema.values[String(record.discriminant)] as StructureSchema,
        record.value,
        context,
      ),
    }
  return Object.fromEntries(
    await Promise.all(
      Object.entries(schema.fields).map(async ([key, child]) => [
        key,
        await hydrateStructureRelationships(child, record[key], context),
      ]),
    ),
  )
}

export function structureResolverMap(
  listKey: string,
  fieldPath: string,
  schema: StructureSchema,
) {
  const built = buildStructureGraphQLTypes(listKey, fieldPath, schema)
  return {
    ...built.resolvers,
    [built.outputType]: {
      structure(
        source: { value?: unknown },
        args: Record<string, unknown>,
        context: CmsContext,
        info: GraphQLResolveInfo,
      ) {
        return resolveStructureOutput(schema, source.value, args, context, info)
      },
      json(
        source: { value?: unknown },
        args: { hydrateRelationships?: boolean },
        context: CmsContext,
      ) {
        return args.hydrateRelationships
          ? hydrateStructureRelationships(schema, source.value, context)
          : source.value
      },
    },
  }
}

export function structureFieldValue(item: CmsItem, fieldPath: string) {
  return { value: item[fieldPath] }
}
