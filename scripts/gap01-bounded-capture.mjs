import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

function processGroupExists(pid) {
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

function waitForClose(child) {
  if (child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode })
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => resolve({ code, signal }))
  })
}

async function terminateProcessGroup(child, closed, { termGrace, killWait }) {
  if (!child.pid) throw new Error('GAP-01 child did not receive a process id')
  const settled = closed.catch(() => undefined)
  if (processGroupExists(child.pid)) signalProcessGroup(child.pid, 'SIGTERM')
  await Promise.race([settled, sleep(termGrace)])
  if (processGroupExists(child.pid)) signalProcessGroup(child.pid, 'SIGKILL')
  await Promise.race([
    settled,
    sleep(killWait).then(() => {
      throw new Error('GAP-01 child process group did not exit after SIGKILL')
    }),
  ])
  const deadline = Date.now() + killWait
  while (processGroupExists(child.pid) && Date.now() < deadline) await sleep(50)
  if (processGroupExists(child.pid))
    throw new Error('GAP-01 child process group remained after cleanup')
}

export class Gap01CapturedChildError extends Error {
  constructor(message, result) {
    super(message)
    this.name = 'Gap01CapturedChildError'
    this.result = result
  }
}

export async function runGap01CapturedChild(
  command,
  args,
  {
    label,
    timeout,
    termGrace = 500,
    killWait = 5_000,
    maxCapturedBytes = 4 * 1024 * 1024,
    reportPath,
    ...spawnOptions
  },
) {
  if (typeof label !== 'string' || label.length === 0)
    throw new TypeError('GAP-01 capture label must be non-empty')
  for (const [name, value, minimum] of [
    ['timeout', timeout, 1],
    ['termGrace', termGrace, 0],
    ['killWait', killWait, 1],
    ['maxCapturedBytes', maxCapturedBytes, 1],
  ])
    if (!Number.isSafeInteger(value) || value < minimum)
      throw new TypeError(
        `GAP-01 capture ${name} must be a finite safe integer`,
      )
  const base = {
    command,
    args,
    exitCode: null,
    signal: null,
    timedOut: false,
    captureOverflow: false,
    leftDescendants: false,
    quiescent: false,
    stdout: '',
    stderr: '',
  }
  const writeReport = async (result) => {
    if (reportPath) await writeFile(reportPath, JSON.stringify(result))
    return result
  }
  let child
  try {
    child = spawn(command, args, {
      ...spawnOptions,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    const result = await writeReport({
      ...base,
      spawnError: String(error),
    })
    throw new Gap01CapturedChildError(
      `${label} could not start: ${error.message}`,
      result,
    )
  }

  let capturedBytes = 0
  const capture = (stream, chunk) => {
    const remaining = Math.max(0, maxCapturedBytes - capturedBytes)
    const retained = chunk.subarray(0, remaining)
    capturedBytes += retained.length
    return {
      text: stream + retained.toString('utf8'),
      overflow: chunk.length > remaining,
    }
  }
  child.stdout.on('data', (chunk) => {
    const captured = capture(base.stdout, chunk)
    base.stdout = captured.text
    base.captureOverflow ||= captured.overflow
  })
  child.stderr.on('data', (chunk) => {
    const captured = capture(base.stderr, chunk)
    base.stderr = captured.text
    base.captureOverflow ||= captured.overflow
  })

  const closed = waitForClose(child)
  let timeoutHandle
  let outcome
  try {
    outcome = await Promise.race([
      closed.then((result) => ({ type: 'closed', result })),
      new Promise((resolve) => {
        timeoutHandle = setTimeout(() => resolve({ type: 'timeout' }), timeout)
      }),
    ])
  } catch (error) {
    clearTimeout(timeoutHandle)
    let cleanupError
    if (child?.pid) {
      try {
        await terminateProcessGroup(child, closed, { termGrace, killWait })
      } catch (error) {
        cleanupError = String(error)
      }
    }
    const result = await writeReport({
      ...base,
      spawnError: String(error),
      ...(cleanupError ? { cleanupError } : {}),
    })
    throw new Gap01CapturedChildError(
      `${label} failed while waiting for child exit: ${error.message}`,
      result,
    )
  }
  clearTimeout(timeoutHandle)

  if (outcome.type === 'timeout') {
    base.timedOut = true
    try {
      await terminateProcessGroup(child, closed, { termGrace, killWait })
    } catch (error) {
      const result = await writeReport({ ...base, cleanupError: String(error) })
      throw new Gap01CapturedChildError(
        `${label} timed out and cleanup failed: ${error.message}`,
        result,
      )
    }
    const result = await closed
    base.exitCode = result.code
    base.signal = result.signal
  } else {
    base.exitCode = outcome.result.code
    base.signal = outcome.result.signal
    try {
      if (child.pid && processGroupExists(child.pid)) {
        base.leftDescendants = true
        await terminateProcessGroup(child, closed, { termGrace, killWait })
      }
      base.quiescent = true
    } catch (error) {
      const result = await writeReport({ ...base, cleanupError: String(error) })
      throw new Gap01CapturedChildError(
        `${label} exited but cleanup failed: ${error.message}`,
        result,
      )
    }
  }
  base.quiescent = true
  if (base.leftDescendants) {
    const result = await writeReport(base)
    throw new Gap01CapturedChildError(
      `${label} exited but left descendants requiring cleanup`,
      result,
    )
  }
  return await writeReport(base)
}
