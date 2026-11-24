import type { DashboardField } from '@/features/cms/graphql-client'
import { filterTypeMetasForField } from '@/features/cms/dashboard-filter-types'
import { Link } from '@tanstack/react-router'

import type { DashboardFieldEditView } from '@/components/dashboard/field-value-editor'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  FieldValueEditor,
  initialDraftValue,
  isEditableDashboardField,
  parseDraftValue,
  validateDraftValue,
} from '@/components/dashboard/field-value-editor'
import { VIEW_MODULES } from '../../../../.cms/view-modules'
import { getFieldTypeFromViewsIndex } from './getFieldTypeFromViewsIndex'
import { RelationshipFilterInput } from './relationship-filter-input'
import * as textView from './text'
import * as numberView from './number'
import * as timestampView from './timestamp'
import * as calendarDayView from './calendar-day'
import * as jsonView from './json'
import * as checkboxView from './checkbox'
import * as relationshipView from './relationship'
import * as imageView from './image'
import * as documentView from './document'
import * as selectView from './select'
import * as passwordView from './password'

type FilterTypeMeta = {
  label: string
  initialValue: unknown
  needsValue?: boolean
}

type FilterController = {
  types: Record<string, FilterTypeMeta>
  Filter: (props: {
    value: unknown
    onChange: (value: unknown) => void
    type: string
    context?: 'add' | 'edit'
    autoFocus?: boolean
  }) => React.ReactNode
  Label: (props: { label: string; type: string; value: unknown }) => string
}

type ControllerArgs = Pick<DashboardField, 'fieldMeta' | 'label' | 'path'> & {
  listKey: string
  description?: string | null
  customViews: Record<string, unknown>
}

type FormFieldController = {
  path: string
  label: string
  description?: string | null
  graphqlSelection: string
  defaultValue: unknown
  deserialize: (data: Record<string, unknown>) => unknown
  serialize: (value: unknown) => Record<string, unknown>
  validate: (value: unknown, opts: { isRequired: boolean }) => boolean
  filter?: FilterController
}

