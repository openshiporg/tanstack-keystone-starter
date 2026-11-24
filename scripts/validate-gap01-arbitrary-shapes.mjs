import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { runGap01CapturedChild } from './gap01-bounded-capture.mjs'
import { runBoundedChild } from './lib/bounded-child.mjs'
import {
  GAP01_CHECKPOINT017_CUID_EVIDENCE,
  GAP01_SHAPES,
  GAP01_USER_REPRO_INTAKE,
  gap01RequestExpression,
  validateUserReproEvidence,
  validateUserReproInputs,
  validateUserReproPaths,
} from './gap01-contract.mjs'

const sourceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
let temporaryRoot
let evidenceRoot
let gateCompleted = false
let primaryError

async function fingerprintPath(target) {
  const hash = createHash('sha256')
  async function visit(current, relative = '') {
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch (error) {
      if (error?.code === 'ENOENT') {
        hash.update('absent')
        return
      }
      throw error
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const entryPath = path.join(current, entry.name)
      const entryRelative = path.join(relative, entry.name)
      hash.update(`${entry.isDirectory() ? 'd' : 'f'}:${entryRelative}\0`)
      if (entry.isDirectory()) await visit(entryPath, entryRelative)
      else hash.update(await readFile(entryPath))
    }
  }
  await visit(target)
  return hash.digest('hex')
}

const sourceCachePaths = [
  path.join(sourceRoot, 'node_modules/.nitro'),
  path.join(sourceRoot, 'node_modules/.cache/jiti'),
  path.join(sourceRoot, 'node_modules/.vite'),
  path.join(sourceRoot, 'node_modules/.vite-temp'),
  path.join(sourceRoot, '.tanstack'),
]
const sourceCacheBefore = await Promise.all(
  sourceCachePaths.map((target) => fingerprintPath(target)),
)

async function fingerprintCopiedInputs(root) {
  const hash = createHash('sha256')
  async function visit(current, relative = '') {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!relative && ['node_modules', '.output', '.git'].includes(entry.name))
        continue
      const entryPath = path.join(current, entry.name)
      const entryRelative = path.join(relative, entry.name)
      hash.update(`${entry.isDirectory() ? 'd' : 'f'}:${entryRelative}\\0`)
      if (entry.isDirectory()) await visit(entryPath, entryRelative)
      else hash.update(await readFile(entryPath))
    }
  }
  await visit(root)
  return hash.digest('hex')
}

async function hashConcatenatedFiles(files) {
  const hash = createHash('sha256')
  for (const file of [...files].sort()) hash.update(await readFile(file))
  return hash.digest('hex')
}

let copiedInputBefore
const checkpoint017Files = GAP01_CHECKPOINT017_CUID_EVIDENCE.files.map((file) =>
  path.join(sourceRoot, file),
)
let checkpoint017Before

