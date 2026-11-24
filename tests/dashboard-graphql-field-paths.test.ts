import { describe, expect, it } from 'vitest'

import {
  graphQLErrorFieldPaths,
  graphQLErrorState,
} from '../src/components/dashboard/graphql-error-details'

describe('dashboard GraphQL field path extraction', () => {
  it('extracts field paths from GraphQL error extensions when available', () => {
    expect(
      graphQLErrorFieldPaths([
        {
          message: 'Todo.label must be unique',
          extensions: { fieldPath: 'label' },
        },
      ]),
    ).toEqual(['label'])
  })

  it('falls back to parsing field paths from Keystone-style messages', () => {
    expect(
      graphQLErrorFieldPaths([
        {
          message: 'Access denied: update Todo.assignedTo',
        },
      ]),
    ).toEqual(['assignedTo'])
  })

  it('includes extracted field paths in the mutation error state', () => {
    expect(
      graphQLErrorState(
        [
          {
            message: 'Todo.label must be unique',
            extensions: { fieldPath: 'label' },
          },
          {
            message: 'Access denied: update Todo.assignedTo',
          },
        ],
        { fallbackMessage: 'Unable to save item.' },
      ).fieldPaths,
    ).toEqual(['label', 'assignedTo'])
  })
})
