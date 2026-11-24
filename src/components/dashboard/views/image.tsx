import type { DashboardField } from '@/features/cms/graphql-client'

import {
  FileFieldEditor,
  normalizeFileFieldEditorValue,
} from '../file-field-editor'
import type { FileFieldEditorValue } from '../file-field-editor'
import {
  displayFieldValue,
  isEditableDashboardField,
} from '../field-value-editor'

export function Field({
  field,
  value,
  onChange,
  view = 'itemView',
}: {
  field: DashboardField
  value: unknown
  onChange?: (value: unknown) => void
  view?: 'createView' | 'itemView'
}) {
  if (!onChange || !isEditableDashboardField(field, view))
    return displayFieldValue(field.kind, value)
  return (
    <FileFieldEditor
      field={field}
      value={normalizeFileFieldEditorValue(value)}
      onChange={onChange}
    />
  )
}

export function Cell({
  field,
  item,
}: {
  field: DashboardField
  item: Record<string, unknown>
}) {
  return displayFieldValue(field.kind, item[field.path])
}

export function controller(config: {
  path: string
  label: string
  description?: string | null
  fieldMeta: Record<string, unknown>
}) {
  return {
    path: config.path,
    label: config.label,
    description: config.description,
    graphqlSelection:
      typeof config.fieldMeta.graphqlSelection === 'string'
        ? config.fieldMeta.graphqlSelection
        : config.path,
    defaultValue: { kind: 'empty' } satisfies FileFieldEditorValue,
    deserialize: (item: Record<string, unknown>) =>
      normalizeFileFieldEditorValue(item[config.path]),
    serialize: (value: unknown) => {
      const normalized = normalizeFileFieldEditorValue(value)
      if (normalized.kind === 'upload')
        return { [config.path]: { upload: normalized.data.file } }
      if (normalized.kind === 'remove') return { [config.path]: null }
      return {}
    },
    validate: (value: unknown, opts: { isRequired: boolean }) => {
      const normalized = normalizeFileFieldEditorValue(value)
      if (opts.isRequired)
        return normalized.kind === 'from-server' || normalized.kind === 'upload'
      return true
    },
  }
}

export const allowedExportsOnCustomViews = ['Cell', 'CardValue']
