import { useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { DashboardField } from '@/features/cms/graphql-client'
import type { FieldMode } from '@/features/cms/types'

import {
  FileFieldEditor,
  normalizeFileFieldEditorValue,
} from './file-field-editor'
import { RelationshipFieldEditor } from './relationship-field-editor'

export type FieldDraft = Record<string, unknown>

export type DashboardFieldEditView = 'createView' | 'itemView'

type ConditionalFieldMode = {
  edit?: unknown
  read?: unknown
}

type ValidationOptions = {
  view?: DashboardFieldEditView
  isRequired?: boolean
}

function applyFilter<T>(filter: { equals?: T; in?: T[] }, value: T) {
  if (filter.equals !== undefined && value !== filter.equals) return false
  if (filter.in !== undefined && !filter.in.includes(value)) return false
  return true
}

export function testSerializedFilter(
  filter: unknown,
  serialized: Record<string, unknown>,
) {
  if (filter === undefined) return false
  if (typeof filter === 'boolean') return filter
  if (!filter || typeof filter !== 'object' || Array.isArray(filter))
    return false

  for (const [key, filterOnField] of Object.entries(filter)) {
    const serializedValue = serialized[key]
    if (
      !filterOnField ||
      typeof filterOnField !== 'object' ||
      Array.isArray(filterOnField)
    )
      return false
    if (
      !applyFilter(
        filterOnField as { equals?: unknown; in?: unknown[] },
        serializedValue,
      )
    )
      return false
    const notFilter = (
      filterOnField as { not?: { equals?: unknown; in?: unknown[] } }
    ).not
    if (notFilter !== undefined && applyFilter(notFilter, serializedValue))
      return false
  }

  return true
}

export function resolveDashboardFieldMode(
  field: DashboardField,
  view: DashboardFieldEditView = 'itemView',
  serialized: Record<string, unknown> = {},
): FieldMode {
  const fieldMode = field[view].fieldMode as FieldMode | ConditionalFieldMode
  if (typeof fieldMode === 'string') return fieldMode
  if (typeof fieldMode === 'object' && !Array.isArray(fieldMode)) {
    if (testSerializedFilter(fieldMode.edit, serialized)) return 'edit'
    if (view === 'itemView' && testSerializedFilter(fieldMode.read, serialized))
      return 'read'
    return 'hidden'
  }
  return 'hidden'
}

export function dashboardFieldMode(
  field: DashboardField,
  view: DashboardFieldEditView = 'itemView',
  serialized?: Record<string, unknown>,
) {
  return resolveDashboardFieldMode(field, view, serialized)
}

export function isEditableDashboardField(
  field: DashboardField,
  view: DashboardFieldEditView = 'itemView',
  serialized?: Record<string, unknown>,
) {
  return (
    field.path !== 'id' &&
    resolveDashboardFieldMode(field, view, serialized) === 'edit' &&
    [
      'text',
      'password',
      'json',
      'document',
      'image',
      'file',
      'select',
      'multiselect',
      'checkbox',
      'integer',
      'float',
      'decimal',
      'timestamp',
      'calendarDay',
      'bigInt',
      'relationship',
    ].includes(field.kind)
  )
}

export function displayFieldValue(kind: string, value: unknown) {
  if (value === null || value === undefined || value === '')
    return <span className="text-[13px] text-[var(--ks-dim)]">—</span>
  if (kind === 'checkbox')
    return (
      <Badge variant={value === true ? 'secondary' : 'outline'}>
        {value === true ? 'Yes' : 'No'}
      </Badge>
    )
  if (kind === 'multiselect' && Array.isArray(value))
    return <div className="text-[13px]">{value.join(', ') || '—'}</div>
  if (kind === 'relationship') {
    if (Array.isArray(value))
      return (
        <div className="text-[13px]">
          {value.map(relationshipLabel).join(', ') || '—'}
        </div>
      )
    return <div className="text-[13px]">{relationshipLabel(value)}</div>
  }
  if (kind === 'password' && typeof value === 'object')
    return (
      <Badge variant="outline">
        {(value as { isSet?: boolean }).isSet ? 'Set' : 'Not set'}
      </Badge>
    )
  if (typeof value === 'object')
    return (
      <pre className="overflow-auto rounded-[8px] bg-[var(--ks-track)] p-2 font-mono text-[12px] text-[var(--ks-ink-2)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  return <div className="text-[13px]">{String(value)}</div>
}

function optionsForField(field: DashboardField) {
  return field.options ?? []
}

export function initialDraftValue(field: DashboardField, value: unknown) {
  if (field.kind === 'checkbox') return value === true
  if (
    field.kind === 'json' ||
    field.kind === 'document' ||
    field.kind === 'image' ||
    field.kind === 'file'
  )
    return value === null || value === undefined
      ? ''
      : JSON.stringify(value, null, 2)
  if (field.kind === 'multiselect')
    return Array.isArray(value) ? value.join(', ') : ''
  if (field.kind === 'relationship') {
    if (Array.isArray(value))
      return value
        .map((entry) =>
          entry && typeof entry === 'object'
            ? String((entry as { id?: unknown }).id ?? '')
            : String(entry),
        )
        .filter(Boolean)
        .join(', ')
    if (value && typeof value === 'object')
      return String((value as { id?: unknown }).id ?? '')
    return value === null || value === undefined ? '' : String(value)
  }
  if (field.kind === 'password') return ''
  return value === null || value === undefined ? '' : String(value)
}

export function requiredFieldMessage(
  field: DashboardField,
  view: DashboardFieldEditView = 'itemView',
  explicitIsRequired?: boolean,
) {
  const validation = field.fieldMeta.validation
  const validationRecord =
    validation && typeof validation === 'object' && !Array.isArray(validation)
      ? (validation as { isRequired?: unknown })
      : undefined
  if (
    explicitIsRequired === true ||
    field[view].isRequired === true ||
    field.isNonNull.includes(view === 'createView' ? 'create' : 'update') ||
    validationRecord?.isRequired === true
  )
    return `${field.label} is required.`
  return null
}

export function validateDraftValue(
  field: DashboardField,
  value: unknown,
  options: DashboardFieldEditView | ValidationOptions = 'itemView',
) {
  const view =
    typeof options === 'string' ? options : (options.view ?? 'itemView')
  const requiredMessage = requiredFieldMessage(
    field,
    view,
    typeof options === 'string' ? undefined : options.isRequired,
  )
  if (!requiredMessage) return null
  if (field.kind === 'checkbox') return null
  if (
    field.kind === 'relationship' &&
    String(value ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean).length === 0
  )
    return requiredMessage
  if (String(value ?? '').trim() === '') return requiredMessage
  return null
}

export function parseDraftValue(field: DashboardField, value: unknown) {
  if (field.kind === 'checkbox') return value === true
  const raw = String(value ?? '').trim()
  if (!raw) return undefined
  if (
    field.kind === 'json' ||
    field.kind === 'document' ||
    field.kind === 'image' ||
    field.kind === 'file'
  )
    return JSON.parse(raw)
  if (field.kind === 'multiselect')
    return raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  if (field.kind === 'relationship') {
    const ids = raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
    if (field.fieldMeta.many) return { set: ids.map((id) => ({ id })) }
    return ids[0] ? { connect: { id: ids[0] } } : { disconnect: true }
  }
  if (field.kind === 'integer') {
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed))
      throw new Error(`Invalid integer for field ${field.label}`)
    return parsed
  }
  if (field.kind === 'float') {
    const parsed = Number.parseFloat(raw)
    if (!Number.isFinite(parsed))
      throw new Error(`Invalid number for field ${field.label}`)
    return parsed
  }
  return raw
}

