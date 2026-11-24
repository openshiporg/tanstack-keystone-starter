import type { DashboardField } from '@/features/cms/graphql-client'

import { RelationshipFieldEditor } from '../relationship-field-editor'
import {
  displayFieldValue,
  isEditableDashboardField,
} from '../field-value-editor'

export type RelationshipViewUiConfig = {
  displayMode?: 'select' | 'cards' | 'count'
  cardFields?: string[]
  inlineConnect?: boolean
  removeMode?: 'disconnect' | 'none'
}

type RelationshipOption = { id: string; label: string }

type RelationshipValue =
  | { kind: 'count'; count: number }
  | {
      kind: 'one'
      value: RelationshipOption | null
      initialValue: RelationshipOption | null
    }
  | {
      kind: 'many'
      value: RelationshipOption[]
      initialValue: RelationshipOption[]
    }
  | {
      kind: 'cards-view'
      value: RelationshipOption[]
      initialValue: RelationshipOption[]
      itemBeingCreated: boolean
      itemsBeingEdited: string[]
    }

export function relationshipViewUiConfig(
  field: DashboardField,
): RelationshipViewUiConfig {
  const ui = field.fieldMeta.ui
  const base =
    ui && typeof ui === 'object' && !Array.isArray(ui)
      ? (ui as Record<string, unknown>)
      : {}
  const cardFields = Array.isArray(base.cardFields)
    ? base.cardFields.filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.trim().length > 0,
      )
    : []

  return {
    displayMode:
      base.displayMode === 'cards' ||
      base.displayMode === 'count' ||
      base.displayMode === 'select'
        ? base.displayMode
        : undefined,
    cardFields,
    inlineConnect: base.inlineConnect !== false,
    removeMode: base.removeMode === 'none' ? 'none' : 'disconnect',
  }
}

function normalizeRelationshipOption(
  entry: unknown,
): RelationshipOption | null {
  if (!entry || typeof entry !== 'object') return null
  const record = entry as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id : String(record.id ?? '')
  if (!id) return null
  const label = typeof record.label === 'string' ? record.label : id
  return { id, label }
}

function normalizeRelationshipValue(
  value: unknown,
  many: boolean,
  displayMode?: RelationshipViewUiConfig['displayMode'],
): RelationshipValue {
  if (displayMode === 'count') {
    const count =
      typeof value === 'number'
        ? value
        : value &&
            typeof value === 'object' &&
            (value as Record<string, unknown>).kind === 'count'
          ? Number((value as Record<string, unknown>).count ?? 0)
          : Number(value ?? 0)
    return { kind: 'count', count: Number.isFinite(count) ? count : 0 }
  }

  if (displayMode === 'cards') {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>).kind === 'cards-view'
    ) {
      const record = value as {
        value?: unknown[]
        initialValue?: unknown[]
        itemBeingCreated?: unknown
        itemsBeingEdited?: unknown[]
      }
      return {
        kind: 'cards-view',
        value: Array.isArray(record.value)
          ? record.value
              .map(normalizeRelationshipOption)
              .filter((entry): entry is RelationshipOption => entry !== null)
          : [],
        initialValue: Array.isArray(record.initialValue)
          ? record.initialValue
              .map(normalizeRelationshipOption)
              .filter((entry): entry is RelationshipOption => entry !== null)
          : [],
        itemBeingCreated: record.itemBeingCreated === true,
        itemsBeingEdited: Array.isArray(record.itemsBeingEdited)
          ? record.itemsBeingEdited.filter(
              (entry): entry is string =>
                typeof entry === 'string' && entry.length > 0,
            )
          : [],
      }
    }
    const values = Array.isArray(value)
      ? value
          .map(normalizeRelationshipOption)
          .filter((entry): entry is RelationshipOption => entry !== null)
      : value
        ? [normalizeRelationshipOption(value)].filter(
            (entry): entry is RelationshipOption => entry !== null,
          )
        : []
    return {
      kind: 'cards-view',
      value: values,
      initialValue: values,
      itemBeingCreated: false,
      itemsBeingEdited: [],
    }
  }

  if (many) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>).kind === 'many'
    ) {
      const record = value as { value?: unknown[]; initialValue?: unknown[] }
      return {
        kind: 'many',
        value: Array.isArray(record.value)
          ? record.value
              .map(normalizeRelationshipOption)
              .filter((entry): entry is RelationshipOption => entry !== null)
          : [],
        initialValue: Array.isArray(record.initialValue)
          ? record.initialValue
              .map(normalizeRelationshipOption)
              .filter((entry): entry is RelationshipOption => entry !== null)
          : [],
      }
    }
    const values = Array.isArray(value)
      ? value
          .map(normalizeRelationshipOption)
          .filter((entry): entry is RelationshipOption => entry !== null)
      : []
    return { kind: 'many', value: values, initialValue: values }
  }

  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).kind === 'one'
  ) {
    const record = value as { value?: unknown; initialValue?: unknown }
    return {
      kind: 'one',
      value: normalizeRelationshipOption(record.value),
      initialValue: normalizeRelationshipOption(record.initialValue),
    }
  }

  const option = normalizeRelationshipOption(value)
  return { kind: 'one', value: option, initialValue: option }
}

