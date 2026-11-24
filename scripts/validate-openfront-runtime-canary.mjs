import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
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
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { runBoundedChild, terminateChildGroup } from './lib/bounded-child.mjs'

const root = process.cwd()
const canaryHash = createHash('sha256')
  .update(readFileSync(path.resolve(process.argv[1])))
  .digest('hex')
const consumerProfiles = {
  'opensource.builders': {
    slug: 'opensource-builders',
    sourceRoot: '../opensource.builders',
    models: [
      'User',
      'Role',
      'Category',
      'ProprietaryApplication',
      'OpenSourceApplication',
      'Capability',
      'ProprietaryCapability',
      'OpenSourceCapability',
    ],
    dashboardList: 'OpenSourceApplication',
    dashboardContent: 'Open Source Applications',
    dashboardSeedContent: 'Starter Replacement',
    roleFields: [
      'canAccessDashboard',
      'canManagePeople',
      'canManageRoles',
      'canManageApplications',
      'canManageCategories',
      'canManageCapabilities',
    ],
  },
  'os.org': {
    slug: 'os-org',
    sourceRoot: '../os.org',
    models: [
      'User',
      'Role',
      'Product',
      'Price',
      'Instance',
      'Subscription',
      'Newsletter',
    ],
    dashboardList: 'Product',
    dashboardContent: 'Products',
    dashboardSeedContent: 'Canary Platform',
    roleFields: [
      'canAccessDashboard',
      'canManagePeople',
      'canManageRoles',
      'canCreateTodos',
      'canManageAllTodos',
      'canSeeOtherPeople',
      'canEditOtherPeople',
    ],
  },
}
const consumerName =
  process.env.OPENFRONT_CANARY_CONSUMER ?? 'opensource.builders'
const profile = consumerProfiles[consumerName]
assert.ok(profile, `Unknown Openfront canary consumer: ${consumerName}`)
const sourceRoot = path.resolve(
  process.env.OPENFRONT_CANARY_SOURCE ?? profile.sourceRoot,
)
const postgresContainer =
  process.env.OPENFRONT_CANARY_POSTGRES_CONTAINER ?? 'vibe-runtime-postgres'
const selectedModels = profile.models
const temporaryParent = path.join(root, '.cms-temp')
const temporaryRoot = mkdtempSync(
  path.join(temporaryParent, 'openfront-runtime-canary-'),
)
const databaseName = `tks_openfront_${profile.slug.replaceAll('-', '_')}_canary_${process.pid}_${Date.now()}`
const rollbackDatabaseName = `${databaseName}_rollback`
const reportPath = path.join(
  root,
  `reports/openfront-runtime-cutover-canary-${profile.slug}.md`,
)
const logPath = path.join(temporaryRoot, 'server.log')
let server
let serverOutput = []
let failure
const cleanupFailures = []
let preserveTemporaryRoot = false
let databaseCreated = false
let rollbackDatabaseCreated = false
const evidence = []
const sourceCacheDirectories = [
  path.join(root, 'node_modules/.cache/jiti'),
  path.join(root, 'node_modules/.vite'),
  path.join(root, 'node_modules/.nitro'),
  path.join(root, '.tanstack'),
]

function record(step, detail) {
  evidence.push({ step, detail })
  console.log(`[canary] ${step}: ${detail}`)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')
}

function walkFiles(directory, callback, relative = '') {
  if (!existsSync(directory)) return
  for (const name of readdirSync(directory).sort()) {
    const fullPath = path.join(directory, name)
    const stat = lstatSync(fullPath)
    const childRelative = path.join(relative, name)
    if (stat.isDirectory()) walkFiles(fullPath, callback, childRelative)
    else callback(fullPath, childRelative, stat)
  }
}

function canaryCacheMarkers() {
  const markers = []
  for (const directory of sourceCacheDirectories) {
    walkFiles(directory, (_fullPath, relative) => {
      if (relative.includes('openfront-runtime-canary-')) {
        markers.push(path.join(directory, relative))
      }
    })
  }
  return markers.sort()
}

function removeCanaryCacheResidue() {
  const markers = canaryCacheMarkers()
  for (const marker of markers) rmSync(marker, { force: true })
  return markers
}

function cacheFingerprint() {
  const hash = createHash('sha256')
  for (const directory of sourceCacheDirectories) {
    hash.update(`\\n[${directory}]\\n`)
    walkFiles(directory, (fullPath, relative) => {
      hash.update(`${relative}\\n`)
      hash.update(readFileSync(fullPath))
      hash.update('\\n')
    })
  }
  return hash.digest('hex')
}

const removedCacheResidue = removeCanaryCacheResidue()
const sourceCacheBefore = cacheFingerprint()
const sourceCacheSnapshotRoot = path.join(
  temporaryRoot,
  '.source-cache-snapshot',
)
let sourceCachesRestored = false

function snapshotSourceCaches() {
  mkdirSync(sourceCacheSnapshotRoot, { recursive: true })
  const manifest = sourceCacheDirectories.map((directory) => ({
    directory,
    exists: existsSync(directory),
  }))
  writeFileSync(
    path.join(sourceCacheSnapshotRoot, 'manifest.json'),
    `${JSON.stringify(manifest)}\n`,
  )
  for (const [index, entry] of manifest.entries()) {
    if (entry.exists) {
      cpSync(
        entry.directory,
        path.join(sourceCacheSnapshotRoot, String(index)),
        { recursive: true },
      )
    }
  }
}

function restoreSourceCaches() {
  if (sourceCachesRestored) return
  const manifestPath = path.join(sourceCacheSnapshotRoot, 'manifest.json')
  assert.ok(
    existsSync(manifestPath),
    'source cache snapshot is unavailable; refusing destructive restore',
  )
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  for (const [index, entry] of manifest.entries()) {
    const snapshot = path.join(sourceCacheSnapshotRoot, String(index))
    if (entry.exists) {
      assert.ok(
        existsSync(snapshot),
        `source cache snapshot missing: ${entry.directory}`,
      )
      rmSync(entry.directory, { recursive: true, force: true })
      cpSync(snapshot, entry.directory, { recursive: true })
    } else {
      rmSync(entry.directory, { recursive: true, force: true })
    }
  }
  sourceCachesRestored = true
}

