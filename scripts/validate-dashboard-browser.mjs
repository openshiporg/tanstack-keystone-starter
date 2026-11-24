import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

import {
  processGroupExists,
  runBoundedChild,
  terminateChildGroup,
} from './lib/bounded-child.mjs'

const firefoxLauncherProbe =
  process.env.DASHBOARD_BROWSER_FIREFOX_LAUNCHER_PROBE === '1'
const firefoxBinary =
  process.env.FIREFOX_BIN ?? '/Applications/Firefox.app/Contents/MacOS/firefox'
const firefoxCommand = firefoxLauncherProbe ? process.execPath : firefoxBinary
const firefoxProbeScript = path.resolve(
  'scripts/fixtures/firefox-launcher-exit.mjs',
)
const serverEntry = path.resolve('.output/server/index.mjs')
const processes = []
const matrixMode = process.env.DASHBOARD_BROWSER_MATRIX_MODE ?? 'seeded'
const responsiveNoBreakToken = `R${'7K9M2Q4X8V6N3P5T1Z0C'.repeat(8)}`
const responsiveLongLabel =
  process.env.DASHBOARD_BROWSER_RESPONSIVE_LABEL ??
  `Responsive coverage label with realistic spaced words and identifier ${responsiveNoBreakToken}`

assert.ok(
  ['seeded', 'fresh', 'prisma', 'arbitrary'].includes(matrixMode),
  `Unknown dashboard browser matrix mode: ${matrixMode}`,
)
if (matrixMode === 'prisma') {
  assert.ok(
    process.env.DATABASE_URL,
    'Prisma browser mode requires DATABASE_URL',
  )
}

if (process.env.DASHBOARD_BROWSER_CURRENT_BUILD !== '1') {
  throw new Error(
    'Run `npm run test:dashboard:browser` so the browser gate builds current source before execution.',
  )
}
let appLog = ''
let firefoxLog = ''

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      assert.ok(address && typeof address === 'object')
      const { port } = address
      server.close((error) => (error ? reject(error) : resolve(port)))
    })
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

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    ...options,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  processes.push(child)
  return child
}

async function stopProcesses() {
  const results = await Promise.allSettled(
    processes.toReversed().map(async (child) => {
      if (!child.pid || !processGroupExists(child.pid)) return
      await terminateChildGroup(child, 'dashboard browser child process')
    }),
  )
  const errors = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason)
  if (errors.length > 0) {
    throw new AggregateError(errors, 'Dashboard browser child cleanup failed')
  }
}

