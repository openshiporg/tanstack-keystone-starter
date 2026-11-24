import { describe, expect, it } from 'vitest'

import {
  controller,
  Field,
  relationshipControllerSelection,
  relationshipViewUiConfig,
} from '../src/components/dashboard/views/relationship'
import {
  relationshipCardsStateAfterCreate,
  relationshipCardsStateAfterCreateSheetClose,
  relationshipCardsStateAfterEditSheetClose,
  relationshipCardFieldSelections,
  relationshipCardsStateAfterSave,
  relationshipEditorSelectedIds,
} from '../src/components/dashboard/relationship-field-editor'
import { dashboardQueryKeys } from '../src/features/cms/graphql-client'
import { renderToStaticMarkup } from 'react-dom/server'

describe('dashboard relationship view contract', () => {
  it('uses count selection when relationship displayMode is count', () => {
    expect(
      relationshipControllerSelection({
        path: 'tasks',
        fieldMeta: { ui: { displayMode: 'count' } },
      }),
    ).toBe('tasksCount')

    const relationship = controller({
      path: 'tasks',
      label: 'Tasks',
      fieldMeta: { ui: { displayMode: 'count' } },
    })

    expect(relationship.graphqlSelection).toBe('tasksCount')
    expect(relationship.deserialize({ tasksCount: 3 })).toEqual({
      kind: 'count',
      count: 3,
    })
    expect(relationship.serialize({ kind: 'count', count: 3 })).toEqual({})
  })

  it('preserves removeMode none by avoiding disconnect writes', () => {
    const relationship = controller({
      path: 'todoImages',
      label: 'Todo Images',
      fieldMeta: {
        many: false,
        ui: { removeMode: 'none' },
      },
    })

    expect(
      relationship.serialize({
        kind: 'one',
        value: null,
        initialValue: { id: 'img_1', label: 'Image 1' },
      }),
    ).toEqual({})
  })

  it('serializes many relationships as connect/disconnect deltas instead of set replacement', () => {
    const relationship = controller({
      path: 'todoImages',
      label: 'Todo Images',
      fieldMeta: {
        many: true,
      },
    })

    expect(
      relationship.serialize({
        kind: 'many',
        initialValue: [{ id: 'img_1', label: 'Image 1' }],
        value: [{ id: 'img_1', label: 'Image 1' }],
      }),
    ).toEqual({})

    expect(
      relationship.serialize({
        kind: 'many',
        initialValue: [{ id: 'img_1', label: 'Image 1' }],
        value: [
          { id: 'img_1', label: 'Image 1' },
          { id: 'img_2', label: 'Image 2' },
        ],
      }),
    ).toEqual({
      todoImages: {
        connect: [{ id: 'img_2' }],
      },
    })

    expect(
      relationship.serialize({
        kind: 'many',
        initialValue: [
          { id: 'img_1', label: 'Image 1' },
          { id: 'img_2', label: 'Image 2' },
        ],
        value: [{ id: 'img_2', label: 'Image 2' }],
      }),
    ).toEqual({
      todoImages: {
        disconnect: [{ id: 'img_1' }],
      },
    })

    expect(
      relationship.serialize({
        kind: 'many',
        initialValue: [{ id: 'img_1', label: 'Image 1' }],
        value: [{ id: 'img_2', label: 'Image 2' }],
      }),
    ).toEqual({
      todoImages: {
        connect: [{ id: 'img_2' }],
        disconnect: [{ id: 'img_1' }],
      },
    })
  })

  it('defaults inlineConnect to true and removeMode to disconnect', () => {
    expect(
      relationshipViewUiConfig({
        fieldMeta: { ui: {} },
      } as any),
    ).toEqual({
      displayMode: undefined,
      cardFields: [],
      inlineConnect: true,
      removeMode: 'disconnect',
    })
  })

  it('renders count mode as read-only text instead of editable relationship controls', () => {
    const markup = renderToStaticMarkup(
      Field({
        field: {
          kind: 'relationship',
          path: 'tasks',
          label: 'Tasks',
          fieldMeta: { ui: { displayMode: 'count' } },
          createView: {
            fieldMode: 'edit',
            fieldPosition: 'form',
            isRequired: false,
          },
          itemView: {
            fieldMode: 'edit',
            fieldPosition: 'form',
            isRequired: false,
          },
          listView: { fieldMode: 'read', fieldPosition: 'form' },
          isNonNull: [],
        } as any,
        value: 4,
        onChange: () => {},
      }),
    )

    expect(markup).toContain('4')
    expect(markup).not.toContain('Search related items')
  })

  it('relationship editor reads structured many state as real selected ids', () => {
    expect(
      relationshipEditorSelectedIds({
        kind: 'many',
        initialValue: [{ id: 'img_1', label: 'Image 1' }],
        value: [
          { id: 'img_1', label: 'Image 1' },
          { id: 'img_2', label: 'Image 2' },
        ],
      }),
    ).toEqual(['img_1', 'img_2'])
  })

  it('cards-view create cleanup appends a created value while clearing create-in-progress state', () => {
    expect(
      relationshipCardsStateAfterCreate(
        {
          kind: 'cards-view',
          initialValue: [{ id: 'img_1', label: 'Image 1' }],
          value: [{ id: 'img_1', label: 'Image 1' }],
          itemBeingCreated: true,
          itemsBeingEdited: [],
        },
        { id: 'img_2', label: 'Created label' },
      ),
    ).toEqual({
      kind: 'cards-view',
      initialValue: [{ id: 'img_1', label: 'Image 1' }],
      value: [
        { id: 'img_1', label: 'Image 1' },
        { id: 'img_2', label: 'Created label' },
      ],
      itemBeingCreated: false,
      itemsBeingEdited: [],
    })
  })

  it('cards-view save cleanup preserves selected values while removing edit-in-progress state', () => {
    expect(
      relationshipCardsStateAfterSave(
        {
          kind: 'cards-view',
          initialValue: [{ id: 'img_1', label: 'Image 1' }],
          value: [
            { id: 'img_1', label: 'Old label' },
            { id: 'img_2', label: 'Image 2' },
          ],
          itemBeingCreated: false,
          itemsBeingEdited: ['img_1'],
        },
        { id: 'img_1', label: 'Updated label' },
      ),
    ).toEqual({
      kind: 'cards-view',
      initialValue: [{ id: 'img_1', label: 'Image 1' }],
      value: [
        { id: 'img_1', label: 'Updated label' },
        { id: 'img_2', label: 'Image 2' },
      ],
      itemBeingCreated: false,
      itemsBeingEdited: [],
    })
  })

  it('cards-view validation fails while inline create or edit is in progress', () => {
    const relationship = controller({
      path: 'todoImages',
      label: 'Todo Images',
      fieldMeta: {
        many: true,
        ui: { displayMode: 'cards' },
      },
    })

    expect(
      relationship.validate(
        {
          kind: 'cards-view',
          initialValue: [{ id: 'img_1', label: 'Image 1' }],
          value: [{ id: 'img_1', label: 'Image 1' }],
          itemBeingCreated: false,
          itemsBeingEdited: [],
        },
        { isRequired: false },
      ),
    ).toBe(true)

    expect(
      relationship.validate(
        {
          kind: 'cards-view',
          initialValue: [{ id: 'img_1', label: 'Image 1' }],
          value: [{ id: 'img_1', label: 'Image 1' }],
          itemBeingCreated: true,
          itemsBeingEdited: [],
        },
        { isRequired: false },
      ),
    ).toBe(false)

    expect(
      relationship.validate(
        {
          kind: 'cards-view',
          initialValue: [{ id: 'img_1', label: 'Image 1' }],
          value: [{ id: 'img_1', label: 'Image 1' }],
          itemBeingCreated: false,
          itemsBeingEdited: ['img_1'],
        },
        { isRequired: false },
      ),
    ).toBe(false)
  })

  it('cards-view create-sheet close clears create-in-progress state without changing selected values', () => {
    expect(
      relationshipCardsStateAfterCreateSheetClose({
        kind: 'cards-view',
        initialValue: [{ id: 'img_1', label: 'Image 1' }],
        value: [{ id: 'img_1', label: 'Image 1' }],
        itemBeingCreated: true,
        itemsBeingEdited: ['img_2'],
      }),
    ).toEqual({
      kind: 'cards-view',
      initialValue: [{ id: 'img_1', label: 'Image 1' }],
      value: [{ id: 'img_1', label: 'Image 1' }],
      itemBeingCreated: false,
      itemsBeingEdited: ['img_2'],
    })
  })

  it('cards-view edit-sheet close removes only the closing id from edit-in-progress state', () => {
    expect(
      relationshipCardsStateAfterEditSheetClose(
        {
          kind: 'cards-view',
          initialValue: [{ id: 'img_1', label: 'Image 1' }],
          value: [
            { id: 'img_1', label: 'Image 1' },
            { id: 'img_2', label: 'Image 2' },
          ],
          itemBeingCreated: false,
          itemsBeingEdited: ['img_1', 'img_2'],
        },
        'img_1',
      ),
    ).toEqual({
      kind: 'cards-view',
      initialValue: [{ id: 'img_1', label: 'Image 1' }],
      value: [
        { id: 'img_1', label: 'Image 1' },
        { id: 'img_2', label: 'Image 2' },
      ],
      itemBeingCreated: false,
      itemsBeingEdited: ['img_2'],
    })
  })

  it('expands card fields to controller GraphQL selections before querying related items', () => {
    expect(
      relationshipCardFieldSelections(
        {
          fields: [
            {
              path: 'image',
              fieldMeta: {
                graphqlSelection:
                  'image { id url extension filesize width height }',
              },
            },
            {
              path: 'altText',
              fieldMeta: { graphqlSelection: 'altText' },
            },
          ],
        } as any,
        ['image', 'altText', 'missingField'],
      ),
    ).toEqual([
      'image { id url extension filesize width height }',
      'altText',
      'missingField',
    ])
  })

  it('preserves card field selections in relationship query keys', () => {
    expect(
      dashboardQueryKeys.relationshipOptions('TodoImage', '', 20, 0, {
        labelField: 'id',
        searchFields: ['id'],
        extraSelection: ['image', 'altText', 'imagePath'],
      }),
    ).toEqual([
      'dashboard',
      'relationshipOptions',
      'TodoImage',
      '',
      20,
      0,
      {
        extraSelection: 'image,altText,imagePath',
        labelField: 'id',
        searchFields: 'id',
      },
    ])
  })
})
