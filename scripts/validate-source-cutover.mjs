import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const sourceMigrations = path.resolve('../next-keystone-starter/migrations')
const temporaryRoot = path.resolve('.cms-temp')
mkdirSync(temporaryRoot, { recursive: true })
const temporaryDirectory = mkdtempSync(
  path.join(temporaryRoot, 'source-cutover-'),
)
const sourceMigrationDirectory = path.join(temporaryDirectory, 'migrations')
const containerName = `tks-source-cutover-${process.pid}-${Date.now()}`
let containerStarted = false

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  })
}

function dockerExec(args, options = {}) {
  return execFileSync('docker', ['exec', '-i', ...args], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  })
}

try {
  assert.ok(
    readFileSync(path.join(sourceMigrations, 'migration_lock.toml'), 'utf8'),
    'source migration history is unavailable',
  )
  mkdirSync(sourceMigrationDirectory, { recursive: true })
  for (const migrationName of [
    '20250529211349_initial_migration',
    '20250618162316_add_description_field_to_todo',
    '20250621232051_add_all_fields',
    '20250704004833_add_image_field',
    '20250704011715_make_todoimage_a_separate_model',
    '20250806014640_update_user_to_include_reset_token_field',
    '20250815215522_add_multi_select_field_to_todo_model',
  ]) {
    cpSync(
      path.join(sourceMigrations, migrationName),
      path.join(sourceMigrationDirectory, migrationName),
      { recursive: true },
    )
  }
  cpSync(
    path.join(sourceMigrations, 'migration_lock.toml'),
    path.join(sourceMigrationDirectory, 'migration_lock.toml'),
  )
  cpSync(
    path.join(root, 'prisma/schema.prisma'),
    path.join(temporaryDirectory, 'schema.prisma'),
  )
  const temporaryConfigPath = path.join(temporaryDirectory, 'prisma.config.ts')
  writeFileSync(
    temporaryConfigPath,
    `import { defineConfig } from 'prisma/config'\n\nexport default defineConfig({\n  schema: ${JSON.stringify(path.join(temporaryDirectory, 'schema.prisma'))},\n  migrations: { path: ${JSON.stringify(sourceMigrationDirectory)} },\n  datasource: { url: process.env.DATABASE_URL! },\n})\n`,
  )

  run('docker', [
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
  let ready = false
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      dockerExec([containerName, 'pg_isready', '-U', 'cms', '-d', 'cms'])
      ready = true
      break
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
    }
  }
  assert.ok(ready, 'disposable PostgreSQL did not become ready')

  const portOutput = run('docker', ['port', containerName, '5432/tcp']).trim()
  const port = portOutput.split(':').at(-1)
  assert.match(port ?? '', /^\d+$/)
  const databaseUrl = `postgresql://cms:cms@127.0.0.1:${port}/cms`
  const environment = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    CMS_ADAPTER: 'prisma',
    NODE_ENV: 'test',
    SESSION_SECRET: 'source-cutover-test-session-secret-32-bytes',
  }

  run('npx', ['prisma', 'migrate', 'deploy', '--config', temporaryConfigPath], {
    env: environment,
  })

  const representativeSourceData = /* sql */ `
    INSERT INTO "Role" (
      "id", "name", "canCreateTodos", "canManageAllTodos",
      "canSeeOtherPeople", "canEditOtherPeople", "canManagePeople",
      "canManageRoles", "canAccessDashboard"
    ) VALUES (
      'source_role', 'Source Admin', true, true, true, true, true, true, true
    );

    INSERT INTO "User" ("id", "name", "email", "password", "role")
    VALUES (
      'source_user', 'Source User', 'source@example.com',
      '$2b$10$abcdefghijklmnopqrstuuQ7RjOaYQzM2Q7j7N8M6w5F4e3D2c1B0',
      'source_role'
    );

    INSERT INTO "Todo" (
      "id", "label", "description", "isComplete", "status", "priority",
      "tags", "dueDate", "weight", "budget", "isPrivate", "largeNumber",
      "metadata", "assignedTo"
    ) VALUES (
      'source_todo', 'Source migration todo',
      '[{"type":"paragraph","children":[{"text":"Source document"}]}]'::jsonb,
      false, 'in_progress', 4, '["migration","cutover"]'::jsonb,
      '2026-07-18T12:00:00.000Z', 1.5, 42.50, false,
      9007199254740993, '{"origin":"next-keystone-starter"}'::jsonb,
      'source_user'
    );

    INSERT INTO "TodoImage" (
      "id", "imagePath", "altText", "metadata"
    ) VALUES (
      'source_image', '/source/image.png', 'Source image',
      '{"origin":"next-keystone-starter"}'::jsonb
    );

    INSERT INTO "_Todo_todoImages" ("A", "B")
    VALUES ('source_todo', 'source_image');
  `
  dockerExec(
    [containerName, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'cms', '-d', 'cms'],
    { input: representativeSourceData },
  )

  const sourceBackup = execFileSync(
    'docker',
    [
      'exec',
      containerName,
      'pg_dump',
      '--no-owner',
      '--no-privileges',
      '-U',
      'cms',
      '-d',
      'cms',
    ],
    { encoding: null, stdio: ['ignore', 'pipe', 'pipe'] },
  )

  run('npm', ['run', 'migrate'], { env: environment })
  run('npx', ['prisma', 'migrate', 'status'], { env: environment })
  const schemaDiff = run(
    'npx',
    [
      'prisma',
      'migrate',
      'diff',
      '--from-config-datasource',
      '--to-schema',
      'prisma/schema.prisma',
      '--exit-code',
    ],
    { env: environment },
  )
  assert.match(schemaDiff, /No difference detected/)

  run('npx', ['tsx', 'scripts/validate-source-cutover-runtime.ts'], {
    env: environment,
  })

  dockerExec([containerName, 'createdb', '-U', 'cms', 'cms_rollback'])
  dockerExec(
    [
      containerName,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'cms',
      '-d',
      'cms_rollback',
    ],
    { input: sourceBackup },
  )
  const rollbackData = dockerExec([
    containerName,
    'psql',
    '-At',
    '-U',
    'cms',
    '-d',
    'cms_rollback',
    '-c',
    `SELECT t."label" || '|' || r."B" FROM "Todo" t JOIN "_Todo_todoImages" r ON r."A" = t."id" WHERE t."id" = 'source_todo';`,
  ]).trim()
  assert.equal(
    rollbackData,
    'Source migration todo|source_image',
    'rollback restore did not recover the original source data and relationship',
  )
  const rollbackIndexes = dockerExec([
    containerName,
    'psql',
    '-At',
    '-U',
    'cms',
    '-d',
    'cms_rollback',
    '-c',
    `SELECT indexname FROM pg_indexes WHERE tablename = '_Todo_todoImages' ORDER BY indexname;`,
  ])
  assert.match(rollbackIndexes, /_Todo_todoImages_AB_unique/)
  assert.doesNotMatch(rollbackIndexes, /_Todo_todoImages_AB_pkey/)

  console.log(
    'Source migration cutover validation passed: seven source migrations, representative data, Prisma 7 adaptation, replacement GraphQL read/write, no drift, and dump/restore rollback.',
  )
} finally {
  if (containerStarted) {
    try {
      run('docker', ['rm', '-f', containerName])
    } catch {
      // The --rm container may already be gone.
    }
  }
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
