import { describe, expect, it } from 'vitest'

import {
  formatOfficialFilterParam,
  officialFilterParamsFromSearch,
  parseOfficialFilterParam,
} from '../src/components/dashboard/filter-param-compat'
import {
  buildWhere,
  filterTypesForField,
} from '../src/features/cms/graphql-client'
import { filterTypeMetasForField } from '../src/features/cms/dashboard-filter-types'

const list = {
  initialFilter: null,
  initialSearchFields: [],
  fields: [
    {
      path: 'label',
      kind: 'text',
      isFilterable: true,
      listView: { fieldMode: 'read' },
      fieldMeta: {},
    },
    {
      path: 'status',
      kind: 'select',
      isFilterable: true,
      listView: { fieldMode: 'read' },
      fieldMeta: {},
    },
    {
      path: 'content',
      kind: 'document',
      isFilterable: true,
      listView: { fieldMode: 'read' },
      fieldMeta: {},
    },
    {
      path: 'dueDate',
      kind: 'timestamp',
      isFilterable: true,
      listView: { fieldMode: 'read' },
      fieldMeta: {},
    },
    {
      path: 'budget',
      kind: 'decimal',
      isFilterable: true,
      listView: { fieldMode: 'read' },
      fieldMeta: {},
    },
    {
      path: 'largeNumber',
      kind: 'bigInt',
      isFilterable: true,
      listView: { fieldMode: 'read' },
      fieldMeta: {},
    },
    {
      path: 'tags',
      kind: 'multiselect',
      isFilterable: true,
      listView: { fieldMode: 'read' },
      fieldMeta: {},
    },
    {
      path: 'assignedTo',
      kind: 'relationship',
      isFilterable: true,
      listView: { fieldMode: 'read' },
      fieldMeta: { many: false },
    },
    {
      path: 'todoImages',
      kind: 'relationship',
      isFilterable: true,
      listView: { fieldMode: 'read' },
      fieldMeta: { many: true },
    },
  ],
} as any

describe('dashboard official filter param compatibility', () => {
  it('reads repeated official filter params from search state', () => {
    expect(
      officialFilterParamsFromSearch({
        filter: ['label_contains_i_"Launch"', 'status_matches_["done"]'],
      }),
    ).toEqual(['label_contains_i_"Launch"', 'status_matches_["done"]'])
  })

  it('formats and parses official filter params against the allowed filter types', () => {
    expect(formatOfficialFilterParam('label', 'contains_i', 'Launch')).toBe(
      'label_contains_i_"Launch"',
    )
    expect(formatOfficialFilterParam('status', 'empty', true, false)).toBe(
      'status_empty',
    )

    expect(
      parseOfficialFilterParam('label_contains_i_"Launch"', [
        'contains_i',
        'is_i',
      ]),
    ).toEqual({
      fieldPath: 'label',
      filterType: 'contains_i',
      rawValue: '"Launch"',
    })
    expect(
      parseOfficialFilterParam('status_matches_["done"]', [
        'matches',
        'not_matches',
      ]),
    ).toEqual({
      fieldPath: 'status',
      filterType: 'matches',
      rawValue: '["done"]',
    })
  })

  it('builds where clauses from official filter params as an alias to internal filter keys', () => {
    expect(
      buildWhere(list, '', {
        filter: ['label_contains_i_"Launch"', 'status_matches_["done"]'],
      }),
    ).toEqual({
      AND: [
        { label: { contains: 'Launch', mode: 'insensitive' } },
        { status: { in: ['done'] } },
      ],
    })
  })

  it('still exposes the expected filter types for parsed official params', () => {
    expect(filterTypesForField(list.fields[0])).toContain('contains_i')
    expect(filterTypesForField(list.fields[1])).toContain('matches')
  })

  it('shares document filter metadata so is_empty no longer incorrectly requires a typed value', () => {
    expect(filterTypesForField(list.fields[2])).toContain('is_empty')
    expect(filterTypeMetasForField(list.fields[2]).is_empty).toEqual({
      label: 'Is empty',
      initialValue: true,
      needsValue: false,
    })
    expect(buildWhere(list, '', { filter: ['content_is_empty'] })).toEqual({
      content: { equals: null },
    })
  })

  it('builds official-style where clauses for timestamp, decimal, bigint, multiselect, and relationship filters', () => {
    expect(
      buildWhere(list, '', {
        filter: ['dueDate_gte_"2026-06-01T00:00:00.000Z"'],
      }),
    ).toEqual({
      dueDate: { gte: '2026-06-01T00:00:00.000Z' },
    })

    expect(buildWhere(list, '', { filter: ['budget_lte_"99.50"'] })).toEqual({
      budget: { lte: '99.50' },
    })

    expect(
      buildWhere(list, '', { filter: ['largeNumber_gt_"9007199254740992"'] }),
    ).toEqual({
      largeNumber: { gt: '9007199254740992' },
    })

    expect(
      buildWhere(list, '', { filter: ['tags_matches_["backend","feature"]'] }),
    ).toEqual({
      tags: { in: ['backend', 'feature'] },
    })

    expect(
      buildWhere(list, '', { filter: ['assignedTo_is_"user_admin"'] }),
    ).toEqual({
      assignedTo: { id: { equals: 'user_admin' } },
    })

    expect(
      buildWhere(list, '', { filter: ['todoImages_some_["image_dashboard"]'] }),
    ).toEqual({
      todoImages: { some: { id: { in: ['image_dashboard'] } } },
    })
  })

  it('exposes expected filter metadata for timestamp, decimal, bigint, multiselect, and relationship fields', () => {
    expect(filterTypesForField(list.fields[3])).toContain('gte')
    expect(filterTypeMetasForField(list.fields[4]).lte).toEqual({
      label: 'Is less than or equal to',
      initialValue: '',
    })
    expect(filterTypeMetasForField(list.fields[5]).gt).toEqual({
      label: 'Is greater than',
      initialValue: '',
    })
    expect(filterTypeMetasForField(list.fields[6]).matches).toEqual({
      label: 'Matches',
      initialValue: [],
    })
    expect(filterTypeMetasForField(list.fields[7]).is).toEqual({
      label: 'Is',
      initialValue: '',
    })
    expect(filterTypeMetasForField(list.fields[8]).some).toEqual({
      label: 'Is one of',
      initialValue: '',
    })
  })
})
