import { useState } from 'react'

import type { DashboardField } from '@/features/cms/graphql-client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Value =
  | { kind: 'create'; value: string | null }
  | { kind: 'update'; value: string | null; initial: string | null }

function normalizeValue(value: unknown): Value {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    if (record.kind === 'create' || record.kind === 'update')
      return record as Value
  }
  const raw = value == null || value === '' ? null : String(value).slice(0, 10)
  return { kind: 'update', value: raw, initial: raw }
}

export function Field({
  field,
  value,
  onChange,
  autoFocus = false,
  forceValidation = false,
  isRequired = false,
}: {
  field: DashboardField
  value: unknown
  onChange?: (value: unknown) => void
  autoFocus?: boolean
  forceValidation?: boolean
  isRequired?: boolean
}) {
  const [dirty, setDirty] = useState(false)
  const normalized = normalizeValue(value)
  const invalid = isRequired && !normalized.value && (dirty || forceValidation)
  return (
    <div className="space-y-2">
      <Label
        htmlFor={`field-${field.path}`}
        className={invalid ? 'text-red-600' : undefined}
      >
        {field.label}
      </Label>
      {field.description ? (
        <p className="text-sm text-muted-foreground">{field.description}</p>
      ) : null}
      <Input
        id={`field-${field.path}`}
        type="date"
        autoFocus={autoFocus}
        readOnly={!onChange}
        value={normalized.value ?? ''}
        className={invalid ? 'border-red-500' : undefined}
        onBlur={() => setDirty(true)}
        onChange={(event) => {
          onChange?.({ ...normalized, value: event.target.value || null })
          setDirty(true)
        }}
      />
      {invalid ? (
        <div className="text-sm text-red-600" role="alert">
          {field.label} is required
        </div>
      ) : null}
    </div>
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
  return value ? (
    <span className="text-sm">{String(value).slice(0, 10)}</span>
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
  const defaultValue =
    typeof config.fieldMeta.defaultValue === 'string'
      ? config.fieldMeta.defaultValue
      : null
  return {
    path: config.path,
    label: config.label,
    description: config.description,
    graphqlSelection: config.path,
    defaultValue: { kind: 'create', value: defaultValue } satisfies Value,
    deserialize: (item: Record<string, unknown>) => {
      const raw = item[config.path]
      const value = raw == null ? null : String(raw).slice(0, 10)
      return { kind: 'update', value, initial: value } satisfies Value
    },
    serialize: (value: unknown) => ({
      [config.path]: normalizeValue(value).value,
    }),
    validate: (value: unknown, opts: { isRequired: boolean }) =>
      !opts.isRequired || Boolean(normalizeValue(value).value),
  }
}

export const allowedExportsOnCustomViews = ['Cell', 'CardValue']
