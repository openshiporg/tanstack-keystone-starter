import { validationFailure } from './errors'
import type { CmsField, CmsList } from './types'

export type ResolvedWhereUnique = {
  field: CmsField
  fieldPath: string
  value: unknown
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function isProvidedUniqueValue(field: CmsField, value: unknown) {
  if (value === undefined || value === null) return false
  if (field.kind === 'id') return String(value).length > 0
  return true
}

export function getWhereUniqueFields(list: CmsList) {
  return list.fields.filter(
    (field) =>
      field.kind === 'id' ||
      field.db?.isUnique === true ||
      (field.kind === 'relationship' &&
        list.resolvedDbFields[field.path]?.relationship?.relationKind ===
          'one'),
  )
}

export function formatWhereUniqueFieldList(list: CmsList) {
  return getWhereUniqueFields(list)
    .map((field) => field.path)
    .join(', ')
}

export function resolveWhereUnique(
  list: CmsList,
  where: unknown,
): ResolvedWhereUnique {
  const whereRecord = asRecord(where)
  const matches = getWhereUniqueFields(list)
    .map((field) => ({
      field,
      fieldPath: field.path,
      value: whereRecord[field.path],
    }))
    .filter((entry) => isProvidedUniqueValue(entry.field, entry.value))

  if (matches.length !== 1) {
    const received =
      matches.length === 0
        ? 'none'
        : matches.map((entry) => entry.fieldPath).join(', ')
    throw validationFailure(
      `${list.key}WhereUniqueInput must contain exactly one unique field (${formatWhereUniqueFieldList(list)}); received ${received}.`,
      {
        listKey: list.key,
        uniqueFields: getWhereUniqueFields(list).map((field) => field.path),
        received,
      },
    )
  }

  const [match] = matches
  return match
}
