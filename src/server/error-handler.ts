import { defineErrorHandler } from 'nitro'

import { resolveRequestId } from './request-observability'

type RequestAbortEvent = {
  req: {
    headers?: {
      get: (name: string) => string | null
    }
    method?: string
    url?: string
    signal: {
      aborted: boolean
    }
  }
  url?: URL
  runtime?: {
    node?: {
      req?: {
        aborted?: boolean
        complete?: boolean
        destroyed?: boolean
      }
      res?: {
        destroyed?: boolean
        writableEnded?: boolean
        writableFinished?: boolean
      }
    }
  }
}

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,64}$/

export function requestErrorLogContext(event: RequestAbortEvent) {
  const candidate = event.req.headers?.get('x-request-id')?.trim() ?? ''
  const pathname =
    event.url?.pathname ??
    (event.req.url ? new URL(event.req.url).pathname : null)
  return {
    method: event.req.method ?? null,
    pathname,
    requestId: SAFE_REQUEST_ID.test(candidate)
      ? resolveRequestId(candidate)
      : null,
  }
}

function hasExpectedDisconnectError(error: unknown) {
  const seen = new Set<unknown>()
  let current = error

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const record = current as Record<string, unknown>
    if (record.name === 'AbortError') return true
    if (record.code === 'ECONNRESET' && record.message === 'aborted')
      return true
    current = record.cause
  }

  return false
}

export function requestDisconnectState(event: RequestAbortEvent) {
  const node = event.runtime?.node
  const state = {
    signalAborted: event.req.signal.aborted,
    requestAborted: Boolean(node?.req?.aborted),
    requestComplete: node?.req?.complete ?? null,
    requestDestroyed: Boolean(node?.req?.destroyed),
    responseDestroyed: Boolean(node?.res?.destroyed),
    responseWritableEnded: node?.res?.writableEnded ?? null,
    responseWritableFinished: node?.res?.writableFinished ?? null,
  }
  return {
    ...state,
    disconnected: state.signalAborted || state.requestAborted,
  }
}

export function isExpectedRequestAbort(
  error: unknown,
  event: RequestAbortEvent,
) {
  return (
    hasExpectedDisconnectError(error) &&
    requestDisconnectState(event).disconnected
  )
}

export function shouldReportNitroError(
  error: unknown,
  event?: RequestAbortEvent,
) {
  return !event || !isExpectedRequestAbort(error, event)
}

export function handleNitroRequestError(
  error: unknown,
  event: RequestAbortEvent,
) {
  if (!isExpectedRequestAbort(error, event)) return undefined
  return new Response(null, {
    status: 499,
    statusText: 'Client Closed Request',
  })
}

export default defineErrorHandler((error, event) =>
  handleNitroRequestError(error, event),
)
