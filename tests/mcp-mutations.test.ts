import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)

describe('authenticated MCP product boundary', () => {
  it('enforces security controls and proves persisted confirmed CRUD', async () => {
    // The CMS schema uses GraphQL tooling that Vitest can load in separate ESM
    // realms. Run the executable boundary proof in one native Node/tsx realm.
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ['--import', 'tsx', 'tests/mcp-security-worker.ts'],
      {
        cwd: process.cwd(),
        env: { ...process.env, CMS_ADAPTER: 'memory' },
        timeout: 60_000,
      },
    )
    expect(stderr).toBe('')
    const line = stdout.trim().split('\n').at(-1)
    expect(line).toBeTruthy()
    expect(JSON.parse(line!)).toMatchObject({
      ok: true,
      persistence: { updated: true, deleted: true },
      security: {
        anonymous: 'denied',
        accessDenied: 'denied',
        itemAccessDenied: 'denied',
        listAccessFiltered: 'enforced',
        unconfirmed: 'denied',
        invalidOperation: 'denied',
        invalidField: 'denied',
        malformedJsonRpc: 'denied',
        crossOrigin: 'denied',
        metadataNonDisclosure: 'enforced',
        chunkedOversize: 'cancelled',
        oversizedResponse: 'denied',
        jsonRpcRouteSemantics: 'enforced',
        credentialLeakage: 'absent',
        auditEvents: 100,
        auditRedacted: true,
      },
    })
  }, 70_000)
})
