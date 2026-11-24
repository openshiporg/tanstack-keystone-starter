export const GAP01_SHAPES = Object.freeze([
  Object.freeze({
    id: 'staff-inventory',
    auth: Object.freeze({
      listKey: 'Staff',
      identityField: 'loginName',
      secretField: 'passphrase',
      displayField: 'displayName',
      initFields: Object.freeze(['displayName', 'loginName', 'passphrase']),
    }),
    creatableLists: Object.freeze(['Inventory', 'Memo']),
    deniedList: 'PrivateInventory',
  }),
  Object.freeze({
    id: 'operator-article',
    auth: Object.freeze({
      listKey: 'Operator',
      identityField: 'handle',
      secretField: 'pin',
      displayField: 'fullName',
      initFields: Object.freeze(['fullName', 'handle', 'pin']),
    }),
    creatableLists: Object.freeze(['Article', 'QueueItem']),
    deniedList: 'PrivateArticle',
  }),
])

export const GAP01_USER_REPRO_INTAKE = Object.freeze({
  status: 'not-reproduced',
  classification: 'environmental-blocker',
  requiredInputs: Object.freeze([
    'exact user-specific fixture/configuration',
    'failing browser/build command and commit',
    'database/runtime URL or disposable dump',
    'Firefox/OS/provider versions and captured request evidence',
  ]),
  probe: 'GAP01_USER_REPRO_PROBE=1',
  rule: 'Never infer or claim reproduction without all required inputs and a matching failing trace.',
})

export const GAP01_ID_PROVENANCE = Object.freeze({
  memory: Object.freeze({
    classification: 'synthetic',
    claim: 'This gate does not claim memory IDs are realistic production IDs.',
  }),
  prisma: Object.freeze({
    classification: 'external-checkpoint-017',
    evidenceHash:
      '418884314c5dff970a8fc5c2ed10f175fd411669fbc7c8a7fe2118e6f3e94e4d',
    claim:
      'Checkpoint-017 Prisma/CUID evidence is external combined evidence, not produced by this memory gate.',
  }),
})

export const GAP01_CHECKPOINT017_CUID_EVIDENCE = Object.freeze({
  files: Object.freeze([
    'scripts/validate-dashboard-browser-prisma.mjs',
    'scripts/validate-dashboard-browser.mjs',
    'src/components/dashboard/page-breadcrumbs.tsx',
    'src/components/ui/alert-dialog.tsx',
    'src/components/ui/sheet.tsx',
    'src/components/ui/sidebar.tsx',
    'src/routes/dashboard/$listKey.$id.tsx',
    'vite.config.ts',
  ]),
  sha256: '418884314c5dff970a8fc5c2ed10f175fd411669fbc7c8a7fe2118e6f3e94e4d',
  classification: 'external-accepted-checkpoint-017-prisma-cuid-evidence',
  claim:
    'This evidence is accepted externally and is not produced by the GAP-01 memory gate.',
})

export function expectedCreatableListKeys(shape) {
  return [...shape.creatableLists].sort()
}

export function gap01RequestExpression(request) {
  const encoded = Buffer.from(JSON.stringify(request), 'utf8').toString(
    'base64',
  )
  return `JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(${JSON.stringify(encoded)}), (character) => character.charCodeAt(0))))`
}

export function validateUserReproInputs(input) {
  const required = ['fixture', 'command', 'runtime', 'versions', 'evidence']
  const missing = required.filter((key) => !input?.[key]?.trim())
  if (missing.length > 0)
    return { ok: false, reason: 'missing-inputs', missing }
  let argv
  try {
    argv = JSON.parse(input.command)
  } catch {
    return { ok: false, reason: 'invalid-json-argv' }
  }
  if (
    !Array.isArray(argv) ||
    argv.length === 0 ||
    argv.some((value) => typeof value !== 'string' || value.length === 0)
  )
    return { ok: false, reason: 'invalid-json-argv' }
  return { ok: true, argv }
}

export function validateUserReproPaths({ fixtureIsDirectory, evidenceIsFile }) {
  return fixtureIsDirectory && evidenceIsFile
    ? { ok: true }
    : { ok: false, reason: 'invalid-paths' }
}

