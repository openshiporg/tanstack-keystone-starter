import type { CmsContext } from './adapters'

export class CmsMutationState {
  #afterOperations: Array<() => void | Promise<void>> = []
  #rollbackOperations: Array<() => void | Promise<void>> = []

  defer(afterOperation: () => void | Promise<void>) {
    this.#afterOperations.push(afterOperation)
  }

  deferRollback(onRollback: () => void | Promise<void>) {
    this.#rollbackOperations.push(onRollback)
  }

  async flush() {
    for (const afterOperation of this.#afterOperations) {
      await afterOperation()
    }
    this.#afterOperations = []
  }

  async rollback() {
    const operations = this.#rollbackOperations.splice(0).reverse()
    const failures: unknown[] = []
    for (const operation of operations) {
      try {
        await operation()
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length > 0)
      throw new AggregateError(failures, 'Mutation rollback cleanup failed')
  }

  clearRollback() {
    this.#rollbackOperations = []
  }
}

export function withMutationState(
  context: CmsContext,
  mutationState: CmsMutationState,
  deferAfterOperation = false,
): CmsContext {
  return {
    ...context,
    __internal: {
      ...context.__internal,
      mutationState,
      deferAfterOperation,
    },
  }
}