async function profileBoundProcesses(profileDirectory) {
  const { stdout } = await runBoundedChild(
    '/bin/ps',
    ['-axo', 'pid=,command='],
    {
      label: 'profile-bound Firefox process discovery',
      timeout: 5_000,
      captureOutput: true,
      maxCapturedBytes: 4 * 1024 * 1024,
    },
  )
  return stdout
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

async function terminateProfileBoundProcesses(profileDirectory) {
  for (const { pid } of await profileBoundProcesses(profileDirectory)) {
    signalPid(pid, 'SIGTERM')
  }
  await sleep(300)
  for (const { pid } of await profileBoundProcesses(profileDirectory)) {
    signalPid(pid, 'SIGKILL')
  }
  await waitFor(
    async () => (await profileBoundProcesses(profileDirectory)).length === 0,
    'profile-bound Firefox process cleanup',
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
        } else {
          pending.resolve(message.result)
        }
      } else if (message.type === 'event') {
        this.events.push(message)
      }
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

async function runBrowserFlow(webSocketBase, appBase) {
  const bidi = new BidiClient(`${webSocketBase}/session`)
  await bidi.connect()
  let context

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

  async function evaluateNode(expression) {
    const result = await bidi.command('script.evaluate', {
      expression,
      target: { context },
      awaitPromise: true,
      resultOwnership: 'root',
    })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    assert.ok(result.result.sharedId, `Expected a DOM node from ${expression}`)
    return result.result
  }

  async function waitForPage(expression, description, timeout = 30_000) {
    try {
      await waitFor(() => evaluate(expression), description, timeout)
    } catch (error) {
      console.error(`Browser state while waiting for ${description}:`, {
        location: await evaluate('location.href'),
        body: await evaluate('document.body.innerText'),
      })
      throw error
    }
  }

  async function startGraphQLMutationCapture(queryIncludes) {
    await evaluate(`(() => {
      if (globalThis.__dashboardOriginalFetch) {
        throw new Error('GraphQL mutation capture is already active')
      }
      globalThis.__dashboardGraphQLEvidence = []
      globalThis.__dashboardOriginalFetch = globalThis.fetch
      globalThis.fetch = async (...args) => {
        const response = await globalThis.__dashboardOriginalFetch(...args)
        try {
          const input = args[0]
          const init = args[1]
          const url = new URL(typeof input === 'string' ? input : input.url, location.href)
          const request = typeof init?.body === 'string' ? JSON.parse(init.body) : null
          if (
            url.origin === location.origin &&
            url.pathname === '/api/graphql' &&
            request?.query?.includes(${JSON.stringify(queryIncludes)})
          ) {
            const evidence = { request, response: null, status: response.status }
            globalThis.__dashboardGraphQLEvidence.push(evidence)
            response
              .clone()
              .json()
              .then((body) => {
                evidence.response = body
              })
              .catch((captureError) => {
                evidence.captureError = String(captureError)
              })
          }
        } catch (captureError) {
          globalThis.__dashboardGraphQLEvidence.push({
            captureError: String(captureError),
          })
        }
        return response
      }
    })()`)
  }

  async function stopGraphQLMutationCapture() {
    const evidence = JSON.parse(
      await evaluate(`JSON.stringify((() => {
        const evidence = globalThis.__dashboardGraphQLEvidence ?? []
        if (globalThis.__dashboardOriginalFetch) {
          globalThis.fetch = globalThis.__dashboardOriginalFetch
        }
        delete globalThis.__dashboardOriginalFetch
        delete globalThis.__dashboardGraphQLEvidence
        return evidence
      })())`),
    )
    return evidence
  }

  async function captureGraphQLMutation(
    mutationName,
    action,
    { queryIncludes = mutationName, resultIdPath = ['id'] } = {},
  ) {
    try {
      await startGraphQLMutationCapture(queryIncludes)
      await action()
      await waitFor(
        () =>
          evaluate(
            `Boolean(globalThis.__dashboardGraphQLEvidence?.some(entry => entry.request?.query?.includes(${JSON.stringify(queryIncludes)}) && (entry.response !== null || entry.captureError)))`,
          ),
        `${mutationName} GraphQL network response`,
      )
      const evidence = await stopGraphQLMutationCapture()
      const mutation = evidence.find((entry) =>
        entry.request?.query?.includes(queryIncludes),
      )
      assert.ok(mutation, `${mutationName} network evidence was not captured`)
      assert.equal(mutation.captureError, undefined)
      assert.equal(mutation.status, 200)
      assert.deepEqual(mutation.response.errors, undefined)
      if (resultIdPath) {
        const mutationResult = mutation.response.data?.[mutationName]
        const returnedId = resultIdPath.reduce(
          (value, key) => value?.[key],
          mutationResult,
        )
        assert.ok(
          returnedId,
          `${mutationName} did not return an item id: ${JSON.stringify(mutation.response)}`,
        )
      }
      return mutation
    } finally {
      if (await evaluate('Boolean(globalThis.__dashboardOriginalFetch)')) {
        await stopGraphQLMutationCapture()
      }
    }
  }

  async function verifyGraphQLCaptureRestoration() {
    await evaluate(
      'globalThis.__dashboardFetchBeforeNegativeCapture = globalThis.fetch',
    )
    await assert.rejects(
      () =>
        captureGraphQLMutation('createNever', async () => {
          throw new Error('intentional capture action failure')
        }),
      /intentional capture action failure/,
    )
    const restoration = JSON.parse(
      await evaluate(`JSON.stringify((() => {
        const result = {
          fetchRestored:
            globalThis.fetch === globalThis.__dashboardFetchBeforeNegativeCapture,
          originalDeleted: !('__dashboardOriginalFetch' in globalThis),
          evidenceDeleted: !('__dashboardGraphQLEvidence' in globalThis),
        }
        delete globalThis.__dashboardFetchBeforeNegativeCapture
        return result
      })())`),
    )
    assert.deepEqual(restoration, {
      fetchRestored: true,
      originalDeleted: true,
      evidenceDeleted: true,
    })
  }

  async function locate(selector) {
    const result = await bidi.command('browsingContext.locateNodes', {
      context,
      locator: { type: 'css', value: selector },
      maxNodeCount: 1,
    })
    assert.equal(result.nodes.length, 1, `Expected one node for ${selector}`)
    return result.nodes[0]
  }

  async function clickNode(node) {
    await bidi.command('script.callFunction', {
      functionDeclaration: `(element) => {
        element.scrollIntoView({ block: 'center', inline: 'center' })
      }`,
      target: { context },
      awaitPromise: false,
      arguments: [{ sharedId: node.sharedId }],
      resultOwnership: 'none',
    })
    await sleep(50)
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
              origin: { type: 'element', element: { sharedId: node.sharedId } },
            },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerUp', button: 0 },
          ],
        },
      ],
    })
    await bidi.command('input.releaseActions', { context })
  }

  const click = async (selector) => clickNode(await locate(selector))
  const clickExpression = async (expression) =>
    clickNode(await evaluateNode(expression))
  const clickText = async (text) =>
    clickExpression(
      `Array.from(document.querySelectorAll('button, a')).find(node => node.innerText.trim() === ${JSON.stringify(text)})`,
    )

  async function typeCharacters(value) {
    const actions = []
    for (const character of value) {
      actions.push(
        { type: 'keyDown', value: character },
        { type: 'keyUp', value: character },
      )
    }
    await bidi.command('input.performActions', {
      context,
      actions: [{ type: 'key', id: 'keyboard', actions }],
    })
    await bidi.command('input.releaseActions', { context })
  }

  async function typeNode(node, value) {
    await clickNode(node)
    await typeCharacters(value)
  }

  async function selectAllNode(node) {
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
          ],
        },
      ],
    })
    await bidi.command('input.releaseActions', { context })
  }

  async function pressShortcut(key) {
    await bidi.command('input.performActions', {
      context,
      actions: [
        {
          type: 'key',
          id: 'keyboard',
          actions: [
            { type: 'keyDown', value: '\uE03D' },
            { type: 'keyDown', value: key },
            { type: 'keyUp', value: key },
            { type: 'keyUp', value: '\uE03D' },
          ],
        },
      ],
    })
    await bidi.command('input.releaseActions', { context })
  }

  async function replaceNode(node, value) {
    await selectAllNode(node)
    await bidi.command('input.performActions', {
      context,
      actions: [
        {
          type: 'key',
          id: 'keyboard',
          actions: [
            { type: 'keyDown', value: '\uE003' },
            { type: 'keyUp', value: '\uE003' },
          ],
        },
      ],
    })
    await bidi.command('input.releaseActions', { context })
    await typeNode(node, value)
  }

  async function scroll(deltaY) {
    await bidi.command('input.performActions', {
      context,
      actions: [
        {
          type: 'wheel',
          id: 'wheel',
          actions: [
            {
              type: 'scroll',
              x: 0,
              y: 0,
              deltaX: 0,
              deltaY,
              duration: 100,
              origin: 'viewport',
            },
          ],
        },
      ],
    })
    await bidi.command('input.releaseActions', { context })
    await sleep(100)
  }

  function activeNetworkRequestIds() {
    const active = new Set()
    for (const event of bidi.events) {
      const requestId = event.params?.request?.request
      if (!requestId) continue
      if (event.method === 'network.beforeRequestSent') active.add(requestId)
      if (
        event.method === 'network.responseCompleted' ||
        event.method === 'network.fetchError'
      ) {
        active.delete(requestId)
      }
    }
    return active
  }

  async function waitForNetworkIdle() {
    await waitFor(async () => {
      if (activeNetworkRequestIds().size > 0) return false
      const eventCount = bidi.events.length
      await sleep(150)
      return (
        eventCount === bidi.events.length &&
        activeNetworkRequestIds().size === 0
      )
    }, 'browser network to become idle')
  }

  async function navigate(route, expectedRoute = route) {
    await waitForNetworkIdle()
    const expectedPath = new URL(expectedRoute, appBase).pathname
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await bidi.command('browsingContext.navigate', {
        context,
        url: `${appBase}${route}`,
        wait: 'complete',
      })
      await sleep(150)
      if ((await evaluate('location.pathname')) === expectedPath) return
    }
    throw new Error(`Navigation did not settle on ${expectedPath}`)
  }

  async function createDashboardItem({
    listPath,
    singular,
    mutationName,
    persistedText,
    persistedExpression = `document.body.innerText.includes(${JSON.stringify(persistedText)})`,
    fill,
    assertRequest,
    afterReload = async () => {},
  }) {
    await navigate(`/dashboard/${listPath}/create`)
    await waitForPage(
      `location.pathname === ${JSON.stringify(`/dashboard/${listPath}/create`)} && document.body.innerText.includes(${JSON.stringify(`Create ${singular}`)})`,
      `${singular} create form`,
    )
    await fill()
    const evidence = await captureGraphQLMutation(mutationName, async () => {
      await clickText(`Create ${singular}`)
      await waitForPage(
        `location.pathname.startsWith(${JSON.stringify(`/dashboard/${listPath}/`)}) && !location.pathname.endsWith('/create')`,
        `created ${singular} item`,
      )
    })
    assertRequest(evidence.request.variables.data)
    const createdId = evidence.response.data[mutationName].id
    const createdPath = await evaluate('location.pathname')
    assert.equal(decodeURIComponent(createdPath.split('/').pop()), createdId)
    await waitForPage(persistedExpression, `created ${singular} value`)
    await navigate(createdPath)
    await waitForPage(
      persistedExpression,
      `persisted ${singular} value after reload`,
    )
    await afterReload({ createdId, createdPath })
    return { createdId, createdPath, evidence }
  }

  async function runArbitraryModelCreateMatrix() {
    await navigate('/dashboard', '/dashboard/init')
    await waitForPage(
      "document.body.innerText.includes('Create admin account')",
      'arbitrary-model initialization form',
    )
    const publicAuthResult = JSON.parse(
      await evaluate(`(async () => JSON.stringify(await (await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'query ArbitraryPublicAuth { keystone { auth { listKey identityField secretField initFirstItemFields } } }' }),
      })).json()))()`),
    )
    assert.deepEqual(publicAuthResult.errors, undefined)
    const publicAuth = publicAuthResult.data.keystone.auth
    for (const value of [
      publicAuth.listKey,
      publicAuth.identityField,
      publicAuth.secretField,
      ...publicAuth.initFirstItemFields,
    ]) {
      assert.match(value, /^[_A-Za-z][_0-9A-Za-z]*$/)
    }
    const createInitialMutationName = `createInitial${publicAuth.listKey}`
    const authenticateMutationName = `authenticate${publicAuth.listKey}WithPassword`
    const initialValues = Object.fromEntries(
      publicAuth.initFirstItemFields.map((field) => [
        field,
        field === publicAuth.secretField
          ? 'Arbitrary-admin-password-123!'
          : field === publicAuth.identityField
            ? 'arbitrary-admin'
            : `Arbitrary ${field}`,
      ]),
    )
    for (const field of publicAuth.initFirstItemFields) {
      await typeNode(await locate(`#${field}`), initialValues[field])
    }
    const initEvidence = await captureGraphQLMutation(
      createInitialMutationName,
      () => click('button[type="submit"]'),
      { resultIdPath: ['item', 'id'] },
    )
    assert.deepEqual(initEvidence.request.variables.data, initialValues)
    const initializedAuthItemId =
      initEvidence.response.data[createInitialMutationName].item.id
    await waitForPage(
      "location.pathname === '/dashboard'",
      'arbitrary-model administrator initialization',
    )

    const signOutResult = JSON.parse(
      await evaluate(`(async () => JSON.stringify(await (await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'mutation ArbitrarySignOut { endSession }' }),
      })).json()))()`),
    )
    assert.deepEqual(signOutResult.errors, undefined)
    assert.equal(signOutResult.data.endSession, true)
    await navigate('/dashboard/signin')
    await typeNode(
      await locate(`#${publicAuth.identityField}`),
      initialValues[publicAuth.identityField],
    )
    await typeNode(
      await locate(`#${publicAuth.secretField}`),
      initialValues[publicAuth.secretField],
    )
    const authenticationVariables = {
      identity: initialValues[publicAuth.identityField],
      secret: initialValues[publicAuth.secretField],
    }
    const authenticationProbeResponse = await fetch(`${appBase}/api/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `mutation ArbitraryAuthenticationProbe($identity: String!, $secret: String!) {
          ${authenticateMutationName}(
            ${publicAuth.identityField}: $identity
            ${publicAuth.secretField}: $secret
          ) {
            __typename
            ... on ${publicAuth.listKey}AuthenticationWithPasswordSuccess { item { id } }
            ... on ${publicAuth.listKey}AuthenticationWithPasswordFailure { message }
          }
        }`,
        variables: authenticationVariables,
      }),
    })
    assert.equal(authenticationProbeResponse.status, 200)
    const authenticationProbe = await authenticationProbeResponse.json()
    assert.deepEqual(authenticationProbe.errors, undefined)
    assert.equal(
      authenticationProbe.data[authenticateMutationName].__typename,
      `${publicAuth.listKey}AuthenticationWithPasswordSuccess`,
    )
    assert.equal(
      authenticationProbe.data[authenticateMutationName].item.id,
      initializedAuthItemId,
    )
    await click('button[type="submit"]')
    await waitForPage(
      "location.pathname === '/dashboard'",
      `${authenticateMutationName} arbitrary-model sign in`,
    )

    const metaResult = JSON.parse(
      await evaluate(`(async () => JSON.stringify(await (await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: \`query ArbitraryBrowserAdminMeta {
          keystone {
            adminMeta {
              isAccessAllowed
              lists {
                key path singular labelField isHidden hideCreate
                graphql { names { createMutationName itemQueryName } }
                fields {
                  path label fieldMeta
                  createView { fieldMode isRequired }
                }
              }
            }
          }
        }\` }),
      })).json()))()`),
    )
    assert.deepEqual(metaResult.errors, undefined)
    const adminMeta = metaResult.data.keystone.adminMeta
    assert.equal(adminMeta.isAccessAllowed, true)
    const creatableLists = adminMeta.lists.filter(
      (list) => !list.hideCreate && !list.isHidden,
    )
    assert.ok(
      creatableLists.length > 0,
      'AdminMeta did not expose any permitted arbitrary-model create routes',
    )
    const expectedListKeys = (
      process.env.ARBITRARY_BROWSER_EXPECTED_LIST_KEYS ?? ''
    )
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean)
      .sort()
    if (expectedListKeys.length > 0) {
      assert.deepEqual(
        creatableLists.map((list) => list.key).sort(),
        expectedListKeys,
        'AdminMeta creatable-list discovery did not match the fixture contract',
      )
    }

    for (const list of creatableLists) {
      const editableFields = list.fields.filter(
        (field) => field.createView.fieldMode === 'edit',
      )
      const unsupportedFields = editableFields.filter(
        (field) =>
          !['text', 'integer', 'checkbox'].includes(field.fieldMeta.kind),
      )
      assert.deepEqual(
        unsupportedFields.map((field) => ({
          path: field.path,
          kind: field.fieldMeta.kind,
        })),
        [],
        `${list.key} has arbitrary-browser fixture fields without generic input support`,
      )
      const submittedValues = Object.fromEntries(
        editableFields.map((field, index) => {
          if (field.fieldMeta.kind === 'integer')
            return [field.path, 37 + index]
          if (field.fieldMeta.kind === 'checkbox') return [field.path, true]
          const value = field.path.toLowerCase().includes('email')
            ? `${list.path}-${field.path}@example.test`
            : `Arbitrary ${list.key} ${field.label} ${index + 1}`
          return [field.path, value]
        }),
      )
      const labelValue = submittedValues[list.labelField]
      assert.equal(
        typeof labelValue,
        'string',
        `${list.key} fixture label field must be an editable text field`,
      )
      const names = list.graphql.names
      await createDashboardItem({
        listPath: list.path,
        singular: list.singular,
        mutationName: names.createMutationName,
        persistedText: labelValue,
        fill: async () => {
          for (const field of editableFields) {
            const fieldContainer = `document.querySelector('label[for=${JSON.stringify(`field-${field.path}`)}]')?.parentElement`
            if (field.fieldMeta.kind === 'checkbox') {
              await clickExpression(
                `${fieldContainer}?.querySelector('[role=checkbox]')`,
              )
            } else {
              await typeNode(
                await evaluateNode(`${fieldContainer}?.querySelector('input')`),
                String(submittedValues[field.path]),
              )
            }
          }
        },
        assertRequest: (data) => {
          assert.deepEqual(data, submittedValues)
        },
        afterReload: async ({ createdId }) => {
          if (matrixMode === 'arbitrary' && list.key === 'Project') {
            await waitForPage(
              "document.querySelector('[data-custom-field-marker=field]') !== null",
              'custom Field module marker',
            )
            const itemPath = await evaluate('location.pathname')
            await navigate(`/dashboard/${list.path}`)
            await waitForPage(
              "document.querySelector('[data-custom-cell-marker=cell]') !== null",
              'custom Cell module marker',
            )
            await navigate(itemPath)
            await waitForPage(
              "document.querySelector('[data-custom-field-marker=field]') !== null",
              'custom Field module marker after list navigation',
            )
          }
          for (const field of editableFields) {
            const fieldContainer = `document.querySelector('label[for=${JSON.stringify(`field-${field.path}`)}]')?.parentElement`
            if (field.fieldMeta.kind === 'checkbox') {
              const persistedCheckboxExpression = `${fieldContainer}?.querySelector('[role=checkbox]')?.getAttribute('aria-checked') === 'true'`
              await waitForPage(
                persistedCheckboxExpression,
                `${list.key}.${field.path} persisted checkbox hydration`,
              )
              assert.equal(await evaluate(persistedCheckboxExpression), true)
            } else {
              const persistedInputExpression = `${fieldContainer}?.querySelector('input')?.value === ${JSON.stringify(String(submittedValues[field.path]))}`
              await waitForPage(
                persistedInputExpression,
                `${list.key}.${field.path} persisted input hydration`,
              )
              assert.equal(await evaluate(persistedInputExpression), true)
            }
          }
          const selectedFields = editableFields.map((field) => {
            assert.match(
              field.path,
              /^[_A-Za-z][_0-9A-Za-z]*$/,
              `Invalid arbitrary fixture GraphQL field: ${field.path}`,
            )
            return field.path
          })
          const persisted = JSON.parse(
            await evaluate(`(async () => JSON.stringify(await (await fetch('/api/graphql', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                query: ${JSON.stringify(`query ArbitraryPersistedItem($id: ID!) { ${names.itemQueryName}(where: { id: $id }) { id ${selectedFields.join(' ')} } }`)},
                variables: { id: ${JSON.stringify(createdId)} },
              }),
            })).json()))()`),
          )
          assert.deepEqual(persisted.errors, undefined)
          assert.deepEqual(persisted.data[names.itemQueryName], {
            id: createdId,
            ...submittedValues,
          })
        },
      })
    }

    return creatableLists.map((list) => list.key)
  }

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
    context = tree.contexts[0].context
    await bidi.command('browsingContext.setViewport', {
      context,
      viewport: { width: 1440, height: 2000 },
    })

    if (matrixMode === 'arbitrary') {
      const createdListKeys = await runArbitraryModelCreateMatrix()
      await waitForNetworkIdle()
      const failures = bidi.events.filter(
        (event) => event.method === 'network.fetchError',
      )
      const unexpectedFailures = failures.filter(
        (event) => event.params.errorText !== 'NS_BINDING_ABORTED',
      )
      const badResponses = bidi.events.filter(
        (event) =>
          event.method === 'network.responseCompleted' &&
          event.params.response.status >= 400,
      )
      const consoleErrors = bidi.events.filter(
        (event) =>
          event.method === 'log.entryAdded' &&
          ['error', 'assert'].includes(event.params.level),
      )
      assert.deepEqual(unexpectedFailures, [])
      assert.deepEqual(badResponses, [])
      assert.deepEqual(consoleErrors, [])
      console.log(
        `Firefox dashboard arbitrary-model acceptance passed: AdminMeta discovered and persisted ${createdListKeys.join(', ')}; ${bidi.events.length} observed events, ${failures.length} expected navigation abort(s), 0 unexpected request/response/console errors.`,
      )
      await bidi.command('session.end')
      return
    }

    let primaryAdmin
    if (matrixMode === 'fresh') {
      await navigate('/dashboard', '/dashboard/init')
      await waitForPage(
        "document.body.innerText.includes('Create admin account')",
        'fresh-memory initialization form',
      )
      await typeNode(await locate('#name'), 'Fresh Matrix Admin')
      await typeNode(await locate('#email'), 'fresh-admin@example.com')
      await typeNode(await locate('#password'), 'Fresh-admin-password-123!')
      const initEvidence = await captureGraphQLMutation(
        'createInitialUser',
        () => click('button[type="submit"]'),
        { resultIdPath: ['item', 'id'] },
      )
      assert.deepEqual(initEvidence.request.variables.data, {
        name: 'Fresh Matrix Admin',
        email: 'fresh-admin@example.com',
        password: 'Fresh-admin-password-123!',
      })
      const initializedUser = initEvidence.response.data.createInitialUser.item
      await waitForPage(
        "location.pathname === '/dashboard'",
        'fresh administrator initialization and authentication',
      )
      primaryAdmin = {
        id: initializedUser.id,
        label: 'Fresh Matrix Admin',
      }
    } else {
      await navigate('/dashboard/signin')
      const brandParts = JSON.parse(
        await evaluate(
          "JSON.stringify(Array.from(document.querySelector('h1').childNodes, node => node.textContent.trim().toLowerCase()))",
        ),
      )
      assert.deepEqual(brandParts, ['keystone', 'x', 'tanstack'])
      await typeNode(await locate('#email'), 'ada@example.com')
      await typeNode(await locate('#password'), 'password')
      await click('button[type="submit"]')
      await waitForPage(
        "location.pathname === '/dashboard'",
        'successful dashboard authentication',
      )
      primaryAdmin = { id: 'user_admin', label: 'Ada Admin' }
    }
    await verifyGraphQLCaptureRestoration()

    await createDashboardItem({
      listPath: 'roles',
      singular: 'Role',
      mutationName: 'createRole',
      persistedText: 'Browser matrix role',
      fill: async () => {
        await typeNode(
          await evaluateNode(
            "document.querySelector('label[for=field-name]').parentElement.querySelector('input')",
          ),
          'Browser matrix role',
        )
      },
      assertRequest: (data) => {
        assert.equal(data.name, 'Browser matrix role')
      },
    })

    const matrixUser = await createDashboardItem({
      listPath: 'users',
      singular: 'User',
      mutationName: 'createUser',
      persistedText: 'browser-matrix@example.com',
      persistedExpression:
        "document.querySelector('label[for=field-email]').parentElement.querySelector('input')?.value === 'browser-matrix@example.com'",
      fill: async () => {
        await typeNode(
          await evaluateNode(
            "document.querySelector('label[for=field-name]').parentElement.querySelector('input')",
          ),
          'Browser Matrix User',
        )
        await typeNode(
          await evaluateNode(
            "document.querySelector('label[for=field-email]').parentElement.querySelector('input')",
          ),
          'browser-matrix@example.com',
        )
        await clickText('Set password')
        const passwordInputs = JSON.parse(
          await evaluate(
            "JSON.stringify(Array.from(document.querySelector('label[for=field-password]').parentElement.querySelectorAll('input'), (_, index) => index))",
          ),
        )
        assert.equal(passwordInputs.length, 2)
        await typeNode(
          await evaluateNode(
            "document.querySelector('label[for=field-password]').parentElement.querySelectorAll('input')[0]",
          ),
          'Browser-password-123!',
        )
        await typeNode(
          await evaluateNode(
            "document.querySelector('label[for=field-password]').parentElement.querySelectorAll('input')[1]",
          ),
          'Browser-password-123!',
        )
      },
      assertRequest: (data) => {
        assert.equal(data.name, 'Browser Matrix User')
        assert.equal(data.email, 'browser-matrix@example.com')
        assert.equal(data.password, 'Browser-password-123!')
      },
      afterReload: async ({ createdId }) => {
        assert.equal(
          await evaluate(
            "document.querySelector('label[for=field-name]').parentElement.querySelector('input')?.value",
          ),
          'Browser Matrix User',
        )
        assert.equal(
          await evaluate(
            "document.querySelector('label[for=field-email]').parentElement.querySelector('input')?.value",
          ),
          'browser-matrix@example.com',
        )
        const persistedUser = JSON.parse(
          await evaluate(`(async () => JSON.stringify(await (await fetch('/api/graphql', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              query: 'query BrowserCreatedUser($id: ID!) { user(where: { id: $id }) { id name email } }',
              variables: { id: ${JSON.stringify(createdId)} },
            }),
          })).json()))()`),
        )
        assert.deepEqual(persistedUser.errors, undefined)
        assert.deepEqual(persistedUser.data.user, {
          id: createdId,
          name: 'Browser Matrix User',
          email: 'browser-matrix@example.com',
        })

        const authenticationResponse = await fetch(`${appBase}/api/graphql`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query:
              'mutation BrowserVerifyPassword($email: String!, $password: String!) { authenticateUserWithPassword(email: $email, password: $password) { __typename ... on UserAuthenticationWithPasswordSuccess { item { id email } } ... on UserAuthenticationWithPasswordFailure { message } } }',
            variables: {
              email: 'browser-matrix@example.com',
              password: 'Browser-password-123!',
            },
          }),
        })
        assert.equal(authenticationResponse.status, 200)
        const authentication = await authenticationResponse.json()
        assert.deepEqual(authentication.errors, undefined)
        assert.equal(
          authentication.data.authenticateUserWithPassword.__typename,
          'UserAuthenticationWithPasswordSuccess',
        )
        assert.equal(
          authentication.data.authenticateUserWithPassword.item.id,
          createdId,
        )
      },
    })
    const secondaryAssignee =
      matrixMode === 'fresh'
        ? { id: matrixUser.createdId, label: 'Browser Matrix User' }
        : { id: 'user_editor', label: 'Ed Editor' }

    await createDashboardItem({
      listPath: 'todo-images',
      singular: 'Todo Image',
      mutationName: 'createTodoImage',
      persistedText: 'Browser matrix image',
      persistedExpression:
        "document.querySelector('label[for=field-altText]').parentElement.querySelector('input')?.value === 'Browser matrix image'",
      fill: async () => {
        await typeNode(
          await evaluateNode(
            "document.querySelector('label[for=field-imagePath]').parentElement.querySelector('input')",
          ),
          '/browser-matrix-image.png',
        )
        await typeNode(
          await evaluateNode(
            "document.querySelector('label[for=field-altText]').parentElement.querySelector('input')",
          ),
          'Browser matrix image',
        )
      },
      assertRequest: (data) => {
        assert.equal(data.imagePath, '/browser-matrix-image.png')
        assert.equal(data.altText, 'Browser matrix image')
      },
      afterReload: async ({ createdId }) => {
        assert.equal(
          await evaluate(
            "document.querySelector('label[for=field-imagePath]').parentElement.querySelector('input')?.value",
          ),
          '/browser-matrix-image.png',
        )
        assert.equal(
          await evaluate(
            "document.querySelector('label[for=field-altText]').parentElement.querySelector('input')?.value",
          ),
          'Browser matrix image',
        )
        const persistedImage = JSON.parse(
          await evaluate(`(async () => JSON.stringify(await (await fetch('/api/graphql', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              query: 'query BrowserCreatedTodoImage($id: ID!) { todoImage(where: { id: $id }) { id imagePath altText } }',
              variables: { id: ${JSON.stringify(createdId)} },
            }),
          })).json()))()`),
        )
        assert.deepEqual(persistedImage.errors, undefined)
        assert.deepEqual(persistedImage.data.todoImage, {
          id: createdId,
          imagePath: '/browser-matrix-image.png',
          altText: 'Browser matrix image',
        })
      },
    })

    await navigate('/dashboard/todos/create')
    await waitForPage(
      "location.pathname === '/dashboard/todos/create' && document.body.innerText.includes('Create Todo')",
      'Todo create form',
    )
    await scroll(1000)
    await typeNode(
      await evaluateNode(
        "document.querySelector('label[for=field-label]').parentElement.querySelector('input')",
      ),
      'Browser-created Todo',
    )
    await typeNode(
      await locate(
        '[contenteditable=true][aria-label="Rich document content"]',
      ),
      'Created through Firefox WebDriver BiDi.',
    )
    await waitForPage(
      "document.querySelector('[contenteditable=true][aria-label=\"Rich document content\"]')?.innerText.includes('Created through Firefox WebDriver BiDi.')",
      'rich document create input',
    )
    await click('button[aria-label="Heading 1"]')
    await waitForPage(
      "document.querySelector('[contenteditable=true][aria-label=\"Rich document content\"] h1')?.innerText.includes('Created through Firefox WebDriver BiDi.')",
      'rich document heading formatting',
    )
    await scroll(600)
    await clickExpression(
      `Array.from(document.querySelector('label[for=field-assignedTo]').parentElement.querySelectorAll('button')).find(node => node.innerText.includes(${JSON.stringify(primaryAdmin.label)}))`,
    )
    await scroll(-10_000)
    const createNetworkEvidence = await captureGraphQLMutation(
      'createTodo',
      async () => {
        await clickText('Create Todo')
        await waitForPage(
          "location.pathname.startsWith('/dashboard/todos/') && !location.pathname.endsWith('/create')",
          'created Todo item',
        )
      },
    )
    const createdTodoInput = createNetworkEvidence.request.variables.data
    assert.equal(createdTodoInput.label, 'Browser-created Todo')
    assert.equal(createdTodoInput.description.document[0].type, 'heading')
    assert.equal(createdTodoInput.description.document[0].level, 1)
    assert.equal(
      createdTodoInput.description.document[0].children[0].text,
      'Created through Firefox WebDriver BiDi.',
    )
    assert.equal(createdTodoInput.assignedTo.connect.id, primaryAdmin.id)
    await waitForPage(
      "document.body.innerText.includes('Browser-created Todo')",
      'created Todo label',
    )
    const createdPath = await evaluate('location.pathname')
    const createdTodoId = decodeURIComponent(createdPath.split('/').pop())

    await navigate(createdPath)
    await waitForPage(
      "document.querySelector('label[for=field-label]').parentElement.querySelector('input')?.value === 'Browser-created Todo'",
      'create-time Todo label after reload',
    )
    await waitForPage(
      "document.querySelector('[contenteditable=true][aria-label=\"Rich document content\"] h1')?.innerText.includes('Created through Firefox WebDriver BiDi.')",
      'create-time Todo document after reload',
    )
    await waitForPage(
      `document.querySelector('label[for=field-assignedTo]').parentElement.innerText.includes(${JSON.stringify(primaryAdmin.label)})`,
      'create-time Todo relationship after reload',
    )
    const persistedCreateResponse = JSON.parse(
      await evaluate(`(async () => JSON.stringify(await (await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: 'query BrowserCreatedTodo($id: ID!) { todo(where: { id: $id }) { id label description { document } assignedTo { id name } } }',
          variables: { id: location.pathname.split('/').pop() },
        }),
      })).json()))()`),
    )
    assert.deepEqual(persistedCreateResponse.errors, undefined)
    assert.equal(
      persistedCreateResponse.data.todo.label,
      'Browser-created Todo',
    )
    assert.equal(
      persistedCreateResponse.data.todo.description.document[0].children[0]
        .text,
      'Created through Firefox WebDriver BiDi.',
    )
    assert.equal(
      persistedCreateResponse.data.todo.assignedTo.id,
      primaryAdmin.id,
    )
    assert.equal(
      persistedCreateResponse.data.todo.assignedTo.name,
      primaryAdmin.label,
    )

    await scroll(1000)
    await replaceNode(
      await evaluateNode(
        "document.querySelector('label[for=field-label]').parentElement.querySelector('input')",
      ),
      'Browser-updated Todo',
    )
    await replaceNode(
      await locate(
        '[contenteditable=true][aria-label="Rich document content"]',
      ),
      '',
    )
    await pressShortcut('b')
    await typeCharacters('Updated through Firefox WebDriver BiDi.')
    await waitForPage(
      "document.querySelector('[contenteditable=true][aria-label=\"Rich document content\"]')?.innerText.includes('Updated through Firefox WebDriver BiDi.')",
      'rich document update input',
    )
    await waitForPage(
      "document.querySelector('[contenteditable=true][aria-label=\"Rich document content\"] strong')?.innerText.includes('Updated through Firefox WebDriver BiDi.')",
      'rich document bold formatting',
    )
    await clickText('JSON')
    await waitForPage(
      "document.querySelector('label[for=field-description]').parentElement.querySelector('textarea')?.value.includes('Updated through Firefox WebDriver BiDi.') && document.querySelector('label[for=field-description]').parentElement.querySelector('textarea')?.value.includes('\\\"bold\\\": true')",
      'rich document JSON form state',
    )
    await scroll(600)
    await clickExpression(
      `Array.from(document.querySelector('label[for=field-assignedTo]').parentElement.querySelectorAll('button')).find(node => node.innerText.includes(${JSON.stringify(secondaryAssignee.label)}))`,
    )
    await scroll(-10_000)
    await clickText('Save Changes')
    await waitForPage(
      "document.body.innerText.includes('Changes saved')",
      'saved Todo update',
    )
    const persistedDocumentResponse = JSON.parse(
      await evaluate(`(async () => JSON.stringify(await (await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: 'query BrowserDocument($id: ID!) { todo(where: { id: $id }) { description { document } } }',
          variables: { id: location.pathname.split('/').pop() },
        }),
      })).json()))()`),
    )
    assert.ok(
      JSON.stringify(persistedDocumentResponse).includes(
        'Updated through Firefox WebDriver BiDi.',
      ),
      `rich document update was not persisted: ${JSON.stringify(persistedDocumentResponse)}`,
    )

    await navigate(createdPath)
    await waitForPage(
      "document.body.innerText.includes('Browser-updated Todo') && document.body.innerText.includes('Updated through Firefox WebDriver BiDi.')",
      'persisted Todo text and document update',
    )
    await waitForPage(
      "document.querySelector('[contenteditable=true][aria-label=\"Rich document content\"] h1 strong')?.innerText.includes('Updated through Firefox WebDriver BiDi.')",
      'persisted rich document heading and bold formatting',
    )
    await waitForPage(
      `document.querySelector('label[for=field-assignedTo]').parentElement.innerText.includes(${JSON.stringify(secondaryAssignee.label)})`,
      'persisted relationship label',
    )

    await scroll(1400)
    await clickExpression(
      "Array.from(document.querySelector('label[for=field-todoImages]').parentElement.querySelectorAll('button')).find(node => node.innerText.includes('Create related Todo Image'))",
    )
    await waitForPage(
      "document.body.innerText.includes('Create related Todo Image') && document.body.innerText.includes('Add a new todo image without leaving this form.')",
      'inline relationship create sheet',
    )
    await typeNode(
      await evaluateNode(
        "document.querySelector('label[for=field-altText]').parentElement.querySelector('input')",
      ),
      'Browser inline image',
    )
    await typeNode(
      await evaluateNode(
        "document.querySelector('label[for=field-imagePath]').parentElement.querySelector('input')",
      ),
      '/browser-inline-image.png',
    )
    assert.equal(
      await evaluate(
        "document.querySelector('label[for=field-altText]').parentElement.querySelector('input').value",
      ),
      'Browser inline image',
    )
    assert.equal(
      await evaluate(
        "document.querySelector('label[for=field-imagePath]').parentElement.querySelector('input').value",
      ),
      '/browser-inline-image.png',
    )
    await clickText('Create Todo Image')
    await waitForPage(
      "!document.body.innerText.includes('Add a new todo image without leaving this form.') && document.querySelector('label[for=field-todoImages]').parentElement.innerText.includes('Browser inline image')",
      'inline-created relationship card',
    )
    const inlineImageId = await evaluate(
      "Array.from(document.querySelectorAll('[data-slot=card]')).find(node => node.innerText.includes('Browser inline image')).querySelector('[data-slot=card-description]').innerText.trim()",
    )
    assert.ok(inlineImageId)

    await scroll(-10_000)
    await clickText('Save Changes')
    await waitForPage(
      "document.body.innerText.includes('Changes saved')",
      'saved inline-created relationship',
    )
    await navigate(createdPath)
    await waitForPage(
      "document.querySelector('label[for=field-todoImages]').parentElement.innerText.includes('Browser inline image')",
      'persisted inline-created relationship card',
    )

    await scroll(1400)
    await clickExpression(
      `Array.from(document.querySelectorAll('[data-slot=card]')).find(node => node.innerText.includes('Browser inline image')).querySelector('button')`,
    )
    await waitForPage(
      "document.body.innerText.includes('Edit related Todo Image') && document.body.innerText.includes('Update this related todo image without leaving the current form.') && Boolean(document.querySelector('label[for=field-altText]')?.parentElement.querySelector('input'))",
      'inline relationship edit sheet',
    )
    await replaceNode(
      await evaluateNode(
        "document.querySelector('label[for=field-altText]').parentElement.querySelector('input')",
      ),
      'Browser inline image updated',
    )
    await clickText('Save')
    await waitForPage(
      "!document.body.innerText.includes('Update this related todo image without leaving the current form.') && document.querySelector('label[for=field-todoImages]').parentElement.innerText.includes('Browser inline image updated')",
      'inline-edited relationship card',
    )
    await navigate(createdPath)
    await waitForPage(
      "document.querySelector('label[for=field-todoImages]').parentElement.innerText.includes('Browser inline image updated')",
      'persisted inline-edited relationship card',
    )

    await scroll(1400)
    await clickExpression(
      `Array.from(document.querySelectorAll('[data-slot=card]')).find(node => node.innerText.includes('Browser inline image updated')).querySelectorAll('button')[1]`,
    )
    await waitForPage(
      `!document.querySelector('label[for=field-todoImages]').parentElement.innerText.includes('Browser inline image updated')`,
      'removed relationship card draft',
    )
    await scroll(-10_000)
    await clickText('Save Changes')
    await waitForPage(
      "document.body.innerText.includes('Changes saved')",
      'saved relationship disconnect',
    )
    await navigate(createdPath)
    await waitForPage(
      `!document.querySelector('label[for=field-todoImages]').parentElement.innerText.includes('Browser inline image updated')`,
      'persisted relationship disconnect',
    )

    await scroll(1400)
    const inlineConnectExpression = `Array.from(document.querySelector('label[for=field-todoImages]').parentElement.querySelectorAll('button')).find(node => node.innerText.includes(${JSON.stringify(inlineImageId)}))`
    await waitForPage(
      `Boolean(${inlineConnectExpression})`,
      'existing inline relationship option',
    )
    await clickExpression(inlineConnectExpression)
    await waitForPage(
      `document.querySelector('label[for=field-todoImages]').parentElement.innerText.includes(${JSON.stringify(inlineImageId)})`,
      'inline-connected existing relationship card',
    )
    await scroll(-10_000)
    await clickText('Save Changes')
    await waitForPage(
      "document.body.innerText.includes('Changes saved')",
      'saved inline relationship connect',
    )
    await navigate(createdPath)
    await waitForPage(
      `document.querySelector('label[for=field-todoImages]').parentElement.innerText.includes(${JSON.stringify(inlineImageId)})`,
      'persisted inline relationship connect',
    )

    const responsiveEvidence = []
    async function assertResponsiveState(state) {
      await sleep(300)
      const evidence = JSON.parse(
        await evaluate(`(() => {
          const state = ${JSON.stringify(state)}
          const horizontallyBounded = rect => rect.left >= -1 && rect.right <= window.innerWidth + 1
          const fullyBounded = rect => horizontallyBounded(rect) && rect.top >= -1 && rect.bottom <= window.innerHeight + 1
          const visible = node => {
            const style = getComputedStyle(node)
            const rect = node.getBoundingClientRect()
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight
          }
          const rectangle = (node, selector, requireFullBounds = false) => {
            const rect = node.getBoundingClientRect()
            return {
              selector,
              tag: node.tagName.toLowerCase(),
              text: node.textContent.trim().slice(0, 100),
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height,
              bounded: requireFullBounds ? fullyBounded(rect) : horizontallyBounded(rect),
            }
          }
          const keySelectors = ['header', 'main']
          if (state.includes('mobile-sidebar')) keySelectors.push('[data-mobile=true]')
          if (state.includes('desktop-sidebar')) keySelectors.push('[data-slot=sidebar][data-side=left] [data-slot=sidebar-container]')
          if (state.includes('delete-dialog')) keySelectors.push('[role=alertdialog]')
          const keyElements = keySelectors.flatMap(selector => Array.from(document.querySelectorAll(selector)).filter(visible).map(node => rectangle(node, selector, selector.includes('sidebar') || selector.includes('alertdialog'))))
          const overlaySelector = state.includes('mobile-sidebar')
            ? '[data-mobile=true]'
            : state.includes('delete-dialog')
              ? '[role=alertdialog]'
              : null
          const overlayActions = overlaySelector
            ? Array.from(document.querySelectorAll(overlaySelector + ' button, ' + overlaySelector + ' a, ' + overlaySelector + ' input')).filter(visible).map(node => rectangle(node, overlaySelector + ' actionable', true))
            : []
          const allOffenders = Array.from(document.querySelectorAll('body *')).filter(visible).map(node => {
            const rect = node.getBoundingClientRect()
            if (horizontallyBounded(rect)) return null
            const breadcrumb = node.closest('[data-slot=breadcrumb]')
            const closedOffcanvas = node.closest('[data-slot=sidebar][data-state=collapsed][data-collapsible=offcanvas]')
            let horizontalScroller = node.parentElement
            while (horizontalScroller && !['auto', 'scroll'].includes(getComputedStyle(horizontalScroller).overflowX)) {
              horizontalScroller = horizontalScroller.parentElement
            }
            let allowedReason = null
            if (breadcrumb && node !== breadcrumb && ['hidden', 'clip'].includes(getComputedStyle(breadcrumb).overflowX)) {
              allowedReason = 'clipped-current-breadcrumb-content'
            } else if (closedOffcanvas) {
              allowedReason = 'closed-offcanvas-sidebar'
            } else if (horizontalScroller && horizontallyBounded(horizontalScroller.getBoundingClientRect())) {
              allowedReason = 'contained-horizontal-scroll-region'
            }
            return {
              element: node.outerHTML.slice(0, 240),
              left: rect.left,
              right: rect.right,
              width: rect.width,
              allowedReason,
            }
          }).filter(Boolean).sort((a, b) => b.right - a.right)
          const unexpectedOffenders = allOffenders.filter(entry => !entry.allowedReason)
          const allowedOffenderCounts = Object.fromEntries(
            Array.from(new Set(allOffenders.filter(entry => entry.allowedReason).map(entry => entry.allowedReason))).map(reason => [reason, allOffenders.filter(entry => entry.allowedReason === reason).length])
          )
          return JSON.stringify({
            state,
            route: location.pathname,
            itemId: ${JSON.stringify(createdTodoId)},
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            scrollWidth: document.documentElement.scrollWidth,
            bodyWidth: document.body.scrollWidth,
            keyElements,
            overlayActions,
            offenders: allOffenders.slice(0, 20),
            allowedOffenderCounts,
            unexpectedOffenderCount: unexpectedOffenders.length,
            unexpectedOffenders: unexpectedOffenders.slice(0, 20),
          })
        })()`),
      )
      responsiveEvidence.push(evidence)
      console.log(`[responsive-evidence] ${JSON.stringify(evidence)}`)
      assert.equal(
        evidence.innerWidth,
        Number(state.match(/^(\d+)/)?.[1]),
        `responsive viewport width drifted for ${state}`,
      )
      assert.ok(
        evidence.scrollWidth <= evidence.innerWidth + 1 &&
          evidence.bodyWidth <= evidence.innerWidth + 1,
        `dashboard ${state} should not overflow its viewport: ${JSON.stringify(evidence)}`,
      )
      assert.ok(
        evidence.keyElements.length >= 1 &&
          evidence.keyElements.every((entry) => entry.bounded),
        `dashboard ${state} key containers must stay within the viewport: ${JSON.stringify(evidence)}`,
      )
      assert.ok(
        evidence.overlayActions.every((entry) => entry.bounded),
        `dashboard ${state} overlay actions must stay within the viewport: ${JSON.stringify(evidence)}`,
      )
      assert.equal(
        evidence.unexpectedOffenderCount,
        0,
        `dashboard ${state} has unexpected visible overflow: ${JSON.stringify(evidence)}`,
      )
    }

    if (matrixMode === 'prisma') {
      assert.match(
        createdTodoId,
        /^c[a-z0-9]{24}$/,
        'responsive Prisma item must use an exact generated CUID shape',
      )
      const longResponsiveLabel = responsiveLongLabel
      assert.ok(
        longResponsiveLabel.includes(
          'Responsive coverage label with realistic spaced words',
        ),
      )
      assert.ok(longResponsiveLabel.includes(responsiveNoBreakToken))
      const responsiveUpdate = JSON.parse(
        await evaluate(`(async () => JSON.stringify(await (await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query: 'mutation ResponsiveTodo($where: TodoWhereUniqueInput!, $data: TodoUpdateInput!) { updateTodo(where: $where, data: $data) { id label } }',
            variables: { where: { id: ${JSON.stringify(createdTodoId)} }, data: { label: ${JSON.stringify(longResponsiveLabel)} } },
          }),
        })).json()))()`),
      )
      assert.deepEqual(responsiveUpdate.errors, undefined)
      assert.equal(responsiveUpdate.data.updateTodo.id, createdTodoId)
      assert.equal(responsiveUpdate.data.updateTodo.label, longResponsiveLabel)
      assert.ok(
        responsiveUpdate.data.updateTodo.label.includes(responsiveNoBreakToken),
      )

      const widths = [320, 375, 390, 768, 1440]
      const routes = [
        {
          name: 'home',
          path: '/dashboard',
          ready:
            "document.body.innerText.includes('Dashboard') && document.body.innerText.includes('4 Models')",
        },
        {
          name: 'list',
          path: '/dashboard/todos',
          ready: `document.body.innerText.includes(${JSON.stringify(longResponsiveLabel)})`,
        },
        {
          name: 'create',
          path: '/dashboard/todos/create',
          ready:
            "document.body.innerText.includes('Create Todo') && Boolean(document.querySelector('label[for=field-label]').parentElement.querySelector('input'))",
        },
        {
          name: 'item',
          path: createdPath,
          ready: `document.body.innerText.includes(${JSON.stringify(longResponsiveLabel)})`,
        },
      ]

      for (const width of widths) {
        await bidi.command('browsingContext.setViewport', {
          context,
          viewport: { width, height: width < 768 ? 844 : 1000 },
        })
        for (const route of routes) {
          await navigate(route.path)
          await waitForPage(
            route.ready,
            `${width}px responsive ${route.name} route`,
          )
          await assertResponsiveState(`${width}px ${route.name}`)
        }

        const isMobile = width < 768
        if (isMobile) {
          await clickExpression(
            "document.querySelector('[data-sidebar=trigger][data-side=left]')",
          )
          await waitForPage(
            "Boolean(document.querySelector('[data-mobile=true]'))",
            `${width}px mobile sidebar open`,
          )
          await assertResponsiveState(`${width}px mobile-sidebar`)
          const mobileSidebarSemantics = JSON.parse(
            await evaluate(`(() => {
              const sidebar = document.querySelector('[data-mobile=true]')
              const trigger = document.querySelector('[data-sidebar=trigger][data-side=left]')
              return JSON.stringify({
                role: sidebar?.getAttribute('role'),
                ariaModal: sidebar?.getAttribute('aria-modal'),
                labelled: Boolean(sidebar?.getAttribute('aria-labelledby') && document.getElementById(sidebar.getAttribute('aria-labelledby'))),
                focusContained: Boolean(sidebar?.contains(document.activeElement)),
                triggerExpanded: trigger?.getAttribute('aria-expanded'),
              })
            })()`),
          )
          assert.deepEqual(mobileSidebarSemantics, {
            role: 'dialog',
            ariaModal: 'true',
            labelled: true,
            focusContained: true,
            triggerExpanded: 'true',
          })
          await bidi.command('input.performActions', {
            context,
            actions: [
              {
                type: 'key',
                id: 'keyboard',
                actions: [
                  { type: 'keyDown', value: '\uE00C' },
                  { type: 'keyUp', value: '\uE00C' },
                ],
              },
            ],
          })
          await bidi.command('input.releaseActions', { context })
          await waitForPage(
            "!document.querySelector('[data-mobile=true]') && document.querySelector('[data-sidebar=trigger][data-side=left]')?.getAttribute('aria-expanded') === 'false'",
            `${width}px mobile sidebar closed`,
          )
          assert.equal(
            await evaluate(
              "document.activeElement === document.querySelector('[data-sidebar=trigger][data-side=left]')",
            ),
            true,
            `${width}px mobile sidebar should return focus to its trigger`,
          )
        } else {
          const initialSidebarState = await evaluate(
            "document.querySelector('[data-slot=sidebar][data-side=left]')?.dataset.state",
          )
          await clickExpression(
            "document.querySelector('[data-sidebar=trigger][data-side=left]')",
          )
          await waitForPage(
            `document.querySelector('[data-slot=sidebar][data-side=left]')?.dataset.state !== ${JSON.stringify(initialSidebarState)}`,
            `${width}px desktop sidebar toggle`,
          )
          await assertResponsiveState(`${width}px desktop-sidebar`)
          assert.equal(
            await evaluate(
              "document.querySelector('[data-sidebar=trigger][data-side=left]')?.getAttribute('aria-expanded')",
            ),
            initialSidebarState === 'expanded' ? 'false' : 'true',
          )
          await clickExpression(
            "document.querySelector('[data-sidebar=trigger][data-side=left]')",
          )
          await waitForPage(
            `document.querySelector('[data-slot=sidebar][data-side=left]')?.dataset.state === ${JSON.stringify(initialSidebarState)} && document.querySelector('[data-sidebar=trigger][data-side=left]')?.getAttribute('aria-expanded') === ${JSON.stringify(initialSidebarState === 'expanded' ? 'true' : 'false')}`,
            `${width}px desktop sidebar restored`,
          )
        }

        await navigate(createdPath)
        await waitForPage(
          `document.body.innerText.includes(${JSON.stringify(longResponsiveLabel)})`,
          `${width}px responsive item dialog route`,
        )
        await clickText('Delete')
        await waitForPage(
          "Boolean(document.querySelector('[role=alertdialog]')) && document.body.innerText.includes('Delete Todo')",
          `${width}px delete dialog`,
        )
        await assertResponsiveState(`${width}px delete-dialog`)
        const deleteDialogSemantics = JSON.parse(
          await evaluate(`(() => {
            const dialog = document.querySelector('[role=alertdialog]')
            const labelledBy = dialog?.getAttribute('aria-labelledby')
            const describedBy = dialog?.getAttribute('aria-describedby')
            return JSON.stringify({
              ariaModal: dialog?.getAttribute('aria-modal'),
              labelled: Boolean(labelledBy && document.getElementById(labelledBy)?.textContent.includes('Delete Todo')),
              described: Boolean(describedBy && document.getElementById(describedBy)?.textContent.includes('cannot be undone')),
              focusContained: Boolean(dialog?.contains(document.activeElement)),
              cancelVisible: Array.from(dialog?.querySelectorAll('button') ?? []).some(node => node.textContent.trim() === 'Cancel'),
              deleteVisible: Array.from(dialog?.querySelectorAll('button') ?? []).some(node => node.textContent.trim() === 'Delete'),
            })
          })()`),
        )
        assert.deepEqual(deleteDialogSemantics, {
          ariaModal: 'true',
          labelled: true,
          described: true,
          focusContained: true,
          cancelVisible: true,
          deleteVisible: true,
        })
        await clickText('Cancel')
        await waitForPage(
          "!document.querySelector('[role=alertdialog]')",
          `${width}px delete dialog closed`,
        )
        assert.equal(
          await evaluate(
            "document.activeElement?.textContent.trim() === 'Delete'",
          ),
          true,
          `${width}px delete dialog should return focus to its trigger`,
        )
      }
      assert.equal(responsiveEvidence.length, widths.length * 6)
      await bidi.command('browsingContext.setViewport', {
        context,
        viewport: { width: 390, height: 844 },
      })
      await navigate(createdPath)
      await waitForPage(
        `document.querySelector('label[for=field-label]').parentElement.querySelector('input')?.value === ${JSON.stringify(longResponsiveLabel)}`,
        'post-matrix hydrated responsive item',
      )
    } else {
      await bidi.command('browsingContext.setViewport', {
        context,
        viewport: { width: 390, height: 844 },
      })
      await navigate(createdPath)
      await waitForPage(
        "document.body.innerText.includes('Browser-updated Todo')",
        'responsive Todo item view',
      )
      await assertResponsiveState('390px item')
    }
    const unnamedControls = JSON.parse(
      await evaluate(`JSON.stringify(Array.from(document.querySelectorAll('button, a')).filter(node => {
        const style = getComputedStyle(node)
        if (style.display === 'none' || style.visibility === 'hidden') return false
        return !(node.textContent.trim() || node.getAttribute('aria-label') || node.getAttribute('title'))
      }).map(node => node.outerHTML.slice(0, 180)))`),
    )
    assert.deepEqual(
      unnamedControls,
      [],
      `visible dashboard buttons and links need accessible names: ${unnamedControls.join(', ')}`,
    )
    await bidi.command('input.performActions', {
      context,
      actions: [
        {
          type: 'key',
          id: 'keyboard',
          actions: [
            { type: 'keyDown', value: '\uE004' },
            { type: 'keyUp', value: '\uE004' },
          ],
        },
      ],
    })
    await bidi.command('input.releaseActions', { context })
    assert.equal(
      await evaluate(
        "document.activeElement !== document.body && Boolean(document.activeElement?.matches('button, a, input, textarea, select, [tabindex]'))",
      ),
      true,
      'keyboard Tab should move focus to an interactive dashboard control',
    )

    const failures = bidi.events.filter(
      (event) => event.method === 'network.fetchError',
    )
    // Firefox reports requests superseded by an immediate client-side route
    // navigation as NS_BINDING_ABORTED. They have no HTTP error response and
    // are expected during this sequence of explicit route transitions.
    const unexpectedFailures = failures.filter(
      (event) => event.params.errorText !== 'NS_BINDING_ABORTED',
    )
    const badResponses = bidi.events.filter(
      (event) =>
        event.method === 'network.responseCompleted' &&
        event.params.response.status >= 400,
    )
    const consoleErrors = bidi.events.filter(
      (event) =>
        event.method === 'log.entryAdded' &&
        ['error', 'assert'].includes(event.params.level),
    )
    assert.deepEqual(unexpectedFailures, [])
    assert.deepEqual(badResponses, [])
    assert.deepEqual(consoleErrors, [])

    await waitForNetworkIdle()
    console.log(
      `Firefox dashboard ${matrixMode} acceptance passed: auth/init, network-observed persisted create for Role/User/Todo Image/Todo, Todo update, rich heading/mark persistence, relationship cards create/edit/disconnect/reconnect, ${responsiveEvidence.length} responsive route/sidebar/dialog states, accessible names, keyboard focus; ${bidi.events.length} observed events, ${failures.length} expected navigation abort(s), 0 unexpected request/response/console errors.`,
    )
    await bidi.command('session.end')
  } finally {
    bidi.close()
  }
}

