import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { runBoundedChild } from '../scripts/lib/bounded-child.mjs'

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

function processExists(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false
    throw error
  }
}

describe('bounded child output capture', () => {
  it('returns bounded stdout and stderr', async () => {
    const result = await runBoundedChild(
      process.execPath,
      ['-e', "process.stdout.write('out'); process.stderr.write('err')"],
      {
        label: 'bounded output fixture',
        timeout: 5_000,
        captureOutput: true,
        maxCapturedBytes: 16,
      },
    )

    expect(result.stdout).toBe('out')
    expect(result.stderr).toBe('err')
  })

  it('rejects output beyond the configured shared byte limit', async () => {
    await expect(
      runBoundedChild(
        process.execPath,
        ['-e', "process.stdout.write('x'.repeat(64))"],
        {
          label: 'captured output overflow fixture',
          timeout: 5_000,
          captureOutput: true,
          maxCapturedBytes: 16,
        },
      ),
    ).rejects.toThrow(
      'captured output overflow fixture exceeded the 16-byte captured-output limit',
    )
  })

  it('validates capture options before creating a child process', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'bounded-invalid-'))
    const marker = path.join(directory, 'spawned')
    try {
      await expect(
        runBoundedChild(
          process.execPath,
          [
            '-e',
            `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'spawned'); setInterval(() => {}, 1000)`,
          ],
          {
            label: 'invalid captured output fixture',
            timeout: 5_000,
            captureOutput: true,
            maxCapturedBytes: 0,
          },
        ),
      ).rejects.toThrow('maxCapturedBytes must be a positive safe integer')
      await sleep(100)
      await expect(access(marker)).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('terminates and rejects successful leaders that leave descendants', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'bounded-success-'))
    const marker = path.join(directory, 'descendant-pid')
    const descendant =
      "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"
    const leader = `
      const { spawn } = require('node:child_process');
      const { writeFileSync } = require('node:fs');
      const child = spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], { stdio: 'ignore' });
      writeFileSync(${JSON.stringify(marker)}, String(child.pid));
      setTimeout(() => process.exit(0), 100);
    `
    try {
      await expect(
        runBoundedChild(process.execPath, ['-e', leader], {
          label: 'successful descendant fixture',
          timeout: 5_000,
          termGrace: 100,
          stdio: 'ignore',
        }),
      ).rejects.toThrow(
        'successful descendant fixture exited successfully but left a surviving process-group descendant',
      )
      const descendantPid = Number(await readFile(marker, 'utf8'))
      expect(processExists(descendantPid)).toBe(false)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
