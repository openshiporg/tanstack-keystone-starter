import { spawn } from 'node:child_process'
import path from 'node:path'

const [command, ...args] = process.argv.slice(2)
if (!command) throw new Error('Vite launcher requires a command')

const child = spawn(command, args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: false,
})
let failureProbeStarted = false

function startFailureProbe() {
  if (
    failureProbeStarted ||
    process.env.OPENFRONT_CANARY_FAILURE_PROBE !== '1'
  ) {
    return
  }
  failureProbeStarted = true
  const probe = spawn(
    process.execPath,
    [path.resolve('scripts/fixtures/hanging-fault-build.mjs')],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'ignore',
      detached: false,
    },
  )
  probe.unref()
  process.stdout.write(
    `[canary-launcher] stubborn Vite-group descendant ${probe.pid}\n`,
  )
}

child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk)
  if (chunk.toString().includes('Local:')) startFailureProbe()
})
child.stderr.on('data', (chunk) => process.stderr.write(chunk))

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    if (child.exitCode === null) child.kill(signal)
  })
}

child.on('error', (error) => {
  console.error(error)
  process.exitCode = 1
})
child.on('close', (code) => {
  process.exitCode = code ?? 1
})
