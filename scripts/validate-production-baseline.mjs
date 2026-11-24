import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'node:net'

import {
  processGroupExists,
  terminateChildGroup,
} from './lib/bounded-child.mjs'

const root = process.cwd()
const outputLimit = 256 * 1024
let output = ''
let child

function append(chunk) {
  output = `${output}${chunk}`.slice(-outputLimit)
}

async function freePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  assert(address && typeof address === 'object')
  const port = address.port
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
  return port
}

async function boundedFetch(url, init = {}, timeoutMs = 10_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  timer.unref?.()
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const body = await response.arrayBuffer()
    return new Response(body.byteLength > 0 ? body : null, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  } finally {
    clearTimeout(timer)
  }
}

async function waitFor(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child?.exitCode !== null)
      throw new Error(`production server exited early\n${output}`)
    try {
      const response = await boundedFetch(url, {}, 2_000)
      if (response.ok) return response
    } catch {
      // Retry only during bounded startup.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`timed out waiting for ${url}\n${output}`)
}

async function stop() {
  if (!child?.pid || !processGroupExists(child.pid)) return
  await terminateChildGroup(child, 'production baseline server', {
    termGrace: 500,
    killWait: 5_000,
  })
}

async function verifyBoundedFailurePaths() {
  const sockets = new Set()
  const hangingServer = createServer(() => {})
  hangingServer.on('connection', (socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
  })
  await new Promise((resolve, reject) => {
    hangingServer.once('error', reject)
    hangingServer.listen(0, '127.0.0.1', resolve)
  })
  try {
    const address = hangingServer.address()
    assert(address && typeof address === 'object')
    await assert.rejects(
      boundedFetch(`http://127.0.0.1:${address.port}/hang`, {}, 100),
      (error) => error?.name === 'AbortError',
    )
  } finally {
    for (const socket of sockets) socket.destroy()
    await new Promise((resolve) => hangingServer.close(resolve))
  }

  const partialSockets = new Set()
  const partialServer = createHttpServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.write('{"partial":')
  })
  partialServer.on('connection', (socket) => {
    partialSockets.add(socket)
    socket.once('close', () => partialSockets.delete(socket))
  })
  await new Promise((resolve, reject) => {
    partialServer.once('error', reject)
    partialServer.listen(0, '127.0.0.1', resolve)
  })
  try {
    const address = partialServer.address()
    assert(address && typeof address === 'object')
    await assert.rejects(
      boundedFetch(`http://127.0.0.1:${address.port}/partial`, {}, 100),
      (error) => error?.name === 'AbortError',
    )
  } finally {
    for (const socket of partialSockets) socket.destroy()
    await new Promise((resolve) => partialServer.close(resolve))
  }

  const stubborn = spawn(
    process.execPath,
    [
      '-e',
      "const{spawn}=require('node:child_process');process.on('SIGTERM',()=>{});spawn(process.execPath,['-e',\"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)\"],{stdio:'ignore'});setInterval(()=>{},1000)",
    ],
    { detached: true, stdio: 'ignore' },
  )
  await new Promise((resolve) => setTimeout(resolve, 100))
  await terminateChildGroup(stubborn, 'production baseline stubborn probe', {
    termGrace: 100,
    killWait: 5_000,
  })
  assert.equal(processGroupExists(stubborn.pid), false)
}

try {
  await verifyBoundedFailurePaths()
  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  child = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: root,
    detached: true,
    env: {
      ...process.env,
      CMS_ADAPTER: 'memory',
      CMS_BOOTSTRAP_MODE: 'seeded',
      CMS_GRAPHQL_MAX_BODY_BYTES: '1024',
      CMS_REQUEST_LOGS: '1',
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
      PORT: String(port),
      SESSION_SECRET:
        'production-baseline-only-strong-session-secret-0123456789',
      S3_ENDPOINT: 'https://objects.example.test/bucket',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', append)
  child.stderr.on('data', append)

  const health = await waitFor(`${baseUrl}/api/health?token=must-not-log`)
  assert.deepEqual(await health.json(), {
    status: 'ok',
    checks: { runtime: 'ok' },
  })
  assert.equal(health.headers.get('cache-control'), 'no-store')

  const ready = await boundedFetch(`${baseUrl}/api/ready`)
  assert.equal(ready.status, 200)
  assert.deepEqual(await ready.json(), {
    status: 'ready',
    checks: { configuration: 'ok', persistence: 'ok' },
  })

  const validRequestId = await boundedFetch(baseUrl, {
    headers: { 'x-request-id': 'baseline-request-42' },
  })
  assert.match(
    validRequestId.headers.get('x-request-id') ?? '',
    /^req_[0-9a-f]{32}$/,
  )
  assert.doesNotMatch(
    validRequestId.headers.get('x-request-id') ?? '',
    /baseline-request-42/,
  )
  assert.equal(validRequestId.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(validRequestId.headers.get('x-frame-options'), 'DENY')
  assert.match(
    validRequestId.headers.get('content-security-policy') ?? '',
    /frame-ancestors 'none'/,
  )
  assert.match(
    validRequestId.headers.get('content-security-policy') ?? '',
    /img-src[^;]*https:\/\/objects\.example\.test/,
  )
  const html = await validRequestId.text()
  assert.match(html, /TanStack CMS Dashboard/)
  assert.match(html, /manifest\.json/)

  const invalidRequestId = await boundedFetch(baseUrl, {
    headers: { 'x-forwarded-proto': 'https', 'x-request-id': 'unsafe id' },
  })
  assert.match(
    invalidRequestId.headers.get('x-request-id') ?? '',
    /^[0-9a-f-]{36}$/,
  )
  assert.match(
    invalidRequestId.headers.get('strict-transport-security') ?? '',
    /max-age=31536000/,
  )

  const missingAsset = await boundedFetch(
    `${baseUrl}/assets/missing-baseline.js`,
  )
  assert.equal(missingAsset.status, 404)

  const oversized = await boundedFetch(`${baseUrl}/api/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'x'.repeat(1025),
  })
  assert.equal(oversized.status, 413)
  assert.equal(
    (await oversized.json()).errors[0].extensions.code,
    'PAYLOAD_TOO_LARGE',
  )

  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.match(output, /\[cms\]\[request\]/)
  assert.match(output, /"path":"\/assets\/missing-baseline\.js","status":404/)
  assert.doesNotMatch(output, /must-not-log/)

  console.info(
    'Production baseline validation passed: liveness/readiness, security headers/provider image origin, hashed request IDs, redacted structured logs, metadata, and GraphQL body limit.',
  )
} finally {
  await stop()
}
