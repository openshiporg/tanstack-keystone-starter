import { createHash } from 'node:crypto'

import { getFieldAccess, getOperationAccess } from './access'
import { getAdminMetaForContext } from './admin-meta'
import { cmsLists } from './registry'
import { createCmsContext, getCmsGraphQLSchema } from './runtime'
import type { CmsContext } from './runtime'
import type { CmsList, GraphQLNames } from './types'

const MCP_PROTOCOL_VERSION = '2024-11-05'
const MCP_AUDIT_LIMIT = 100
const MCP_MAX_BODY_BYTES = 64 * 1024
const MCP_MAX_RESPONSE_BYTES = 256 * 1024
const MCP_MAX_FIELDS = 32
const MCP_MAX_TAKE = 100

type JsonRpcId = string | number | null
type AuditOutcome = 'allowed' | 'denied' | 'failed'

export type McpAuditEvent = Readonly<{
  timestamp: string
  requestId: string
  tool: string
  operation?: string
  listKey?: string
  outcome: AuditOutcome
  errorCode?: string
}>

const auditEvents: McpAuditEvent[] = []

export function clearMcpAuditEvents() {
  auditEvents.length = 0
}

export function getMcpAuditEvents() {
  return auditEvents.map((event) => ({ ...event }))
}

function audit(
  request: Request,
  event: Omit<McpAuditEvent, 'timestamp' | 'requestId'>,
) {
  // Only metadata-derived names and fixed error codes are retained. Arguments,
  // credentials, cookies, input data, error messages, and returned data are not.
  const requestId = createHash('sha256')
    .update(request.headers.get('x-request-id') ?? crypto.randomUUID())
    .digest('hex')
    .slice(0, 16)
  auditEvents.push({
    timestamp: new Date().toISOString(),
    requestId,
    ...event,
  })
  if (auditEvents.length > MCP_AUDIT_LIMIT) {
    auditEvents.splice(0, auditEvents.length - MCP_AUDIT_LIMIT)
  }
}

function rpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: { code: string },
) {
  return {
    jsonrpc: '2.0' as const,
    id,
    error: { code, message, ...(data ? { data } : {}) },
  }
}

function toolResult(
  id: JsonRpcId,
  value: unknown,
  isError = false,
  encoded = JSON.stringify(value),
) {
  return {
    jsonrpc: '2.0' as const,
    id,
    result: {
      ...(isError ? { isError: true } : {}),
      content: [{ type: 'text' as const, text: encoded }],
      structuredContent: value,
    },
  }
}

function toolError(
  id: JsonRpcId,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return toolResult(
    id,
    { code, message, ...(details ? { details } : {}) },
    true,
  )
}

