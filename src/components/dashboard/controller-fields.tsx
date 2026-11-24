import { Label } from '@/components/ui/label'
import type { DashboardList } from '@/features/cms/graphql-client'

import {
  FieldSection,
  groupFields,
  partitionFieldsByPosition,
} from './field-form-layout'
import type {
  ControllerBackedField,
  FieldControllerValue,
} from './field-controllers'

type FieldValues = Record<string, FieldControllerValue>

type ControllerFieldsProps = {
  list: DashboardList
  fields: ControllerBackedField[]
  values: FieldValues
  view: 'createView' | 'itemView'
  onChange: (fieldPath: string, value: FieldControllerValue) => void
  region?: 'all' | 'form' | 'sidebar'
}

export function ControllerFields({
  list,
  fields,
  values,
  view,
  onChange,
  region = 'all',
}: ControllerFieldsProps) {
  const { formGroups, sidebarGroups } = getControllerFieldGroups(
    list,
    fields,
    view,
  )

  if (region === 'form')
    return (
      <ControllerFieldGroups
        groups={formGroups}
        values={values}
        view={view}
        onChange={onChange}
      />
    )
  if (region === 'sidebar')
    return (
      <ControllerFieldGroups
        groups={sidebarGroups}
        values={values}
        view={view}
        onChange={onChange}
      />
    )

  if (!sidebarGroups.length)
    return (
      <ControllerFieldGroups
        groups={formGroups}
        values={values}
        view={view}
        onChange={onChange}
      />
    )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <ControllerFieldGroups
        groups={formGroups}
        values={values}
        view={view}
        onChange={onChange}
      />
      <ControllerFieldGroups
        groups={sidebarGroups}
        values={values}
        view={view}
        onChange={onChange}
      />
    </div>
  )
}

export function getControllerFieldGroups(
  list: DashboardList,
  fields: ControllerBackedField[],
  view: 'createView' | 'itemView',
) {
  const sections = partitionFieldsByPosition(fields, view)
  return {
    formGroups: groupFields(list, sections.form),
    sidebarGroups: groupFields(list, sections.sidebar),
  }
}

function ControllerFieldGroups({
  groups,
  values,
  view,
  onChange,
}: {
  groups: ReturnType<typeof groupFields<ControllerBackedField>>
  values: FieldValues
  view: 'createView' | 'itemView'
  onChange: (fieldPath: string, value: FieldControllerValue) => void
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
          {group.fields.map((field) => (
            <ControllerField
              key={field.path}
              field={field}
              value={values[field.path]}
              view={view}
              onChange={onChange}
            />
          ))}
        </FieldSection>
      ))}
    </div>
  )
}

function ControllerField({
  field,
  value,
  view,
  onChange,
}: {
  field: ControllerBackedField
  value: FieldControllerValue
  view: 'createView' | 'itemView'
  onChange: (fieldPath: string, value: FieldControllerValue) => void
}) {
  const Field = field.controller.Field
  return (
    <div className="space-y-2">
      <Label htmlFor={`field-${field.path}`}>
        {field.label}
        {field[view].isRequired ? (
          <span className="ml-1 text-[var(--ks-danger)]">*</span>
        ) : null}
      </Label>
      <Field
        field={field}
        value={value}
        onChange={(nextValue) => onChange(field.path, nextValue)}
      />
    </div>
  )
}
