import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

import {
  processGroupExists,
  terminateChildGroup,
} from './lib/bounded-child.mjs'

export const GAP08_ACCEPTED_SIX = Object.freeze({
  files: Object.freeze([
    'reports/gap-08-relationship-matrix-plan.md',
    'scripts/fixtures/gap08-cms.config.ts',
    'scripts/gap08-relationship-contract.d.mts',
    'scripts/gap08-relationship-contract.mjs',
    'scripts/validate-gap08-relationship-metadata.ts',
    'tests/gap08-relationship-matrix.test.ts',
  ]),
  sha256: '55f0b916771efaf82b4de885615c98328d29e2574e5c9dac0e6ad8b81ad92e2c',
})

export const GAP08_CLEANUP_STEPS = Object.freeze([
  'terminate-process-groups',
  'close-database-clients',
  'terminate-exact-database-sessions',
  'drop-and-verify-exact-database',
  'remove-and-verify-profile',
  'remove-and-verify-fixture-root',
  'restore-postgresql-container-state',
  'verify-no-process-database-path-or-cache-marker-residue',
  'verify-source-output-and-cache-fingerprints',
  'verify-accepted-and-frozen-hashes',
])

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export async function hashFileManifest(root, files) {
  const hash = createHash('sha256')
  for (const file of [...files].sort()) {
    hash.update(file)
    hash.update('\0')
    hash.update(await readFile(path.join(root, file)))
    hash.update('\0')
  }
  return hash.digest('hex')
}

export function boundedDiagnostic(value, maximumBytes = 16 * 1024) {
  assert.ok(Number.isSafeInteger(maximumBytes) && maximumBytes > 0)
  const bytes = Buffer.from(String(value), 'utf8')
  return bytes
    .subarray(Math.max(0, bytes.length - maximumBytes))
    .toString('utf8')
}

export function captureError(error) {
  if (error instanceof AggregateError)
    return {
      name: error.name,
      message: boundedDiagnostic(error.message),
      errors: error.errors.map(captureError),
      stack: boundedDiagnostic(error.stack ?? ''),
    }
  if (error instanceof Error)
    return {
      name: error.name,
      message: boundedDiagnostic(error.message),
      stack: boundedDiagnostic(error.stack ?? ''),
      ...(error.cause ? { cause: captureError(error.cause) } : {}),
    }
  return { name: 'NonError', message: boundedDiagnostic(String(error)) }
}

export function assertExternalReportPath(disposableRoot, reportPath) {
  const root = path.resolve(disposableRoot)
  const report = path.resolve(reportPath)
  const relative = path.relative(root, report)
  assert.ok(
    relative.startsWith('..') && !path.isAbsolute(relative),
    `GAP-08 RED/PASS report must be outside disposable root: ${report}`,
  )
  return report
}

export function assertGeneratedExecutionPlan({
  matrix,
  scenarios,
  adminMetaSha256,
  prismaSchemaSha256,
}) {
  assert.ok(Array.isArray(matrix), 'generated relationship matrix is required')
  assert.ok(Array.isArray(scenarios), 'generated scenario plan is required')
  assert.equal(matrix.length, 6, 'generated matrix must contain 6 endpoints')
  assert.equal(scenarios.length, 76, 'generated plan must contain 76 scenarios')
  assert.match(adminMetaSha256, /^[a-f0-9]{64}$/)
  assert.match(prismaSchemaSha256, /^[a-f0-9]{64}$/)
  const endpointIds = new Set(matrix.map((entry) => entry.id))
  assert.equal(endpointIds.size, 6, 'generated endpoint IDs must be unique')
  const scenarioIds = new Set()
  for (const scenario of scenarios) {
    assert.ok(
      endpointIds.has(scenario.endpointId),
      `${scenario.id} does not reference a generated endpoint`,
    )
    assert.ok(
      !scenarioIds.has(scenario.id),
      `duplicate scenario ${scenario.id}`,
    )
    scenarioIds.add(scenario.id)
  }
  return Object.freeze({
    provenance: 'generated-adminmeta-plus-prisma-schema',
    adminMetaSha256,
    prismaSchemaSha256,
    endpointCount: matrix.length,
    scenarioCount: scenarios.length,
    endpointIds: Object.freeze([...endpointIds].sort()),
    scenarioIds: Object.freeze([...scenarioIds]),
    matrix,
    scenarios,
  })
}