snapshotSourceCaches()
if (removedCacheResidue.length) {
  console.log(
    `[canary] preflight: removed ${removedCacheResidue.length} stale canary cache markers`,
  )
}

async function run(command, args, options = {}) {
  const {
    label = `${command} ${args.join(' ')}`,
    timeout = 120_000,
    ...spawnOptions
  } = options
  const result = await runBoundedChild(command, args, {
    label,
    timeout,
    captureOutput: true,
    maxCapturedBytes: 32 * 1024 * 1024,
    cwd: root,
    env: process.env,
    ...spawnOptions,
  })
  return result.stdout
}

async function dockerExec(args, options = {}) {
  const {
    label = `docker exec ${args.join(' ')}`,
    timeout = 30_000,
    ...spawnOptions
  } = options
  return run('docker', ['exec', '-i', ...args], {
    label,
    timeout,
    ...spawnOptions,
  })
}

async function createDatabase(name) {
  await dockerExec([
    postgresContainer,
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'junaid',
    '-d',
    'postgres',
    '-c',
    `CREATE DATABASE ${name}`,
  ])
}

async function dropDatabase(name) {
  await dockerExec([
    postgresContainer,
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'junaid',
    '-d',
    'postgres',
    '-c',
    `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`,
  ])
}

function databaseUrl(name) {
  return `postgresql://junaid:runtime@127.0.0.1:5432/${name}?schema=public&connection_limit=2&pool_timeout=20`
}

async function assertDatabaseAbsent(name) {
  const result = (
    await dockerExec([
      postgresContainer,
      'psql',
      '-At',
      '-U',
      'junaid',
      '-d',
      'postgres',
      '-c',
      `SELECT datname FROM pg_database WHERE datname = '${name}';`,
    ])
  ).trim()
  assert.equal(result, '', `disposable database remains after cleanup: ${name}`)
}

async function stopServer() {
  const child = server
  if (!child) return
  await terminateChildGroup(child, 'canary Vite process group', {
    termGrace: 500,
    killWait: 5_000,
  })
  server = undefined
}

function linkFixtureDependencies(destination) {
  const sourceNodeModules = path.join(root, 'node_modules')
  const fixtureNodeModules = path.join(destination, 'node_modules')
  mkdirSync(fixtureNodeModules, { recursive: true })
  for (const entry of readdirSync(sourceNodeModules).sort()) {
    if (
      entry === '.bin' ||
      entry === '.cache' ||
      entry === '.vite' ||
      entry === '.nitro' ||
      entry === '.package-lock.json'
    ) {
      continue
    }
    symlinkSync(
      path.join(sourceNodeModules, entry),
      path.join(fixtureNodeModules, entry),
    )
  }
  const fixtureBin = path.join(fixtureNodeModules, '.bin')
  mkdirSync(fixtureBin, { recursive: true })
  for (const entry of readdirSync(
    path.join(sourceNodeModules, '.bin'),
  ).sort()) {
    symlinkSync(
      path.join(sourceNodeModules, '.bin', entry),
      path.join(fixtureBin, entry),
    )
  }
}

function copyRuntime(source, destination) {
  const entries = [
    'app',
    'public',
    'src',
    'scripts',
    'prisma',
    'package.json',
    'package-lock.json',
    'prisma.config.ts',
    'tsconfig.json',
    'vite.config.ts',
    'vitest.config.ts',
    'eslint.config.js',
    'prettier.config.js',
    'components.json',
  ]
  for (const entry of entries) {
    cpSync(path.join(source, entry), path.join(destination, entry), {
      recursive: true,
    })
  }
  const viteConfigPath = path.join(destination, 'vite.config.ts')
  const viteConfig = readFileSync(viteConfigPath, 'utf8')
    .replaceAll('\\n', '\n')
    .replace(
      "import { defineConfig } from 'vite'",
      "import { defineConfig, searchForWorkspaceRoot } from 'vite'\nimport { realpathSync } from 'node:fs'",
    )
    .replace(
      'const config = defineConfig({',
      "const config = defineConfig({\n  cacheDir: process.env.VITE_CACHE_DIR ?? '.cache/vite',\n  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), process.cwd(), realpathSync('node_modules'), ...(process.env.OPENFRONT_CANARY_DEPENDENCY_ROOT ? [realpathSync(process.env.OPENFRONT_CANARY_DEPENDENCY_ROOT)] : [])] } },",
    )
    .replace(
      'nitro({',
      "nitro({\n      buildDir: process.env.NITRO_BUILD_DIR ?? '.cache/nitro',",
    )
  writeFileSync(viteConfigPath, viteConfig)
  linkFixtureDependencies(destination)
}