export function relationshipControllerSelection(config: {
  path: string
  fieldMeta: Record<string, unknown>
}) {
  if (typeof config.fieldMeta.graphqlSelection === 'string')
    return config.fieldMeta.graphqlSelection
  const ui = relationshipViewUiConfig({
    fieldMeta: config.fieldMeta,
  } as DashboardField)
  if (ui.displayMode === 'count') return `${config.path}Count`
  return `${config.path} { id label }`
}

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
  const ui = relationshipViewUiConfig(field)
  if (ui.displayMode === 'count') {
    const normalized = normalizeRelationshipValue(
      value,
      field.fieldMeta.many === true,
      ui.displayMode,
    )
    return displayFieldValue(
      'text',
      normalized.kind === 'count' ? normalized.count : 0,
    )
  }
  if (!onChange || !isEditableDashboardField(field, view))
    return displayFieldValue(field.kind, value)
  return (
    <RelationshipFieldEditor
      field={field}
      value={value}
      onChange={(nextValue) => onChange(nextValue)}
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
  const ui = relationshipViewUiConfig(field)
  if (ui.displayMode === 'count')
    return displayFieldValue('text', item[`${field.path}Count`])
  return displayFieldValue(field.kind, item[field.path])
}

export function controller(config: {
  path: string
  label: string
  description?: string | null
  fieldMeta: Record<string, unknown>
}) {
  const many = config.fieldMeta.many === true
  const ui = relationshipViewUiConfig({
    fieldMeta: config.fieldMeta,
  } as DashboardField)
  return {
    path: config.path,
    label: config.label,
    description: config.description,
    graphqlSelection: relationshipControllerSelection(config),
    defaultValue:
      ui.displayMode === 'count'
        ? ({ kind: 'count', count: 0 } satisfies RelationshipValue)
        : ui.displayMode === 'cards'
          ? ({
              kind: 'cards-view',
              value: [],
              initialValue: [],
              itemBeingCreated: false,
              itemsBeingEdited: [],
            } satisfies RelationshipValue)
          : many
            ? ({
                kind: 'many',
                value: [],
                initialValue: [],
              } satisfies RelationshipValue)
            : ({
                kind: 'one',
                value: null,
                initialValue: null,
              } satisfies RelationshipValue),
    deserialize: (item: Record<string, unknown>) => {
      if (ui.displayMode === 'count')
        return {
          kind: 'count',
          count: Number(item[`${config.path}Count`] ?? 0),
        } satisfies RelationshipValue
      return normalizeRelationshipValue(item[config.path], many, ui.displayMode)
    },
    serialize: (value: unknown) => {
      const normalized = normalizeRelationshipValue(value, many, ui.displayMode)
      if (normalized.kind === 'count') return {}
      if (normalized.kind === 'cards-view') {
        const currentIds = new Set(normalized.value.map((entry) => entry.id))
        const initialIds = new Set(
          normalized.initialValue.map((entry) => entry.id),
        )
        const connect = normalized.value
          .filter((entry) => !initialIds.has(entry.id))
          .map((entry) => ({ id: entry.id }))
        const disconnect = normalized.initialValue
          .filter((entry) => !currentIds.has(entry.id))
          .map((entry) => ({ id: entry.id }))
        if (!connect.length && !disconnect.length) return {}
        if (many) {
          return {
            [config.path]: {
              ...(connect.length ? { connect } : {}),
              ...(disconnect.length ? { disconnect } : {}),
            },
          }
        }
        if (connect.length) return { [config.path]: { connect: connect[0] } }
        return disconnect.length ? { [config.path]: { disconnect: true } } : {}
      }
      if (normalized.kind === 'many') {
        const currentIds = new Set(normalized.value.map((entry) => entry.id))
        const initialIds = new Set(
          normalized.initialValue.map((entry) => entry.id),
        )
        const connect = normalized.value
          .filter((entry) => !initialIds.has(entry.id))
          .map((entry) => ({ id: entry.id }))
        const disconnect = normalized.initialValue
          .filter((entry) => !currentIds.has(entry.id))
          .map((entry) => ({ id: entry.id }))
        if (!connect.length && !disconnect.length) return {}
        return {
          [config.path]: {
            ...(connect.length ? { connect } : {}),
            ...(disconnect.length ? { disconnect } : {}),
          },
        }
      }
      if (normalized.value?.id) {
        if (normalized.initialValue?.id === normalized.value.id) return {}
        return { [config.path]: { connect: { id: normalized.value.id } } }
      }
      if (normalized.initialValue && ui.removeMode === 'none') return {}
      return normalized.initialValue
        ? { [config.path]: { disconnect: true } }
        : {}
    },
    validate: (value: unknown, opts: { isRequired: boolean }) => {
      const normalized = normalizeRelationshipValue(value, many, ui.displayMode)
      if (normalized.kind === 'count') return true
      if (normalized.kind === 'cards-view') {
        if (
          normalized.itemBeingCreated ||
          normalized.itemsBeingEdited.length > 0
        )
          return false
        return !opts.isRequired || normalized.value.length > 0
      }
      if (normalized.kind === 'many')
        return !opts.isRequired || normalized.value.length > 0
      return !opts.isRequired || normalized.value !== null
    },
    ui,
  }
}

export const allowedExportsOnCustomViews = ['Cell', 'CardValue']
