import { createServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import type { Server as HttpServer } from 'node:http'
import type { Server as NetServer, Socket } from 'node:net'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { createHash, createHmac } from 'node:crypto'
import { graphql } from 'graphql'

import {
  deleteStoredObject,
  getSignedStorageUrl,
  getStorageConfigs,
  storeUploadedFile,
  storedGraphQLUploadResponse,
} from '../src/features/cms/storage'
import { cmsGraphQLYoga } from '../src/features/cms/graphql'
import {
  createCmsContext,
  getCmsGraphQLSchema,
} from '../src/features/cms/runtime'
import {
  memoryCmsAdapter,
  resetMemoryAdapter,
  setCmsAdapterForTests,
} from '../src/features/cms/adapters'
import {
  MAX_SMTP_RETRIES,
  MAX_SMTP_RETRY_DELAY_MS,
  sendPasswordResetEmail,
} from '../src/features/cms/password-reset-mail'

const maxFileSize = 256 * 1024
const secretAccessKey = 'local-continuity-secret'
const accessKeyId = 'local-continuity'
const localProviderTimeoutMs = 2_000

type ObjectServer = {
  endpoint: string
  objects: Map<string, Buffer>
  requests: Array<{ method: string; key: string }>
  mode: 'normal' | 'hang-put' | 'hang-delete'
  activeSockets: () => number
  close: () => Promise<void>
}

type MailServer = {
  port: number
  attempts: number
  connections: number
  deliveries: string[]
  mode:
    | 'succeed'
    | 'fail-once'
    | 'fail-always'
    | 'hang-greeting'
    | 'hang-socket'
  activeSockets: () => number
  close: () => Promise<void>
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function fetchLocalProvider(input: string | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    signal: AbortSignal.timeout(localProviderTimeoutMs),
  })
}

async function closeListeningServer(
  server: HttpServer | NetServer,
  sockets: Set<Socket>,
) {
  const socketClosures = [...sockets].map((socket) =>
    socket.destroyed ? Promise.resolve() : once(socket, 'close'),
  )
  for (const socket of sockets) socket.destroy()
  await Promise.race([
    Promise.allSettled(socketClosures),
    new Promise<void>((resolve) => setTimeout(resolve, localProviderTimeoutMs)),
  ])
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  if (sockets.size > 0)
    throw new Error(`Provider server left ${sockets.size} socket(s) open`)
}

async function listen(server: HttpServer | NetServer) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Local provider server did not bind a TCP port')
  return address.port
}

function signingKey(date: string, region: string) {
  const hmac = (key: Buffer | string, value: string) =>
    createHmac('sha256', key).update(value).digest()
  return hmac(
    hmac(hmac(hmac(`AWS4${secretAccessKey}`, date), region), 's3'),
    'aws4_request',
  )
}

function canonicalQuery(requestUrl: URL) {
  return requestUrl.search
    .slice(1)
    .split('&')
    .filter((pair) => !pair.startsWith('X-Amz-Signature='))
    .sort((left, right) => left.localeCompare(right))
    .join('&')
}

function canonicalRequest(method: string, requestUrl: URL) {
  return [
    method,
    requestUrl.pathname,
    canonicalQuery(requestUrl),
    `host:${requestUrl.host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')
}

function expectedSignature(method: string, requestUrl: URL) {
  const credential = requestUrl.searchParams.get('X-Amz-Credential') ?? ''
  const [, date, region] = credential.split('/')
  const datetime = requestUrl.searchParams.get('X-Amz-Date') ?? ''
  const scope = `${date}/${region}/s3/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetime,
    scope,
    createHash('sha256')
      .update(canonicalRequest(method, requestUrl))
      .digest('hex'),
  ].join('\n')
  return createHmac('sha256', signingKey(date, region))
    .update(stringToSign)
    .digest('hex')
}

