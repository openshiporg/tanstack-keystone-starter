import { describe, expect, it } from 'vitest'

import { enhanceFields } from '../src/components/dashboard/enhance-fields'
import { controller as documentController } from '../src/components/dashboard/views/document'

const baseField = {
  label: 'Field',
  description: '',
  fieldMeta: {},
  viewsIndex: 4,
  customViewsIndex: null,
  search: null,
  isNonNull: [],
  createView: { fieldMode: 'edit', fieldPosition: 'form', isRequired: false },
  itemView: { fieldMode: 'edit', fieldPosition: 'form', isRequired: false },
  listView: { fieldMode: 'read', fieldPosition: 'form' },
} as const

describe('dashboard specialized controller wiring', () => {
  it('passes kind through so multiselect controllers use Keystone-style option state', () => {
    const enhanced = enhanceFields(
      [
        {
          ...baseField,
          path: 'tags',
          key: 'tags',
          kind: 'multiselect',
          fieldMeta: {
            kind: 'multiselect',
            options: [
              { label: 'Frontend', value: 'frontend' },
              { label: 'Backend', value: 'backend' },
            ],
          },
        },
      ] as any,
      'Todo',
    )

    const value = [
      { label: 'Frontend', value: 'frontend' },
      { label: 'Backend', value: 'backend' },
    ]
    expect(
      enhanced.tags.controller.deserialize({ tags: ['frontend', 'backend'] }),
    ).toEqual(value)
    expect(enhanced.tags.controller.serialize(value)).toEqual({
      tags: ['frontend', 'backend'],
    })
    expect(enhanced.tags.controller.validate(value, { isRequired: true })).toBe(
      true,
    )
  })

  it('round-trips rich document marks, links, alignment, layouts, and component data', () => {
    const controller = documentController({
      path: 'content',
      label: 'Content',
      description: null,
      fieldMeta: {},
    })
    const document = [
      {
        type: 'heading',
        level: 2,
        textAlign: 'center',
        children: [{ text: 'Rich heading', bold: true, italic: true }],
      },
      {
        type: 'paragraph',
        children: [
          { text: 'Visit ' },
          {
            type: 'link',
            href: 'https://example.com/docs',
            children: [{ text: 'the docs', underline: true }],
          },
        ],
      },
      {
        type: 'layout',
        layout: [2, 1],
        children: [
          {
            type: 'layout-area',
            children: [
              { type: 'paragraph', children: [{ text: 'Column one' }] },
            ],
          },
        ],
      },
      {
        type: 'component-block',
        component: 'callout',
        props: { tone: 'positive', nested: { count: 2 } },
        children: [{ text: '' }],
      },
    ]

    const formValue = controller.deserialize({ content: { document } })
    expect(controller.serialize(formValue)).toEqual({ content: { document } })
  })

  it('passes kind through so integer controllers reject non-integer values', () => {
    const enhanced = enhanceFields(
      [
        {
          ...baseField,
          path: 'priority',
          key: 'priority',
          kind: 'integer',
          fieldMeta: { kind: 'integer' },
        },
      ] as any,
      'Todo',
    )

    expect(enhanced.priority.controller.serialize('7.9')).toEqual({
      priority: 7.9,
    })
    expect(
      enhanced.priority.controller.validate('7.9', { isRequired: true }),
    ).toBe(false)
  })
})
