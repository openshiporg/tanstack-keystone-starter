import type { ChildProcess, SpawnOptions } from 'node:child_process'

export type BoundedChildOptions = SpawnOptions & {
  label: string
  timeout: number
  termGrace?: number
  captureOutput?: false
  maxCapturedBytes?: number
}

export type CapturedBoundedChildOptions = Omit<
  BoundedChildOptions,
  'captureOutput'
> & {
  captureOutput: true
}

export function processGroupExists(pid: number): boolean

export function terminateChildGroup(
  child: ChildProcess,
  label: string,
  options?: { termGrace?: number; killWait?: number },
): Promise<void>

export function runBoundedChild(
  command: string,
  args: readonly string[],
  options: CapturedBoundedChildOptions,
): Promise<{ child: ChildProcess; stdout: string; stderr: string }>

export function runBoundedChild(
  command: string,
  args: readonly string[],
  options: BoundedChildOptions,
): Promise<ChildProcess>