export function validateUserReproEvidence({ report, evidence }) {
  if (report?.timedOut) return { status: 'blocked', reason: 'probe-timed-out' }
  if (report?.captureOverflow)
    return { status: 'blocked', reason: 'captured-output-overflow' }
  if (report?.terminationPending)
    return { status: 'blocked', reason: 'probe-process-group-not-quiescent' }
  if (!report || (report.exitCode === 0 && !report.signal))
    return { status: 'blocked', reason: 'probe-did-not-fail' }
  if (
    !evidence ||
    typeof evidence.traceToken !== 'string' ||
    evidence.traceToken.length === 0
  )
    return { status: 'blocked', reason: 'missing-machine-readable-trace-token' }
  const captured = `${report.stdout ?? ''}\n${report.stderr ?? ''}`
  if (!captured.includes(evidence.traceToken))
    return {
      status: 'blocked',
      reason: 'captured-trace-does-not-match-evidence',
    }
  if (
    evidence.classification &&
    !captured.includes(String(evidence.classification))
  )
    return {
      status: 'blocked',
      reason: 'captured-classification-does-not-match-evidence',
    }
  return {
    status: 'reproduced',
    classification: evidence.classification ?? 'user-specific-failure',
    traceToken: evidence.traceToken,
  }
}

function hasOperation(request, expectedOperation) {
  if (
    !request ||
    typeof request.query !== 'string' ||
    !request.variables ||
    typeof request.variables !== 'object' ||
    Array.isArray(request.variables) ||
    !request.variables.data ||
    typeof request.variables.data !== 'object' ||
    Array.isArray(request.variables.data) ||
    Object.keys(request.variables.data).length === 0
  )
    return false
  const escaped = expectedOperation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const operationMatches = new RegExp(
    `(?:query|mutation|subscription)\\s+${escaped}(?:\\s|\\()`,
  ).test(request.query)
  const dataIsBound =
    /\$data\s*:\s*[_A-Za-z][_0-9A-Za-z]*CreateInput!?/.test(request.query) &&
    /\bdata\s*:\s*\$data\b/.test(request.query)
  return operationMatches && dataIsBound
}

function errorCode(body) {
  const firstError = body?.errors?.[0]
  return firstError?.extensions?.code ?? firstError?.extensions?.classification
}

export function classifyGraphqlEvidence(evidence, expected = {}) {
  const expectedOperation = expected.operation
  const expectedRouteId = expected.routeId
  if (typeof expectedOperation !== 'string' || expectedOperation.trim() === '')
    return {
      classification: 'transport/harness',
      reason: 'invalid-expected-operation',
    }
  if (evidence?.harnessError)
    return {
      classification: 'transport/harness',
      reason: String(evidence.harnessError),
    }
  if (evidence?.networkError)
    return { classification: 'network', reason: String(evidence.networkError) }
  if (!evidence || evidence.operation !== expectedOperation)
    return {
      classification: 'transport/harness',
      reason: 'missing-or-wrong-operation',
    }
  if (!hasOperation(evidence.request, expectedOperation))
    return {
      classification: 'transport/harness',
      reason: 'missing-exact-request-data',
    }
  const response = evidence.response
  if (!response || typeof response !== 'object')
    return { classification: 'network', reason: 'missing-response' }
  if (!Number.isInteger(response.status))
    return {
      classification: 'transport/harness',
      reason: 'missing-http-status',
    }
  if (response.status >= 500)
    return { classification: 'server', reason: `status-${response.status}` }
  if (response.status === 401 || response.status === 403)
    return {
      classification: 'access-denied',
      reason: `status-${response.status}`,
    }
  if (response.status < 200 || response.status >= 300)
    return { classification: 'http', reason: `status-${response.status}` }
  const body = response.body
  if (!body || typeof body !== 'object')
    return { classification: 'server', reason: 'missing-response-body' }
  const code = errorCode(body)
  if (
    code === 'FORBIDDEN' ||
    code === 'UNAUTHENTICATED' ||
    code === 'ACCESS_DENIED' ||
    code === 'KS_ACCESS_DENIED'
  )
    return { classification: 'access-denied', reason: code }
  if (
    code === 'GRAPHQL_VALIDATION_FAILED' ||
    code === 'GRAPHQL_PARSE_FAILED' ||
    code === 'KS_VALIDATION_FAILURE' ||
    code === 'BAD_USER_INPUT'
  )
    return { classification: 'graphql-validation', reason: code }
  if (code === 'INTERNAL_SERVER_ERROR')
    return { classification: 'server', reason: code }
  if (Array.isArray(body.errors) && body.errors.length > 0)
    return { classification: 'server', reason: code ?? 'graphql-error' }
  const returnedId = expected.idPath?.reduce(
    (value, key) => value?.[key],
    body.data,
  )
  const idIsValid =
    (typeof returnedId === 'string' || typeof returnedId === 'number') &&
    String(returnedId).length > 0 &&
    expectedRouteId !== undefined &&
    String(returnedId) === String(expectedRouteId)
  if (!idIsValid)
    return { classification: 'transport/harness', reason: 'id-route-mismatch' }
  return { classification: 'success', returnedId, operation: expectedOperation }
}
