export interface Gap01AuthShape {
  readonly listKey: string
  readonly identityField: string
  readonly secretField: string
  readonly displayField: string
  readonly initFields: readonly string[]
}

export interface Gap01Shape {
  readonly id: string
  readonly auth: Gap01AuthShape
  readonly creatableLists: readonly string[]
  readonly deniedList: string
}

export const GAP01_SHAPES: readonly Gap01Shape[]

export interface Gap01UserReproIntake {
  readonly status: 'not-reproduced'
  readonly classification: 'environmental-blocker'
  readonly requiredInputs: readonly string[]
  readonly probe: string
  readonly rule: string
}

export const GAP01_USER_REPRO_INTAKE: Gap01UserReproIntake

export const GAP01_ID_PROVENANCE: {
  readonly memory: {
    readonly classification: 'synthetic'
    readonly claim: string
  }
  readonly prisma: {
    readonly classification: 'external-checkpoint-017'
    readonly evidenceHash: string
    readonly claim: string
  }
}

export const GAP01_CHECKPOINT017_CUID_EVIDENCE: {
  readonly files: readonly string[]
  readonly sha256: string
  readonly classification: string
  readonly claim: string
}

export interface Gap01Request {
  readonly query: string
  readonly variables?: Record<string, unknown>
  readonly operationName?: string
}

export interface Gap01GraphqlEvidence {
  readonly operation?: string
  readonly request?: Gap01Request
  readonly response?: {
    readonly status?: number
    readonly body?: unknown
  }
  readonly harnessError?: unknown
  readonly networkError?: unknown
}

export interface Gap01ExpectedGraphqlEvidence {
  readonly operation?: unknown
  readonly routeId?: string
  readonly idPath?: readonly string[]
}

export interface Gap01Classification {
  readonly classification: string
  readonly reason?: string
}

export function expectedCreatableListKeys(shape: Gap01Shape): string[]
export function gap01RequestExpression(request: unknown): string

export function classifyGraphqlEvidence(
  evidence: Gap01GraphqlEvidence | undefined,
  expected: Gap01ExpectedGraphqlEvidence,
): Gap01Classification

export interface Gap01UserReproInputValues {
  readonly fixture?: string
  readonly command?: string
  readonly runtime?: string
  readonly versions?: string
  readonly evidence?: string
  readonly [key: string]: string | undefined
}

export type Gap01UserReproInputResult =
  | { readonly ok: true; readonly argv: string[] }
  | {
      readonly ok: false
      readonly reason: 'missing-inputs' | 'invalid-json-argv'
      readonly missing?: readonly string[]
    }

export function validateUserReproInputs(
  input: Gap01UserReproInputValues,
): Gap01UserReproInputResult

export function validateUserReproPaths(input: {
  readonly fixtureIsDirectory?: boolean
  readonly evidenceIsFile?: boolean
}):
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'invalid-paths' }

export function validateUserReproEvidence(input: {
  readonly report?: {
    readonly exitCode?: number | null
    readonly signal?: string | null
    readonly timedOut?: boolean
    readonly captureOverflow?: boolean
    readonly terminationPending?: boolean
    readonly stdout?: string
    readonly stderr?: string
  }
  readonly evidence?: {
    readonly traceToken?: string
    readonly classification?: string
  }
}):
  | {
      readonly status: 'blocked'
      readonly reason: string
    }
  | {
      readonly status: 'reproduced'
      readonly classification: string
      readonly traceToken: string
    }