function transplantModels(destination) {
  const modelDirectory = path.join(
    destination,
    'src/features/openfront-canary/models',
  )
  mkdirSync(modelDirectory, { recursive: true })
  const rewrite = (source) =>
    source
      .replaceAll("'@keystone-6/core/access'", "'../../cms/keystone/access'")
      .replaceAll('"@keystone-6/core/access"', '"../../cms/keystone/access"')
      .replaceAll("'@keystone-6/core/fields'", "'../../cms/keystone/fields'")
      .replaceAll('"@keystone-6/core/fields"', '"../../cms/keystone/fields"')
      .replaceAll("'@keystone-6/core'", "'../../cms/keystone/core'")
      .replaceAll('"@keystone-6/core"', '"../../cms/keystone/core"')
      .replaceAll("'../access'", "'../access'")
      .replaceAll(
        "'../../../lib/subscription-deployment'",
        "'../subscription-deployment'",
      )
      .replaceAll("'../../../lib/railway'", "'../railway'")
      .replaceAll("'../../../lib/newsletter'", "'../newsletter'")
  for (const model of selectedModels) {
    const sourcePath = path.join(
      sourceRoot,
      `features/keystone/models/${model}.ts`,
    )
    assert.ok(
      existsSync(sourcePath),
      `Missing Openfront source model: ${sourcePath}`,
    )
    writeFileSync(
      path.join(modelDirectory, `${model}.ts`),
      `// Transplanted read-only from ${sourcePath}\n${rewrite(
        readFileSync(sourcePath, 'utf8'),
      )}`,
    )
  }
  const sourceRegistry = path.join(
    sourceRoot,
    'features/keystone/models/index.ts',
  )
  writeFileSync(
    path.join(modelDirectory, 'index.ts'),
    `// Transplanted read-only from ${sourceRegistry}\n${readFileSync(
      sourceRegistry,
      'utf8',
    )}`,
  )
  const trackingPath = path.join(
    sourceRoot,
    'features/keystone/models/trackingFields.ts',
  )
  if (existsSync(trackingPath)) {
    writeFileSync(
      path.join(modelDirectory, 'trackingFields.ts'),
      `// Transplanted read-only from ${trackingPath}\n${rewrite(
        readFileSync(trackingPath, 'utf8'),
      )}`,
    )
  }
  if (profile.slug === 'os-org') {
    writeFileSync(
      path.join(
        destination,
        'src/features/openfront-canary/subscription-deployment.ts',
      ),
      `export function shouldStartSubscriptionDeployment({ operation, currentStatus, previousStatus }: { operation: string; currentStatus?: string | null; previousStatus?: string | null }) {\n  return (operation === 'create' || operation === 'update') && currentStatus === 'ACTIVE' && previousStatus !== 'ACTIVE'\n}\n`,
    )
    writeFileSync(
      path.join(destination, 'src/features/openfront-canary/railway.ts'),
      `export function isDeploymentType(value: unknown) { return ['openfront-ecommerce', 'openfront-restaurant', 'openship'].includes(String(value)) }\nexport async function checkUnassigned() { throw new Error('railway is outside this bounded canary') }\n`,
    )
    writeFileSync(
      path.join(destination, 'src/features/openfront-canary/newsletter.ts'),
      `export const newsletterVerticalOptions = []\n`,
    )
  }
  writeFileSync(
    path.join(destination, 'src/features/openfront-canary/access.ts'),
    `export type Session = { itemId: string; listKey: string; data: Record<string, unknown> }\n\nexport function isSignedIn({ session }: { session?: Session }) {\n  return Boolean(session)\n}\n\nconst allow = () => true\nconst signedIn = ({ session }: { session?: Session }) => Boolean(session)\n\nexport const permissions = {\n  canCreatePeople: allow,\n  canManagePeople: allow,\n  canManageRoles: allow,\n  canCreateTodos: allow,\n  canManageAllTodos: allow,\n  canSeeOtherPeople: allow,\n  canEditOtherPeople: allow,\n  canManageApplications: allow,\n  canManageCategories: allow,\n  canManageCapabilities: allow,\n}\n\nexport const rules = {\n  canReadPeople: signedIn,\n  canUpdatePeople: signedIn,\n  canReadTodos: signedIn,\n  canManageTodos: signedIn,\n  canReadOwnedInstances: signedIn,\n  canReadOwnedSubscriptions: signedIn,\n  canReadOwnBilling: signedIn,\n}\n`,
  )
  return sourceRegistry
}

function writeCanaryConfig(destination) {
  const sessionRoleFields = profile.roleFields
    .map((field) => `      ${field}`)
    .join('\\n')
  writeFileSync(
    path.join(destination, 'cms.config.ts'),
    `import { mergeSchemas } from '@graphql-tools/schema'\nimport { createAuth, statelessSessions } from './src/features/cms/keystone/auth'\nimport { config } from './src/features/cms/keystone/core'\nimport models from './src/features/openfront-canary/models'\n\nfunction extendGraphqlSchema(baseSchema) {\n  return mergeSchemas({\n    schemas: [baseSchema],\n    typeDefs: 'type Query { redirectToInit: Boolean }',\n    resolvers: {\n      Query: {\n        redirectToInit: async (_root, _args, context) =>\n          (await context.sudo().query.User.count({})) === 0,\n      },\n    },\n  })\n}\n\nconst { withAuth } = createAuth({\n  listKey: 'User',\n  identityField: 'email',\n  secretField: 'password',\n  initFirstItem: { fields: ['name', 'email', 'password'] },\n  sessionData: 'id\\n    name\\n    email\\n    role {\\n      id\\n${sessionRoleFields}\\n    }',\n})\n\nexport default withAuth(\n  config({\n    db: {\n      provider: 'postgresql',\n      url: 'env(\\"DATABASE_URL\\")',\n      prismaModelOrder: [${selectedModels.map((model) => `'${model}'`).join(', ')}],\n    },\n    session: statelessSessions({ maxAge: 60 * 60 }),\n    ui: {\n      basePath: '/dashboard',\n      isAccessAllowed: ({ session }) => Boolean(session),\n    },\n    graphql: { extendGraphqlSchema },\n    lists: models,\n  }),\n)\n`,
  )
}

async function prepareCanaryMigrations(destination, environment) {
  const migrationDirectory = path.join(destination, 'prisma/migrations')
  rmSync(migrationDirectory, { recursive: true, force: true })
  mkdirSync(migrationDirectory, { recursive: true })
  const sql = await run(
    'npx',
    [
      'prisma',
      'migrate',
      'diff',
      '--from-empty',
      '--to-schema',
      'prisma/schema.prisma',
      '--script',
    ],
    {
      cwd: destination,
      env: environment,
      label: 'Prisma migration diff',
      timeout: 120_000,
    },
  )
  const migrationPath = path.join(
    migrationDirectory,
    '00000000000000_openfront_canary',
  )
  mkdirSync(migrationPath, { recursive: true })
  writeFileSync(path.join(migrationPath, 'migration.sql'), sql)
  writeFileSync(
    path.join(migrationDirectory, 'migration_lock.toml'),
    'provider = "postgresql"\n',
  )
}

