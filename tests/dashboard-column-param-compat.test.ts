import { describe, expect, it } from 'vitest'

import { selectedListFields } from '../src/features/cms/graphql-client'

const list = {
  initialColumns: ['label'],
  fields: [
    { path: 'id', label: 'ID', listView: { fieldMode: 'read' } },
    { path: 'label', label: 'Label', listView: { fieldMode: 'read' } },
    { path: 'status', label: 'Status', listView: { fieldMode: 'read' } },
    { path: 'secret', label: 'Secret', listView: { fieldMode: 'hidden' } },
  ],
} as any

describe('dashboard column param compatibility', () => {
  it('falls back to initial columns when no fields or column params are provided', () => {
    expect(selectedListFields(list).map((field) => field.path)).toEqual([
      'id',
      'label',
    ])
  })

  it('supports official-style repeated column params as an alias for fields', () => {
    expect(
      selectedListFields(list, undefined, ['label', 'status']).map(
        (field) => field.path,
      ),
    ).toEqual(['id', 'label', 'status'])
  })

  it('lets explicit fields param win over column alias params', () => {
    expect(
      selectedListFields(list, 'status', ['label']).map((field) => field.path),
    ).toEqual(['id', 'status'])
  })
})
