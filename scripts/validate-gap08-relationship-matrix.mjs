import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {
  assertGeneratedExecutionPlan,
  assertExternalReportPath,
  fingerprintPath,
  GAP08_ACCEPTED_SIX,
  GAP08_CLEANUP_STEPS,
  Gap08RunLedger,
  hashFileManifest,
  runGap08BoundedChild,
  sha256,
  writeJsonAtomic,
} from './gap08-heavy-lifecycle.mjs'
import {
  assertGap08MatrixCoverage,
  deriveGap08RelationshipMatrix,
  gap08ScenarioPlan,
} from './gap08-relationship-contract.mjs'

assert.equal(
  process.env.GAP08_HEAVY_CLEARANCE,
  '1',
  'GAP08_HEAVY_CLEARANCE=1 is required for the disposable PostgreSQL/browser matrix',
)

const sourceRoot = path.resolve('.')
const container =
  process.env.PARITY_POSTGRES_CONTAINER ?? 'vibe-runtime-postgres'
const postgresPort = process.env.PARITY_POSTGRES_PORT ?? '5432'
const runId = `gap08-${process.pid}-${Date.now()}`
const databaseName = `tks_gap08_${process.pid}_${Date.now()}`
const reportsRoot = path.join(sourceRoot, 'reports')
const reportPath = path.join(
  reportsRoot,
  'gap-08-relationship-matrix-runtime.json',
)
const workerReportPath = path.join(reportsRoot, 'gap-08-runtime-worker.json')
const browserReportPath = path.join(reportsRoot, 'gap-08-browser-worker.json')
const planReportPath = path.join(reportsRoot, 'gap-08-generated-plan.json')
const ledger = new Gap08RunLedger(runId)
assert.match(postgresPort, /^\d+$/)

const sourceFingerprintPaths = [
  '.cms',
  'node_modules/.cache/jiti',
  'node_modules/.nitro',
  'node_modules/.vite',
  'node_modules/.vite-temp',
  '.tanstack',
]
const frozenFiles = [
  ...GAP08_ACCEPTED_SIX.files,
  'scripts/gap08-heavy-lifecycle.mjs',
  'scripts/gap08-heavy-lifecycle.d.mts',
  'scripts/validate-gap08-relationship-matrix.mjs',
  'scripts/fixtures/gap08-runtime-worker.mjs',
  'scripts/fixtures/gap08-browser-worker.mjs',
]

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

async function run(label, command, args, options = {}) {
  return runGap08BoundedChild(command, args, {
    label,
    timeout: options.timeout ?? 180_000,
    cwd: options.cwd ?? sourceRoot,
    env: options.env ?? process.env,
    maxCapturedBytes: options.maxCapturedBytes ?? 2 * 1024 * 1024,
    termGrace: options.termGrace ?? 1_000,
  })
}

async function docker(args, options = {}) {
  return run(options.label ?? `docker ${args[0]}`, 'docker', args, {
    timeout: options.timeout ?? 30_000,
    maxCapturedBytes: 256 * 1024,
  })
}

async function containerIsRunning() {
  const result = await docker(
    ['inspect', '--format', '{{.State.Running}}', container],
    { label: 'inspect GAP-08 PostgreSQL container' },
  )
  return result.stdout.trim() === 'true'
}

async function waitForPostgres() {
  let lastError
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      await docker(['exec', container, 'pg_isready', '-q'], {
        label: 'GAP-08 PostgreSQL readiness',
        timeout: 5_000,
      })
      return
    } catch (error) {
      lastError = error
      await sleep(100)
    }
  }
  throw new Error('GAP-08 PostgreSQL did not become ready', {
    cause: lastError,
  })
}

async function readCredentials() {
  const result = await docker(
    [
      'exec',
      container,
      'sh',
      '-c',
      'printf "%s\\0%s\\0" "$POSTGRES_USER" "$POSTGRES_PASSWORD"',
    ],
    { label: 'read GAP-08 PostgreSQL credentials' },
  )
  const [containerUser, containerPassword, remainder] =
    result.stdout.split('\0')
  assert.equal(remainder, '')
  const user = process.env.PARITY_POSTGRES_USER ?? containerUser
  const password = process.env.PARITY_POSTGRES_PASSWORD ?? containerPassword
  assert.ok(user && password, 'GAP-08 PostgreSQL credentials are required')
  return { user, password }
}

async function verifyDatabaseAbsent(user) {
  const result = await docker(
    [
      'exec',
      container,
      'psql',
      '-U',
      user,
      '-d',
      'postgres',
      '-Atqc',
      `SELECT count(*) FROM pg_database WHERE datname = '${databaseName}'`,
    ],
    { label: 'verifyDatabaseAbsent' },
  )
  assert.equal(result.stdout.trim(), '0', `${databaseName} still exists`)
}

