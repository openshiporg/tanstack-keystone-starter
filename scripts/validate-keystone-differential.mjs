import assert from 'node:assert/strict'
import { execFile, execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const oracleRoot = await mkdtemp(path.join(os.tmpdir(), 'tks-keystone-oracle-'))

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
  assert(line, `differential worker emitted no JSON:\n${output}`)
  return JSON.parse(line)
}

try {
  await writeFile(
    path.join(oracleRoot, 'package.json'),
    JSON.stringify({
      private: true,
      dependencies: {
        '@keystone-6/core': '6.5.1',
        '@keystone-6/auth': '8.1.0',
        '@keystone-6/fields-document': '9.1.1',
        '@keystone-6/document-renderer': '1.1.2',
        '@prisma/client': '5.22.0',
        prisma: '5.22.0',
      },
    }),
  )
  await writeFile(
    path.join(oracleRoot, 'keystone.ts'),
    `import { config, list } from '@keystone-6/core'
import { text, relationship } from '@keystone-6/core/fields'
import { allowAll } from '@keystone-6/core/access'
export default config({ db:{provider:'sqlite',url:'file:./oracle.db'}, ui:{isDisabled:true}, lists:{
Person:list({access:{operation:{query:({session})=>!!session,create:allowAll,update:allowAll,delete:allowAll},filter:{query:({session})=>session?.data?.scope==='self'?{id:{equals:session.itemId}}:true}},fields:{name:text(),teams:relationship({ref:'Team.people',many:true})}}),
Team:list({access:{operation:{query:allowAll,create:allowAll,update:allowAll,delete:allowAll}},fields:{name:text(),people:relationship({ref:'Person.teams',many:true})}}),
Probe:list({access:{operation:{query:allowAll,create:({session})=>{if(session?.data?.access==='throw')throw new Error('access exploded');if(session?.data?.access==='invalid')return 'invalid';return true},update:allowAll,delete:allowAll}},hooks:{resolveInput:({resolvedData})=>{globalThis.__probeEvents?.push('list:resolve:'+resolvedData.label);return resolvedData},validateInput:({resolvedData,addValidationError})=>{globalThis.__probeEvents?.push('list:validate:'+resolvedData.label);if(resolvedData.label==='validate-bad')addValidationError('validation exploded')},beforeOperation:({resolvedData})=>{globalThis.__probeEvents?.push('list:before:'+resolvedData.label);if(resolvedData.label==='before-bad')throw new Error('before exploded')},afterOperation:({item})=>{globalThis.__probeEvents?.push('list:after:'+item.label);if(item.label==='after-bad')throw new Error('after exploded')}},fields:{label:text({hooks:{resolveInput:({resolvedData})=>{globalThis.__probeEvents?.push('field:resolve:'+resolvedData.label);return resolvedData.label},validateInput:({resolvedData})=>globalThis.__probeEvents?.push('field:validate:'+resolvedData.label),beforeOperation:({resolvedData})=>globalThis.__probeEvents?.push('field:before:'+resolvedData.label),afterOperation:({item})=>globalThis.__probeEvents?.push('field:after:'+item.label)}})}})
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
      [path.join(root, 'scripts/fixtures/keystone-differential-oracle.cjs')],
      {
        cwd: oracleRoot,
        env: { ...env, KEYSTONE_DIFFERENTIAL_ORACLE_ROOT: oracleRoot },
      },
    ),
  )
  const local = lastJson(
    await run(
      'npx',
      [
        '--no-install',
        'tsx',
        'scripts/fixtures/keystone-differential-local.ts',
      ],
      {
        cwd: root,
        env: { NODE_ENV: 'test', CMS_ADAPTER: 'memory' },
      },
    ),
  )
  const { reconciliation: localReconciliation, ...localBaseline } = local
  const { reconciliation: oracleReconciliation, ...oracleBaseline } = oracle
  assert.deepEqual(localBaseline, oracleBaseline)
  assert.deepEqual(
    localReconciliation.accessThrow,
    oracleReconciliation.accessThrow,
  )
  assert.deepEqual(
    localReconciliation.accessInvalid,
    oracleReconciliation.accessInvalid,
  )
  assert.deepEqual(
    localReconciliation.manyErrors,
    oracleReconciliation.manyErrors,
  )
  assert.deepEqual(localReconciliation.manyData, oracleReconciliation.manyData)
  assert.deepEqual(oracleReconciliation.persisted, ['after-bad', 'good'])
  assert.deepEqual(localReconciliation.persisted, ['good'])
  for (const events of [
    oracleReconciliation.hookEvents,
    localReconciliation.hookEvents,
  ]) {
    for (const phase of [
      'field:resolve:good',
      'list:resolve:good',
      'field:validate:good',
      'list:validate:good',
      'field:before:good',
      'list:before:good',
      'field:after:good',
      'list:after:good',
    ])
      assert(events.includes(phase))
  }
  assert(
    oracleReconciliation.hookEvents.indexOf('field:resolve:before-bad') <
      oracleReconciliation.hookEvents.indexOf('list:resolve:good'),
  )
  assert(
    localReconciliation.hookEvents.indexOf('list:after:good') <
      localReconciliation.hookEvents.indexOf('field:resolve:before-bad'),
  )
  console.log(
    JSON.stringify({
      status: 'passed',
      versions: {
        core: '6.5.1',
        auth: '8.1.0',
        fieldsDocument: '9.1.1',
        documentRenderer: '1.1.2',
      },
      cases: [
        'read-denial',
        'nested-related-list-access-and-count',
        'cursor-skip-zero',
        'scalar-and-relationship-filters',
        'logical-filters-and-ordering',
        'take-skip-and-cursor-skip',
        'inaccessible-cursor',
        'context-query-and-db',
        'access-callback-throw-and-invalid-return',
        'all-hook-phases-order-and-error-paths',
        'many-mutation-errors-and-persisted-state',
      ],
    }),
  )
} finally {
  await rm(oracleRoot, { recursive: true, force: true })
}
