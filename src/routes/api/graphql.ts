import { createFileRoute } from '@tanstack/react-router'

import cmsConfig from '../../../cms.config'
import { cmsGraphQLYoga } from '@/features/cms/graphql'
import { enforceGraphQLBodyLimit } from '@/server/request-limits'

function applyCorsHeaders(request: Request, headers: Headers) {
  const configured = cmsConfig.server?.cors
  if (!configured || typeof configured !== 'object') return
  const cors = configured as {
    origin?: boolean | string | string[]
    credentials?: boolean
    allowedHeaders?: string[]
    methods?: string[]
  }
  const requestOrigin = request.headers.get('origin')
  const allowedOrigin =
    cors.origin === true
      ? requestOrigin
      : typeof cors.origin === 'string'
        ? cors.origin
        : Array.isArray(cors.origin) &&
            requestOrigin &&
            cors.origin.includes(requestOrigin)
          ? requestOrigin
          : null
  if (allowedOrigin) headers.set('access-control-allow-origin', allowedOrigin)
  if (cors.credentials) headers.set('access-control-allow-credentials', 'true')
  headers.set(
    'access-control-allow-methods',
    (cors.methods ?? ['GET', 'POST', 'OPTIONS']).join(', '),
  )
  const requestedHeaders = request.headers.get('access-control-request-headers')
  const allowedHeaders = cors.allowedHeaders?.join(', ') ?? requestedHeaders
  if (allowedHeaders)
    headers.set('access-control-allow-headers', allowedHeaders)
  headers.append('vary', 'Origin')
}

export async function handleGraphQLRequest(request: Request) {
  if (request.method === 'OPTIONS') {
    const headers = new Headers({ 'cache-control': 'no-store' })
    applyCorsHeaders(request, headers)
    return new Response(null, { status: 204, headers })
  }
  const boundedRequest = await enforceGraphQLBodyLimit(request)
  if (boundedRequest instanceof Response) return boundedRequest
  const cmsResponseHeaders = new Headers()
  const response = await cmsGraphQLYoga.handle(boundedRequest, {
    cmsResponseHeaders,
  })
  const headers = new Headers(response.headers)
  cmsResponseHeaders.forEach((value, key) => headers.append(key, value))
  applyCorsHeaders(request, headers)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export const Route = createFileRoute('/api/graphql')({
  server: {
    handlers: {
      GET: ({ request }) => handleGraphQLRequest(request),
      POST: ({ request }) => handleGraphQLRequest(request),
      OPTIONS: ({ request }) => handleGraphQLRequest(request),
    },
  },
})
