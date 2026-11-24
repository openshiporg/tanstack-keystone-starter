import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createEditor } from 'slate'

import { insertDocumentOption } from '../src/components/dashboard/rich-document-editor'
import {
  Cell,
  componentBlockInitialProps,
  controller,
  documentEditorConfig,
  Field,
} from '../src/components/dashboard/views/document'

const baseField = {
  path: 'description',
  label: 'Description',
  description: 'Document field',
  kind: 'document',
  fieldMeta: {
    kind: 'document',
    formatting: true,
    links: true,
    dividers: true,
    layouts: [[1, 1]],
    graphqlSelection: 'description',
  },
  createView: { fieldMode: 'edit', fieldPosition: 'form', isRequired: false },
  itemView: { fieldMode: 'edit', fieldPosition: 'form', isRequired: false },
  listView: { fieldMode: 'read', fieldPosition: 'form' },
  isNonNull: [false, false],
} as const

describe('dashboard document view', () => {
  it('controller defaults to Keystone document graphql selection and serializes plain text into Keystone-style document data', () => {
    const documentController = controller({
      path: 'description',
      label: 'Description',
      description: 'Document field',
      fieldMeta: {},
    })

    expect(documentController.graphqlSelection).toBe(
      'description { document(hydrateRelationships: true) }',
    )
    expect(documentController.serialize('Hello world')).toEqual({
      description: {
        document: [
          {
            type: 'paragraph',
            children: [{ text: 'Hello world' }],
          },
        ],
      },
    })
  })

  it('controller normalizes wrapped document JSON payloads', () => {
    const documentController = controller({
      path: 'description',
      label: 'Description',
      description: 'Document field',
      fieldMeta: {},
    })

    expect(
      documentController.serialize(
        JSON.stringify({
          document: [{ type: 'paragraph', children: [{ text: 'Wrapped' }] }],
        }),
      ),
    ).toEqual({
      description: {
        document: [{ type: 'paragraph', children: [{ text: 'Wrapped' }] }],
      },
    })
  })

  it('cell renders readable plain-text excerpts for structured document values', () => {
    const markup = renderToStaticMarkup(
      Cell({
        field: baseField as any,
        item: {
          description: {
            document: [
              { type: 'heading', level: 2, children: [{ text: 'Title' }] },
              {
                type: 'paragraph',
                children: [{ text: 'Body copy for the dashboard cell.' }],
              },
            ],
          },
        },
      }),
    )

    expect(markup).toContain('Title')
    expect(markup).toContain('Body copy for the dashboard cell.')
    expect(markup).not.toContain('Complex data')
  })

  it('normalizes schema-aware editor metadata without losing configured ratios', () => {
    const config = documentEditorConfig({
      documentFeatures: {
        formatting: {
          headingLevels: [2, 4],
          inlineMarks: { bold: true },
          listTypes: { ordered: false, unordered: true },
          alignment: { center: true, end: false },
          blockTypes: { blockquote: true, code: false },
          softBreaks: true,
        },
        links: true,
        dividers: true,
        layouts: [
          [2, 1],
          [1, 1, 1],
        ],
      },
      relationships: { author: { listKey: 'Author', label: 'Author' } },
      componentBlocks: {
        callout: {
          label: 'Callout',
          schema: {
            tone: { kind: 'form', defaultValue: 'info' },
            body: {
              kind: 'child',
              options: { kind: 'block', placeholder: 'Body' },
            },
          },
        },
      },
    })

    expect(config.documentFeatures.formatting.headingLevels).toEqual([2, 4])
    expect(config.documentFeatures.layouts).toEqual([
      [2, 1],
      [1, 1, 1],
    ])
    expect(Object.keys(config.relationships)).toEqual(['author'])
    expect(Object.keys(config.componentBlocks)).toEqual(['callout'])
  })

  it('inserts an inline relationship when the menu temporarily cleared editor focus', () => {
    const editor = createEditor()
    editor.children = [
      { type: 'paragraph', children: [{ text: 'Before' }] },
    ] as never
    editor.selection = null

    insertDocumentOption(
      editor,
      'relationship:author',
      documentEditorConfig().documentFeatures,
      { author: { listKey: 'Author', label: 'Author' } },
      {},
    )

    expect(JSON.stringify(editor.children)).toContain('"relationship":"author"')
  })

  it('builds component block defaults from nested schemas', () => {
    expect(
      componentBlockInitialProps({
        title: { kind: 'form', defaultValue: 'Hello' },
        enabled: { kind: 'form', defaultValue: true },
        author: { kind: 'relationship', listKey: 'Author', many: false },
        body: {
          kind: 'child',
          options: { kind: 'block', placeholder: 'Body' },
        },
        nested: {
          kind: 'object',
          fields: { count: { kind: 'form', defaultValue: 2 } },
        },
      }),
    ).toEqual({
      title: 'Hello',
      enabled: true,
      author: null,
      body: null,
      nested: { count: 2 },
    })
  })

  it('read-only field renders a structured preview instead of raw JSON', () => {
    const markup = renderToStaticMarkup(
      React.createElement(Field, {
        field: baseField as any,
        value: {
          document: [
            {
              type: 'heading',
              level: 2,
              children: [{ text: 'Preview heading' }],
            },
            { type: 'paragraph', children: [{ text: 'Preview paragraph' }] },
          ],
        },
      }),
    )

    expect(markup).toContain('Structured document preview')
    expect(markup).toContain('Preview heading')
    expect(markup).toContain('Preview paragraph')
    expect(markup).not.toContain('textarea')
  })
})
