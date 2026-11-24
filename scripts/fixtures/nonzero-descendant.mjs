import { spawn } from 'node:child_process'

if (process.argv[2] === 'descendant') {
  process.on('SIGTERM', () => {})
  setInterval(() => {}, 1_000)
} else {
  spawn(process.execPath, [import.meta.filename, 'descendant'], {
    stdio: 'ignore',
  })
  setTimeout(() => process.exit(7), 100)
}
