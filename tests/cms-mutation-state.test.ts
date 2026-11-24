import { describe, expect, it } from 'vitest'

import { CmsMutationState } from '../src/features/cms/mutation-state'

describe('CMS mutation rollback state', () => {
  it('runs upload cleanup in reverse registration order', async () => {
    const state = new CmsMutationState()
    const events: string[] = []
    state.deferRollback(() => {
      events.push('first')
    })
    state.deferRollback(() => {
      events.push('second')
    })

    await state.rollback()

    expect(events).toEqual(['second', 'first'])
  })

  it('clears rollback work after a successful mutation', async () => {
    const state = new CmsMutationState()
    let called = false
    state.deferRollback(() => {
      called = true
    })
    state.clearRollback()

    await state.rollback()

    expect(called).toBe(false)
  })
})
