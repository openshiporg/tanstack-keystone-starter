import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { access, mkdtemp, rm } from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

import { runBoundedChild, terminateChildGroup } from './lib/bounded-child.mjs'

const serverEntry = path.resolve('.output/server/index.mjs')
const firefoxBinary =
  process.env.FIREFOX_BIN ?? '/Applications/Firefox.app/Contents/MacOS/firefox'
const firefoxLauncherProbe =
  process.env.CMS_PARITY_FAULT_FIREFOX_LAUNCHER_PROBE === '1'
const firefoxCommand = firefoxLauncherProbe ? process.execPath : firefoxBinary
const firefoxArguments = firefoxLauncherProbe
  ? [path.resolve('scripts/fixtures/firefox-launcher-exit.mjs')]
  : []
let appLog = ''
let firefoxLog = ''
let app
let firefox
let temporaryRoot
let profileDirectory

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

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

async function waitFor(check, description, timeout = 15_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await check()) return
    await sleep(50)
  }
  throw new Error(`Timed out waiting for ${description}`)
}

async function buildFaultOutput() {
  await rm(path.resolve('.output'), { recursive: true, force: true })
  const hangingProbe = process.env.CMS_PARITY_FAULT_HANGING_BUILD_PROBE === '1'
  const nonzeroDescendantProbe =
    process.env.CMS_PARITY_FAULT_NONZERO_DESCENDANT_PROBE === '1'
  const fixture = hangingProbe
    ? 'hanging-fault-build.mjs'
    : 'nonzero-descendant.mjs'
  await runBoundedChild(
    hangingProbe || nonzeroDescendantProbe ? process.execPath : 'npm',
    hangingProbe || nonzeroDescendantProbe
      ? [path.resolve('scripts/fixtures', fixture)]
      : ['run', 'build'],
    {
      label: hangingProbe
        ? 'hanging fault-build probe'
        : nonzeroDescendantProbe
          ? 'nonzero descendant probe'
          : 'fault-injected build',
      timeout: hangingProbe ? 300 : nonzeroDescendantProbe ? 5_000 : 180_000,
      termGrace: hangingProbe || nonzeroDescendantProbe ? 200 : 1_000,
      env: {
        ...process.env,
        CMS_PARITY_FAULT_INJECTION_BUILD: '1',
      },
      stdio: 'inherit',
    },
  )
  await access(serverEntry)
}

async function stopChild(child, label) {
  if (!child) return
  await terminateChildGroup(child, label, { termGrace: 300 })
}

async function profileBoundProcesses(directory) {
  if (!directory) return []
  const result = await runBoundedChild('/bin/ps', ['-axo', 'pid=,command='], {
    label: 'fault Firefox profile process discovery',
    timeout: 5_000,
    captureOutput: true,
    maxCapturedBytes: 4 * 1024 * 1024,
  })
  return result.stdout
    .split('\n')
    .map((line) => line.match(/^\s*(\d+)\s+(.+)$/))
    .filter(Boolean)
    .map((match) => ({ pid: Number(match[1]), command: match[2] }))
    .filter(({ command }) => command.includes(directory))
}

function signalPid(pid, signal) {
  try {
    process.kill(pid, signal)
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error
  }
}

