import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  EnhancedFormFields,
  invalidFieldsForValues,
} from '../src/components/dashboard/enhanced-form-fields'

describe('dashboard required indicators', () => {
  const list = {
    path: 'todos',
    groups: [],
  } as any

  const requiredField = {
    kind: 'text',
    path: 'label',
    label: 'Label',
    description: 'Task label',
    graphql: { isNonNull: ['create'] },
    createView: { fieldMode: 'edit', fieldPosition: 'form', isRequired: true },
    itemView: { fieldMode: 'edit', fieldPosition: 'form', isRequired: true },
    views: {
      Field: ({ field, isRequired }: any) =>
        React.createElement(
          'div',
          null,
          `${field.label}:${String(isRequired)}`,
        ),
    },
    controller: {
      serialize: (value: unknown) => ({ label: value }),
      validate: (value: unknown, opts: { isRequired: boolean }) =>
        !opts.isRequired || String(value ?? '').trim().length > 0,
    },
  } as any

  const optionalField = {
    kind: 'text',
    path: 'notes',
    label: 'Notes',
    description: 'Optional notes',
    graphql: { isNonNull: [] },
    createView: { fieldMode: 'edit', fieldPosition: 'form', isRequired: false },
    itemView: { fieldMode: 'edit', fieldPosition: 'form', isRequired: false },
    views: {
      Field: ({ field, isRequired }: any) =>
        React.createElement(
          'div',
          null,
          `${field.label}:${String(isRequired)}`,
        ),
    },
    controller: {
      serialize: (value: unknown) => ({ notes: value }),
      validate: () => true,
    },
  } as any

  it('renders required asterisk only for fields whose normalized view metadata is required', () => {
    const markup = renderToStaticMarkup(
      React.createElement(EnhancedFormFields, {
        list,
        fields: {
          label: requiredField,
          notes: optionalField,
        },
        values: {
          label: '',
          notes: '',
        },
        serialized: {},
        view: 'createView',
        onChange: () => {},
      }),
    )

    expect(markup).toContain('Label')
    expect(markup).toContain('aria-hidden="true">*</span>')
    expect(markup).toContain('Label:true')
    expect(markup).toContain('Notes:false')
  })

  it('marks normalized required fields invalid when their value is empty', () => {
    const invalid = invalidFieldsForValues(
      {
        label: requiredField,
        notes: optionalField,
      },
      {
        label: '',
        notes: '',
      },
      'createView',
    )

    expect(Array.from(invalid)).toEqual(['label'])
  })
})
