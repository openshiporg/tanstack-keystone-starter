import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const profileIndex = process.argv.indexOf('--profile')
const profileDirectory =
  profileIndex >= 0 ? process.argv[profileIndex + 1] : undefined

if (!profileDirectory) {
  throw new Error('Firefox launcher cleanup fixture requires --profile')
}

if (process.argv.includes('--escaped-profile-process')) {
  process.on('SIGTERM', () => {})
  setInterval(() => {
    mkdirSync(profileDirectory, { recursive: true })
    writeFileSync(
      path.join(profileDirectory, 'escaped-launcher-marker'),
      'alive',
    )
  }, 25)
} else {
  spawn(
    process.execPath,
    [
      import.meta.filename,
      '--escaped-profile-process',
      '--profile',
      profileDirectory,
    ],
    { detached: true, stdio: 'ignore' },
  ).unref()
}
