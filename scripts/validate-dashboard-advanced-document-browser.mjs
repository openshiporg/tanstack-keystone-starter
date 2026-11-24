import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
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

const sourceRoot = path.resolve('.')
const container =
  process.env.PARITY_POSTGRES_CONTAINER ?? 'vibe-runtime-postgres'
const postgresPort = process.env.PARITY_POSTGRES_PORT ?? '5432'
const databaseName = `tks_gap0508_${process.pid}_${Date.now()}`
const firefoxBinary =
  process.env.FIREFOX_BIN ?? '/Applications/Firefox.app/Contents/MacOS/firefox'
const ownedFiles = [
  'package.json',
  'scripts/validate-dashboard-advanced-document-browser.mjs',
]
const protectedProductFiles = [
  'src/components/dashboard/rich-document-editor.tsx',
  'src/components/dashboard/views/document.tsx',
  'tests/dashboard-document-view.test.ts',
]
assert.match(postgresPort, /^\d+$/, 'PostgreSQL port must be numeric')

const fixtureConfig = `
import { mergeSchemas } from '@graphql-tools/schema'
import type { GraphQLSchema } from 'graphql'
import type { CmsContext } from './src/features/cms/adapters'
import { createAuth, statelessSessions } from './src/features/cms/keystone/auth'
import { config, list } from './src/features/cms/keystone/core'
import { password, relationship, text } from './src/features/cms/keystone/fields'
import { document } from './src/features/cms/keystone/fields-document'

function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: 'type Query { redirectToInit: Boolean }',
    resolvers: {
      Query: {
        redirectToInit: async (
          _root: unknown,
          _args: unknown,
          context: CmsContext,
        ) => (await context.sudo().query.Account.count({})) === 0,
      },
    },
  })
}

const author = list({
  fields: {
    name: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    leadArticles: relationship({ ref: 'Article.leadAuthor', many: true }),
    contributedArticles: relationship({ ref: 'Article.contributors', many: true }),
  },
})

const body = document({
  formatting: true,
  links: true,
  dividers: true,
  layouts: [[2, 1], [1, 1, 1]],
  relationships: {
    author: {
      listKey: 'Author',
      label: 'Inline author',
      labelField: 'name',
      selection: 'name',
    },
  },
  componentBlocks: {
    callout: {
      label: 'Callout block',
      schema: {
        message: { kind: 'form', defaultValue: 'Initial callout' },
        author: {
          kind: 'relationship',
          listKey: 'Author',
          label: 'Block author',
          many: false,
        },
        body: {
          kind: 'child',
          options: { kind: 'block', placeholder: 'Callout body' },
        },
        nested: {
          kind: 'object',
          fields: {
            tone: { kind: 'form', defaultValue: 'info' },
            count: { kind: 'form', defaultValue: 2 },
          },
        },
      },
    },
  },
})

const article = list({
  fields: {
    title: text({ validation: { isRequired: true } }),
    body,
    leadAuthor: relationship({ ref: 'Author.leadArticles' }),
    contributors: relationship({ ref: 'Author.contributedArticles', many: true }),
  },
})

const session = statelessSessions({ maxAge: 60 * 60 * 24 })
const { withAuth } = createAuth({
  listKey: 'Account',
  identityField: 'handle',
  secretField: 'secret',
  initFirstItem: { fields: ['displayName', 'handle', 'secret'] },
  sessionData: 'displayName handle',
})

export default withAuth(config({
  db: { provider: 'postgresql', url: 'env("DATABASE_URL")' },
  session,
  graphql: { extendGraphqlSchema },
  ui: { isAccessAllowed: ({ session: currentSession }) => Boolean(currentSession) },
  lists: {
    Account: list({
      ui: { hideCreate: true, hideNavigation: true, labelField: 'displayName' },
      fields: {
        displayName: text({ validation: { isRequired: true } }),
        handle: text({ isIndexed: 'unique', validation: { isRequired: true } }),
        secret: password({ validation: { isRequired: true } }),
      },
    }),
    Author: author,
    Article: article,
  },
}))
`

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

function findDocumentNode(nodes, type) {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (node?.type === type) return node
    const nested = findDocumentNode(node?.children, type)
    if (nested) return nested
  }
  return undefined
}

