import assert from 'node:assert/strict'

import { runBoundedChild } from './lib/bounded-child.mjs'

const container =
  process.env.PARITY_POSTGRES_CONTAINER ?? 'vibe-runtime-postgres'
const postgresPort = process.env.PARITY_POSTGRES_PORT ?? '5432'
const databaseName = `tks_parity_browser_${process.pid}_${Date.now()}`
assert.match(postgresPort, /^\d+$/, 'PostgreSQL port must be numeric')

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

async function containerIsRunning() {
  const result = await run(
    'PostgreSQL container state inspection',
    'docker',
    ['inspect', '--format', '{{.State.Running}}', container],
    { timeout: 30_000, captureOutput: true },
  )
  return result.stdout.trim() === 'true'
}

async function waitForPostgresReadiness() {
  const deadline = Date.now() + 30_000
  let lastError
  while (Date.now() < deadline) {
    try {
      await run(
        'PostgreSQL readiness probe',
        'docker',
        ['exec', container, 'pg_isready', '-q'],
        { timeout: 5_000, captureOutput: true },
      )
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  throw new Error('PostgreSQL container did not become ready', {
    cause: lastError,
  })
}

async function dropDisposableDatabase() {
  await run(
    'disposable PostgreSQL cleanup',
    'docker',
    [
      'exec',
      container,
      'sh',
      '-c',
      'dropdb --if-exists --force -U "$POSTGRES_USER" "$1"',
      'sh',
      databaseName,
    ],
    { timeout: 30_000 },
  )
}

async function verifyDatabaseRemoved() {
  await run(
    'disposable PostgreSQL absence check',
    'docker',
    [
      'exec',
      container,
      'sh',
      '-c',
      `test "$(psql -U "$POSTGRES_USER" -d postgres -Atqc "SELECT count(*) FROM pg_database WHERE datname = '${databaseName}'")" = 0`,
    ],
    { timeout: 30_000 },
  )
}

async function restoreContainerAndDatabase(initiallyRunning) {
  const errors = []
  let running = false
  try {
    running = await containerIsRunning()
  } catch (error) {
    errors.push(error)
  }
  if (!running) {
    try {
      await run('PostgreSQL cleanup startup', 'docker', ['start', container])
      running = true
    } catch (error) {
      errors.push(error)
    }
  }
  if (running) {
    try {
      await waitForPostgresReadiness()
      if (process.env.PARITY_POSTGRES_CLEANUP_READINESS_FAILURE_PROBE === '1') {
        throw new Error('Intentional cleanup readiness failure probe')
      }
    } catch (error) {
      errors.push(error)
    }
    try {
      await dropDisposableDatabase()
    } catch (error) {
      errors.push(error)
    }
    try {
      await verifyDatabaseRemoved()
    } catch (error) {
      errors.push(error)
    }
  }
  let finalRunning = running
  try {
    finalRunning = await containerIsRunning()
  } catch (error) {
    errors.push(error)
  }
  if (!initiallyRunning && finalRunning) {
    try {
      await run('temporary PostgreSQL container shutdown', 'docker', [
        'stop',
        container,
      ])
      finalRunning = false
    } catch (error) {
      errors.push(error)
    }
  } else if (initiallyRunning && !finalRunning) {
    try {
      await run('PostgreSQL initial-state restoration', 'docker', [
        'start',
        container,
      ])
      finalRunning = true
    } catch (error) {
      errors.push(error)
    }
  }
  try {
    assert.equal(
      await containerIsRunning(),
      initiallyRunning,
      'PostgreSQL container state was not restored',
    )
  } catch (error) {
    errors.push(error)
  }
  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      'Disposable PostgreSQL lifecycle cleanup failed',
    )
  }
}

const initiallyRunning = await containerIsRunning()
let postgresUser
let databaseUrl