async function stopProfileBoundProcesses() {
  for (const { pid } of await profileBoundProcesses(profileDirectory)) {
    signalPid(pid, 'SIGTERM')
  }
  await sleep(300)
  for (const { pid } of await profileBoundProcesses(profileDirectory)) {
    signalPid(pid, 'SIGKILL')
  }
  await waitFor(
    async () => (await profileBoundProcesses(profileDirectory)).length === 0,
    'fault Firefox exact-profile process cleanup',
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

  close() {
    this.socket?.close()
  }
}

async function readState(baseUrl) {
  const response = await fetch(`${baseUrl}/__parity/fault?kind=health`)
  assert.equal(response.status, 200)
  return response.json()
}

async function runNavigationAbortStress(baseUrl, bidiPort) {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'tks-abort-stress-'))
  profileDirectory = path.join(temporaryRoot, 'firefox-profile')
  firefox = spawn(
    firefoxCommand,
    [
      ...firefoxArguments,
      '--headless',
      '--foreground',
      '--no-remote',
      '--profile',
      profileDirectory,
      '--remote-debugging-port',
      String(bidiPort),
      'about:blank',
    ],
    { detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  firefox.stdout.on('data', (chunk) => {
    firefoxLog += chunk
  })
  firefox.stderr.on('data', (chunk) => {
    firefoxLog += chunk
  })
  await waitFor(() => {
    if (firefox.exitCode !== null) {
      throw new Error(`Firefox exited early: ${firefoxLog}`)
    }
    return firefoxLog.includes('WebDriver BiDi listening')
  }, 'fault-stress Firefox BiDi')

  const bidi = new BidiClient(`ws://127.0.0.1:${bidiPort}/session`)
  await bidi.connect()
  try {
    await bidi.command('session.new', {
      capabilities: { alwaysMatch: { browserName: 'firefox' } },
    })
    await bidi.command('session.subscribe', {
      events: [
        'log.entryAdded',
        'network.beforeRequestSent',
        'network.fetchError',
        'network.responseCompleted',
      ],
    })
    const tree = await bidi.command('browsingContext.getTree')
    const context = tree.contexts[0].context

    async function navigate(url, wait = 'complete') {
      return bidi.command('browsingContext.navigate', { context, url, wait })
    }

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

    await navigate(`${baseUrl}/dashboard/signin`)
    const authResult = JSON.parse(
      await evaluate(`(async () => JSON.stringify(await (await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: 'mutation StressAuthenticate($email: String!, $password: String!) { authenticateUserWithPassword(email: $email, password: $password) { __typename ... on UserAuthenticationWithPasswordSuccess { item { id } } ... on UserAuthenticationWithPasswordFailure { message } } }',
          variables: { email: 'ada@example.com', password: 'password' },
        }),
      })).json()))()`),
    )
    assert.deepEqual(authResult.errors, undefined)
    assert.equal(
      authResult.data.authenticateUserWithPassword.__typename,
      'UserAuthenticationWithPasswordSuccess',
    )
    await navigate(`${baseUrl}/dashboard`)
    assert.equal(
      await evaluate("document.body.innerText.includes('Dashboard')"),
      true,
    )

    const routeCycle = [
      '/dashboard/todos/create',
      '/dashboard/todos/todo_1',
      '/dashboard/todos',
    ]
    const correlations = []
    const stressLogOffset = appLog.length

    for (let index = 0; index < 9; index += 1) {
      const requestId = `navigation-abort-${index + 1}`
      const navigationPath = routeCycle[index % routeCycle.length]
      const delayedUrl = `${baseUrl}/__parity/fault?kind=throttled-query&delayMs=10000&requestId=${requestId}`
      const eventOffset = bidi.events.length
      await evaluate(`(() => {
        const controller = new AbortController()
        window.addEventListener('pagehide', () => controller.abort(), { once: true })
        window.__parityPendingRequest = fetch(${JSON.stringify(delayedUrl)}, {
          signal: controller.signal,
        }).catch(() => null)
      })()`)
      await waitFor(async () => {
        const state = await readState(baseUrl)
        return state.requestLifecycle.some(
          (entry) => entry.requestId === requestId && entry.phase === 'started',
        )
      }, `${requestId} server request start`)
      const beforeRequest = bidi.events
        .slice(eventOffset)
        .find(
          (event) =>
            event.method === 'network.beforeRequestSent' &&
            event.params.request.url === delayedUrl,
        )
      assert.ok(beforeRequest, `${requestId} missing browser request event`)
      const browserRequestId = beforeRequest.params.request.request

      const navigationUrl = `${baseUrl}${navigationPath}`
      const navigationResult = await navigate(navigationUrl)
      assert.equal(new URL(navigationResult.url).pathname, navigationPath)
      await waitFor(
        () =>
          bidi.events.some(
            (event) =>
              event.method === 'network.fetchError' &&
              event.params.request.request === browserRequestId,
          ),
        `${requestId} browser cancellation outcome`,
      )
      await waitFor(async () => {
        const state = await readState(baseUrl)
        return state.hookObservations.some(
          (entry) => entry.requestId === requestId,
        )
      }, `${requestId} Nitro error-hook observation`)

      const fetchError = bidi.events.find(
        (event) =>
          event.method === 'network.fetchError' &&
          event.params.request.request === browserRequestId,
      )
      const response = bidi.events.find(
        (event) =>
          event.method === 'network.responseCompleted' &&
          event.params.request.request === browserRequestId,
      )
      assert.equal(fetchError.params.errorText, 'NS_BINDING_ABORTED')
      assert.equal(response, undefined)
      const navigationRequest = bidi.events
        .slice(eventOffset)
        .find(
          (event) =>
            event.method === 'network.beforeRequestSent' &&
            event.params.request.url === navigationUrl,
        )
      assert.ok(navigationRequest, `${requestId} missing navigation request`)
      const navigationResponse = bidi.events.find(
        (event) =>
          event.method === 'network.responseCompleted' &&
          event.params.request.request ===
            navigationRequest.params.request.request,
      )
      assert.ok(navigationResponse.params.response.status < 400)
      assert.ok(
        bidi.events
          .slice(eventOffset)
          .some(
            (event) =>
              event.method === 'network.responseCompleted' &&
              event.params.response.status === 200,
          ),
        `${requestId} navigation did not settle through an HTTP 200 response`,
      )

      const state = await readState(baseUrl)
      const hook = state.hookObservations.find(
        (entry) => entry.requestId === requestId,
      )
      assert.equal(hook.pathname, '/__parity/fault')
      assert.equal(hook.expectedDisconnect, true, JSON.stringify(hook))
      assert.equal(hook.requestState.disconnected, true, JSON.stringify(hook))
      assert.equal(
        hook.requestState.signalAborted || hook.requestState.requestAborted,
        true,
        JSON.stringify(hook),
      )
      assert.equal(
        state.requestLifecycle.some(
          (entry) =>
            entry.requestId === requestId && entry.phase === 'completed',
        ),
        false,
      )
      correlations.push({
        browserError: fetchError.params.errorText,
        browserRequestId,
        navigationBrowserRequestId: navigationRequest.params.request.request,
        navigationInitialHttpStatus: navigationResponse.params.response.status,
        navigationSettledUrl: navigationResult.url,
        navigationPath,
        requestId,
        serverExpectedDisconnect: hook.expectedDisconnect,
      })
    }

    const completionId = 'navigation-complete-1'
    const completionUrl = `${baseUrl}/__parity/fault?kind=throttled-query&delayMs=250&requestId=${completionId}`
    const completionOffset = bidi.events.length
    const completionResult = JSON.parse(
      await evaluate(`(async () => {
        const response = await fetch(${JSON.stringify(completionUrl)})
        return JSON.stringify({ status: response.status, body: await response.json() })
      })()`),
    )
    assert.equal(completionResult.status, 200)
    assert.deepEqual(completionResult.body, {
      completed: true,
      requestId: completionId,
    })
    await waitFor(async () => {
      const state = await readState(baseUrl)
      return state.requestLifecycle.some(
        (entry) =>
          entry.requestId === completionId && entry.phase === 'completed',
      )
    }, 'throttled GraphQL completion')
    const completionRequest = bidi.events
      .slice(completionOffset)
      .find(
        (event) =>
          event.method === 'network.beforeRequestSent' &&
          event.params.request.url === completionUrl,
      )
    assert.ok(completionRequest)
    const completionResponse = bidi.events.find(
      (event) =>
        event.method === 'network.responseCompleted' &&
        event.params.request.request ===
          completionRequest.params.request.request,
    )
    assert.equal(completionResponse.params.response.status, 200)
    const completedState = await readState(baseUrl)
    assert.equal(
      completedState.hookObservations.some(
        (entry) => entry.requestId === completionId,
      ),
      false,
    )

    const stressLog = appLog.slice(stressLogOffset)
    for (const correlation of correlations) {
      assert.match(stressLog, new RegExp(correlation.requestId))
    }
    assert.doesNotMatch(stressLog, /\[cms\]\[server-error\]/)
    const browserConsoleErrors = bidi.events.filter(
      (event) =>
        event.method === 'log.entryAdded' &&
        ['error', 'assert'].includes(event.params.level),
    )
    assert.deepEqual(browserConsoleErrors, [])

    await bidi.command('session.end')
    return correlations
  } finally {
    bidi.close()
  }
}

function startRawDisconnectRequest(url) {
  let socket
  let request
  const closed = new Promise((resolve, reject) => {
    request = http.get(url)
    request.once('socket', (value) => {
      socket = value
    })
    request.once('response', (response) => {
      response.resume()
      reject(
        new Error(
          `Disconnect fixture unexpectedly received HTTP ${response.statusCode}`,
        ),
      )
    })
    request.once('error', (error) => {
      if (error.code === 'ECONNRESET' || error.message === 'socket hang up') {
        resolve()
      } else {
        reject(error)
      }
    })
    request.once('close', resolve)
  })

  return {
    closed,
    destroy() {
      assert.ok(
        request && socket,
        'Raw disconnect request did not get a socket',
      )
      socket.destroy()
    },
  }
}

try {
  await buildFaultOutput()
  if (process.env.CMS_PARITY_FAULT_FORCE_FAILURE_AFTER_BUILD === '1') {
    throw new Error('Intentional post-build cleanup failure probe')
  }
  const port = await availablePort()
  const bidiPort = await availablePort()
  const baseUrl = `http://127.0.0.1:${port}`
  app = spawn(process.execPath, [serverEntry], {
    detached: true,
    env: {
      ...process.env,
      CMS_ADAPTER: 'memory',
      CMS_BOOTSTRAP_MODE: 'seeded',
      CMS_PARITY_FAULT_INJECTION: '1',
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
      PORT: String(port),
      SESSION_SECRET: randomBytes(32).toString('hex'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  app.stdout.on('data', (chunk) => {
    appLog += chunk
  })
  app.stderr.on('data', (chunk) => {
    appLog += chunk
  })

  await waitFor(async () => {
    if (app.exitCode !== null) throw new Error(`App exited early: ${appLog}`)
    try {
      return (await readState(baseUrl)).ok === true
    } catch {
      return false
    }
  }, 'bounded production app')

  const genuineRequestId = 'genuine-fault-1'
  const genuineResponse = await fetch(
    `${baseUrl}/__parity/fault?kind=genuine`,
    { headers: { 'x-request-id': genuineRequestId } },
  )
  assert.equal(genuineResponse.status, 500)
  assert.match(
    genuineResponse.headers.get('content-type') ?? '',
    /^application\/json\b/,
  )
  const genuineBody = await genuineResponse.json()
  assert.equal(genuineBody.error, true)
  assert.equal(genuineBody.status, 500)
  assert.equal(genuineBody.unhandled, true)
  await waitFor(
    () =>
      appLog.includes('[cms][server-error]') &&
      appLog.includes(genuineRequestId) &&
      appLog.includes('PARITY_TEST_GENUINE_SERVER_ERROR'),
    'genuine server error log',
  )
  const afterGenuine = await readState(baseUrl)
  assert.equal(afterGenuine.reportedErrors, 1)
  assert.equal(afterGenuine.expectedDisconnects, 0)
  assert.equal(afterGenuine.lastHookObservation.requestId, genuineRequestId)
  assert.equal(afterGenuine.lastHookObservation.expectedDisconnect, false)

  const stressCorrelations = await runNavigationAbortStress(baseUrl, bidiPort)
  assert.equal(stressCorrelations.length, 9)
  const afterStress = await readState(baseUrl)
  assert.equal(afterStress.expectedDisconnects, 9)
  assert.equal(afterStress.reportedErrors, 1)

  const disconnectLogOffset = appLog.length
  const disconnectRequest = startRawDisconnectRequest(
    `${baseUrl}/__parity/fault?kind=disconnect&requestId=raw-disconnect-1`,
  )
  await waitFor(async () => {
    const state = await readState(baseUrl)
    return state.disconnectRequestsStarted === 1
  }, 'disconnect handler to start')
  disconnectRequest.destroy()
  await disconnectRequest.closed
  await waitFor(async () => {
    const state = await readState(baseUrl)
    return state.lastHookObservation?.requestId === 'raw-disconnect-1'
  }, 'server error hook to observe raw socket disconnect')

  const afterDisconnect = await readState(baseUrl)
  assert.equal(
    afterDisconnect.lastHookObservation.errorMessage,
    'aborted',
    JSON.stringify(afterDisconnect),
  )
  assert.equal(
    afterDisconnect.lastHookObservation.expectedDisconnect,
    true,
    JSON.stringify(afterDisconnect),
  )
  assert.equal(
    afterDisconnect.lastHookObservation.requestState.disconnected,
    true,
    JSON.stringify(afterDisconnect),
  )
  assert.equal(
    afterDisconnect.lastHookObservation.requestState.signalAborted,
    true,
    JSON.stringify(afterDisconnect),
  )
  assert.equal(
    afterDisconnect.lastHookObservation.requestState.requestAborted,
    true,
    JSON.stringify(afterDisconnect),
  )
  assert.equal(
    afterDisconnect.lastHookObservation.requestState.responseDestroyed,
    true,
    JSON.stringify(afterDisconnect),
  )
  assert.equal(
    afterDisconnect.lastHookObservation.requestState.responseWritableFinished,
    false,
    JSON.stringify(afterDisconnect),
  )
  assert.equal(afterDisconnect.expectedDisconnects, 10)
  assert.equal(afterDisconnect.reportedErrors, 1)

  const disconnectLog = appLog.slice(disconnectLogOffset)
  assert.doesNotMatch(
    disconnectLog,
    /(?:\[cms\]\[server-error\]|unhandled|PARITY_TEST_GENUINE_SERVER_ERROR)/i,
  )
  assert.equal(app.exitCode, null)

  console.log(
    `Nitro production error acceptance passed: genuine fault retained correlated JSON 500/log semantics; ${stressCorrelations.length} Firefox in-flight query requests correlated browser NS_BINDING_ABORTED outcomes while navigating create/item/list routes to authoritative Nitro hook state without product error logs; one throttled navigation completed with HTTP 200; raw disconnect remained quiet. Last disconnect=${JSON.stringify(afterDisconnect.lastHookObservation)}`,
  )
} catch (error) {
  console.error('\n--- app log ---\n', appLog)
  throw error
} finally {
  const cleanupResults = []
  cleanupResults.push(
    ...(await Promise.allSettled([
      stopChild(app, 'fault-injection app'),
      stopChild(firefox, 'fault-stress Firefox'),
    ])),
  )
  cleanupResults.push(
    ...(await Promise.allSettled([stopProfileBoundProcesses()])),
  )
  cleanupResults.push(
    ...(await Promise.allSettled([
      rm(path.resolve('.output'), { recursive: true, force: true }),
      temporaryRoot
        ? rm(temporaryRoot, { recursive: true, force: true })
        : Promise.resolve(),
    ])),
  )
  cleanupResults.push(
    ...(await Promise.allSettled([stopProfileBoundProcesses()])),
  )
  cleanupResults.push(
    ...(await Promise.allSettled([
      temporaryRoot
        ? rm(temporaryRoot, { recursive: true, force: true })
        : Promise.resolve(),
      (async () =>
        assert.deepEqual(
          await profileBoundProcesses(profileDirectory),
          [],
          'Fault-stress exact-profile processes remained',
        ))(),
      assert.rejects(
        () => access(serverEntry),
        (error) => error?.code === 'ENOENT',
      ),
      temporaryRoot
        ? assert.rejects(
            () => access(temporaryRoot),
            (error) => error?.code === 'ENOENT',
          )
        : Promise.resolve(),
    ])),
  )
  const cleanupErrors = cleanupResults
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason)
  if (cleanupErrors.length) {
    throw new AggregateError(cleanupErrors, 'Nitro fault gate cleanup failed')
  }
}
