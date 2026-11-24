import type { DashboardField } from './graphql-client'

export type DashboardFilterTypeMeta = {
  label: string
  initialValue: unknown
  needsValue?: boolean
}

export function filterTypeMetasForField(
  field: Pick<DashboardField, 'kind' | 'fieldMeta'>,
): Record<string, DashboardFilterTypeMeta> {
  if (field.kind === 'text') {
    return {
      contains_i: { label: 'Contains', initialValue: '' },
      not_contains_i: { label: 'Does not contain', initialValue: '' },
      is_i: { label: 'Is exactly', initialValue: '' },
      not_i: { label: 'Is not exactly', initialValue: '' },
      starts_with_i: { label: 'Starts with', initialValue: '' },
      not_starts_with_i: { label: 'Does not start with', initialValue: '' },
      ends_with_i: { label: 'Ends with', initialValue: '' },
      not_ends_with_i: { label: 'Does not end with', initialValue: '' },
    }
  }

  if (field.kind === 'select')
    return {
      matches: { label: 'Matches', initialValue: [] },
      not_matches: { label: 'Does not match', initialValue: [] },
    }

  if (field.kind === 'document') {
    return {
      contains: { label: 'Contains text', initialValue: '' },
      not_contains: { label: 'Does not contain text', initialValue: '' },
      is_empty: { label: 'Is empty', initialValue: true, needsValue: false },
    }
  }

  if (field.kind === 'id') {
    return {
      is: { label: 'Is', initialValue: '' },
      not: { label: 'Is not', initialValue: '' },
      gt: { label: 'Greater than', initialValue: '' },
      lt: { label: 'Less than', initialValue: '' },
      gte: { label: 'Greater than or equal', initialValue: '' },
      lte: { label: 'Less than or equal', initialValue: '' },
      in: { label: 'Is one of', initialValue: '' },
      not_in: { label: 'Is not one of', initialValue: '' },
    }
  }

  if (field.kind === 'timestamp' || field.kind === 'calendarDay') {
    return {
      equals: { label: 'Is exactly', initialValue: '' },
      not: { label: 'Is not exactly', initialValue: '' },
      lt: { label: 'Is before', initialValue: '' },
      lte: { label: 'Is before or equal to', initialValue: '' },
      gt: { label: 'Is after', initialValue: '' },
      gte: { label: 'Is after or equal to', initialValue: '' },
      empty: { label: 'Is empty', initialValue: true, needsValue: false },
      not_empty: {
        label: 'Is not empty',
        initialValue: true,
        needsValue: false,
      },
    }
  }

  if (field.kind === 'decimal' || field.kind === 'bigInt') {
    return {
      equals: { label: 'Is exactly', initialValue: '' },
      not: { label: 'Is not exactly', initialValue: '' },
      lt: { label: 'Is less than', initialValue: '' },
      lte: { label: 'Is less than or equal to', initialValue: '' },
      gt: { label: 'Is greater than', initialValue: '' },
      gte: { label: 'Is greater than or equal', initialValue: '' },
      empty: { label: 'Is empty', initialValue: true, needsValue: false },
      not_empty: {
        label: 'Is not empty',
        initialValue: true,
        needsValue: false,
      },
    }
  }

  if (field.kind === 'integer' || field.kind === 'float') {
    return {
      equals: { label: 'Equals', initialValue: 0 },
      not: { label: 'Does not equal', initialValue: 0 },
      lt: { label: 'Less than', initialValue: 0 },
      lte: { label: 'Less than or equal', initialValue: 0 },
      gt: { label: 'Greater than', initialValue: 0 },
      gte: { label: 'Greater than or equal', initialValue: 0 },
      empty: { label: 'Is empty', initialValue: null, needsValue: false },
      not_empty: {
        label: 'Is not empty',
        initialValue: null,
        needsValue: false,
      },
    }
  }

  if (field.kind === 'checkbox') {
    return {
      is: { label: 'Is', initialValue: true },
      not: { label: 'Is not', initialValue: true },
    }
  }

  if (field.kind === 'multiselect')
    return {
      matches: { label: 'Matches', initialValue: [] },
      not_matches: { label: 'Does not match', initialValue: [] },
    }

  if (field.kind === 'relationship') {
    const many = Boolean(field.fieldMeta.many)
    return many
      ? {
          empty: { label: 'Is empty', initialValue: true, needsValue: false },
          not_empty: {
            label: 'Is not empty',
            initialValue: true,
            needsValue: false,
          },
          some: { label: 'Is one of', initialValue: '' },
          not_some: { label: 'Is not one of', initialValue: '' },
        }
      : {
          empty: { label: 'Is empty', initialValue: true, needsValue: false },
          not_empty: {
            label: 'Is not empty',
            initialValue: true,
            needsValue: false,
          },
          is: { label: 'Is', initialValue: '' },
          not_is: { label: 'Is not', initialValue: '' },
        }
  }

  return {}
}

export function filterTypesForField(
  field: Pick<DashboardField, 'kind' | 'fieldMeta'>,
) {
  return Object.keys(filterTypeMetasForField(field))
}
