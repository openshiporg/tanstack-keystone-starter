import { describe, expect, it } from 'vitest'

import { dashboardGraphQLErrorMessage } from '../src/features/cms/graphql-client'

describe('dashboard GraphQL error diagnostics', () => {
  it('surfaces Yoga development originalError details without changing production masking', () => {
    expect(
      dashboardGraphQLErrorMessage({
        message: 'Unexpected error.',
        path: ['keystone', 'adminMeta'],
        extensions: {
          originalError: {
            message: 'Access metadata failed for TodoImage.image',
            stack: 'Error: Access metadata failed',
          },
        },
      }),
    ).toBe(
      'Unexpected error. Access metadata failed for TodoImage.image (keystone.adminMeta)',
    )

    expect(dashboardGraphQLErrorMessage({ message: 'Unexpected error.' })).toBe(
      'Unexpected error.',
    )
  })
})
