import type { SpawnOptions } from 'node:child_process'

export interface Gap01CapturedChildOptions extends Omit<
  SpawnOptions,
  'detached' | 'stdio'
> {
  label: string
  timeout: number
  termGrace?: number
  killWait?: number
  maxCapturedBytes?: number
  reportPath?: string
}

export interface Gap01CapturedChildResult {
  command: string
  args: string[]
  exitCode: number | null
  signal: NodeJS.Signals | null
  timedOut: boolean
  captureOverflow: boolean
  leftDescendants: boolean
  quiescent: boolean
  stdout: string
  stderr: string
  spawnError?: string
  cleanupError?: string
}

export class Gap01CapturedChildError extends Error {
  readonly result: Gap01CapturedChildResult
  constructor(message: string, result: Gap01CapturedChildResult)
}

export function runGap01CapturedChild(
  command: string,
  args: string[],
  options: Gap01CapturedChildOptions,
): Promise<Gap01CapturedChildResult>