function scalarFilterController(
  kind: string,
  field: DashboardField,
): FilterController | undefined {
  const types = filterTypeMetasForField(field)
  if (Object.keys(types).length === 0) return undefined
  return {
    types,
    Filter: ({ value, onChange, autoFocus, type }) => {
      if (kind === 'checkbox') {
        return (
          <select
            className="ks-field h-8 w-full px-2 text-[13px]"
            value={String(value ?? true)}
            onChange={(event) => onChange(event.target.value === 'true')}
            autoFocus={autoFocus}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        )
      }
      if (kind === 'select' || kind === 'multiselect') {
        const optionEntries = Array.isArray(field.fieldMeta.options)
          ? field.fieldMeta.options
          : Array.isArray(field.options)
            ? field.options
            : []
        const selectedValues = new Set(
          Array.isArray(value) ? value.map((entry) => String(entry)) : [],
        )
        return (
          <div className="space-y-2 max-h-48 overflow-y-auto rounded-[10px] p-2 shadow-[inset_0_0_0_1px_var(--ks-line)]">
            {optionEntries.map((option) => {
              const optionValue = String(option.value)
              return (
                <label
                  key={optionValue}
                  className="flex items-center gap-2 text-[13px]"
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.has(optionValue)}
                    onChange={(event) => {
                      const next = new Set(selectedValues)
                      if (event.target.checked) next.add(optionValue)
                      else next.delete(optionValue)
                      onChange(Array.from(next))
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              )
            })}
          </div>
        )
      }
      const inputValue = Array.isArray(value)
        ? value.join(', ')
        : value == null || value === true
          ? ''
          : String(value)
      return (
        <Input
          value={inputValue}
          onChange={(event) =>
            onChange(parseFilterInputValue(kind, type, event.target.value))
          }
          autoFocus={autoFocus}
          placeholder={
            kind === 'id' && (type === 'in' || type === 'not_in')
              ? 'Values, comma separated'
              : 'Filter value'
          }
        />
      )
    },
    Label: ({ label, value }) => {
      const formatted = formatFilterValue(value, field)
      return formatted ? `${label} ${formatted}` : label
    },
  }
}

function relationshipFilterController(field: DashboardField): FilterController {
  return {
    types: filterTypeMetasForField(field),
    Filter: ({ value, onChange, type, autoFocus }) => {
      if (type === 'empty' || type === 'not_empty') return null
      return (
        <RelationshipFilterInput
          field={field}
          value={value}
          onChange={onChange}
          type={type}
          autoFocus={autoFocus}
        />
      )
    },
    Label: ({ label, value }) => {
      const formatted = Array.isArray(value)
        ? value.join(', ')
        : formatFilterValue(value)
      return formatted ? `${label} ${formatted}` : label
    },
  }
}

function parseFilterInputValue(kind: string, type: string, value: string) {
  if (kind === 'integer') return Number.parseInt(value, 10)
  if (kind === 'float') return Number.parseFloat(value)
  if (kind === 'id' && (type === 'in' || type === 'not_in'))
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  return value
}

function formatFilterValue(value: unknown, field?: DashboardField) {
  if (value === true || value === null || value === undefined) return ''
  if (Array.isArray(value)) {
    if (field && (field.kind === 'select' || field.kind === 'multiselect')) {
      const options = Array.isArray(field.fieldMeta.options)
        ? field.fieldMeta.options
        : Array.isArray(field.options)
          ? field.options
          : []
      const labelByValue = new Map(
        options.map((option) => [String(option.value), option.label]),
      )
      return value
        .map((entry) => labelByValue.get(String(entry)) ?? String(entry))
        .join(', ')
    }
    return value.join(', ')
  }
  return String(value)
}

function makeController(kind: string, field: DashboardField) {
  return function controller(_args: ControllerArgs): FormFieldController {
    const graphqlSelection =
      typeof field.fieldMeta.graphqlSelection === 'string' &&
      field.fieldMeta.graphqlSelection.trim()
        ? field.fieldMeta.graphqlSelection
        : kind === 'relationship'
          ? `${field.path} { id label }`
          : kind === 'password'
            ? `${field.path} { isSet }`
            : field.path

    return {
      path: field.path,
      label: field.label,
      description: field.description,
      graphqlSelection,
      defaultValue: initialDraftValue(field, field.defaultValue),
      deserialize: (item: Record<string, unknown>) =>
        initialDraftValue(field, item[field.path]),
      serialize: (value: unknown) => ({
        [field.path]: parseDraftValue(field, value),
      }),
      validate: (value: unknown, opts: { isRequired: boolean }) =>
        validateDraftValue(field, value, {
          isRequired: opts.isRequired,
          view: 'itemView',
        }) === null,
      filter:
        kind === 'relationship'
          ? relationshipFilterController(field)
          : scalarFilterController(kind, field),
    }
  }
}

function RegistryField({
  field,
  value,
  onChange,
  forceValidation = false,
  isRequired = false,
  view = 'itemView',
}: {
  field: DashboardField
  value: unknown
  onChange?: (value: unknown) => void
  forceValidation?: boolean
  isRequired?: boolean
  view?: DashboardFieldEditView
}) {
  return (
    <FieldValueEditor
      field={field}
      value={value}
      onChange={onChange}
      view={view}
      forceValidation={forceValidation}
      isRequired={isRequired}
      editable={isEditableDashboardField(field, view)}
    />
  )
}

type CellProps = {
  field: DashboardField
  item: Record<string, unknown>
  linkTo?: { href: string }
}

function valueToLabel(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(
      record.label ??
        record.name ??
        record.email ??
        record.title ??
        record.id ??
        'Related item',
    )
  }
  return String(value)
}

function optionLabel(field: DashboardField, value: unknown) {
  return (
    field.options?.find((option) => option.value === value)?.label ??
    String(value)
  )
}

function MultiselectCell({
  field,
  value,
}: {
  field: DashboardField
  value: unknown
}) {
  const values = Array.isArray(value) ? value : []
  if (!values.length)
    return <span className="text-[13px] text-[var(--ks-dim)]">—</span>
  const labels = values.map((entry) => optionLabel(field, entry))
  const displayLabels = labels.length < 3 ? labels : labels.slice(0, 2)
  const overflow = labels.length < 3 ? 0 : labels.length - 2
  return (
    <span className="text-[13px] select-text">
      {displayLabels.join(', ')}
      {overflow ? `, +${overflow} more` : ''}
    </span>
  )
}

