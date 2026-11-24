import assert from 'node:assert/strict'
import { runBoundedChild } from './lib/bounded-child.mjs'

const container =
  process.env.PARITY_POSTGRES_CONTAINER ?? 'vibe-runtime-postgres'
const port = process.env.PARITY_POSTGRES_PORT ?? '5432'
const database = `tks_field_zoo_${process.pid}_${Date.now()}`

async function run(label, command, args, options = {}) {
  return runBoundedChild(command, args, {
    label,
    timeout: options.timeout ?? 180_000,
    termGrace: 1_000,
    env: options.env ?? process.env,
    captureOutput: options.captureOutput ?? false,
    ...(options.captureOutput ? {} : { stdio: 'inherit' }),
  })
}

async function running() {
  const result = await run(
    'field-zoo PostgreSQL state',
    'docker',
    ['inspect', '--format', '{{.State.Running}}', container],
    { captureOutput: true, timeout: 30_000 },
  )
  return result.stdout.trim() === 'true'
}

async function ready() {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try {
      await run(
        'field-zoo PostgreSQL readiness',
        'docker',
        ['exec', container, 'pg_isready', '-q'],
        { captureOutput: true, timeout: 5_000 },
      )
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  throw new Error('PostgreSQL did not become ready')
}

const initiallyRunning = await running()
let databaseUrl
try {
  if (!initiallyRunning)
    await run('start disposable PostgreSQL', 'docker', ['start', container])
  await ready()
  const credentials = await run(
    'field-zoo PostgreSQL credentials',
    'docker',
    [
      'exec',
      container,
      'sh',
      '-c',
      'printf "%s\\0%s\\0" "$POSTGRES_USER" "$POSTGRES_PASSWORD"',
    ],
    { captureOutput: true, timeout: 30_000 },
  )
  const [user, password] = credentials.stdout.split('\0')
  assert.ok(user && password)
  databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}`
  await run(
    'create disposable field-zoo database',
    'docker',
    ['exec', container, 'createdb', '-U', user, database],
    { timeout: 30_000 },
  )

  await run(
    'field-zoo Prisma browser matrix',
    process.execPath,
    ['scripts/validate-dashboard-arbitrary-browser.mjs'],
    {
      env: {
        ...process.env,
        CMS_ADAPTER: 'prisma',
        DATABASE_URL: databaseUrl,
        DASHBOARD_FIELD_ZOO: '1',
        DASHBOARD_FIELD_ZOO_PRISMA: '1',
      },
    },
  )
  await run(
    'verify field-zoo Prisma rows',
    'docker',
    [
      'exec',
      container,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      user,
      '-d',
      database,
      '-c',
      `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM "FieldZoo" WHERE title = 'Zoo dashboard item updated') THEN RAISE EXCEPTION 'FieldZoo row was not persisted'; END IF;
      IF NOT EXISTS (SELECT 1 FROM "ZooRelated" WHERE label = 'Zoo relation') THEN RAISE EXCEPTION 'ZooRelated row was not persisted'; END IF;
    END $$;`,
    ],
    { timeout: 30_000 },
  )
  console.log(
    `Field-zoo disposable Prisma browser matrix passed for ${database}.`,
  )
} finally {
  const cleanupErrors = []
  try {
    if (databaseUrl) {
      const credentials = await run(
        'field-zoo cleanup credentials',
        'docker',
        ['exec', container, 'sh', '-c', 'printf "%s" "$POSTGRES_USER"'],
        { captureOutput: true, timeout: 30_000 },
      )
      await run(
        'drop disposable field-zoo database',
        'docker',
        [
          'exec',
          container,
          'dropdb',
          '--if-exists',
          '--force',
          '-U',
          credentials.stdout.trim(),
          database,
        ],
        { timeout: 30_000 },
      )
    }
  } catch (error) {
    cleanupErrors.push(error)
  }
  try {
    const finalRunning = await running()
    if (!initiallyRunning && finalRunning)
      await run('stop disposable PostgreSQL', 'docker', ['stop', container], {
        timeout: 30_000,
      })
  } catch (error) {
    cleanupErrors.push(error)
  }
  if (cleanupErrors.length)
    throw new AggregateError(cleanupErrors, 'Field-zoo Prisma cleanup failed')
}