async function createObjectServer(): Promise<ObjectServer> {
  const objects = new Map<string, Buffer>([
    ['legacy/existing.bin', Buffer.from('existing-object')],
  ])
  const requests: Array<{ method: string; key: string }> = []
  const sockets = new Set<Socket>()
  let serverMode: ObjectServer['mode'] = 'normal'
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(
      request.url ?? '/',
      `http://${request.headers.host ?? '127.0.0.1'}`,
    )
    const parts = requestUrl.pathname.split('/').filter(Boolean)
    const bucket = parts.shift()
    const key = parts.join('/')
    requests.push({ method: request.method ?? 'GET', key })
    const credential = requestUrl.searchParams.get('X-Amz-Credential') ?? ''
    const signature = requestUrl.searchParams.get('X-Amz-Signature')
    const credentialParts = credential.split('/')
    const expires = Number(requestUrl.searchParams.get('X-Amz-Expires'))
    const authorized =
      requestUrl.searchParams.get('X-Amz-Algorithm') === 'AWS4-HMAC-SHA256' &&
      requestUrl.searchParams.get('X-Amz-SignedHeaders') === 'host' &&
      credentialParts.length === 5 &&
      credentialParts[0] === accessKeyId &&
      credentialParts[2] === 'local-1' &&
      credentialParts[3] === 's3' &&
      credentialParts[4] === 'aws4_request' &&
      Number.isInteger(expires) &&
      expires === ((request.method ?? 'GET') === 'GET' ? 300 : 3600) &&
      signature === expectedSignature(request.method ?? 'GET', requestUrl)
    if (!bucket || !authorized) {
      response.statusCode = 403
      response.end('forbidden')
      return
    }
    if (request.method === 'PUT') {
      const chunks: Buffer[] = []
      for await (const chunk of request) chunks.push(Buffer.from(chunk))
      if (serverMode === 'hang-put') await new Promise(() => {})
      objects.set(key, Buffer.concat(chunks))
      response.statusCode = 200
      response.end('stored')
      return
    }
    if (request.method === 'GET' || request.method === 'HEAD') {
      const value = objects.get(key)
      if (!value) {
        response.statusCode = 404
        response.end('missing')
        return
      }
      response.statusCode = 200
      response.setHeader('content-length', String(value.byteLength))
      if (request.method === 'GET') response.end(value)
      else response.end()
      return
    }
    if (request.method === 'DELETE') {
      if (serverMode === 'hang-delete') await new Promise(() => {})
      objects.delete(key)
      response.statusCode = 204
      response.end()
      return
    }
    response.statusCode = 405
    response.end('method not allowed')
  })
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  const port = await listen(server)
  return {
    endpoint: `http://127.0.0.1:${port}`,
    objects,
    requests,
    get mode() {
      return serverMode
    },
    set mode(value) {
      serverMode = value
    },
    activeSockets: () => sockets.size,
    close: () => closeListeningServer(server, sockets),
  }
}

function closeMailSocket(socket: Socket, sockets: Set<Socket>) {
  sockets.delete(socket)
  socket.end()
}

async function createMailServer(): Promise<MailServer> {
  const sockets = new Set<Socket>()
  const deliveries: string[] = []
  let attempts = 0
  let connections = 0
  let mode: MailServer['mode'] = 'succeed'
  const server = createNetServer((socket) => {
    sockets.add(socket)
    connections += 1
    socket.setEncoding('utf8')
    if (mode !== 'hang-greeting') socket.write('220 local continuity SMTP\r\n')
    let buffer = ''
    let dataMode = false
    let message = ''
    let authenticated = false
    socket.on('data', (chunk) => {
      if (mode === 'hang-socket') return
      buffer += chunk
      while (buffer.includes('\r\n')) {
        const boundary = buffer.indexOf('\r\n')
        const line = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        if (dataMode) {
          if (line === '.') {
            dataMode = false
            deliveries.push(message)
            message = ''
            socket.write('250 2.0.0 accepted\r\n')
          } else
            message += `${line.startsWith('..') ? line.slice(1) : line}\r\n`
          continue
        }
        const command = line.toUpperCase()
        if (command.startsWith('EHLO') || command.startsWith('HELO')) {
          socket.write(
            '250-localhost\r\n250-AUTH PLAIN LOGIN\r\n250 PIPELINING\r\n',
          )
        } else if (command.startsWith('AUTH PLAIN ')) {
          const decoded = Buffer.from(
            line.slice(11).trim(),
            'base64',
          ).toString()
          authenticated = decoded === '\0provider-user\0provider-password'
          socket.write(
            authenticated
              ? '235 2.7.0 authenticated\r\n'
              : '535 5.7.8 invalid credentials\r\n',
          )
        } else if (command.startsWith('MAIL FROM:')) {
          if (!authenticated) {
            socket.write('530 5.7.0 authentication required\r\n')
          } else if (
            mode === 'fail-always' ||
            (mode === 'fail-once' && attempts++ === 0)
          ) {
            attempts += mode === 'fail-once' ? 0 : 1
            socket.write('451 4.3.0 temporary failure\r\n')
          } else socket.write('250 2.1.0 accepted\r\n')
        } else if (command.startsWith('RCPT TO:'))
          socket.write('250 2.1.5 accepted\r\n')
        else if (command === 'DATA') {
          dataMode = true
          socket.write('354 end data\r\n')
        } else if (command === 'QUIT') {
          socket.write('221 2.0.0 bye\r\n')
          closeMailSocket(socket, sockets)
        } else socket.write('250 2.0.0 ok\r\n')
      }
    })
    socket.on('close', () => sockets.delete(socket))
  })
  const port = await listen(server)
  return {
    port,
    get attempts() {
      return attempts
    },
    get connections() {
      return connections
    },
    deliveries,
    get mode() {
      return mode
    },
    set mode(value) {
      mode = value
      attempts = 0
    },
    activeSockets: () => sockets.size,
    close: () => closeListeningServer(server, sockets),
  }
}

