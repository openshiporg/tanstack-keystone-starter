import assert from 'node:assert/strict'
import { execFile, execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import net from 'node:net'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const containerName = `tks-gap09-${process.pid}-${Date.now()}`
const tempDirectory = path.join(root, '.cms-temp', containerName)
const reportPath = path.join(root, 'reports/gap-09-auth-continuity.md')
let containerStarted = false
let databaseUrl
let passed = false
let failureError
let cleanupError
const secret = 'gap09-shared-session-secret-at-least-32-characters'
const evidence = []

function docker(args, options = {}) {
  return execFileSync('docker', args, {
    encoding: options.encoding ?? 'utf8',
    input: options.input,
    maxBuffer: 20 * 1024 * 1024,
  })
}

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    cwd: root,
    env: options.env ?? process.env,
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  const redacted = output
    .replace(/keystonejs-session=[^;\s]+/g, 'keystonejs-session=[REDACTED]')
    .replace(/(["']?token["']?\s*[:=]\s*["'])[^"']+/gi, '$1[REDACTED]')
  if (redacted.trim())
    evidence.push(`$ ${command} ${args.join(' ')}\n${redacted.trim()}`)
  return output
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
  throw new Error('GAP-09 disposable PostgreSQL did not become ready')
}

async function waitForHostPort(port) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const connected = await new Promise((resolve) => {
      const socket = net.createConnection({
        host: '127.0.0.1',
        port: Number(port),
      })
      socket.once('connect', () => {
        socket.destroy()
        resolve(true)
      })
      socket.once('error', () => resolve(false))
      socket.setTimeout(250, () => {
        socket.destroy()
        resolve(false)
      })
    })
    if (connected) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`GAP-09 PostgreSQL host port ${port} did not become ready`)
}