function Cell({ field, item, linkTo }: CellProps) {
  const value = item[field.path]
  let content: React.ReactNode
  if (field.kind === 'relationship')
    content = <RelationshipCellValue field={field} value={value} />
  else if (field.kind === 'checkbox')
    content = (
      <Badge variant={value === true ? 'secondary' : 'outline'}>
        {value === true ? 'Yes' : 'No'}
      </Badge>
    )
  else if (field.kind === 'select')
    content =
      value === null || value === undefined || value === '' ? (
        <span className="text-[13px] text-[var(--ks-dim)]">—</span>
      ) : (
        <span className="text-[13px] select-text">{optionLabel(field, value)}</span>
      )
  else if (field.kind === 'multiselect')
    content = <MultiselectCell field={field} value={value} />
  else if (field.kind === 'password' && typeof value === 'object')
    content = (
      <Badge variant="outline">
        {(value as { isSet?: boolean }).isSet ? 'Set' : 'Not set'}
      </Badge>
    )
  else if (value === null || value === undefined || value === '')
    content = <span className="text-[13px] text-[var(--ks-dim)]">—</span>
  else if (Array.isArray(value))
    content = (
      <span className="select-text">{value.map(valueToLabel).join(', ')}</span>
    )
  else if (typeof value === 'object')
    content = (
      <span className="text-[12px] text-[var(--ks-label)]">Complex data</span>
    )
  else content = <span className="text-[13px] select-text">{String(value)}</span>

  if (!linkTo) return content
  const match = linkTo.href.match(/^\/dashboard\/([^/]+)\/([^/]+)$/)
  if (!match) return content
  return (
    <Link
      to="/dashboard/$listKey/$id"
      params={{ listKey: match[1], id: decodeURIComponent(match[2]) }}
      className="font-medium text-[var(--ks-ink)] hover:underline"
    >
      {content}
    </Link>
  )
}
function cellSupportsLinkTo(kind: string) {
  return ['text', 'id', 'relationship', 'document', 'multiselect'].includes(
    kind,
  )
}

function RelationshipCellValue({
  field,
  value,
}: {
  field: DashboardField
  value: unknown
}) {
  if (Array.isArray(value)) {
    if (!value.length) return <span className="select-text">—</span>
    return (
      <span className="inline-flex max-w-md flex-wrap gap-1 select-text">
        {value.map((entry, index) => (
          <span key={relationshipKey(entry)}>
            {index ? ', ' : ''}
            <RelationshipLink field={field} value={entry} />
          </span>
        ))}
      </span>
    )
  }
  return <RelationshipLink field={field} value={value} />
}

function RelationshipLink({
  field,
  value,
}: {
  field: DashboardField
  value: unknown
}) {
  const id = relationshipId(value)
  const listKey = String(
    field.fieldMeta.refListPath ??
      String(field.fieldMeta.ref ?? '').split('.')[0],
  )
  if (!id || !listKey)
    return <span className="select-text">{valueToLabel(value)}</span>
  return (
    <Link
      to="/dashboard/$listKey/$id"
      params={{ listKey, id }}
      className="rounded-[5px] bg-[var(--ks-track)] px-1.5 py-0.5 text-[var(--ks-ink-2)] shadow-[inset_0_0_0_1px_var(--ks-line)] hover:text-[var(--ks-ink)]"
    >
      {valueToLabel(value)}
    </Link>
  )
}

function relationshipId(value: unknown) {
  if (value && typeof value === 'object')
    return String((value as { id?: unknown }).id ?? '')
  return typeof value === 'string' ? value : ''
}

function relationshipKey(value: unknown) {
  return relationshipId(value) || valueToLabel(value)
}

export type DashboardFieldViewProps = {
  field: DashboardField
  value: unknown
  onChange?: (value: unknown) => void
  forceValidation?: boolean
  isRequired?: boolean
  view?: 'createView' | 'itemView'
}

