import { spawn } from 'node:child_process'

const marker = process.argv[2] ?? 'gap01-stubborn'
const child = spawn(
  process.execPath,
  ['-e', `process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)`],
  {
    env: { ...process.env, GAP01_STUBBORN_MARKER: marker },
    stdio: 'ignore',
  },
)
process.on('SIGTERM', () => {})
process.stdout.write(`GAP01_STUBBORN_MARKER=${marker} child=${child.pid}\n`)
setInterval(() => {}, 1000)