function redactedError(error) {
  return String(error)
    .replaceAll(secret, '[REDACTED]')
    .replaceAll(
      'gap09-rotated-session-secret-at-least-32-characters',
      '[REDACTED]',
    )
    .replaceAll(/keystonejs-session=[^;\s]+/g, 'keystonejs-session=[REDACTED]')
    .replaceAll(/(["']?token["']?\s*[:=]\s*["'])[^"']+/gi, '$1[REDACTED]')
}

async function assertReportSafe() {
  const report = await readFile(reportPath, 'utf8')
  assert(!report.includes(secret), 'report contains the session secret')
  assert(
    !report.includes('gap09-rotated-session-secret-at-least-32-characters'),
    'report contains the rotated session secret',
  )
  assert.doesNotMatch(
    report,
    /keystonejs-session=(?!\[REDACTED\])[^;\s]+/,
    'report contains an unredacted session cookie',
  )
  assert.doesNotMatch(
    report,
    /(["']?token["']?\s*[:=]\s*["'])(?!\[REDACTED\])[^"']+/i,
    'report contains an unredacted token',
  )
}

async function writeReport(status, error) {
  const failure = error
    ? `\n## Failure\n\n\`\`\`text\n${redactedError(error)}\n\`\`\`\n`
    : ''
  const report =
    `# GAP-09 auth/session/reset continuity evidence\n\n` +
    `Status: ${status}\n\n` +
    `Date: ${new Date().toISOString()}\n\n` +
    `The bounded suite used disposable PostgreSQL and separate Node processes. ` +
    `The container, worker processes, and local temporary directory are asserted absent in finally.\n\n` +
    `## Migration contract\n\n` +
    `- Existing User/Role rows and bcrypt password hashes are retained.\n` +
    `- Replacement cookies survive a process restart only when every process uses the same SESSION_SECRET, cookie name, and replacement token format. The sibling Keystone Iron cookie format is intentionally not imported.\n` +
    `- Secret rotation intentionally invalidates old stateless cookies; deploy the new secret as a coordinated cutover.\n` +
    `- Init, sign-in, sign-out cookie clearing, and arbitrary Account.handle/credential auth are exercised in separate worker processes.\n` +
    `- Password reset storage fields are migrated with the auth list. Existing reset tokens are single-use and use Auth 8.1.0's sanitized 10-minute default (configurable from 10 seconds through 24 hours); reset replay/expiry is rejected.\n` +
    `- Known and unknown reset requests have the same Boolean response; only the known account invokes the token hook and stores reset state. No token is returned in the response or report.\n` +
    `- Any prior report is removed before execution; failures write Status: FAILED after container, worker-process, and temporary-directory cleanup assertions.\n` +
    `- Cookies are HttpOnly/SameSite=Lax; Secure is explicit in production and can derive from X-Forwarded-Proto only when trustProxy is enabled.\n` +
    `- Login/reset failures are generic; login is bounded to five attempts per identity/client window and does not reveal whether an account exists. The limiter is process-local and needs shared production storage for multi-instance enforcement.\n` +
    `- SMTP delivery, sibling-cookie survival, clock skew, and immediate stateless bearer revocation remain external boundaries.\n\n` +
    `## Evidence\n\n` +
    evidence
      .map(
        (entry) =>
          '### ' + entry.split('\n')[0] + '\n\n```text\n' + entry + '\n```',
      )
      .join('\n\n') +
    '\n' +
    failure
  await writeFile(reportPath, report)
}

function assertContainerAbsent() {
  const names = docker(['ps', '-a', '--format', '{{.Names}}'])
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean)
  assert(
    !names.includes(containerName),
    `container ${containerName} still exists`,
  )
}

async function assertWorkersAbsent() {
  const { stdout } = await execFileAsync('ps', ['-axo', 'comm=,args='], {
    maxBuffer: 8 * 1024 * 1024,
  })
  const workers = stdout
    .split(/\r?\n/)
    .filter(
      (line) =>
        /^\s*(node|tsx|npm)\s/.test(line) &&
        line.includes('validate-cms-auth-continuity-worker.ts'),
    )
  assert.deepEqual(
    workers,
    [],
    `continuity workers still exist: ${workers.join('\n')}`,
  )
}

async function assertTemporaryDirectoryAbsent() {
  await rm(tempDirectory, { recursive: true, force: true })
  assert(
    !existsSync(tempDirectory),
    `temporary directory still exists: ${tempDirectory}`,
  )
}

async function worker(mode, extra = {}) {
  const output = await run(
    'npx',
    ['--no-install', 'tsx', 'scripts/validate-cms-auth-continuity-worker.ts'],
    {
      env: {
        ...process.env,
        DATABASE_URL: extra.DATABASE_URL ?? databaseUrl,
        CMS_ADAPTER: 'prisma',
        NODE_ENV: 'test',
        SESSION_SECRET: secret,
        GAP09_MODE: mode,
        ...extra,
      },
    },
  )
  const json = output.trim().split(/\r?\n/).at(-1)
  assert.ok(json, `GAP-09 ${mode} worker did not return evidence`)
  return JSON.parse(json)
}

try {
  await rm(reportPath, { force: true })
  await mkdir(tempDirectory, { recursive: true })
  await writeReport('RUNNING')
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
  await waitForHostPort(port)
  databaseUrl = `postgresql://cms:cms@127.0.0.1:${port}/cms`
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    SESSION_SECRET: secret,
    CMS_ADAPTER: 'prisma',
    NODE_ENV: 'test',
  }

  await run('npm', ['run', 'migrate'], { env })
  await run('npm', ['run', 'db:seed:demo'], { env })
  const initDatabaseUrl = `postgresql://cms:cms@127.0.0.1:${port}/cms_init`
  docker(['exec', containerName, 'createdb', '-U', 'cms', 'cms_init'])
  await run('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...env, DATABASE_URL: initDatabaseUrl },
  })

  const firstProcess = await worker('login')
  const secondProcess = await worker('read', {
    GAP09_COOKIE: firstProcess.cookie,
  })
  assert.equal(secondProcess.itemId, 'user_admin')
  const signout = await worker('signout', {
    GAP09_COOKIE: firstProcess.cookie,
  })
  assert.deepEqual(signout, {
    mode: 'signout',
    ended: true,
    anonymous: true,
  })
  const init = await worker('init', { DATABASE_URL: initDatabaseUrl })
  assert.equal(init.mode, 'init')
  assert.match(init.itemId, /^c[a-z0-9]+$/)
  const arbitrary = await worker('arbitrary')
  assert.deepEqual(arbitrary, {
    mode: 'arbitrary',
    listKey: 'Account',
    identityField: 'handle',
    secretField: 'credential',
    authenticated: true,
  })
  const legacyCookie = await worker('legacy')
  assert.equal(legacyCookie.itemId, 'user_admin')
  const rotatedSecret = await worker('rotated', {
    GAP09_COOKIE: firstProcess.cookie,
    SESSION_SECRET: 'gap09-rotated-session-secret-at-least-32-characters',
  })
  assert.equal(rotatedSecret.itemId, null)
  const proxy = await worker('proxy')
  assert.deepEqual(proxy, {
    mode: 'proxy',
    httpsSecure: true,
    httpSecure: false,
  })
  const reset = await worker('reset')
  assert.deepEqual(reset, {
    mode: 'reset',
    redeemed: true,
    replay: 'TOKEN_REDEEMED',
    expired: 'TOKEN_EXPIRED',
  })
  const resetEnumeration = await worker('reset-enumeration')
  assert.deepEqual(resetEnumeration, {
    mode: 'reset-enumeration',
    unknownResponse: true,
    knownResponse: true,
    hookCalls: 1,
    knownTokenStored: true,
    unknownTokenStored: false,
  })
  const rate = await worker('rate')
  assert.deepEqual(rate, {
    mode: 'rate',
    attempts: 6,
    genericFailure: true,
    blocked: true,
  })

  evidence.push(
    `two-process cookie continuity: ${JSON.stringify({ firstProcess: { itemId: firstProcess.itemId }, secondProcess, signout, init, arbitrary, legacyCookie, rotatedSecret })}`,
  )
  evidence.push(`proxy cookie policy: ${JSON.stringify(proxy)}`)
  evidence.push(`reset token flow: ${JSON.stringify(reset)}`)
  evidence.push(`reset non-enumeration: ${JSON.stringify(resetEnumeration)}`)
  evidence.push(`generic failure/rate limit: ${JSON.stringify(rate)}`)

  const report =
    `# GAP-09 auth/session/reset continuity evidence\n\n` +
    `Date: ${new Date().toISOString()}\n\n` +
    `The bounded suite used disposable PostgreSQL and separate Node processes. The container is removed in finally.\n\n` +
    `## Migration contract\n\n` +
    `- Existing User/Role rows and bcrypt password hashes are retained.\n` +
    `- Replacement cookies survive a process restart only when every process uses the same SESSION_SECRET, cookie name, and replacement token format. The sibling Keystone Iron cookie format is intentionally not imported.\n` +
    `- Secret rotation intentionally invalidates old stateless cookies; deploy the new secret as a coordinated cutover.\n` +
    `- Init, sign-in, sign-out cookie clearing, and arbitrary Account.handle/credential auth are exercised in separate worker processes.\n` +
    `- Password reset storage fields are migrated with the auth list. Existing reset tokens are single-use and use Auth 8.1.0's sanitized 10-minute default (configurable from 10 seconds through 24 hours); reset replay/expiry is rejected.\n` +
    `- Cookies are HttpOnly/SameSite=Lax; Secure is explicit in production and can derive from X-Forwarded-Proto only when trustProxy is enabled.\n` +
    `- Login/reset failures are generic; login is bounded to five attempts per identity/client window and does not reveal whether an account exists. The limiter is process-local and needs shared production storage for multi-instance enforcement.\n` +
    `- SMTP delivery, sibling-cookie survival, clock skew, and immediate stateless bearer revocation remain external boundaries.\n\n` +
    `## Evidence\n\n` +
    evidence
      .map(
        (entry) =>
          `### ${entry.split('\n')[0]}\n\n\`\`\`text\n${entry}\n\`\`\``,
      )
      .join('\n\n') +
    '\n'
  void report
  passed = true
} catch (error) {
  failureError = error
} finally {
  try {
    if (containerStarted) docker(['rm', '-f', containerName])
    assertContainerAbsent()
  } catch (error) {
    cleanupError ??= error
  }
  try {
    await assertWorkersAbsent()
  } catch (error) {
    cleanupError ??= error
  }
  try {
    await assertTemporaryDirectoryAbsent()
  } catch (error) {
    cleanupError ??= error
  }

  if (!passed || cleanupError) {
    await writeReport('FAILED', failureError ?? cleanupError)
  } else {
    await writeReport('PASS')
  }

  try {
    await assertReportSafe()
  } catch (error) {
    cleanupError ??= error
    await writeReport('FAILED', error)
  }

  if (!passed || cleanupError) {
    console.error(
      `GAP-09 auth/session/reset continuity failed; FAILED evidence written to ${reportPath}`,
    )
    process.exitCode = 1
  } else {
    console.log(
      'GAP-09 auth/session/reset continuity passed; evidence written to reports/gap-09-auth-continuity.md',
    )
  }
}