export type DashboardCellViewProps = {
  field: DashboardField
  item: Record<string, unknown>
  linkTo?: { href: string }
}

export type DashboardCellView = ((
  props: DashboardCellViewProps,
) => React.ReactNode) & {
  supportsLinkTo?: boolean
}

export type DashboardFieldViewModule = {
  Field?: (props: DashboardFieldViewProps) => React.ReactNode
  Cell?: DashboardCellView
  CardValue?: (props: DashboardCellViewProps) => React.ReactNode
  controller?: (args: ControllerArgs) => FormFieldController
  allowedExportsOnCustomViews?: string[]
}

export type ResolvedDashboardFieldViews = DashboardFieldViewModule & {
  Field: (props: DashboardFieldViewProps) => React.ReactNode
  Cell: DashboardCellView
  controller: (args: ControllerArgs) => FormFieldController
}

const specializedViewsByKind: Record<
  string,
  {
    Field?: (props: {
      field: DashboardField
      value: unknown
      onChange?: (value: unknown) => void
      forceValidation?: boolean
      isRequired?: boolean
      view?: 'createView' | 'itemView'
    }) => React.ReactNode
    Cell?: (props: CellProps) => React.ReactNode
    controller?: (args: ControllerArgs) => FormFieldController
    allowedExportsOnCustomViews?: string[]
  }
> = {
  text: textView,
  integer: numberView,
  float: numberView,
  decimal: numberView,
  bigInt: numberView,
  timestamp: timestampView,
  calendarDay: calendarDayView,
  json: jsonView,
  checkbox: checkboxView,
  relationship: relationshipView,
  image: imageView,
  file: imageView,
  document: documentView,
  structure: jsonView,
  select: selectView,
  multiselect: selectView,
  password: passwordView,
}

export function getFieldViews(
  viewsIndex: number,
  field?: DashboardField,
): DashboardFieldViewModule {
  const generatedModule = VIEW_MODULES[viewsIndex] as
    | DashboardFieldViewModule
    | null
    | undefined
  if (generatedModule) return generatedModule

  const kind = field?.kind || getFieldTypeFromViewsIndex(viewsIndex)
  const KindCell = Object.assign((props: CellProps) => <Cell {...props} />, {
    supportsLinkTo: cellSupportsLinkTo(kind),
  })
  const specialized = specializedViewsByKind[kind] ?? {}
  return {
    Field: specialized.Field ?? RegistryField,
    Cell: specialized.Cell ?? KindCell,
    allowedExportsOnCustomViews: specialized.allowedExportsOnCustomViews ?? [
      'Cell',
      'CardValue',
    ],
    controller:
      specialized.controller ??
      makeController(
        kind,
        field ??
          ({ path: '', label: '', kind, fieldMeta: {} } as DashboardField),
      ),
  }
}

/**
 * Resolve a field's base view and apply the generated custom view module using
 * Keystone's permitted-export rule. This is used by list cells as well as the
 * controller enhancer so custom Cell/CardValue exports cannot be silently
 * ignored by a kind-first registry lookup.
 */
export function getFieldViewsForField(
  field: DashboardField,
): ResolvedDashboardFieldViews {
  const baseViews = getFieldViews(field.viewsIndex, field)
  if (typeof field.customViewsIndex !== 'number')
    return baseViews as ResolvedDashboardFieldViews

  const customViews = getFieldViews(field.customViewsIndex, field)
  const allowed = new Set(baseViews.allowedExportsOnCustomViews ?? [])
  const merged: DashboardFieldViewModule = { ...baseViews }
  if (allowed.has('Field') && customViews.Field)
    merged.Field = customViews.Field
  if (allowed.has('Cell') && customViews.Cell) merged.Cell = customViews.Cell
  if (allowed.has('CardValue') && customViews.CardValue)
    merged.CardValue = customViews.CardValue
  if (allowed.has('controller') && customViews.controller)
    merged.controller = customViews.controller
  if (!merged.Cell)
    throw new Error(
      `Custom view for ${field.path} does not provide a Cell renderer`,
    )
  return merged as ResolvedDashboardFieldViews
}
