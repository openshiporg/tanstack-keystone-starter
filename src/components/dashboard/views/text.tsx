import type { DashboardField } from '@/features/cms/graphql-client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export function Field({
  field,
  value,
  onChange,
}: {
  field: DashboardField
  value: unknown
  onChange?: (value: unknown) => void
}) {
  const displayMode =
    field.fieldMeta.displayMode ??
    (field.fieldMeta.ui && typeof field.fieldMeta.ui === 'object'
      ? (field.fieldMeta.ui as Record<string, unknown>).displayMode
      : undefined)

  if (!onChange) {
    const display = String(value ?? '').trim()
    return display ? (
      <span className="text-sm select-text">{display}</span>
    ) : (
      <span className="text-sm text-muted-foreground">—</span>
    )
  }

  if (displayMode === 'textarea') {
    return (
      <Textarea
        id={`field-${field.path}`}
        value={String(value ?? '')}
        placeholder={field.description || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  return (
    <Input
      id={`field-${field.path}`}
      type="text"
      value={String(value ?? '')}
      placeholder={field.description || undefined}
      onChange={(event) => onChange(event.target.value)}
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
  const display = String(item[field.path] ?? '').trim()
  return display ? (
    <span className="text-sm select-text">{display}</span>
  ) : (
    <span className="text-sm text-muted-foreground">—</span>
  )
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
    defaultValue: '',
    deserialize: (item: Record<string, unknown>) => {
      const value = item[config.path]
      return value === null || value === undefined ? '' : String(value)
    },
    serialize: (value: unknown) => {
      const raw = String(value ?? '').trim()
      return { [config.path]: raw || undefined }
    },
    validate: (value: unknown, opts: { isRequired: boolean }) =>
      !opts.isRequired || String(value ?? '').trim().length > 0,
  }
}

export const allowedExportsOnCustomViews = ['Cell', 'CardValue']