function writeCanarySeed(destination) {
  if (profile.slug === 'os-org') {
    writeFileSync(
      path.join(destination, 'prisma/seed.ts'),
      `import { hashPassword } from '../src/features/cms/auth/password'\nimport { createCmsPrismaClient } from '../src/features/cms/prisma-client'\n\nconst prisma = createCmsPrismaClient()\n\nasync function main() {\n  const role = await prisma.role.create({\n    data: {\n      id: 'canary_admin_role',\n      name: 'Canary Admin',\n      canAccessDashboard: true,\n      canManagePeople: true,\n      canManageRoles: true,\n      canCreateTodos: true,\n      canManageAllTodos: true,\n      canSeeOtherPeople: true,\n      canEditOtherPeople: true,\n    },\n  })\n  const user = await prisma.user.create({\n    data: {\n      id: 'canary_admin',\n      name: 'Canary Admin',\n      email: 'canary@example.com',\n      password: await hashPassword('canary-password'),\n      role: { connect: { id: role.id } },\n    },\n  })\n  const product = await prisma.product.create({\n    data: {\n      id: 'canary-product',\n      stripeProductId: 'prod_canary',\n      name: 'Canary Platform',\n      application: 'openfront',\n      description: 'Seeded os.org product',\n    },\n  })\n  const price = await prisma.price.create({\n    data: {\n      id: 'canary-price',\n      stripePriceId: 'price_canary',\n      description: 'Canary monthly plan',\n      unitAmount: 1900,\n      product: { connect: { id: product.id } },\n    },\n  })\n  const instance = await prisma.instance.create({\n    data: {\n      id: 'canary-instance',\n      domain: 'canary-instance',\n      deploymentType: 'openfront-restaurant',\n      projectId: 'project_canary',\n      projectStatus: 'ready',\n      user: { connect: { id: user.id } },\n    },\n  })\n  await prisma.subscription.create({\n    data: {\n      id: 'canary-subscription',\n      stripeSubscriptionId: 'sub_canary',\n      status: 'INCOMPLETE',\n      price: { connect: { id: price.id } },\n      instance: { connect: { id: instance.id } },\n      user: { connect: { id: user.id } },\n    },\n  })\n  console.info('Seeded os.org canary for ' + user.email)\n}\n\nmain().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())\n`,
    )
    return
  }
  writeFileSync(
    path.join(destination, 'prisma/seed.ts'),
    `import { hashPassword } from '../src/features/cms/auth/password'\nimport { createCmsPrismaClient } from '../src/features/cms/prisma-client'\n\nconst prisma = createCmsPrismaClient()\n\nasync function main() {\n  const adminRole = await prisma.role.create({\n    data: {\n      id: 'canary_admin_role',\n      name: 'Canary Admin',\n      canAccessDashboard: true,\n      canManagePeople: true,\n      canManageRoles: true,\n      canManageApplications: true,\n      canManageCategories: true,\n      canManageCapabilities: true,\n    },\n  })\n  const admin = await prisma.user.create({\n    data: {\n      id: 'canary_admin',\n      name: 'Canary Admin',\n      email: 'canary@example.com',\n      password: await hashPassword('canary-password'),\n      role: { connect: { id: adminRole.id } },\n    },\n  })\n  const category = await prisma.category.create({\n    data: { id: 'canary-category', name: 'Platform', slug: 'platform', description: 'Seeded Openfront category' },\n  })\n  const proprietary = await prisma.proprietaryApplication.create({\n    data: { id: 'canary-proprietary', name: 'Closed Suite', slug: 'closed-suite', category: { connect: { id: category.id } } },\n  })\n  const openSource = await prisma.openSourceApplication.create({\n    data: { id: 'canary-open-source', name: 'Starter Replacement', slug: 'starter-replacement', primaryAlternativeTo: { connect: { id: proprietary.id } }, status: 'active', githubStars: 12 },\n  })\n  const capability = await prisma.capability.create({\n    data: { id: 'canary-capability', name: 'Authentication', slug: 'authentication', category: 'authentication' },\n  })\n  await prisma.openSourceCapability.create({\n    data: { id: 'canary-open-capability', openSourceApplication: { connect: { id: openSource.id } }, capability: { connect: { id: capability.id } }, implementationNotes: 'Uses session-backed GraphQL auth', githubPath: 'src/features/cms/auth' },\n  })\n  await prisma.proprietaryCapability.create({\n    data: { id: 'canary-proprietary-capability', proprietaryApplication: { connect: { id: proprietary.id } }, capability: { connect: { id: capability.id } } },\n  })\n  console.info('Seeded Openfront canary for ' + admin.email)\n}\n\nmain().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())\n`,
  )
}

async function waitForServerOutput(pattern, description, timeout = 10_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const match = serverOutput.join('').match(pattern)
    if (match) return match
    await delay(50)
  }
  throw new Error(`canary server did not emit ${description}`)
}

async function waitForServer(url) {
  let lastStatus = 'connection refused'
  let lastBody = ''
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) {
      throw new Error(`canary server exited with code ${server.exitCode}`)
    }
    try {
      const response = await fetch(url)
      lastStatus = String(response.status)
      lastBody = await response.text()
      if (response.status >= 200 && response.status < 500) return response
    } catch {
      // Vite is still starting.
    }
    await delay(250)
  }
  throw new Error(
    `canary server did not become ready: ${url} (last status: ${lastStatus}; body: ${lastBody.slice(-1500)})`,
  )
}

async function graphql(url, query, cookie) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ query }),
  })
  const payload = await response.json()
  assert.equal(
    response.status,
    200,
    `GraphQL HTTP status was ${response.status}`,
  )
  assert.equal(
    payload.errors?.length ?? 0,
    0,
    payload.errors?.map((error) => error.message).join('\n') ?? 'GraphQL error',
  )
  return { payload, response }
}

