import { describe, expect, it } from 'vitest'

import {
  collectBulkDeleteResult,
  formatBulkDeleteMessage,
} from '../src/components/dashboard/keystone-list-table'

describe('dashboard bulk delete semantics', () => {
  it('maps partial GraphQL deleteMany results back to deleted and failed ids', () => {
    const result = collectBulkDeleteResult({
      mutationName: 'deleteTodos',
      ids: ['todo_1', 'todo_2', 'todo_3'],
      result: {
        data: {
          deleteTodos: [{ id: 'todo_1' }, null, { id: 'todo_3' }],
        },
        errors: [
          {
            message: 'Access denied: delete Todo',
            path: ['deleteTodos', 1, 'id'],
          },
        ],
      },
    })

    expect(Array.from(result.deletedIds)).toEqual(['todo_1', 'todo_3'])
    expect(result.failedIds).toEqual(['todo_2'])
    expect(result.errorDetails).toEqual(['todo_2: Access denied: delete Todo'])
  })

  it('formats a readable partial-success bulk delete message', () => {
    expect(
      formatBulkDeleteMessage({
        singular: 'Todo',
        plural: 'Todos',
        deletedCount: 2,
        failedIds: ['todo_2'],
        errorDetails: ['todo_2: Access denied: delete Todo'],
      }),
    ).toBe('2 todos deleted, 1 failed.\ntodo_2: Access denied: delete Todo')
  })
})
