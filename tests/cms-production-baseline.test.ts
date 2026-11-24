import { describe, expect, it } from 'vitest'

import {
  configuredImageOrigins,
  productionSecurityHeaders,
  requestCompletionLog,
  resolveRequestId,
  shouldLogRequest,
} from '../src/server/request-observability'
import {
  cmsLivenessResponse,
  cmsReadinessTimeoutMs,
} from '../src/features/cms/health'
import { requestErrorLogContext } from '../src/server/error-handler'
import {
  enforceGraphQLBodyLimit,
  graphQLBodyLimitBytes,
} from '../src/server/request-limits'

describe('production runtime baseline', () => {
  it('returns a cache-disabled liveness response without internals', async () => {
    const response = cmsLivenessResponse()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({
      status: 'ok',
      checks: { runtime: 'ok' },
    })
  })

  it('bounds readiness deadlines to an operational range', () => {
    const previous = process.env.CMS_READINESS_TIMEOUT_MS
    try {
      process.env.CMS_READINESS_TIMEOUT_MS = '250'
      expect(cmsReadinessTimeoutMs()).toBe(250)
      process.env.CMS_READINESS_TIMEOUT_MS = '999999'
      expect(cmsReadinessTimeoutMs()).toBe(5_000)
    } finally {
      if (previous === undefined) delete process.env.CMS_READINESS_TIMEOUT_MS
      else process.env.CMS_READINESS_TIMEOUT_MS = previous
    }
  })

  it('applies browser hardening headers and HSTS only on secure production requests', () => {
    const secure = productionSecurityHeaders({
      production: true,
      secure: true,
      imageOrigins: ['https://objects.example.test'],
    })
    expect(secure['content-security-policy']).toContain("object-src 'none'")
    expect(secure['content-security-policy']).toContain(
      "frame-ancestors 'none'",
    )
    expect(secure['content-security-policy']).toContain(
      'https://objects.example.test',
    )
    expect(
      configuredImageOrigins({
        S3_ENDPOINT: 'https://objects.example.test/bucket',
        CMS_CSP_IMG_ORIGINS: 'https://cdn.example.test/path,javascript:ignored',
      }),
    ).toEqual(['https://objects.example.test', 'https://cdn.example.test'])
    expect(secure['x-content-type-options']).toBe('nosniff')
    expect(secure['x-frame-options']).toBe('DENY')
    expect(secure['strict-transport-security']).toContain('max-age=31536000')

    const local = productionSecurityHeaders({
      production: false,
      secure: false,
    })
    expect(local['content-security-policy']).toBeUndefined()
    expect(local['strict-transport-security']).toBeUndefined()
    expect(local['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })

  it('rejects declared and chunked oversized GraphQL bodies before parsing', async () => {
    const previous = process.env.CMS_GRAPHQL_MAX_BODY_BYTES
    process.env.CMS_GRAPHQL_MAX_BODY_BYTES = '1024'
    try {
      expect(graphQLBodyLimitBytes()).toBe(1024)
      const response = await enforceGraphQLBodyLimit(
        new Request('https://example.test/api/graphql', {
          method: 'POST',
          headers: {
            'content-length': '1025',
            'content-type': 'application/json',
          },
          body: '{}',
        }),
      )
      expect(response).toBeInstanceOf(Response)
      expect((response as Response).status).toBe(413)
      expect(await (response as Response).json()).toMatchObject({
        errors: [
          {
            extensions: { code: 'PAYLOAD_TOO_LARGE', limit: 1024 },
          },
        ],
      })

      const chunkedResponse = await enforceGraphQLBodyLimit(
        new Request('https://example.test/api/graphql', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(600))
              controller.enqueue(new Uint8Array(600))
              controller.close()
            },
          }),
          duplex: 'half',
        } as RequestInit & { duplex: 'half' }),
      )
      expect(chunkedResponse).toBeInstanceOf(Response)
      expect((chunkedResponse as Response).status).toBe(413)
    } finally {
      if (previous === undefined) delete process.env.CMS_GRAPHQL_MAX_BODY_BYTES
      else process.env.CMS_GRAPHQL_MAX_BODY_BYTES = previous
    }
  })

  it('excludes static assets from request completion logs', () => {
    expect(
      shouldLogRequest('https://example.test/assets/error-boundary.js'),
    ).toBe(false)
    expect(
      shouldLogRequest('https://example.test/assets/missing.js', 404),
    ).toBe(true)
    expect(shouldLogRequest('https://example.test/favicon.ico')).toBe(false)
    expect(shouldLogRequest('https://example.test/api/graphql')).toBe(true)
    expect(shouldLogRequest('https://example.test/api/report.js')).toBe(true)
    expect(shouldLogRequest('https://example.test/dashboard/example.js')).toBe(
      true,
    )
  })

  it('hashes safe caller request ids in response and error-log contexts', () => {
    const rawId = 'caller-controlled-sensitive-value'
    const responseId = resolveRequestId(rawId)
    const errorContext = requestErrorLogContext({
      req: {
        headers: { get: () => rawId },
        method: 'GET',
        url: 'https://example.test/dashboard',
        signal: { aborted: false },
      },
      url: new URL('https://example.test/dashboard'),
    })
    expect(responseId).toMatch(/^req_[0-9a-f]{32}$/)
    expect(errorContext.requestId).toBe(responseId)
    expect(JSON.stringify(errorContext)).not.toContain(rawId)
  })

  it('bounds request ids and emits query-free structured completion records', () => {
    expect(resolveRequestId('valid.request-id:42')).toMatch(
      /^req_[0-9a-f]{32}$/,
    )
    expect(resolveRequestId('valid.request-id:42')).not.toContain(
      'valid.request-id',
    )
    expect(resolveRequestId('unsafe id with spaces')).toMatch(/^[0-9a-f-]{36}$/)
    expect(
      requestCompletionLog({
        requestId: 'request-1',
        method: 'POST',
        url: 'https://example.test/api/graphql?token=must-not-leak',
        status: 200,
        startedAt: 100,
        completedAt: 125,
      }),
    ).toEqual({
      event: 'request.complete',
      requestId: 'request-1',
      method: 'POST',
      path: '/api/graphql',
      status: 200,
      durationMs: 25,
    })
  })
})
