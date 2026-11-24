import assert from 'node:assert/strict'
import { hashSync } from 'bcryptjs'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { runBoundedChild } from './lib/bounded-child.mjs'

const root = process.cwd()
const scriptPath = fileURLToPath(import.meta.url)
const workerRelativePath = 'scripts/fixtures/os-org-real-consumer-worker.ts'
const workerPath = path.join(root, workerRelativePath)
const commandWrapperPath = path.join(
  root,
  'scripts/fixtures/os-org-bounded-command.mjs',
)
const sourceRoot = path.resolve('/Users/junaid/Code/os.org')
const reportPath = path.join(root, 'reports/os-org-real-consumer-canary.md')
const postgresImage =
  process.env.OS_ORG_REAL_CANARY_POSTGRES_IMAGE ?? 'postgres:17'
const containerPrefix = 'tks-os-org-real-consumer-'
const fixturePrefix = 'tks-os-org-real-consumer-fixture-'
const parentPrefix = 'tks-os-org-real-consumer-parent-'
const databaseName = 'os_org_source'
const rollbackDatabaseName = 'os_org_rollback'
const postgresUser = 'osorg_canary'
const postgresPassword = 'osorg-local-only-password'
const sessionSecret = 'os-org-real-consumer-canary-session-secret-32-bytes'
const sourceModels = [
  'User',
  'Role',
  'Product',
  'Price',
  'Instance',
  'Subscription',
  'Newsletter',
]
const sourceMigrationNames = [
  '20250728190557_initial_migration',
  '20250730054036_add_application_field_to_product',
  '20250730193550_add_custom_domain_to_instance_field',
  '20250803194026_add_waitlists',
  '20250804190343_add_password_reset_tokens',
  '20260718120000_scope_deployment_ownership',
]
const sourceBoundaryFiles = [
  'features/keystone/access.ts',
  'features/keystone/index.ts',
  'features/keystone/models/index.ts',
  ...sourceModels.map((model) => `features/keystone/models/${model}.ts`),
  'features/keystone/mutations/index.ts',
  'features/keystone/mutations/redirectToInit.ts',
  'lib/newsletter.ts',
  'lib/product-catalog.ts',
  'lib/subscription-deployment.ts',
  'schema.graphql',
  'schema.prisma',
  'tests/access-control.test.ts',
  'migrations/migration_lock.toml',
  ...sourceMigrationNames.map((name) => `migrations/${name}/migration.sql`),
]
const currentCacheDirectories = [
  'node_modules/.cache/jiti',
  'node_modules/.vite',
  'node_modules/.nitro',
  '.vite-temp',
  '.tanstack',
].map((relativePath) => path.join(root, relativePath))
const prismaAdapterPath = path.join(root, 'src/features/cms/adapters/prisma.ts')
const ownedFiles = [
  scriptPath,
  workerPath,
  commandWrapperPath,
  prismaAdapterPath,
]

function walkFiles(directory, callback, relative = '') {
  if (!existsSync(directory)) return
  for (const name of readdirSync(directory).sort()) {
    const fullPath = path.join(directory, name)
    const stat = lstatSync(fullPath)
    const childRelative = path.join(relative, name)
    if (stat.isDirectory()) walkFiles(fullPath, callback, childRelative)
    else callback(fullPath, childRelative)
  }
}

function fingerprintFiles(base, relativePaths) {
  const hash = createHash('sha256')
  for (const relativePath of [...relativePaths].sort()) {
    const fullPath = path.join(base, relativePath)
    assert.ok(existsSync(fullPath), `Missing fingerprint input: ${fullPath}`)
    hash.update(relativePath)
    hash.update('\0')
    hash.update(readFileSync(fullPath))
    hash.update('\0')
  }
  return hash.digest('hex')
}

function cacheFixtureMarkers(fixtureRoot) {
  const markers = []
  const fixtureName = path.basename(fixtureRoot)
  const fixtureBytes = Buffer.from(fixtureRoot)
  for (const directory of currentCacheDirectories) {
    walkFiles(directory, (fullPath, relativePath) => {
      if (
        relativePath.includes(fixtureName) ||
        readFileSync(fullPath).includes(fixtureBytes)
      ) {
        markers.push(fullPath)
      }
    })
  }
  return markers.sort()
}

