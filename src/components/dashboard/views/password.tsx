import { Asterisk, Eye, EyeOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DashboardField } from '@/features/cms/graphql-client'
import { cn } from '@/lib/utils'

type PasswordDashboardField = Pick<
  DashboardField,
  'path' | 'label' | 'fieldMeta'
> &
  Partial<Pick<DashboardField, 'description' | 'kind'>>

type PasswordValue =
  | { kind: 'initial'; isSet: boolean | null }
  | { kind: 'editing'; isSet: boolean | null; value: string; confirm: string }

type PasswordValidation = {
  rejectCommon: boolean
  match: {
    regex: RegExp
    explanation: string
  } | null
  length: {
    min: number
    max: number | null
  }
}

function normalizePasswordValue(value: unknown): PasswordValue {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (record.kind === 'initial')
      return {
        kind: 'initial',
        isSet: typeof record.isSet === 'boolean' ? record.isSet : null,
      }
    if (record.kind === 'editing') {
      return {
        kind: 'editing',
        isSet: typeof record.isSet === 'boolean' ? record.isSet : null,
        value: typeof record.value === 'string' ? record.value : '',
        confirm: typeof record.confirm === 'string' ? record.confirm : '',
      }
    }
    if ('isSet' in record)
      return {
        kind: 'initial',
        isSet: typeof record.isSet === 'boolean' ? record.isSet : null,
      }
  }
  return { kind: 'initial', isSet: null }
}

function validationFromFieldMeta(
  field: Pick<DashboardField, 'fieldMeta'>,
): PasswordValidation {
  const record = field.fieldMeta
  const validation =
    record.validation &&
    typeof record.validation === 'object' &&
    !Array.isArray(record.validation)
      ? (record.validation as Record<string, unknown>)
      : {}
  const match =
    validation.match &&
    typeof validation.match === 'object' &&
    !Array.isArray(validation.match)
      ? (validation.match as Record<string, unknown>)
      : null
  const regex =
    match &&
    match.regex &&
    typeof match.regex === 'object' &&
    !Array.isArray(match.regex)
      ? (match.regex as Record<string, unknown>)
      : null

  return {
    rejectCommon: Boolean(validation.rejectCommon),
    match:
      match &&
      regex &&
      typeof match.explanation === 'string' &&
      typeof regex.source === 'string'
        ? {
            regex: new RegExp(
              regex.source,
              typeof regex.flags === 'string' ? regex.flags : '',
            ),
            explanation: match.explanation,
          }
        : null,
    length: {
      min:
        typeof validation.length === 'object' &&
        validation.length &&
        !Array.isArray(validation.length) &&
        typeof (validation.length as Record<string, unknown>).min === 'number'
          ? ((validation.length as Record<string, unknown>).min as number)
          : 1,
      max:
        typeof validation.length === 'object' &&
        validation.length &&
        !Array.isArray(validation.length) &&
        typeof (validation.length as Record<string, unknown>).max === 'number'
          ? ((validation.length as Record<string, unknown>).max as number)
          : null,
    },
  }
}

function validatePassword(
  value: PasswordValue,
  validation: PasswordValidation,
  isRequired: boolean,
  label: string,
) {
  if (value.kind === 'initial') {
    if (!isRequired || value.isSet === true || value.isSet === null)
      return undefined
    return `${label} is required`
  }
  if (value.confirm !== value.value) return 'The passwords do not match'
  if (value.value.length < validation.length.min) {
    if (validation.length.min === 1) return `${label} must not be empty`
    return `${label} must be at least ${validation.length.min} characters long`
  }
  if (
    validation.length.max !== null &&
    value.value.length > validation.length.max
  ) {
    return `${label} must be no longer than ${validation.length.max} characters`
  }
  if (validation.match && !validation.match.regex.test(value.value))
    return validation.match.explanation
  if (!value.value.trim())
    return isRequired ? `${label} is required` : undefined
  return undefined
}

export function passwordEditingStateAfterEscape(value: unknown, key: string) {
  const normalized = normalizePasswordValue(value)
  if (key !== 'Escape' || normalized.kind !== 'editing') return normalized
  if (normalized.value !== '' || normalized.confirm !== '') return normalized
  return { kind: 'initial', isSet: normalized.isSet } satisfies PasswordValue
}

