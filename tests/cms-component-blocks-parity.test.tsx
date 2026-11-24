import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  component,
  fields,
  NotEditable,
} from '../src/features/cms/keystone/component-blocks'

describe('fields-document 9.1.1 component-blocks public surface', () => {
  it('exports a transparent component helper and non-editable span', () => {
    const definition = { label: 'Hero', schema: fields.object({}) }
    expect(component(definition)).toBe(definition)
    expect(
      renderToStaticMarkup(
        createElement(NotEditable, { id: 'preview' }, 'Preview'),
      ),
    ).toBe(
      '<span id="preview" contentEditable="false" style="user-select:none">Preview</span>',
    )
  })

  it('normalizes inherited block and inline child formatting', () => {
    expect(
      fields.child({
        kind: 'block',
        placeholder: 'Body',
        formatting: 'inherit',
        dividers: 'inherit',
        links: 'inherit',
        relationships: 'inherit',
      }),
    ).toEqual({
      kind: 'child',
      options: {
        kind: 'block',
        placeholder: 'Body',
        dividers: 'inherit',
        formatting: {
          blockTypes: 'inherit',
          headingLevels: 'inherit',
          inlineMarks: 'inherit',
          listTypes: 'inherit',
          alignment: 'inherit',
          softBreaks: 'inherit',
        },
        links: 'inherit',
        relationships: 'inherit',
      },
    })
    expect(
      fields.child({
        kind: 'inline',
        placeholder: 'Label',
        formatting: 'inherit',
        links: 'inherit',
        relationships: 'inherit',
      }),
    ).toEqual({
      kind: 'child',
      options: {
        kind: 'inline',
        placeholder: 'Label',
        formatting: {
          inlineMarks: 'inherit',
          softBreaks: 'inherit',
        },
        links: 'inherit',
        relationships: 'inherit',
      },
    })
  })
})