async function checkStorage(storage: ObjectServer, scratch: string) {
  const config = {
    kind: 's3' as const,
    type: 'file' as const,
    bucketName: 'continuity-bucket',
    region: 'local-1',
    accessKeyId,
    secretAccessKey,
    endpoint: storage.endpoint,
    forcePathStyle: true,
    signed: { expiry: 300 },
    maxFileSize,
    requestTimeoutMs: localProviderTimeoutMs,
  }
  const existingUrl = getSignedStorageUrl(
    config,
    'legacy/existing.bin',
    new Date('2026-01-02T03:04:05Z'),
  )
  const existingSigned = new URL(existingUrl)
  assert(
    existingSigned.search
      .slice(1)
      .startsWith(`${canonicalQuery(existingSigned)}&X-Amz-Signature=`),
    'signed URL must preserve the implementation canonical encoded-query order',
  )
  assert(
    expectedSignature('GET', existingSigned) ===
      existingSigned.searchParams.get('X-Amz-Signature'),
    'signed URL must match the implementation canonical request exactly',
  )
  const existingResponse = await fetchLocalProvider(existingUrl)
  const existingBody = await existingResponse.text()
  assert(
    existingResponse.status === 200,
    `existing signed object should be readable (received ${existingResponse.status}: ${existingBody})`,
  )
  assert(
    existingBody === 'existing-object',
    'existing object bytes should be preserved',
  )
  assert(
    storage.requests.filter(({ method }) => method === 'PUT').length === 0,
    'existing-object read must not upload',
  )

  const exactBytes = Buffer.alloc(maxFileSize, 7)
  const exact = await storeUploadedFile(
    'continuity',
    new File([exactBytes], 'realistic-boundary.bin', {
      type: 'application/octet-stream',
    }),
    undefined,
    config,
  )
  assert(
    exact.filesize === maxFileSize,
    'boundary-sized object should report its complete byte size',
  )
  assert(
    storage.objects.get(exact.filename)?.byteLength === maxFileSize,
    'boundary-sized object should be readable from the provider',
  )

  const requestCount = storage.requests.length
  for (const invalidTimeout of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    await storeUploadedFile(
      'continuity',
      new File(['invalid-timeout'], 'invalid-timeout.bin'),
      undefined,
      { ...config, requestTimeoutMs: invalidTimeout },
    ).then(
      () => {
        throw new Error('invalid object request timeout unexpectedly accepted')
      },
      (error: unknown) =>
        assert(
          error instanceof Error && error.message.includes('requestTimeoutMs'),
          'invalid object request timeout should fail before provider I/O',
        ),
    )
    await deleteStoredObject('continuity', 'invalid-timeout.bin', {
      ...config,
      requestTimeoutMs: invalidTimeout,
    }).then(
      () => {
        throw new Error('invalid delete request timeout unexpectedly accepted')
      },
      (error: unknown) =>
        assert(
          error instanceof Error && error.message.includes('requestTimeoutMs'),
          'invalid delete request timeout should fail before provider I/O',
        ),
    )
  }
  assert(
    storage.requests.length === requestCount,
    'invalid object request timeout must not reach the provider',
  )

  const timeoutConfig = { ...config, requestTimeoutMs: 50 }
  const beforeHangingPut = new Set(storage.objects.keys())
  storage.mode = 'hang-put'
  const putStarted = Date.now()
  await storeUploadedFile(
    'continuity',
    new File(['hanging-upload'], 'hanging-upload.bin'),
    undefined,
    timeoutConfig,
  ).then(
    () => {
      throw new Error('hanging object upload unexpectedly succeeded')
    },
    (error: unknown) =>
      assert(error instanceof Error, 'hanging upload must reject'),
  )
  assert(
    Date.now() - putStarted < 1_000,
    'object upload should reject within its configured request deadline',
  )
  assert(
    [...storage.objects.keys()].every((key) => beforeHangingPut.has(key)),
    'timed-out object upload must not leave an object residue',
  )

  storage.mode = 'normal'
  const deleteCandidate = await storeUploadedFile(
    'continuity',
    new File(['hanging-delete'], 'hanging-delete.bin'),
    undefined,
    timeoutConfig,
  )
  storage.mode = 'hang-delete'
  const deleteStarted = Date.now()
  await deleteStoredObject(
    'continuity',
    deleteCandidate.filename,
    timeoutConfig,
  ).then(
    () => {
      throw new Error('hanging object delete unexpectedly succeeded')
    },
    (error: unknown) =>
      assert(error instanceof Error, 'hanging delete must reject'),
  )
  assert(
    Date.now() - deleteStarted < 1_000,
    'object delete should reject within its configured request deadline',
  )
  assert(
    storage.objects.has(deleteCandidate.filename),
    'timed-out object delete must leave the existing object intact',
  )
  storage.mode = 'normal'
  await deleteStoredObject(
    'continuity',
    deleteCandidate.filename,
    timeoutConfig,
  )
  assert(
    !storage.objects.has(deleteCandidate.filename),
    'object cleanup after a timed-out delete should remove the object',
  )

  const localRoot = join(scratch, 'local-files')
  const localConfig = {
    kind: 'local' as const,
    type: 'file' as const,
    storagePath: localRoot,
    serverRoute: '/files',
    maxFileSize,
  }
  const localStored = await storeUploadedFile(
    'local-continuity',
    new File(['local-file'], 'local.txt'),
    undefined,
    localConfig,
  )
  assert(
    (await stat(localStored.path)).isFile(),
    'local storage should persist a file object',
  )
  assert(
    (await readFile(localStored.path, 'utf8')) === 'local-file',
    'local storage should preserve file bytes',
  )
  await deleteStoredObject(
    'local-continuity',
    localStored.filename,
    localConfig,
  )
  await expectMissing(
    localStored.path,
    'local storage cleanup should remove deleted files',
  )

  const putCount = storage.requests.filter(
    ({ method }) => method === 'PUT',
  ).length
  await storeUploadedFile(
    'continuity',
    new File([Buffer.alloc(maxFileSize + 1)], 'too-large.bin'),
    undefined,
    config,
  ).then(
    () => {
      throw new Error('oversized object unexpectedly uploaded')
    },
    (error: unknown) =>
      assert(
        error instanceof Error && error.message.includes('limit'),
        'oversized object should fail at the configured limit',
      ),
  )
  assert(
    storage.requests.filter(({ method }) => method === 'PUT').length ===
      putCount,
    'rejected object must not reach the provider',
  )
  await storedGraphQLUploadResponse(
    'continuity',
    Promise.resolve({
      filename: 'stream-too-large.bin',
      mimetype: 'application/octet-stream',
      createReadStream: () => Readable.from([Buffer.alloc(maxFileSize + 1)]),
    }),
    undefined,
    config,
  ).then(
    () => {
      throw new Error('oversized stream unexpectedly uploaded')
    },
    (error: unknown) =>
      assert(
        error instanceof Error && error.message.includes('limit'),
        'oversized stream should fail before provider I/O',
      ),
  )
  assert(
    storage.requests.filter(({ method }) => method === 'PUT').length ===
      putCount,
    'rejected stream must not reach the provider',
  )
  await storedGraphQLUploadResponse(
    'continuity',
    Promise.resolve({
      filename: 'invalid-limit.bin',
      mimetype: 'application/octet-stream',
      createReadStream: () => Readable.from(['invalid']),
    }),
    undefined,
    { ...config, maxFileSize: 0 },
  ).then(
    () => {
      throw new Error('invalid storage limit unexpectedly accepted')
    },
    (error: unknown) =>
      assert(
        error instanceof Error &&
          error.message.includes('positive safe integer'),
        'invalid stream storage limit should fail before reading or provider I/O',
      ),
  )

  await storeUploadedFile(
    'continuity',
    new File(['bad-credentials'], 'credentials.txt'),
    undefined,
    { ...config, secretAccessKey: 'wrong-secret' },
  ).then(
    () => {
      throw new Error('invalid storage credentials unexpectedly succeeded')
    },
    (error: unknown) =>
      assert(
        error instanceof Error && error.message.includes('403'),
        'invalid credentials should preserve provider failure',
      ),
  )

  const storedKey = exact.filename
  await deleteStoredObject('continuity', storedKey, config)
  assert(
    !storage.objects.has(storedKey),
    'explicit object cleanup should remove the uploaded object',
  )
}

