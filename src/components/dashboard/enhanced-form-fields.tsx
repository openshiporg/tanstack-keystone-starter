import { Label } from '@/components/ui/label'
import type {
  DashboardField,
  DashboardList,
} from '@/features/cms/graphql-client'

import {
  FieldSection,
  groupFields,
  partitionFieldsByPosition,
} from './field-form-layout'
import type { EnhancedDashboardField } from './enhance-fields'
import {
  resolveDashboardFieldMode,
  testSerializedFilter,
} from './field-value-editor'
import { cn } from '@/lib/utils'

type FieldValues = Record<string, unknown>

type EnhancedFieldsMap = Record<string, EnhancedDashboardField>

type EnhancedFormFieldsProps = {
  list: DashboardList
  fields: EnhancedFieldsMap
  values: FieldValues
  serialized: Record<string, unknown>
  view: 'createView' | 'itemView'
  onChange: (nextValues: FieldValues) => void
  invalidFields?: ReadonlySet<string>
  region?: 'all' | 'form' | 'sidebar'
}

export function EnhancedFormFields({
  list,
  fields,
  values,
  serialized,
  view,
  onChange,
  invalidFields,
  region = 'all',
}: EnhancedFormFieldsProps) {
  const visibleFields = Object.values(fields).filter(
    (field) => resolveDashboardFieldMode(field, view, serialized) !== 'hidden',
  )
  const { formGroups, sidebarGroups } = getEnhancedFieldGroups(
    list,
    visibleFields,
    view,
  )

  if (region === 'form')
    return (
      <EnhancedFieldGroups
        groups={formGroups}
        fields={fields}
        values={values}
        serialized={serialized}
        view={view}
        onChange={onChange}
        invalidFields={invalidFields}
      />
    )
  if (region === 'sidebar')
    return (
      <EnhancedFieldGroups
        groups={sidebarGroups}
        fields={fields}
        values={values}
        serialized={serialized}
        view={view}
        onChange={onChange}
        invalidFields={invalidFields}
      />
    )

  if (!sidebarGroups.length)
    return (
      <EnhancedFieldGroups
        groups={formGroups}
        fields={fields}
        values={values}
        serialized={serialized}
        view={view}
        onChange={onChange}
        invalidFields={invalidFields}
      />
    )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <EnhancedFieldGroups
        groups={formGroups}
        fields={fields}
        values={values}
        serialized={serialized}
        view={view}
        onChange={onChange}
        invalidFields={invalidFields}
      />
      <EnhancedFieldGroups
        groups={sidebarGroups}
        fields={fields}
        values={values}
        serialized={serialized}
        view={view}
        onChange={onChange}
        invalidFields={invalidFields}
      />
    </div>
  )
}

export function getEnhancedFieldGroups(
  list: DashboardList,
  fields: DashboardField[],
  view: 'createView' | 'itemView',
) {
  const sections = partitionFieldsByPosition(fields, view)
  return {
    formGroups: groupFields(list, sections.form),
    sidebarGroups: groupFields(list, sections.sidebar),
  }
}

export function serializeOperationItem(
  fields: EnhancedFieldsMap,
  values: FieldValues,
) {
  const serialized: Record<string, unknown> = {}
  for (const [fieldPath, field] of Object.entries(fields)) {
    Object.assign(serialized, field.controller.serialize(values[fieldPath]))
  }
  return serialized
}

export function invalidFieldsForValues(
  fields: EnhancedFieldsMap,
  values: FieldValues,
  view: 'createView' | 'itemView',
) {
  const serialized = serializeOperationItem(fields, values)
  const invalidFields = new Set<string>()

  for (const [fieldPath, field] of Object.entries(fields)) {
    const mode = resolveDashboardFieldMode(field, view, serialized)
    if (mode !== 'edit') continue
    const isRequired = testSerializedFilter(
      field[view].isRequired ?? false,
      serialized,
    )
    const valid = field.controller.validate(values[fieldPath], { isRequired })
    if (!valid) invalidFields.add(fieldPath)
  }

  return invalidFields
}

function EnhancedFieldGroups({
  groups,
  fields,
  values,
  serialized,
  view,
  onChange,
  invalidFields,
}: {
  groups: ReturnType<typeof groupFields>
  fields: EnhancedFieldsMap
  values: FieldValues
  serialized: Record<string, unknown>
  view: 'createView' | 'itemView'
  onChange: (nextValues: FieldValues) => void
  invalidFields?: ReadonlySet<string>
}) {
  if (!groups.length) return null
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <FieldSection
          key={group.key}
          title={group.key === '__ungrouped' ? null : group.label}
          description={group.description}
          count={group.fields.length}
        >
          {group.fields.map((field) => {
            const enhancedField = fields[field.path]
            return (
              <EnhancedField
                key={field.path}
                field={enhancedField}
                values={values}
                serialized={serialized}
                view={view}
                invalidFields={invalidFields}
                onChange={onChange}
              />
            )
          })}
        </FieldSection>
      ))}
    </div>
  )
}

function EnhancedField({
  field,
  values,
  serialized,
  view,
  invalidFields,
  onChange,
}: {
  field: EnhancedDashboardField
  values: FieldValues
  serialized: Record<string, unknown>
  view: 'createView' | 'itemView'
  invalidFields?: ReadonlySet<string>
  onChange: (nextValues: FieldValues) => void
}) {
  const mode = resolveDashboardFieldMode(field, view, serialized)
  const isRequired = testSerializedFilter(
    field[view].isRequired ?? false,
    serialized,
  )
  const forceValidation = Boolean(invalidFields?.has(field.path))
  const isCompositeSelect =
    field.kind === 'select' &&
    ['radio', 'segmented-control'].includes(
      String(field.fieldMeta.displayMode ?? ''),
    )
  const Field = field.views.Field

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1.5',
        forceValidation &&
          'rounded-[10px] bg-[color-mix(in_oklab,var(--ks-red)_7%,transparent)] p-3 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--ks-red)_25%,transparent)]',
      )}
    >
      <Label
        id={`field-${field.path}-label`}
        htmlFor={
          mode === 'edit' && !isCompositeSelect
            ? `field-${field.path}`
            : undefined
        }
        className={cn(forceValidation && 'text-[var(--ks-danger)]')}
      >
        {field.label}
        {isRequired ? (
          <span className="-ml-1 text-[var(--ks-danger)]" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      <Field
        field={field}
        value={values[field.path]}
        view={view}
        isRequired={isRequired}
        forceValidation={forceValidation}
        onChange={
          mode === 'edit'
            ? (nextValue) => {
                onChange({
                  ...values,
                  [field.path]: nextValue,
                })
              }
            : undefined
        }
      />
      {forceValidation ? (
        <p className="text-[12px] text-[var(--ks-danger)]">
          Please review this field and try again.
        </p>
      ) : null}
    </div>
  )
}