async function pathContainsMarker(target, markers) {
  try {
    const entries = await readdir(target, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = path.join(target, entry.name)
      if (entry.isDirectory()) {
        if (await pathContainsMarker(entryPath, markers)) return true
      } else {
        const contents = await readFile(entryPath, 'utf8')
        if (markers.some((marker) => contents.includes(marker))) return true
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  return false
}

async function copyDependencies(root) {
  const sourceModules = path.join(sourceRoot, 'node_modules')
  const targetModules = path.join(root, 'node_modules')
  await mkdir(targetModules)
  for (const entry of await readdir(sourceModules, { withFileTypes: true })) {
    if (['.cache', '.nitro', '.vite', '.vite-temp'].includes(entry.name))
      continue
    const sourceEntry = path.join(sourceModules, entry.name)
    const targetEntry = path.join(targetModules, entry.name)
    if (entry.name.startsWith('@') && entry.isDirectory()) {
      await mkdir(targetEntry)
      for (const scoped of await readdir(sourceEntry)) {
        await symlink(
          path.join(sourceEntry, scoped),
          path.join(targetEntry, scoped),
        )
      }
    } else {
      await symlink(sourceEntry, targetEntry)
    }
  }
}

function shapeConfig(shape) {
  const isStaff = shape.id === 'staff-inventory'
  const auth = isStaff
    ? {
        list: 'Staff',
        identity: 'loginName',
        secret: 'passphrase',
        display: 'displayName',
      }
    : {
        list: 'Operator',
        identity: 'handle',
        secret: 'pin',
        display: 'fullName',
      }
  const deniedField = isStaff ? 'internalNote' : 'auditNote'
  const creatable = isStaff
    ? `
    Inventory: list({
      access: { operation: { query: isSignedIn, create: isSignedIn, update: isSignedIn, delete: isSignedIn } },
      ui: { labelField: 'title', listView: { initialColumns: ['title', 'count', 'enabled'] } },
      fields: {
        title: text({ validation: { isRequired: true } }),
        count: integer({ validation: { isRequired: true, min: 0 } }),
        enabled: checkbox({ defaultValue: false }),
        ${deniedField}: text({ access: { read: false, create: false, update: false }, ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } } }),
      },
    }),
    Memo: list({
      access: { operation: { query: isSignedIn, create: isSignedIn, update: isSignedIn, delete: isSignedIn } },
      ui: { labelField: 'subject', listView: { initialColumns: ['subject', 'rank', 'flagged'] } },
      fields: {
        subject: text({ validation: { isRequired: true } }),
        rank: integer({ defaultValue: 0 }),
        flagged: checkbox({ defaultValue: false }),
      },
    }),`
    : `
    Article: list({
      access: { operation: { query: isSignedIn, create: isSignedIn, update: isSignedIn, delete: isSignedIn } },
      ui: { labelField: 'headline', listView: { initialColumns: ['headline', 'position', 'published'] } },
      fields: {
        headline: text({ validation: { isRequired: true } }),
        position: integer({ validation: { isRequired: true, min: 0 } }),
        published: checkbox({ defaultValue: false }),
        ${deniedField}: text({ access: { read: false, create: false, update: false }, ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } } }),
      },
    }),
    QueueItem: list({
      access: { operation: { query: isSignedIn, create: isSignedIn, update: isSignedIn, delete: isSignedIn } },
      ui: { labelField: 'name', listView: { initialColumns: ['name', 'attempts', 'queued'] } },
      fields: {
        name: text({ validation: { isRequired: true } }),
        attempts: integer({ defaultValue: 0 }),
        queued: checkbox({ defaultValue: false }),
      },
    }),`
  return `import { mergeSchemas } from '@graphql-tools/schema'
import type { GraphQLSchema } from 'graphql'
import { createAuth, statelessSessions } from './src/features/cms/keystone/auth'
import { config, list } from './src/features/cms/keystone/core'
import { checkbox, integer, password, text } from './src/features/cms/keystone/fields'
import type { CmsContext } from './src/features/cms/adapters'

const isSignedIn = ({ session }: { session?: unknown }) => Boolean(session)

function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: 'type Query { redirectToInit: Boolean }',
    resolvers: { Query: { redirectToInit: async (_root: unknown, _args: unknown, context: CmsContext) => (await context.sudo().query.${auth.list}.count({})) === 0 } },
  })
}

const { withAuth } = createAuth({
  listKey: '${auth.list}',
  identityField: '${auth.identity}',
  secretField: '${auth.secret}',
  initFirstItem: { fields: ['${auth.display}', '${auth.identity}', '${auth.secret}'] },
  sessionData: '${auth.display}',
})

export default withAuth(config({
  db: { provider: 'postgresql', url: 'env("DATABASE_URL")' },
  session: statelessSessions<{ itemId: string; listKey?: string }>({ maxAge: 60 * 60 * 24 }),
  ui: { isAccessAllowed: ({ session: currentSession }) => Boolean(currentSession) },
  graphql: { extendGraphqlSchema },
  lists: {
    ${auth.list}: list({
      ui: { labelField: '${auth.display}', hideCreate: true, hideNavigation: true },
      fields: {
        ${auth.display}: text({ validation: { isRequired: true } }),
        ${auth.identity}: text({ isIndexed: 'unique', validation: { isRequired: true } }),
        ${auth.secret}: password({ validation: { isRequired: true } }),
      },
    }),${creatable}
    ${shape.deniedList}: list({
      access: { operation: { query: false, create: false, update: false, delete: false } },
      graphql: { omit: { query: true } },
      ui: { hideCreate: true, hideNavigation: true },
      fields: { title: text({ validation: { isRequired: true } }) },
    }),
  },
}))
`
}

function patchArbitraryScript(script, config, shape) {
  const fixtureStart = script.indexOf('const fixtureConfig = `')
  const fixtureEnd = script.indexOf(
    '\n\nconst fieldZooFixtureConfig',
    fixtureStart,
  )
  assert.ok(fixtureStart >= 0 && fixtureEnd > fixtureStart)
  script = `${script.slice(0, fixtureStart)}const fixtureConfig = ${JSON.stringify(config)}${script.slice(fixtureEnd)}`

  const expectedStart = script.indexOf(
    '  process.env.ARBITRARY_BROWSER_EXPECTED_LIST_KEYS = useFieldZoo',
  )
  const expectedEnd = script.indexOf('\n  try {', expectedStart)
  assert.ok(expectedStart >= 0 && expectedEnd > expectedStart)
  script = `${script.slice(0, expectedStart)}  process.env.ARBITRARY_BROWSER_EXPECTED_LIST_KEYS = process.env.GAP01_EXPECTED_LIST_KEYS ?? (useFieldZoo ? 'FieldZoo' : 'Project')${script.slice(expectedEnd)}`

  const buildStart = "  await runBoundedChild('npm', ['run', 'build'], {"
  assert.ok(script.includes(buildStart))
  script = script.replace(
    buildStart,
    `  const buildServerEntry = path.join(fixtureRoot, '.output/server/index.mjs')
  await access(buildServerEntry).then(
    () => { throw new Error('GAP01 build artifact existed before the build') },
    (error) => { if (error?.code !== 'ENOENT') throw error },
  )
${buildStart}`,
  )
  const buildMarker =
    "  if (process.env.ARBITRARY_BROWSER_FORCE_FAILURE_AFTER_BUILD === '1') {"
  assert.ok(script.includes(buildMarker))
  script = script.replace(
    buildMarker,
    `  await access(buildServerEntry)
  const buildArtifactHash = createHash('sha256').update(await readFile(buildServerEntry)).digest('hex')
  console.log(\`GAP01_BUILD_FRESHNESS source=\${process.env.GAP01_SOURCE_FINGERPRINT} artifact=\${buildArtifactHash}\`)

${buildMarker}`,
  )
  const controllerRequestRewrite = String.raw`      .replace(
        'assertRequest: (data) => {\n          assert.deepEqual(data, submittedValues)\n        },',
        "assertRequest: (data) => {\n          assert.deepEqual(data, { ...submittedValues, title: 'controller:' + submittedValues.title })\n        },",
      )`
  assert.equal(script.split(controllerRequestRewrite).length - 1, 1)
  script = script.replace(
    controllerRequestRewrite,
    String.raw`      .replace(
        'assertRequest: (data) => {\n          assert.deepEqual(data, submittedValues)\n        },',
        'assertRequest: (data) => {\n          assert.deepEqual(data, submittedValues)\n        },',
      )`,
  )
  const controllerPersistenceRewrite = String.raw`      .replace(
        '            ...submittedValues,\n          })',
        "            ...submittedValues,\n            title: 'controller:' + submittedValues.title,\n          })",
      )`
  assert.equal(script.split(controllerPersistenceRewrite).length - 1, 1)
  script = script.replace(
    controllerPersistenceRewrite,
    String.raw`      .replace(
        '            ...submittedValues,\n          })',
        '            ...submittedValues,\n          })',
      )`,
  )
  return script
}

function patchBrowserScript(script, shape) {
  const importMatches = [
    ...script.matchAll(
      /^import[ \t]*\{[^}]*\brunBoundedChild\b[^}]*\}[ \t]*from[ \t]*['"]\.\/lib\/bounded-child\.mjs['"][ \t]*;?/gm,
    ),
  ]
  assert.equal(
    importMatches.length,
    1,
    'expected exactly one bounded-child import in browser harness',
  )
  const importBlock = importMatches[0][0]
  script = script.replace(
    importBlock,
    `${importBlock}\nimport { classifyGraphqlEvidence, gap01RequestExpression } from './gap01-contract.mjs'\n`,
  )
  for (const requiredImport of [
    'runBoundedChild',
    "from './lib/bounded-child.mjs'",
    'classifyGraphqlEvidence',
    'gap01RequestExpression',
    "from './gap01-contract.mjs'",
  ])
    assert.ok(
      script.includes(requiredImport),
      `patched browser harness lost required import: ${requiredImport}`,
    )
  assert.ok(script.includes('width: 1440, height: 2000'))
  script = script.replaceAll(
    'width: 1440, height: 2000',
    'width: 1280, height: 900',
  )
  const createdPathMarker =
    "    const createdPath = await evaluate('location.pathname')"
  assert.ok(script.includes(createdPathMarker))
  script = script.replace(
    createdPathMarker,
    `${createdPathMarker}
    const routeId = decodeURIComponent(createdPath.split('/').pop())
    const returnedId = evidence.response?.data?.[mutationName]?.id
    const operationDefinition = evidence.request.query.match(/(?:query|mutation|subscription)\\s+([_A-Za-z][_0-9A-Za-z]*)/)?.[1]
    const expectedOperation = 'DashboardCreate'
    assert.equal(operationDefinition, expectedOperation)
    assert.equal(
      classifyGraphqlEvidence(
        { operation: expectedOperation, request: evidence.request, response: { status: evidence.status, body: evidence.response } },
        { operation: expectedOperation, routeId, idPath: [mutationName, 'id'] },
      ).classification,
      'success',
      'GAP-01 mutation evidence classification failed for ' + mutationName + '; returned=' + String(returnedId) + ' route=' + routeId,
    )
`,
  )

  const publicAuthMarker =
    '    const publicAuth = publicAuthResult.data.keystone.auth'
  assert.equal(script.split(publicAuthMarker).length - 1, 1)
  const firstRoot =
    shape.id === 'staff-inventory' ? 'createInventory' : 'createArticle'
  const firstInput =
    shape.id === 'staff-inventory'
      ? 'InventoryCreateInput'
      : 'ArticleCreateInput'
  const fetchHelper = `    async function gap01FetchJson(request) {
      const requestExpression = gap01RequestExpression(request)
      return JSON.parse(await evaluate(\`(async () => {
        const request = \${requestExpression}
        const response = await fetch('/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) })
        return JSON.stringify({ status: response.status, body: await response.json() })
      })()\`))
    }
`
  const preInitProbe = `    const preInitRequest = { query: 'query Gap01PreInitMeta { keystone { adminMeta { isAccessAllowed } } }' }
    const preInitMetaResponse = await gap01FetchJson(preInitRequest)
    assert.equal(preInitMetaResponse.status, 200)
    assert.equal(preInitMetaResponse.body.data.keystone.adminMeta.isAccessAllowed, true)
    assert.equal(await evaluate(\`document.body.innerText.includes('Create admin account')\`), true)
`
  script = script.replace(
    publicAuthMarker,
    `${publicAuthMarker}\n${fetchHelper}${preInitProbe}`,
  )
  const hiddenLists = JSON.stringify([
    shape.auth.listKey,
    ...shape.creatableLists,
    shape.deniedList,
  ])
  const publicProbe = `    const publicMetaRequest = { query: 'query Gap01PublicMeta { keystone { adminMeta { isAccessAllowed lists { key } } } }' }
    const publicMetaResponse = await gap01FetchJson(publicMetaRequest)
    const publicMetaProbe = publicMetaResponse.body
    assert.equal(publicMetaResponse.status, 200)
    assert.equal(publicMetaProbe.data?.keystone?.adminMeta, undefined)
    assert.ok(Array.isArray(publicMetaProbe.errors) && publicMetaProbe.errors.length > 0)
    assert.match(JSON.stringify(publicMetaProbe.errors), /KS_ACCESS_DENIED|access[ -]?denied/i)
    const serializedPublicMeta = JSON.stringify(publicMetaProbe)
    for (const hiddenList of ${hiddenLists}) assert.equal(serializedPublicMeta.includes(hiddenList), false)
    const anonymousRequest = { query: 'mutation Gap01Anonymous($data: ${firstInput}!) { ${firstRoot}(data: $data) { id } }', variables: { data: { ${shape.id === 'staff-inventory' ? "title: 'anonymous', count: 1, enabled: false" : "headline: 'anonymous', position: 1, published: false"} } } }
    const anonymousResponse = await gap01FetchJson(anonymousRequest)
    assert.equal(classifyGraphqlEvidence({ operation: 'Gap01Anonymous', request: anonymousRequest, response: { status: anonymousResponse.status, body: anonymousResponse.body } }, { operation: 'Gap01Anonymous' }).classification, 'access-denied')
`
  const endSessionMarker =
    '    assert.equal(signOutResult.data.endSession, true)'
  assert.equal(script.split(endSessionMarker).length - 1, 1)
  const endSessionPosition = script.indexOf(endSessionMarker)
  const signinMarker = "    await navigate('/dashboard/signin')"
  const signinPosition = script.indexOf(signinMarker, endSessionPosition)
  assert.ok(signinPosition >= 0)
  script = script.replace(signinMarker, `${signinMarker}\n${publicProbe}`)
  const authenticatedMetaMarker = '    const metaResult = JSON.parse('
  const authenticatedMetaPosition = script.indexOf(
    authenticatedMetaMarker,
    signinPosition,
  )
  const boundedArbitraryFlow = script.slice(
    signinPosition,
    authenticatedMetaPosition,
  )
  assert.equal(boundedArbitraryFlow.split(signinMarker).length - 1, 1)
  const publicProbePosition = script.indexOf('const publicMetaProbe')
  assert.ok(endSessionPosition >= 0)
  assert.ok(publicProbePosition > endSessionPosition)
  assert.ok(publicProbePosition > signinPosition)
  assert.ok(publicProbePosition < authenticatedMetaPosition)
  assert.ok(signinPosition < publicProbePosition)

  const protectedMetaMarker =
    '    assert.equal(adminMeta.isAccessAllowed, true)'
  assert.ok(script.includes(protectedMetaMarker))
  const protectedProbe = `    assert.equal(adminMeta.lists.some((list) => list.key === ${JSON.stringify(shape.deniedList)}), false)
    const protectedNames = adminMeta.lists.flatMap((list) => list.fields.map((field) => field.path))
    assert.equal(protectedNames.includes('passwordResetToken'), false)
    assert.equal(protectedNames.includes('passwordResetIssuedAt'), false)
    assert.equal(protectedNames.includes('passwordResetRedeemedAt'), false)
    const protectedCreatable = adminMeta.lists.filter((list) => !list.hideCreate && !list.isHidden)
    assert.deepEqual(protectedCreatable.map((list) => list.key).sort(), ${JSON.stringify([...shape.creatableLists].sort())})
    for (const list of protectedCreatable) {
      const editableFields = list.fields.filter((field) => field.createView.fieldMode === 'edit')
      assert.equal(editableFields.some((field) => field.path === ${JSON.stringify(shape.id === 'staff-inventory' ? 'internalNote' : 'auditNote')}), false)
    }
    const invalidRequest = { query: 'mutation Gap01Invalid($data: ${firstInput}!) { ${firstRoot}(data: $data) { id } }', variables: { data: { ${shape.id === 'staff-inventory' ? 'title: "", count: -1, enabled: false' : 'headline: "", position: -1, published: false'} } } }
    const invalidResponse = await gap01FetchJson(invalidRequest)
    assert.equal(classifyGraphqlEvidence({ operation: 'Gap01Invalid', request: invalidRequest, response: { status: invalidResponse.status, body: invalidResponse.body } }, { operation: 'Gap01Invalid' }).classification, 'graphql-validation')
    const deniedRequest = { query: 'mutation Gap01Denied($data: ${shape.deniedList}CreateInput!) { create${shape.deniedList}(data: $data) { id } }', variables: { data: { title: 'denied' } } }
    const deniedProbe = await gap01FetchJson(deniedRequest)
    assert.equal(classifyGraphqlEvidence({ operation: 'Gap01Denied', request: deniedRequest, response: { status: deniedProbe.status, body: deniedProbe.body } }, { operation: 'Gap01Denied' }).classification, 'access-denied')
    assert.ok(deniedProbe.body.errors?.length, 'direct denied-list mutation unexpectedly succeeded')
    assert.match(JSON.stringify(deniedProbe.body.errors), /access|denied|forbidden|not allowed/i)
`
  script = script.replace(
    protectedMetaMarker,
    `${protectedMetaMarker}\n${protectedProbe}`,
  )
  return script
}

async function runStubbornDescendantProbe() {
  const marker = `gap01-stubborn-${process.pid}-${Date.now()}`
  const reportPath = path.join(temporaryRoot, 'stubborn-report.json')
  await assert.rejects(
    () =>
      runBoundedChild(
        process.execPath,
        [
          path.join(sourceRoot, 'scripts/gap01-user-probe-runner.mjs'),
          JSON.stringify([
            process.execPath,
            path.join(sourceRoot, 'scripts/fixtures/gap01-stubborn-child.mjs'),
            marker,
          ]),
          sourceRoot,
          reportPath,
        ],
        {
          label: 'GAP-01 runner stubborn descendant probe',
          timeout: 1_000,
          termGrace: 100,
          cwd: sourceRoot,
          env: { ...process.env, GAP01_USER_REPRO_TIMEOUT_MS: '200' },
          stdio: 'ignore',
        },
      ),
    /Timed out running|left surviving|process-group/,
  )
  const processes = await runBoundedChild(
    '/bin/ps',
    ['-axo', 'pid=,command='],
    {
      label: 'GAP-01 stubborn descendant residue check',
      timeout: 5_000,
      captureOutput: true,
      maxCapturedBytes: 4 * 1024 * 1024,
    },
  )
  assert.equal(
    processes.stdout.includes(marker),
    false,
    'stubborn runner residue remained',
  )
  await rm(reportPath, { force: true })
}

async function runProbeOverflowProbe() {
  const reportPath = path.join(temporaryRoot, 'overflow-report.json')
  await runBoundedChild(
    process.execPath,
    [
      path.join(sourceRoot, 'scripts/gap01-user-probe-runner.mjs'),
      JSON.stringify([
        process.execPath,
        path.join(sourceRoot, 'scripts/fixtures/gap01-overflow-child.mjs'),
      ]),
      sourceRoot,
      reportPath,
    ],
    {
      label: 'GAP-01 runner overflow probe',
      timeout: 10_000,
      termGrace: 100,
      cwd: sourceRoot,
      stdio: 'ignore',
    },
  )
  const report = JSON.parse(await readFile(reportPath, 'utf8'))
  assert.equal(report.captureOverflow, true)
  assert.equal(
    validateUserReproEvidence({
      report,
      evidence: { traceToken: 'GAP01_OVERFLOW' },
    }).reason,
    'captured-output-overflow',
  )
  await rm(reportPath, { force: true })
}

function printGap01FailureSummary(shape, result, sourceHash, reportPath) {
  if (!result) return
  console.error(
    `GAP-01 FAILED bounded child summary: ${JSON.stringify({
      shape: shape.id,
      sourceInputHash: sourceHash,
      reportPath,
      exitCode: result.exitCode,
      signal: result.signal,
      timedOut: result.timedOut,
      captureOverflow: result.captureOverflow,
      leftDescendants: result.leftDescendants,
      quiescent: result.quiescent,
      cleanupError: result.cleanupError,
      spawnError: result.spawnError,
      stdoutTail: result.stdout.slice(-4_000),
      stderrTail: result.stderr.slice(-4_000),
    })}`,
  )
}

async function runShape(shape) {
  const root = path.join(temporaryRoot, shape.id)
  await cp(sourceRoot, root, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(sourceRoot, source)
      return !['node_modules', '.output', '.git'].includes(
        relative.split(path.sep)[0],
      )
    },
  })
  await copyDependencies(root)
  const config = shapeConfig(shape)
  const arbitraryPath = path.join(
    root,
    'scripts/validate-dashboard-arbitrary-browser.mjs',
  )
  const browserPath = path.join(root, 'scripts/validate-dashboard-browser.mjs')
  await writeFile(
    arbitraryPath,
    patchArbitraryScript(await readFile(arbitraryPath, 'utf8'), config, shape),
  )
  await writeFile(
    browserPath,
    patchBrowserScript(await readFile(browserPath, 'utf8'), shape),
  )
  for (const relativeScript of [
    'scripts/validate-dashboard-arbitrary-browser.mjs',
    'scripts/validate-dashboard-browser.mjs',
  ])
    await runBoundedChild(process.execPath, ['--check', relativeScript], {
      label: `GAP-01 ${shape.id} patched ${relativeScript} syntax check`,
      timeout: 10_000,
      termGrace: 500,
      cwd: root,
      stdio: 'ignore',
    })
  const configPreflightReport = path.join(
    evidenceRoot,
    `${shape.id}-${process.hrtime.bigint()}-config-preflight.json`,
  )
  const generatedConfigPath = path.join(
    root,
    'gap01-generated-config-preflight.ts',
  )
  await writeFile(generatedConfigPath, config)
  assert.equal(await readFile(generatedConfigPath, 'utf8'), config)
  assert.equal(
    config.includes(
      "import { isSignedIn } from './src/features/cms/keystone/access'",
    ),
    false,
  )
  const configImportExpression = `void import(${JSON.stringify(pathToFileURL(generatedConfigPath).href)}).then(({ default: generated }) => { const denied = generated?.lists?.[${JSON.stringify(shape.deniedList)}]; if (!denied) throw new Error('generated config omitted denied list definition'); if (denied.graphql?.omit?.query !== true) throw new Error('denied list query was not omitted'); if (denied.graphql?.omit?.create === true) throw new Error('denied list create mutation was omitted'); }).catch((error) => { console.error(error); process.exitCode = 1 })`
  const configPreflight = await runGap01CapturedChild(
    path.join(root, 'node_modules/.bin/tsx'),
    ['-e', configImportExpression],
    {
      label: `GAP-01 ${shape.id} generated config import preflight`,
      timeout: 30_000,
      termGrace: 500,
      cwd: root,
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ??
          'postgresql://gap01:gap01@127.0.0.1:5432/gap01',
      },
      maxCapturedBytes: 2 * 1024 * 1024,
      reportPath: configPreflightReport,
    },
  )
  if (
    configPreflight.exitCode !== 0 ||
    configPreflight.signal ||
    configPreflight.timedOut ||
    configPreflight.captureOverflow ||
    !configPreflight.quiescent
  )
    printGap01FailureSummary(
      shape,
      configPreflight,
      'generated-config-import-preflight',
      configPreflightReport,
    )
  assert.equal(
    configPreflight.exitCode,
    0,
    `GAP-01 ${shape.id} generated config import preflight failed`,
  )
  assert.equal(configPreflight.signal, null)
  assert.equal(configPreflight.timedOut, false)
  assert.equal(configPreflight.captureOverflow, false)
  assert.equal(configPreflight.quiescent, true)
  await rm(generatedConfigPath, { force: true })
  const freshBefore = await fingerprintPath(path.join(root, 'src'))
  const reportPath = path.join(
    evidenceRoot,
    `${shape.id}-${process.hrtime.bigint()}-browser-report.json`,
  )
  let result
  try {
    result = await runGap01CapturedChild(
      process.execPath,
      ['scripts/validate-dashboard-arbitrary-browser.mjs'],
      {
        label: `GAP-01 ${shape.id} disposable Firefox gate`,
        timeout: 420_000,
        termGrace: 1_000,
        cwd: root,
        env: {
          ...process.env,
          CMS_ADAPTER: 'memory',
          CMS_BOOTSTRAP_MODE: 'fresh',
          GAP01_EXPECTED_LIST_KEYS: shape.creatableLists.join(','),
          GAP01_DENIED_LIST: shape.deniedList,
          GAP01_SOURCE_FINGERPRINT: freshBefore,
        },
        maxCapturedBytes: 48 * 1024 * 1024,
        reportPath,
      },
    )
  } catch (error) {
    printGap01FailureSummary(shape, error.result, freshBefore, reportPath)
    throw error
  }
  if (
    result.exitCode !== 0 ||
    result.signal ||
    result.timedOut ||
    result.captureOverflow ||
    !result.quiescent
  )
    printGap01FailureSummary(shape, result, freshBefore, reportPath)
  assert.equal(result.exitCode, 0, `GAP-01 ${shape.id} child failed`)
  assert.equal(result.signal, null, `GAP-01 ${shape.id} child was signaled`)
  assert.equal(result.timedOut, false, `GAP-01 ${shape.id} child timed out`)
  assert.equal(
    result.captureOverflow,
    false,
    `GAP-01 ${shape.id} child output overflowed`,
  )
  assert.equal(
    result.quiescent,
    true,
    `GAP-01 ${shape.id} child was not quiescent`,
  )
  const freshAfter = await fingerprintPath(path.join(root, 'src'))
  assert.equal(
    freshAfter,
    freshBefore,
    `${shape.id} source changed during build/gate`,
  )
  const freshness = result.stdout.match(
    /GAP01_BUILD_FRESHNESS source=([a-f0-9]{64}) artifact=([a-f0-9]{64})/,
  )
  assert.ok(freshness, `${shape.id} did not report build artifact freshness`)
  assert.equal(
    freshness[1],
    freshBefore,
    `${shape.id} build was not bound to its source hash`,
  )
  assert.match(
    result.stdout + result.stderr,
    /0 unexpected request\/response\/console errors/,
  )
  const acceptance = result.stdout.match(
    /Firefox dashboard arbitrary-model acceptance passed: AdminMeta discovered and persisted (.*); (\d+) observed events, (\d+) expected navigation abort\(s\), 0 unexpected request\/response\/console errors\./,
  )
  assert.ok(
    acceptance,
    `${shape.id} did not report the exact arbitrary-model acceptance summary`,
  )
  const observedLists = acceptance[1]
    .split(',')
    .map((listKey) => listKey.trim())
  assert.deepEqual(
    [...observedLists].sort(),
    [...shape.creatableLists].sort(),
    `${shape.id} acceptance summary list coverage changed`,
  )
  assert.equal(observedLists.includes(shape.deniedList), false)
  assert.equal(observedLists.includes(shape.auth.listKey), false)
  const summary = {
    id: shape.id,
    sourceHash: freshBefore,
    artifactHash: freshness[2],
    creatableLists: observedLists,
    events: Number(acceptance[2]),
    expectedNavigationAborts: Number(acceptance[3]),
  }
  await rm(root, { recursive: true, force: true })
  return summary
}