function auditedToolSuccess(
  request: Request,
  id: JsonRpcId,
  event: Omit<McpAuditEvent, 'timestamp' | 'requestId' | 'outcome'>,
  value: unknown,
) {
  const encoded = JSON.stringify(value)
  if (new TextEncoder().encode(encoded).byteLength > MCP_MAX_RESPONSE_BYTES) {
    audit(request, {
      ...event,
      outcome: 'failed',
      errorCode: 'MCP_RESPONSE_TOO_LARGE',
    })
    return toolError(
      id,
      'MCP_RESPONSE_TOO_LARGE',
      'Tool response exceeds the configured size limit',
    )
  }
  audit(request, { ...event, outcome: 'allowed' })
  return toolResult(id, value, false, encoded)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function listForOperation(
  operation: unknown,
  action: 'create' | 'update' | 'delete' | 'query',
): { list: CmsList; names: GraphQLNames; queryKind?: 'one' | 'many' } | null {
  if (typeof operation !== 'string') return null
  for (const list of cmsLists) {
    const names = list.graphql.names
    if (action === 'create' && operation === names.createMutationName)
      return { list, names }
    if (action === 'update' && operation === names.updateMutationName)
      return { list, names }
    if (action === 'delete' && operation === names.deleteMutationName)
      return { list, names }
    if (action === 'query' && operation === names.itemQueryName)
      return { list, names, queryKind: 'one' }
    if (action === 'query' && operation === names.listQueryName)
      return { list, names, queryKind: 'many' }
  }
  return null
}

function selectedFields(list: CmsList, fields: unknown) {
  const requested = fields === undefined ? ['id'] : fields
  if (
    !Array.isArray(requested) ||
    requested.length === 0 ||
    requested.length > MCP_MAX_FIELDS
  ) {
    throw new McpInputError(
      'MCP_INVALID_FIELD',
      `fields must contain between 1 and ${MCP_MAX_FIELDS} field names`,
    )
  }
  const readable = new Set(
    list.fields
      .filter((field) => field.graphql.isEnabled.read)
      .map((field) => field.path),
  )
  const unique: string[] = []
  for (const field of requested) {
    if (typeof field !== 'string' || !readable.has(field)) {
      throw new McpInputError(
        'MCP_INVALID_FIELD',
        'A selected field is not exposed by this list',
      )
    }
    if (!unique.includes(field)) unique.push(field)
  }
  return unique
}

class McpInputError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

class McpBodyTooLargeError extends Error {}

async function visibleMetadata(context: CmsContext) {
  const adminMeta = await getAdminMetaForContext(context)
  const adminByKey = new Map(adminMeta.lists.map((list) => [list.key, list]))
  const visible = []

  for (const list of cmsLists) {
    const adminList = adminByKey.get(list.key)
    if (
      !adminList ||
      adminList.hideNavigation ||
      !list.graphql.isEnabled.type ||
      !(await getOperationAccess(list.key, 'query', context))
    ) {
      continue
    }

    const operationAccess = {
      query: true,
      create:
        list.graphql.isEnabled.create &&
        !adminList.hideCreate &&
        (await getOperationAccess(list.key, 'create', context)),
      update:
        list.graphql.isEnabled.update &&
        (await getOperationAccess(list.key, 'update', context)),
      delete:
        list.graphql.isEnabled.delete &&
        !adminList.hideDelete &&
        (await getOperationAccess(list.key, 'delete', context)),
    }
    const adminFields = new Map(
      adminList.fields.map((field) => [field.path, field]),
    )
    const fields = []
    for (const field of list.fields) {
      const adminField = adminFields.get(field.path)
      if (
        field.graphql.isEnabled.read &&
        adminField &&
        adminField.itemView.fieldMode !== 'hidden' &&
        (await getFieldAccess(list.key, field.path, 'read', context))
      ) {
        fields.push(field)
      }
    }
    visible.push({ list, operationAccess, fields })
  }
  return visible
}

async function readBoundedBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) return ''
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MCP_MAX_BODY_BYTES) {
        await reader.cancel('MCP request body limit exceeded')
        throw new McpBodyTooLargeError()
      }
      text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
  } finally {
    reader.releaseLock()
  }
}

function tools() {
  return [
    {
      name: 'listModels',
      description:
        'List CMS models and their generated GraphQL operation names.',
      inputSchema: { type: 'object', additionalProperties: false },
    },
    {
      name: 'getFieldsForType',
      description: 'Inspect exposed fields for one CMS model.',
      inputSchema: {
        type: 'object',
        properties: { typeName: { type: 'string' } },
        required: ['typeName'],
        additionalProperties: false,
      },
    },
    {
      name: 'queryData',
      description:
        'Read one item or a bounded list through an allowlisted generated query.',
      inputSchema: {
        type: 'object',
        properties: {
          operation: { type: 'string' },
          where: { type: 'object' },
          fields: {
            type: 'array',
            items: { type: 'string' },
            maxItems: MCP_MAX_FIELDS,
          },
          take: { type: 'integer', minimum: 1, maximum: MCP_MAX_TAKE },
        },
        required: ['operation', 'fields'],
        additionalProperties: false,
      },
    },
    ...(['create', 'update', 'delete'] as const).map((action) => ({
      name: `${action}Data`,
      description: `${action} one CMS item through its generated GraphQL mutation. Requires confirmed: true as a protocol gate; this is not proof of human review.`,
      inputSchema: {
        type: 'object',
        properties: {
          operation: { type: 'string' },
          where: { type: 'object' },
          data: { type: 'object' },
          fields: {
            type: 'array',
            items: { type: 'string' },
            maxItems: MCP_MAX_FIELDS,
          },
          confirmed: { const: true },
        },
        required: [
          'operation',
          ...(action === 'create' ? ['data'] : ['where']),
          ...(action === 'update' ? ['data'] : []),
          'confirmed',
        ],
        additionalProperties: false,
      },
    })),
  ]
}