function pngBytes() {
  return Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000030000000208060000009d74661a0000000049454e44ae426082',
    'hex',
  )
}

async function checkMultipartPersistence(storage: ObjectServer) {
  const configs = getStorageConfigs()
  const previous = configs.my_images
  configs.my_images = {
    kind: 's3',
    type: 'image',
    bucketName: 'continuity-bucket',
    region: 'local-1',
    accessKeyId,
    secretAccessKey,
    endpoint: storage.endpoint,
    forcePathStyle: true,
    signed: { expiry: 300 },
    maxFileSize,
  }
  process.env.CMS_ADAPTER = 'memory'
  process.env.CMS_DEV_AUTH_FALLBACK = 'true'
  process.env.CMS_DEV_AUTH_ITEM_ID = 'user_admin'
  setCmsAdapterForTests(memoryCmsAdapter)
  resetMemoryAdapter()
  try {
    const form = new FormData()
    form.set(
      'operations',
      JSON.stringify({
        query:
          'mutation($upload: Upload!) { createTodoImage(data: { image: { upload: $upload }, altText: "multipart continuity" }) { image { url filesize width height } } }',
        variables: { upload: null },
      }),
    )
    form.set('map', JSON.stringify({ '0': ['variables.upload'] }))
    form.set(
      '0',
      new File([pngBytes()], 'multipart.png', { type: 'image/png' }),
    )
    const response = await cmsGraphQLYoga.handle(
      new Request('http://local.test/api/graphql', {
        method: 'POST',
        body: form,
      }),
      { cmsResponseHeaders: new Headers() },
    )
    const payload = (await response.json()) as {
      data?: { createTodoImage?: { image?: Record<string, unknown> } }
      errors?: Array<{ message: string }>
    }
    assert(
      response.status === 200 && !payload.errors?.length,
      'multipart upload should return a successful GraphQL response',
    )
    const image = payload.data?.createTodoImage?.image
    assert(
      image?.filesize === pngBytes().byteLength,
      'multipart upload should persist exact file size',
    )
    assert(
      image?.width === 3 && image?.height === 2,
      'multipart upload should persist generated image dimensions',
    )
    const imageUrl = String(image?.url)
    const readBack = await fetchLocalProvider(imageUrl)
    assert(
      readBack.status === 200 &&
        (await readBack.arrayBuffer()).byteLength === pngBytes().byteLength,
      'generated signed image URL should read the persisted object',
    )
    const filename = new URL(imageUrl).pathname.split('/').pop()
    assert(filename, 'generated image URL should contain a stored filename')
    await deleteStoredObject('my_images', filename, configs.my_images)
    assert(
      !storage.objects.has(filename),
      'multipart object cleanup should remove the provider object',
    )
  } finally {
    if (previous) configs.my_images = previous
    else delete configs.my_images
  }
}