function cookieFrom(response) {
  const setCookie = response.headers.get('set-cookie') ?? ''
  const match = setCookie.match(/keystonejs-session=[^;]+/i)
  assert.ok(match, `auth response did not set a session cookie: ${setCookie}`)
  return match[0]
}

async function capturePreCrudDump(backupPath) {
  const containerDumpPath = `/tmp/${databaseName}.dump`
  try {
    await dockerExec(
      [
        postgresContainer,
        'pg_dump',
        '--format=custom',
        '--no-owner',
        '--no-privileges',
        '-U',
        'junaid',
        '-d',
        databaseName,
        '-f',
        containerDumpPath,
      ],
      {
        label: 'PostgreSQL custom-format dump',
        timeout: 120_000,
      },
    )
    await run(
      'docker',
      ['cp', `${postgresContainer}:${containerDumpPath}`, backupPath],
      { label: 'copy PostgreSQL dump to fixture', timeout: 30_000 },
    )
  } finally {
    await dockerExec([postgresContainer, 'rm', '-f', containerDumpPath], {
      label: 'remove PostgreSQL dump from container',
      timeout: 30_000,
    })
    await dockerExec(
      [postgresContainer, 'test', '!', '-e', containerDumpPath],
      {
        label: 'verify PostgreSQL dump removed from container',
        timeout: 30_000,
      },
    )
  }
  record(
    'rollback',
    'captured a custom-format PostgreSQL dump after migration and seed before CRUD',
  )
}

async function proveOsOrgDomain(url, cookie, backupPath) {
  const initial = await graphql(
    `${url}/api/graphql`,
    `
      query {
        products {
          id
          name
          prices {
            id
            stripePriceId
          }
        }
        instances {
          id
          domain
          user {
            id
            email
          }
          subscription {
            id
            stripeSubscriptionId
          }
        }
        subscriptions {
          id
          stripeSubscriptionId
          price {
            id
            stripePriceId
          }
          instance {
            id
            domain
          }
          user {
            id
            email
          }
        }
      }
    `,
    cookie,
  )
  assert.equal(
    initial.payload.data.products[0].prices[0].stripePriceId,
    'price_canary',
  )
  assert.equal(
    initial.payload.data.instances[0].subscription.stripeSubscriptionId,
    'sub_canary',
  )
  assert.equal(
    initial.payload.data.subscriptions[0].instance.domain,
    'canary-instance',
  )
  record(
    'relationships',
    'seeded product/price/instance/subscription/user relationships resolved through GraphQL',
  )
  await capturePreCrudDump(backupPath)

  const product = await graphql(
    `${url}/api/graphql`,
    `
      mutation {
        createProduct(
          data: {
            stripeProductId: "prod_crud"
            name: "CRUD Product"
            application: "openfront"
          }
        ) {
          id
          name
        }
      }
    `,
    cookie,
  )
  const productId = product.payload.data.createProduct.id
  const price = await graphql(
    `${url}/api/graphql`,
    `mutation { createPrice(data: { stripePriceId: "price_crud", description: "CRUD monthly", unitAmount: 2900, product: { connect: { id: "${productId}" } } }) { id stripePriceId product { id name } } }`,
    cookie,
  )
  const priceId = price.payload.data.createPrice.id
  assert.equal(price.payload.data.createPrice.product.id, productId)
  const instance = await graphql(
    `${url}/api/graphql`,
    `
      mutation {
        createInstance(
          data: {
            domain: "crud-instance"
            deploymentType: "openfront-restaurant"
            projectStatus: "ready"
            user: { connect: { id: "canary_admin" } }
          }
        ) {
          id
          domain
          user {
            id
          }
        }
      }
    `,
    cookie,
  )
  const instanceId = instance.payload.data.createInstance.id
  const subscription = await graphql(
    `${url}/api/graphql`,
    `mutation { createSubscription(data: { stripeSubscriptionId: "sub_crud", status: "INCOMPLETE", price: { connect: { id: "${priceId}" } }, instance: { connect: { id: "${instanceId}" } }, user: { connect: { id: "canary_admin" } } }) { id stripeSubscriptionId price { id } instance { id } } }`,
    cookie,
  )
  assert.equal(
    subscription.payload.data.createSubscription.instance.id,
    instanceId,
  )
  record(
    'crud',
    'created os.org product, price, instance, and subscription relationships',
  )

  await graphql(
    `${url}/api/graphql`,
    `mutation { updateProduct(where: { id: "${productId}" }, data: { name: "CRUD Product Persisted" }) { id name } }`,
    cookie,
  )
  const persisted = await graphql(
    `${url}/api/graphql`,
    `query { products(where: { id: { equals: "${productId}" } }) { id name prices { stripePriceId } } instances(where: { id: { equals: "${instanceId}" } }) { subscription { stripeSubscriptionId } } }`,
    cookie,
  )
  assert.equal(
    persisted.payload.data.products[0].name,
    'CRUD Product Persisted',
  )
  assert.equal(
    persisted.payload.data.products[0].prices[0].stripePriceId,
    'price_crud',
  )
  assert.equal(
    persisted.payload.data.instances[0].subscription.stripeSubscriptionId,
    'sub_crud',
  )
  record(
    'persistence',
    'updated os.org domain data and reloaded it with PostgreSQL relationships',
  )
}

async function fetchAuthenticatedDashboard(url, listPath, cookie) {
  let target = `${url}/dashboard/${listPath}`
  for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
    const response = await fetch(target, {
      headers: { cookie },
      redirect: 'manual',
    })
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, html: await response.text() }
    }
    const location = response.headers.get('location')
    assert.ok(location, 'dashboard redirect did not include a location')
    target = new URL(location, response.url).toString()
  }
  throw new Error('dashboard redirect chain exceeded bounded limit')
}