export function FieldValueEditor({
  field,
  value,
  onChange,
  view = 'itemView',
  isRequired,
  forceValidation = false,
  editable,
}: {
  field: DashboardField
  value: unknown
  onChange?: (value: unknown) => void
  view?: DashboardFieldEditView
  isRequired?: boolean
  forceValidation?: boolean
  editable?: boolean
}) {
  const inputId = useMemo(() => `field-${field.path}`, [field.path])
  const isEditable = editable ?? isEditableDashboardField(field, view)
  const validationMessage = forceValidation
    ? validateDraftValue(field, value, { view, isRequired })
    : null

  if (!isEditable || !onChange) return displayFieldValue(field.kind, value)

  if (field.kind === 'checkbox') {
    return (
      <div className="space-y-2">
        <div className="flex h-8 items-center gap-2">
          <Checkbox
            id={inputId}
            aria-label={field.label}
            checked={value === true}
            onCheckedChange={(checked) => onChange(checked === true)}
          />
          <Label htmlFor={inputId} className="text-[13px] text-[var(--ks-dim)]">
            Enabled
          </Label>
        </div>
        {validationMessage ? (
          <p className="text-[12px] text-[var(--ks-danger)]">{validationMessage}</p>
        ) : null}
      </div>
    )
  }

  if (field.kind === 'image' || field.kind === 'file') {
    return (
      <div className="space-y-2">
        <FileFieldEditor
          field={field}
          value={normalizeFileFieldEditorValue(value)}
          onChange={onChange}
        />
        {validationMessage ? (
          <p className="text-[12px] text-[var(--ks-danger)]">{validationMessage}</p>
        ) : null}
      </div>
    )
  }

  if (field.kind === 'json' || field.kind === 'document') {
    return (
      <div className="space-y-2">
        <Textarea
          id={inputId}
          rows={6}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
        />
        {validationMessage ? (
          <p className="text-[12px] text-[var(--ks-danger)]">{validationMessage}</p>
        ) : null}
      </div>
    )
  }

  if (field.kind === 'select') {
    return (
      <div className="space-y-2">
        <select
          id={inputId}
          className="ks-field h-8 w-full px-2 text-[13px]"
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select {field.label}</option>
          {optionsForField(field).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {validationMessage ? (
          <p className="text-[12px] text-[var(--ks-danger)]">{validationMessage}</p>
        ) : null}
      </div>
    )
  }

  if (field.kind === 'multiselect' && optionsForField(field).length > 0) {
    const selected = new Set(
      String(value ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    )
    return (
      <div className="space-y-2">
        <div className="grid gap-2 rounded-[10px] p-3 shadow-[inset_0_0_0_1px_var(--ks-line)] sm:grid-cols-2">
          {optionsForField(field).map((option) => {
            const optionValue = String(option.value)
            return (
              <label
                key={optionValue}
                className="inline-flex items-center gap-2 text-[13px]"
              >
                <input
                  type="checkbox"
                  checked={selected.has(optionValue)}
                  onChange={(event) => {
                    const next = new Set(selected)
                    if (event.target.checked) next.add(optionValue)
                    else next.delete(optionValue)
                    onChange(Array.from(next).join(', '))
                  }}
                />
                {option.label}
              </label>
            )
          })}
        </div>
        {validationMessage ? (
          <p className="text-[12px] text-[var(--ks-danger)]">{validationMessage}</p>
        ) : null}
      </div>
    )
  }

  if (field.kind === 'relationship') {
    return (
      <div className="space-y-2">
        <RelationshipFieldEditor
          field={field}
          value={value}
          onChange={onChange}
        />
        {validationMessage ? (
          <p className="text-[12px] text-[var(--ks-danger)]">{validationMessage}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Input
        id={inputId}
        type={
          field.kind === 'password'
            ? 'password'
            : field.kind === 'integer' || field.kind === 'float'
              ? 'number'
              : 'text'
        }
        step={field.kind === 'float' ? 'any' : undefined}
        value={String(value ?? '')}
        placeholder={
          field.kind === 'password'
            ? 'Leave blank to keep existing password'
            : undefined
        }
        onChange={(event) => onChange(event.target.value)}
      />
      {validationMessage ? (
        <p className="text-[12px] text-[var(--ks-danger)]">{validationMessage}</p>
      ) : null}
    </div>
  )
}

function relationshipLabel(value: unknown) {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.label ?? record.name ?? record.id ?? 'Related item')
  }
  return String(value)
}