async function expectNoSockets(mail: MailServer, message: string) {
  const deadline = Date.now() + localProviderTimeoutMs
  while (mail.activeSockets() > 0 && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 5))
  assert(mail.activeSockets() === 0, message)
}

async function expectMissing(path: string, message: string) {
  await stat(path).then(
    () => {
      throw new Error(message)
    },
    () => undefined,
  )
}

async function checkUploadRollback(storage: ObjectServer) {
  const configs = getStorageConfigs()
  const previous = configs.my_images
  configs.my_images = {
    kind: 's3',
    type: 'image',
    bucketName: 'continuity-bucket',
    region: 'local-1',
    accessKeyId,
    secretAccessKey,
    endpoint: storage.endpoint,
    forcePathStyle: true,
    signed: { expiry: 300 },
    maxFileSize,
  }
  process.env.CMS_ADAPTER = 'memory'
  process.env.CMS_DEV_AUTH_FALLBACK = 'true'
  process.env.CMS_DEV_AUTH_ITEM_ID = 'user_admin'
  setCmsAdapterForTests(memoryCmsAdapter)
  resetMemoryAdapter()
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000030000000208060000009d74661a0000000049454e44ae426082',
    'hex',
  )
  const before = new Set(storage.objects.keys())
  try {
    const result = await graphql({
      schema: getCmsGraphQLSchema(),
      source: `mutation($upload: Upload!) { createTodoImage(data: { image: { upload: $upload }, altText: "rollback", todos: { connect: { id: "missing" } } }) { id } }`,
      variableValues: {
        upload: Promise.resolve({
          filename: 'rollback.png',
          mimetype: 'image/png',
          createReadStream: () => Readable.from([png]),
        }),
      },
      contextValue: await createCmsContext(
        new Request('http://local.test/api/graphql'),
      ),
    })
    assert(
      result.errors?.length,
      'a failed relationship mutation should return a GraphQL error',
    )
    assert(
      [...storage.objects.keys()].every((key) => before.has(key)),
      'failed mutation must remove its uploaded orphan',
    )
  } finally {
    if (previous) configs.my_images = previous
    else delete configs.my_images
  }
}

