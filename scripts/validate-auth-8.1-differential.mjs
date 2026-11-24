import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const temp = await mkdtemp(path.join(os.tmpdir(), 'tks-auth-8.1-oracle-'))
async function run(command, args, { cwd = root, env = {} } = {}) {
  const r = await execFileAsync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
  })
  return `${r.stdout ?? ''}${r.stderr ?? ''}`
}
function json(output) {
  const line = output
    .trim()
    .split(/\r?\n/)
    .findLast((x) => x.startsWith('{'))
  assert(line, output)
  return JSON.parse(line)
}
function normalise(value) {
  const copy = structuredClone(value)
  for (const key of ['passwordSuccess', 'magicSuccess']) {
    const item = copy.outcomes[key]?.data
    const result = item && Object.values(item)[0]
    if (result?.sessionToken) result.sessionToken = '[SESSION]'
    if (result?.token) result.token = '[SESSION]'
  }
  for (const event of copy.callbacks) delete event.context.same
  return copy
}
try {
  await writeFile(
    path.join(temp, 'package.json'),
    JSON.stringify({
      private: true,
      dependencies: {
        '@keystone-6/core':
          'file:/private/tmp/tanstack-keystone-parity-packages/keystone-6-core-6.5.1.tgz',
        '@keystone-6/auth':
          'file:/private/tmp/tanstack-keystone-parity-packages/keystone-6-auth-8.1.0.tgz',
        '@prisma/client': '5.22.0',
        prisma: '5.22.0',
      },
    }),
  )
  const keystonePackage = '@keystone-6/'
  await writeFile(
    path.join(temp, 'keystone.ts'),
    `import { config, list } from '${keystonePackage}core'
import { text, password } from '${keystonePackage}core/fields'
import { statelessSessions } from '${keystonePackage}core/session'
import { allowAll } from '${keystonePackage}core/access'
import { createAuth } from '${keystonePackage}auth'
const { withAuth }=createAuth({listKey:'Account',identityField:'handle',secretField:'credential',sessionData:'id handle',magicAuthLink:{tokensValidForMins:1,sendToken(args){globalThis.__authEvents.push({kind:'magic',...args})}},passwordResetLink:{tokensValidForMins:1,sendToken(args){globalThis.__authEvents.push({kind:'reset',...args})}},initFirstItem:{fields:['handle','credential'],skipKeystoneWelcome:true}})
export default withAuth(config({db:{provider:'sqlite',url:'file:./oracle.db'},ui:{isDisabled:true},session:statelessSessions({secret:'auth-oracle-secret-at-least-thirty-two-characters'}),lists:{Account:list({access:{operation:{query:allowAll,create:allowAll,update:allowAll,delete:allowAll}},fields:{handle:text({validation:{isRequired:true},isIndexed:'unique'}),credential:password()}})}}))`,
  )
  await run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: temp,
  })
  await run('npx', ['keystone', 'build'], { cwd: temp })
  const env = { AUTH_ORACLE_ROOT: temp, DATABASE_URL: 'file:./oracle.db' }
  await run('npx', ['prisma', 'db', 'push', '--schema', 'schema.prisma'], {
    cwd: temp,
    env,
  })
  await run('npx', ['prisma', 'generate', '--schema', 'schema.prisma'], {
    cwd: temp,
    env,
  })
  const oracle = json(
    await run(
      process.execPath,
      [path.join(root, 'scripts/fixtures/auth-8.1-oracle.cjs')],
      { cwd: temp, env },
    ),
  )
  const local = json(
    await run(
      'npx',
      ['--no-install', 'tsx', 'scripts/fixtures/auth-8.1-local.ts'],
      { cwd: root, env: { NODE_ENV: 'test', CMS_ADAPTER: 'memory' } },
    ),
  )
  assert.deepEqual(normalise(local), normalise(oracle))
  // Executable startup validation on both implementations.
  await writeFile(
    path.join(temp, 'keystone.ts'),
    (await readFile(path.join(temp, 'keystone.ts'), 'utf8')).replace(
      "sessionData:'id handle'",
      "sessionData:'notAField'",
    ),
  )
  let oracleStartup = ''
  try {
    await run('npx', ['keystone', 'build'], { cwd: temp })
  } catch (error) {
    oracleStartup = `${error.stdout ?? ''}${error.stderr ?? ''}`
  }
  assert.match(oracleStartup, /sessionData option.*incorrect/s)
  const localStartup = await run(
    'npx',
    [
      '--no-install',
      'tsx',
      '-e',
      `import { config, initialiseLists } from './src/features/cms/config'; import { createAuth } from './src/features/cms/keystone/auth'; import { text,password } from './src/features/cms/keystone/fields'; import { addAuthGraphQLSchema } from './src/features/cms/auth/graphql'; import { generateCmsTypeDefsForLists,generateCmsResolversForLists } from './src/features/cms/runtime'; import { makeExecutableSchema } from '@graphql-tools/schema'; const c=createAuth({listKey:'Account',identityField:'handle',secretField:'credential',sessionData:'notAField'}).withAuth(config({lists:{Account:{fields:{handle:text({validation:{isRequired:true},isIndexed:'unique'}),credential:password()}}},session:{get:async()=>undefined,start:async()=>'',end:async()=>{}}}));const l=initialiseLists(c);try{addAuthGraphQLSchema(makeExecutableSchema({typeDefs:generateCmsTypeDefsForLists(l),resolvers:generateCmsResolversForLists(l)}),l,c.auth)}catch(e){console.log(e.constructor.name+':'+e.message)}`,
    ],
    { cwd: root },
  )
  assert.match(localStartup, /Error:.*sessionData option.*incorrect/s)
  assert(
    local.callbacks.every((event) => event.context.hasSudo),
    'local callbacks did not receive runtime context',
  )
  console.log(
    JSON.stringify({
      status: 'passed',
      oracle: { auth: '8.1.0', core: '6.5.1', root: temp },
      compared: [
        'schema names/nullability and injected token fields',
        'password unions',
        'magic request/redeem/failure/expiry/replay/malformed',
        'reset request/validate/redeem/expiry/replay/malformed',
        'callback payload/context',
        'arbitrary auth names',
        'startup sessionData validation',
        'skipKeystoneWelcome generated behavior',
      ],
    }),
  )
} finally {
  await rm(temp, { recursive: true, force: true })
}
