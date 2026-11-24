import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { createCmsPrismaClient } from '../src/features/cms/prisma-client'

const execFileAsync = promisify(execFile)
const container = `tks-prisma-mysql-${process.pid}-${Date.now()}`
const tempRoot = path.join(process.cwd(), '.cms-temp')
await mkdir(tempRoot, { recursive: true })
const temp = await mkdtemp(path.join(tempRoot, 'prisma-mysql-'))
let started = false

type GeneratedClient = {
  $queryRawUnsafe: (query: string) => Promise<unknown>
  $executeRawUnsafe: (query: string) => Promise<number>
  $disconnect: () => Promise<void>
  dispatchThing: {
    create: (args: {
      data: { id: string; label: string }
    }) => Promise<{ id: string; label: string }>
    findUnique: (args: {
      where: { id: string }
    }) => Promise<{ id: string; label: string } | null>
  }
}
type GeneratedModule = {
  PrismaClient: new (options: { adapter: never }) => GeneratedClient
}

async function docker(args: string[], timeout = 300_000) {
  return execFileAsync('docker', args, { timeout, maxBuffer: 10 * 1024 * 1024 })
}

try {
  await writeFile(
    path.join(temp, 'schema.prisma'),
    `generator client {
  provider = "prisma-client"
  output = "./client"
}

datasource db {
  provider = "mysql"
}

model DispatchThing {
  id String @id @db.VarChar(191)
  label String @db.VarChar(191)
}
`,
  )
  await writeFile(
    path.join(temp, 'prisma.config.ts'),
    `import { defineConfig } from 'prisma/config'\nexport default defineConfig({ schema: 'schema.prisma', datasource: { url: 'mysql://root:root-password@127.0.0.1:3306/cms' } })\n`,
  )
  await execFileAsync(
    'npx',
    [
      '--no-install',
      'prisma',
      'generate',
      '--config',
      path.join(temp, 'prisma.config.ts'),
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, PRISMA_GENERATE_SKIP_AUTOINSTALL: '1' },
      timeout: 300_000,
      maxBuffer: 20 * 1024 * 1024,
    },
  )
  await docker(
    [
      'run',
      '--rm',
      '-d',
      '--name',
      container,
      '-e',
      'MARIADB_ROOT_PASSWORD=root-password',
      '-e',
      'MARIADB_DATABASE=cms',
      '-p',
      '127.0.0.1::3306',
      'mariadb:11',
    ],
    600_000,
  )
  started = true
  const portOutput = await docker(['port', container, '3306/tcp'])
  const port = portOutput.stdout.trim().match(/:(\d+)$/)?.[1]
  assert(
    port,
    `could not determine disposable MariaDB port: ${portOutput.stdout}`,
  )
  const url = `mysql://root:root-password@127.0.0.1:${port}/cms`
  const module = (await import(
    pathToFileURL(path.join(temp, 'client', 'client.ts')).href
  )) as GeneratedModule
  const prisma = createCmsPrismaClient<GeneratedClient>({
    provider: 'mysql',
    url,
    Client: module.PrismaClient,
  })
  try {
    let connected = false
    let lastError: unknown
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        await prisma.$queryRawUnsafe('SELECT 1')
        connected = true
        break
      } catch (error) {
        lastError = error
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
    if (!connected) throw lastError
    await prisma.$executeRawUnsafe(
      'CREATE TABLE `DispatchThing` (`id` VARCHAR(191) NOT NULL, `label` VARCHAR(191) NOT NULL, PRIMARY KEY (`id`))',
    )
    await prisma.dispatchThing.create({
      data: { id: 'mysql-live', label: 'MariaDB adapter' },
    })
    assert.deepEqual(
      await prisma.dispatchThing.findUnique({ where: { id: 'mysql-live' } }),
      {
        id: 'mysql-live',
        label: 'MariaDB adapter',
      },
    )
  } finally {
    await prisma.$disconnect()
  }
  console.info('Disposable live Prisma 7 MySQL/MariaDB driver dispatch passed.')
} finally {
  if (started)
    await docker(['rm', '-f', container], 60_000).catch(() => undefined)
  await rm(temp, { recursive: true, force: true })
}