await access(serverEntry)
await access(firefoxLauncherProbe ? firefoxProbeScript : firefoxBinary)
const serverOutputFiles = await readdir(path.resolve('.output/server'), {
  recursive: true,
})
for (const relativePath of serverOutputFiles.filter((entry) =>
  entry.endsWith('.mjs'),
)) {
  const output = await readFile(
    path.resolve('.output/server', relativePath),
    'utf8',
  )
  assert.doesNotMatch(
    output,
    /PARITY_TEST_GENUINE_SERVER_ERROR|disconnectRequestsStarted|lastHookObservation|CMS_PARITY_FAULT_INJECTION/,
    'ordinary production output must not bundle parity fault injection or observation state',
  )
}
const profileDirectory = await mkdtemp(path.join(os.tmpdir(), 'tks-firefox-'))

try {
  const appPort = await availablePort()
  const bidiPort = await availablePort()
  const app = start(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      CMS_ADAPTER:
        process.env.CMS_ADAPTER ??
        (matrixMode === 'prisma' ? 'prisma' : 'memory'),
      CMS_BOOTSTRAP_MODE:
        matrixMode === 'fresh' || matrixMode === 'arbitrary'
          ? 'fresh'
          : 'seeded',
      SESSION_SECRET: randomBytes(32).toString('hex'),
      HOST: '127.0.0.1',
      PORT: String(appPort),
    },
  })
  app.stdout.on('data', (chunk) => {
    appLog += chunk
  })
  app.stderr.on('data', (chunk) => {
    appLog += chunk
  })
  let readinessObservation = 'no response received'
  try {
    await waitFor(async () => {
      if (app.exitCode !== null) throw new Error(`App exited early: ${appLog}`)
      try {
        const readinessPath =
          matrixMode === 'arbitrary' ? '/dashboard/init' : '/dashboard/signin'
        const response = await fetch(
          `http://127.0.0.1:${appPort}${readinessPath}`,
        )
        const body = await response.text()
        readinessObservation = `HTTP ${response.status}: ${body.slice(-2_000)}`
        return response.ok
      } catch (error) {
        readinessObservation = String(error)
        return false
      }
    }, 'bounded production app')
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}; last readiness result: ${readinessObservation}`,
    )
  }
  const disabledFaultRoute = await fetch(
    `http://127.0.0.1:${appPort}/__parity/fault?kind=health`,
  )
  assert.equal(
    disabledFaultRoute.status,
    404,
    'ordinary production builds must omit the parity fault-injection route',
  )

  const firefox = start(firefoxCommand, [
    ...(firefoxLauncherProbe ? [firefoxProbeScript] : []),
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
    if (firefox.exitCode !== null)
      throw new Error(`Firefox exited early: ${firefoxLog}`)
    return firefoxLog.includes('WebDriver BiDi listening')
  }, 'Firefox WebDriver BiDi endpoint')

  await runBrowserFlow(
    `ws://127.0.0.1:${bidiPort}`,
    `http://127.0.0.1:${appPort}`,
  )

  assert.doesNotMatch(appLog, /(?:error|exception|unhandled)/i)
} catch (error) {
  console.error('\n--- app log ---\n', appLog)
  console.error('\n--- Firefox log ---\n', firefoxLog)
  throw error
} finally {
  const processCleanupResults = await Promise.allSettled([
    stopProcesses(),
    terminateProfileBoundProcesses(profileDirectory),
  ])
  const profileRemovalResults = await Promise.allSettled([
    rm(profileDirectory, { recursive: true, force: true }),
  ])
  await sleep(150)
  const cleanupVerificationResults = await Promise.allSettled([
    (async () => {
      assert.deepEqual(await profileBoundProcesses(profileDirectory), [])
    })(),
    access(profileDirectory).then(
      () => {
        throw new Error('Firefox test profile was recreated after cleanup')
      },
      (error) => {
        if (error?.code !== 'ENOENT') throw error
      },
    ),
  ])
  const cleanupErrors = [
    ...processCleanupResults,
    ...profileRemovalResults,
    ...cleanupVerificationResults,
  ]
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason)
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, 'Dashboard browser cleanup failed')
  }
}