async function run(label, command, args, options = {}) {
  return runBoundedChild(command, args, {
    label,
    timeout: options.timeout ?? 180_000,
    termGrace: 1_000,
    env: options.env ?? process.env,
    ...(options.cwd ? { cwd: options.cwd } : {}),
    captureOutput: options.captureOutput ?? false,
    ...(options.captureOutput ? {} : { stdio: 'inherit' }),
  })
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

async function waitFor(check, description, timeout = 30_000) {
  const deadline = Date.now() + timeout
  let lastError
  while (Date.now() < deadline) {
    try {
      if (await check()) return
    } catch (error) {
      lastError = error
    }
    await sleep(100)
  }
  throw new Error(`Timed out waiting for ${description}`, { cause: lastError })
}

async function containerIsRunning() {
  const result = await run(
    'PostgreSQL container state',
    'docker',
    ['inspect', '--format', '{{.State.Running}}', container],
    { captureOutput: true, timeout: 30_000 },
  )
  return result.stdout.trim() === 'true'
}

async function waitForPostgres() {
  let lastError
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try {
      await run(
        'PostgreSQL readiness',
        'docker',
        ['exec', container, 'pg_isready', '-q'],
        {
          captureOutput: true,
          timeout: 5_000,
        },
      )
      return
    } catch (error) {
      lastError = error
      await sleep(100)
    }
  }
  throw new Error('PostgreSQL did not become ready', { cause: lastError })
}

async function dropDatabase(postgresUser) {
  await run(
    'drop disposable GAP-05/08 database',
    'docker',
    [
      'exec',
      container,
      'sh',
      '-c',
      'dropdb --if-exists --force -U "$1" "$2"',
      'sh',
      postgresUser,
      databaseName,
    ],
    { timeout: 30_000 },
  )
}

async function verifyDatabaseAbsent(postgresUser) {
  await run(
    'verify disposable GAP-05/08 database removal',
    'docker',
    [
      'exec',
      container,
      'sh',
      '-c',
      `test "$(psql -U "$1" -d postgres -Atqc "SELECT count(*) FROM pg_database WHERE datname = '$2'")" = 0`,
      'sh',
      postgresUser,
      databaseName,
    ],
    { timeout: 30_000 },
  )
}

async function postgresQuery(postgresUser, sql) {
  const result = await run(
    'GAP-05/08 PostgreSQL assertion',
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
      '-Atqc',
      sql,
    ],
    { captureOutput: true, timeout: 30_000 },
  )
  return result.stdout.trim()
}

async function linkDependencies(fixtureRoot) {
  const sourceModules = path.join(sourceRoot, 'node_modules')
  const fixtureModules = path.join(fixtureRoot, 'node_modules')
  await mkdir(fixtureModules)
  for (const entry of await readdir(sourceModules, { withFileTypes: true })) {
    if (['.cache', '.nitro', '.vite', '.vite-temp'].includes(entry.name))
      continue
    const sourceEntry = path.join(sourceModules, entry.name)
    const fixtureEntry = path.join(fixtureModules, entry.name)
    if (entry.name.startsWith('@') && entry.isDirectory()) {
      await mkdir(fixtureEntry)
      for (const scoped of await readdir(sourceEntry))
        await symlink(
          path.join(sourceEntry, scoped),
          path.join(fixtureEntry, scoped),
        )
    } else {
      await symlink(sourceEntry, fixtureEntry)
    }
  }
}

async function fileHash(root, files) {
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(file)
    hash.update(await readFile(path.join(root, file)))
  }
  return hash.digest('hex')
}

async function assertAbsent(target, description) {
  try {
    await readFile(target)
  } catch (error) {
    if (error?.code === 'ENOENT') return
    throw error
  }
  throw new Error(`${description} still exists: ${target}`)
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
      } else if (message.type === 'event') {
        this.events.push(message)
      }
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

