import { describe, expect, it } from 'vitest'

import { getFieldTypeFromViewsIndex } from '../src/components/dashboard/views/getFieldTypeFromViewsIndex'

import { VIEW_ORDER } from '../.cms/view-order'

describe('generated dashboard view order', () => {
  it('resolves every runtime views index from the generated artifact', () => {
    VIEW_ORDER.forEach((fieldType, index) => {
      expect(getFieldTypeFromViewsIndex(index)).toBe(fieldType)
    })
  })

  it('rejects indices outside the generated runtime order', () => {
    expect(() => getFieldTypeFromViewsIndex(VIEW_ORDER.length)).toThrow(
      `Invalid views index: ${VIEW_ORDER.length}`,
    )
  })
})