function fingerprintOwnedFiles() {
  const hash = createHash('sha256')
  for (const filePath of [...ownedFiles].sort()) {
    hash.update(path.relative(root, filePath))
    hash.update('\0')
    hash.update(readFileSync(filePath))
    hash.update('\0')
  }
  return hash.digest('hex')
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function sourceText(relativePath) {
  return readFileSync(path.join(sourceRoot, relativePath), 'utf8')
}

function assertSourceContract() {
  assert.ok(
    existsSync(sourceRoot),
    `os.org source is unavailable: ${sourceRoot}`,
  )
  const registry = sourceText('features/keystone/models/index.ts')
  for (const model of sourceModels) {
    assert.match(registry, new RegExp(`\\b${model}\\b`))
  }
  const auth = sourceText('features/keystone/index.ts')
  assert.match(auth, /listKey:\s*["']User["']/)
  assert.match(auth, /identityField:\s*["']email["']/)
  assert.match(auth, /secretField:\s*["']password["']/)
  assert.match(auth, /initFirstItem:\s*{/)
  assert.match(auth, /itemData:\s*{/)
  assert.match(auth, /canManagePeople:\s*true/)
  assert.match(auth, /canManageRoles:\s*true/)
  assert.match(auth, /canAccessDashboard:\s*true/)
  assert.match(auth, /sessionData:\s*`[\s\S]*canAccessDashboard/)
  assert.match(
    auth,
    /isAccessAllowed:\s*\(\{\s*session\s*\}\)\s*=>\s*session\?\.data\.role\?\.canAccessDashboard\s*\?\?\s*false/,
  )
  const access = sourceText('features/keystone/access.ts')
  assert.match(access, /PUBLIC_SIGNUPS_ALLOWED\s*===\s*['"]true['"]/)
  assert.match(
    access,
    /canReadOwnedInstances:\s*\(args:\s*AccessArgs\)\s*=>\s*ownedByCurrentUser\(args,\s*['"]user['"]\)/,
  )
  assert.match(
    access,
    /canReadOwnedSubscriptions:\s*\(args:\s*AccessArgs\)\s*=>\s*ownedByCurrentUser\(args,\s*['"]user['"]\)/,
  )
  assert.match(access, /canReadOwnBilling/)
  assert.deepEqual(
    readdirSync(path.join(sourceRoot, 'migrations'))
      .filter((entry) => /^\d/.test(entry))
      .sort(),
    sourceMigrationNames,
  )
}

async function runCommand(command, args, options = {}) {
  const {
    label = `${command} ${args.join(' ')}`,
    timeout = 120_000,
    cwd = root,
    env = process.env,
    maxCapturedBytes = 32 * 1024 * 1024,
  } = options
  console.log(`[os.org real canary] ${label}`)
  const result = await runBoundedChild(
    process.execPath,
    [commandWrapperPath, command, ...args],
    {
      label,
      timeout,
      termGrace: 1_000,
      captureOutput: true,
      maxCapturedBytes,
      cwd,
      env,
    },
  )
  const matches = [
    ...result.stderr.matchAll(/\[os-org-command-result\](\{[^\n]+\})/g),
  ]
  const marker = matches.at(-1)
  assert.ok(marker, `${label} did not report its child outcome`)
  const outcome = JSON.parse(marker[1])
  const stderr = result.stderr
    .replace(/\n?\[os-org-command-result\]\{[^\n]+\}\n?/g, '\n')
    .trim()
  if (outcome.spawnError || outcome.code !== 0) {
    const diagnostics = [stderr, result.stdout.trim()]
      .filter(Boolean)
      .join('\n')
      .slice(-8_000)
    throw new Error(
      `${label} failed with code ${outcome.code} and signal ${outcome.signal}${
        outcome.spawnError ? `: ${outcome.spawnError}` : ''
      }${diagnostics ? `\n${diagnostics}` : ''}`,
    )
  }
  return { stdout: result.stdout, stderr }
}

async function docker(args, options = {}) {
  return runCommand('docker', args, {
    label: options.label ?? `docker ${args[0] ?? 'command'}`,
    timeout: options.timeout ?? 30_000,
    cwd: root,
    env: process.env,
    maxCapturedBytes: options.maxCapturedBytes ?? 8 * 1024 * 1024,
  })
}

async function dockerExec(containerName, args, options = {}) {
  return docker(['exec', containerName, ...args], {
    label: options.label ?? `docker exec ${args[0] ?? 'command'}`,
    timeout: options.timeout,
    maxCapturedBytes: options.maxCapturedBytes,
  })
}

async function waitForPostgres(containerName) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      await dockerExec(
        containerName,
        ['pg_isready', '-U', postgresUser, '-d', databaseName],
        { label: 'wait for disposable PostgreSQL', timeout: 5_000 },
      )
      return
    } catch {
      await delay(250)
    }
  }
  throw new Error('disposable tmpfs PostgreSQL did not become ready')
}

function replaceAllChecked(source, from, to, label) {
  assert.ok(source.includes(from), `${label} did not contain ${from}`)
  return source.replaceAll(from, to)
}

const keystonePackagePrefix = ['@keystone-6', ''].join('/')

function quotedPackageImport(packagePath, quote) {
  return `${quote}${keystonePackagePrefix}${packagePath}${quote}`
}

function rewriteModelImports(source, label) {
  let rewritten = source
  rewritten = rewritten
    .replaceAll(
      quotedPackageImport('core/access', "'"),
      "'../../cms/keystone/access'",
    )
    .replaceAll(
      quotedPackageImport('core/access', '"'),
      '"../../cms/keystone/access"',
    )
    .replaceAll(
      quotedPackageImport('core/fields', "'"),
      "'../../cms/keystone/fields'",
    )
    .replaceAll(
      quotedPackageImport('core/fields', '"'),
      '"../../cms/keystone/fields"',
    )
    .replaceAll(quotedPackageImport('core', "'"), "'../../cms/keystone/core'")
    .replaceAll(quotedPackageImport('core', '"'), '"../../cms/keystone/core"')
  assert.doesNotMatch(
    rewritten,
    /from\s+['"]@keystone-6\//,
    `${label} retained a Keystone runtime import`,
  )
  return rewritten
}

function rewriteConsumerConfig(source) {
  let rewritten = source
  rewritten = replaceAllChecked(
    rewritten,
    `from ${quotedPackageImport('auth', '"')}`,
    'from "../cms/keystone/auth"',
    'os.org auth config',
  )
  rewritten = replaceAllChecked(
    rewritten,
    `from ${quotedPackageImport('core', '"')}`,
    'from "../cms/keystone/core"',
    'os.org core config',
  )
  rewritten = replaceAllChecked(
    rewritten,
    `from ${quotedPackageImport('core/session', '"')}`,
    'from "../cms/keystone/auth"',
    'os.org session config',
  )
  assert.doesNotMatch(rewritten, /from\s+["']@keystone-6\//)
  return rewritten
}

function copyRuntime(fixtureRoot) {
  for (const entry of ['src', 'scripts', 'prisma']) {
    cpSync(path.join(root, entry), path.join(fixtureRoot, entry), {
      recursive: true,
    })
  }
  for (const entry of [
    'package.json',
    'package-lock.json',
    'prisma.config.ts',
    'tsconfig.json',
  ]) {
    cpSync(path.join(root, entry), path.join(fixtureRoot, entry))
  }
  rmSync(path.join(fixtureRoot, 'src/generated/prisma'), {
    recursive: true,
    force: true,
  })
  rmSync(path.join(fixtureRoot, 'prisma/migrations'), {
    recursive: true,
    force: true,
  })
}

async function cloneDependencies(fixtureRoot) {
  await runCommand(
    '/bin/cp',
    [
      '-cR',
      path.join(root, 'node_modules'),
      path.join(fixtureRoot, 'node_modules'),
    ],
    {
      label: 'clone dependencies into disposable fixture',
      timeout: 300_000,
      maxCapturedBytes: 2 * 1024 * 1024,
    },
  )
}

function transplantConsumer(fixtureRoot) {
  const consumerRoot = path.join(
    fixtureRoot,
    'src/features/os-org-real-consumer',
  )
  const modelsRoot = path.join(consumerRoot, 'models')
  const mutationsRoot = path.join(consumerRoot, 'mutations')
  const libRoot = path.join(consumerRoot, 'lib')
  mkdirSync(modelsRoot, { recursive: true })
  mkdirSync(mutationsRoot, { recursive: true })
  mkdirSync(libRoot, { recursive: true })

  const sourceAccess = sourceText('features/keystone/access.ts')
  writeFileSync(path.join(consumerRoot, 'access.ts'), sourceAccess)
  assert.equal(
    readFileSync(path.join(consumerRoot, 'access.ts'), 'utf8'),
    sourceAccess,
  )

  for (const model of sourceModels) {
    const source = sourceText(`features/keystone/models/${model}.ts`)
    writeFileSync(
      path.join(modelsRoot, `${model}.ts`),
      rewriteModelImports(source, model),
    )
  }
  writeFileSync(
    path.join(modelsRoot, 'index.ts'),
    sourceText('features/keystone/models/index.ts'),
  )

  writeFileSync(
    path.join(consumerRoot, 'index.ts'),
    rewriteConsumerConfig(sourceText('features/keystone/index.ts')),
  )
  writeFileSync(
    path.join(mutationsRoot, 'index.ts'),
    sourceText('features/keystone/mutations/index.ts'),
  )
  const redirect = sourceText('features/keystone/mutations/redirectToInit.ts')
    .replace(
      /import type \{ Context \} from ['"]\.keystone\/types['"];?\s*/,
      '',
    )
    .replace('context: Context', 'context: any')
  assert.doesNotMatch(redirect, /\.keystone\/types/)
  writeFileSync(path.join(mutationsRoot, 'redirectToInit.ts'), redirect)
  writeFileSync(
    path.join(libRoot, 'mail.ts'),
    `export async function sendPasswordResetEmail() {\n  throw new Error('External SMTP delivery is outside the bounded os.org real-consumer canary')\n}\n`,
  )

  const fixtureLibRoot = path.join(fixtureRoot, 'src/lib')
  mkdirSync(fixtureLibRoot, { recursive: true })
  for (const entry of [
    'newsletter.ts',
    'product-catalog.ts',
    'subscription-deployment.ts',
  ]) {
    writeFileSync(path.join(fixtureLibRoot, entry), sourceText(`lib/${entry}`))
  }
  writeFileSync(
    path.join(fixtureLibRoot, 'railway.ts'),
    `export function isDeploymentType(value: unknown) {\n  return ['openfront-ecommerce', 'openfront-restaurant', 'openship'].includes(String(value))\n}\n\nexport async function checkUnassigned(): Promise<never> {\n  throw new Error('External Railway deployment is outside the bounded os.org real-consumer canary')\n}\n`,
  )

  writeFileSync(
    path.join(fixtureRoot, 'cms.config.ts'),
    `export { default } from './src/features/os-org-real-consumer'\n`,
  )

  const sourceMigrations = path.join(sourceRoot, 'migrations')
  const fixtureMigrations = path.join(fixtureRoot, 'prisma/migrations')
  mkdirSync(fixtureMigrations, { recursive: true })
  cpSync(
    path.join(sourceMigrations, 'migration_lock.toml'),
    path.join(fixtureMigrations, 'migration_lock.toml'),
  )
  for (const name of sourceMigrationNames) {
    cpSync(
      path.join(sourceMigrations, name),
      path.join(fixtureMigrations, name),
      { recursive: true },
    )
  }
  const sourceSchemaPath = path.join(fixtureRoot, 'os-org-source-schema.prisma')
  writeFileSync(
    sourceSchemaPath,
    sanitizeSourcePrismaSchema(sourceText('schema.prisma')),
  )
  return { consumerRoot, sourceSchemaPath }
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function writeSourceSeed(fixtureRoot) {
  const adminHash = hashSync('admin-canary-password', 10)
  const memberHash = hashSync('member-canary-password', 10)
  const seed = /* sql */ `
    INSERT INTO "Role" (
      "id", "name", "canCreateTodos", "canManageAllTodos",
      "canSeeOtherPeople", "canEditOtherPeople", "canManagePeople",
      "canManageRoles", "canAccessDashboard"
    ) VALUES
      ('source_admin_role', 'Source Admin', true, true, true, true, true, true, true),
      ('source_member_role', 'Source Member', false, false, false, false, false, false, false);

    INSERT INTO "User" (
      "id", "name", "email", "password", "role", "stripeCustomerID",
      "paymentMethod", "billingAddress"
    ) VALUES
      ('source_admin', 'Source Admin', 'admin@os-org-canary.invalid', ${sqlLiteral(adminHash)}, 'source_admin_role', 'cus_admin_source', '{"brand":"visa"}'::jsonb, '{"country":"US"}'::jsonb),
      ('source_member', 'Source Member', 'member@os-org-canary.invalid', ${sqlLiteral(memberHash)}, 'source_member_role', 'cus_member_source', '{"brand":"mastercard"}'::jsonb, '{"country":"CA"}'::jsonb),
      ('source_other', 'Source Other', 'other@os-org-canary.invalid', ${sqlLiteral(memberHash)}, 'source_member_role', 'cus_other_source', '{"brand":"amex"}'::jsonb, '{"country":"GB"}'::jsonb);

    INSERT INTO "Product" (
      "id", "stripeProductId", "name", "description", "application"
    ) VALUES (
      'source_product', 'prod_source_seed', 'Source Seed Product',
      'Source-migration representative product', 'openfront'
    );

    INSERT INTO "Price" (
      "id", "stripePriceId", "description", "unitAmount", "product"
    ) VALUES (
      'source_price', 'price_source_seed', 'Source monthly plan', 2100,
      'source_product'
    );

    INSERT INTO "Subscription" (
      "id", "stripeSubscriptionId", "status", "price", "user"
    ) VALUES
      ('source_admin_subscription', 'sub_admin_source', 'INCOMPLETE', 'source_price', 'source_admin'),
      ('source_member_subscription', 'sub_member_source', 'INCOMPLETE', 'source_price', 'source_member'),
      ('source_other_subscription', 'sub_other_source', 'INCOMPLETE', 'source_price', 'source_other');

    INSERT INTO "Instance" (
      "id", "domain", "deploymentType", "subscription", "projectId",
      "projectStatus", "user"
    ) VALUES
      ('source_admin_instance', 'source-admin-instance', 'openfront-restaurant', 'source_admin_subscription', 'project_admin_source', 'ready', 'source_admin'),
      ('source_member_instance', 'source-member-instance', 'openfront-restaurant', 'source_member_subscription', 'project_member_source', 'ready', 'source_member'),
      ('source_other_instance', 'source-other-instance', 'openfront-restaurant', 'source_other_subscription', 'project_other_source', 'ready', 'source_other');

    INSERT INTO "Newsletter" ("id", "email", "vertical")
    VALUES ('source_newsletter', 'source-newsletter@os-org-canary.invalid', 'general');
  `
  const seedPath = path.join(fixtureRoot, 'source-seed.sql')
  writeFileSync(seedPath, seed)
  return seedPath
}

function sanitizeSourcePrismaSchema(schema) {
  return schema
    .split('\n')
    .filter(
      (line) =>
        !line.trimStart().startsWith('url ') &&
        !line.trimStart().startsWith('shadowDatabaseUrl '),
    )
    .join('\n')
}

function meaningfulPrismaSql(output) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== '-- This is an empty migration.')
}

async function copyIntoContainer(containerName, source, destination, label) {
  await docker(['cp', source, `${containerName}:${destination}`], {
    label,
    timeout: 30_000,
  })
}

async function removeContainerFile(containerName, filePath, label) {
  await dockerExec(containerName, ['rm', '-f', filePath], {
    label,
    timeout: 30_000,
  })
  await dockerExec(containerName, ['test', '!', '-e', filePath], {
    label: `${label} absence check`,
    timeout: 30_000,
  })
}

async function seedSourceState(containerName, fixtureRoot) {
  const seedPath = writeSourceSeed(fixtureRoot)
  const containerSeedPath = '/tmp/os-org-source-seed.sql'
  try {
    await copyIntoContainer(
      containerName,
      seedPath,
      containerSeedPath,
      'copy source-shaped seed into disposable PostgreSQL',
    )
    await dockerExec(
      containerName,
      [
        'psql',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        postgresUser,
        '-d',
        databaseName,
        '-f',
        containerSeedPath,
      ],
      { label: 'insert source-shaped os.org data', timeout: 60_000 },
    )
  } finally {
    await removeContainerFile(
      containerName,
      containerSeedPath,
      'remove source seed from disposable PostgreSQL',
    )
  }
}

async function captureSourceDump(containerName, fixtureRoot) {
  const containerDumpPath = '/tmp/os-org-pre-cutover.dump'
  const hostDumpPath = path.join(fixtureRoot, 'os-org-pre-cutover.dump')
  try {
    await dockerExec(
      containerName,
      [
        'pg_dump',
        '--format=custom',
        '--no-owner',
        '--no-privileges',
        '-U',
        postgresUser,
        '-d',
        databaseName,
        '-f',
        containerDumpPath,
      ],
      { label: 'capture pre-cutover custom-format dump', timeout: 120_000 },
    )
    await dockerExec(
      containerName,
      ['pg_restore', '--list', containerDumpPath],
      { label: 'validate pre-cutover dump catalog', timeout: 30_000 },
    )
    await docker(
      ['cp', `${containerName}:${containerDumpPath}`, hostDumpPath],
      { label: 'copy pre-cutover dump from disposable PostgreSQL' },
    )
  } finally {
    await removeContainerFile(
      containerName,
      containerDumpPath,
      'remove pre-cutover dump from disposable PostgreSQL',
    )
  }
  assert.ok(readFileSync(hostDumpPath).length > 0, 'pre-cutover dump is empty')
  return hostDumpPath
}

async function restoreSourceDump(containerName, dumpPath) {
  const containerDumpPath = '/tmp/os-org-rollback.dump'
  await dockerExec(
    containerName,
    ['createdb', '-U', postgresUser, rollbackDatabaseName],
    { label: 'create independent rollback database' },
  )
  try {
    await copyIntoContainer(
      containerName,
      dumpPath,
      containerDumpPath,
      'copy pre-cutover dump into disposable PostgreSQL',
    )
    await dockerExec(
      containerName,
      [
        'pg_restore',
        '--no-owner',
        '--no-privileges',
        '-U',
        postgresUser,
        '-d',
        rollbackDatabaseName,
        containerDumpPath,
      ],
      { label: 'restore independent rollback database', timeout: 120_000 },
    )
  } finally {
    await removeContainerFile(
      containerName,
      containerDumpPath,
      'remove rollback dump from disposable PostgreSQL',
    )
  }
}

function databaseUrl(port, name) {
  return `postgresql://${postgresUser}:${postgresPassword}@127.0.0.1:${port}/${name}?schema=public&connection_limit=2&pool_timeout=20`
}

async function runWorker(
  fixtureRoot,
  environment,
  mode,
  extraEnvironment = {},
) {
  const resultPath = path.join(fixtureRoot, `worker-${mode}.json`)
  rmSync(resultPath, { force: true })
  await runCommand(
    'npx',
    ['--no-install', 'tsx', 'scripts/fixtures/os-org-real-consumer-worker.ts'],
    {
      cwd: fixtureRoot,
      env: {
        ...environment,
        OS_ORG_REAL_CANARY_MODE: mode,
        OS_ORG_REAL_CANARY_WORKER_RESULT: resultPath,
        ...extraEnvironment,
      },
      label: `os.org real-consumer ${mode} worker`,
      timeout: 180_000,
    },
  )
  assert.ok(existsSync(resultPath), `${mode} worker did not write evidence`)
  return JSON.parse(readFileSync(resultPath, 'utf8'))
}

async function containerNames() {
  const { stdout } = await docker(['ps', '-a', '--format', '{{.Names}}'], {
    label: 'inspect Docker container names',
  })
  return stdout
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean)
}

async function assertContainerAbsent(containerName) {
  assert.ok(
    !(await containerNames()).includes(containerName),
    `disposable container remains: ${containerName}`,
  )
}

function redactError(error) {
  return String(error)
    .replaceAll(postgresPassword, '[REDACTED]')
    .replaceAll(sessionSecret, '[REDACTED]')
    .replace(/keystonejs-session=[^;\s]+/gi, 'keystonejs-session=[REDACTED]')
}

async function childMain() {
  assertSourceContract()
  const sourceFingerprintBefore = fingerprintFiles(
    sourceRoot,
    sourceBoundaryFiles,
  )
  const ownedFingerprintBefore = fingerprintOwnedFiles()
  const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), fixturePrefix))
  const containerName = `${containerPrefix}${process.pid}-${Date.now()}`
  const resultPath = process.env.OS_ORG_REAL_CANARY_RESULT_PATH
  assert.ok(resultPath, 'OS_ORG_REAL_CANARY_RESULT_PATH is required')
  let containerStarted = false
  let primaryError
  const cleanupErrors = []
  const evidence = {
    sourceFingerprint: sourceFingerprintBefore,
    sourceSchemaHash: sha256(path.join(sourceRoot, 'schema.prisma')),
    sourceGraphqlHash: sha256(path.join(sourceRoot, 'schema.graphql')),
    sourceMigrationNames,
    sourceModels,
    fixtureRoot,
    containerName,
    tmpfsDatabase: false,
    noAppServer: true,
    sourceAccessCopiedByteForByte: false,
    sourceAuthImportAdapted: false,
    prismaSchemaSqlLines: null,
    migrationHistory: [],
    schemaDrift: null,
    exercise: null,
    persistence: null,
    rollback: null,
    directPersistence: null,
  }

  try {
    await docker(
      [
        'run',
        '--rm',
        '--detach',
        '--name',
        containerName,
        '--tmpfs',
        '/var/lib/postgresql/data:rw,size=512m',
        '--env',
        `POSTGRES_USER=${postgresUser}`,
        '--env',
        `POSTGRES_PASSWORD=${postgresPassword}`,
        '--env',
        `POSTGRES_DB=${databaseName}`,
        '--publish',
        '127.0.0.1::5432',
        postgresImage,
      ],
      { label: 'start disposable tmpfs PostgreSQL', timeout: 60_000 },
    )
    containerStarted = true
    await waitForPostgres(containerName)
    const inspect = await docker(
      [
        'inspect',
        '--format',
        '{{json .HostConfig.Tmpfs}}|{{json .Mounts}}',
        containerName,
      ],
      { label: 'verify disposable PostgreSQL storage mode' },
    )
    assert.match(inspect.stdout, /\/var\/lib\/postgresql\/data/)
    assert.doesNotMatch(inspect.stdout, /"Type":"volume"/)
    evidence.tmpfsDatabase = true

    if (process.env.OS_ORG_REAL_CANARY_FAILURE_PROBE === '1') {
      throw new Error('intentional failure after tmpfs PostgreSQL readiness')
    }

    copyRuntime(fixtureRoot)
    await cloneDependencies(fixtureRoot)
    const { sourceSchemaPath } = transplantConsumer(fixtureRoot)
    evidence.sourceAccessCopiedByteForByte =
      readFileSync(
        path.join(fixtureRoot, 'src/features/os-org-real-consumer/access.ts'),
        'utf8',
      ) === sourceText('features/keystone/access.ts')
    evidence.sourceAuthImportAdapted = true

    const portResult = await docker(['port', containerName, '5432/tcp'], {
      label: 'resolve disposable PostgreSQL port',
    })
    const port = portResult.stdout.trim().split(':').at(-1)
    assert.match(port ?? '', /^\d+$/)
    const primaryDatabaseUrl = databaseUrl(port, databaseName)
    const environment = {
      ...process.env,
      DATABASE_URL: primaryDatabaseUrl,
      SHADOW_DATABASE_URL: primaryDatabaseUrl,
      CMS_ADAPTER: 'prisma',
      CMS_DEV_AUTH_FALLBACK: 'false',
      PUBLIC_SIGNUPS_ALLOWED: 'false',
      NODE_ENV: 'test',
      SESSION_SECRET: sessionSecret,
      JITI_FS_CACHE: 'false',
      TSX_DISABLE_CACHE: '1',
    }

    await runCommand('npm', ['run', 'cms:generate'], {
      cwd: fixtureRoot,
      env: environment,
      label: 'generate os.org replacement artifacts',
      timeout: 300_000,
    })
    await runCommand('npx', ['--no-install', 'prisma', 'generate'], {
      cwd: fixtureRoot,
      env: environment,
      label: 'generate os.org replacement Prisma Client',
      timeout: 300_000,
    })

    const schemaDiff = await runCommand(
      'npx',
      [
        '--no-install',
        'prisma',
        'migrate',
        'diff',
        '--from-schema',
        sourceSchemaPath,
        '--to-schema',
        'prisma/schema.prisma',
        '--script',
      ],
      {
        cwd: fixtureRoot,
        env: environment,
        label: 'compare source and replacement Prisma schemas',
        timeout: 120_000,
      },
    )
    const schemaSql = meaningfulPrismaSql(schemaDiff.stdout)
    assert.deepEqual(
      schemaSql,
      [],
      `source/replacement Prisma schema differs:\n${schemaSql.join('\n')}`,
    )
    evidence.prismaSchemaSqlLines = 0

    await runCommand('npx', ['--no-install', 'prisma', 'migrate', 'deploy'], {
      cwd: fixtureRoot,
      env: environment,
      label: 'deploy exact os.org source migration history',
      timeout: 300_000,
    })
    const migrationRows = await dockerExec(
      containerName,
      [
        'psql',
        '-At',
        '-U',
        postgresUser,
        '-d',
        databaseName,
        '-c',
        'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY started_at;',
      ],
      { label: 'read deployed os.org migration history' },
    )
    evidence.migrationHistory = migrationRows.stdout
      .trim()
      .split('\n')
      .filter(Boolean)
    assert.deepEqual(evidence.migrationHistory, sourceMigrationNames)

    await seedSourceState(containerName, fixtureRoot)
    const dumpPath = await captureSourceDump(containerName, fixtureRoot)

    await runCommand('npm', ['run', 'migrate'], {
      cwd: fixtureRoot,
      env: environment,
      label: 'run replacement cutover migration flow',
      timeout: 300_000,
    })
    await runCommand('npx', ['--no-install', 'prisma', 'migrate', 'status'], {
      cwd: fixtureRoot,
      env: environment,
      label: 'verify replacement migration status',
      timeout: 120_000,
    })
    const drift = await runCommand(
      'npx',
      [
        '--no-install',
        'prisma',
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        'prisma/schema.prisma',
        '--exit-code',
      ],
      {
        cwd: fixtureRoot,
        env: environment,
        label: 'verify zero post-cutover database drift',
        timeout: 120_000,
      },
    )
    assert.match(drift.stdout, /No difference detected/i)
    evidence.schemaDrift = 'none'

    evidence.exercise = await runWorker(fixtureRoot, environment, 'exercise')
    evidence.persistence = await runWorker(
      fixtureRoot,
      environment,
      'persistence',
      {
        OS_ORG_REAL_CANARY_CREATED_USER_ID: evidence.exercise.crud.userId,
      },
    )
    const directPersistence = await dockerExec(
      containerName,
      [
        'psql',
        '-At',
        '-U',
        postgresUser,
        '-d',
        databaseName,
        '-c',
        `SELECT p."name" || '|' || pr."stripePriceId" || '|' || i."projectStatus" || '|' || s."stripeSubscriptionId" FROM "Product" p JOIN "Price" pr ON pr."product" = p."id" JOIN "Subscription" s ON s."price" = pr."id" JOIN "Instance" i ON i."subscription" = s."id" WHERE p."stripeProductId" = 'prod_real_cutover';`,
      ],
      { label: 'verify direct PostgreSQL cutover persistence' },
    )
    assert.equal(
      directPersistence.stdout.trim(),
      'Real Consumer Product Persisted|price_real_cutover|persisted|sub_real_cutover',
    )
    evidence.directPersistence = directPersistence.stdout.trim()

    await restoreSourceDump(containerName, dumpPath)
    evidence.rollback = await runWorker(
      fixtureRoot,
      {
        ...environment,
        DATABASE_URL: databaseUrl(port, rollbackDatabaseName),
        SHADOW_DATABASE_URL: databaseUrl(port, rollbackDatabaseName),
      },
      'rollback',
      {
        OS_ORG_REAL_CANARY_CREATED_USER_ID: evidence.exercise.crud.userId,
      },
    )
    const rollbackSql = await dockerExec(
      containerName,
      [
        'psql',
        '-At',
        '-U',
        postgresUser,
        '-d',
        rollbackDatabaseName,
        '-c',
        `SELECT p."name" || '|' || pr."stripePriceId" || '|' || i."domain" || '|' || s."stripeSubscriptionId" FROM "Product" p JOIN "Price" pr ON pr."product" = p."id" JOIN "Subscription" s ON s."price" = pr."id" JOIN "Instance" i ON i."subscription" = s."id" WHERE p."stripeProductId" = 'prod_source_seed' AND i."id" = 'source_member_instance';`,
      ],
      { label: 'verify direct PostgreSQL rollback relationship' },
    )
    assert.equal(
      rollbackSql.stdout.trim(),
      'Source Seed Product|price_source_seed|source-member-instance|sub_member_source',
    )
    const rollbackCutoverRows = await dockerExec(
      containerName,
      [
        'psql',
        '-At',
        '-U',
        postgresUser,
        '-d',
        rollbackDatabaseName,
        '-c',
        `SELECT (SELECT count(*) FROM "Product" WHERE "stripeProductId" = 'prod_real_cutover') || '|' || (SELECT count(*) FROM "User" WHERE "email" = 'cutover.operator@os-org-canary.invalid') || '|' || (SELECT count(*) FROM "Instance" WHERE "domain" = 'member-created-instance');`,
      ],
      { label: 'verify rollback excludes post-cutover writes' },
    )
    assert.equal(rollbackCutoverRows.stdout.trim(), '0|0|0')
  } catch (error) {
    primaryError = error
  } finally {
    if (containerStarted) {
      try {
        await docker(['rm', '--force', '--volumes', containerName], {
          label: 'remove disposable tmpfs PostgreSQL',
          timeout: 60_000,
        })
      } catch (error) {
        try {
          await assertContainerAbsent(containerName)
        } catch {
          cleanupErrors.push(error)
        }
      }
    }
    try {
      rmSync(fixtureRoot, { recursive: true, force: true })
      assert.equal(existsSync(fixtureRoot), false)
    } catch (error) {
      cleanupErrors.push(error)
    }
    try {
      await assertContainerAbsent(containerName)
    } catch (error) {
      cleanupErrors.push(error)
    }
    try {
      assert.equal(
        fingerprintFiles(sourceRoot, sourceBoundaryFiles),
        sourceFingerprintBefore,
        'read-only os.org source fingerprint changed',
      )
      assert.deepEqual(
        cacheFixtureMarkers(fixtureRoot),
        [],
        'disposable fixture path leaked into authoritative starter caches',
      )
      assert.equal(
        fingerprintOwnedFiles(),
        ownedFingerprintBefore,
        'canary implementation changed during execution',
      )
    } catch (error) {
      cleanupErrors.push(error)
    }
  }

  const failures = [primaryError, ...cleanupErrors].filter(Boolean)
  const result = {
    status: failures.length ? 'BLOCKED' : 'PASS',
    intentionalFailure: process.env.OS_ORG_REAL_CANARY_FAILURE_PROBE === '1',
    error: failures.length ? redactError(failures[0]) : null,
    evidence,
    cleanup: {
      containerAbsent: !(await containerNames()).includes(containerName),
      fixtureAbsent: !existsSync(fixtureRoot),
      sourceFingerprintUnchanged:
        fingerprintFiles(sourceRoot, sourceBoundaryFiles) ===
        sourceFingerprintBefore,
      starterCacheFixtureMarkersAbsent:
        cacheFixtureMarkers(fixtureRoot).length === 0,
      implementationFingerprintUnchanged:
        fingerprintOwnedFiles() === ownedFingerprintBefore,
    },
  }
  writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`)
  if (failures.length) {
    throw new AggregateError(
      failures.map((error) =>
        error instanceof Error ? error : new Error(String(error)),
      ),
      'os.org real-consumer canary child failed',
    )
  }
}

function ownedFixtureDirectories(parentRoot) {
  return readdirSync(os.tmpdir())
    .filter((name) => name.startsWith(fixturePrefix))
    .map((name) => path.join(os.tmpdir(), name))
    .filter((entry) => entry !== parentRoot)
}

async function matchingProcesses() {
  const processResult = await runCommand('/bin/ps', ['-axo', 'pid=,command='], {
    label: 'inspect os.org real-consumer canary processes',
    timeout: 30_000,
    maxCapturedBytes: 4 * 1024 * 1024,
  })
  return processResult.stdout
    .split('\n')
    .filter(
      (line) =>
        line.includes('validate-os-org-real-consumer-canary.mjs --child') ||
        line.includes('os-org-real-consumer-worker.ts'),
    )
}

async function verifyExternalState(
  expectedSourceFingerprint,
  expectedOwnedFingerprint,
  parentRoot,
  fixtureRoots = [],
) {
  assert.equal(
    fingerprintFiles(sourceRoot, sourceBoundaryFiles),
    expectedSourceFingerprint,
  )
  assert.equal(fingerprintOwnedFiles(), expectedOwnedFingerprint)
  for (const fixtureRoot of fixtureRoots) {
    assert.deepEqual(cacheFixtureMarkers(fixtureRoot), [])
  }
  assert.deepEqual(
    (await containerNames()).filter((name) => name.startsWith(containerPrefix)),
    [],
  )
  assert.deepEqual(ownedFixtureDirectories(parentRoot), [])
  assert.deepEqual(await matchingProcesses(), [])
}

async function runChildPhase(
  parentRoot,
  phase,
  expectedFailure,
  externalFingerprints,
) {
  const resultPath = path.join(parentRoot, `${phase}.json`)
  rmSync(resultPath, { force: true })
  let childError
  try {
    await runBoundedChild(process.execPath, [scriptPath, '--child'], {
      label: `os.org real-consumer ${phase}`,
      timeout: expectedFailure ? 180_000 : 900_000,
      termGrace: 1_000,
      cwd: root,
      env: {
        ...process.env,
        OS_ORG_REAL_CANARY_CHILD: '1',
        OS_ORG_REAL_CANARY_RESULT_PATH: resultPath,
        ...(expectedFailure ? { OS_ORG_REAL_CANARY_FAILURE_PROBE: '1' } : {}),
      },
      stdio: 'inherit',
    })
  } catch (error) {
    childError = error
  }
  assert.ok(existsSync(resultPath), `${phase} child did not write a result`)
  const result = JSON.parse(readFileSync(resultPath, 'utf8'))
  if (expectedFailure) {
    assert.ok(childError, 'failure probe unexpectedly exited zero')
    assert.equal(result.status, 'BLOCKED')
    assert.equal(result.intentionalFailure, true)
    assert.match(result.error, /intentional failure after tmpfs PostgreSQL/)
  } else {
    if (childError) {
      throw new Error(
        `${childError instanceof Error ? childError.message : String(childError)}\nChild evidence: ${result.error ?? 'none'}`,
        { cause: childError },
      )
    }
    assert.equal(result.status, 'PASS')
    assert.equal(result.intentionalFailure, false)
  }
  assert.deepEqual(result.cleanup, {
    containerAbsent: true,
    fixtureAbsent: true,
    sourceFingerprintUnchanged: true,
    starterCacheFixtureMarkersAbsent: true,
    implementationFingerprintUnchanged: true,
  })
  await verifyExternalState(
    externalFingerprints.source,
    externalFingerprints.owned,
    parentRoot,
    [result.evidence.fixtureRoot],
  )
  return result
}

function writeReport(result, failureProbe, fingerprints) {
  const evidence = result.evidence
  const lines = [
    '# os.org real-consumer cutover canary',
    '',
    '- Status: **PASS within bounded real-consumer scope**',
    '- Disposition: **review candidate; GAP-13 remains open**',
    `- Source (read-only): \`${sourceRoot}\``,
    `- Source boundary SHA-256: \`${fingerprints.source}\``,
    `- Canary SHA-256: \`${sha256(scriptPath)}\``,
    `- Worker SHA-256: \`${sha256(workerPath)}\``,
    `- Prisma adapter SHA-256: \`${sha256(prismaAdapterPath)}\``,
    `- Owned four-file aggregate: \`${fingerprints.owned}\``,
    `- Source Prisma SHA-256: \`${evidence.sourceSchemaHash}\``,
    `- Source GraphQL SHA-256: \`${evidence.sourceGraphqlHash}\``,
    '- Database/server mode: one bounded PostgreSQL 17 container with a tmpfs data directory; no application server',
    '',
    '## Exact evidence',
    '',
    `- **failure cleanup** — intentional post-readiness failure returned BLOCKED and externally verified container, fixture, process, source, cache, and implementation cleanup (${failureProbe.cleanup.containerAbsent ? 'pass' : 'fail'}).`,
    `- **source** — copied the real \`os.org\` access module byte-for-byte and import-adapted its seven real model initializers and auth config; source fingerprint remained unchanged.`,
    `- **migrations** — deployed all six exact source migration directories in order: ${evidence.migrationHistory.join(', ')}.`,
    `- **schema** — source-to-replacement Prisma diff emitted ${evidence.prismaSchemaSqlLines} SQL lines; post-cutover database drift was \`${evidence.schemaDrift}\`.`,
    '- **auth** — wrong-password failure stayed generic; real User/email/password auth issued and rehydrated member/admin cookies; role-backed dashboard access denied the member and allowed the admin.',
    '- **access** — anonymous Product/Price reads passed while protected reads/writes failed; member User/Instance/Subscription reads were owner-filtered; protected Product/Subscription/Role/User/Newsletter and foreign-owner/field writes were denied; omitted Instance owner auto-assigned the member after aligning Prisma with the existing pre-hook field-access boundary.',
    '- **CRUD** — admin GraphQL created and updated Role, User, Product, Price, Instance, Subscription, and Newsletter records; Product and Newsletter delete markers were deleted and absence-checked.',
    '- **persistence** — a fresh Node process reauthenticated and reloaded the created user/role, product/price, instance/subscription/user, newsletter, member-owned instance, and deletion state; direct PostgreSQL returned the same relationship graph.',
    '- **rollback** — restored the pre-CRUD custom-format dump into an independent database, reauthenticated through the replacement runtime, recovered source product/price/member/instance/subscription relationships, and proved all selected post-cutover rows absent.',
    '- **cleanup** — the tmpfs PostgreSQL container (with no Docker volume), fixture clone, worker processes, container dump files, and host dump were removed; source/implementation fingerprints remained exact and no fixture path leaked into starter caches.',
    '',
    '## Explicit residual boundaries',
    '',
    '- This is representative source-shaped data, not a sanitized production dump or production-sized timing/load evidence.',
    '- The source auth/model files are import-adapted in a disposable fixture; this is not an in-place sibling edit or deployed package replacement.',
    '- SMTP reset delivery and Railway deployment are deliberately stubbed and not invoked; external provider credentials, objects, delivery, and deployment continuity remain open.',
    '- The canary executes replacement GraphQL directly in fresh Node processes. Checkpoint 025 remains the separate accepted rendered-dashboard/Vite evidence; no new browser or production build claim is made here.',
    '- Session-cookie coexistence with the old Keystone deployment, live-write quiescence, production observation, rollback operators, and production domain traffic remain unproved.',
    '- This report does not modify `READINESS.md`, self-close GAP-13, or authorize package removal.',
  ]
  writeFileSync(reportPath, `${lines.join('\n')}\n`)
}

async function parentMain() {
  assertSourceContract()
  assert.ok(existsSync(workerPath), `Missing canary worker: ${workerPath}`)
  const parentRoot = mkdtempSync(path.join(os.tmpdir(), parentPrefix))
  const fingerprints = {
    source: fingerprintFiles(sourceRoot, sourceBoundaryFiles),
    owned: fingerprintOwnedFiles(),
  }
  try {
    await verifyExternalState(
      fingerprints.source,
      fingerprints.owned,
      parentRoot,
    )
    const failureProbe = await runChildPhase(
      parentRoot,
      'failure-probe',
      true,
      fingerprints,
    )
    const result = await runChildPhase(
      parentRoot,
      'success',
      false,
      fingerprints,
    )
    writeReport(result, failureProbe, fingerprints)
    await verifyExternalState(
      fingerprints.source,
      fingerprints.owned,
      parentRoot,
      [failureProbe.evidence.fixtureRoot, result.evidence.fixtureRoot],
    )
    console.log(
      `os.org real-consumer cutover canary passed; review evidence: ${reportPath}`,
    )
  } finally {
    rmSync(parentRoot, { recursive: true, force: true })
    assert.equal(existsSync(parentRoot), false)
  }
}

if (process.env.OS_ORG_REAL_CANARY_CHILD === '1') {
  await childMain().catch((error) => {
    console.error(redactError(error))
    process.exitCode = 1
  })
} else {
  await parentMain()
}
