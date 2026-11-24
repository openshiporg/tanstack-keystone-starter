import type { DashboardField } from '@/features/cms/graphql-client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

type Option = { label: string; value: string }

type SelectValue =
  | { value: Option | null; kind: 'create' }
  | { value: Option | null; initial: Option | null; kind: 'update' }

type MultiSelectValue = readonly Option[]

type SelectDisplayMode = 'select' | 'segmented-control' | 'radio'
type SelectField = Pick<DashboardField, 'fieldMeta'> &
  Partial<Pick<DashboardField, 'kind' | 'options'>>
type SelectRenderField = SelectField &
  Pick<DashboardField, 'kind' | 'path' | 'label'> &
  Partial<Pick<DashboardField, 'description'>>

function optionsForField(field: SelectField) {
  const options = Array.isArray(field.fieldMeta.options)
    ? field.fieldMeta.options
    : Array.isArray(field.options)
      ? field.options
      : []
  return options.map((option) => ({
    label: String(option.label),
    value: String(option.value),
  }))
}

function selectDisplayMode(field: SelectField): SelectDisplayMode {
  const displayMode = field.fieldMeta.displayMode
  return displayMode === 'segmented-control' || displayMode === 'radio'
    ? displayMode
    : 'select'
}

function normalizeSelectValue(field: SelectField, value: unknown): SelectValue {
  const options = optionsForField(field)
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    if (record.kind === 'create' || record.kind === 'update')
      return record as SelectValue
  }
  const raw =
    value === null || value === undefined || value === '' ? null : String(value)
  const option = raw
    ? (options.find((entry) => entry.value === raw) ?? {
        label: raw,
        value: raw,
      })
    : null
  return { kind: 'update', initial: option, value: option }
}

function normalizeMultiSelectValue(
  field: SelectField,
  value: unknown,
): MultiSelectValue {
  const options = optionsForField(field)
  if (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        'value' in (entry as Record<string, unknown>),
    )
  ) {
    return value as MultiSelectValue
  }
  const values = Array.isArray(value)
    ? value.map((entry) => String(entry))
    : String(value ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
  return values.map(
    (entry) =>
      options.find((option) => option.value === entry) ?? {
        label: entry,
        value: entry,
      },
  )
}

