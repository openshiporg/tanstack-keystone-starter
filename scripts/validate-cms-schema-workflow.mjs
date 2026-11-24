import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFile, execFileSync } from 'node:child_process'
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const temporaryRoot = path.join(root, '.cms-temp')
let temporaryDirectory
const containerName = `tks-gap14-${process.pid}-${Date.now()}`
let containerStarted = false
let databaseUrl
let shadowDatabaseUrl
let projectId
const evidence = []
const reportPath = path.join(root, 'reports/gap-14-schema-workflow.md')
const sourceHashPaths = [
  'scripts/cms-generate.ts',
  'scripts/cms-migrate.ts',
  'scripts/validate-cms-schema-workflow.mjs',
  'scripts/validate-cms-workflow-runtime.ts',
  'src/features/cms/migration-safety.ts',
  'tests/cms-migration-safety.test.ts',
  'vite.config.ts',
]
const sourceArtifactPaths = [
  '.cms',
  'prisma/schema.prisma',
  'src/generated/prisma',
]
const sourceCachePaths = [
  'node_modules/.nitro',
  'node_modules/.vite',
  'node_modules/.vite-temp',
  'node_modules/.cache/jiti',
]

function contentHash(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function fingerprintPath(relativePath) {
  const entries = []
  const absolutePath = path.join(root, relativePath)

  async function visit(currentPath, currentRelativePath) {
    let currentStat
    try {
      currentStat = await stat(currentPath)
    } catch (error) {
      if (error?.code === 'ENOENT') {
        entries.push(`${currentRelativePath}:<missing>`)
        return
      }
      throw error
    }
    if (!currentStat.isDirectory()) {
      entries.push(
        `${currentRelativePath}:${contentHash(await readFile(currentPath))}`,
      )
      return
    }

    const children = await readdir(currentPath, { withFileTypes: true })
    entries.push(`${currentRelativePath}/`)
    for (const child of children.sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      const childRelativePath = path.join(currentRelativePath, child.name)
      const childPath = path.join(currentPath, child.name)
      if (child.isDirectory()) await visit(childPath, childRelativePath)
      else
        entries.push(
          `${childRelativePath}:${contentHash(await readFile(childPath))}`,
        )
    }
  }

  await visit(absolutePath, relativePath)
  return contentHash(entries.sort().join('\n'))
}

async function fingerprintPaths(relativePaths) {
  const parts = []
  for (const relativePath of relativePaths)
    parts.push(`${relativePath}:${await fingerprintPath(relativePath)}`)
  return contentHash(parts.join('\n'))
}

async function markerPaths(relativePath) {
  const found = []
  const absolutePath = path.join(root, relativePath)

  async function visit(currentPath, currentRelativePath) {
    let children
    try {
      children = await readdir(currentPath, { withFileTypes: true })
    } catch (error) {
      if (error?.code === 'ENOENT') return
      throw error
    }
    for (const child of children) {
      const childRelativePath = path.join(currentRelativePath, child.name)
      if (
        child.name.includes('gap14-') ||
        childRelativePath.includes('.cms-temp/gap14')
      )
        found.push(childRelativePath)
      if (child.isDirectory())
        await visit(path.join(currentPath, child.name), childRelativePath)
    }
  }

  await visit(absolutePath, relativePath)
  return found.sort()
}

let runId
let sourceHash = ''
let sourceArtifactFingerprint = ''
let sourceCacheFingerprint = ''
let sourceCacheSnapshotDirectory
const sourceCachePresence = new Map()

async function snapshotSourceCaches() {
  for (const [index, relativePath] of sourceCachePaths.entries()) {
    const sourcePath = path.join(root, relativePath)
    const archivePath = path.join(sourceCacheSnapshotDirectory, `${index}.tar`)
    try {
      await stat(sourcePath)
      await execFileAsync(
        'tar',
        ['-cf', archivePath, '-C', root, relativePath],
        {
          timeout: 120_000,
          killSignal: 'SIGTERM',
        },
      )
      sourceCachePresence.set(relativePath, true)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      sourceCachePresence.set(relativePath, false)
    }
  }
}

async function restoreSourceCaches() {
  for (const [index, relativePath] of sourceCachePaths.entries()) {
    if (!sourceCachePresence.has(relativePath)) continue
    const sourcePath = path.join(root, relativePath)
    await rm(sourcePath, { recursive: true, force: true })
    if (sourceCachePresence.get(relativePath)) {
      await mkdir(path.dirname(sourcePath), { recursive: true })
      await execFileAsync(
        'tar',
        [
          '-xf',
          path.join(sourceCacheSnapshotDirectory, `${index}.tar`),
          '-C',
          root,
        ],
        { timeout: 120_000, killSignal: 'SIGTERM' },
      )
    }
  }
}

function fixtureConfig(phase) {
  const rankField =
    phase === 'rename' ||
    phase === 'type' ||
    phase === 'relation' ||
    phase === 'remove' ||
    phase === 'revert'
      ? `rank: ${phase === 'type' ? 'float()' : 'integer({ defaultValue: 0 })'},`
      : `priority: integer({ defaultValue: 0 }),`
  const legacyField =
    phase === 'remove'
      ? ''
      : `legacyText: text({ defaultValue: 'legacy', db: { map: 'legacy_text' } }),`
  const relationFields = ['relation', 'remove', 'revert'].includes(phase)
    ? `owner: relationship({ ref: 'Member.projects' }),`
    : ''
  const memberModel = [
    'add',
    'rename',
    'type',
    'relation',
    'remove',
    'revert',
  ].includes(phase)
    ? `
    Member: list({
      access: { operation: { query: allowAll, create: allowAll, update: allowAll, delete: allowAll } },
      fields: {
        name: text({ validation: { isRequired: true }, isNonNull: [true, true] }),
        ${['relation', 'remove', 'revert'].includes(phase) ? "projects: relationship({ ref: 'Project.owner', many: true })," : ''}
      },
    }),`
    : ''

  return `import { config, list } from './src/features/cms/keystone/core'
import { allowAll } from './src/features/cms/keystone/access'
import { integer, float, relationship, text } from './src/features/cms/keystone/fields'

const allOperations = { query: allowAll, create: allowAll, update: allowAll, delete: allowAll }

export default config({
  db: {
    provider: 'postgresql',
    url: 'env("DATABASE_URL")',
    prismaModelOrder: ${JSON.stringify(['Project', ...(memberModel ? ['Member'] : [])])},
  },
  lists: {
    Project: list({
      access: { operation: allOperations },
      fields: {
        name: text({ validation: { isRequired: true }, isNonNull: [true, true] }),
        ${legacyField}
        customLabel: text({
          ui: { views: './gap14-custom-view.ts' },
          fieldMeta: { customViewMarker: 'gap14-custom-view' },
        }),
        ${rankField}
        ${relationFields}
      },
    }),${memberModel}
  },
})
`
}

async function run(command, args, options = {}) {
  try {
    const result = await execFileAsync(command, args, {
      cwd: options.cwd ?? temporaryDirectory,
      env: options.env ?? process.env,
      encoding: 'utf8',
      maxBuffer: 30 * 1024 * 1024,
      timeout: options.timeout ?? 120_000,
      killSignal: 'SIGTERM',
    })
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
    if (output.trim())
      evidence.push(`$ ${command} ${args.join(' ')}\n${output.trim()}`)
    return output
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`
    evidence.push(
      `$ ${command} ${args.join(' ')} [exit ${error.code ?? '?'}]\n${output.trim() || error.message}`,
    )
    error.output = output || error.message
    throw error
  }
}

function docker(args, options = {}) {
  try {
    return execFileSync('docker', args, {
      encoding: options.encoding === undefined ? 'utf8' : options.encoding,
      input: options.input,
      maxBuffer: 30 * 1024 * 1024,
      timeout: options.timeout ?? 60_000,
      killSignal: 'SIGTERM',
    })
  } catch (error) {
    const stdout = Buffer.isBuffer(error.stdout)
      ? error.stdout.toString('utf8')
      : String(error.stdout ?? '')
    const stderr = Buffer.isBuffer(error.stderr)
      ? error.stderr.toString('utf8')
      : String(error.stderr ?? '')
    const output = `${stdout}${stderr}`.trim() || error.message
    evidence.push(
      `$ docker ${args.join(' ')} [exit ${error.status ?? error.code ?? '?'}]\n${output}`,
    )
    error.output = output
    throw error
  }
}

async function waitForPostgres() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      docker(['exec', containerName, 'pg_isready', '-U', 'cms', '-d', 'cms'])
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw new Error('disposable PostgreSQL did not become ready')
}

async function createShadowDatabase() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      docker(['exec', containerName, 'createdb', '-U', 'cms', 'cms_shadow'])
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw new Error(
    'disposable PostgreSQL shadow database did not become available',
  )
}

async function writePhaseConfig(phase) {
  await writeFile(
    path.join(temporaryDirectory, 'cms.config.ts'),
    fixtureConfig(phase),
  )
  await writeFile(
    path.join(temporaryDirectory, 'gap14-custom-view.ts'),
    `export function Field() { return null }\nexport function Cell() { return null }\nexport const allowedExportsOnCustomViews = ['Cell']\n`,
  )
}

async function expectGeneratedStateInvalidated() {
  try {
    await run('npm', ['run', 'cms:check'])
  } catch (error) {
    assert.match(
      error.output ?? '',
      /generated artifacts|drifted|differs|delegate/i,
    )
    return
  }
  throw new Error('cms:check unexpectedly passed before regeneration')
}

async function generateAndCheck() {
  await run('npx', ['--no-install', 'tsx', 'scripts/cms-generate.ts'])
  await run('npx', [
    '--no-install',
    'tsx',
    'scripts/cms-generate.ts',
    '--check',
  ])
  const manifest = JSON.parse(
    await readFile(path.join(temporaryDirectory, '.cms/manifest.json'), 'utf8'),
  )
  assert.equal(manifest.artifactVersion, 2)
  const adminMeta = JSON.parse(
    await readFile(
      path.join(temporaryDirectory, '.cms/admin-meta.json'),
      'utf8',
    ),
  )
  const customField = adminMeta.lists
    .find((list) => list.key === 'Project')
    ?.fields.find((field) => field.path === 'customLabel')
  assert.equal(customField?.fieldMeta?.customViewMarker, 'gap14-custom-view')
  assert.equal(typeof customField?.customViewsIndex, 'number')
}

async function migrate(name, allowDestructive = false) {
  const args = ['run', 'migrate:gen', '--', '--name', name]
  if (allowDestructive) args.push('--allow-destructive')
  return run('npm', args, {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      SHADOW_DATABASE_URL: shadowDatabaseUrl,
      CMS_ADAPTER: 'prisma',
      NODE_ENV: 'test',
    },
    timeout: 300_000,
  })
}

async function latestMigrationDirectory(name) {
  const entries = await readdir(
    path.join(temporaryDirectory, 'prisma/migrations'),
    { withFileTypes: true },
  )
  const matches = entries
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(`_${name}`))
    .map((entry) =>
      path.join(temporaryDirectory, 'prisma/migrations', entry.name),
    )
    .sort()
  return matches.at(-1)
}

async function customizeTypeMigration(name) {
  const directory = await latestMigrationDirectory(name)
  assert.ok(directory, 'type migration was not created for customization')
  await writeFile(
    path.join(directory, 'migration.sql'),
    'BEGIN;\nALTER TABLE "Project" ALTER COLUMN "rank" TYPE DOUBLE PRECISION USING "rank"::double precision;\nCOMMIT;\n',
  )
  evidence.push(
    'Customized Prisma type migration to preserve populated rank values with an explicit PostgreSQL cast.',
  )
}

async function customizeRenameMigration(name) {
  const directory = await latestMigrationDirectory(name)
  assert.ok(directory, 'rename migration was not created for customization')
  await writeFile(
    path.join(directory, 'migration.sql'),
    'BEGIN;\nALTER TABLE "Project" RENAME COLUMN "priority" TO "rank";\nCOMMIT;\n',
  )
  evidence.push(
    'Customized Prisma rename migration to preserve populated data with ALTER TABLE ... RENAME COLUMN.',
  )
}

async function runtime(phase) {
  const output = await run(
    'npx',
    ['--no-install', 'tsx', 'scripts/validate-cms-workflow-runtime.ts'],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        SHADOW_DATABASE_URL: shadowDatabaseUrl,
        CMS_ADAPTER: 'prisma',
        NODE_ENV: 'test',
        GAP14_PHASE: phase,
        ...(projectId ? { GAP14_PROJECT_ID: projectId } : {}),
      },
    },
  )
  const lines = output.trim().split(/\r?\n/)
  const jsonLine = lines.at(-1)
  assert.ok(jsonLine)
  return JSON.parse(jsonLine)
}

async function backupAndVerifyRollback() {
  const rollbackDb = 'cms_gap14_rollback'
  const dump = docker(
    [
      'exec',
      containerName,
      'pg_dump',
      '-Fc',
      '--no-owner',
      '--no-privileges',
      '-U',
      'cms',
      '-d',
      'cms',
    ],
    { encoding: null },
  )
  docker(['exec', containerName, 'createdb', '-U', 'cms', rollbackDb])
  docker(
    [
      'exec',
      '-i',
      containerName,
      'pg_restore',
      '--no-owner',
      '--no-privileges',
      '-U',
      'cms',
      '-d',
      rollbackDb,
    ],
    { input: dump, timeout: 120_000 },
  )
  const restored = docker([
    'exec',
    containerName,
    'psql',
    '-At',
    '-U',
    'cms',
    '-d',
    rollbackDb,
    '-c',
    'SELECT p."legacy_text" || \'|\' || p."customLabel" || \'|\' || COALESCE(m."name", \'\') FROM "Project" p LEFT JOIN "Member" m ON m."id" = p."owner" WHERE p."id" = (SELECT "id" FROM "Project" ORDER BY "id" LIMIT 1);',
  ]).trim()
  try {
    assert.equal(restored, 'preserve-me|updated-custom-value|Existing Member')
    evidence.push(
      'Verified pg_dump/pg_restore rollback copy retained populated legacyText, custom metadata field data, and relation data.',
    )
  } finally {
    docker([
      'exec',
      containerName,
      'dropdb',
      '-U',
      'cms',
      '--if-exists',
      rollbackDb,
    ])
    const remaining = docker([
      'exec',
      containerName,
      'psql',
      '-At',
      '-U',
      'cms',
      '-d',
      'cms',
      '-c',
      `SELECT 1 FROM pg_database WHERE datname = '${rollbackDb}'`,
    ]).trim()
    assert.equal(
      remaining,
      '',
      'rollback database leaked inside disposable PostgreSQL',
    )
    evidence.push(
      'Dropped and verified cleanup of the temporary rollback database.',
    )
  }
}

let cleanupDone = false
async function cleanupResources() {
  if (cleanupDone) return

  if (containerStarted) {
    try {
      docker(['rm', '-f', containerName])
    } catch {}
    const leftoverContainer = docker([
      'ps',
      '-aq',
      '--filter',
      `name=^/${containerName}$`,
    ]).trim()
    assert.equal(leftoverContainer, '', 'GAP-14 PostgreSQL container leaked')
    containerStarted = false
  }

  if (sourceCacheSnapshotDirectory) {
    await restoreSourceCaches()
    await rm(sourceCacheSnapshotDirectory, { recursive: true, force: true })
    try {
      await access(sourceCacheSnapshotDirectory)
      throw new Error('GAP-14 source-cache snapshot leaked')
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true })
    try {
      await access(temporaryDirectory)
      throw new Error('GAP-14 temporary copy leaked')
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }

  let leakedProcesses = []
  if (temporaryDirectory) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const processes = await execFileAsync('ps', ['-axo', 'command='], {
        timeout: 10_000,
        killSignal: 'SIGTERM',
      })
      leakedProcesses = processes.stdout
        .split(/\r?\n/)
        .filter((command) => command.includes(temporaryDirectory))
      if (leakedProcesses.length === 0) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  assert.deepEqual(
    leakedProcesses,
    [],
    `GAP-14 temporary-copy process leaked: ${leakedProcesses.join(' | ')}`,
  )
  if (sourceArtifactFingerprint) {
    assert.equal(
      await fingerprintPaths(sourceArtifactPaths),
      sourceArtifactFingerprint,
      'source generated artifacts or Prisma schema changed during GAP-14',
    )
  }
  if (sourceCacheFingerprint) {
    assert.equal(
      await fingerprintPaths(sourceCachePaths),
      sourceCacheFingerprint,
      'source node_modules writable cache changed during GAP-14',
    )
  }
  assert.deepEqual(
    await markerPaths('node_modules'),
    [],
    'GAP-14 marker/path residue remains in source node_modules',
  )
  evidence.push(
    'Cleanup verified: disposable PostgreSQL/container, fixture process, temporary copy, source generated artifacts/schema, and source node_modules caches were restored byte-for-byte; no GAP-14 marker/path residue remains.',
  )
  cleanupDone = true
}

await rm(reportPath, { force: true })

try {
  temporaryDirectory = await mkdtemp(path.join(temporaryRoot, 'gap14-'))
  runId = `${path.basename(temporaryDirectory)}-${process.pid}`
  sourceHash = await fingerprintPaths(sourceHashPaths)
  sourceArtifactFingerprint = await fingerprintPaths(sourceArtifactPaths)
  sourceCacheFingerprint = await fingerprintPaths(sourceCachePaths)
  sourceCacheSnapshotDirectory = await mkdtemp(
    path.join(tmpdir(), 'gap14-cache-'),
  )
  await mkdir(temporaryRoot, { recursive: true })
  await snapshotSourceCaches()
  if (process.argv.includes('--preflight-failure-probe'))
    throw new Error('intentional GAP-14 preflight failure cleanup probe')
  if (process.argv.includes('--timeout-probe')) {
    try {
      await run(process.execPath, ['-e', 'setTimeout(() => {}, 1000)'], {
        timeout: 100,
      })
    } catch (error) {
      assert.equal(
        Boolean(
          error.killed ||
          error.signal === 'SIGTERM' ||
          error.code === 'ETIMEDOUT' ||
          /timed out/i.test(error.message ?? ''),
        ),
        true,
        `bounded timeout did not terminate the child: ${error.message ?? error}`,
      )
      evidence.push('bounded exec timeout probe terminated as expected')
      throw error
    }
    throw new Error('bounded exec timeout probe unexpectedly completed')
  }
  const sourceEntries = await readdir(root, { withFileTypes: true })
  for (const entry of sourceEntries) {
    if (
      ['node_modules', '.git', '.output', '.tanstack', '.cms-temp'].includes(
        entry.name,
      )
    )
      continue
    if (entry.name === 'src') {
      await cp(
        path.join(root, entry.name),
        path.join(temporaryDirectory, entry.name),
        {
          recursive: true,
          filter(source) {
            return !source.includes(
              `${path.sep}generated${path.sep}prisma${path.sep}`,
            )
          },
        },
      )
      continue
    }
    await cp(
      path.join(root, entry.name),
      path.join(temporaryDirectory, entry.name),
      { recursive: true },
    )
  }
  // Reuse installed packages through per-entry links, but never link the
  // source dependency directory itself: Vite, Nitro, and jiti write caches
  // beneath node_modules. The fixture owns those cache directories.
  const fixtureNodeModules = path.join(temporaryDirectory, 'node_modules')
  await mkdir(fixtureNodeModules, { recursive: true })
  const cacheDirectories = new Set(['.cache', '.nitro', '.vite', '.vite-temp'])
  for (const entry of await readdir(path.join(root, 'node_modules'), {
    withFileTypes: true,
  })) {
    if (cacheDirectories.has(entry.name)) continue
    await symlink(
      path.join(root, 'node_modules', entry.name),
      path.join(fixtureNodeModules, entry.name),
      entry.isDirectory() ? 'junction' : 'file',
    )
  }
  for (const cacheDirectory of cacheDirectories)
    await mkdir(path.join(fixtureNodeModules, cacheDirectory), {
      recursive: true,
    })
  await rm(path.join(temporaryDirectory, 'prisma/migrations'), {
    recursive: true,
    force: true,
  })
  await mkdir(path.join(temporaryDirectory, 'prisma/migrations'), {
    recursive: true,
  })
  await rm(path.join(temporaryDirectory, 'src/generated/prisma'), {
    recursive: true,
    force: true,
  })

  docker([
    'run',
    '--rm',
    '--name',
    containerName,
    '-e',
    'POSTGRES_USER=cms',
    '-e',
    'POSTGRES_PASSWORD=cms',
    '-e',
    'POSTGRES_DB=cms',
    '-P',
    '-d',
    'postgres:16-alpine',
  ])
  containerStarted = true
  await waitForPostgres()
  const portOutput = docker(['port', containerName, '5432/tcp']).trim()
  const port = portOutput.split(':').at(-1)
  assert.match(port, /^\d+$/)
  await createShadowDatabase()
  databaseUrl = `postgresql://cms:cms@127.0.0.1:${port}/cms`
  shadowDatabaseUrl = `postgresql://cms:cms@127.0.0.1:${port}/cms_shadow`
  const environment = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    SHADOW_DATABASE_URL: shadowDatabaseUrl,
    CMS_ADAPTER: 'prisma',
    NODE_ENV: 'test',
    VITE_CACHE_DIR: path.join(temporaryDirectory, '.vite-cache'),
    NITRO_BUILD_DIR: path.join(temporaryDirectory, '.nitro-build'),
  }

  for (const phase of [
    'baseline',
    'add',
    'rename',
    'type',
    'relation',
    'remove',
    'revert',
  ]) {
    await writePhaseConfig(phase)
    await expectGeneratedStateInvalidated()
    await generateAndCheck()

    if (phase === 'baseline') {
      await migrate('gap14_baseline')
      const baseline = await runtime('baseline')
      projectId = baseline.projectId
      evidence.push(`baseline project id: ${projectId}`)
      continue
    }

    const migrationName = `gap14_${phase}`
    if (phase === 'rename' || phase === 'type') {
      try {
        await migrate(migrationName)
      } catch (error) {
        assert.match(
          error.output ?? '',
          /requires explicit acknowledgement|destructive/i,
        )
        if (phase === 'rename') await customizeRenameMigration(migrationName)
        else await customizeTypeMigration(migrationName)
        await migrate(migrationName, true)
      }
    } else if (phase === 'remove') {
      await backupAndVerifyRollback()
      try {
        await migrate(migrationName)
      } catch (error) {
        assert.match(
          error.output ?? '',
          /requires explicit acknowledgement|destructive/i,
        )
        evidence.push('destructive remove migration was blocked before apply')
      }
      await migrate(migrationName, true)
    } else {
      await migrate(migrationName)
    }
    await run('npm', ['run', 'cms:check'], { env: environment })
    const result = await runtime(phase)
    evidence.push(`${phase}: ${JSON.stringify(result)}`)
    if (phase === 'relation') {
      await run('npm', ['run', 'build'], {
        env: environment,
        timeout: 600_000,
      })
      evidence.push(
        'fresh temporary-copy npm run build passed after relation CRUD',
      )
    }
  }

  await run('npm', ['run', 'build'], {
    env: environment,
    timeout: 600_000,
  })
  evidence.push(
    'fresh temporary-copy npm run build passed after the revert state',
  )
  await run('npx', ['--no-install', 'prisma', 'migrate', 'status'], {
    env: environment,
  })
  evidence.push('fresh Prisma migration status passed')

  await cleanupResources()
  const runHash = contentHash(`${sourceHash}\n${evidence.join('\n')}`)
  const report =
    `# GAP-14 schema workflow evidence\n\n` +
    `Status: PASS\n` +
    `Run ID: ${runId}\n` +
    `Run hash: ${runHash}\n` +
    `Source hash: ${sourceHash}\n` +
    `Source generated-artifact/schema fingerprint: ${sourceArtifactFingerprint}\n` +
    `Source writable-cache fingerprint: ${sourceCacheFingerprint}\n` +
    `Date: ${new Date().toISOString()}\n\n` +
    `The bounded state machine ran in a temporary repository copy against unique disposable PostgreSQL. Cleanup completed before this PASS report was written.\n\n` +
    `## States\n\n` +
    `baseline -> add model/field -> rename (customized Prisma SQL) -> type change -> relation -> remove (guarded, acknowledged after backup) -> revert\n\n` +
    `## Evidence\n\n` +
    evidence
      .map(
        (entry) =>
          `### ${entry.split('\n')[0]}\n\n\`\`\`text\n${entry}\n\`\`\``,
      )
      .join('\n\n') +
    `\n\n## Compatibility boundaries\n\n` +
    `- Keystone-compatible generation runs before migration and emits GraphQL, AdminMeta, view-order/custom-view module, types, and Prisma artifacts.\n` +
    `- Prisma migrate dev --create-only creates the migration for inspection/customization; Prisma's shadow database remains the data-loss/drift oracle.\n` +
    `- Prisma Client is regenerated after every applied migration.\n` +
    `- Fresh processes exercise sudo GraphQL CRUD through the generated schema and Prisma adapter; this is not rendered dashboard/browser CRUD.\n` +
    `- The pg_dump/pg_restore backup check is bounded to the disposable PostgreSQL container; the rollback copy is dropped and verified.\n` +
    `- Vite, Nitro, and jiti writable caches are fixture-local; source generated artifacts/schema and cache fingerprints must remain unchanged.\n`
  await writeFile(reportPath, report)
  console.log(
    'GAP-14 schema workflow passed; evidence written to reports/gap-14-schema-workflow.md',
  )
} catch (error) {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error)
  const runHash = contentHash(
    `${sourceHash}\n${evidence.join('\n')}\n${message}`,
  )
  await writeFile(
    reportPath,
    `# GAP-14 schema workflow evidence\n\n` +
      `Status: FAILED\n` +
      `Run ID: ${runId}\n` +
      `Run hash: ${runHash}\n` +
      `Source hash: ${sourceHash}\n` +
      `Source generated-artifact/schema fingerprint: ${sourceArtifactFingerprint}\n` +
      `Source writable-cache fingerprint: ${sourceCacheFingerprint}\n` +
      `Date: ${new Date().toISOString()}\n\n` +
      `A prior PASS report was removed before this run. This report is explicit failure evidence.\n\n` +
      `## Error\n\n` +
      '```text\n' +
      message +
      '\n```\n\n' +
      `## Evidence before failure\n\n` +
      evidence
        .map(
          (entry) =>
            `### ${entry.split('\n')[0]}\n\n` + '```text\n' + entry + '\n```',
        )
        .join('\n\n'),
  )
  throw error
} finally {
  await cleanupResources()
}
