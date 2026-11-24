import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import {
  assertMigrationIsSafe,
  inspectMigrationSql,
} from '../src/features/cms/migration-safety'

const execFileAsync = promisify(execFile)

type MigrationOptions = {
  name: string
  allowDestructive: boolean
}

function parseOptions(argv: string[]): MigrationOptions {
  const nameIndex = argv.findIndex((argument) => argument === '--name')
  const inlineName = argv.find((argument) => argument.startsWith('--name='))
  const name = inlineName?.slice('--name='.length) ?? argv[nameIndex + 1]
  if (!name || name.startsWith('--')) {
    throw new Error(
      'Usage: npm run migrate:gen -- --name <migration_name> [--allow-destructive]',
    )
  }

  return {
    name,
    allowDestructive: argv.includes('--allow-destructive'),
  }
}

async function run(command: string, args: string[]) {
  const result = await execFileAsync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 300_000,
    killSignal: 'SIGTERM',
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  return result.stdout
}

function migrationTimestamp() {
  const value = new Date()
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${value.getUTCFullYear()}${pad(value.getUTCMonth() + 1)}${pad(value.getUTCDate())}${pad(value.getUTCHours())}${pad(value.getUTCMinutes())}${pad(value.getUTCSeconds())}`
}

async function createMigrationWithDiff(name: string) {
  const migrationsRoot = path.join(process.cwd(), 'prisma/migrations')
  const diffArgs = [
    '--no-install',
    'prisma',
    'migrate',
    'diff',
    '--from-config-datasource',
    '--to-schema',
    'prisma/schema.prisma',
    '--script',
  ]
  const sql = await run('npx', diffArgs)
  const directory = path.join(migrationsRoot, `${migrationTimestamp()}_${name}`)
  await mkdir(directory, { recursive: false })
  await writeFile(path.join(directory, 'migration.sql'), sql)
  try {
    await readFile(path.join(migrationsRoot, 'migration_lock.toml'), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await writeFile(
      path.join(migrationsRoot, 'migration_lock.toml'),
      'provider = "postgresql"\n',
    )
  }
  console.warn(
    `Prisma migrate dev is non-interactive here; created ${path.relative(process.cwd(), directory)} with prisma migrate diff for the same schema transition.`,
  )
}

async function migrationDirectoryFor(name: string) {
  const migrationsRoot = path.join(process.cwd(), 'prisma/migrations')
  const entries = await readdir(migrationsRoot, { withFileTypes: true })
  const matches = entries
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(`_${name}`))
    .map((entry) => path.join(migrationsRoot, entry.name))
    .sort()
  return matches.at(-1)
}

async function migrationSql(directory: string) {
  return readFile(path.join(directory, 'migration.sql'), 'utf8')
}

async function main() {
  const options = parseOptions(process.argv.slice(2))

  // This mirrors Keystone's build-before-migrate contract: generated GraphQL,
  // AdminMeta, view-order, Prisma schema, and custom-view module artifacts are
  // refreshed before Prisma sees the model change.
  await run('npm', ['run', 'cms:generate'])

  let migrationDirectory = await migrationDirectoryFor(options.name)
  if (!migrationDirectory) {
    try {
      await run('npx', [
        '--no-install',
        'prisma',
        'migrate',
        'dev',
        '--create-only',
        '--name',
        options.name,
      ])
    } catch (error) {
      if (!String(error).match(/non-interactive|interactive command/i))
        throw error
      await createMigrationWithDiff(options.name)
    }
    migrationDirectory = await migrationDirectoryFor(options.name)
  }

  if (!migrationDirectory) {
    throw new Error(`Prisma did not create migration ${options.name}`)
  }

  const sql = await migrationSql(migrationDirectory)
  const risk = inspectMigrationSql(sql)
  console.log(
    `Migration ${path.basename(migrationDirectory)}: ${risk.destructive ? `destructive (${risk.operations.join(', ')})` : 'non-destructive'}`,
  )
  assertMigrationIsSafe(risk, {
    allowDestructive: options.allowDestructive,
    migrationName: options.name,
  })

  await run('npx', ['--no-install', 'prisma', 'migrate', 'deploy'])
  await run('npm', ['run', 'db:generate'])
  console.log(`Applied and refreshed Prisma Client for ${options.name}.`)
}

await main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
