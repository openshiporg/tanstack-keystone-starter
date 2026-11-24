import { definePlugin } from 'nitro'

import { isExpectedRequestAbort, requestDisconnectState } from './error-handler'
import { recordHookObservation } from './parity-fault-state'

export default definePlugin((nitroApp) => {
  nitroApp.hooks?.hook('error', (error, { event }) => {
    const errorRecord = error as unknown as Record<string, unknown>
    const causeRecord =
      errorRecord.cause && typeof errorRecord.cause === 'object'
        ? (errorRecord.cause as Record<string, unknown>)
        : null
    const url = event ? new URL(event.req.url) : null
    const observation = {
      causeCode:
        typeof causeRecord?.code === 'string' ? causeRecord.code : null,
      errorMessage:
        typeof errorRecord.message === 'string' ? errorRecord.message : null,
      errorName: typeof errorRecord.name === 'string' ? errorRecord.name : null,
      expectedDisconnect: Boolean(
        event && isExpectedRequestAbort(error, event),
      ),
      pathname: url?.pathname ?? null,
      requestId:
        url?.searchParams.get('__parityRequestId') ??
        url?.searchParams.get('requestId') ??
        event?.req.headers.get('x-request-id') ??
        null,
      requestState: event ? requestDisconnectState(event) : null,
    }
    recordHookObservation(observation)
    console.log('[parity][error-hook]', JSON.stringify(observation))
  })
})