export function assertSnapshotDelta(
  before,
  after,
  expected,
  { requireUnchangedState = false } = {},
) {
  for (const [key, deltaKey] of [
    ['parentCount', 'parentDelta'],
    ['relatedCount', 'relatedDelta'],
    ['edgeCount', 'edgeDelta'],
  ]) {
    assert.equal(
      after[key] - before[key],
      expected[deltaKey],
      `${key} exact delta mismatch`,
    )
  }
  if (requireUnchangedState) {
    assert.equal(
      after.sentinelHash,
      before.sentinelHash,
      'sentinel state changed',
    )
    assert.equal(after.scalarHash, before.scalarHash, 'scalar state changed')
    if (
      expected.parentDelta === 0 &&
      expected.relatedDelta === 0 &&
      expected.edgeDelta === 0
    )
      assert.equal(
        after.storageHash,
        before.storageHash,
        'storage state changed',
      )
  }
  return true
}

export function physicalJoinCatalogContract(physicalJoinTable) {
  assert.equal(physicalJoinTable.requiredCatalogForeignKeys, 2)
  assert.deepEqual(physicalJoinTable.requiredUniqueColumns, ['A', 'B'])
  assert.deepEqual(
    physicalJoinTable.columns.map((column) => column.name).sort(),
    ['A', 'B'],
  )
  return {
    tableName: physicalJoinTable.tableName,
    expectedColumns: ['A', 'B'],
    expectedForeignKeys: physicalJoinTable.columns.map((column) => ({
      column: column.name,
      referencesTableName: column.referencesTableName,
      referencesColumnName: column.referencesColumnName,
    })),
    catalogQueries: [
      `SELECT a.attname FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid WHERE c.relname = $1 AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attname`,
      `SELECT con.conname, src.attname AS source_column, target.relname AS target_table, dst.attname AS target_column FROM pg_constraint con JOIN pg_class source ON source.oid = con.conrelid JOIN pg_class target ON target.oid = con.confrelid JOIN LATERAL unnest(con.conkey, con.confkey) pair(srcnum, dstnum) ON true JOIN pg_attribute src ON src.attrelid = source.oid AND src.attnum = pair.srcnum JOIN pg_attribute dst ON dst.attrelid = target.oid AND dst.attnum = pair.dstnum WHERE con.contype = 'f' AND source.relname = $1 ORDER BY src.attname`,
      `SELECT i.relname, array_agg(a.attname ORDER BY key.ordinality) FROM pg_index x JOIN pg_class t ON t.oid = x.indrelid JOIN pg_class i ON i.oid = x.indexrelid JOIN LATERAL unnest(x.indkey) WITH ORDINALITY key(attnum, ordinality) ON true JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = key.attnum WHERE t.relname = $1 AND x.indisunique GROUP BY i.relname`,
    ],
  }
}

export class Gap08RunLedger {
  constructor(runId) {
    assert.ok(runId)
    this.runId = runId
    this.startedAt = new Date().toISOString()
    this.phases = []
    this.failures = []
    this.gateCompleted = false
    this.cleanupCompleted = false
    this.postCleanupVerified = false
    this.finalized = false
  }

  assertMutable() {
    assert.equal(this.finalized, false, 'GAP-08 ledger is already finalized')
  }

  recordPhase(phase, details = {}) {
    this.assertMutable()
    this.phases.push({ phase, details, at: new Date().toISOString() })
  }

  recordFailure(error) {
    this.assertMutable()
    this.failures.push(captureError(error))
  }

  markGateCompleted(details) {
    this.assertMutable()
    assert.equal(details?.scenarioCount, 76)
    this.gateCompleted = true
    this.recordPhase('gate-completed', details)
  }

  markCleanupCompleted(steps) {
    this.assertMutable()
    assert.deepEqual(
      [...steps],
      [...GAP08_CLEANUP_STEPS],
      'cleanup steps must be exact and ordered',
    )
    this.cleanupCompleted = true
    this.recordPhase('cleanup-completed', { steps: [...steps] })
  }

  markPostCleanupVerified(details) {
    this.assertMutable()
    assert.equal(
      details?.sourceRestored,
      true,
      'post-cleanup source restoration must be verified',
    )
    this.postCleanupVerified = true
    this.recordPhase('post-cleanup-verified', details)
  }