function graphqlErrorCode(error: unknown) {
  if (!isObject(error)) return 'MCP_OPERATION_FAILED'
  const extensions = isObject(error.extensions) ? error.extensions : undefined
  return typeof extensions?.code === 'string'
    ? extensions.code
    : 'MCP_OPERATION_FAILED'
}

async function authenticatedContext(request: Request) {
  // Build lazily from the runtime so importing the MCP boundary does not import
  // Yoga or an already-instantiated public schema in test/server module realms.
  const context = await createCmsContext(request, getCmsGraphQLSchema())
  return context.session ? context : null
}

async function executeRead(
  context: CmsContext,
  match: NonNullable<ReturnType<typeof listForOperation>>,
  args: Record<string, unknown>,
) {
  if (!match.list.graphql.isEnabled.query)
    throw new McpInputError(
      'MCP_INVALID_OPERATION',
      'Query operation is not exposed',
    )
  const fields = selectedFields(match.list, args.fields)
  const selection = fields.join(' ')
  if (match.queryKind === 'one') {
    if (!isObject(args.where))
      throw new McpInputError('MCP_INVALID_INPUT', 'where must be an object')
    const query = `query McpReadOne($where: ${match.names.whereUniqueInputName}!) { ${match.names.itemQueryName}(where: $where) { ${selection} } }`
    return context.graphql.run({ query, variables: { where: args.where } })
  }
  const take = args.take === undefined ? 25 : args.take
  if (
    !Number.isInteger(take) ||
    Number(take) < 1 ||
    Number(take) > MCP_MAX_TAKE
  )
    throw new McpInputError(
      'MCP_INVALID_INPUT',
      `take must be between 1 and ${MCP_MAX_TAKE}`,
    )
  if (args.where !== undefined && !isObject(args.where))
    throw new McpInputError('MCP_INVALID_INPUT', 'where must be an object')
  const query = `query McpReadMany($where: ${match.names.whereInputName}!, $take: Int!) { ${match.names.listQueryName}(where: $where, take: $take) { ${selection} } }`
  return context.graphql.run({
    query,
    variables: { where: args.where ?? {}, take },
  })
}

async function executeMutation(
  context: CmsContext,
  action: 'create' | 'update' | 'delete',
  match: NonNullable<ReturnType<typeof listForOperation>>,
  args: Record<string, unknown>,
) {
  if (!match.list.graphql.isEnabled[action])
    throw new McpInputError(
      'MCP_INVALID_OPERATION',
      'Mutation operation is not exposed',
    )
  const fields = selectedFields(match.list, args.fields)
  const selection = fields.join(' ')
  const variables: Record<string, unknown> = {}
  let query: string
  if (action === 'create') {
    if (!isObject(args.data))
      throw new McpInputError('MCP_INVALID_INPUT', 'data must be an object')
    variables.data = args.data
    query = `mutation McpCreate($data: ${match.names.createInputName}!) { ${match.names.createMutationName}(data: $data) { ${selection} } }`
  } else if (action === 'update') {
    if (!isObject(args.where) || !isObject(args.data))
      throw new McpInputError(
        'MCP_INVALID_INPUT',
        'where and data must be objects',
      )
    variables.where = args.where
    variables.data = args.data
    query = `mutation McpUpdate($where: ${match.names.whereUniqueInputName}!, $data: ${match.names.updateInputName}!) { ${match.names.updateMutationName}(where: $where, data: $data) { ${selection} } }`
  } else {
    if (!isObject(args.where))
      throw new McpInputError('MCP_INVALID_INPUT', 'where must be an object')
    variables.where = args.where
    query = `mutation McpDelete($where: ${match.names.whereUniqueInputName}!) { ${match.names.deleteMutationName}(where: $where) { ${selection} } }`
  }
  const result = await context.graphql.run({ query, variables })
  const data = result[match.names[`${action}MutationName`]]
  const id =
    isObject(data) &&
    (typeof data.id === 'string' || typeof data.id === 'number')
      ? data.id
      : undefined
  return { ...(id === undefined ? {} : { id }), data }
}

