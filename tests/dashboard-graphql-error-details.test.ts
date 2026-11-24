import { describe, expect, it } from 'vitest'

import {
  formatGraphQLErrorDetails,
  summarizeGraphQLErrors,
} from '../src/components/dashboard/graphql-error-details'

describe('dashboard GraphQL error details', () => {
  it('summarizes GraphQL errors into a toast-friendly message', () => {
    expect(
      summarizeGraphQLErrors(
        [
          { message: 'Todo.label must be unique' },
          { message: 'Access denied: update Todo.assignedTo' },
        ],
        { fallbackMessage: 'Unable to save item.' },
      ),
    ).toBe('Todo.label must be unique\nAccess denied: update Todo.assignedTo')
  })

  it('formats GraphQL error details with path context when available', () => {
    expect(
      formatGraphQLErrorDetails([
        { message: 'Todo.label must be unique', path: ['updateTodo', 'label'] },
        { message: 'Access denied: update Todo.assignedTo' },
      ]),
    ).toBe(
      'Todo.label must be unique (updateTodo → label)\nAccess denied: update Todo.assignedTo',
    )
  })

  it('falls back cleanly when no GraphQL errors exist', () => {
    expect(
      summarizeGraphQLErrors(undefined, {
        fallbackMessage: 'Unable to delete item.',
      }),
    ).toBe('Unable to delete item.')
    expect(formatGraphQLErrorDetails(undefined)).toBeNull()
  })
})
