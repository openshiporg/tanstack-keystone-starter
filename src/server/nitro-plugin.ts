import { definePlugin } from 'nitro'

import { requestErrorLogContext, shouldReportNitroError } from './error-handler'
import {
  productionSecurityHeaders,
  requestCompletionLog,
  resolveRequestId,
  shouldLogRequest,
} from './request-observability'

export default definePlugin((nitroApp) => {
  const requestState = new WeakMap<
    object,
    { requestId: string; startedAt: number }
  >()
  const production = process.env.NODE_ENV === 'production'
  const logRequests = production || process.env.CMS_REQUEST_LOGS === '1'

  nitroApp.hooks?.hook('request', (event) => {
    requestState.set(event, {
      requestId: resolveRequestId(event.req.headers.get('x-request-id')),
      startedAt: Date.now(),
    })
  })

  nitroApp.hooks?.hook('response', (response, event) => {
    const state = requestState.get(event) ?? {
      requestId: resolveRequestId(null),
      startedAt: Date.now(),
    }
    const forwardedProtocol = event.req.headers
      .get('x-forwarded-proto')
      ?.split(',')[0]
      ?.trim()
    const secure =
      forwardedProtocol === 'https' ||
      new URL(event.req.url).protocol === 'https:'
    for (const [name, value] of Object.entries(
      productionSecurityHeaders({ production, secure }),
    ))
      response.headers.set(name, value)
    response.headers.set('x-request-id', state.requestId)

    if (logRequests && shouldLogRequest(event.req.url, response.status)) {
      console.info(
        '[cms][request]',
        JSON.stringify(
          requestCompletionLog({
            requestId: state.requestId,
            method: event.req.method,
            url: event.req.url,
            status: response.status,
            startedAt: state.startedAt,
          }),
        ),
      )
    }
    requestState.delete(event)
  })

  // H3 otherwise logs before Nitro can classify an expected disconnect. Nitro's
  // supported error hook below remains the single reporting boundary.
  if (nitroApp.h3) nitroApp.h3.config.silent = true
  nitroApp.hooks?.hook('error', (error, { event }) => {
    if (shouldReportNitroError(error, event)) {
      console.error(
        '[cms][server-error]',
        event ? requestErrorLogContext(event) : null,
        error,
      )
    }
  })
})