async function browserFlow(appPort, bidiPort) {
  const bidi = new BidiClient(`ws://127.0.0.1:${bidiPort}/session`)
  await bidi.connect()
  let context
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
  const waitPage = (expression, description) =>
    waitFor(() => evaluate(expression), description)
  const locateAll = async (selector) => {
    const result = await bidi.command('browsingContext.locateNodes', {
      context,
      locator: { type: 'css', value: selector },
      maxNodeCount: 50,
    })
    assert.ok(result.nodes.length > 0, `Expected ${selector}`)
    return result.nodes
  }
  const locate = async (selector) => (await locateAll(selector))[0]
  const clickNode = async (node) => {
    await bidi.command('script.callFunction', {
      functionDeclaration:
        '(element) => element.scrollIntoView({block:"center",inline:"center"})',
      target: { context },
      awaitPromise: false,
      arguments: [{ sharedId: node.sharedId }],
      resultOwnership: 'none',
    })
    await sleep(40)
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
  const clickButtonText = async (text) => {
    const index = await evaluate(
      `Array.from(document.querySelectorAll('button:not([disabled])')).findIndex(button => button.innerText.includes(${JSON.stringify(text)}))`,
    )
    assert.ok(index >= 0, `Missing enabled button containing ${text}`)
    await clickNode((await locateAll('button:not([disabled])'))[index])
  }
  const key = async (value) => {
    await bidi.command('input.performActions', {
      context,
      actions: [
        {
          type: 'key',
          id: 'keyboard',
          actions: [
            { type: 'keyDown', value },
            { type: 'keyUp', value },
          ],
        },
      ],
    })
    await bidi.command('input.releaseActions', { context })
  }
  const keyChord = async (modifier, value) => {
    await bidi.command('input.performActions', {
      context,
      actions: [
        {
          type: 'key',
          id: 'keyboard',
          actions: [
            { type: 'keyDown', value: modifier },
            { type: 'keyDown', value },
            { type: 'keyUp', value },
            { type: 'keyUp', value: modifier },
          ],
        },
      ],
    })
    await bidi.command('input.releaseActions', { context })
  }
  const type = async (value) => {
    await bidi.command('input.performActions', {
      context,
      actions: [
        {
          type: 'key',
          id: 'keyboard',
          actions: [...value].flatMap((character) => [
            { type: 'keyDown', value: character },
            { type: 'keyUp', value: character },
          ]),
        },
      ],
    })
    await bidi.command('input.releaseActions', { context })
  }
  const replaceNode = async (node, value) => {
    await clickNode(node)
    await keyChord('\uE03D', 'a')
    await key('\uE003')
    await type(value)
  }
  const replace = async (selector, value) =>
    replaceNode(await locate(selector), value)
  const locateFieldInput = async (fieldPath) => {
    const inputIndex = await evaluate(
      `(() => { const label = document.querySelector('label[for=${JSON.stringify(`field-${fieldPath}`)}]'); const input = label?.parentElement?.querySelector('input'); return input ? Array.from(document.querySelectorAll('input')).indexOf(input) : -1 })()`,
    )
    assert.ok(inputIndex >= 0, `Missing input for field ${fieldPath}`)
    return (await locateAll('input'))[inputIndex]
  }
  const replaceField = async (fieldPath, value) =>
    replaceNode(await locateFieldInput(fieldPath), value)
  const navigate = async (route) => {
    await bidi.command('browsingContext.navigate', {
      context,
      url: `http://127.0.0.1:${appPort}${route}`,
      wait: 'complete',
    })
    await sleep(200)
  }
  const selectValue = async (selector, value) => {
    const index = await evaluate(
      `(() => { const node = document.querySelector(${JSON.stringify(selector)}); return node ? Array.from(node.options).findIndex(option => option.value === ${JSON.stringify(value)}) : -1 })()`,
    )
    assert.ok(index >= 0, `Missing select option ${value}`)
    const node = await locate(selector)
    await clickNode(node)
    for (let indexAttempt = 0; indexAttempt < index; indexAttempt += 1)
      await key('\uE015')
    await key('\uE007')
    await bidi.command('script.callFunction', {
      functionDeclaration: `(element, nextValue) => { const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; setter.call(element, nextValue); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); }`,
      target: { context },
      awaitPromise: false,
      arguments: [{ sharedId: node.sharedId }, { type: 'string', value }],
      resultOwnership: 'none',
    })
    await sleep(100)
  }
  const capture = async (queryIncludes, action) => {
    await evaluate(
      `(() => { globalThis.__gapCapture = []; const original = fetch; globalThis.__gapOriginalFetch = original; globalThis.fetch = async (...args) => { const response = await original(...args); try { const input = args[0]; const init = args[1]; const request = typeof init?.body === 'string' ? JSON.parse(init.body) : null; if (new URL(typeof input === 'string' ? input : input.url, location.href).pathname === '/api/graphql' && request?.query?.includes(${JSON.stringify(queryIncludes)})) { const entry = { request, response: null, status: response.status }; globalThis.__gapCapture.push(entry); response.clone().json().then(body => entry.response = body) } } catch {} return response } })()`,
    )
    try {
      await action()
      await waitPage(
        `Boolean(globalThis.__gapCapture?.some(entry => entry.response))`,
        `${queryIncludes} response`,
      )
      const result = JSON.parse(
        await evaluate('JSON.stringify(globalThis.__gapCapture)'),
      )
      const entry = result.find((candidate) =>
        candidate.request?.query?.includes(queryIncludes),
      )
      assert.ok(entry, `Missing ${queryIncludes} capture`)
      assert.equal(entry.status, 200)
      assert.deepEqual(entry.response?.errors, undefined)
      return entry
    } finally {
      await evaluate(
        'globalThis.fetch = globalThis.__gapOriginalFetch; delete globalThis.__gapOriginalFetch; delete globalThis.__gapCapture',
      ).catch(() => {})
    }
  }

  try {
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
    context = tree.contexts[0].context
    await bidi.command('browsingContext.setViewport', {
      context,
      viewport: { width: 1440, height: 1600 },
    })

    await navigate('/dashboard')
    await waitPage(
      "document.body.innerText.includes('Create admin account')",
      'init form',
    )
    await replace('#displayName', 'GAP Fixture Admin')
    await replace('#handle', 'gap-fixture-admin')
    await replace('#secret', 'Gap-fixture-password-123!')
    await capture('createInitialAccount', () => click('button[type="submit"]'))
    await waitPage(
      "location.pathname === '/dashboard'",
      'authenticated dashboard',
    )

    await navigate('/dashboard/articles/create')
    await waitPage(
      `document.body.innerText.includes('Create Article') && document.querySelector('[contenteditable=true][aria-label="Rich document content"]')`,
      'advanced article form',
    )
    await replaceField('title', 'Advanced browser article')
    await click('[contenteditable=true][aria-label="Rich document content"]')
    await type('Advanced document surface')

    const inlineRelationship = await capture(
      'RelationshipOptions',
      async () => {
        await selectValue(
          'select[aria-label="Insert document block"]',
          'relationship:author',
        )
        try {
          await waitPage(
            `Boolean(document.querySelector('[aria-label="Inline author selector"]'))`,
            'inline relationship insertion',
          )
        } catch (error) {
          const state = await evaluate(
            `JSON.stringify((() => { const menu = document.querySelector('select[aria-label="Insert document block"]'); const editable = document.querySelector('[contenteditable=true][aria-label="Rich document content"]'); return { menuValue: menu?.value ?? null, optionValues: menu ? Array.from(menu.options).map(option => option.value) : [], editableText: editable?.innerText ?? null, editableHtml: editable?.innerHTML ?? null }; })())`,
          ).catch(() => 'unavailable')
          throw new Error(`${error.message}; insert menu DOM state: ${state}`, {
            cause: error,
          })
        }
        await click('[aria-label="Inline author selector"]')
      },
    )
    const inlineOption = inlineRelationship.response?.data?.items?.[0]
    assert.equal(inlineOption?.label, 'Fixture Author')
    assert.ok(
      inlineOption?.id,
      'inline relationship option did not return an id',
    )
    await waitPage(
      "Array.from(document.querySelectorAll('[role=dialog] button')).some(button => button.innerText.includes('Fixture Author'))",
      'inline relationship option',
    )
    await click('[role=dialog] button')
    await waitPage(
      "document.body.innerText.includes('Fixture Author')",
      'inline relationship selected',
    )

    const componentRelationship = await capture(
      'RelationshipOptions',
      async () => {
        await selectValue(
          'select[aria-label="Insert document block"]',
          'component:callout',
        )
        await waitPage(
          "Boolean(document.querySelector('[data-document-node=component-block]'))",
          'component block insertion',
        )
      },
    )
    const componentOption = componentRelationship.response?.data?.items?.[0]
    assert.equal(componentOption?.label, 'Fixture Author')
    assert.ok(
      componentOption?.id,
      'block relationship option did not return an id',
    )
    const componentInputs = await locateAll(
      '[data-document-node="component-block"] input',
    )
    assert.equal(
      await evaluate(
        `document.querySelector('[data-document-node="component-block"] input')?.value`,
      ),
      'Initial callout',
    )
    assert.equal(
      await evaluate(
        `document.querySelectorAll('[data-document-node="component-block"] input')[2]?.value`,
      ),
      'info',
    )
    assert.equal(
      await evaluate(
        `document.querySelectorAll('[data-document-node="component-block"] input')[3]?.value`,
      ),
      '2',
    )
    await replaceNode(componentInputs[0], 'Browser-edited callout')
    await replaceNode(componentInputs[2], 'warning')
    await replaceNode(componentInputs[3], '7')
    await waitPage(
      "document.querySelector('[data-document-node=component-block] input')?.value === 'Browser-edited callout'",
      'component schema edit',
    )
    await waitPage(
      "Array.from(document.querySelectorAll('[data-document-node=component-block] button')).some(button => button.innerText.includes('Fixture Author'))",
      'component relationship option',
    )
    await click('[data-document-node="component-block"] button')
    await waitPage(
      "document.querySelector('[data-document-node=component-block] input')?.value === 'Browser-edited callout'",
      'component relationship selected',
    )

    await click('[contenteditable=true][aria-label="Rich document content"]')
    await key('\uE010')
    await selectValue('select[aria-label="Insert document block"]', 'layout:0')
    await waitPage(
      "Boolean(document.querySelector('[data-document-node=layout]'))",
      'configured layout insertion',
    )
    const layout = JSON.parse(
      await evaluate(
        `JSON.stringify((() => { const node = document.querySelector('[data-document-node=layout]'); return { columns: getComputedStyle(node).gridTemplateColumns, text: node.innerText } })())`,
      ),
    )
    assert.equal(layout.text.replace(/[\uFEFF\s]/g, ''), '')
    assert.ok(
      layout.columns.split(' ').length >= 2,
      `layout ratios were not rendered: ${layout.columns}`,
    )

    const mutation = await capture('createArticle', () =>
      clickButtonText('Create Article'),
    )
    const createdId = mutation.response?.data?.createArticle?.id
    assert.ok(createdId, 'createArticle did not return an id')
    const createdBody = mutation.request?.variables?.data?.body?.document
    assert.ok(
      createdBody?.some(
        (node) => node.type === 'layout' && node.layout.join(',') === '2,1',
      ),
    )
    const createdInline = findDocumentNode(createdBody, 'relationship')
    assert.equal(
      createdInline?.data?.label,
      'Fixture Author',
      `created inline relationship payload: ${JSON.stringify(createdInline)}`,
    )
    assert.ok(
      createdInline?.data?.id,
      'created inline relationship did not include an id',
    )
    const createdComponent = createdBody?.find(
      (node) => node.type === 'component-block',
    )
    assert.equal(createdComponent?.props?.message, 'Browser-edited callout')
    assert.equal(createdComponent?.props?.nested?.tone, 'warning')
    assert.equal(createdComponent?.props?.nested?.count, 7)
    assert.equal(createdComponent?.props?.author?.label, 'Fixture Author')
    assert.ok(
      createdComponent?.props?.author?.id,
      'created block relationship did not include an id',
    )
    await waitPage(
      `location.pathname === '/dashboard/articles/${createdId}'`,
      'article returned-id route',
    )
    await waitPage(
      "document.body.innerText.includes('Advanced browser article') && document.body.innerText.includes('Fixture Author')",
      'article persisted UI',
    )

    await navigate(`/dashboard/articles/${createdId}`)
    await waitPage(
      "document.querySelector('[data-document-node=component-block] input')?.value === 'Browser-edited callout'",
      'component block reload',
    )
    await waitPage(
      "document.querySelectorAll('[data-document-node=component-block] input')[2]?.value === 'warning'",
      'nested component props reload',
    )
    await waitPage(
      "Boolean(document.querySelector('[data-document-node=layout]'))",
      'layout reload',
    )

    const editedInputs = await locateAll(
      '[data-document-node="component-block"] input',
    )
    await replaceNode(editedInputs[0], 'Reload-edited callout')
    const update = await capture('updateArticle', () =>
      clickButtonText('Save Changes'),
    )
    assert.ok(
      update.response?.data?.updateArticle?.id === createdId,
      'updateArticle did not return the article id',
    )
    await waitPage(
      "document.querySelector('[data-document-node=component-block] input')?.value === 'Reload-edited callout'",
      'component block saved edit',
    )
    await navigate(`/dashboard/articles/${createdId}`)
    await waitPage(
      "document.querySelector('[data-document-node=component-block] input')?.value === 'Reload-edited callout'",
      'saved component edit reload',
    )

    const rollback = JSON.parse(
      await evaluate(
        `(async () => JSON.stringify(await (await fetch('/api/graphql', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ query: 'mutation InvalidDocument($id: ID!, $data: ArticleUpdateInput!) { updateArticle(where: { id: $id }, data: $data) { id } }', variables: { id: ${JSON.stringify(createdId)}, data: { body: { document: [{ type: 'unknown-node', children: [{ text: 'should rollback' }] }] } } } }) })).json()))()`,
      ),
    )
    assert.ok(rollback.errors?.length, 'invalid document update should fail')

    const persisted = JSON.parse(
      await evaluate(
        `(async () => JSON.stringify(await (await fetch('/api/graphql', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ query: 'query PersistedAdvanced($id: ID!) { article(where: { id: $id }) { id title body { document(hydrateRelationships: true) } } }', variables: { id: ${JSON.stringify(createdId)} } }) })).json()))()`,
      ),
    )
    assert.deepEqual(persisted.errors, undefined)
    assert.equal(persisted.data.article.id, createdId)
    assert.equal(persisted.data.article.title, 'Advanced browser article')
    const persistedBody = persisted.data.article.body.document
    const persistedComponent = persistedBody.find(
      (node) => node.type === 'component-block',
    )
    assert.equal(persistedComponent.props.message, 'Reload-edited callout')
    assert.equal(persistedComponent.props.nested.tone, 'warning')
    assert.equal(persistedComponent.props.nested.count, 7)
    assert.equal(persistedComponent.props.author.label, 'Fixture Author')
    assert.ok(persistedComponent.props.author.id)
    assert.equal(
      findDocumentNode(persistedBody, 'relationship')?.data.label,
      'Fixture Author',
    )
    assert.deepEqual(findDocumentNode(persistedBody, 'layout')?.layout, [2, 1])

    const nestedRollback = JSON.parse(
      await evaluate(
        `(async () => JSON.stringify(await (await fetch('/api/graphql', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ query: 'mutation NestedRollback($data: ArticleCreateInput!) { createArticle(data: $data) { id } }', variables: { data: { title: 'Nested rollback article', leadAuthor: { create: { name: 'Rollback nested author' } }, contributors: { connect: [{ id: 'missing-contributor' }] } } } }) })).json()))()`,
      ),
    )
    assert.ok(
      nestedRollback.errors?.length,
      'nested relationship rollback should fail',
    )

    const networkFailures = bidi.events.filter(
      (event) =>
        (event.method === 'network.fetchError' &&
          event.params.errorText !== 'NS_BINDING_ABORTED') ||
        (event.method === 'network.responseCompleted' &&
          event.params.response.status >= 400),
    )
    const consoleErrors = bidi.events.filter(
      (event) =>
        event.method === 'log.entryAdded' &&
        ['error', 'assert'].includes(event.params.level),
    )
    assert.deepEqual(networkFailures, [])
    assert.deepEqual(consoleErrors, [])
    return {
      createdId,
      events: bidi.events.length,
      networkFailures: networkFailures.length,
      consoleErrors: consoleErrors.length,
    }
  } finally {
    await bidi.command('session.end').catch(() => {})
    bidi.close()
  }
}

async function restoreDatabase(
  initiallyRunning,
  postgresUser,
  databaseCreated,
) {
  const errors = []
  let running = false
  try {
    running = await containerIsRunning()
  } catch (error) {
    errors.push(error)
  }
  if (!running && databaseCreated) {
    try {
      await run('start PostgreSQL for cleanup', 'docker', ['start', container])
      running = true
      await waitForPostgres()
    } catch (error) {
      errors.push(error)
    }
  }
  if (running && databaseCreated) {
    try {
      await dropDatabase(postgresUser)
      await verifyDatabaseAbsent(postgresUser)
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
      await run('restore stopped PostgreSQL container', 'docker', [
        'stop',
        container,
      ])
      finalRunning = false
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
  if (errors.length)
    throw new AggregateError(errors, 'GAP-05/08 PostgreSQL cleanup failed')
}

let temporaryRoot
let fixtureRoot
let app
let firefox
let profile
let postgresUser
let databaseCreated = false
let initiallyRunning = false
let primaryError
const initialOwnedHash = await fileHash(sourceRoot, ownedFiles)
const initialProtectedHash = await fileHash(sourceRoot, protectedProductFiles)

try {
  initiallyRunning = await containerIsRunning()
  if (!initiallyRunning)
    await run('start disposable PostgreSQL container', 'docker', [
      'start',
      container,
    ])
  await waitForPostgres()
  const credentials = await run(
    'read PostgreSQL fixture credentials',
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
  const [containerUser, containerPassword, remainder] =
    credentials.stdout.split('\0')
  assert.equal(remainder, '')
  postgresUser = process.env.PARITY_POSTGRES_USER ?? containerUser
  const password = process.env.PARITY_POSTGRES_PASSWORD ?? containerPassword
  assert.ok(
    postgresUser && password,
    'PostgreSQL fixture credentials are required',
  )
  const databaseUrl = `postgresql://${encodeURIComponent(postgresUser)}:${encodeURIComponent(password)}@127.0.0.1:${postgresPort}/${databaseName}`
  await run(
    'create unique GAP-05/08 database',
    'docker',
    ['exec', container, 'createdb', '-U', postgresUser, databaseName],
    { timeout: 30_000 },
  )
  databaseCreated = true

  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'tks-gap0508-'))
  fixtureRoot = path.join(temporaryRoot, 'fixture')
  await cp(sourceRoot, fixtureRoot, {
    recursive: true,
    filter: (source) =>
      !['node_modules', '.output', '.git'].includes(
        path.relative(sourceRoot, source).split(path.sep)[0],
      ),
  })
  await linkDependencies(fixtureRoot)
  await writeFile(path.join(fixtureRoot, 'cms.config.ts'), fixtureConfig)
  const fixtureEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    CMS_ADAPTER: 'prisma',
    CMS_BOOTSTRAP_MODE: 'fresh',
    VITE_CACHE_DIR: path.join(fixtureRoot, '.vite-cache'),
    NITRO_BUILD_DIR: path.join(fixtureRoot, '.nitro-build'),
  }
  await run('isolated CMS fixture generation', 'npm', ['run', 'cms:generate'], {
    cwd: fixtureRoot,
    env: fixtureEnv,
  })
  await run(
    'isolated Prisma client generation',
    'npx',
    ['--no-install', 'prisma', 'generate'],
    { cwd: fixtureRoot, env: fixtureEnv },
  )
  const emptyDatabaseSql = await run(
    'render isolated empty-database Prisma SQL',
    'npx',
    [
      '--no-install',
      'prisma',
      'migrate',
      'diff',
      '--from-empty',
      '--to-schema',
      'prisma/schema.prisma',
      '--script',
    ],
    { cwd: fixtureRoot, env: fixtureEnv, captureOutput: true },
  )
  const schemaSqlPath = path.join(fixtureRoot, '.cms', 'advanced-fixture.sql')
  await writeFile(schemaSqlPath, emptyDatabaseSql.stdout)
  await run(
    'apply isolated empty-database Prisma SQL',
    '/bin/sh',
    [
      '-c',
      'docker exec -i "$PARITY_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$PARITY_POSTGRES_USER" -d "$PARITY_DATABASE" < "$PARITY_SCHEMA_SQL"',
    ],
    {
      env: {
        ...fixtureEnv,
        PARITY_CONTAINER: container,
        PARITY_POSTGRES_USER: postgresUser,
        PARITY_DATABASE: databaseName,
        PARITY_SCHEMA_SQL: schemaSqlPath,
      },
    },
  )
  await run('isolated advanced fixture build', 'npm', ['run', 'build'], {
    cwd: fixtureRoot,
    env: fixtureEnv,
  })
  await run(
    'seed isolated fixture Author',
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
      "INSERT INTO \"Author\" (id, name) VALUES ('cmgap0508fixtureauthor0001', 'Fixture Author')",
    ],
    { timeout: 30_000 },
  )

  const appPort = await availablePort()
  const bidiPort = await availablePort()
  const serverEntry = path.join(fixtureRoot, '.output/server/index.mjs')
  app = spawn(process.execPath, [serverEntry], {
    cwd: fixtureRoot,
    env: {
      ...fixtureEnv,
      HOST: '127.0.0.1',
      PORT: String(appPort),
      SESSION_SECRET: randomBytes(32).toString('hex'),
    },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let appLog = ''
  let readinessObservation = 'no response received'
  app.stdout.on('data', (chunk) => {
    appLog += chunk
  })
  app.stderr.on('data', (chunk) => {
    appLog += chunk
  })
  try {
    await waitFor(async () => {
      if (app.exitCode !== null)
        throw new Error(`fixture app exited: ${appLog}`)
      try {
        const response = await fetch(
          `http://127.0.0.1:${appPort}/dashboard/init`,
        )
        const body = await response.text()
        readinessObservation = `HTTP ${response.status}: ${body.slice(-2_000)}`
        return response.ok
      } catch (error) {
        readinessObservation = String(error)
        return false
      }
    }, 'isolated fixture app')
  } catch (error) {
    throw new Error(
      `${error.message}; last readiness result: ${readinessObservation}; app log: ${appLog}`,
      { cause: error },
    )
  }

  profile = await mkdtemp(path.join(os.tmpdir(), 'tks-gap0508-firefox-'))
  let firefoxLog = ''
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
  firefox.stdout.on('data', (chunk) => {
    firefoxLog += chunk
  })
  firefox.stderr.on('data', (chunk) => {
    firefoxLog += chunk
  })
  await waitFor(() => {
    if (firefox.exitCode !== null)
      throw new Error(`Firefox exited: ${firefoxLog}`)
    return firefoxLog.includes('WebDriver BiDi listening')
  }, 'isolated Firefox BiDi')
  let browserEvidence
  try {
    browserEvidence = await browserFlow(appPort, bidiPort)
  } catch (error) {
    let articleRoute = 'unavailable'
    try {
      const response = await fetch(
        `http://127.0.0.1:${appPort}/dashboard/articles/create`,
      )
      articleRoute = `HTTP ${response.status}: ${(await response.text()).slice(-4_000)}`
    } catch (routeError) {
      articleRoute = String(routeError)
    }
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}; article route: ${articleRoute}; app log: ${appLog}`,
      { cause: error },
    )
  }

  assert.equal(
    await postgresQuery(
      postgresUser,
      `SELECT count(*) FROM "Article" WHERE title = 'Advanced browser article'`,
    ),
    '1',
  )
  const rawBody = await postgresQuery(
    postgresUser,
    `SELECT body::text FROM "Article" WHERE title = 'Advanced browser article'`,
  )
  assert.match(rawBody, /component-block/)
  assert.match(rawBody, /Reload-edited callout/)
  assert.match(rawBody, /Fixture Author/)
  assert.equal(
    await postgresQuery(
      postgresUser,
      `SELECT count(*) FROM "Author" WHERE name = 'Rollback nested author'`,
    ),
    '0',
  )
  assert.equal(
    await postgresQuery(
      postgresUser,
      `SELECT count(*) FROM "Article" WHERE title = 'Nested rollback article'`,
    ),
    '0',
  )
  assert.equal(
    await fileHash(sourceRoot, protectedProductFiles),
    initialProtectedHash,
    'protected editor source changed during isolated gate',
  )
  assert.equal(
    await fileHash(sourceRoot, ownedFiles),
    initialOwnedHash,
    'owned evidence files changed during isolated gate',
  )
  console.log(
    `GAP-05/08 isolated browser+Prisma proof passed; created Article ${browserEvidence.createdId}; ${browserEvidence.events} Firefox events; network failures ${browserEvidence.networkFailures}; console errors ${browserEvidence.consoleErrors}; database ${databaseName}; owned-file hash ${initialOwnedHash}; protected-editor hash ${initialProtectedHash}`,
  )
} catch (error) {
  primaryError = error
} finally {
  const cleanupErrors = []
  for (const child of [firefox, app].filter(Boolean).reverse()) {
    try {
      if (processGroupExists(child.pid))
        await terminateChildGroup(child, 'GAP-05/08 child', {
          termGrace: 1_000,
        })
    } catch (error) {
      cleanupErrors.push(error)
    }
  }
  for (const target of [profile, temporaryRoot].filter(Boolean)) {
    try {
      await rm(target, { recursive: true, force: true })
      await assertAbsent(target, 'disposable cleanup path')
    } catch (error) {
      cleanupErrors.push(error)
    }
  }
  try {
    await restoreDatabase(initiallyRunning, postgresUser, databaseCreated)
  } catch (error) {
    cleanupErrors.push(error)
  }
  if (primaryError && cleanupErrors.length)
    throw new AggregateError(
      [primaryError, ...cleanupErrors],
      'GAP-05/08 proof and cleanup failed',
    )
  if (cleanupErrors.length)
    throw new AggregateError(cleanupErrors, 'GAP-05/08 cleanup failed')
  if (primaryError) throw primaryError
}
