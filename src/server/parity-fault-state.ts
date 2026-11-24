type RequestState = Record<string, unknown> | null

export type HookObservation = {
  causeCode: string | null
  errorMessage: string | null
  errorName: string | null
  expectedDisconnect: boolean
  pathname: string | null
  requestId: string | null
  requestState: RequestState
}

type RequestLifecycleObservation = {
  delayMs: number
  pathname: string
  phase: 'started' | 'completed'
  requestId: string
}

type ParityFaultState = {
  disconnectRequestsStarted: number
  expectedDisconnects: number
  hookObservations: HookObservation[]
  lastHookObservation: HookObservation | null
  reportedErrors: number
  requestLifecycle: RequestLifecycleObservation[]
}

const MAX_OBSERVATIONS = 100

const state: ParityFaultState = {
  disconnectRequestsStarted: 0,
  expectedDisconnects: 0,
  hookObservations: [],
  lastHookObservation: null,
  reportedErrors: 0,
  requestLifecycle: [],
}

function appendBounded<T>(values: T[], value: T) {
  values.push(value)
  if (values.length > MAX_OBSERVATIONS) values.shift()
}

export function parityFaultState() {
  return structuredClone(state)
}

export function recordDisconnectRequestStarted(requestId?: string | null) {
  if (process.env.CMS_PARITY_FAULT_INJECTION !== '1') return
  state.disconnectRequestsStarted += 1
  if (requestId) {
    appendBounded(state.requestLifecycle, {
      delayMs: 10_000,
      pathname: '/__parity/fault',
      phase: 'started',
      requestId,
    })
  }
}

export function recordHookObservation(observation: HookObservation) {
  if (process.env.CMS_PARITY_FAULT_INJECTION !== '1') return
  state.lastHookObservation = observation
  appendBounded(state.hookObservations, observation)
  if (observation.expectedDisconnect) state.expectedDisconnects += 1
  else state.reportedErrors += 1
}

export function recordRequestLifecycle(
  observation: RequestLifecycleObservation,
) {
  if (process.env.CMS_PARITY_FAULT_INJECTION !== '1') return
  appendBounded(state.requestLifecycle, observation)
}