export function Field({
  field,
  value,
  onChange,
  forceValidation,
  isRequired = false,
  autoFocus = false,
}: {
  field: PasswordDashboardField
  value: unknown
  onChange?: (value: unknown) => void
  forceValidation?: boolean
  isRequired?: boolean
  autoFocus?: boolean
}) {
  const normalized = normalizePasswordValue(value)
  const validation = validationFromFieldMeta(field)
  const [touched, setTouched] = useState({ value: false, confirm: false })
  const [secureTextEntry, setSecureTextEntry] = useState(true)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (normalized.kind === 'initial') {
      setTouched({ value: false, confirm: false })
      setSecureTextEntry(true)
    }
  }, [normalized.kind])

  const cancelEditing = () => {
    onChange?.({
      kind: 'initial',
      isSet: normalized.isSet,
    } satisfies PasswordValue)
    setTimeout(() => triggerRef.current?.focus(), 0)
  }

  const onEscape = (event: { key: string }) => {
    const next = passwordEditingStateAfterEscape(normalized, event.key)
    if (next.kind === 'initial' && normalized.kind === 'editing')
      cancelEditing()
  }

  if (!onChange) {
    const isIndeterminate = normalized.isSet == null
    const isSelected = normalized.isSet == null ? undefined : normalized.isSet
    return (
      <div className="space-y-2">
        <Label>{field.label}</Label>
        {field.description ? (
          <p className="text-[13px] text-[var(--ks-dim)]">{field.description}</p>
        ) : null}
        <div className="flex items-center space-x-2">
          <Checkbox
            aria-label={`${field.label} value status`}
            checked={isSelected}
            disabled
            className="opacity-50"
          />
          <Label className="text-[13px] text-[var(--ks-dim)]">
            {isIndeterminate ? 'Access denied' : 'Value is set'}
          </Label>
        </div>
      </div>
    )
  }

  if (normalized.kind === 'initial') {
    return (
      <div className="space-y-2">
        <Label>{field.label}</Label>
        {field.description ? (
          <p className="text-[13px] text-[var(--ks-dim)]">{field.description}</p>
        ) : null}
        <Button
          ref={triggerRef}
          id={`field-${field.path}`}
          type="button"
          variant="outline"
          autoFocus={autoFocus}
          onClick={() =>
            onChange({
              kind: 'editing',
              isSet: normalized.isSet,
              value: '',
              confirm: '',
            } satisfies PasswordValue)
          }
        >
          {normalized.isSet
            ? `Change ${field.label.toLowerCase()}`
            : `Set ${field.label.toLowerCase()}`}
        </Button>
      </div>
    )
  }

  const error =
    forceValidation || (touched.value && touched.confirm)
      ? validatePassword(normalized, validation, isRequired, field.label)
      : undefined

  return (
    <div className="space-y-3">
      <Label htmlFor={`field-${field.path}`}>{field.label}</Label>
      {field.description ? (
        <p className="text-[13px] text-[var(--ks-dim)]">{field.description}</p>
      ) : null}
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1">
          <Input
            id={`field-${field.path}`}
            autoFocus
            type={secureTextEntry ? 'password' : 'text'}
            value={normalized.value}
            required={isRequired}
            placeholder="New password"
            className={cn(error && 'shadow-[inset_0_0_0_1px_var(--ks-danger)]')}
            onBlur={() =>
              setTouched((current) => ({ ...current, value: true }))
            }
            onChange={(event) =>
              onChange({
                ...normalized,
                value: event.target.value,
              } satisfies PasswordValue)
            }
            onKeyDown={onEscape}
          />
        </div>
        <div className="flex-1">
          <Input
            id={`field-${field.path}-confirm`}
            aria-label={`Confirm ${field.label}`}
            type={secureTextEntry ? 'password' : 'text'}
            value={normalized.confirm}
            placeholder="Confirm password"
            className={cn(error && 'shadow-[inset_0_0_0_1px_var(--ks-danger)]')}
            onBlur={() =>
              setTouched((current) => ({ ...current, confirm: true }))
            }
            onChange={(event) =>
              onChange({
                ...normalized,
                confirm: event.target.value,
              } satisfies PasswordValue)
            }
            onKeyDown={onEscape}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setSecureTextEntry((current) => !current)}
            title={secureTextEntry ? 'Show password' : 'Hide password'}
          >
            {secureTextEntry ? (
              <Eye className="size-4" />
            ) : (
              <EyeOff className="size-4" />
            )}
          </Button>
          <Button type="button" variant="outline" onClick={cancelEditing}>
            Cancel
          </Button>
        </div>
      </div>
      {validation.rejectCommon ? (
        <p className="text-[12px] text-[var(--ks-dim)]">
          Common passwords are rejected.
        </p>
      ) : null}
      {validation.match ? (
        <p className="text-[12px] text-[var(--ks-dim)]">
          {validation.match.explanation}
        </p>
      ) : null}
      {error ? (
        <p className="text-[12px] text-[var(--ks-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function Cell({
  field,
  item,
}: {
  field: PasswordDashboardField
  item: Record<string, unknown>
}) {
  const value = normalizePasswordValue(item[field.path])
  return value.isSet ? (
    <div className="flex items-center" aria-label="is set">
      <Asterisk className="size-3" />
      <Asterisk className="size-3" />
      <Asterisk className="size-3" />
    </div>
  ) : (
    <span className="sr-only">not set</span>
  )
}

export function controller(config: {
  path: string
  label: string
  description?: string | null
  fieldMeta: Record<string, unknown>
}) {
  const field = {
    path: config.path,
    label: config.label,
    description: config.description ?? undefined,
    fieldMeta: config.fieldMeta,
  }
  const validation = validationFromFieldMeta(field)
  return {
    path: config.path,
    label: config.label,
    description: config.description,
    graphqlSelection:
      typeof config.fieldMeta.graphqlSelection === 'string'
        ? config.fieldMeta.graphqlSelection
        : `${config.path} { isSet }`,
    defaultValue: { kind: 'initial', isSet: false } satisfies PasswordValue,
    deserialize: (item: Record<string, unknown>) =>
      normalizePasswordValue(item[config.path]),
    serialize: (value: unknown) => {
      const normalized = normalizePasswordValue(value)
      if (normalized.kind !== 'editing') return {}
      return normalized.value.trim() ? { [config.path]: normalized.value } : {}
    },
    validate: (value: unknown, opts: { isRequired: boolean }) =>
      validatePassword(
        normalizePasswordValue(value),
        validation,
        opts.isRequired,
        config.label,
      ) === undefined,
  }
}

export const allowedExportsOnCustomViews = ['Cell', 'CardValue']