async function userReproStatus() {
  const required = {
    fixture: process.env.GAP01_USER_REPRO_FIXTURE,
    command: process.env.GAP01_USER_REPRO_COMMAND,
    runtime: process.env.GAP01_USER_REPRO_RUNTIME,
    versions: process.env.GAP01_USER_REPRO_VERSIONS,
    evidence: process.env.GAP01_USER_REPRO_EVIDENCE,
  }
  if (process.env.GAP01_USER_REPRO_PROBE !== '1')
    return { ...GAP01_USER_REPRO_INTAKE, missing: Object.keys(required) }

  const inputCheck = validateUserReproInputs(required)
  if (!inputCheck.ok) {
    const blocked = new Error(
      `BLOCKED: GAP-01 user repro inputs invalid (${inputCheck.reason})`,
    )
    blocked.code = 'BLOCKED'
    throw blocked
  }
  const argv = inputCheck.argv
  const fixture = path.resolve(required.fixture)
  const evidencePath = path.resolve(required.evidence)
  const fixtureStats = await stat(fixture).catch(() => null)
  const evidenceStats = await stat(evidencePath).catch(() => null)
  if (
    !validateUserReproPaths({
      fixtureIsDirectory: fixtureStats?.isDirectory(),
      evidenceIsFile: evidenceStats?.isFile(),
    }).ok
  ) {
    const blocked = new Error(
      'BLOCKED: GAP-01 user repro fixture/evidence paths are invalid',
    )
    blocked.code = 'BLOCKED'
    throw blocked
  }

  const reportPath = path.join(temporaryRoot, 'user-repro-report.json')
  try {
    await runBoundedChild(
      process.execPath,
      [
        path.join(sourceRoot, 'scripts/gap01-user-probe-runner.mjs'),
        JSON.stringify(argv),
        fixture,
        reportPath,
      ],
      {
        label: 'GAP-01 user-specific bounded repro probe',
        timeout:
          Number(process.env.GAP01_USER_REPRO_TIMEOUT_MS ?? 120_000) + 5_000,
        termGrace: 1_000,
        cwd: sourceRoot,
        env: { ...process.env, GAP01_USER_REPRO_RUNTIME: required.runtime },
        stdio: 'inherit',
      },
    )
  } catch (error) {
    const blocked = new Error(
      `BLOCKED: GAP-01 user repro runner failed (${error.message})`,
    )
    blocked.code = 'BLOCKED'
    throw blocked
  }
  const report = JSON.parse(await readFile(reportPath, 'utf8'))
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'))
  const outcome = validateUserReproEvidence({ report, evidence })
  if (outcome.status !== 'reproduced') {
    const blocked = new Error(
      `BLOCKED: GAP-01 user repro probe did not match evidence (${outcome.reason})`,
    )
    blocked.code = 'BLOCKED'
    throw blocked
  }
  return {
    ...GAP01_USER_REPRO_INTAKE,
    ...outcome,
    note: 'User-specific trace matched supplied machine-readable evidence; this does not generalize beyond the supplied environment.',
  }
}

