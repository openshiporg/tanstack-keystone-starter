import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

const worker = `
  import { getCmsAdapter } from './src/features/cms/adapters/index.ts'
  try {
    const adapter = await getCmsAdapter()
    console.log('ADAPTER:' + adapter.kind)
  } catch (error) {
    console.error('ERROR:' + (error instanceof Error ? error.message : String(error)))
    process.exitCode = 42
  }
`

const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--input-type=module', '--eval', worker],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      CMS_ADAPTER: '',
      DATABASE_URL: '',
    },
    encoding: 'utf8',
  },
)
assert.equal(result.status, 42, 'production without persistence should fail')
assert.match(
  result.stderr,
  /CMS persistence is not configured/,
  'production failure should explain how to configure persistence',
)
assert.doesNotMatch(result.stdout, /ADAPTER:memory/)
console.log('Production adapter fail-closed validation passed.')