async function terminateDatabaseSessions(user) {
  await docker(
    [
      'exec',
      container,
      'psql',
      '-U',
      user,
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-Atqc',
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()`,
    ],
    { label: 'terminate exact GAP-08 database sessions' },
  )
}

async function dropDatabase(user) {
  await docker(
    [
      'exec',
      container,
      'dropdb',
      '--if-exists',
      '--force',
      '-U',
      user,
      databaseName,
    ],
    { label: 'drop exact GAP-08 database' },
  )
  await verifyDatabaseAbsent(user)
}

async function linkDependencies(fixtureRoot) {
  const sourceModules = path.join(sourceRoot, 'node_modules')
  const fixtureModules = path.join(fixtureRoot, 'node_modules')
  await mkdir(fixtureModules)
  for (const entry of await readdir(sourceModules, { withFileTypes: true })) {
    if (['.cache', '.nitro', '.vite', '.vite-temp'].includes(entry.name))
      continue
    const sourceEntry = path.join(sourceModules, entry.name)
    const fixtureEntry = path.join(fixtureModules, entry.name)
    if (entry.name.startsWith('@') && entry.isDirectory()) {
      await mkdir(fixtureEntry)
      for (const scoped of await readdir(sourceEntry))
        await symlink(
          path.join(sourceEntry, scoped),
          path.join(fixtureEntry, scoped),
        )
    } else await symlink(sourceEntry, fixtureEntry)
  }
}

async function fingerprintSource() {
  return Object.fromEntries(
    await Promise.all(
      sourceFingerprintPaths.map(async (relative) => [
        relative,
        await fingerprintPath(path.join(sourceRoot, relative)),
      ]),
    ),
  )
}

async function processResidue() {
  const result = await run(
    'inspect GAP-08 process residue',
    'ps',
    ['-axo', 'pid=,ppid=,command='],
    { timeout: 10_000, maxCapturedBytes: 4 * 1024 * 1024 },
  )
  const rows = result.stdout
    .split('\n')
    .map((line) => {
      const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/)
      return match
        ? { pid: Number(match[1]), ppid: Number(match[2]), command: match[3] }
        : null
    })
    .filter(Boolean)
  const parents = new Map(rows.map((row) => [row.pid, row.ppid]))
  const ancestors = new Set([process.pid])
  let parent = parents.get(process.pid)
  while (parent && parent > 1 && !ancestors.has(parent)) {
    ancestors.add(parent)
    parent = parents.get(parent)
  }
  return rows
    .filter(
      (row) =>
        !ancestors.has(row.pid) &&
        (row.command.includes('tks-gap08-') ||
          row.command.includes('gap08-runtime-worker') ||
          row.command.includes('gap08-browser-worker')),
    )
    .map((row) => `${row.pid} ${row.command}`)
}

async function pathAbsent(target, description) {
  try {
    await access(target)
  } catch (error) {
    if (error?.code === 'ENOENT') return
    throw error
  }
  throw new Error(`${description} remains: ${target}`)
}

await mkdir(reportsRoot, { recursive: true })
for (const target of [
  reportPath,
  workerReportPath,
  browserReportPath,
  planReportPath,
])
  await rm(target, { force: true })

let temporaryRoot
let fixtureRoot
let initiallyRunning = false
let databaseCreated = false
let postgresUser
let sourceBefore
let acceptedBefore
let frozenBefore
let primaryError

try {
  acceptedBefore = await hashFileManifest(sourceRoot, GAP08_ACCEPTED_SIX.files)
  assert.equal(acceptedBefore, GAP08_ACCEPTED_SIX.sha256)
  frozenBefore = await hashFileManifest(sourceRoot, frozenFiles)
  sourceBefore = await fingerprintSource()
  ledger.recordPhase('source-verified', {
    acceptedAggregate: acceptedBefore,
    frozenAggregate: frozenBefore,
    sourceFingerprint: sourceBefore,
  })

  initiallyRunning = await containerIsRunning()
  if (!initiallyRunning)
    await docker(['start', container], {
      label: 'start GAP-08 PostgreSQL container',
    })
  await waitForPostgres()
  const credentials = await readCredentials()
  postgresUser = credentials.user
  await docker(
    ['exec', container, 'createdb', '-U', postgresUser, databaseName],
    { label: 'create unique GAP-08 database' },
  )
  databaseCreated = true
  const databaseUrl = `postgresql://${encodeURIComponent(postgresUser)}:${encodeURIComponent(credentials.password)}@127.0.0.1:${postgresPort}/${databaseName}`

  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'tks-gap08-heavy-'))
  fixtureRoot = path.join(temporaryRoot, 'fixture')
  for (const target of [
    reportPath,
    workerReportPath,
    browserReportPath,
    planReportPath,
  ])
    assertExternalReportPath(fixtureRoot, target)
  await cp(sourceRoot, fixtureRoot, {
    recursive: true,
    filter: (source) =>
      !['node_modules', '.output', '.git', '.cms-temp'].includes(
        path.relative(sourceRoot, source).split(path.sep)[0],
      ),
  })
  await linkDependencies(fixtureRoot)
  const fixtureConfigSource = await readFile(
    path.join(sourceRoot, 'scripts/fixtures/gap08-cms.config.ts'),
    'utf8',
  )
  await writeFile(
    path.join(fixtureRoot, 'cms.config.ts'),
    fixtureConfigSource.replaceAll("'../../src/", "'./src/"),
  )
  const fixtureEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    CMS_ADAPTER: 'prisma',
    CMS_BOOTSTRAP_MODE: 'fresh',
    VITE_CACHE_DIR: path.join(fixtureRoot, '.vite-cache'),
    NITRO_BUILD_DIR: path.join(fixtureRoot, '.nitro-build'),
    JITI_CACHE: path.join(fixtureRoot, '.jiti-cache'),
  }

  await run('GAP-08 CMS generation', 'npm', ['run', 'cms:generate'], {
    cwd: fixtureRoot,
    env: fixtureEnv,
  })
  await run(
    'GAP-08 Prisma generation',
    'npx',
    ['--no-install', 'prisma', 'generate'],
    { cwd: fixtureRoot, env: fixtureEnv },
  )
  const emptyDatabaseSql = await run(
    'render GAP-08 empty-database Prisma SQL',
    'npx',
    [
      '--no-install',
      'prisma',
      'migrate',
      'diff',
      '--from-empty',
      '--to-schema',
      'prisma/schema.prisma',
      '--script',
    ],
    { cwd: fixtureRoot, env: fixtureEnv },
  )
  const schemaSqlPath = path.join(fixtureRoot, '.cms', 'gap08-fixture.sql')
  await writeFile(schemaSqlPath, emptyDatabaseSql.stdout)
  await run(
    'apply GAP-08 empty-database Prisma SQL',
    '/bin/sh',
    [
      '-c',
      'docker exec -i "$PARITY_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$PARITY_POSTGRES_USER" -d "$PARITY_DATABASE" < "$PARITY_SCHEMA_SQL"',
    ],
    {
      env: {
        ...fixtureEnv,
        PARITY_CONTAINER: container,
        PARITY_POSTGRES_USER: postgresUser,
        PARITY_DATABASE: databaseName,
        PARITY_SCHEMA_SQL: schemaSqlPath,
      },
    },
  )
  await run('GAP-08 production build', 'npm', ['run', 'build'], {
    cwd: fixtureRoot,
    env: fixtureEnv,
    timeout: 300_000,
  })

  const [adminMetaBytes, prismaSchemaBytes] = await Promise.all([
    readFile(path.join(fixtureRoot, '.cms/admin-meta.json')),
    readFile(path.join(fixtureRoot, '.cms/schema.prisma')),
  ])
  const adminMeta = JSON.parse(adminMetaBytes.toString('utf8'))
  const prismaSchema = prismaSchemaBytes.toString('utf8')
  const matrix = deriveGap08RelationshipMatrix({ adminMeta, prismaSchema })
  assertGap08MatrixCoverage(matrix)
  const scenarios = gap08ScenarioPlan(matrix)
  const executionPlan = assertGeneratedExecutionPlan({
    matrix,
    scenarios,
    adminMetaSha256: sha256(adminMetaBytes),
    prismaSchemaSha256: sha256(prismaSchemaBytes),
  })
  await writeJsonAtomic(planReportPath, executionPlan)
  ledger.recordPhase('generated-plan-verified', {
    endpointCount: executionPlan.endpointCount,
    scenarioCount: executionPlan.scenarioCount,
    adminMetaSha256: executionPlan.adminMetaSha256,
    prismaSchemaSha256: executionPlan.prismaSchemaSha256,
  })

  const runtimeResult = await run(
    'GAP-08 generated runtime scenario matrix',
    process.execPath,
    ['--import', 'tsx', 'scripts/fixtures/gap08-runtime-worker.mjs'],
    {
      cwd: fixtureRoot,
      env: { ...fixtureEnv, GAP08_WORKER_REPORT: workerReportPath },
      timeout: 600_000,
    },
  )
  const runtimeReport = JSON.parse(await readFile(workerReportPath, 'utf8'))
  assert.equal(runtimeReport.status, 'PASS', runtimeResult.stderr)
  assert.equal(runtimeReport.scenarios.length, 76)
  assert.ok(runtimeReport.concurrency?.lockGraph)
  assert.equal(runtimeReport.rollbackProbes.length, 3)

  const browserResult = await run(
    'GAP-08 generated browser route matrix',
    process.execPath,
    ['scripts/fixtures/gap08-browser-worker.mjs'],
    {
      cwd: fixtureRoot,
      env: { ...fixtureEnv, GAP08_BROWSER_REPORT: browserReportPath },
      timeout: 300_000,
    },
  )
  const browserReport = JSON.parse(await readFile(browserReportPath, 'utf8'))
  assert.equal(browserReport.status, 'PASS', browserResult.stderr)
  assert.equal(browserReport.endpointIds.length, 6)
  assert.ok(browserReport.created.length >= 3)
  for (const item of browserReport.created) {
    assert.equal(item.returnedId, item.routeId)
    assert.ok(executionPlan.endpointIds.includes(item.endpointId))
  }

  ledger.markGateCompleted({
    scenarioCount: 76,
    browserCreateCount: browserReport.created.length,
    browserEventCount: browserReport.eventCount,
    rollbackProbeCount: runtimeReport.rollbackProbes.length,
    concurrencyEndpoint: runtimeReport.concurrency.endpointId,
  })
} catch (error) {
  primaryError = error
  ledger.recordFailure(error)
} finally {
  const cleanupErrors = []
  // Every child runs in an owned detached process group and runGap08BoundedChild
  // calls terminateChildGroup on timeout, failure, or residual descendants.
  try {
    assert.deepEqual(await processResidue(), [])
  } catch (error) {
    cleanupErrors.push(error)
  }
  if (databaseCreated && postgresUser) {
    try {
      await terminateDatabaseSessions(postgresUser)
      await dropDatabase(postgresUser)
    } catch (error) {
      cleanupErrors.push(error)
    }
  }
  if (temporaryRoot) {
    try {
      await rm(temporaryRoot, { recursive: true, force: true })
      await pathAbsent(temporaryRoot, 'GAP-08 fixture root')
    } catch (error) {
      cleanupErrors.push(error)
    }
  }
  if (!initiallyRunning) {
    try {
      if (await containerIsRunning())
        await docker(['stop', container], {
          label: 'restore GAP-08 PostgreSQL container state',
        })
    } catch (error) {
      cleanupErrors.push(error)
    }
  }
  try {
    assert.equal(await containerIsRunning(), initiallyRunning)
  } catch (error) {
    cleanupErrors.push(error)
  }
  try {
    assert.deepEqual(await processResidue(), [])
    if (postgresUser && (await containerIsRunning()))
      await verifyDatabaseAbsent(postgresUser)
    assert.deepEqual(await fingerprintSource(), sourceBefore)
    assert.equal(
      await hashFileManifest(sourceRoot, GAP08_ACCEPTED_SIX.files),
      acceptedBefore,
    )
    assert.equal(await hashFileManifest(sourceRoot, frozenFiles), frozenBefore)
  } catch (error) {
    cleanupErrors.push(error)
  }
  if (cleanupErrors.length) {
    const cleanupFailure = new AggregateError(
      cleanupErrors,
      'GAP-08 post-gate cleanup verification failed',
    )
    ledger.recordFailure(cleanupFailure)
    if (!primaryError) primaryError = cleanupFailure
  }
  try {
    ledger.markCleanupCompleted(GAP08_CLEANUP_STEPS)
    ledger.markPostCleanupVerified({
      sourceRestored: cleanupErrors.length === 0,
      acceptedAggregate: acceptedBefore,
      frozenAggregate: frozenBefore,
    })
  } catch (error) {
    ledger.recordFailure(error)
    if (!primaryError) primaryError = error
  }
}

let finalReport
try {
  finalReport = ledger.finalize()
} catch (error) {
  if (!primaryError) primaryError = error
  finalReport = {
    runId,
    status: 'RED',
    failures: [String(error)],
  }
}
await writeJsonAtomic(reportPath, finalReport)
if (primaryError) throw primaryError
console.log(
  `GAP-08 relationship matrix passed: 76 generated scenarios, PostgreSQL lock/rollback evidence, generated browser returned-ID routes, and exact cleanup. Report: ${reportPath}`,
)
