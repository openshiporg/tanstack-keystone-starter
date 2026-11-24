import { useState } from 'react'
import { CalendarIcon, Clock3 } from 'lucide-react'

import type { DashboardField } from '@/features/cms/graphql-client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Value =
  | { kind: 'create'; value: string | null }
  | { kind: 'update'; value: string | null; initial: string | null }

type TimestampFieldMeta = {
  defaultValue?: string | { kind: 'now' } | null
  updatedAt?: boolean
}

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDateTime(value: Date) {
  return dateTimeFormatter.format(value)
}

function formatTimeInputValue(value: Date) {
  const hours = String(value.getHours()).padStart(2, '0')
  const minutes = String(value.getMinutes()).padStart(2, '0')
  const seconds = String(value.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

function formatDateInputValue(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function mergeDateAndTime({
  currentValue,
  nextDate,
  nextTime,
}: {
  currentValue: Date | null
  nextDate?: string | null
  nextTime?: string | null
}) {
  const base = currentValue ? new Date(currentValue) : new Date()
  if (nextDate) {
    const [year, month, day] = nextDate.split('-').map(Number)
    base.setFullYear(year, (month || 1) - 1, day || 1)
  }
  if (nextTime) {
    const [hours, minutes, seconds] = nextTime.split(':').map(Number)
    base.setHours(hours || 0, minutes || 0, seconds || 0, 0)
  }
  return base.toISOString()
}

function normalizeValue(value: unknown): Value {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    if (record.kind === 'create' || record.kind === 'update')
      return record as Value
  }
  const raw =
    value === null || value === undefined || value === '' ? null : String(value)
  return { kind: 'update', initial: raw, value: raw }
}

function fieldMeta(field: DashboardField): TimestampFieldMeta {
  const nestedMeta = field.fieldMeta.fieldMeta
  if (
    nestedMeta &&
    typeof nestedMeta === 'object' &&
    !Array.isArray(nestedMeta)
  ) {
    return nestedMeta
  }
  return field.fieldMeta
}

function validate(
  value: Value,
  meta: TimestampFieldMeta,
  isRequired: boolean,
  label: string,
): string | undefined {
  const isEmpty = !value.value

  if (value.kind === 'update' && value.initial === null && isEmpty)
    return undefined

  if (
    value.kind === 'create' &&
    isEmpty &&
    ((typeof meta.defaultValue === 'object' &&
      meta.defaultValue?.kind === 'now') ||
      meta.updatedAt)
  ) {
    return undefined
  }

  if (isRequired && isEmpty) return `${label} is required`
  return undefined
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
  const [isDirty, setDirty] = useState(false)
  const normalized = normalizeValue(value)
  const meta = fieldMeta(field)
  const dateValue = normalized.value ? new Date(normalized.value) : null
  const validationMessage =
    forceValidation || isDirty
      ? validate(normalized, meta, isRequired, field.label)
      : undefined

  if (!onChange) {
    return (
      <div className="space-y-2">
        <Label>{field.label}</Label>
        {field.description ? (
          <p className="text-[13px] text-[var(--ks-dim)]">{field.description}</p>
        ) : null}
        <Input
          id={`field-${field.path}`}
          readOnly
          tabIndex={-1}
          value={dateValue ? dateValue.toLocaleString() : 'yyyy-mm-dd --:--:--'}
          className="cursor-default bg-[var(--ks-track)]"
          onFocus={(event) => event.target.blur()}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label className={validationMessage ? 'text-[var(--ks-danger)]' : ''}>
        {field.label}
      </Label>
      {field.description ? (
        <p className="text-[13px] text-[var(--ks-dim)]">{field.description}</p>
      ) : null}
      <div className="space-y-3 rounded-[10px] p-3 shadow-[inset_0_0_0_1px_var(--ks-line)]">
        <div
          className={cn(
            'flex items-center gap-2 text-[13px]',
            !dateValue && 'text-[var(--ks-dim)]',
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          <span>
            {dateValue ? formatDateTime(dateValue) : 'Pick a date and time'}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`field-${field.path}`} className="text-[13px]">
              Date
            </Label>
            <Input
              id={`field-${field.path}`}
              type="date"
              autoFocus={autoFocus}
              value={dateValue ? formatDateInputValue(dateValue) : ''}
              onBlur={() => setDirty(true)}
              className={validationMessage ? 'shadow-[inset_0_0_0_1px_var(--ks-danger)]' : undefined}
              onChange={(event) => {
                const nextDate = event.target.value
                if (!nextDate) {
                  onChange({ ...normalized, value: null } satisfies Value)
                } else {
                  onChange({
                    ...normalized,
                    value: mergeDateAndTime({
                      currentValue: dateValue,
                      nextDate,
                      nextTime: dateValue
                        ? formatTimeInputValue(dateValue)
                        : '00:00:00',
                    }),
                  } satisfies Value)
                }
                setDirty(true)
              }}
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor={`field-${field.path}-time`}
              className="text-[13px] flex items-center gap-2"
            >
              <Clock3 className="h-4 w-4" />
              Time
            </Label>
            <Input
              id={`field-${field.path}-time`}
              type="time"
              step="1"
              value={dateValue ? formatTimeInputValue(dateValue) : ''}
              onBlur={() => setDirty(true)}
              className={validationMessage ? 'shadow-[inset_0_0_0_1px_var(--ks-danger)]' : undefined}
              onChange={(event) => {
                const nextTime = event.target.value
                if (!dateValue && !nextTime) {
                  onChange({ ...normalized, value: null } satisfies Value)
                } else {
                  onChange({
                    ...normalized,
                    value: mergeDateAndTime({
                      currentValue: dateValue,
                      nextDate: dateValue
                        ? formatDateInputValue(dateValue)
                        : new Date().toISOString().slice(0, 10),
                      nextTime,
                    }),
                  } satisfies Value)
                }
                setDirty(true)
              }}
            />
          </div>
        </div>
      </div>
      {validationMessage ? (
        <div className="text-[12px] text-[var(--ks-danger)]" role="alert">
          {validationMessage}
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
  return (
    <span className="text-[13px]">
      {value ? (
        formatDateTime(new Date(String(value)))
      ) : (
        <span className="text-[var(--ks-dim)]">—</span>
      )}
    </span>
  )
}

export function controller(config: {
  path: string
  label: string
  description?: string | null
  fieldMeta: Record<string, unknown>
}) {
  const meta = config.fieldMeta
  return {
    path: config.path,
    label: config.label,
    description: config.description,
    graphqlSelection:
      typeof config.fieldMeta.graphqlSelection === 'string'
        ? config.fieldMeta.graphqlSelection
        : config.path,
    defaultValue: {
      kind: 'create',
      value: typeof meta.defaultValue === 'string' ? meta.defaultValue : null,
    } satisfies Value,
    deserialize: (item: Record<string, unknown>) => {
      const raw = item[config.path]
      return {
        kind: 'update',
        value: raw == null ? null : String(raw),
        initial: raw == null ? null : String(raw),
      } satisfies Value
    },
    serialize: (value: unknown) => {
      const normalized = normalizeValue(value)
      return { [config.path]: normalized.value }
    },
    validate: (value: unknown, opts: { isRequired: boolean }) =>
      validate(normalizeValue(value), meta, opts.isRequired, config.label) ===
      undefined,
  }
}

export const allowedExportsOnCustomViews = ['Cell', 'CardValue']
