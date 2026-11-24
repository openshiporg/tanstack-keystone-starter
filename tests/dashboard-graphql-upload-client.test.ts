import { afterEach, describe, expect, it, vi } from 'vitest'

import { executeRawDashboardGraphQL } from '../src/features/cms/graphql-client'
import {
  buildGraphQLMultipartFormData,
  collectGraphQLFiles,
  createGraphQLMultipartRequestPayload,
  hasGraphQLFileUpload,
} from '../src/features/cms/graphql-upload-client'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('dashboard GraphQL multipart upload client', () => {
  it('detects File values inside GraphQL variables', () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })
    expect(hasGraphQLFileUpload({ data: { image: { upload: file } } })).toBe(
      true,
    )
    expect(hasGraphQLFileUpload({ data: { image: null } })).toBe(false)
  })

  it('collects file references from nested GraphQL variables', () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })
    expect(collectGraphQLFiles({ data: { image: { upload: file } } })).toEqual([
      { path: 'variables.data.image.upload', file },
    ])
  })

  it('builds GraphQL multipart payloads with operations/map/file entries', () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })
    const payload = createGraphQLMultipartRequestPayload('mutation Upload {}', {
      data: { image: { upload: file } },
    })

    expect(payload.operations).toEqual({
      query: 'mutation Upload {}',
      variables: { data: { image: { upload: null } } },
    })
    expect(payload.map).toEqual({ '0': ['variables.data.image.upload'] })
    expect(payload.fileReferences[0]?.file).toBe(file)
  })

  it('builds actual FormData from the multipart payload helper', () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })
    const formData = buildGraphQLMultipartFormData('mutation Upload {}', {
      upload: file,
    })
    expect(JSON.parse(String(formData.get('operations')))).toEqual({
      query: 'mutation Upload {}',
      variables: { upload: null },
    })
    expect(JSON.parse(String(formData.get('map')))).toEqual({
      '0': ['variables.upload'],
    })
    expect(formData.get('0')).toBe(file)
  })

  it('uses multipart FormData on the browser GraphQL client branch when File variables are present', async () => {
    vi.stubGlobal('window', {})
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ok: true } }),
    })

    const result = await executeRawDashboardGraphQL<{ ok: boolean }>(
      'mutation Upload($upload: Upload!) { ok }',
      { upload: file },
      { fetcher: fetcher as typeof fetch },
    )

    expect(result).toEqual({ data: { ok: true } })
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [endpoint, request] = fetcher.mock.calls[0]
    expect(endpoint).toBe('/api/graphql')
    expect(request.method).toBe('POST')
    expect(request.credentials).toBe('include')
    expect(request.headers).toEqual({})
    expect(request.body).toBeInstanceOf(FormData)
    const body = request.body as FormData
    expect(JSON.parse(String(body.get('operations')))).toEqual({
      query: 'mutation Upload($upload: Upload!) { ok }',
      variables: { upload: null },
    })
    expect(JSON.parse(String(body.get('map')))).toEqual({
      '0': ['variables.upload'],
    })
    expect(body.get('0')).toBe(file)
  })

  it('uses JSON on the browser GraphQL client branch when no File variables are present', async () => {
    vi.stubGlobal('window', {})
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ok: true } }),
    })

    const result = await executeRawDashboardGraphQL<{ ok: boolean }>(
      'query DashboardOk { ok }',
      { search: 'Launch' },
      { fetcher: fetcher as typeof fetch },
    )

    expect(result).toEqual({ data: { ok: true } })
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [endpoint, request] = fetcher.mock.calls[0]
    expect(endpoint).toBe('/api/graphql')
    expect(request.method).toBe('POST')
    expect(request.credentials).toBe('include')
    expect(request.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(request.body).toBe(
      JSON.stringify({
        query: 'query DashboardOk { ok }',
        variables: { search: 'Launch' },
      }),
    )
  })
})
