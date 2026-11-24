import { describe, expect, it } from 'vitest'

import { dashboardQueryKeys } from '../src/features/cms/graphql-client'

describe('dashboard create page contract', () => {
  it('provides a stable query key for runtime create-page admin meta', () => {
    expect(dashboardQueryKeys.createPage('todos')).toEqual([
      'dashboard',
      'createPage',
      'todos',
    ])
  })
})
