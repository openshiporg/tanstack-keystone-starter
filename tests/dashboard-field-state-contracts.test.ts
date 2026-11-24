import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  Cell as PasswordCell,
  Field as PasswordField,
  controller as passwordController,
  passwordEditingStateAfterEscape,
} from '../src/components/dashboard/views/password'
import {
  Field as NumberField,
  controller as numberController,
} from '../src/components/dashboard/views/number'
import { Field as CheckboxField } from '../src/components/dashboard/views/checkbox'
import {
  Field as SelectField,
  controller as selectController,
} from '../src/components/dashboard/views/select'

describe('dashboard field state contracts', () => {
  it('password controller preserves initial/editing state and confirm semantics', () => {
    const controller = passwordController({
      path: 'secretNote',
      label: 'Secret Note',
      fieldMeta: {
        validation: {
          length: { min: 8, max: 12 },
          match: {
            regex: { source: '^[A-Z].*\\d$', flags: '' },
            explanation: 'Must start with uppercase and end with a digit',
          },
          rejectCommon: true,
        },
      },
    })

    expect(controller.deserialize({ secretNote: { isSet: true } })).toEqual({
      kind: 'initial',
      isSet: true,
    })
    expect(
      controller.serialize({
        kind: 'editing',
        isSet: true,
        value: 'Hello123',
        confirm: 'Hello123',
      }),
    ).toEqual({ secretNote: 'Hello123' })
    expect(
      controller.validate(
        { kind: 'editing', isSet: true, value: 'hello', confirm: 'nope' },
        { isRequired: false },
      ),
    ).toBe(false)
    expect(
      controller.validate(
        { kind: 'editing', isSet: true, value: 'short', confirm: 'short' },
        { isRequired: false },
      ),
    ).toBe(false)
    expect(
      controller.validate(
        {
          kind: 'editing',
          isSet: true,
          value: 'lowercase9',
          confirm: 'lowercase9',
        },
        { isRequired: false },
      ),
    ).toBe(false)
    expect(
      controller.validate(
        {
          kind: 'editing',
          isSet: true,
          value: 'Hello123',
          confirm: 'Hello123',
        },
        { isRequired: false },
      ),
    ).toBe(true)
  })

  it('select controller preserves typed option state instead of raw strings', () => {
    const controller = selectController({
      path: 'status',
      label: 'Status',
      kind: 'select',
      fieldMeta: {
        options: [
          { label: 'Todo', value: 'todo' },
          { label: 'Done', value: 'done' },
        ],
      },
    })

    expect(controller.deserialize({ status: 'done' })).toEqual({
      kind: 'update',
      initial: { label: 'Done', value: 'done' },
      value: { label: 'Done', value: 'done' },
    })
    expect(
      controller.serialize({
        kind: 'update',
        initial: null,
        value: { label: 'Todo', value: 'todo' },
      }),
    ).toEqual({ status: 'todo' })
  })

  it('multiselect controller preserves option arrays instead of comma-separated strings', () => {
    const controller = selectController({
      path: 'tags',
      label: 'Tags',
      kind: 'multiselect',
      fieldMeta: {
        options: [
          { label: 'One', value: 'one' },
          { label: 'Two', value: 'two' },
        ],
      },
    })

    expect(controller.deserialize({ tags: ['one', 'two'] })).toEqual([
      { label: 'One', value: 'one' },
      { label: 'Two', value: 'two' },
    ])
    expect(controller.serialize([{ label: 'Two', value: 'two' }])).toEqual({
      tags: ['two'],
    })
  })

  it('select field renders segmented-control, radio, and nullable affordances from metadata', () => {
    const segmentedMarkup = renderToStaticMarkup(
      React.createElement(SelectField, {
        field: {
          kind: 'select',
          path: 'status',
          label: 'Status',
          fieldMeta: {
            displayMode: 'segmented-control',
            options: [
              { label: 'Todo', value: 'todo' },
              { label: 'Done', value: 'done' },
            ],
          },
        },
        value: {
          kind: 'update',
          initial: null,
          value: { label: 'Todo', value: 'todo' },
        },
        onChange: () => {},
      }),
    )

    const radioMarkup = renderToStaticMarkup(
      React.createElement(SelectField, {
        field: {
          kind: 'select',
          path: 'priority',
          label: 'Priority',
          fieldMeta: {
            displayMode: 'radio',
            options: [
              { label: 'Low', value: 'low' },
              { label: 'High', value: 'high' },
            ],
          },
        },
        value: {
          kind: 'update',
          initial: null,
          value: { label: 'High', value: 'high' },
        },
        onChange: () => {},
      }),
    )

    const nullableMarkup = renderToStaticMarkup(
      React.createElement(SelectField, {
        field: {
          kind: 'select',
          path: 'assignee',
          label: 'Assignee',
          fieldMeta: {
            options: [
              { label: 'Ada', value: 'ada' },
              { label: 'Linus', value: 'linus' },
            ],
          },
        },
        value: {
          kind: 'update',
          initial: { label: 'Ada', value: 'ada' },
          value: null,
        },
        onChange: () => {},
        isRequired: false,
      }),
    )

    expect(segmentedMarkup).toContain('Todo')
    expect(segmentedMarkup).toContain('Done')
    expect(segmentedMarkup).toContain('id="field-status"')
    expect(radioMarkup).toContain('type="radio"')
    expect(radioMarkup).toContain('id="field-priority"')
    expect(radioMarkup).toContain('Priority')
    expect(nullableMarkup).toContain('Set field as null')
  })

  it('gives checkbox and composite select controls explicit accessible names', () => {
    const checkboxMarkup = renderToStaticMarkup(
      React.createElement(CheckboxField, {
        field: {
          kind: 'checkbox',
          path: 'published',
          label: 'Published',
          fieldMeta: {},
        } as never,
        value: true,
        onChange: () => {},
      }),
    )
    const radioMarkup = renderToStaticMarkup(
      React.createElement(SelectField, {
        field: {
          kind: 'select',
          path: 'priority',
          label: 'Priority',
          fieldMeta: {
            displayMode: 'radio',
            options: [
              { label: 'Low', value: 'low' },
              { label: 'High', value: 'high' },
            ],
          },
        },
        value: {
          kind: 'update',
          initial: null,
          value: { label: 'Low', value: 'low' },
        },
        onChange: () => {},
      }),
    )
    expect(checkboxMarkup).toContain('role="checkbox"')
    expect(checkboxMarkup).toContain('aria-label="Published"')
    expect(radioMarkup).toContain('role="radiogroup"')
    expect(radioMarkup).toContain('aria-label="Priority"')
    expect(radioMarkup).toContain('type="radio"')
    expect(radioMarkup).toContain('Low')
    expect(radioMarkup).toContain('High')
  })

  it('number controller preserves integer and float state separately', () => {
    const integerController = numberController({
      path: 'priority',
      label: 'Priority',
      kind: 'integer',
      fieldMeta: {},
    })
    const floatController = numberController({
      path: 'estimate',
      label: 'Estimate',
      kind: 'float',
      fieldMeta: {},
    })

    expect(integerController.deserialize({ priority: 7 })).toEqual({
      kind: 'update',
      initial: 7,
      value: 7,
    })
    expect(
      integerController.serialize({ kind: 'update', initial: 7, value: 8 }),
    ).toEqual({ priority: 8 })
    expect(floatController.deserialize({ estimate: 1.25 })).toEqual({
      kind: 'update',
      initial: '1.25',
      value: '1.25',
    })
    expect(
      floatController.serialize({
        kind: 'update',
        initial: '1.25',
        value: '2.5',
      }),
    ).toEqual({ estimate: 2.5 })
  })

  it('number controller preserves decimal and bigint as string-like typed state', () => {
    const decimalController = numberController({
      path: 'budget',
      label: 'Budget',
      kind: 'decimal',
      fieldMeta: { validation: { min: '1.5', max: '9.5' } },
    })
    const bigIntController = numberController({
      path: 'visitors',
      label: 'Visitors',
      kind: 'bigInt',
      fieldMeta: { validation: { min: '10', max: '1000000000000000000' } },
    })

    expect(decimalController.deserialize({ budget: '3.25' })).toEqual({
      kind: 'update',
      initial: '3.25',
      value: '3.25',
    })
    expect(
      decimalController.serialize({
        kind: 'update',
        initial: '3.25',
        value: '4.75',
      }),
    ).toEqual({ budget: '4.75' })
    expect(
      decimalController.validate(
        { kind: 'update', initial: '3.25', value: '1.0' },
        { isRequired: true },
      ),
    ).toBe(false)

    expect(
      bigIntController.deserialize({ visitors: '123456789012345678' }),
    ).toEqual({
      kind: 'update',
      initial: '123456789012345678',
      value: '123456789012345678',
    })
    expect(
      bigIntController.serialize({
        kind: 'update',
        initial: '123456789012345678',
        value: '999999999999999999',
      }),
    ).toEqual({ visitors: '999999999999999999' })
    expect(
      bigIntController.validate(
        { kind: 'update', initial: null, value: 'not-a-bigint' },
        { isRequired: true },
      ),
    ).toBe(false)
  })

  it('integer controller understands autoincrement defaults and min/max validation', () => {
    const integerController = numberController({
      path: 'position',
      label: 'Position',
      kind: 'integer',
      fieldMeta: {
        defaultValue: 'autoincrement',
        validation: { min: 2, max: 5 },
      },
    })

    expect(integerController.defaultValue).toEqual({
      kind: 'create',
      value: null,
    })
    expect(
      integerController.validate(
        { kind: 'create', value: null },
        { isRequired: true },
      ),
    ).toBe(true)
    expect(
      integerController.validate(
        { kind: 'create', value: 1 },
        { isRequired: true },
      ),
    ).toBe(false)
    expect(
      integerController.validate(
        { kind: 'create', value: 4 },
        { isRequired: true },
      ),
    ).toBe(true)
  })

  it('password field renders validation metadata help and read-only access state', () => {
    const editableMarkup = renderToStaticMarkup(
      React.createElement(PasswordField, {
        field: {
          kind: 'password',
          path: 'secretNote',
          label: 'Secret Note',
          description: 'Used for confidential notes',
          fieldMeta: {
            validation: {
              length: { min: 8, max: 16 },
              match: {
                regex: { source: '^[A-Z].*\\d$', flags: '' },
                explanation: 'Must start with uppercase and end with a digit',
              },
              rejectCommon: true,
            },
          },
        },
        value: {
          kind: 'editing',
          isSet: true,
          value: 'short',
          confirm: 'short',
        },
        onChange: () => {},
        forceValidation: true,
      }),
    )

    const readonlyMarkup = renderToStaticMarkup(
      React.createElement(PasswordField, {
        field: {
          kind: 'password',
          path: 'secretNote',
          label: 'Secret Note',
          description: 'Used for confidential notes',
          fieldMeta: {},
        },
        value: { kind: 'initial', isSet: null },
      }),
    )

    expect(editableMarkup).toContain('Common passwords are rejected.')
    expect(editableMarkup).toContain(
      'Must start with uppercase and end with a digit',
    )
    expect(editableMarkup).toContain(
      'Secret Note must be at least 8 characters long',
    )
    expect(editableMarkup).toContain('Show password')
    expect(editableMarkup).toContain('id="field-secretNote"')
    expect(editableMarkup).toContain('aria-label="Confirm Secret Note"')
    expect(readonlyMarkup).toContain('Access denied')
  })

  it('password escape cancels only when both password inputs are still empty', () => {
    expect(
      passwordEditingStateAfterEscape(
        { kind: 'editing', isSet: true, value: '', confirm: '' },
        'Escape',
      ),
    ).toEqual({ kind: 'initial', isSet: true })

    expect(
      passwordEditingStateAfterEscape(
        { kind: 'editing', isSet: true, value: 'Secret123', confirm: '' },
        'Escape',
      ),
    ).toEqual({ kind: 'editing', isSet: true, value: 'Secret123', confirm: '' })

    expect(
      passwordEditingStateAfterEscape(
        { kind: 'editing', isSet: false, value: '', confirm: 'Secret123' },
        'Escape',
      ),
    ).toEqual({
      kind: 'editing',
      isSet: false,
      value: '',
      confirm: 'Secret123',
    })
  })

  it('password cell renders asterisk display when set', () => {
    const markup = renderToStaticMarkup(
      React.createElement(PasswordCell, {
        field: {
          kind: 'password',
          path: 'secretNote',
          label: 'Secret Note',
          fieldMeta: {},
        },
        item: { secretNote: { isSet: true } },
      }),
    )

    expect(markup).toContain('aria-label="is set"')
    expect(markup).toContain('lucide-asterisk')
  })

  it('number field renders inline validation message when forced invalid', () => {
    const markup = renderToStaticMarkup(
      React.createElement(NumberField, {
        field: {
          kind: 'float',
          path: 'estimate',
          label: 'Estimate',
          description: 'Estimated effort',
          fieldMeta: { validation: { min: 3, max: 10 } },
        },
        value: { kind: 'update', initial: '4', value: '2.5' },
        onChange: () => {},
        isRequired: true,
        forceValidation: true,
      }),
    )

    expect(markup).toContain('Estimate must be greater than or equal to 3')
    expect(markup).toContain('border-red-500')
    expect(markup).toContain('id="field-estimate"')
  })

  it('number field renders autoincrement explanatory copy for integer and bigint create states', () => {
    const integerMarkup = renderToStaticMarkup(
      React.createElement(NumberField, {
        field: {
          kind: 'integer',
          path: 'position',
          label: 'Position',
          fieldMeta: { defaultValue: 'autoincrement' },
        },
        value: { kind: 'create', value: null },
        onChange: () => {},
      }),
    )

    const bigIntMarkup = renderToStaticMarkup(
      React.createElement(NumberField, {
        field: {
          kind: 'bigInt',
          path: 'counter',
          label: 'Counter',
          fieldMeta: { defaultValue: 'autoincrement' },
        },
        value: { kind: 'create', value: null },
        onChange: () => {},
      }),
    )

    expect(integerMarkup).toContain('This field is set to auto increment.')
    expect(integerMarkup).toContain('id="field-position"')
    expect(bigIntMarkup).toContain('This field is set to auto increment.')
    expect(bigIntMarkup).toContain('id="field-counter"')
  })
})