async function proveRuntime(destination, url, backupPath) {
  const auth = await graphql(
    `${url}/api/graphql`,
    `
      mutation {
        authenticateUserWithPassword(
          email: "canary@example.com"
          password: "canary-password"
        ) {
          __typename
          ... on UserAuthenticationWithPasswordSuccess {
            sessionToken
            item {
              id
              email
            }
          }
          ... on UserAuthenticationWithPasswordFailure {
            message
          }
        }
      }
    `,
  )
  assert.equal(
    auth.payload.data.authenticateUserWithPassword.__typename,
    'UserAuthenticationWithPasswordSuccess',
  )
  const cookie = cookieFrom(auth.response)
  record(
    'auth',
    'admin password auth returned success and keystonejs-session cookie',
  )

  const adminMeta = JSON.parse(
    readFileSync(path.join(destination, '.cms/admin-meta.json'), 'utf8'),
  )
  const dashboardList = adminMeta.lists.find(
    (list) => list.key === profile.dashboardList,
  )
  assert.ok(
    dashboardList?.path,
    `generated admin metadata omitted ${profile.dashboardList} path`,
  )
  const { response: dashboard, html: dashboardHtml } =
    await fetchAuthenticatedDashboard(url, dashboardList.path, cookie)
  assert.equal(
    dashboard.status,
    200,
    'authenticated dashboard list route should return 200',
  )
  assert.equal(
    new URL(dashboard.url).pathname,
    `/dashboard/${dashboardList.path}`,
    'dashboard request should finish at the requested list pathname',
  )
  assert.match(
    dashboardHtml,
    new RegExp(escapeRegExp(profile.dashboardContent), 'i'),
    `rendered dashboard should contain ${profile.dashboardContent}`,
  )
  assert.match(
    dashboardHtml,
    new RegExp(escapeRegExp(profile.dashboardSeedContent), 'i'),
    `rendered dashboard should contain seeded ${profile.dashboardList} content`,
  )
  assert.doesNotMatch(
    dashboardHtml,
    /sign in|something went wrong|error boundary/i,
    'rendered authenticated dashboard must not show sign-in or error-boundary text',
  )
  record(
    'dashboard',
    `rendered ${profile.dashboardContent} with seeded ${profile.dashboardSeedContent} at final /dashboard/${dashboardList.path} pathname with no sign-in/error-boundary text`,
  )

  if (profile.slug === 'os-org') {
    await proveOsOrgDomain(url, cookie, backupPath)
    return
  }

  const initial = await graphql(
    `${url}/api/graphql`,
    `
      query {
        categories {
          id
          name
          proprietaryApplications {
            id
            slug
          }
        }
        openSourceApplications {
          id
          slug
          primaryAlternativeTo {
            id
            slug
          }
          capabilities {
            id
            capability {
              id
              slug
            }
          }
        }
      }
    `,
    cookie,
  )
  assert.equal(
    initial.payload.data.categories[0].proprietaryApplications[0].slug,
    'closed-suite',
  )
  assert.equal(
    initial.payload.data.openSourceApplications[0].primaryAlternativeTo.slug,
    'closed-suite',
  )
  record(
    'relationships',
    'seeded category/application/capability relationships resolved through GraphQL',
  )

  await capturePreCrudDump(backupPath)

  const created = await graphql(
    `${url}/api/graphql`,
    `
      mutation {
        createCategory(data: { name: "Canary CRUD", slug: "canary-crud" }) {
          id
          name
        }
      }
    `,
    cookie,
  )
  const categoryId = created.payload.data.createCategory.id
  await graphql(
    `${url}/api/graphql`,
    `mutation { createProprietaryApplication(data: { name: "Canary Vendor", slug: "canary-vendor", category: { connect: { id: "${categoryId}" } } }) { id slug category { id slug } } }`,
    cookie,
  )
  const app = await graphql(
    `${url}/api/graphql`,
    `
      mutation {
        createOpenSourceApplication(
          data: {
            name: "Canary App"
            slug: "canary-app"
            primaryAlternativeTo: { connect: { id: "canary-proprietary" } }
          }
        ) {
          id
          slug
          primaryAlternativeTo {
            id
            slug
          }
        }
      }
    `,
    cookie,
  )
  const appId = app.payload.data.createOpenSourceApplication.id
  const capability = await graphql(
    `${url}/api/graphql`,
    `mutation { createOpenSourceCapability(data: { openSourceApplication: { connect: { id: "${appId}" } }, capability: { connect: { id: "canary-capability" } }, implementationNotes: "Persisted canary relation" }) { id openSourceApplication { id slug } capability { id slug } } }`,
    cookie,
  )
  assert.equal(
    capability.payload.data.createOpenSourceCapability.openSourceApplication.id,
    appId,
  )
  record(
    'crud',
    'created category, proprietary application, open-source application, and capability relation',
  )

  await graphql(
    `${url}/api/graphql`,
    `mutation { updateOpenSourceApplication(where: { id: "${appId}" }, data: { name: "Canary App Persisted" }) { id name } }`,
    cookie,
  )
  const persisted = await graphql(
    `${url}/api/graphql`,
    `query { openSourceApplications(where: { id: { equals: "${appId}" } }) { id name capabilities { capability { slug } } } }`,
    cookie,
  )
  assert.equal(
    persisted.payload.data.openSourceApplications[0].name,
    'Canary App Persisted',
  )
  assert.equal(
    persisted.payload.data.openSourceApplications[0].capabilities[0].capability
      .slug,
    'authentication',
  )
  record(
    'persistence',
    'updated domain data and reloaded it with its relationship from PostgreSQL',
  )
}

