import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

async function waitFor(check, description, timeout) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await check()) return
    await sleep(50)
  }
  throw new Error(`Timed out waiting for ${description}`)
}

function waitForChildClose(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode })
  }
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => resolve({ code, signal }))
  })
}

export function processGroupExists(pid) {
  try {
    process.kill(-pid, 0)
    return true
  } catch (error) {
    if (error?.code === 'ESRCH') return false
    if (error?.code === 'EPERM') return true
    throw error
  }
}

function signalProcessGroup(pid, signal) {
  try {
    process.kill(-pid, signal)
  } catch (error) {
    if (error?.code !== 'ESRCH' && error?.code !== 'EPERM') throw error
  }
}

export async function terminateChildGroup(
  child,
  label,
  { termGrace = 500, killWait = 5_000 } = {},
) {
  assert.ok(child.pid, `${label} did not receive a process id`)
  const closed = waitForChildClose(child)
  if (processGroupExists(child.pid)) signalProcessGroup(child.pid, 'SIGTERM')
  await Promise.race([closed, sleep(termGrace)])
  if (processGroupExists(child.pid)) signalProcessGroup(child.pid, 'SIGKILL')
  await Promise.race([
    closed,
    waitFor(
      () => !processGroupExists(child.pid),
      `${label} process group cleanup after SIGKILL`,
      killWait,
    ),
  ])
  await waitFor(
    () => !processGroupExists(child.pid),
    `${label} process group cleanup`,
    killWait,
  )
}

export async function runBoundedChild(command, args, options) {
  const {
    label,
    timeout,
    termGrace,
    captureOutput = false,
    maxCapturedBytes = 64 * 1024,
    ...spawnOptions
  } = options
  assert.equal(typeof label, 'string', 'label must be a string')
  assert.ok(label.length > 0, 'label must not be empty')
  assert.ok(
    Number.isSafeInteger(timeout) && timeout > 0,
    'timeout must be a positive safe integer',
  )
  if (termGrace !== undefined) {
    assert.ok(
      Number.isSafeInteger(termGrace) && termGrace >= 0,
      'termGrace must be a non-negative safe integer',
    )
  }
  if (captureOutput) {
    assert.ok(
      Number.isSafeInteger(maxCapturedBytes) && maxCapturedBytes > 0,
      'maxCapturedBytes must be a positive safe integer',
    )
  }

  const child = spawn(command, args, {
    ...spawnOptions,
    ...(captureOutput ? { stdio: ['ignore', 'pipe', 'pipe'] } : {}),
    detached: true,
  })
  const stdoutChunks = []
  const stderrChunks = []
  let capturedBytes = 0
  let captureOverflow = false
  function captureChunk(chunks, chunk) {
    const remaining = Math.max(0, maxCapturedBytes - capturedBytes)
    if (chunk.length > remaining) captureOverflow = true
    if (remaining > 0) chunks.push(chunk.subarray(0, remaining))
    capturedBytes += Math.min(chunk.length, remaining)
  }
  if (captureOutput) {
    child.stdout.on('data', (chunk) => captureChunk(stdoutChunks, chunk))
    child.stderr.on('data', (chunk) => captureChunk(stderrChunks, chunk))
  }
  const closed = waitForChildClose(child)
  let timeoutHandle
  const outcome = await Promise.race([
    closed.then((result) => ({ type: 'closed', result })),
    new Promise((resolve) => {
      timeoutHandle = setTimeout(() => resolve({ type: 'timeout' }), timeout)
    }),
  ]).catch(async (error) => {
    clearTimeout(timeoutHandle)
    if (child.pid) await terminateChildGroup(child, label, { termGrace })
    throw error
  })
  clearTimeout(timeoutHandle)

  if (outcome.type === 'timeout') {
    await terminateChildGroup(child, label, { termGrace })
    throw new Error(
      `Timed out running ${label}; TERM/KILL escalation completed and its process group exited`,
    )
  }
  if (outcome.result.code !== 0) {
    if (child.pid && processGroupExists(child.pid)) {
      await terminateChildGroup(child, `${label} descendants`, { termGrace })
    }
    throw new Error(
      `${label} failed with code ${outcome.result.code} and signal ${outcome.result.signal}`,
    )
  }
  if (child.pid && processGroupExists(child.pid)) {
    try {
      await waitFor(
        () => !processGroupExists(child.pid),
        `${label} successful process-group quiescence`,
        termGrace ?? 500,
      )
    } catch {
      await terminateChildGroup(child, `${label} successful descendants`, {
        termGrace,
      })
      throw new Error(
        `${label} exited successfully but left a surviving process-group descendant`,
      )
    }
  }
  if (captureOverflow) {
    throw new Error(
      `${label} exceeded the ${maxCapturedBytes}-byte captured-output limit`,
    )
  }
  return captureOutput
    ? {
        child,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      }
    : child
}
