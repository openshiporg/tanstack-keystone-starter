import { createHash, randomUUID } from 'node:crypto'

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,64}$/

export function resolveRequestId(value: string | null | undefined) {
  const candidate = value?.trim() ?? ''
  if (!SAFE_REQUEST_ID.test(candidate)) return randomUUID()
  return `req_${createHash('sha256').update(candidate).digest('hex').slice(0, 32)}`
}

export function configuredImageOrigins(
  environment: Record<string, string | undefined> = process.env,
) {
  const candidates = [
    environment.S3_ENDPOINT,
    ...(environment.CMS_CSP_IMG_ORIGINS?.split(',') ?? []),
  ]
  return Array.from(
    new Set(
      candidates.flatMap((candidate) => {
        try {
          const url = new URL(candidate?.trim() ?? '')
          return ['http:', 'https:'].includes(url.protocol) ? [url.origin] : []
        } catch {
          return []
        }
      }),
    ),
  )
}

export function productionSecurityHeaders({
  production,
  secure,
  imageOrigins = configuredImageOrigins(),
}: {
  production: boolean
  secure: boolean
  imageOrigins?: string[]
}) {
  const headers: Record<string, string> = {
    'cross-origin-opener-policy': 'same-origin',
    'permissions-policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  }
  if (production) {
    headers['content-security-policy'] = [
      "default-src 'self'",
      "base-uri 'self'",
      "connect-src 'self'",
      "font-src 'self' data:",
      "form-action 'self'",
      "frame-ancestors 'none'",
      `img-src 'self' data: blob:${imageOrigins.length ? ` ${imageOrigins.join(' ')}` : ''}`,
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
    ].join('; ')
  }
  if (production && secure)
    headers['strict-transport-security'] = 'max-age=31536000; includeSubDomains'
  return headers
}

export function shouldLogRequest(url: string, status = 200) {
  if (status >= 400) return true
  try {
    const path = new URL(url).pathname
    return !(
      path.startsWith('/assets/') ||
      /^\/(?:favicon\.ico|logo(?:192|512)\.png|manifest\.json|robots\.txt)$/.test(
        path,
      )
    )
  } catch {
    return true
  }
}

export type RequestCompletionLog = Readonly<{
  event: 'request.complete'
  requestId: string
  method: string
  path: string
  status: number
  durationMs: number
}>

export function requestCompletionLog({
  requestId,
  method,
  url,
  status,
  startedAt,
  completedAt = Date.now(),
}: {
  requestId: string
  method: string
  url: string
  status: number
  startedAt: number
  completedAt?: number
}): RequestCompletionLog {
  let path = '/'
  try {
    path = new URL(url).pathname
  } catch {
    // Invalid incoming URLs are still logged without reflecting their value.
  }
  return {
    event: 'request.complete',
    requestId,
    method,
    path,
    status,
    durationMs: Math.max(0, completedAt - startedAt),
  }
}