async function restoreAndVerify(backupPath) {
  await createDatabase(rollbackDatabaseName)
  rollbackDatabaseCreated = true
  const containerDumpPath = `/tmp/${databaseName}-rollback.dump`
  try {
    await run(
      'docker',
      ['cp', backupPath, `${postgresContainer}:${containerDumpPath}`],
      {
        label: 'copy PostgreSQL dump into disposable container',
        timeout: 30_000,
      },
    )
    await dockerExec(
      [
        postgresContainer,
        'pg_restore',
        '--no-owner',
        '--no-privileges',
        '-U',
        'junaid',
        '-d',
        rollbackDatabaseName,
        containerDumpPath,
      ],
      { label: 'PostgreSQL custom-format restore', timeout: 120_000 },
    )
  } finally {
    await dockerExec([postgresContainer, 'rm', '-f', containerDumpPath], {
      label: 'remove disposable PostgreSQL dump',
      timeout: 30_000,
    })
    await dockerExec(
      [postgresContainer, 'test', '!', '-e', containerDumpPath],
      { label: 'verify disposable PostgreSQL dump removed', timeout: 30_000 },
    )
  }
  if (profile.slug === 'os-org') {
    const restored = (
      await dockerExec([
        postgresContainer,
        'psql',
        '-At',
        '-U',
        'junaid',
        '-d',
        rollbackDatabaseName,
        '-c',
        `SELECT p."name" || '|' || pr."stripePriceId" || '|' || i."domain" || '|' || s."stripeSubscriptionId" FROM "Product" p JOIN "Price" pr ON pr."product" = p."id" JOIN "Subscription" s ON s."price" = pr."id" JOIN "Instance" i ON i."subscription" = s."id" WHERE p."id" = 'canary-product';`,
      ])
    ).trim()
    assert.equal(
      restored,
      'Canary Platform|price_canary|canary-instance|sub_canary',
      'os.org rollback restore lost seeded relationship',
    )
    const createdRow = (
      await dockerExec([
        postgresContainer,
        'psql',
        '-At',
        '-U',
        'junaid',
        '-d',
        rollbackDatabaseName,
        '-c',
        `SELECT count(*) FROM "Product" WHERE "stripeProductId" = 'prod_crud';`,
      ])
    ).trim()
    assert.equal(
      createdRow,
      '0',
      'os.org rollback dump unexpectedly included post-cutover CRUD data',
    )
    record(
      'rollback',
      'restored os.org pre-CRUD dump and verified product/price/subscription/instance relationship plus absence of post-cutover row',
    )
    return
  }
  const restored = (
    await dockerExec([
      postgresContainer,
      'psql',
      '-At',
      '-U',
      'junaid',
      '-d',
      rollbackDatabaseName,
      '-c',
      `SELECT c."slug" || '|' || oa."slug" FROM "Category" c JOIN "ProprietaryApplication" pa ON pa."category" = c."id" JOIN "OpenSourceApplication" oa ON oa."primaryAlternativeTo" = pa."id" WHERE c."id" = 'canary-category' AND oa."id" = 'canary-open-source';`,
    ])
  ).trim()
  assert.equal(
    restored,
    'platform|starter-replacement',
    'rollback restore lost seeded relationship',
  )
  const createdRow = (
    await dockerExec([
      postgresContainer,
      'psql',
      '-At',
      '-U',
      'junaid',
      '-d',
      rollbackDatabaseName,
      '-c',
      `SELECT count(*) FROM "OpenSourceApplication" WHERE "slug" = 'canary-app';`,
    ])
  ).trim()
  assert.equal(
    createdRow,
    '0',
    'rollback dump unexpectedly included post-cutover CRUD data',
  )
  record(
    'rollback',
    'restored pre-CRUD dump and verified relationship plus absence of post-cutover row',
  )
}

function writeReport(status, error) {
  mkdirSync(path.dirname(reportPath), { recursive: true })
  const lines = [
    '# Openfront runtime cutover canary',
    '',
    `- Consumer: **${consumerName}**`,
    `- Canary script SHA-256: \`${canaryHash}\``,
    `- Status: **${status}**`,
    `- Source (read-only): \`${sourceRoot}\``,
    '- Access boundary: permissive compatibility scaffold only; source access-policy parity is not claimed.',
    `- Models transplanted: ${selectedModels.join(', ')}`,
    `- Disposable database: \`${databaseName}\``,
    `- Rollback database: \`${rollbackDatabaseName}\``,
    `- Temporary fixture: \`${temporaryRoot}\``,
    `- Source cache fingerprint before/after: \`${sourceCacheBefore}\` / \`${cacheFingerprint()}\``,
    `- Remaining source jiti/cache markers: ${canaryCacheMarkers().length}`,
    '',
    '## Exact evidence',
    ...evidence.map(({ step, detail }) => `- **${step}** — ${detail}`),
  ]
  if (error) {
    lines.push('', '## Blocker', '', `- ${error}`)
    if (existsSync(logPath)) lines.push(`- Server log: \`${logPath}\``)
  }
  writeFileSync(reportPath, `${lines.join('\n')}\n`)
}

