import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runBoundedChild } from './lib/bounded-child.mjs'

const root = process.cwd()
const probeRoot = mkdtempSync(
  path.join(os.tmpdir(), 'openfront-canary-bounds-'),
)
const hangingFixture = path.join(
  root,
  'scripts/fixtures/hanging-fault-build.mjs',
)
const descendantFixture = path.join(
  root,
  'scripts/fixtures/nonzero-descendant.mjs',
)

async function expectBoundedFailure(command, args, options, pattern) {
  await assert.rejects(runBoundedChild(command, args, options), (error) => {
    assert.match(String(error), pattern)
    return true
  })
}

try {
  await expectBoundedFailure(
    process.execPath,
    [hangingFixture],
    {
      label: 'Openfront canary hanging-child probe',
      timeout: 300,
      termGrace: 100,
      cwd: probeRoot,
      stdio: 'ignore',
    },
    /Timed out running Openfront canary hanging-child probe/,
  )
  await expectBoundedFailure(
    process.execPath,
    [descendantFixture],
    {
      label: 'Openfront canary descendant probe',
      timeout: 5_000,
      termGrace: 100,
      cwd: probeRoot,
      stdio: 'ignore',
    },
    /Openfront canary descendant probe failed with code 7/,
  )
  console.log('Openfront canary bounded timeout/descendant probes passed')
} finally {
  rmSync(probeRoot, { recursive: true, force: true })
}
