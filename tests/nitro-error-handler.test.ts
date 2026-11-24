import { describe, expect, it } from 'vitest'

import {
  handleNitroRequestError,
  isExpectedRequestAbort,
  requestErrorLogContext,
  shouldReportNitroError,
} from '../src/server/error-handler'
import { resolveRequestId } from '../src/server/request-observability'

function eventWithSignal(
  aborted: boolean,
  node?: {
    req?: { aborted?: boolean; complete?: boolean; destroyed?: boolean }
    res?: {
      destroyed?: boolean
      writableEnded?: boolean
      writableFinished?: boolean
    }
  },
) {
  return {
    req: { signal: { aborted } },
    runtime: node ? { node } : undefined,
  }
}

describe('Nitro request abort handling', () => {
  it('recognizes a client-aborted request with a direct AbortError', () => {
    const error = new DOMException('This operation was aborted', 'AbortError')

    expect(isExpectedRequestAbort(error, eventWithSignal(true))).toBe(true)
  })

  it('recognizes a client-aborted request whose cause is an AbortError', () => {
    const error = new Error('request failed', {
      cause: new DOMException('This operation was aborted', 'AbortError'),
    })

    expect(isExpectedRequestAbort(error, eventWithSignal(true))).toBe(true)
  })

  it('recognizes Node HTTP ECONNRESET only with live disconnect state', () => {
    const cause = Object.assign(new Error('aborted'), { code: 'ECONNRESET' })
    const error = new Error('request failed', { cause })

    expect(isExpectedRequestAbort(error, eventWithSignal(true))).toBe(true)
    expect(isExpectedRequestAbort(error, eventWithSignal(false))).toBe(false)
  })

  it('recognizes the observed Node abort flags during response close', () => {
    const error = new DOMException('This operation was aborted', 'AbortError')
    const event = eventWithSignal(true, {
      req: { aborted: true, complete: true, destroyed: true },
      res: {
        destroyed: true,
        writableEnded: false,
        writableFinished: false,
      },
    })

    expect(isExpectedRequestAbort(error, event)).toBe(true)
  })

  it('does not treat completed destroyed sockets as cancellation evidence', () => {
    const error = new DOMException(
      'Application operation aborted',
      'AbortError',
    )
    const event = eventWithSignal(false, {
      req: { aborted: false, complete: true, destroyed: true },
      res: {
        destroyed: true,
        writableEnded: true,
        writableFinished: true,
      },
    })

    expect(isExpectedRequestAbort(error, event)).toBe(false)
  })

  it('does not trust an unfinished destroyed response without authoritative abort flags', () => {
    const error = new DOMException(
      'Application operation aborted',
      'AbortError',
    )
    const event = eventWithSignal(false, {
      req: { aborted: false, complete: true, destroyed: false },
      res: {
        destroyed: true,
        writableEnded: false,
        writableFinished: false,
      },
    })

    expect(isExpectedRequestAbort(error, event)).toBe(false)
    expect(shouldReportNitroError(error, event)).toBe(true)
  })

  it('does not trust application-originated stacks as disconnect evidence', () => {
    const cause = new DOMException(
      'Application operation aborted',
      'AbortError',
    )
    cause.stack = [
      'AbortError: Application operation aborted',
      'at AbortController.abort (app/background-job.ts:42:7)',
      'at ServerResponse.<anonymous> (app/custom-response.ts:19:3)',
    ].join('\n')
    const error = new Error('application task failed', { cause })

    expect(isExpectedRequestAbort(error, eventWithSignal(false))).toBe(false)
  })

  it('does not hide an AbortError unless the request signal was aborted', () => {
    const error = new DOMException('application abort', 'AbortError')

    expect(isExpectedRequestAbort(error, eventWithSignal(false))).toBe(false)
    expect(
      handleNitroRequestError(error, eventWithSignal(false)),
    ).toBeUndefined()
  })

  it('does not hide a genuine server error on an aborted request', () => {
    const error = new Error('resolver failed')

    expect(isExpectedRequestAbort(error, eventWithSignal(true))).toBe(false)
    expect(
      handleNitroRequestError(error, eventWithSignal(true)),
    ).toBeUndefined()
  })

  it('maps only an expected client disconnect to status 499', () => {
    const error = new DOMException('This operation was aborted', 'AbortError')

    const response = handleNitroRequestError(error, eventWithSignal(true))

    expect(response?.status).toBe(499)
    expect(response?.statusText).toBe('Client Closed Request')
    expect(response?.body).toBeNull()
  })

  it('hashes a bounded conventional request ID for structured error logs', () => {
    const context = requestErrorLogContext({
      req: {
        headers: new Headers({ 'x-request-id': 'request-42.trace_7' }),
        method: 'POST',
        signal: { aborted: false },
      },
      url: new URL('https://example.test/api/graphql?secret=hidden'),
    })

    expect(context).toEqual({
      method: 'POST',
      pathname: '/api/graphql',
      requestId: resolveRequestId('request-42.trace_7'),
    })
  })

  it('rejects request IDs that could inject or expand server logs', () => {
    const context = requestErrorLogContext({
      req: {
        headers: { get: () => 'bad id\nforged-log' },
        method: 'GET',
        signal: { aborted: false },
      },
      url: new URL('https://example.test/dashboard'),
    })

    expect(context.requestId).toBeNull()
  })

  it('reports genuine and context-free failures but not expected disconnects', () => {
    const disconnect = new DOMException(
      'This operation was aborted',
      'AbortError',
    )
    const resolverFailure = new Error('resolver failed')

    expect(shouldReportNitroError(disconnect, eventWithSignal(true))).toBe(
      false,
    )
    expect(shouldReportNitroError(resolverFailure, eventWithSignal(true))).toBe(
      true,
    )
    expect(shouldReportNitroError(resolverFailure)).toBe(true)
  })
})