try {
  assert.ok(
    existsSync(sourceRoot),
    `Openfront source is unavailable: ${sourceRoot}`,
  )
  assert.ok(
    existsSync(path.join(sourceRoot, 'features/keystone/models/index.ts')),
    'Openfront model registry is unavailable',
  )
  record('source', `read-only source registry found at ${sourceRoot}`)
  copyRuntime(root, temporaryRoot)
  transplantModels(temporaryRoot)
  writeCanaryConfig(temporaryRoot)
  writeCanarySeed(temporaryRoot)
  record(
    'transplant',
    `copied ${selectedModels.length} real Openfront model initializers into disposable starter fixture`,
  )
  record(
    'access-scaffold',
    'generated permissive access only to exercise the compatibility boundary; this is not source policy parity',
  )

  const environment = {
    ...process.env,
    DATABASE_URL: databaseUrl(databaseName),
    CMS_ADAPTER: 'prisma',
    NODE_ENV: 'test',
    SESSION_SECRET: 'openfront-runtime-canary-session-secret-32-bytes',
    CMS_DEV_AUTH_FALLBACK: 'false',
    JITI_FS_CACHE: 'false',
    VITE_CACHE_DIR: path.join(temporaryRoot, '.cache/vite'),
    NITRO_BUILD_DIR: path.join(temporaryRoot, '.cache/nitro'),
    OPENFRONT_CANARY_DEPENDENCY_ROOT: path.join(root, 'node_modules'),
    TSX_DISABLE_CACHE: '1',
  }
  await createDatabase(databaseName)
  databaseCreated = true
  record('database', `created disposable PostgreSQL database ${databaseName}`)
  await run('npm', ['run', 'cms:generate'], {
    cwd: temporaryRoot,
    env: environment,
    label: 'CMS generation',
    timeout: 300_000,
  })
  await run('npm', ['run', 'db:generate'], {
    cwd: temporaryRoot,
    env: environment,
    label: 'Prisma client generation',
    timeout: 300_000,
  })
  record(
    'generate',
    'generated CMS manifest, GraphQL schema, Prisma schema, and TypeScript artifacts',
  )
  await prepareCanaryMigrations(temporaryRoot, environment)
  await run('npm', ['run', 'migrate'], {
    cwd: temporaryRoot,
    env: environment,
    label: 'Prisma migration deploy',
    timeout: 300_000,
  })
  await run('npm', ['run', 'db:seed'], {
    cwd: temporaryRoot,
    env: environment,
    label: 'Prisma canary seed',
    timeout: 300_000,
  })
  record(
    'migrate',
    'applied generated Prisma migrations and seeded representative Openfront data',
  )

  const backupPath = path.join(temporaryRoot, 'pre-crud.dump')
  const port = 3417 + (process.pid % 100)
  server = spawn(
    process.execPath,
    [
      path.join(root, 'scripts/fixtures/openfront-vite-launcher.mjs'),
      'npx',
      'vite',
      'dev',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
    ],
    {
      cwd: temporaryRoot,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    },
  )
  serverOutput = []
  server.stdout.on('data', (chunk) => serverOutput.push(String(chunk)))
  server.stderr.on('data', (chunk) => serverOutput.push(String(chunk)))
  server.on('close', () => {
    if (existsSync(temporaryRoot)) {
      writeFileSync(logPath, serverOutput.join(''))
    }
  })
  const url = `http://127.0.0.1:${port}`
  await waitForServer(`${url}/dashboard/signin`)
  record('run', `bounded Vite runtime became ready at ${url}`)
  if (process.env.OPENFRONT_CANARY_FAILURE_PROBE === '1') {
    const descendantMatch = await waitForServerOutput(
      /\[canary-launcher\] stubborn Vite-group descendant (\d+)/,
      'the stubborn Vite-group descendant PID',
    )
    const descendantPid = Number(descendantMatch[1])
    assert.ok(Number.isSafeInteger(descendantPid) && descendantPid > 0)
    record(
      'failure-probe',
      `Vite launcher seeded TERM-ignoring non-detached descendant ${descendantPid} in the owned Vite process group`,
    )
    throw new Error('intentional canary failure after Vite start')
  }
  await proveRuntime(temporaryRoot, url, backupPath)
  await stopServer()
  record('cleanup', 'bounded Vite child exited after runtime acceptance')
  await restoreAndVerify(backupPath)
} catch (error) {
  if (serverOutput.length && existsSync(temporaryRoot)) {
    writeFileSync(logPath, serverOutput.join(''))
  }
  const serverDiagnostic = serverOutput.join('').trim()
  const message = error instanceof Error ? error.message : String(error)
  failure = serverDiagnostic
    ? `${message}; server output: ${serverDiagnostic.slice(-2000)}`
    : message
} finally {
  const cleanup = async (action, { preserveTempOnFailure = false } = {}) => {
    try {
      await action()
    } catch (error) {
      if (preserveTempOnFailure) preserveTemporaryRoot = true
      cleanupFailures.push(
        error instanceof Error ? error.message : String(error),
      )
    }
  }
  await cleanup(() => stopServer())
  await cleanup(() => restoreSourceCaches(), { preserveTempOnFailure: true })
  if (rollbackDatabaseCreated) {
    await cleanup(async () => {
      await dropDatabase(rollbackDatabaseName)
      await assertDatabaseAbsent(rollbackDatabaseName)
      rollbackDatabaseCreated = false
      record(
        'cleanup',
        `removed and verified rollback database ${rollbackDatabaseName}`,
      )
    })
  }
  if (databaseCreated) {
    await cleanup(async () => {
      await dropDatabase(databaseName)
      await assertDatabaseAbsent(databaseName)
      databaseCreated = false
      record(
        'cleanup',
        `removed and verified disposable database ${databaseName}`,
      )
    })
  }
  if (
    process.env.OPENFRONT_CANARY_KEEP_TEMP !== '1' &&
    !preserveTemporaryRoot
  ) {
    await cleanup(async () => {
      rmSync(temporaryRoot, { recursive: true, force: true })
      assert.equal(
        existsSync(temporaryRoot),
        false,
        'canary temporary fixture remains',
      )
      record('cleanup', 'removed and verified temporary fixture absence')
    })
  } else {
    console.error(`kept canary fixture for diagnosis: ${temporaryRoot}`)
  }
}

if (cleanupFailures.length) {
  failure = [failure, ...cleanupFailures].filter(Boolean).join('; ')
}
const sourceCacheAfter = cacheFingerprint()
if (!failure) {
  try {
    assert.equal(
      sourceCacheAfter,
      sourceCacheBefore,
      'source cache fingerprint changed during canary; cleanup is not trustworthy',
    )
    assert.equal(
      canaryCacheMarkers().length,
      0,
      'canary cache markers remain in source caches',
    )
    record(
      'cleanup',
      `source cache fingerprint unchanged (${sourceCacheAfter}); jiti/cache marker absence verified after final cleanup`,
    )
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
}

if (failure) {
  writeReport('BLOCKED', failure)
  console.error(`Openfront runtime cutover canary blocked: ${failure}`)
  process.exitCode = 1
} else {
  writeReport('PASS')
  console.log(
    `Openfront runtime cutover canary passed; evidence: ${reportPath}`,
  )
}