try {
  if (!initiallyRunning) {
    await run('temporary PostgreSQL container startup', 'docker', [
      'start',
      container,
    ])
  }
  await waitForPostgresReadiness()

  const credentialProbe = await run(
    'PostgreSQL container credential inspection',
    'docker',
    [
      'exec',
      container,
      'sh',
      '-c',
      'printf "%s\\0%s\\0" "$POSTGRES_USER" "$POSTGRES_PASSWORD"',
    ],
    { timeout: 30_000, captureOutput: true },
  )
  const [containerUser, containerPassword, credentialRemainder] =
    credentialProbe.stdout.split('\0')
  assert.equal(
    credentialRemainder,
    '',
    'PostgreSQL credential probe returned an invalid shape',
  )
  postgresUser = process.env.PARITY_POSTGRES_USER ?? containerUser ?? 'postgres'
  const postgresPassword =
    process.env.PARITY_POSTGRES_PASSWORD ?? containerPassword
  assert.ok(postgresUser, 'PostgreSQL container user was not configured')
  assert.ok(
    postgresPassword,
    'PostgreSQL container password was not configured',
  )
  databaseUrl = `postgresql://${encodeURIComponent(postgresUser)}:${encodeURIComponent(postgresPassword)}@127.0.0.1:${postgresPort}/${databaseName}`

  await run(
    'disposable PostgreSQL creation',
    'docker',
    ['exec', container, 'createdb', '-U', postgresUser, databaseName],
    { timeout: 30_000 },
  )
  if (process.env.PARITY_POSTGRES_STOP_AFTER_CREATE_PROBE === '1') {
    await run('forced post-create PostgreSQL stop', 'docker', [
      'stop',
      container,
    ])
    throw new Error('Intentional post-create PostgreSQL stop probe')
  }

  const responsiveNoBreakToken = `R${'7K9M2Q4X8V6N3P5T1Z0C'.repeat(8)}`
  const responsiveLabel = `Responsive coverage label with realistic spaced words and identifier ${responsiveNoBreakToken}`
  const environment = {
    ...process.env,
    CMS_ADAPTER: 'prisma',
    DATABASE_URL: databaseUrl,
    DASHBOARD_BROWSER_RESPONSIVE_LABEL: responsiveLabel,
  }
  await run('Prisma migration deploy', 'npm', ['run', 'migrate'], {
    env: environment,
  })
  await run('Prisma demo seed', 'npm', ['run', 'db:seed'], {
    env: environment,
  })
  await run('current-source production build', 'npm', ['run', 'build'], {
    env: environment,
  })

  process.env.CMS_ADAPTER = 'prisma'
  process.env.DATABASE_URL = databaseUrl
  process.env.DASHBOARD_BROWSER_CURRENT_BUILD = '1'
  process.env.DASHBOARD_BROWSER_MATRIX_MODE = 'prisma'
  process.env.DASHBOARD_BROWSER_RESPONSIVE_LABEL = responsiveLabel
  await import(`./validate-dashboard-browser.mjs?prisma=${Date.now()}`)

  await run(
    'Prisma browser persistence verification',
    'docker',
    [
      'exec',
      container,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      postgresUser,
      '-d',
      databaseName,
      '-c',
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM "Role" WHERE name = 'Browser matrix role' AND length(id) >= 20) THEN RAISE EXCEPTION 'browser Role missing or id is unrealistic'; END IF;
        IF NOT EXISTS (SELECT FROM "User" WHERE email = 'browser-matrix@example.com' AND length(id) >= 20) THEN RAISE EXCEPTION 'browser User missing or id is unrealistic'; END IF;
        IF NOT EXISTS (SELECT FROM "TodoImage" WHERE "altText" = 'Browser matrix image' AND length(id) >= 20) THEN RAISE EXCEPTION 'browser TodoImage missing or id is unrealistic'; END IF;
        IF NOT EXISTS (SELECT FROM "Todo" WHERE label = '${responsiveLabel}' AND id ~ '^c[a-z0-9]{24}$') THEN RAISE EXCEPTION 'browser Todo missing or id is not an exact CUID shape'; END IF;
      END $$;`,
    ],
    { timeout: 30_000 },
  )

  console.log(
    `Prisma dashboard browser matrix passed against disposable database ${databaseName}.`,
  )
} finally {
  await restoreContainerAndDatabase(initiallyRunning)
}
