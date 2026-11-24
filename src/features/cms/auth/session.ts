import * as cookie from 'cookie'

import type { CmsContext, CmsSessionStrategy } from '../adapters'

type StatelessSessionsOptions = {
  secret?: string
  maxAge?: number
  cookieName?: string
  secure?: boolean
  /** Trust the first X-Forwarded-Proto value when deriving auto cookie security. */
  trustProxy?: boolean
  path?: string
  domain?: string
  sameSite?: true | false | 'lax' | 'strict' | 'none'
}

type SessionStore<TSessionData> = {
  get: (
    sessionId: string,
  ) => Promise<TSessionData | undefined> | TSessionData | undefined
  set: (sessionId: string, data: TSessionData) => Promise<void> | void
  delete: (sessionId: string) => Promise<void> | void
}

export type SessionStoreFunction<TSessionData> = (args: {
  maxAge: number
}) => SessionStore<TSessionData>

type StoredSessionsOptions<TSessionData> = StatelessSessionsOptions & {
  store: SessionStoreFunction<TSessionData>
}

type SessionEnvelope<T> = {
  data: T
  exp: number
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlToBytes(value: string) {
  const base64 =
    value.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index)
  return bytes
}

function base64UrlDecode(value: string) {
  return textDecoder.decode(base64UrlToBytes(value))
}

function createSecret() {
  const bytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

async function hmacKey(secret: string) {
  return globalThis.crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

async function aesKey(secret: string) {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    textEncoder.encode(secret),
  )
  return globalThis.crypto.subtle.importKey(
    'raw',
    digest,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function verifySignature(
  payload: string,
  signature: string,
  secret: string,
) {
  return globalThis.crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    base64UrlToBytes(signature),
    textEncoder.encode(payload),
  )
}

function tokenFromRequest(request: Request | undefined, cookieName: string) {
  const authorization = request?.headers.get('authorization') ?? ''
  if (authorization.startsWith('Bearer '))
    return authorization.slice('Bearer '.length)
  const cookies = cookie.parse(request?.headers.get('cookie') ?? '')
  return cookies[cookieName]
}

async function serializeSession<T>(data: T, secret: string, maxAge: number) {
  const envelope: SessionEnvelope<T> = { data, exp: Date.now() + maxAge * 1000 }
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await aesKey(secret),
    textEncoder.encode(JSON.stringify(envelope)),
  )
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`
}

async function parseLegacySession<T>(
  token: string,
  secret: string,
): Promise<T | undefined> {
  const [payload, signature] = token.split('.')
  if (
    !payload ||
    !signature ||
    !(await verifySignature(payload, signature, secret))
  )
    return undefined
  const envelope = JSON.parse(base64UrlDecode(payload)) as SessionEnvelope<T>
  if (typeof envelope.exp !== 'number' || envelope.exp < Date.now())
    return undefined
  return envelope.data
}

async function parseSealedSession<T>(
  token: string,
  secret: string,
): Promise<T | undefined> {
  const [version, encodedIv, encodedCiphertext] = token.split('.')
  if (version !== 'v1' || !encodedIv || !encodedCiphertext) return undefined
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlToBytes(encodedIv) },
    await aesKey(secret),
    base64UrlToBytes(encodedCiphertext),
  )
  const envelope = JSON.parse(
    textDecoder.decode(new Uint8Array(plaintext)),
  ) as SessionEnvelope<T>
  if (typeof envelope.exp !== 'number' || envelope.exp < Date.now())
    return undefined
  return envelope.data
}

async function parseSession<T>(
  token: string,
  secret: string,
): Promise<T | undefined> {
  if (token.startsWith('v1.')) return parseSealedSession<T>(token, secret)
  return parseLegacySession<T>(token, secret)
}

export function statelessSessions<TSessionData = unknown>({
  secret: configuredSecret,
  maxAge = 60 * 60 * 8,
  cookieName = 'keystonejs-session',
  path = '/',
  secure: configuredSecure,
  trustProxy = false,
  domain,
  sameSite = 'lax',
}: StatelessSessionsOptions = {}): CmsSessionStrategy<TSessionData> {
  if (configuredSecret && configuredSecret.length < 32)
    throw new Error('The session secret must be at least 32 characters long')
  let developmentSecret: string | undefined
  const sessionSecret = () => {
    const secret = configuredSecret ?? process.env.SESSION_SECRET
    if (!secret) {
      if (process.env.NODE_ENV === 'production')
        throw new Error('SESSION_SECRET is required in production')
      developmentSecret ??= createSecret()
      return developmentSecret
    }
    if (secret.length < 32)
      throw new Error('The session secret must be at least 32 characters long')
    return secret
  }

  function cookieIsSecure(request: Request | undefined) {
    if (configuredSecure !== undefined) return configuredSecure
    if (trustProxy) {
      const forwardedProtocol = request?.headers
        .get('x-forwarded-proto')
        ?.split(',')[0]
        ?.trim()
        .toLowerCase()
      if (forwardedProtocol) return forwardedProtocol === 'https'
    }
    return process.env.NODE_ENV === 'production'
  }

  return {
    async get({ context }: { context: CmsContext }) {
      const token = tokenFromRequest(context.__internal.request, cookieName)
      if (!token) return undefined
      try {
        return await parseSession<TSessionData>(token, sessionSecret())
      } catch {
        return undefined
      }
    },
    async start({
      data,
      context,
    }: {
      data: TSessionData
      context: CmsContext
    }) {
      const token = await serializeSession(data, sessionSecret(), maxAge)
      context.__internal.responseHeaders?.append(
        'set-cookie',
        cookie.serialize(cookieName, token, {
          maxAge,
          expires: new Date(Date.now() + maxAge * 1000),
          httpOnly: true,
          secure: cookieIsSecure(context.__internal.request),
          path,
          sameSite,
          domain,
        }),
      )
      return token
    },
    async end({ context }: { context: CmsContext }) {
      context.__internal.responseHeaders?.append(
        'set-cookie',
        cookie.serialize(cookieName, '', {
          maxAge: 0,
          expires: new Date(0),
          httpOnly: true,
          secure: cookieIsSecure(context.__internal.request),
          path,
          sameSite,
          domain,
        }),
      )
    },
  }
}

export function storedSessions<TSessionData = unknown>({
  store: storeFn,
  maxAge = 60 * 60 * 8,
  ...sessionOptions
}: StoredSessionsOptions<TSessionData>): CmsSessionStrategy<TSessionData> {
  const stateless = statelessSessions<string>({ ...sessionOptions, maxAge })
  const store = storeFn({ maxAge })

  return {
    async get({ context }) {
      const sessionId = await stateless.get({ context })
      if (!sessionId) return undefined
      return store.get(sessionId)
    },
    async start({ data, context }) {
      const sessionId = createSecret()
      await store.set(sessionId, data)
      return stateless.start({ data: sessionId, context })
    },
    async end({ context }) {
      const sessionId = await stateless.get({ context })
      if (sessionId) await store.delete(sessionId)
      await stateless.end({ context })
    },
  }
}