async function callTool(
  request: Request,
  id: JsonRpcId,
  params: Record<string, unknown>,
) {
  const name = params.name
  const args = isObject(params.arguments) ? params.arguments : {}
  if (typeof name !== 'string' || !tools().some((tool) => tool.name === name))
    return toolError(id, 'MCP_TOOL_NOT_FOUND', 'Unknown MCP tool')

  const context = await authenticatedContext(request)
  if (!context) {
    audit(request, {
      tool: name,
      outcome: 'denied',
      errorCode: 'MCP_AUTHENTICATION_REQUIRED',
    })
    return toolError(
      id,
      'MCP_AUTHENTICATION_REQUIRED',
      'Authentication is required',
    )
  }

  if (name === 'listModels') {
    const metadata = await visibleMetadata(context)
    const models = metadata.map(({ list, operationAccess }) => ({
      typeName: list.graphql.names.outputTypeName,
      listKey: list.key,
      description: list.description ?? '',
      operations: {
        ...(operationAccess.query
          ? {
              item: list.graphql.names.itemQueryName,
              list: list.graphql.names.listQueryName,
            }
          : {}),
        ...(operationAccess.create
          ? { create: list.graphql.names.createMutationName }
          : {}),
        ...(operationAccess.update
          ? { update: list.graphql.names.updateMutationName }
          : {}),
        ...(operationAccess.delete
          ? { delete: list.graphql.names.deleteMutationName }
          : {}),
      },
    }))
    return auditedToolSuccess(
      request,
      id,
      { tool: name, operation: 'inspect' },
      { models },
    )
  }

  if (name === 'getFieldsForType') {
    const metadata = await visibleMetadata(context)
    const entry = metadata.find(
      ({ list }) => list.graphql.names.outputTypeName === args.typeName,
    )
    if (!entry) {
      audit(request, {
        tool: name,
        operation: 'inspect',
        outcome: 'denied',
        errorCode: 'MCP_INVALID_OPERATION',
      })
      return toolError(id, 'MCP_INVALID_OPERATION', 'Type is not exposed')
    }
    const { list } = entry
    const fields = entry.fields.map((field) => ({
      name: field.path,
      kind: field.kind,
    }))
    return auditedToolSuccess(
      request,
      id,
      { tool: name, operation: 'inspect', listKey: list.key },
      { typeName: args.typeName, fields },
    )
  }

  const action =
    name === 'queryData'
      ? 'query'
      : name === 'createData'
        ? 'create'
        : name === 'updateData'
          ? 'update'
          : 'delete'
  const match = listForOperation(args.operation, action)
  if (!match) {
    audit(request, {
      tool: name,
      operation: action,
      outcome: 'denied',
      errorCode: 'MCP_INVALID_OPERATION',
    })
    return toolError(
      id,
      'MCP_INVALID_OPERATION',
      'Operation is not an allowlisted generated CMS operation',
    )
  }

  if (action !== 'query' && args.confirmed !== true) {
    audit(request, {
      tool: name,
      operation: action,
      listKey: match.list.key,
      outcome: 'denied',
      errorCode: 'MCP_CONFIRMATION_REQUIRED',
    })
    return toolError(
      id,
      'MCP_CONFIRMATION_REQUIRED',
      'Mutation confirmation is required',
    )
  }

  try {
    let data: unknown
    if (action === 'query') {
      const value = await executeRead(context, match, args)
      data = value[args.operation as string]
    } else {
      data = await executeMutation(context, action, match, args)
    }
    return auditedToolSuccess(
      request,
      id,
      { tool: name, operation: action, listKey: match.list.key },
      data,
    )
  } catch (error) {
    const inputError = error instanceof McpInputError
    const accessCode = graphqlErrorCode(error)
    const denied = accessCode === 'KS_ACCESS_DENIED'
    const code = inputError
      ? error.code
      : denied
        ? 'MCP_ACCESS_DENIED'
        : 'MCP_OPERATION_FAILED'
    audit(request, {
      tool: name,
      operation: action,
      listKey: match.list.key,
      outcome: inputError || denied ? 'denied' : 'failed',
      errorCode: code,
    })
    return toolError(
      id,
      code,
      inputError
        ? error.message
        : denied
          ? 'CMS access control denied the operation'
          : 'CMS operation failed',
    )
  }
}

function requestIsSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return false
  return request.headers.get('sec-fetch-site') !== 'cross-site'
}