async function checkSmtp(mail: MailServer) {
  const base = {
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(mail.port),
    SMTP_USER: 'provider-user',
    SMTP_PASSWORD: 'provider-password',
    SMTP_FROM: 'CMS <cms@example.com>',
    SMTP_STORE_LINK: 'https://store.example.com',
    SMTP_SECURE: 'false',
    SMTP_MAX_RETRIES: '1',
    SMTP_RETRY_DELAY_MS: '5',
    SMTP_TIMEOUT_MS: String(localProviderTimeoutMs),
  }
  mail.mode = 'fail-once'
  await sendPasswordResetEmail('retry-token', 'person@example.com', base)
  assert(mail.attempts >= 2, 'SMTP temporary failure should be retried')
  assert(mail.deliveries.length === 1, 'SMTP retry should deliver exactly once')
  const deliveredBody = mail.deliveries[0].replaceAll('=3D', '=')
  assert(
    deliveredBody.includes('token=retry-token'),
    'delivered reset mail should contain the signed reset token URL',
  )

  mail.mode = 'fail-always'
  const deliveryCount = mail.deliveries.length
  await sendPasswordResetEmail(
    'failure-token',
    'person@example.com',
    base,
  ).then(
    () => {
      throw new Error('SMTP permanent local failure unexpectedly succeeded')
    },
    (error: unknown) =>
      assert(
        error instanceof Error,
        'SMTP failure should reject with an Error',
      ),
  )
  assert(
    mail.attempts === 2,
    'SMTP failure should stop after the configured retry budget',
  )
  assert(
    mail.deliveries.length === deliveryCount,
    'failed SMTP delivery must not be recorded as delivered',
  )

  const connectionsBeforeInvalidTimeout = mail.connections
  await sendPasswordResetEmail('invalid-timeout', 'person@example.com', {
    ...base,
    SMTP_TIMEOUT_MS: '0',
    SMTP_MAX_RETRIES: '0',
  }).then(
    () => {
      throw new Error('invalid SMTP timeout unexpectedly accepted')
    },
    (error: unknown) =>
      assert(
        error instanceof Error && error.message.includes('SMTP_TIMEOUT_MS'),
        'invalid SMTP timeout should fail before provider I/O',
      ),
  )
  assert(
    mail.connections === connectionsBeforeInvalidTimeout,
    'invalid SMTP timeout must not open a provider connection',
  )
  for (const invalidConfig of [
    { SMTP_MAX_RETRIES: String(MAX_SMTP_RETRIES + 1) },
    { SMTP_RETRY_DELAY_MS: String(MAX_SMTP_RETRY_DELAY_MS + 1) },
  ]) {
    const connectionsBeforeInvalidRetryConfig = mail.connections
    await sendPasswordResetEmail('invalid-retry-config', 'person@example.com', {
      ...base,
      ...invalidConfig,
      SMTP_MAX_RETRIES: invalidConfig.SMTP_MAX_RETRIES ?? '0',
    }).then(
      () => {
        throw new Error(
          'invalid SMTP retry configuration unexpectedly accepted',
        )
      },
      (error: unknown) =>
        assert(
          error instanceof Error,
          'invalid SMTP retry configuration must reject',
        ),
    )
    assert(
      mail.connections === connectionsBeforeInvalidRetryConfig,
      'invalid SMTP retry configuration must not open a provider connection',
    )
  }

  const hangingMail = {
    ...base,
    SMTP_MAX_RETRIES: '0',
    SMTP_TIMEOUT_MS: '50',
  }
  const hangingDeliveryCount = mail.deliveries.length
  for (const mode of ['hang-greeting', 'hang-socket'] as const) {
    mail.mode = mode
    const started = Date.now()
    await sendPasswordResetEmail(
      `timeout-${mode}`,
      'person@example.com',
      hangingMail,
    ).then(
      () => {
        throw new Error(`SMTP ${mode} unexpectedly succeeded`)
      },
      (error: unknown) =>
        assert(error instanceof Error, `SMTP ${mode} timeout must reject`),
    )
    assert(
      Date.now() - started < 1_000,
      `SMTP ${mode} should reject within its configured timeout`,
    )
    assert(
      mail.deliveries.length === hangingDeliveryCount,
      `SMTP ${mode} timeout must not record a delivery`,
    )
    await expectNoSockets(
      mail,
      `SMTP ${mode} timeout left a provider socket open`,
    )
  }
  mail.mode = 'succeed'

  await sendPasswordResetEmail('auth-token', 'person@example.com', {
    ...base,
    SMTP_PASSWORD: 'wrong-password',
    SMTP_MAX_RETRIES: '0',
  }).then(
    () => {
      throw new Error('invalid SMTP credentials unexpectedly succeeded')
    },
    (error: unknown) =>
      assert(
        error instanceof Error,
        'invalid SMTP credentials should reject cleanly',
      ),
  )
}

