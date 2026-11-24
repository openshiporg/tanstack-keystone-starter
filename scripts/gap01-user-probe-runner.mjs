import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'

const [argvJson, cwd, reportPath] = process.argv.slice(2)
if (!argvJson || !cwd || !reportPath)
  throw new Error('usage: runner <argv-json> <fixture> <report>')
const argv = JSON.parse(argvJson)
if (
  !Array.isArray(argv) ||
  argv.length === 0 ||
  argv.some((value) => typeof value !== 'string' || value.length === 0)
)
  throw new Error('probe argv must be a non-empty string array')
const maxCapturedBytes = 1024 * 1024
let capturedBytes = 0
let captureOverflow = false
let stdout = ''
let stderr = ''
function retain(target, chunk) {
  const text = chunk.toString()
  const remaining = Math.max(0, maxCapturedBytes - capturedBytes)
  if (Buffer.byteLength(text) > remaining) captureOverflow = true
  const retained = Buffer.from(text).subarray(0, remaining).toString('utf8')
  capturedBytes += Buffer.byteLength(retained)
  return target + retained
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let child
try {
  child = spawn(argv[0], argv.slice(1), {
    cwd,
    env: process.env,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (chunk) => {
    stdout = retain(stdout, chunk)
  })
  child.stderr.on('data', (chunk) => {
    stderr = retain(stderr, chunk)
  })
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => resolve({ code, signal }))
  })
  let timeoutHandle
  const timeout = new Promise((resolve) => {
    timeoutHandle = setTimeout(
      () => resolve({ timedOut: true }),
      Number(process.env.GAP01_USER_REPRO_TIMEOUT_MS ?? 120_000),
    )
  })
  let result = await Promise.race([closed, timeout]).finally(() =>
    clearTimeout(timeoutHandle),
  )
  clearTimeout(timeoutHandle)
  const timedOut = result.timedOut === true
  if (timedOut) {
    child.kill('SIGTERM')
    const termResult = await Promise.race([
      closed,
      sleep(2_000).then(() => null),
    ])
    if (termResult) result = termResult
    else {
      child.kill('SIGKILL')
      const killResult = await Promise.race([
        closed,
        sleep(2_000).then(() => null),
      ])
      result = killResult ?? {
        code: null,
        signal: null,
        terminationPending: true,
      }
    }
    clearTimeout(timeoutHandle)
  }
  await writeFile(
    reportPath,
    JSON.stringify({
      exitCode: result.code,
      signal: result.signal,
      timedOut,
      terminationPending: result.terminationPending === true,
      stdout,
      stderr,
      captureOverflow,
      maxCapturedBytes,
    }),
  )
} catch (error) {
  if (child && !child.killed) {
    try {
      child.kill('SIGTERM')
    } catch {}
    await sleep(100)
    if (!child.killed) {
      try {
        child.kill('SIGKILL')
      } catch {}
    }
  }
  await writeFile(
    reportPath,
    JSON.stringify({
      exitCode: null,
      signal: null,
      timedOut: false,
      terminationPending: false,
      stdout,
      stderr,
      captureOverflow,
      spawnError: String(error),
      maxCapturedBytes,
    }),
  )
  process.exitCode = 1
}
