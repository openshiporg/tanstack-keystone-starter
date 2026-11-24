import type { DashboardField } from '@/features/cms/graphql-client'

import { Textarea } from '@/components/ui/textarea'

function asEditorValue(value: unknown) {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return JSON.stringify(value, null, 2)
}

export function Field({
  field,
  value,
  onChange,
}: {
  field: DashboardField
  value: unknown
  onChange?: (value: unknown) => void
}) {
  if (!onChange) {
    if (value === null || value === undefined || value === '')
      return <span className="text-sm text-muted-foreground">—</span>
    return (
      <pre className="overflow-auto rounded bg-muted p-2 text-xs">
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    )
  }

  return (
    <Textarea
      id={`field-${field.path}`}
      rows={6}
      value={asEditorValue(value)}
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
  const value = item[field.path]
  if (value === null || value === undefined || value === '')
    return <span className="text-sm text-muted-foreground">—</span>
  return (
    <span className="text-xs text-muted-foreground italic">Complex data</span>
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
    deserialize: (item: Record<string, unknown>) =>
      asEditorValue(item[config.path]),
    serialize: (value: unknown) => {
      const raw = String(value ?? '').trim()
      return { [config.path]: raw ? JSON.parse(raw) : undefined }
    },
    validate: (value: unknown, opts: { isRequired: boolean }) => {
      const raw = String(value ?? '').trim()
      if (!raw) return !opts.isRequired
      try {
        JSON.parse(raw)
        return true
      } catch {
        return false
      }
    },
  }
}

export const allowedExportsOnCustomViews = ['Cell', 'CardValue']
