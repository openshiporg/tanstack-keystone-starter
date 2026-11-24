import assert from 'node:assert/strict'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const containerName = `tks-access-parity-${process.pid}-${Date.now()}`
let containerStarted = false

function docker(args) {
  return execFileSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

async function run(command, args, env) {
  const result = await execFileAsync(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  })
  return `${result.stdout ?? ''}${result.stderr ?? ''}`
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
  throw new Error('Disposable PostgreSQL did not become ready')
}

function parseWorker(output, expectedAdapter) {
  const line = output
    .trim()
    .split(/\r?\n/)
    .findLast((entry) => entry.startsWith('{'))
  assert(line, `${expectedAdapter} worker did not emit JSON evidence`)
  const evidence = JSON.parse(line)
  assert.equal(evidence.adapter, expectedAdapter)
  assert.equal(evidence.topLevelUsers, 1)
  assert.equal(evidence.readDenial, 'null-empty-zero')
  return evidence
}

try {
  const common = {
    NODE_ENV: 'test',
    SESSION_SECRET: 'access-parity-secret-at-least-32-characters',
  }
  const memory = parseWorker(
    await run(
      'npx',
      ['--no-install', 'tsx', 'scripts/fixtures/cms-access-parity-worker.ts'],
      {
        ...common,
        CMS_ADAPTER: 'memory',
        CMS_BOOTSTRAP_MODE: 'seeded',
        DATABASE_URL: '',
      },
    ),
    'memory',
  )

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
  const port = docker(['port', containerName, '5432/tcp'])
    .trim()
    .split(':')
    .at(-1)
  assert.match(port, /^\d+$/)
  const databaseUrl = `postgresql://cms:cms@127.0.0.1:${port}/cms`
  const prismaEnv = {
    ...common,
    CMS_ADAPTER: 'prisma',
    DATABASE_URL: databaseUrl,
  }
  await run('npm', ['run', 'migrate'], prismaEnv)
  await run('npm', ['run', 'db:seed:demo'], prismaEnv)
  const prisma = parseWorker(
    await run(
      'npx',
      ['--no-install', 'tsx', 'scripts/fixtures/cms-access-parity-worker.ts'],
      prismaEnv,
    ),
    'prisma',
  )

  console.log(
    JSON.stringify({
      status: 'passed',
      memory,
      prisma,
      targetListAccess: 'enforced-for-items-and-counts',
    }),
  )
} finally {
  if (containerStarted) {
    try {
      docker(['rm', '-f', containerName])
    } catch {
      // Docker --rm may already have removed the container.
    }
  }
  const names = docker(['ps', '-a', '--format', '{{.Names}}'])
    .split(/\r?\n/)
    .filter(Boolean)
  assert(!names.includes(containerName), 'disposable PostgreSQL leaked')
}
