import { spawn } from 'node:child_process'

const marker = process.argv[2] ?? 'gap01-successful-descendant'
const child = spawn(
  process.execPath,
  ['-e', `process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)`],
  {
    env: { ...process.env, GAP01_SUCCESSFUL_DESCENDANT_MARKER: marker },
    stdio: 'ignore',
  },
)
child.unref()
console.log(`GAP01_SUCCESSFUL_DESCENDANT_MARKER=${marker}`)
