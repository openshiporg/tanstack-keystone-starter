import { defineHandler } from 'nitro'

import {
  parityFaultState,
  recordDisconnectRequestStarted,
  recordRequestLifecycle,
} from './parity-fault-state'

const GENUINE_FAULT_MESSAGE = 'PARITY_TEST_GENUINE_SERVER_ERROR'

export default defineHandler(async (event) => {
  if (process.env.CMS_PARITY_FAULT_INJECTION !== '1') {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const kind = event.url.searchParams.get('kind')
  if (kind === 'health')
    return Response.json({ ok: true, ...parityFaultState() })
  if (kind === 'genuine') throw new Error(GENUINE_FAULT_MESSAGE)
  if (kind === 'throttled-query') {
    const requestId = event.url.searchParams.get('requestId') ?? ''
    const delayMs = Number(event.url.searchParams.get('delayMs'))
    if (
      !/^[A-Za-z0-9._:-]{1,128}$/.test(requestId) ||
      !Number.isInteger(delayMs) ||
      delayMs < 1 ||
      delayMs > 15_000
    ) {
      return Response.json(
        { error: 'Invalid throttle control' },
        { status: 400 },
      )
    }
    recordRequestLifecycle({
      delayMs,
      pathname: event.url.pathname,
      phase: 'started',
      requestId,
    })
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, delayMs)
      event.req.signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timeout)
          reject(
            event.req.signal.reason ??
              new DOMException('The request was aborted', 'AbortError'),
          )
        },
        { once: true },
      )
    })
    recordRequestLifecycle({
      delayMs,
      pathname: event.url.pathname,
      phase: 'completed',
      requestId,
    })
    return Response.json({ completed: true, requestId })
  }
  if (kind === 'disconnect') {
    recordDisconnectRequestStarted(event.url.searchParams.get('requestId'))
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, 10_000)
      event.req.signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timeout)
          reject(
            event.req.signal.reason ??
              new DOMException('The request was aborted', 'AbortError'),
          )
        },
        { once: true },
      )
    })
    return Response.json({ completed: true })
  }

  return Response.json({ error: 'Unknown fault kind' }, { status: 400 })
})
