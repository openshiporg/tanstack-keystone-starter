import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { runBoundedChild } from './lib/bounded-child.mjs'

const root = process.cwd()
const canaryScript = path.join(
  root,
  'scripts/validate-openfront-runtime-canary.mjs',
)
const wrapperScript = path.join(
  root,
  'scripts/run-openfront-runtime-canary-checkpoint.mjs',
)
const boundsProbe = path.join(
  root,
  'scripts/validate-openfront-runtime-canary-bounds.mjs',
)
const hangingProbe = path.join(root, 'scripts/fixtures/hanging-fault-build.mjs')
const viteLauncher = path.join(
  root,
  'scripts/fixtures/openfront-vite-launcher.mjs',
)
const consumers = ['opensource.builders', 'os.org']
const acceptedCanonicalHashes = new Map([
  [
    'package.json',
    '29b85d3fbb59915d004f93a5b671ade5aa5114eee5196a4dd9646ebc843e5cde',
  ],
  [
    'scripts/validate-dashboard-advanced-document-browser.mjs',
    '54d5813a2989101e072e4733808864cb1ef3b67936969a9b6152a798531023a8',
  ],
  [
    'src/components/dashboard/rich-document-editor.tsx',
    '2888679f54d0ecfc110b0f54d98da261c893c33baf6a4a5ea2ae35b7ef2fde74',
  ],
  [
    'src/components/dashboard/relationship-field-editor.tsx',
    '55efb0963042bd69733f9720f553037a5f2cdb1a7e72b4939de960c60305f426',
  ],
  [
    'src/components/dashboard/views/document.tsx',
    '43345880b7e0dedd152a1f749ea3a38744e7b1c8d5033272910a78fd58c1b224',
  ],
  [
    'tests/dashboard-document-view.test.ts',
    '0a7bbce8acef09065724ab3dfa00f9f8ec434054312aac2121a5dca6efd29aa6',
  ],
  [
    'vite.config.ts',
    'c72b9186345b4bfa7a824700b2d5ff06a241332efbcb70f710866c7ebd1166e2',
  ],
  [
    'scripts/validate-dashboard-browser.mjs',
    '8fb84246341a735adaf34a2bb6387035043abfe5fd411704e3080a419aa28051',
  ],
  [
    'scripts/validate-dashboard-browser-prisma.mjs',
    'f3affab1eb1f235e0781d51d309bb025067bfa7a68d104d564281a5ce145cd2c',
  ],
  [
    'scripts/validate-nitro-error-runtime.mjs',
    'bc2f8a28a9816146ea66034110671864e040371269e91210bb5fe254eb07db9b',
  ],
])
const acceptedHashPaths = [
  ...acceptedCanonicalHashes.keys(),
  'scripts/lib/bounded-child.mjs',
  'scripts/lib/bounded-child.d.mts',
  'scripts/fixtures/firefox-launcher-exit.mjs',
  'src/components/dashboard/page-breadcrumbs.tsx',
  'src/components/ui/alert-dialog.tsx',
  'src/components/ui/sheet.tsx',
  'src/components/ui/sidebar.tsx',
  'src/routes/dashboard/$listKey.$id.tsx',
  'src/server/error-handler.ts',
  'src/server/nitro-plugin.ts',
  'src/server/parity-fault-handler.ts',
  'src/server/parity-fault-plugin.ts',
  'src/server/parity-fault-state.ts',
].map((relativePath) => path.join(root, relativePath))
const sourceCacheDirectories = [
  path.join(root, 'node_modules/.cache/jiti'),
  path.join(root, 'node_modules/.vite'),
  path.join(root, 'node_modules/.nitro'),
  path.join(root, '.tanstack'),
]

function walkFiles(directory, callback, relative = '') {
  if (!existsSync(directory)) return
  for (const name of readdirSync(directory).sort()) {
    const fullPath = path.join(directory, name)
    const stat = lstatSync(fullPath)
    const childRelative = path.join(relative, name)
    if (stat.isDirectory()) walkFiles(fullPath, callback, childRelative)
    else callback(fullPath, childRelative)
  }
}

