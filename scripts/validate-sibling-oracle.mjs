import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import {
  access,
  cp,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

import {
  processGroupExists,
  runBoundedChild,
  terminateChildGroup,
} from './lib/bounded-child.mjs'

const siblingRoot = '/Users/junaid/Code/next-keystone-starter'
const container =
  process.env.PARITY_POSTGRES_CONTAINER ?? 'vibe-runtime-postgres'
const siblingFingerprint = await directoryFingerprint(siblingRoot)
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'nks-oracle-'))
const fixtureRoot = path.join(temporaryRoot, 'fixture')
const profileDirectory = path.join(temporaryRoot, 'firefox-profile')
const databaseName = `nks_oracle_${process.pid}_${Date.now()}`
const firefoxBinary =
  process.env.FIREFOX_BIN ?? '/Applications/Firefox.app/Contents/MacOS/firefox'
const firefoxLauncherProbe =
  process.env.SIBLING_ORACLE_FIREFOX_LAUNCHER_PROBE === '1'
const firefoxCommand = firefoxLauncherProbe ? process.execPath : firefoxBinary
const firefoxArguments = firefoxLauncherProbe
  ? [path.resolve('scripts/fixtures/firefox-launcher-exit.mjs')]
  : []
const processes = []
let appLog = ''
let firefoxLog = ''
let initiallyRunning = false

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

async function run(label, command, args, options = {}) {
  return runBoundedChild(command, args, {
    label,
    timeout: options.timeout ?? 300_000,
    termGrace: 1_000,
    cwd: options.cwd,
    env: options.env ?? process.env,
    captureOutput: options.captureOutput ?? false,
    ...(options.maxCapturedBytes
      ? { maxCapturedBytes: options.maxCapturedBytes }
      : {}),
    ...(options.captureOutput ? {} : { stdio: 'inherit' }),
  })
}

async function waitFor(check, description, timeout = 30_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await check()) return
    await sleep(100)
  }
  throw new Error(`Timed out waiting for ${description}`)
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      assert.ok(address && typeof address === 'object')
      server.close((error) => (error ? reject(error) : resolve(address.port)))
    })
  })
}

async function directoryFingerprint(directory) {
  const { createHash } = await import('node:crypto')
  const hash = createHash('sha256')
  async function visit(current, relative = '') {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (
        relative === '' &&
        ['node_modules', '.next', '.keystone', '.git'].includes(entry.name)
      ) {
        continue
      }
      const entryPath = path.join(current, entry.name)
      const entryRelative = path.join(relative, entry.name)
      hash.update(`${entry.isDirectory() ? 'd' : 'f'}:${entryRelative}\0`)
      if (entry.isDirectory()) await visit(entryPath, entryRelative)
      else hash.update(await readFile(entryPath))
    }
  }
  await visit(directory)
  return hash.digest('hex')
}

function patchAdminMetaSource(source) {
  let patched = source
  const replacements = [
    ['              initialFilter\n', ''],
    ['              hideNavigation\n', ''],
    [
      `                createView {
                  fieldMode
                  fieldPosition
                  isRequired
                }`,
      `                createView {
                  fieldMode
                }`,
    ],
    [
      `                itemView {
                  fieldMode
                  fieldPosition
                  isRequired
                }`,
      `                itemView {
                  fieldMode
                  fieldPosition
                }`,
    ],
    [
      `                listView {
                  fieldMode
                  fieldPosition
                }`,
      `                listView {
                  fieldMode
                }`,
    ],
  ]
  for (const [before, after] of replacements) {
    assert.ok(
      patched.includes(before),
      `Sibling AdminMeta patch no longer matches ${JSON.stringify(before)}`,
    )
    patched = patched.replace(before, after)
  }
  const needle = `  const adminMeta = response.data?.keystone?.adminMeta

  if (!adminMeta) {`
  const replacement = `  const rawAdminMeta = response.data?.keystone?.adminMeta
  const adminMeta = rawAdminMeta ? {
    ...rawAdminMeta,
    lists: rawAdminMeta.lists.map((list: any) => ({
      ...list,
      initialFilter: {},
      hideNavigation: list.isHidden,
      fields: list.fields.map((field: any) => ({
        ...field,
        createView: { fieldPosition: 'form', isRequired: field.isNonNull?.includes('create') ?? false, ...field.createView },
        itemView: { isRequired: field.isNonNull?.includes('create') ?? false, ...field.itemView },
        listView: { fieldPosition: 'form', ...field.listView },
      })),
    })),
  } : null

  if (!adminMeta) {`
  assert.ok(patched.includes(needle), 'Sibling AdminMeta patch anchor changed')
  return patched.replace(needle, replacement)
}

