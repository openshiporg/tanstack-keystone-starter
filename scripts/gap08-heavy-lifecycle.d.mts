import type { SpawnOptions } from 'node:child_process'

export const GAP08_ACCEPTED_SIX: Readonly<{
  files: readonly string[]
  sha256: string
}>

export const GAP08_CLEANUP_STEPS: readonly string[]

export function sha256(value: string | NodeJS.ArrayBufferView): string
export function hashFileManifest(
  root: string,
  files: readonly string[],
): Promise<string>
export function boundedDiagnostic(value: unknown, maximumBytes?: number): string
export function captureError(error: unknown): Record<string, unknown>
export function assertExternalReportPath(
  disposableRoot: string,
  reportPath: string,
): string

export type Gap08ExecutionPlan = {
  provenance: 'generated-adminmeta-plus-prisma-schema'
  adminMetaSha256: string
  prismaSchemaSha256: string
  endpointCount: 6
  scenarioCount: 76
  endpointIds: readonly string[]
  scenarioIds: readonly string[]
  matrix: Array<Record<string, unknown>>
  scenarios: Array<Record<string, unknown>>
}

export function assertGeneratedExecutionPlan(input: {
  matrix: Array<Record<string, unknown>>
  scenarios: Array<Record<string, unknown>>
  adminMetaSha256: string
  prismaSchemaSha256: string
}): Gap08ExecutionPlan

export type Gap08Snapshot = {
  parentCount: number
  relatedCount: number
  edgeCount: number
  sentinelHash: string
  scalarHash: string
  storageHash: string
}

export function assertSnapshotDelta(
  before: Gap08Snapshot,
  after: Gap08Snapshot,
  expected: {
    parentDelta: number
    relatedDelta: number
    edgeDelta: number
  },
  options?: { requireUnchangedState?: boolean },
): true

export function physicalJoinCatalogContract(
  physicalJoinTable: Record<string, unknown>,
): {
  tableName: string
  expectedColumns: ['A', 'B']
  expectedForeignKeys: Array<{
    column: string
    referencesTableName: string
    referencesColumnName: string
  }>
  catalogQueries: string[]
}

export class Gap08RunLedger {
  constructor(runId: string)
  recordPhase(phase: string, details?: Record<string, unknown>): void
  recordFailure(error: unknown): void
  markGateCompleted(details: { scenarioCount: 76 }): void
  markCleanupCompleted(steps: readonly string[]): void
  markPostCleanupVerified(details: { sourceRestored: true }): void
  finalize(): {
    runId: string
    status: 'PASS' | 'RED'
    startedAt: string
    finalizedAt: string
    phases: Array<Record<string, unknown>>
    failures: Array<Record<string, unknown>>
  }
}

export function fingerprintPath(target: string): Promise<string>
export function writeJsonAtomic(target: string, value: unknown): Promise<void>
export function waitFor<T>(
  check: () => T | Promise<T>,
  description: string,
  timeout?: number,
): Promise<NonNullable<T>>

export class Gap08ChildError extends Error {
  result: Record<string, unknown>
}

export function runGap08BoundedChild(
  command: string,
  args: readonly string[],
  options: Pick<SpawnOptions, 'cwd' | 'env'> & {
    label: string
    timeout: number
    maxCapturedBytes?: number
    termGrace?: number
  },
): Promise<{
  exitCode: number
  signal: NodeJS.Signals | null
  captureOverflow: boolean
  stdout: string
  stderr: string
}>

export function removeAndVerifyAbsent(target: string): Promise<void>
