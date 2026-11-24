import assert from 'node:assert/strict'

import { createCmsPrismaDriverAdapter } from '../src/features/cms/prisma-client'
import type { CmsPrismaProvider } from '../src/features/cms/prisma-client'

const cases: Array<{
  provider?: CmsPrismaProvider
  url: string
  expected: 'postgres' | 'sqlite' | 'mysql'
}> = [
  {
    provider: 'postgresql',
    url: 'postgresql://user:pass@localhost/db',
    expected: 'postgres',
  },
  {
    provider: 'sqlite',
    url: 'file:/tmp/provider-dispatch.db',
    expected: 'sqlite',
  },
  {
    provider: 'mysql',
    url: 'mysql://user:pass@localhost/db',
    expected: 'mysql',
  },
  { url: 'postgres://user:pass@localhost/db', expected: 'postgres' },
  { url: 'file:/tmp/inferred-provider.db', expected: 'sqlite' },
  { url: 'mariadb://user:pass@localhost/db', expected: 'mysql' },
]
for (const testCase of cases) {
  const adapter = createCmsPrismaDriverAdapter(testCase)
  assert.equal(adapter.provider, testCase.expected)
}
assert.throws(
  () => createCmsPrismaDriverAdapter({ url: 'opaque-provider-url' }),
  /Unable to infer Prisma provider/,
)
console.info(
  'Prisma 7 PostgreSQL/SQLite/MySQL driver dispatch validation passed.',
)
