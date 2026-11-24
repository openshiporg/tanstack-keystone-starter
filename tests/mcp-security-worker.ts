import assert from 'node:assert/strict'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
  setCmsAdapterForTests,
} from '../src/features/cms/adapters'
import {
  clearMcpAuditEvents,
  getMcpAuditEvents,
  handleMcpRequest,
} from '../src/features/cms/mcp'
import {
  createCmsContext,
  getCmsGraphQLSchema,
} from '../src/features/cms/runtime'
import { handleMcpTransportRouteRequest } from '../src/routes/api/mcp-transport/$transport'

const endpoint = 'http://local.test/api/mcp-transport/streamable-http'
const schema = getCmsGraphQLSchema()

async function tokenFor(email: string) {
  const context = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { 'x-cms-anonymous': 'true' },
    }),
    schema,
  )
  const result = await context.graphql.run({
    query: `mutation Authenticate($email: String!, $password: String!) {
      authenticateUserWithPassword(email: $email, password: $password) {
        ... on UserAuthenticationWithPasswordSuccess { sessionToken }
      }
    }`,
    variables: { email, password: 'password' },
  })
  const token = (
    result.authenticateUserWithPassword as { sessionToken?: string }
  )?.sessionToken
  assert.ok(token, `authentication failed for ${email}`)
  return token
}

async function rpc(
  body: unknown,
  token?: string,
  headers?: Record<string, string>,
) {
  const response = await handleMcpRequest(
    new Request(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    'streamable-http',
  )
  return {
    status: response.status,
    body: (await response.json()) as Record<string, any>,
  }
}

async function tool(
  name: string,
  args: Record<string, unknown>,
  token?: string,
) {
  const response = await rpc(
    {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name, arguments: args },
    },
    token,
  )
  const text = response.body.result?.content?.[0]?.text
  return {
    ...response,
    payload: text ? (JSON.parse(text) as Record<string, any>) : undefined,
  }
}

setCmsAdapterForTests(memoryCmsAdapter)
resetMemoryAdapter()
clearMcpAuditEvents()

const anonymous = await tool('createData', {
  operation: 'createTodo',
  data: { label: 'do-not-store-this-secret' },
  confirmed: true,
})
assert.equal(anonymous.body.result?.isError, true)
assert.equal(anonymous.payload?.code, 'MCP_AUTHENTICATION_REQUIRED')

const admin = await tokenFor('ada@example.com')
const editor = await tokenFor('ed@example.com')

const unconfirmed = await tool(
  'deleteData',
  {
    operation: 'deleteTodo',
    where: { id: 'todo_launch' },
    confirmed: false,
  },
  admin,
)
assert.equal(unconfirmed.payload?.code, 'MCP_CONFIRMATION_REQUIRED')

const invalidOperation = await tool(
  'createData',
  {
    operation: 'mutation { createTodo(data: {}) { id } }',
    data: {},
    confirmed: true,
  },
  admin,
)
assert.equal(invalidOperation.payload?.code, 'MCP_INVALID_OPERATION')

const invalidField = await tool(
  'queryData',
  {
    operation: 'todos',
    fields: ['id', 'notARealField'],
  },
  admin,
)
assert.equal(invalidField.payload?.code, 'MCP_INVALID_FIELD')

const denied = await tool(
  'createData',
  {
    operation: 'createRole',
    data: { name: 'Denied role' },
    fields: ['id'],
    confirmed: true,
  },
  editor,
)
assert.equal(denied.payload?.code, 'MCP_ACCESS_DENIED')

const itemDenied = await tool(
  'updateData',
  {
    operation: 'updateTodo',
    where: { id: 'todo_launch' },
    data: { label: 'editor must not change another owner item' },
    fields: ['id'],
    confirmed: true,
  },
  editor,
)
assert.equal(itemDenied.payload?.code, 'MCP_ACCESS_DENIED')

const models = await tool('listModels', {}, admin)
assert.ok(Array.isArray(models.payload?.models))
assert.ok(
  models.payload?.models.some(
    (model: any) =>
      model.listKey === 'Todo' && model.operations.create === 'createTodo',
  ),
)

