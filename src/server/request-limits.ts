import cmsConfig from '../../cms.config'

export const DEFAULT_GRAPHQL_BODY_LIMIT = 25 * 1024 * 1024

export function graphQLBodyLimitBytes() {
  const configured = Number(process.env.CMS_GRAPHQL_MAX_BODY_BYTES)
  const requestLimit =
    Number.isSafeInteger(configured) && configured >= 1024
      ? configured
      : DEFAULT_GRAPHQL_BODY_LIMIT
  const uploadLimit = cmsConfig.server?.maxFileSize
  return typeof uploadLimit === 'number' &&
    Number.isSafeInteger(uploadLimit) &&
    uploadLimit > 0
    ? Math.min(requestLimit, uploadLimit)
    : requestLimit
}

function graphQLRequestError(
  status: number,
  code: 'BAD_REQUEST' | 'PAYLOAD_TOO_LARGE',
  message: string,
  limit?: number,
) {
  return Response.json(
    {
      errors: [
        {
          message,
          extensions: { code, ...(limit === undefined ? {} : { limit }) },
        },
      ],
    },
    { status, headers: { 'cache-control': 'no-store' } },
  )
}

export async function enforceGraphQLBodyLimit(
  request: Request,
): Promise<Request | Response> {
  const limit = graphQLBodyLimitBytes()
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > limit)
    return graphQLRequestError(
      413,
      'PAYLOAD_TOO_LARGE',
      'Request body exceeds the configured size limit.',
      limit,
    )
  if (!request.body) return request

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > limit) {
        await reader.cancel('GraphQL request body limit exceeded')
        return graphQLRequestError(
          413,
          'PAYLOAD_TOO_LARGE',
          'Request body exceeds the configured size limit.',
          limit,
        )
      }
      chunks.push(value)
    }
  } catch {
    return graphQLRequestError(
      400,
      'BAD_REQUEST',
      'Unable to read request body.',
    )
  }

  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
    signal: request.signal,
    // Required by Node's fetch implementation for request streams. Browsers
    // ignore this non-standard extension.
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })
}