async function main() {
  let scratch: string | undefined
  let storage: ObjectServer | undefined
  let mail: MailServer | undefined
  let primaryError: unknown
  let baselineObjects: Set<string> | undefined
  const cleanupErrors: unknown[] = []
  try {
    scratch = await mkdtemp(join(tmpdir(), 'gap10-provider-continuity-'))
    storage = await createObjectServer()
    mail = await createMailServer()
    const baseline = new Set(storage.objects.keys())
    baselineObjects = baseline
    await checkStorage(storage, scratch)
    await checkMultipartPersistence(storage)
    await checkUploadRollback(storage)
    await checkSmtp(mail)
    const residue = [...storage.objects.keys()].filter(
      (key) => !baseline.has(key),
    )
    if (residue.length > 0) {
      for (const key of residue) storage.objects.delete(key)
      throw new Error(
        `Provider object residue detected before cleanup: ${residue.join(', ')}`,
      )
    }
  } catch (error) {
    primaryError = error
  } finally {
    const cleanupTasks: Promise<void>[] = []
    if (storage) cleanupTasks.push(storage.close())
    if (mail) cleanupTasks.push(mail.close())
    if (scratch)
      cleanupTasks.push(
        rm(scratch, { recursive: true, force: true }).then(async () => {
          await expectMissing(
            scratch!,
            'provider scratch directory remained after cleanup',
          )
        }),
      )
    if (storage && baselineObjects) {
      const residue = [...storage.objects.keys()].filter(
        (key) => !baselineObjects!.has(key),
      )
      if (residue.length > 0) {
        cleanupErrors.push(
          new Error(
            `Provider object residue remained during cleanup: ${residue.join(', ')}`,
          ),
        )
        for (const key of residue) storage.objects.delete(key)
      }
    }
    const results = await Promise.allSettled(cleanupTasks)
    for (const result of results) {
      if (result.status === 'rejected') cleanupErrors.push(result.reason)
    }
    if (storage && storage.activeSockets() !== 0)
      cleanupErrors.push(
        new Error(
          `Object provider left ${storage.activeSockets()} socket(s) after cleanup`,
        ),
      )
    if (mail && mail.activeSockets() !== 0)
      cleanupErrors.push(
        new Error(
          `SMTP provider left ${mail.activeSockets()} socket(s) after cleanup`,
        ),
      )
  }
  if (primaryError || cleanupErrors.length > 0) {
    const failures = [...(primaryError ? [primaryError] : []), ...cleanupErrors]
    throw new AggregateError(failures, 'GAP-10 provider validation failed')
  }
  console.info('GAP-10 local provider continuity validation passed.')
  console.info(
    'External-only boundary: no production credentials, existing production objects, staging bucket, SMTP account, or deliverability was exercised.',
  )
}

await main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