async function containerRunning() {
  const result = await run(
    'sibling PostgreSQL state inspection',
    'docker',
    ['inspect', '--format', '{{.State.Running}}', container],
    { timeout: 30_000, captureOutput: true },
  )
  return result.stdout.trim() === 'true'
}

async function waitForPostgres() {
  await waitFor(async () => {
    try {
      await run(
        'sibling PostgreSQL readiness probe',
        'docker',
        ['exec', container, 'pg_isready', '-q'],
        { timeout: 5_000, captureOutput: true },
      )
      return true
    } catch {
      return false
    }
  }, 'sibling PostgreSQL readiness')
}

async function postgresCredentials() {
  const result = await run(
    'sibling PostgreSQL credential probe',
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
  const [user, password, remainder] = result.stdout.split('\0')
  assert.equal(remainder, '')
  assert.ok(user && password)
  return { user, password }
}

async function cleanupDatabase() {
  const errors = []
  let running = false
  try {
    running = await containerRunning()
  } catch (error) {
    errors.push(error)
  }
  if (!running) {
    try {
      await run('sibling PostgreSQL cleanup startup', 'docker', [
        'start',
        container,
      ])
      running = true
    } catch (error) {
      errors.push(error)
    }
  }
  if (running) {
    try {
      await waitForPostgres()
      if (process.env.SIBLING_ORACLE_CLEANUP_READINESS_FAILURE_PROBE === '1') {
        throw new Error('Intentional sibling cleanup readiness failure probe')
      }
    } catch (error) {
      errors.push(error)
    }
    try {
      await run(
        'sibling disposable database cleanup',
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
    } catch (error) {
      errors.push(error)
    }
    try {
      await run(
        'sibling disposable database absence check',
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
    } catch (error) {
      errors.push(error)
    }
  }
  let finalRunning = running
  try {
    finalRunning = await containerRunning()
  } catch (error) {
    errors.push(error)
  }
  if (!initiallyRunning && finalRunning) {
    try {
      await run('sibling PostgreSQL state restoration', 'docker', [
        'stop',
        container,
      ])
      finalRunning = false
    } catch (error) {
      errors.push(error)
    }
  } else if (initiallyRunning && !finalRunning) {
    try {
      await run('sibling PostgreSQL state restoration', 'docker', [
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
      await containerRunning(),
      initiallyRunning,
      'Sibling PostgreSQL state was not restored',
    )
  } catch (error) {
    errors.push(error)
  }
  if (errors.length) {
    throw new AggregateError(errors, 'Sibling database cleanup failed')
  }
}

function startDetached(command, args, options = {}) {
  const child = spawn(command, args, {
    ...options,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  processes.push(child)
  return child
}

async function cleanupProcesses() {
  const results = await Promise.allSettled(
    processes.toReversed().map(async (child) => {
      if (child.pid && processGroupExists(child.pid)) {
        await terminateChildGroup(child, 'sibling oracle child', {
          termGrace: 500,
        })
      }
    }),
  )
  const errors = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason)
  if (errors.length) throw new AggregateError(errors, 'Sibling process cleanup')
}

async function profileBoundProcesses() {
  const result = await run(
    'sibling exact-profile process discovery',
    '/bin/ps',
    ['-axo', 'pid=,command='],
    {
      timeout: 5_000,
      captureOutput: true,
      maxCapturedBytes: 4 * 1024 * 1024,
    },
  )
  return result.stdout
    .split('\n')
    .map((line) => line.match(/^\s*(\d+)\s+(.+)$/))
    .filter(Boolean)
    .map((match) => ({ pid: Number(match[1]), command: match[2] }))
    .filter(({ command }) => command.includes(profileDirectory))
}

function signalPid(pid, signal) {
  try {
    process.kill(pid, signal)
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error
  }
}

async function cleanupProfileProcesses() {
  for (const { pid } of await profileBoundProcesses()) {
    signalPid(pid, 'SIGTERM')
  }
  await sleep(300)
  for (const { pid } of await profileBoundProcesses()) {
    signalPid(pid, 'SIGKILL')
  }
  await waitFor(
    async () => (await profileBoundProcesses()).length === 0,
    'sibling exact-profile process cleanup',
    5_000,
  )
}

class BidiClient {
  constructor(url) {
    this.url = url
    this.nextId = 0
    this.pending = new Map()
    this.events = []
  }

  async connect() {
    this.socket = new WebSocket(this.url)
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))
      const pending = message.id ? this.pending.get(message.id) : undefined
      if (pending) {
        this.pending.delete(message.id)
        clearTimeout(pending.timer)
        if (message.type === 'error') {
          pending.reject(new Error(`${message.error}: ${message.message}`))
        } else pending.resolve(message.result)
      } else if (message.type === 'event') this.events.push(message)
    })
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true })
      this.socket.addEventListener('error', reject, { once: true })
    })
  }

  command(method, params = {}, timeout = 30_000) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Timed out waiting for ${method}`))
      }, timeout)
      this.pending.set(id, { resolve, reject, timer })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }
}

async function runBrowser(webSocketBase, appBase) {
  const bidi = new BidiClient(`${webSocketBase}/session`)
  await bidi.connect()
  await bidi.command('session.new', {
    capabilities: { alwaysMatch: { browserName: 'firefox' } },
  })
  await bidi.command('session.subscribe', {
    events: [
      'log.entryAdded',
      'network.fetchError',
      'network.responseCompleted',
    ],
  })
  const tree = await bidi.command('browsingContext.getTree')
  const context = tree.contexts[0].context
  await bidi.command('browsingContext.setViewport', {
    context,
    viewport: { width: 1440, height: 1000 },
  })

  async function evaluate(expression) {
    const result = await bidi.command('script.evaluate', {
      expression,
      target: { context },
      awaitPromise: true,
      resultOwnership: 'none',
    })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }

  async function node(expression) {
    const result = await bidi.command('script.evaluate', {
      expression,
      target: { context },
      awaitPromise: true,
      resultOwnership: 'root',
    })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    assert.equal(result.result.type, 'node')
    return result.result.sharedId
  }

  async function type(selector, value) {
    const sharedId = await node(
      `document.querySelector(${JSON.stringify(selector)})`,
    )
    await bidi.command('script.callFunction', {
      functionDeclaration:
        '(element) => { element.scrollIntoView({ block: "center" }); element.focus() }',
      target: { context },
      arguments: [{ sharedId }],
      awaitPromise: true,
    })
    await bidi.command('input.performActions', {
      context,
      actions: [
        {
          type: 'key',
          id: 'keyboard',
          actions: Array.from(value).flatMap((character) => [
            { type: 'keyDown', value: character },
            { type: 'keyUp', value: character },
          ]),
        },
      ],
    })
    await bidi.command('input.releaseActions', { context })
  }

  async function clickMatching(expression) {
    const sharedId = await node(expression)
    await bidi.command('script.callFunction', {
      functionDeclaration:
        '(element) => element.scrollIntoView({ block: "center" })',
      target: { context },
      arguments: [{ sharedId }],
      awaitPromise: true,
    })
    await bidi.command('input.performActions', {
      context,
      actions: [
        {
          type: 'pointer',
          id: 'mouse',
          parameters: { pointerType: 'mouse' },
          actions: [
            {
              type: 'pointerMove',
              x: 0,
              y: 0,
              origin: { type: 'element', element: { sharedId } },
            },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerUp', button: 0 },
          ],
        },
      ],
    })
    await bidi.command('input.releaseActions', { context })
  }

  async function clickText(text) {
    await clickMatching(
      `Array.from(document.querySelectorAll('button, a')).find(element => element.innerText.trim() === ${JSON.stringify(text)})`,
    )
  }

  async function navigate(route) {
    await bidi.command('browsingContext.navigate', {
      context,
      url: `${appBase}${route}`,
      wait: 'complete',
    })
  }

  async function waitPage(expression, description) {
    try {
      await waitFor(() => evaluate(expression), description, 45_000)
    } catch (error) {
      console.error(`Sibling browser state while waiting for ${description}:`, {
        location: await evaluate('location.href'),
        body: await evaluate('document.body.innerText'),
      })
      throw error
    }
    assert.equal(
      await evaluate(
        "document.body.innerText.includes('Something went wrong')",
      ),
      false,
      `${description} rendered the sibling error boundary`,
    )
  }

  await navigate('/dashboard/init')
  await waitPage(
    "document.body.innerText.includes('Create admin account')",
    'sibling init route',
  )
  await type('#name', 'Oracle Admin')
  await type('#email', 'oracle@example.com')
  await type('#password', 'Oracle-password-123!')
  await clickText('Create account')
  await waitPage(
    "location.pathname === '/dashboard'",
    'sibling authenticated home',
  )
  await navigate('/dashboard')
  await waitPage(
    "document.body.innerText.includes('Dashboard') && document.body.innerText.includes('Todos')",
    'sibling dashboard home metadata',
  )

  await navigate('/dashboard/todos')
  await waitPage(
    "location.pathname === '/dashboard/todos' && document.body.innerText.includes('Todos')",
    'sibling list route',
  )
  await navigate('/dashboard/todos/create')
  await waitPage(
    "location.pathname === '/dashboard/todos/create' && document.body.innerText.includes('Create Todo')",
    'sibling create route',
  )

  const created = JSON.parse(
    await evaluate(`(async () => JSON.stringify(await (await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: 'mutation OracleCreateTodo($data: TodoCreateInput!) { createTodo(data: $data) { id label } }',
        variables: { data: { label: 'Sibling oracle Todo' } },
      }),
    })).json()))()`),
  )
  assert.deepEqual(created.errors, undefined)
  assert.ok(created.data.createTodo.id)
  assert.equal(created.data.createTodo.label, 'Sibling oracle Todo')

  const itemRoute = `/dashboard/todos/${created.data.createTodo.id}`
  await navigate(itemRoute)
  await waitPage(
    "document.body.innerText.includes('Sibling oracle Todo')",
    'sibling item route',
  )

  await clickMatching(
    "Array.from(document.querySelectorAll('button')).find(element => element.innerText.includes('Oracle Admin'))",
  )
  await waitPage(
    "Array.from(document.querySelectorAll('button')).some(element => element.innerText.trim() === 'Log out')",
    'sibling user menu',
  )
  await clickText('Log out')
  await waitPage(
    "location.pathname === '/dashboard/signin' && document.body.innerText.includes('Sign in to your account')",
    'sibling sign-out redirect',
  )
  await type('#email', 'oracle@example.com')
  await type('#password', 'Oracle-password-123!')
  await clickText('Sign in')
  await waitPage(
    "location.pathname === '/dashboard'",
    'sibling authenticated sign-in',
  )
  await navigate(itemRoute)
  await waitPage(
    "document.body.innerText.includes('Sibling oracle Todo')",
    'sibling persisted item after sign-in',
  )

  const fetchErrors = bidi.events.filter(
    (event) => event.method === 'network.fetchError',
  )
  const unexpectedFetchErrors = fetchErrors.filter(
    (event) => event.params.errorText !== 'NS_BINDING_ABORTED',
  )
  const invalidResponses = bidi.events.filter(
    (event) =>
      event.method === 'network.responseCompleted' &&
      event.params.response.status >= 400,
  )
  const consoleErrors = bidi.events.filter(
    (event) =>
      event.method === 'log.entryAdded' &&
      ['error', 'assert'].includes(event.params.level),
  )
  assert.deepEqual(unexpectedFetchErrors, [])
  assert.deepEqual(invalidResponses, [])
  assert.deepEqual(consoleErrors, [])
  await bidi.command('session.end')
  console.log(
    `Derived sibling browser oracle passed init/sign-in/home/list/create/item with ${bidi.events.length} observed events, ${fetchErrors.length} expected navigation abort(s), and zero unexpected browser fetch/4xx/console errors.`,
  )
  return created.data.createTodo
}

try {
  initiallyRunning = await containerRunning()
  if (!initiallyRunning) {
    await run('sibling PostgreSQL startup', 'docker', ['start', container])
  }
  await waitForPostgres()
  const { user, password } = await postgresCredentials()
  await run(
    'sibling disposable database creation',
    'docker',
    ['exec', container, 'createdb', '-U', user, databaseName],
    { timeout: 30_000 },
  )
  if (process.env.SIBLING_ORACLE_STOP_AFTER_CREATE_PROBE === '1') {
    await run('forced sibling post-create PostgreSQL stop', 'docker', [
      'stop',
      container,
    ])
    throw new Error('Intentional sibling post-create PostgreSQL stop probe')
  }

  await cp(siblingRoot, fixtureRoot, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(siblingRoot, source)
      const top = relative.split(path.sep)[0]
      return !['node_modules', '.git', '.next', '.keystone', '.env'].includes(
        top,
      )
    },
  })
  const actionPath = path.join(
    fixtureRoot,
    'features/dashboard/actions/getAdminMetaAction.ts',
  )
  await writeFile(
    actionPath,
    patchAdminMetaSource(await readFile(actionPath, 'utf8')),
  )
  const databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:5432/${databaseName}`
  const environment = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    SESSION_SECRET: randomBytes(32).toString('hex'),
    S3_BUCKET_NAME: 'keystone-test',
    S3_REGION: 'ap-southeast-2',
    S3_ACCESS_KEY_ID: 'keystone',
    S3_SECRET_ACCESS_KEY: 'keystone',
    S3_ENDPOINT: 'https://sfo3.digitaloceanspaces.com',
  }
  await writeFile(
    path.join(fixtureRoot, '.env'),
    `DATABASE_URL=${databaseUrl}\nSESSION_SECRET=${environment.SESSION_SECRET}\n`,
  )
  await run(
    'sibling disposable dependency install',
    'npm',
    ['ci', '--no-audit', '--no-fund'],
    { cwd: fixtureRoot, env: environment, timeout: 900_000 },
  )
  await run('sibling derived production build', 'npm', ['run', 'build'], {
    cwd: fixtureRoot,
    env: environment,
    timeout: 600_000,
  })

  const appPort = await availablePort()
  const bidiPort = await availablePort()
  const app = startDetached('npm', ['start'], {
    cwd: fixtureRoot,
    env: {
      ...environment,
      HOSTNAME: '127.0.0.1',
      PORT: String(appPort),
    },
  })
  app.stdout.on('data', (chunk) => {
    appLog += chunk
  })
  app.stderr.on('data', (chunk) => {
    appLog += chunk
  })
  await waitFor(
    async () => {
      if (app.exitCode !== null)
        throw new Error(`Sibling app exited: ${appLog}`)
      try {
        const response = await fetch(
          `http://127.0.0.1:${appPort}/dashboard/init`,
        )
        await response.text()
        return response.ok
      } catch {
        return false
      }
    },
    'derived sibling production app',
    60_000,
  )

  const firefox = startDetached(firefoxCommand, [
    ...firefoxArguments,
    '--headless',
    '--foreground',
    '--no-remote',
    '--profile',
    profileDirectory,
    '--remote-debugging-port',
    String(bidiPort),
    'about:blank',
  ])
  firefox.stdout.on('data', (chunk) => {
    firefoxLog += chunk
  })
  firefox.stderr.on('data', (chunk) => {
    firefoxLog += chunk
  })
  await waitFor(() => {
    if (firefox.exitCode !== null) {
      throw new Error(`Sibling Firefox exited: ${firefoxLog}`)
    }
    return firefoxLog.includes('WebDriver BiDi listening')
  }, 'sibling Firefox BiDi')

  const createdTodo = await runBrowser(
    `ws://127.0.0.1:${bidiPort}`,
    `http://127.0.0.1:${appPort}`,
  )
  assert.match(createdTodo.id, /^[a-z0-9]+$/)
  const persistedTodo = await run(
    'sibling direct PostgreSQL persistence check',
    'docker',
    [
      'exec',
      container,
      'psql',
      '-U',
      user,
      '-d',
      databaseName,
      '-Atqc',
      `SELECT label FROM "Todo" WHERE id = '${createdTodo.id}'`,
    ],
    { timeout: 30_000, captureOutput: true },
  )
  assert.equal(persistedTodo.stdout.trim(), 'Sibling oracle Todo')
  assert.doesNotMatch(
    appLog,
    /Cannot query field|Something went wrong|Failed to fetch admin meta/i,
  )
} finally {
  const cleanupResults = []
  cleanupResults.push(
    ...(await Promise.allSettled([cleanupProcesses(), cleanupDatabase()])),
  )
  cleanupResults.push(
    ...(await Promise.allSettled([cleanupProfileProcesses()])),
  )
  cleanupResults.push(
    ...(await Promise.allSettled([
      rm(temporaryRoot, { recursive: true, force: true }),
    ])),
  )
  cleanupResults.push(
    ...(await Promise.allSettled([cleanupProfileProcesses()])),
  )
  cleanupResults.push(
    ...(await Promise.allSettled([
      rm(temporaryRoot, { recursive: true, force: true }),
    ])),
  )
  cleanupResults.push(
    ...(await Promise.allSettled([
      (async () =>
        assert.deepEqual(
          await profileBoundProcesses(),
          [],
          'Sibling exact-profile processes remained after cleanup',
        ))(),
      assert.rejects(
        () => access(temporaryRoot),
        (error) => error?.code === 'ENOENT',
      ),
      (async () =>
        assert.equal(
          await directoryFingerprint(siblingRoot),
          siblingFingerprint,
          'Read-only sibling source changed during derived fixture',
        ))(),
    ])),
  )
  const errors = cleanupResults
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason)
  if (errors.length) throw new AggregateError(errors, 'Sibling oracle cleanup')
}
