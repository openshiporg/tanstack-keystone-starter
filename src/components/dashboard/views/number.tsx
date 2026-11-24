import { Info } from 'lucide-react'
import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DashboardField } from '@/features/cms/graphql-client'

type NumberDashboardField = Pick<
  DashboardField,
  'kind' | 'path' | 'label' | 'fieldMeta'
> &
  Partial<Pick<DashboardField, 'description'>>

type IntegerValue =
  | { kind: 'create'; value: number | null }
  | { kind: 'update'; initial: number | null; value: number | null }

type StringNumberValue =
  | { kind: 'create'; value: string | null }
  | { kind: 'update'; initial: string | null; value: string | null }

type NumberValidation = {
  min?: number | string | null
  max?: number | string | null
}

function normalizeIntegerValue(value: unknown): IntegerValue {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    if (record.kind === 'create' || record.kind === 'update')
      return record as IntegerValue
  }
  const parsed =
    value === null || value === undefined || value === '' ? null : Number(value)
  return {
    kind: 'update',
    initial: Number.isFinite(parsed) ? parsed : null,
    value: Number.isFinite(parsed) ? parsed : null,
  }
}

function normalizeStringNumberValue(value: unknown): StringNumberValue {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    if (record.kind === 'create' || record.kind === 'update')
      return record as StringNumberValue
  }
  const raw =
    value === null || value === undefined || value === '' ? null : String(value)
  return { kind: 'update', initial: raw, value: raw }
}

function isFloatLike(kind?: string) {
  return kind === 'float'
}

function isDecimalLike(kind?: string) {
  return kind === 'decimal'
}

function isBigIntLike(kind?: string) {
  return kind === 'bigInt'
}

function validationFromMeta(field: NumberDashboardField): NumberValidation {
  const validation = field.fieldMeta.validation
  return validation &&
    typeof validation === 'object' &&
    !Array.isArray(validation)
    ? validation
    : {}
}

function defaultValueFromMeta(field: NumberDashboardField) {
  return field.fieldMeta.defaultValue
}

function integerValidationMessage(
  value: IntegerValue,
  field: NumberDashboardField,
  isRequired: boolean,
) {
  const validation = validationFromMeta(field)
  const hasAutoIncrementDefault =
    defaultValueFromMeta(field) === 'autoincrement'
  if (
    value.kind === 'create' &&
    hasAutoIncrementDefault &&
    value.value === null
  )
    return undefined
  if (value.kind === 'update' && value.initial === null && value.value === null)
    return undefined
  if (isRequired && value.value === null) return `${field.label} is required`
  if (typeof value.value !== 'number') return undefined
  if (!Number.isInteger(value.value))
    return `${field.label} is not a valid integer`
  if (validation.min != null && value.value < Number(validation.min))
    return `${field.label} must be greater than or equal to ${validation.min}`
  if (validation.max != null && value.value > Number(validation.max))
    return `${field.label} must be less than or equal to ${validation.max}`
  return undefined
}

function decimalValidationMessage(
  value: StringNumberValue,
  field: NumberDashboardField,
  isRequired: boolean,
) {
  const validation = validationFromMeta(field)
  if (value.kind === 'update' && value.initial === null && value.value === null)
    return undefined
  if (isRequired && value.value === null) return `${field.label} is required`
  if (typeof value.value !== 'string') return undefined
  const parsed = Number.parseFloat(value.value)
  if (Number.isNaN(parsed)) return `${field.label} is not a valid number`
  if (validation.min != null && parsed < Number(validation.min))
    return `${field.label} must be greater than or equal to ${validation.min}`
  if (validation.max != null && parsed > Number(validation.max))
    return `${field.label} must be less than or equal to ${validation.max}`
  return undefined
}

