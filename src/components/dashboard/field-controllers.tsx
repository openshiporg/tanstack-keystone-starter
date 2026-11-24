import {
  FieldValueEditor,
  initialDraftValue,
  isEditableDashboardField,
  parseDraftValue,
  validateDraftValue,
} from './field-value-editor'
import type { DashboardFieldEditView } from './field-value-editor'
import type { DashboardField } from '@/features/cms/graphql-client'

export type FieldControllerValue = unknown

export type FieldController = {
  path: string
  label: string
  isEditable: (field: DashboardField) => boolean
  deserialize: (value: unknown, field: DashboardField) => FieldControllerValue
  defaultValue: (field: DashboardField) => FieldControllerValue
  serialize: (value: FieldControllerValue, field: DashboardField) => unknown
  validate: (
    value: FieldControllerValue,
    field: DashboardField,
  ) => string | null
  Field: (props: {
    field: DashboardField
    value: FieldControllerValue
    onChange: (value: FieldControllerValue) => void
  }) => React.ReactNode
}

export type ControllerBackedField = DashboardField & {
  controller: FieldController
}

export function getFieldController(
  field: DashboardField,
  view: DashboardFieldEditView = 'itemView',
): FieldController {
  return {
    path: field.path,
    label: field.label,
    isEditable: (candidate) => isEditableDashboardField(candidate, view),
    deserialize: (value, candidate) => initialDraftValue(candidate, value),
    defaultValue: (candidate) =>
      initialDraftValue(candidate, candidate.defaultValue),
    serialize: (value, candidate) => parseDraftValue(candidate, value),
    validate: (value, candidate) => validateDraftValue(candidate, value, view),
    Field: ({ field: candidate, value, onChange }) => (
      <FieldValueEditor field={candidate} value={value} onChange={onChange} />
    ),
  }
}

export function withFieldController(
  field: DashboardField,
  view: DashboardFieldEditView = 'itemView',
): ControllerBackedField {
  return { ...field, controller: getFieldController(field, view) }
}
