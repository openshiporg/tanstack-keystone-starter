import assert from 'node:assert/strict'
import { execFile, execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const oracleRoot = await mkdtemp(
  path.join(os.tmpdir(), 'tks-structure-oracle-'),
)

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
  })
  return `${result.stdout ?? ''}${result.stderr ?? ''}`
}

function lastJson(output) {
  const line = output
    .trim()
    .split(/\r?\n/)
    .findLast((entry) => entry.startsWith('{'))
  assert(line, `structure worker emitted no JSON:\n${output}`)
  return JSON.parse(line)
}

try {
  await writeFile(
    path.join(oracleRoot, 'package.json'),
    JSON.stringify({
      private: true,
      dependencies: {
        '@keystone-6/core': '6.5.1',
        '@keystone-6/fields-document': '9.1.1',
        '@prisma/client': '5.22.0',
        prisma: '5.22.0',
      },
    }),
  )
  await writeFile(
    path.join(oracleRoot, 'keystone.ts'),
    `import { config, list } from '@keystone-6/core'
import { text } from '@keystone-6/core/fields'
import { allowAll } from '@keystone-6/core/access'
import { structure } from '@keystone-6/fields-document'
import { fields } from '@keystone-6/fields-document/component-blocks'
const schema = fields.object({
  title: fields.text({ label: 'Title', defaultValue: 'Untitled' }),
  count: fields.integer({ label: 'Count', defaultValue: 1 }),
  author: fields.relationship({ listKey: 'Person', label: 'Author', selection: 'name' }),
  reviewers: fields.relationship({ listKey: 'Person', label: 'Reviewers', selection: 'name', many: true }),
  tags: fields.array(fields.text({ label: 'Tag', defaultValue: '' })),
  mode: fields.conditional(
    fields.select({ label: 'Mode', options: [{ label: 'Plain', value: 'plain' }, { label: 'Featured', value: 'featured' }], defaultValue: 'plain' }),
    { plain: fields.text({ label: 'Normal', defaultValue: 'Normal' }), featured: fields.object({ emphasis: fields.checkbox({ label: 'Emphasis', defaultValue: false }) }) }
  ),
})
export default config({ db: { provider: 'sqlite', url: 'file:./oracle.db' }, ui: { isDisabled: true }, lists: {
  Person: list({ access: allowAll, fields: { name: text() } }),
  Page: list({ access: allowAll, fields: { settings: structure({ schema, db: { map: 'settings_json' } }) } }),
} })
`,
  )
  execFileSync(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund'],
    {
      cwd: oracleRoot,
      stdio: 'ignore',
      maxBuffer: 40 * 1024 * 1024,
    },
  )
  await run('npx', ['keystone', 'build'], { cwd: oracleRoot })
  const env = {
    DATABASE_URL: 'file:./oracle.db',
    SHADOW_DATABASE_URL: 'file:./shadow.db',
  }
  await run('npx', ['prisma', 'db', 'push', '--schema', 'schema.prisma'], {
    cwd: oracleRoot,
    env,
  })
  await run('npx', ['prisma', 'generate', '--schema', 'schema.prisma'], {
    cwd: oracleRoot,
    env,
  })
  const oracle = lastJson(
    await run(
      process.execPath,
      [
        path.join(
          root,
          'scripts/fixtures/fields-document-structure-oracle.cjs',
        ),
      ],
      {
        cwd: oracleRoot,
        env: { ...env, KEYSTONE_STRUCTURE_ORACLE_ROOT: oracleRoot },
      },
    ),
  )
  const local = lastJson(
    await run(
      'npx',
      [
        '--no-install',
        'tsx',
        'scripts/validate-fields-document-structure-local.ts',
      ],
      {
        cwd: root,
        env: { NODE_ENV: 'test', CMS_ADAPTER: 'memory' },
      },
    ),
  )
  assert.deepEqual(local, oracle)
  console.log(
    JSON.stringify({
      status: 'passed',
      oracle: '@keystone-6/fields-document@9.1.1',
      cases: [
        'public-structure-export',
        'schema-and-input-output-names',
        'recursive-defaults',
        'form-object-array-conditional',
        'to-one-and-to-many-relationships',
        'raw-and-hydrated-json',
        'partial-update-preservation',
      ],
    }),
  )
} finally {
  await rm(oracleRoot, { recursive: true, force: true })
}