function bigIntValidationMessage(
  value: StringNumberValue,
  field: NumberDashboardField,
  isRequired: boolean,
) {
  const validation = validationFromMeta(field)
  const hasAutoIncrementDefault =
    defaultValueFromMeta(field) === 'autoincrement'
  if (
    value.kind === 'create' &&
    hasAutoIncrementDefault &&
    value.value === null
  )
    return undefined
  if (value.kind === 'update' && value.initial === null && value.value === null)
    return undefined
  if (isRequired && value.value === null) return `${field.label} is required`
  if (typeof value.value !== 'string') return undefined
  try {
    const parsed = BigInt(value.value)
    if (validation.min != null && parsed < BigInt(String(validation.min)))
      return `${field.label} must be greater than or equal to ${validation.min}`
    if (validation.max != null && parsed > BigInt(String(validation.max)))
      return `${field.label} must be less than or equal to ${validation.max}`
    return undefined
  } catch {
    return `${field.label} is not a valid BigInt`
  }
}

export function Field({
  field,
  value,
  onChange,
  isRequired = false,
  autoFocus = false,
  forceValidation = false,
}: {
  field: NumberDashboardField
  value: unknown
  onChange?: (value: unknown) => void
  isRequired?: boolean
  autoFocus?: boolean
  forceValidation?: boolean
}) {
  const [isDirty, setDirty] = useState(false)

  if (!onChange) {
    return value === null || value === undefined || value === '' ? (
      <span className="text-sm text-muted-foreground">—</span>
    ) : (
      <span className="text-sm select-text">{String(value)}</span>
    )
  }

  if (field.kind === 'integer') {
    const normalized = normalizeIntegerValue(value)
    const hasAutoIncrementDefault =
      defaultValueFromMeta(field) === 'autoincrement'
    const errorMessage =
      forceValidation || isDirty
        ? integerValidationMessage(normalized, field, isRequired)
        : undefined

    if (
      hasAutoIncrementDefault &&
      normalized.kind === 'create' &&
      normalized.value === null
    ) {
      return (
        <div className="space-y-2">
          <Label>{field.label}</Label>
          {field.description ? (
            <p className="text-sm text-muted-foreground">{field.description}</p>
          ) : null}
          <Input
            id={`field-${field.path}`}
            autoFocus={autoFocus}
            readOnly
            value="Auto increment"
            className="bg-muted shadow-xs"
          />
          <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This field is set to auto increment. It will default to the next
              available number.
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <Label>{field.label}</Label>
        {field.description ? (
          <p className="text-sm text-muted-foreground">{field.description}</p>
        ) : null}
        <Input
          id={`field-${field.path}`}
          type="number"
          step="1"
          autoFocus={autoFocus}
          value={normalized.value ?? ''}
          required={isRequired}
          onBlur={() => setDirty(true)}
          className={errorMessage ? 'border-red-500 shadow-xs' : 'shadow-xs'}
          onChange={(event) => {
            const next =
              event.target.value === '' ? null : Number(event.target.value)
            onChange({
              ...normalized,
              value: Number.isFinite(next) ? next : null,
            } satisfies IntegerValue)
          }}
        />
        {errorMessage ? (
          <p className="text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>
    )
  }

  if (isBigIntLike(field.kind)) {
    const normalized = normalizeStringNumberValue(value)
    const hasAutoIncrementDefault =
      defaultValueFromMeta(field) === 'autoincrement'
    const errorMessage =
      forceValidation || isDirty
        ? bigIntValidationMessage(normalized, field, isRequired)
        : undefined

    if (
      hasAutoIncrementDefault &&
      normalized.kind === 'create' &&
      normalized.value === null
    ) {
      return (
        <div className="space-y-2">
          <Label>{field.label}</Label>
          {field.description ? (
            <p className="text-sm text-muted-foreground">{field.description}</p>
          ) : null}
          <Input
            id={`field-${field.path}`}
            autoFocus={autoFocus}
            readOnly
            value="Auto increment"
            className="bg-muted shadow-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            This field is set to auto increment. It will default to the next
            available number.
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <Label>{field.label}</Label>
        {field.description ? (
          <p className="text-sm text-muted-foreground">{field.description}</p>
        ) : null}
        <Input
          id={`field-${field.path}`}
          autoFocus={autoFocus}
          inputMode="numeric"
          value={normalized.value ?? ''}
          required={isRequired}
          onBlur={() => setDirty(true)}
          className={errorMessage ? 'border-red-500 shadow-xs' : 'shadow-xs'}
          onChange={(event) =>
            onChange({
              ...normalized,
              value: event.target.value === '' ? null : event.target.value,
            } satisfies StringNumberValue)
          }
        />
        {errorMessage ? (
          <p className="text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>
    )
  }

  const normalized = normalizeStringNumberValue(value)
  const errorMessage =
    forceValidation || isDirty
      ? decimalValidationMessage(normalized, field, isRequired)
      : undefined
  return (
    <div className="space-y-2">
      <Label>{field.label}</Label>
      {field.description ? (
        <p className="text-sm text-muted-foreground">{field.description}</p>
      ) : null}
      <Input
        id={`field-${field.path}`}
        type="number"
        step="any"
        autoFocus={autoFocus}
        value={normalized.value ?? ''}
        required={isRequired}
        onBlur={() => setDirty(true)}
        className={errorMessage ? 'border-red-500 shadow-xs' : 'shadow-xs'}
        onChange={(event) =>
          onChange({
            ...normalized,
            value: event.target.value === '' ? null : event.target.value,
          } satisfies StringNumberValue)
        }
      />
      {errorMessage ? (
        <p className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
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
  return value === null || value === undefined || value === '' ? (
    <span className="text-sm text-muted-foreground">—</span>
  ) : (
    <span className="text-sm select-text">{String(value)}</span>
  )
}

export function controller(config: {
  path: string
  label: string
  description?: string | null
  fieldMeta: Record<string, unknown>
  kind?: string
}) {
  const integerLike = config.kind === 'integer'
  const floatLike = isFloatLike(config.kind)
  const bigIntLike = isBigIntLike(config.kind)
  const decimalLike = isDecimalLike(config.kind)
  const fieldStub = {
    label: config.label,
    fieldMeta: config.fieldMeta,
  } as NumberDashboardField
  const configuredDefaultValue = defaultValueFromMeta(fieldStub)

  return {
    path: config.path,
    label: config.label,
    description: config.description,
    graphqlSelection:
      typeof config.fieldMeta.graphqlSelection === 'string'
        ? config.fieldMeta.graphqlSelection
        : config.path,
    defaultValue: integerLike
      ? ({
          kind: 'create',
          value:
            configuredDefaultValue === 'autoincrement'
              ? null
              : typeof configuredDefaultValue === 'number'
                ? configuredDefaultValue
                : null,
        } satisfies IntegerValue)
      : ({
          kind: 'create',
          value:
            configuredDefaultValue === 'autoincrement'
              ? null
              : configuredDefaultValue == null
                ? null
                : String(configuredDefaultValue),
        } satisfies StringNumberValue),
    deserialize: (item: Record<string, unknown>) => {
      const value = item[config.path]
      if (integerLike) return normalizeIntegerValue(value)
      return normalizeStringNumberValue(value)
    },
    serialize: (value: unknown) => {
      if (integerLike) {
        const normalized = normalizeIntegerValue(value)
        return { [config.path]: normalized.value }
      }
      if (bigIntLike) {
        const normalized = normalizeStringNumberValue(value)
        return { [config.path]: normalized.value }
      }
      if (decimalLike) {
        const normalized = normalizeStringNumberValue(value)
        return { [config.path]: normalized.value }
      }
      const normalized = normalizeStringNumberValue(value)
      const parsed =
        normalized.value === null ? null : Number.parseFloat(normalized.value)
      return {
        [config.path]:
          normalized.value === null
            ? null
            : Number.isFinite(parsed)
              ? parsed
              : null,
      }
    },
    validate: (value: unknown, opts: { isRequired: boolean }) => {
      if (integerLike)
        return (
          integerValidationMessage(
            normalizeIntegerValue(value),
            fieldStub,
            opts.isRequired,
          ) === undefined
        )
      if (bigIntLike)
        return (
          bigIntValidationMessage(
            normalizeStringNumberValue(value),
            fieldStub,
            opts.isRequired,
          ) === undefined
        )
      if (floatLike || decimalLike)
        return (
          decimalValidationMessage(
            normalizeStringNumberValue(value),
            fieldStub,
            opts.isRequired,
          ) === undefined
        )
      return true
    },
  }
}

export const allowedExportsOnCustomViews = ['Cell', 'CardValue']
