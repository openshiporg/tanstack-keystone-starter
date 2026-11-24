import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import os from 'node:os'

import { runBoundedChild } from './lib/bounded-child.mjs'

async function temporaryFirefoxProfiles() {
  return (await readdir(os.tmpdir()))
    .filter((entry) => entry.startsWith('tks-firefox-'))
    .sort()
}

const originalProbe = process.env.DASHBOARD_BROWSER_FIREFOX_LAUNCHER_PROBE
const profilesBefore = await temporaryFirefoxProfiles()
let observedFailure

try {
  process.env.DASHBOARD_BROWSER_FIREFOX_LAUNCHER_PROBE = '1'
  try {
    await import(`./validate-dashboard-browser.mjs?launcher=${Date.now()}`)
  } catch (error) {
    observedFailure = error
  }
} finally {
  if (originalProbe === undefined) {
    delete process.env.DASHBOARD_BROWSER_FIREFOX_LAUNCHER_PROBE
  } else {
    process.env.DASHBOARD_BROWSER_FIREFOX_LAUNCHER_PROBE = originalProbe
  }
}

assert.ok(observedFailure, 'Firefox launcher probe unexpectedly succeeded')
assert.match(String(observedFailure), /Firefox exited early/)
assert.deepEqual(
  await temporaryFirefoxProfiles(),
  profilesBefore,
  'Firefox launcher probe left a temporary profile',
)
const { stdout } = await runBoundedChild('/bin/ps', ['-axo', 'command='], {
  label: 'escaped Firefox fixture absence check',
  timeout: 5_000,
  captureOutput: true,
  maxCapturedBytes: 4 * 1024 * 1024,
})
assert.doesNotMatch(stdout, /[f]irefox-launcher-exit\.mjs/)
console.log(
  'Firefox launcher-exit cleanup probe passed: escaped profile process terminated and profile removed.',
)
