import { deepEqual } from '@tanstack/react-router'

import type { EnhancedDashboardField } from './enhance-fields'

type EnhancedFieldsMap = Record<string, EnhancedDashboardField>
type FieldValues = Record<string, unknown>
type DashboardOperation = 'create' | 'update'

export function makeDefaultValueState(fields: EnhancedFieldsMap) {
  return Object.fromEntries(
    Object.entries(fields).map(([fieldPath, field]) => [
      fieldPath,
      field.controller.defaultValue,
    ]),
  )
}

export function serializeValueToOperationItem(
  operation: DashboardOperation,
  fields: EnhancedFieldsMap,
  value: FieldValues,
  valueReference: FieldValues = makeDefaultValueState(fields),
) {
  const result: Record<string, unknown> = {}

  for (const [fieldPath, field] of Object.entries(fields)) {
    const serializedValue = field.controller.serialize(value[fieldPath])
    const serializedReference = field.controller.serialize(
      valueReference[fieldPath],
    )
    const isAlwaysRequired = field.graphql.isNonNull.includes(operation)

    if (!isAlwaysRequired && deepEqual(serializedValue, serializedReference))
      continue

    Object.assign(result, serializedValue)
  }

  return result
}

export function hasFormChanges(
  operation: DashboardOperation,
  fields: EnhancedFieldsMap,
  value: FieldValues,
  valueReference: FieldValues = makeDefaultValueState(fields),
) {
  const alwaysRequiredCount = Object.values(fields).filter((field) =>
    field.graphql.isNonNull.includes(operation),
  ).length
  const operationItem = serializeValueToOperationItem(
    operation,
    fields,
    value,
    valueReference,
  )
  return Object.keys(operationItem).length - alwaysRequiredCount > 0
}
