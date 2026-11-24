import type { CmsField, CmsList } from './types'

/**
 * Keystone assigns view ids to the actual field view module identifiers.  The
 * dashboard keeps the identifiers human-readable for the generated artifact,
 * while custom modules retain the path supplied in `ui.views`.
 */
export const DEFAULT_VIEW_ORDER = [
  'id',
  'text',
  'password',
  'relationship',
  'timestamp',
  'calendarDay',
  'checkbox',
  'document',
  'structure',
  'select',
  'integer',
  'multiselect',
  'float',
  'decimal',
  'bigInt',
  'json',
  'image',
  'file',
  'virtual',
] as const

const keystoneViewPathToKind: Record<string, string> = {
  '@keystone-6/core/fields/types/text/views': 'text',
  '@keystone-6/core/fields/types/password/views': 'password',
  '@keystone-6/core/fields/types/relationship/views': 'relationship',
  '@keystone-6/core/fields/types/json/views': 'json',
  '@keystone-6/core/fields/types/timestamp/views': 'timestamp',
  '@keystone-6/core/fields/types/calendarDay/views': 'calendarDay',
  '@keystone-6/core/fields/types/checkbox/views': 'checkbox',
  '@keystone-6/core/fields/types/select/views': 'select',
  '@keystone-6/core/fields/types/integer/views': 'integer',
  '@keystone-6/core/fields/types/bigInt/views': 'bigInt',
  '@keystone-6/core/fields/types/float/views': 'float',
  '@keystone-6/core/fields/types/decimal/views': 'decimal',
  '@keystone-6/core/fields/types/image/views': 'image',
  '@keystone-6/core/fields/types/file/views': 'file',
  '@keystone-6/core/fields/types/virtual/views': 'virtual',
  '@keystone-6/core/fields/types/multiselect/views': 'multiselect',
  '@keystone-6/fields-document/views': 'document',
  '@keystone-6/fields-document/structure-views': 'structure',
}

export function fieldViewKind(field: CmsField) {
  if (typeof field.viewsIndex === 'string')
    return keystoneViewPathToKind[field.viewsIndex] ?? field.viewsIndex
  const fieldMetaView = field.fieldMeta?.views
  if (typeof fieldMetaView === 'string')
    return keystoneViewPathToKind[fieldMetaView] ?? fieldMetaView
  return field.kind
}

export function customViewPath(field: CmsField) {
  const ui = field.fieldMeta?.ui
  if (!ui || typeof ui !== 'object' || Array.isArray(ui)) return undefined
  const views = (ui as Record<string, unknown>).views
  return typeof views === 'string' && views.trim() ? views : undefined
}

/** Return the canonical view identifiers in Keystone's first-seen order. */
export function generateViewOrder(lists: CmsList[]) {
  const views: string[] = []
  for (const view of DEFAULT_VIEW_ORDER) {
    if (
      lists.some((list) =>
        list.fields.some((field) => fieldViewKind(field) === view),
      )
    )
      views.push(view)
  }
  for (const list of lists) {
    for (const field of list.fields) {
      const view = fieldViewKind(field)
      if (!views.includes(view)) views.push(view)
    }
  }
  for (const list of lists) {
    for (const field of list.fields) {
      const view = customViewPath(field)
      if (view && !views.includes(view)) views.push(view)
    }
  }
  return views
}

export function viewIndexForField(
  field: CmsField,
  viewOrder: readonly string[],
) {
  if (typeof field.viewsIndex === 'number') return field.viewsIndex
  const view = fieldViewKind(field)
  const index = viewOrder.indexOf(view)
  return index === -1 ? viewOrder.length : index
}

export function customViewIndexForField(
  field: CmsField,
  viewOrder: readonly string[],
) {
  const view = customViewPath(field)
  if (!view) return null
  const index = viewOrder.indexOf(view)
  return index === -1 ? viewOrder.length : index
}
