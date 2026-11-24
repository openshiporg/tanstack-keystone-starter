import { spawn } from 'node:child_process'

const [command, ...args] = process.argv.slice(2)
if (!command) throw new Error('bounded command wrapper requires a command')

const child = spawn(command, args, {
  cwd: process.cwd(),
  env: process.env,
  detached: false,
  stdio: ['ignore', 'pipe', 'pipe'],
})

child.stdout.on('data', (chunk) => process.stdout.write(chunk))
child.stderr.on('data', (chunk) => process.stderr.write(chunk))
child.on('error', (error) => {
  process.stderr.write(
    `\n[os-org-command-result]${JSON.stringify({
      code: null,
      signal: null,
      spawnError: error.message,
    })}\n`,
  )
})
child.on('close', (code, signal) => {
  process.stderr.write(
    `\n[os-org-command-result]${JSON.stringify({ code, signal })}\n`,
  )
})