export async function handleMcpRequest(request: Request, transport: string) {
  if (transport !== 'streamable-http') {
    return Response.json(
      rpcError(null, -32602, 'Unsupported transport', {
        code: 'MCP_UNSUPPORTED_TRANSPORT',
      }),
      { status: 404 },
    )
  }
  if (request.method !== 'POST')
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { allow: 'POST' },
    })
  if (!requestIsSameOrigin(request)) {
    audit(request, {
      tool: 'request',
      outcome: 'denied',
      errorCode: 'MCP_CROSS_ORIGIN_DENIED',
    })
    return Response.json(
      rpcError(null, -32600, 'Cross-origin request denied', {
        code: 'MCP_CROSS_ORIGIN_DENIED',
      }),
      { status: 403 },
    )
  }
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (declaredLength > MCP_MAX_BODY_BYTES) {
    audit(request, {
      tool: 'request',
      outcome: 'denied',
      errorCode: 'MCP_REQUEST_TOO_LARGE',
    })
    await request.body?.cancel('MCP request body limit exceeded')
    return Response.json(
      rpcError(null, -32600, 'Request body is too large', {
        code: 'MCP_REQUEST_TOO_LARGE',
      }),
      { status: 413 },
    )
  }

  let body: unknown
  try {
    body = JSON.parse(await readBoundedBody(request))
  } catch (error) {
    if (error instanceof McpBodyTooLargeError) {
      audit(request, {
        tool: 'request',
        outcome: 'denied',
        errorCode: 'MCP_REQUEST_TOO_LARGE',
      })
      return Response.json(
        rpcError(null, -32600, 'Request body is too large', {
          code: 'MCP_REQUEST_TOO_LARGE',
        }),
        { status: 413 },
      )
    }
    audit(request, {
      tool: 'request',
      outcome: 'failed',
      errorCode: 'MCP_PARSE_ERROR',
    })
    return Response.json(
      rpcError(null, -32700, 'Parse error', {
        code: 'MCP_PARSE_ERROR',
      }),
      { status: 400 },
    )
  }

  if (
    !isObject(body) ||
    body.jsonrpc !== '2.0' ||
    typeof body.method !== 'string'
  ) {
    return Response.json(
      rpcError(null, -32600, 'Invalid JSON-RPC request', {
        code: 'MCP_INVALID_REQUEST',
      }),
      { status: 400 },
    )
  }

  const hasId = Object.prototype.hasOwnProperty.call(body, 'id')
  if (
    hasId &&
    typeof body.id !== 'string' &&
    typeof body.id !== 'number' &&
    body.id !== null
  ) {
    return Response.json(
      rpcError(null, -32600, 'Invalid JSON-RPC request id', {
        code: 'MCP_INVALID_REQUEST',
      }),
      { status: 400 },
    )
  }

  if (body.method.startsWith('notifications/')) {
    if (hasId) {
      return Response.json(
        rpcError(
          body.id as JsonRpcId,
          -32600,
          'Notifications must not include an id',
          {
            code: 'MCP_INVALID_REQUEST',
          },
        ),
        { status: 400 },
      )
    }
    // JSON-RPC notifications never have a JSON-RPC response body. Streamable
    // HTTP acknowledges accepted notifications with an empty 202 response.
    return new Response(null, { status: 202 })
  }

  if (!hasId) {
    return Response.json(
      rpcError(null, -32600, 'JSON-RPC requests require an id', {
        code: 'MCP_INVALID_REQUEST',
      }),
      { status: 400 },
    )
  }
  const id = body.id as JsonRpcId
  if (body.method === 'initialize') {
    return Response.json({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'tanstack-keystone-cms', version: '1.0.0' },
      },
    })
  }
  if (body.method === 'tools/list') {
    const context = await authenticatedContext(request)
    if (!context) {
      audit(request, {
        tool: 'tools/list',
        outcome: 'denied',
        errorCode: 'MCP_AUTHENTICATION_REQUIRED',
      })
      return Response.json(
        rpcError(id, -32001, 'Authentication is required', {
          code: 'MCP_AUTHENTICATION_REQUIRED',
        }),
        { status: 401 },
      )
    }
    return Response.json({ jsonrpc: '2.0', id, result: { tools: tools() } })
  }
  if (body.method === 'tools/call') {
    if (!isObject(body.params))
      return Response.json(
        rpcError(id, -32602, 'Invalid tool parameters', {
          code: 'MCP_INVALID_PARAMS',
        }),
        { status: 400 },
      )
    return Response.json(await callTool(request, id, body.params))
  }
  return Response.json(
    rpcError(id, -32601, 'Method not found', {
      code: 'MCP_METHOD_NOT_FOUND',
    }),
    { status: 404 },
  )
}
