import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

import {
  processGroupExists,
  terminateChildGroup,
} from '../lib/bounded-child.mjs'
import {
  assertGap08MatrixCoverage,
  deriveGap08RelationshipMatrix,
} from '../gap08-relationship-contract.mjs'
import {
  boundedDiagnostic,
  captureError,
  waitFor,
  writeJsonAtomic,
} from '../gap08-heavy-lifecycle.mjs'

const fixtureRoot = path.resolve('.')
const reportPath = process.env.GAP08_BROWSER_REPORT
assert.ok(reportPath, 'GAP08_BROWSER_REPORT is required')
assert.ok(
  path.relative(fixtureRoot, path.resolve(reportPath)).startsWith('..'),
  'browser evidence must remain outside the disposable fixture',
)
const firefoxBinary =
  process.env.FIREFOX_BIN ?? '/Applications/Firefox.app/Contents/MacOS/firefox'

const report = {
  status: 'RUNNING',
  startedAt: new Date().toISOString(),
  endpointIds: [],
  created: [],
  eventCount: 0,
  failures: [],
}

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

class BidiClient {
  constructor(url) {
    this.url = url
    this.id = 0
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
        if (message.type === 'error')
          pending.reject(new Error(`${message.error}: ${message.message}`))
        else pending.resolve(message.result)
      } else if (message.type === 'event') this.events.push(message)
    })
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true })
      this.socket.addEventListener('error', reject, { once: true })
    })
  }

  command(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Timed out waiting for ${method}`))
      }, 30_000)
      this.pending.set(id, { resolve, reject, timer })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  close() {
    this.socket?.close()
  }
}

async function terminate(child, label) {
  if (!child?.pid) return
  if (
    child.exitCode === null &&
    child.signalCode === null &&
    processGroupExists(child.pid)
  )
    await terminateChildGroup(child, label, { termGrace: 1_000 })
}

async function main() {
  const [adminMeta, prismaSchema] = await Promise.all([
    readFile(path.join(fixtureRoot, '.cms/admin-meta.json'), 'utf8').then(
      JSON.parse,
    ),
    readFile(path.join(fixtureRoot, '.cms/schema.prisma'), 'utf8'),
  ])
  const matrix = deriveGap08RelationshipMatrix({ adminMeta, prismaSchema })
  assertGap08MatrixCoverage(matrix)
  report.endpointIds = matrix.map((entry) => entry.id)

  const candidates = []
  for (const endpoint of matrix) {
    if (endpoint.required.create) continue
    if (candidates.some((entry) => entry.listKey === endpoint.listKey)) continue
    candidates.push(endpoint)
  }
  assert.ok(
    candidates.length >= 3,
    'generated matrix needs three browser-creatable lists',
  )

  const appPort = await availablePort()
  const bidiPort = await availablePort()
  const profile = path.join(
    os.tmpdir(),
    `tks-gap08-firefox-${process.pid}-${Date.now()}`,
  )
  const appOutput = []
  const firefoxOutput = []
  let app
  let firefox
  let bidi
  try {
    app = spawn(process.execPath, ['.output/server/index.mjs'], {
      cwd: fixtureRoot,
      detached: true,
      env: {
        ...process.env,
        CMS_ADAPTER: 'prisma',
        CMS_BOOTSTRAP_MODE: 'fresh',
        HOST: '127.0.0.1',
        PORT: String(appPort),
        NODE_ENV: 'production',
        SESSION_SECRET: randomBytes(32).toString('hex'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    app.stdout.on('data', (chunk) => appOutput.push(chunk))
    app.stderr.on('data', (chunk) => appOutput.push(chunk))
    await waitFor(
      async () => {
        if (app.exitCode !== null)
          throw new Error(
            `GAP-08 app exited early: ${boundedDiagnostic(Buffer.concat(appOutput))}`,
          )
        try {
          const response = await fetch(
            `http://127.0.0.1:${appPort}/dashboard/init`,
          )
          if (response.status < 500) return true
          const body = await response.text()
          throw new Error(
            `GAP-08 app readiness returned HTTP ${response.status}: ${body.slice(-2_000)}; app log: ${boundedDiagnostic(Buffer.concat(appOutput))}`,
          )
        } catch (error) {
          throw new Error(
            `GAP-08 app readiness failed: ${String(error)}; app log: ${boundedDiagnostic(Buffer.concat(appOutput))}`,
          )
        }
      },
      'GAP-08 production app readiness',
      45_000,
    )

    await import('node:fs/promises').then((fs) =>
      fs.mkdir(profile, { recursive: true }),
    )
    firefox = spawn(
      firefoxBinary,
      [
        '--headless',
        '--foreground',
        '--no-remote',
        '--profile',
        profile,
        '--remote-debugging-port',
        String(bidiPort),
        'about:blank',
      ],
      { detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    firefox.stdout.on('data', (chunk) => firefoxOutput.push(chunk))
    firefox.stderr.on('data', (chunk) => firefoxOutput.push(chunk))
    await waitFor(
      () => {
        if (firefox.exitCode !== null)
          throw new Error(
            `GAP-08 Firefox exited early: ${boundedDiagnostic(Buffer.concat(firefoxOutput))}`,
          )
        const output = Buffer.concat(firefoxOutput).toString('utf8')
        if (output.includes('WebDriver BiDi listening')) return true
        throw new Error(
          `GAP-08 Firefox not ready: ${boundedDiagnostic(output)}`,
        )
      },
      'GAP-08 Firefox BiDi readiness',
      30_000,
    )

    bidi = new BidiClient(`ws://127.0.0.1:${bidiPort}/session`)
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
      viewport: { width: 1440, height: 1400 },
    })

    const evaluate = async (expression) => {
      const result = await bidi.command('script.evaluate', {
        expression,
        target: { context },
        awaitPromise: true,
        resultOwnership: 'none',
      })
      if (result.exceptionDetails)
        throw new Error(
          result.exceptionDetails.text ?? 'Browser evaluation failed',
        )
      return result.result.value
    }
    const navigate = async (route) => {
      await bidi.command('browsingContext.navigate', {
        context,
        url: `http://127.0.0.1:${appPort}${route}`,
        wait: 'complete',
      })
      await sleep(150)
    }
    const locateAll = async (selector) => {
      const result = await bidi.command('browsingContext.locateNodes', {
        context,
        locator: { type: 'css', value: selector },
        maxNodeCount: 100,
      })
      return result.nodes
    }
    const locate = async (selector) => {
      const nodes = await locateAll(selector)
      assert.ok(nodes.length, `Missing ${selector}`)
      return nodes[0]
    }
    const clickNode = async (node) => {
      await bidi.command('script.callFunction', {
        functionDeclaration:
          '(element) => element.scrollIntoView({block:"center",inline:"center"})',
        target: { context },
        awaitPromise: false,
        arguments: [{ sharedId: node.sharedId }],
        resultOwnership: 'none',
      })
      await sleep(30)
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
                duration: 0,
                origin: {
                  type: 'element',
                  element: { sharedId: node.sharedId },
                },
              },
              { type: 'pointerDown', button: 0 },
              { type: 'pointerUp', button: 0 },
            ],
          },
        ],
      })
      await bidi.command('input.releaseActions', { context })
    }
    const replaceNode = async (node, value) => {
      await clickNode(node)
      await bidi.command('input.performActions', {
        context,
        actions: [
          {
            type: 'key',
            id: 'keyboard',
            actions: [
              { type: 'keyDown', value: '\uE03D' },
              { type: 'keyDown', value: 'a' },
              { type: 'keyUp', value: 'a' },
              { type: 'keyUp', value: '\uE03D' },
              { type: 'keyDown', value: '\uE003' },
              { type: 'keyUp', value: '\uE003' },
              ...[...value].flatMap((character) => [
                { type: 'keyDown', value: character },
                { type: 'keyUp', value: character },
              ]),
            ],
          },
        ],
      })
      await bidi.command('input.releaseActions', { context })
    }
    const replace = async (selector, value) =>
      replaceNode(await locate(selector), value)
    const waitPage = (expression, description) =>
      waitFor(
        async () => {
          if (await evaluate(expression)) return true
          const diagnostic = await evaluate(
            'JSON.stringify({ pathname: location.pathname, body: document.body.innerText.slice(-2000) })',
          )
          throw new Error(`${description} not ready: ${diagnostic}`)
        },
        description,
        30_000,
      )

    await navigate('/dashboard/init')
    await waitPage(
      "document.body.innerText.includes('Create admin account')",
      'GAP-08 initialization form',
    )
    await replace('#displayName', 'GAP08 Administrator')
    await replace('#handle', 'gap08-admin')
    await replace('#secret', 'gap08-password')
    await clickNode(await locate('button[type=submit]'))
    await waitPage(
      "location.pathname === '/dashboard'",
      'GAP-08 authenticated dashboard',
    )

    for (const [index, endpoint] of candidates.slice(0, 3).entries()) {
      const value = `g8-browser-${index}-${Date.now()}`
      await navigate(`/dashboard/${endpoint.listPath}/create`)
      await waitPage(
        `document.querySelector('label[for="field-${endpoint.labelField}"]')?.parentElement?.querySelector('input') !== null`,
        `${endpoint.id} rendered create field`,
      )
      const operation = `mutation DashboardCreate($data: ${endpoint.graphql.createInputName}!) { ${endpoint.graphql.createMutationName}(data: $data) { id ${endpoint.labelField} } }`
      const variables = { data: { [endpoint.labelField]: value } }
      const captured = JSON.parse(
        await evaluate(`(async () => {
          const response = await fetch('/api/graphql', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ query: ${JSON.stringify(operation)}, variables: ${JSON.stringify(variables)} }),
          })
          return JSON.stringify({ status: response.status, response: await response.json() })
        })()`),
      )
      assert.equal(captured.status, 200)
      assert.deepEqual(captured.response.errors, undefined)
      const returnedId =
        captured.response.data[endpoint.graphql.createMutationName].id
      assert.equal(typeof returnedId, 'string')
      assert.equal(
        captured.response.data[endpoint.graphql.createMutationName][
          endpoint.labelField
        ],
        value,
      )
      await navigate(`/dashboard/${endpoint.listPath}/${returnedId}`)
      const routeId = String(
        await evaluate("location.pathname.split('/').at(-1)"),
      )
      assert.equal(routeId, returnedId)
      await waitPage(
        `document.body.innerText.includes(${JSON.stringify(value)})`,
        `${endpoint.id} rendered reload persistence`,
      )
      report.created.push({
        endpointId: endpoint.id,
        listKey: endpoint.listKey,
        returnedId,
        routeId,
        value,
      })
      await writeJsonAtomic(reportPath, report)
    }

    const unexpectedConsole = bidi.events.filter(
      (event) =>
        event.method === 'log.entryAdded' &&
        ['error', 'assert'].includes(event.params.level),
    )
    const expectedNavigationAborts = bidi.events.filter(
      (event) =>
        event.method === 'network.fetchError' &&
        event.params.errorText === 'NS_BINDING_ABORTED',
    )
    const unexpectedNetwork = bidi.events
      .filter(
        (event) =>
          event.method === 'network.fetchError' &&
          event.params.errorText !== 'NS_BINDING_ABORTED',
      )
      .map((event) => ({
        errorText: event.params.errorText,
        method: event.params.request?.method,
        pathname: (() => {
          try {
            return new URL(event.params.request?.url).pathname
          } catch {
            return 'invalid-url'
          }
        })(),
      }))
    assert.deepEqual(unexpectedConsole, [])
    assert.deepEqual(unexpectedNetwork, [])
    report.eventCount = bidi.events.length
    report.expectedNavigationAborts = expectedNavigationAborts.length
    report.status = 'PASS'
    report.finalizedAt = new Date().toISOString()
    await writeJsonAtomic(reportPath, report)
    await bidi.command('session.end')
  } finally {
    bidi?.close()
    await Promise.allSettled([
      terminate(firefox, 'GAP-08 Firefox'),
      terminate(app, 'GAP-08 app'),
    ])
    await rm(profile, { recursive: true, force: true })
  }
}

let primaryError
try {
  await main()
} catch (error) {
  primaryError = error
  report.status = 'RED'
  report.failures.push(captureError(error))
  report.finalizedAt = new Date().toISOString()
  await writeJsonAtomic(reportPath, report).catch(() => {})
}
if (primaryError) {
  await writeFile(
    `${reportPath}.diagnostic.log`,
    `${boundedDiagnostic(primaryError.stack ?? primaryError)}\n`,
  ).catch(() => {})
  throw primaryError
}