function fileFingerprint(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function aggregateFingerprint() {
  const hash = createHash('sha256')
  for (const filePath of [
    canaryScript,
    wrapperScript,
    boundsProbe,
    hangingProbe,
    viteLauncher,
  ]) {
    hash.update(path.relative(root, filePath))
    hash.update('\0')
    hash.update(readFileSync(filePath))
    hash.update('\0')
  }
  return hash.digest('hex')
}

function acceptedHashSnapshot() {
  for (const [relativePath, expected] of acceptedCanonicalHashes) {
    assert.equal(
      fileFingerprint(path.join(root, relativePath)),
      expected,
      `accepted canonical hash drifted: ${relativePath}`,
    )
  }
  return new Map(
    acceptedHashPaths.map((filePath) => [filePath, fileFingerprint(filePath)]),
  )
}

function assertAcceptedHashesUnchanged(snapshot, consumer) {
  for (const [filePath, before] of snapshot) {
    assert.equal(
      fileFingerprint(filePath),
      before,
      `${consumer} changed accepted file ${path.relative(root, filePath)}`,
    )
  }
}

function cacheFingerprint() {
  const hash = createHash('sha256')
  for (const directory of sourceCacheDirectories) {
    hash.update(`\n[${directory}]\n`)
    walkFiles(directory, (fullPath, relative) => {
      hash.update(`${relative}\n`)
      hash.update(readFileSync(fullPath))
      hash.update('\n')
    })
  }
  return hash.digest('hex')
}

function fixtureMarkers() {
  const directory = path.join(root, '.cms-temp')
  if (!existsSync(directory)) return []
  return readdirSync(directory)
    .filter((name) => name.startsWith('openfront-runtime-canary-'))
    .map((name) => path.join(directory, name))
}

function cacheMarkers() {
  const markers = []
  for (const directory of sourceCacheDirectories) {
    walkFiles(directory, (_fullPath, relative) => {
      if (relative.includes('openfront-runtime-canary-')) {
        markers.push(path.join(directory, relative))
      }
    })
  }
  return markers.sort()
}

async function commandOutput(label, command, args, timeout = 30_000) {
  const result = await runBoundedChild(command, args, {
    label,
    timeout,
    captureOutput: true,
    maxCapturedBytes: 4 * 1024 * 1024,
    cwd: root,
    env: process.env,
  })
  return result.stdout
}

async function verifyExternalResidue(
  beforeFingerprint,
  acceptedHashes,
  consumer,
  expectBlocked,
) {
  const failures = []
  const check = async (label, action) => {
    try {
      await action()
    } catch (error) {
      failures.push(
        `${label}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  const afterFingerprint = cacheFingerprint()
  await check('accepted hash verification', () =>
    assertAcceptedHashesUnchanged(acceptedHashes, consumer),
  )
  await check('source cache fingerprint verification', () =>
    assert.equal(
      afterFingerprint,
      beforeFingerprint,
      `${consumer} source-cache fingerprint changed after canary process exit`,
    ),
  )
  await check('source cache marker verification', () =>
    assert.deepEqual(
      cacheMarkers(),
      [],
      `${consumer} canary cache markers remain after canary process exit`,
    ),
  )
  await check('database residue verification', async () => {
    const databases = await commandOutput(
      `${consumer} canary database residue check`,
      'docker',
      [
        'exec',
        'vibe-runtime-postgres',
        'psql',
        '-At',
        '-U',
        'junaid',
        '-d',
        'postgres',
        '-c',
        "select datname from pg_database where datname like 'tks_openfront_%_canary_%' order by datname;",
      ],
    )
    assert.equal(
      databases.trim(),
      '',
      `${consumer} canary database residue remains`,
    )
  })
  await check('container dump residue verification', async () => {
    const containerDumps = await commandOutput(
      `${consumer} canary container dump residue check`,
      'docker',
      [
        'exec',
        'vibe-runtime-postgres',
        'find',
        '/tmp',
        '-maxdepth',
        '1',
        '-type',
        'f',
        '-name',
        'tks_openfront_*_canary_*.dump',
        '-print',
      ],
    )
    assert.equal(
      containerDumps.trim(),
      '',
      `${consumer} canary container dump residue remains`,
    )
  })
  await check('fixture residue verification', () =>
    assert.deepEqual(
      fixtureMarkers(),
      [],
      `${consumer} canary fixture residue remains`,
    ),
  )
  await check('report finalization verification', () => {
    const reportPath = path.join(
      root,
      `reports/openfront-runtime-cutover-canary-${consumer === 'os.org' ? 'os-org' : 'opensource-builders'}.md`,
    )
    const report = readFileSync(reportPath, 'utf8')
    assert.match(
      report,
      expectBlocked ? /Status: \*\*BLOCKED\*\*/ : /Status: \*\*PASS\*\*/,
      `${consumer} canary report status did not match expected finalization`,
    )
  })
  await check('process residue verification', async () => {
    const processes = await commandOutput(
      `${consumer} canary process residue check`,
      '/bin/ps',
      ['-axo', 'pid=,command='],
    )
    const residue = processes
      .split('\n')
      .filter(
        (line) =>
          line.includes('validate-openfront-runtime-canary.mjs') ||
          line.includes('hanging-fault-build.mjs') ||
          line.includes('openfront-vite-launcher.mjs') ||
          line.includes('vite dev --host 127.0.0.1 --port 34'),
      )
    assert.deepEqual(residue, [], `${consumer} canary process residue remains`)
  })
  if (failures.length) {
    throw new AggregateError(
      failures.map((message) => new Error(message)),
      `${consumer} external post-finally verification failed`,
    )
  }
  console.log(
    `[checkpoint] ${consumer} external post-finally fingerprint/residue verification passed (${afterFingerprint})`,
  )
}

const frozenHash = fileFingerprint(canaryScript)
const frozenAggregate = aggregateFingerprint()
const acceptedHashes = acceptedHashSnapshot()
const initialMarkers = cacheMarkers()
assert.deepEqual(
  initialMarkers,
  [],
  'stale canary source-cache markers exist before checkpoint',
)
const initialFingerprint = cacheFingerprint()

async function runOne(consumer, extraEnv = {}, expectBlocked = false) {
  const beforeFingerprint = cacheFingerprint()
  assert.equal(beforeFingerprint, initialFingerprint)
  let childFailure
  try {
    await runBoundedChild(process.execPath, [canaryScript], {
      label: `Openfront ${consumer} runtime canary${expectBlocked ? ' failure probe' : ''}`,
      timeout: 900_000,
      termGrace: 1_000,
      cwd: root,
      env: {
        ...process.env,
        OPENFRONT_CANARY_CONSUMER: consumer,
        ...extraEnv,
      },
      stdio: 'inherit',
    })
  } catch (error) {
    childFailure = error
  }
  let externalFailure
  try {
    const afterHash = fileFingerprint(canaryScript)
    assert.equal(
      afterHash,
      frozenHash,
      `${consumer} changed canary source hash`,
    )
    assert.equal(
      aggregateFingerprint(),
      frozenAggregate,
      `${consumer} changed the frozen canary aggregate`,
    )
    await verifyExternalResidue(
      beforeFingerprint,
      acceptedHashes,
      consumer,
      expectBlocked,
    )
  } catch (error) {
    externalFailure = error
  }
  const failures = []
  if (expectBlocked) {
    if (!childFailure) {
      failures.push(
        new Error(`${consumer} failure probe unexpectedly exited zero`),
      )
    } else if (!/failed with code 1/.test(String(childFailure))) {
      failures.push(childFailure)
    }
  } else if (childFailure) {
    failures.push(childFailure)
  }
  if (externalFailure) failures.push(externalFailure)
  if (failures.length) {
    throw new AggregateError(
      failures,
      `${consumer} canary child/external cleanup verification failed`,
    )
  }
}

await runOne(
  'opensource.builders',
  { OPENFRONT_CANARY_FAILURE_PROBE: '1' },
  true,
)
await runOne('opensource.builders')
await runOne('os.org')

console.log(
  `Openfront two-profile frozen canary checkpoint passed at script ${frozenHash}; aggregate ${frozenAggregate}`,
)