  finalize() {
    this.assertMutable()
    if (this.failures.length === 0 && !this.gateCompleted)
      throw new Error('Cannot finalize PASS before gate completion')
    if (!this.postCleanupVerified)
      throw new Error('Cannot finalize before post-cleanup verification')
    if (!this.cleanupCompleted)
      throw new Error('Cannot finalize before exact cleanup completion')
    this.finalized = true
    return {
      runId: this.runId,
      status: this.failures.length > 0 ? 'RED' : 'PASS',
      startedAt: this.startedAt,
      finalizedAt: new Date().toISOString(),
      phases: this.phases,
      failures: this.failures,
    }
  }
}

export async function fingerprintPath(target) {
  const hash = createHash('sha256')
  async function visit(current, relative = '') {
    let info
    try {
      info = await lstat(current)
    } catch (error) {
      if (error?.code === 'ENOENT') {
        hash.update(`absent:${relative}`)
        return
      }
      throw error
    }
    if (info.isSymbolicLink()) {
      hash.update(`link:${relative}:${await readlink(current)}`)
      return
    }
    if (info.isDirectory()) {
      hash.update(`directory:${relative}\0`)
      const entries = await readdir(current, { withFileTypes: true })
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name)))
        await visit(
          path.join(current, entry.name),
          path.join(relative, entry.name),
        )
      return
    }
    hash.update(`file:${relative}:${info.mode}:${info.size}\0`)
    hash.update(await readFile(current))
  }
  await visit(path.resolve(target))
  return hash.digest('hex')
}

export async function writeJsonAtomic(target, value) {
  await mkdir(path.dirname(target), { recursive: true })
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  })
  await rename(temporary, target)
}

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

export async function waitFor(check, description, timeout = 30_000) {
  assert.ok(Number.isSafeInteger(timeout) && timeout > 0)
  const deadline = Date.now() + timeout
  let lastError
  while (Date.now() < deadline) {
    try {
      const value = await check()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await sleep(50)
  }
  throw new Error(`Timed out waiting for ${description}`, { cause: lastError })
}

function childClose(child) {
  if (child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode })
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => resolve({ code, signal }))
  })
}

export class Gap08ChildError extends Error {
  constructor(message, result, cause) {
    super(message, { cause })
    this.name = 'Gap08ChildError'
    this.result = result
  }
}

export async function runGap08BoundedChild(
  command,
  args,
  {
    label,
    timeout,
    cwd,
    env = process.env,
    maxCapturedBytes = 256 * 1024,
    termGrace = 1_000,
  },
) {
  assert.ok(label && Number.isSafeInteger(timeout) && timeout > 0)
  const child = spawn(command, args, {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const stdout = []
  const stderr = []
  let bytes = 0
  let overflow = false
  const capture = (target, chunk) => {
    const remaining = Math.max(0, maxCapturedBytes - bytes)
    if (chunk.length > remaining) overflow = true
    if (remaining > 0) target.push(chunk.subarray(0, remaining))
    bytes += Math.min(chunk.length, remaining)
  }
  child.stdout.on('data', (chunk) => capture(stdout, chunk))
  child.stderr.on('data', (chunk) => capture(stderr, chunk))
  const closed = childClose(child)
  let timer
  const outcome = await Promise.race([
    closed.then((result) => ({ type: 'closed', result })),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve({ type: 'timeout' }), timeout)
    }),
  ])
  clearTimeout(timer)
  if (outcome.type === 'timeout') {
    await terminateChildGroup(child, label, { termGrace })
    throw new Gap08ChildError(`Timed out running ${label}`, {
      timedOut: true,
      stdout: boundedDiagnostic(Buffer.concat(stdout)),
      stderr: boundedDiagnostic(Buffer.concat(stderr)),
    })
  }
  const result = {
    exitCode: outcome.result.code,
    signal: outcome.result.signal,
    captureOverflow: overflow,
    stdout: Buffer.concat(stdout).toString('utf8'),
    stderr: Buffer.concat(stderr).toString('utf8'),
  }
  if (child.pid && processGroupExists(child.pid))
    await terminateChildGroup(child, `${label} residual process group`, {
      termGrace,
    })
  if (outcome.result.code !== 0 || overflow)
    throw new Gap08ChildError(
      overflow
        ? `${label} exceeded bounded diagnostic output`
        : `${label} failed with code ${outcome.result.code} signal ${outcome.result.signal}`,
      result,
    )
  return result
}

export async function removeAndVerifyAbsent(target) {
  await rm(target, { recursive: true, force: true })
  try {
    await lstat(target)
  } catch (error) {
    if (error?.code === 'ENOENT') return
    throw error
  }
  throw new Error(`Expected cleanup path to be absent: ${target}`)
}