export function Field({
  field,
  value,
  onChange,
  isRequired = false,
}: {
  field: SelectRenderField
  value: unknown
  onChange?: (value: unknown) => void
  isRequired?: boolean
}) {
  const options = optionsForField(field)

  if (!onChange) {
    if (field.kind === 'multiselect') {
      const values = normalizeMultiSelectValue(field, value)
      if (!values.length)
        return <span className="text-[13px] text-[var(--ks-dim)]">—</span>
      return (
        <span className="text-[13px] select-text">
          {values.map((entry) => entry.label).join(', ')}
        </span>
      )
    }
    const normalized = normalizeSelectValue(field, value)
    if (!normalized.value)
      return <span className="text-[13px] text-[var(--ks-dim)]">—</span>
    return <Badge variant="outline">{normalized.value.label}</Badge>
  }

  if (field.kind === 'multiselect') {
    const selected = new Set(
      normalizeMultiSelectValue(field, value).map((entry) => entry.value),
    )
    return (
      <div className="grid gap-2 rounded-[10px] p-3 shadow-[inset_0_0_0_1px_var(--ks-line)] sm:grid-cols-2">
        {options.map((option, index) => (
          <label
            key={option.value}
            className="inline-flex items-center gap-2 text-[13px]"
          >
            <input
              id={index === 0 ? `field-${field.path}` : undefined}
              type="checkbox"
              checked={selected.has(option.value)}
              onChange={(event) => {
                const next = new Set(selected)
                if (event.target.checked) next.add(option.value)
                else next.delete(option.value)
                onChange(
                  Array.from(next).map(
                    (entry) =>
                      options.find(
                        (candidate) => candidate.value === entry,
                      ) ?? { label: entry, value: entry },
                  ),
                )
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    )
  }

  const normalized = normalizeSelectValue(field, value)
  const displayMode = selectDisplayMode(field)
  const isNullable = !isRequired
  const isNull = isNullable && normalized.value === null

  const setValue = (next: Option | null) => {
    onChange({ ...normalized, value: next })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>{field.label}</Label>
        {field.description ? (
          <p className="text-[13px] text-[var(--ks-dim)]">{field.description}</p>
        ) : null}
      </div>

      {displayMode === 'segmented-control' ? (
        <div
          id={`field-${field.path}`}
          role="radiogroup"
          aria-label={field.label}
          className="flex flex-wrap gap-2"
        >
          {options.map((option) => {
            const selected = normalized.value?.value === option.value
            return (
              <Button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                size="sm"
                variant={selected ? 'default' : 'outline'}
                disabled={isNull}
                onClick={() => setValue(option)}
              >
                {option.label}
              </Button>
            )
          })}
        </div>
      ) : displayMode === 'radio' ? (
        <div
          id={`field-${field.path}`}
          role="radiogroup"
          aria-label={field.label}
          className="space-y-2 rounded-[10px] p-3 shadow-[inset_0_0_0_1px_var(--ks-line)]"
        >
          {options.map((option) => {
            const selected = normalized.value?.value === option.value
            return (
              <label
                key={option.value}
                className="flex items-center gap-2 text-[13px]"
              >
                <input
                  type="radio"
                  name={field.path}
                  checked={selected}
                  disabled={isNull}
                  onChange={() => setValue(option)}
                />
                {option.label}
              </label>
            )
          })}
        </div>
      ) : (
        <select
          id={`field-${field.path}`}
          className="ks-field h-8 w-full px-2 text-[13px]"
          value={normalized.value?.value ?? ''}
          onChange={(event) => {
            const next =
              options.find((option) => option.value === event.target.value) ??
              null
            setValue(next)
          }}
        >
          {!isRequired ? <option value="">Select {field.label}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {isNullable ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`field-${field.path}-null`}
            aria-label={`Set ${field.label} as null`}
            checked={isNull}
            onCheckedChange={(checked) => {
              if (checked) setValue(null)
              else if ('initial' in normalized && normalized.initial)
                setValue(normalized.initial)
              else if (options[0]) setValue(options[0])
            }}
          />
          <Label
            htmlFor={`field-${field.path}-null`}
            className="text-[13px] text-[var(--ks-dim)]"
          >
            Set field as null
          </Label>
        </div>
      ) : null}
    </div>
  )
}

export function Cell({
  field,
  item,
}: {
  field: SelectRenderField
  item: Record<string, unknown>
}) {
  const value = item[field.path]
  if (field.kind === 'multiselect') {
    const values = normalizeMultiSelectValue(field, value)
    if (!values.length)
      return <span className="text-[13px] text-[var(--ks-dim)]">—</span>
    return (
      <span className="text-[13px] select-text">
        {values.map((entry) => entry.label).join(', ')}
      </span>
    )
  }
  const normalized = normalizeSelectValue(field, value)
  if (!normalized.value)
    return <span className="text-[13px] text-[var(--ks-dim)]">—</span>
  return <Badge variant="outline">{normalized.value.label}</Badge>
}

export function controller(config: {
  path: string
  label: string
  description?: string | null
  fieldMeta: Record<string, unknown>
  kind?: string
}) {
  const options = Array.isArray(config.fieldMeta.options)
    ? config.fieldMeta.options.map((option) => ({
        label: String(option.label),
        value: String(option.value),
      }))
    : []

  return {
    path: config.path,
    label: config.label,
    description: config.description,
    graphqlSelection:
      typeof config.fieldMeta.graphqlSelection === 'string'
        ? config.fieldMeta.graphqlSelection
        : config.path,
    defaultValue:
      config.kind === 'multiselect'
        ? ([] satisfies MultiSelectValue)
        : ({ kind: 'create', value: null } satisfies SelectValue),
    deserialize: (item: Record<string, unknown>) => {
      const value = item[config.path]
      if (config.kind === 'multiselect')
        return normalizeMultiSelectValue({ fieldMeta: { options } }, value)
      return normalizeSelectValue(
        {
          fieldMeta: { options, displayMode: config.fieldMeta.displayMode },
        },
        value,
      )
    },
    serialize: (value: unknown) => {
      if (config.kind === 'multiselect') {
        return {
          [config.path]: normalizeMultiSelectValue(
            { fieldMeta: { options } },
            value,
          ).map((entry) => entry.value),
        }
      }
      return {
        [config.path]:
          normalizeSelectValue(
            {
              fieldMeta: { options, displayMode: config.fieldMeta.displayMode },
            },
            value,
          ).value?.value ?? null,
      }
    },
    validate: (value: unknown, opts: { isRequired: boolean }) => {
      if (config.kind === 'multiselect')
        return (
          !opts.isRequired ||
          normalizeMultiSelectValue({ fieldMeta: { options } }, value).length >
            0
        )
      return (
        !opts.isRequired ||
        normalizeSelectValue(
          {
            fieldMeta: { options, displayMode: config.fieldMeta.displayMode },
          },
          value,
        ).value !== null
      )
    },
  }
}

export const allowedExportsOnCustomViews = ['Cell', 'CardValue']