try {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'gap01-arbitrary-'))
  evidenceRoot = await mkdtemp(path.join(os.tmpdir(), 'gap01-evidence-'))
  copiedInputBefore = await fingerprintCopiedInputs(sourceRoot)
  checkpoint017Before = await hashConcatenatedFiles(checkpoint017Files)
  assert.equal(
    checkpoint017Before,
    GAP01_CHECKPOINT017_CUID_EVIDENCE.sha256,
    'checkpoint-017 external CUID evidence mismatch',
  )
  const intake = await userReproStatus()
  console.log(`GAP-01 user-specific intake: ${JSON.stringify(intake)}`)
  await runStubbornDescendantProbe()
  await runProbeOverflowProbe()
  const results = []
  for (let pass = 1; pass <= 2; pass += 1) {
    const passBefore = await fingerprintCopiedInputs(sourceRoot)
    assert.equal(
      passBefore,
      copiedInputBefore,
      `GAP-01 copied input hash changed before pass ${pass}`,
    )
    assert.equal(
      await hashConcatenatedFiles(checkpoint017Files),
      GAP01_CHECKPOINT017_CUID_EVIDENCE.sha256,
      `checkpoint-017 CUID evidence changed before pass ${pass}`,
    )
    const passResults = []
    for (const shape of GAP01_SHAPES) passResults.push(await runShape(shape))
    const passAfter = await fingerprintCopiedInputs(sourceRoot)
    assert.equal(
      passAfter,
      copiedInputBefore,
      `GAP-01 copied input hash changed after pass ${pass}`,
    )
    assert.equal(
      await hashConcatenatedFiles(checkpoint017Files),
      GAP01_CHECKPOINT017_CUID_EVIDENCE.sha256,
      `checkpoint-017 CUID evidence changed after pass ${pass}`,
    )
    if (results[0]) {
      assert.deepEqual(
        passResults.map((shape) => shape.sourceHash),
        results[0].shapes.map((shape) => shape.sourceHash),
        `GAP-01 per-shape source hashes changed between passes ${pass - 1} and ${pass}`,
      )
    }
    results.push({ pass, shapes: passResults })
  }

  assert.equal(
    await hashConcatenatedFiles(checkpoint017Files),
    GAP01_CHECKPOINT017_CUID_EVIDENCE.sha256,
    'checkpoint-017 CUID evidence changed after both passes',
  )
  const cacheAfter = await Promise.all(
    sourceCachePaths.map((target) => fingerprintPath(target)),
  )
  assert.deepEqual(
    cacheAfter,
    sourceCacheBefore,
    'source cache fingerprints changed',
  )
  for (const target of sourceCachePaths) {
    assert.equal(
      await pathContainsMarker(target, [
        'Project: list({',
        'FieldZoo',
        'ZooRelated',
        'tks-arbitrary-browser',
        'GAP01_BUILD_FRESHNESS',
      ]),
      false,
      `fixture marker leaked into ${target}`,
    )
  }
  console.log(`GAP-01 arbitrary shape gate passed: ${JSON.stringify(results)}`)
  console.log(
    `GAP-01 IDs: memory synthetic only; external accepted checkpoint-017 Prisma/CUID evidence hash=${GAP01_CHECKPOINT017_CUID_EVIDENCE.sha256}; this gate does not produce realistic IDs.`,
  )
  if (intake.status === 'reproduced')
    console.log(
      `GAP-01 user-specific probe matched supplied evidence: ${intake.traceToken}`,
    )
  else
    console.log(
      'GAP-01 user-specific failure remains not-reproduced; no reproduction claim is made.',
    )
  gateCompleted = true
} catch (error) {
  primaryError = error
  throw error
} finally {
  let cleanupError
  try {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true })
    const cacheAfterCleanup = await Promise.all(
      sourceCachePaths.map((target) => fingerprintPath(target)),
    )
    assert.deepEqual(
      cacheAfterCleanup,
      sourceCacheBefore,
      'source cache changed during cleanup',
    )
    for (const target of sourceCachePaths) {
      assert.equal(
        await pathContainsMarker(target, [
          'Project: list({',
          'FieldZoo',
          'ZooRelated',
          'tks-arbitrary-browser',
          'GAP01_BUILD_FRESHNESS',
        ]),
        false,
        `fixture marker leaked during cleanup into ${target}`,
      )
    }
  } catch (error) {
    cleanupError = error
  }
  if (cleanupError) {
    console.error(
      `GAP-01 cleanup failed; preserving evidence at ${evidenceRoot}`,
    )
    if (primaryError)
      throw new AggregateError(
        [primaryError, cleanupError],
        'GAP-01 primary failure and cleanup failure',
      )
    throw cleanupError
  }
  if (gateCompleted && evidenceRoot)
    await rm(evidenceRoot, { recursive: true, force: true })
  else if (evidenceRoot)
    console.error(`GAP-01 RED evidence preserved at ${evidenceRoot}`)
}