const editorModels = await tool('listModels', {}, editor)
const serializedEditorModels = JSON.stringify(editorModels.payload)
assert.match(serializedEditorModels, /Role/)
assert.doesNotMatch(serializedEditorModels, /createRole|updateRole|deleteRole/)
const editorUserFields = await tool(
  'getFieldsForType',
  { typeName: 'User' },
  editor,
)
assert.doesNotMatch(JSON.stringify(editorUserFields.payload), /password/)
const editorTodos = await tool(
  'queryData',
  { operation: 'todos', fields: ['id'], take: 25 },
  editor,
)
assert.deepEqual(editorTodos.payload, [{ id: 'todo_docs' }])

const fields = await tool('getFieldsForType', { typeName: 'Todo' }, admin)
assert.ok(fields.payload?.fields.some((field: any) => field.name === 'label'))

const created = await tool(
  'createData',
  {
    operation: 'createTodo',
    data: { label: 'MCP persistence proof' },
    fields: ['id', 'label'],
    confirmed: true,
  },
  admin,
)
assert.equal(created.body.result?.isError, undefined)
assert.equal(created.payload?.data?.label, 'MCP persistence proof')
assert.equal(created.payload?.id, created.payload?.data?.id)
const id = created.payload?.id
assert.equal(typeof id, 'string')

const updated = await tool(
  'updateData',
  {
    operation: 'updateTodo',
    where: { id },
    data: { label: 'MCP persisted update' },
    fields: ['id', 'label'],
    confirmed: true,
  },
  admin,
)
assert.deepEqual(updated.payload, {
  id,
  data: { id, label: 'MCP persisted update' },
})

const read = await tool(
  'queryData',
  {
    operation: 'todo',
    where: { id },
    fields: ['id', 'label'],
  },
  admin,
)
assert.deepEqual(read.payload, { id, label: 'MCP persisted update' })

const deleted = await tool(
  'deleteData',
  {
    operation: 'deleteTodo',
    where: { id },
    fields: ['id'],
    confirmed: true,
  },
  admin,
)
assert.deepEqual(deleted.payload, { id, data: { id } })

const missing = await tool(
  'queryData',
  {
    operation: 'todo',
    where: { id },
    fields: ['id'],
  },
  admin,
)
assert.equal(missing.payload, null)

const initialize = await rpc({
  jsonrpc: '2.0',
  id: 'initialize-id',
  method: 'initialize',
})
assert.equal(initialize.body.id, 'initialize-id')
assert.equal(initialize.body.result?.protocolVersion, '2024-11-05')

const initializedNotification = await handleMcpTransportRouteRequest(
  new Request(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }),
  }),
  'streamable-http',
)
assert.equal(initializedNotification.status, 202)
assert.equal(await initializedNotification.text(), '')

const anonymousTools = await rpc({
  jsonrpc: '2.0',
  id: 8,
  method: 'tools/list',
})
assert.equal(anonymousTools.status, 401)
assert.equal(anonymousTools.body.error?.code, -32001)

const unsupportedTransport = await handleMcpTransportRouteRequest(
  new Request(endpoint, {
    method: 'POST',
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
  }),
  'sse',
)
assert.equal(unsupportedTransport.status, 404)
const unsupportedBody = (await unsupportedTransport.json()) as Record<
  string,
  any
>
assert.equal(unsupportedBody.error?.data?.code, 'MCP_UNSUPPORTED_TRANSPORT')

const wrongMethod = await handleMcpTransportRouteRequest(
  new Request(endpoint, { method: 'GET' }),
  'streamable-http',
)
assert.equal(wrongMethod.status, 405)
assert.equal(wrongMethod.headers.get('allow'), 'POST')

const missingRequestId = await rpc({
  jsonrpc: '2.0',
  method: 'tools/list',
})
assert.equal(missingRequestId.status, 400)
assert.equal(missingRequestId.body.id, null)
assert.equal(missingRequestId.body.error?.code, -32600)
const invalidRequestId = await rpc({
  jsonrpc: '2.0',
  id: { unsafe: true },
  method: 'tools/list',
})
assert.equal(invalidRequestId.status, 400)
assert.equal(invalidRequestId.body.id, null)
assert.equal(invalidRequestId.body.error?.code, -32600)
const initializedWithId = await rpc({
  jsonrpc: '2.0',
  id: 12,
  method: 'notifications/initialized',
})
assert.equal(initializedWithId.status, 400)
assert.equal(initializedWithId.body.error?.code, -32600)
const unknownMethod = await rpc({
  jsonrpc: '2.0',
  id: 11,
  method: 'not/a/method',
})
assert.equal(unknownMethod.body.error?.code, -32601)

const malformed = await rpc('{not json')
assert.equal(malformed.status, 400)
assert.equal(malformed.body.error?.code, -32700)
assert.equal(malformed.body.error?.data?.code, 'MCP_PARSE_ERROR')

const crossOrigin = await rpc(
  { jsonrpc: '2.0', id: 9, method: 'tools/list' },
  admin,
  {
    origin: 'https://attacker.example',
  },
)
assert.equal(crossOrigin.status, 403)
assert.equal(crossOrigin.body.error?.data?.code, 'MCP_CROSS_ORIGIN_DENIED')

let oversizedStreamCancelled = false
let oversizedChunks = 0
const oversizedMarker = 'chunked-sensitive-payload'
const oversizedStream = new ReadableStream<Uint8Array>({
  pull(controller) {
    oversizedChunks += 1
    controller.enqueue(
      new TextEncoder().encode(
        `${oversizedMarker}:${oversizedChunks}:`.padEnd(10 * 1024, 'x'),
      ),
    )
    if (oversizedChunks === 8) controller.close()
  },
  cancel() {
    oversizedStreamCancelled = true
  },
})
const oversizedResponse = await handleMcpRequest(
  new Request(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: oversizedStream,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' }),
  'streamable-http',
)
assert.equal(oversizedResponse.status, 413)
assert.equal(oversizedStreamCancelled, true)
assert.ok(oversizedChunks < 8)
const oversizedAudit = getMcpAuditEvents().at(-1)
assert.equal(oversizedAudit?.errorCode, 'MCP_REQUEST_TOO_LARGE')
assert.doesNotMatch(JSON.stringify(oversizedAudit), /chunked-sensitive-payload/)

const largeItemIds: string[] = []
for (let index = 0; index < 5; index += 1) {
  const largeCreated = await tool(
    'createData',
    {
      operation: 'createTodo',
      data: { label: `bounded-${index}-${'z'.repeat(58 * 1024)}` },
      fields: ['id'],
      confirmed: true,
    },
    admin,
  )
  assert.equal(typeof largeCreated.payload?.id, 'string')
  largeItemIds.push(largeCreated.payload!.id)
}
const oversizedToolResponse = await tool(
  'queryData',
  { operation: 'todos', fields: ['id', 'label'], take: 25 },
  admin,
)
assert.equal(oversizedToolResponse.payload?.code, 'MCP_RESPONSE_TOO_LARGE')
assert.equal(getMcpAuditEvents().at(-1)?.errorCode, 'MCP_RESPONSE_TOO_LARGE')
for (const largeItemId of largeItemIds) {
  const cleanup = await tool(
    'deleteData',
    {
      operation: 'deleteTodo',
      where: { id: largeItemId },
      fields: ['id'],
      confirmed: true,
    },
    admin,
  )
  assert.equal(cleanup.payload?.id, largeItemId)
}
assert.equal(JSON.stringify(getMcpAuditEvents()).includes(admin), false)
assert.equal(JSON.stringify(getMcpAuditEvents()).includes(editor), false)

for (let index = 0; index < 105; index += 1) {
  await tool(
    'createData',
    {
      operation: `notAllowed${index}`,
      data: { password: `secret-${index}` },
      confirmed: true,
    },
    admin,
  )
}
const audit = getMcpAuditEvents()
assert.equal(audit.length, 100)
const serializedAudit = JSON.stringify(audit)
assert.doesNotMatch(
  serializedAudit,
  /do-not-store|secret-|password|MCP persistence proof/,
)
assert.ok(
  audit.every((event) =>
    Object.keys(event).every((key) =>
      [
        'timestamp',
        'requestId',
        'tool',
        'operation',
        'listKey',
        'outcome',
        'errorCode',
      ].includes(key),
    ),
  ),
)

console.log(
  JSON.stringify({
    ok: true,
    persistence: { created: id, updated: true, deleted: true },
    security: {
      anonymous: 'denied',
      accessDenied: 'denied',
      itemAccessDenied: 'denied',
      listAccessFiltered: 'enforced',
      unconfirmed: 'denied',
      invalidOperation: 'denied',
      invalidField: 'denied',
      malformedJsonRpc: 'denied',
      crossOrigin: 'denied',
      metadataNonDisclosure: 'enforced',
      chunkedOversize: 'cancelled',
      oversizedResponse: 'denied',
      jsonRpcRouteSemantics: 'enforced',
      credentialLeakage: 'absent',
      auditEvents: audit.length,
      auditRedacted: true,
    },
  }),
)
