import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Input } from '@/components/ui/input'
import type {
  DashboardField,
  DashboardRelationshipOption,
} from '@/features/cms/graphql-client'
import {
  dashboardQueryKeys,
  fetchDashboardRelationshipOptions,
  fetchDashboardRelationshipOptionsByIds,
  fetchKeystoneAdminMeta,
  findDashboardListByPath,
} from '@/features/cms/graphql-client'

function relationListKey(field: DashboardField) {
  const ref = typeof field.fieldMeta.ref === 'string' ? field.fieldMeta.ref : ''
  return ref.split('.')[0] || ''
}

function relationListPath(field: DashboardField) {
  return typeof field.fieldMeta.refListPath === 'string'
    ? field.fieldMeta.refListPath
    : relationListKey(field)
}

function selectedIds(value: unknown) {
  if (Array.isArray(value))
    return value.map((entry) => String(entry)).filter(Boolean)
  const stringValue = String(value ?? '').trim()
  if (!stringValue) return []
  return stringValue
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function RelationshipFilterInput({
  field,
  value,
  onChange,
  type,
  autoFocus,
}: {
  field: DashboardField
  value: unknown
  onChange: (value: unknown) => void
  type: string
  autoFocus?: boolean
}) {
  const listKey = relationListKey(field)
  const listPath = relationListPath(field)
  const labelField =
    typeof field.fieldMeta.refLabelField === 'string'
      ? field.fieldMeta.refLabelField
      : undefined
  const searchFields = Array.isArray(field.fieldMeta.refSearchFields)
    ? field.fieldMeta.refSearchFields.filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.trim().length > 0,
      )
    : undefined
  const optionConfig = useMemo(
    () => ({ labelField, searchFields }),
    [labelField, searchFields],
  )
  const many = type === 'some' || type === 'not_some'
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [options, setOptions] = useState<DashboardRelationshipOption[]>([])
  const pageSize = 20
  const ids = useMemo(() => selectedIds(value), [value])
  const selectedSet = useMemo(() => new Set(ids), [ids])

  const { data: adminMeta } = useQuery({
    queryKey: dashboardQueryKeys.adminMeta,
    queryFn: () => fetchKeystoneAdminMeta(),
    enabled: Boolean(listKey),
  })
  const relatedList = adminMeta
    ? findDashboardListByPath(adminMeta, listPath || listKey)
    : undefined
  const resolvedListKey = relatedList?.path ?? listKey
  const { data: optionsData = { items: [], count: 0 } } = useQuery({
    queryKey: dashboardQueryKeys.relationshipOptions(
      resolvedListKey,
      search,
      pageSize,
      page * pageSize,
      optionConfig,
    ),
    queryFn: () =>
      fetchDashboardRelationshipOptions({
        listKey: resolvedListKey,
        search,
        take: pageSize,
        skip: page * pageSize,
        config: optionConfig,
      }),
    enabled: Boolean(resolvedListKey),
  })
  const { data: selectedOptions = [] } = useQuery({
    queryKey: [
      'dashboard',
      'relationshipOptionsByIds',
      resolvedListKey,
      ids,
      optionConfig,
    ],
    queryFn: () =>
      fetchDashboardRelationshipOptionsByIds({
        listKey: resolvedListKey,
        ids,
        config: optionConfig,
      }),
    enabled: Boolean(resolvedListKey && ids.length > 0),
  })
  const selectedLabelById = useMemo(
    () => new Map(selectedOptions.map((option) => [option.id, option.label])),
    [selectedOptions],
  )

  useEffect(() => {
    setPage(0)
    setOptions([])
  }, [search, listKey, relatedList?.path])

  useEffect(() => {
    setOptions((current) => {
      if (page === 0) return optionsData.items
      const seen = new Set(current.map((option) => option.id))
      return [
        ...current,
        ...optionsData.items.filter((option) => !seen.has(option.id)),
      ]
    })
  }, [optionsData.items, page])

  function setIds(nextIds: string[]) {
    const unique = Array.from(new Set(nextIds))
    onChange(many ? unique : (unique[0] ?? ''))
  }

  return (
    <div className="space-y-2 rounded-[10px] p-2 shadow-[inset_0_0_0_1px_var(--ks-line)]">
      <div className="flex items-center gap-2">
        <Search className="size-4 text-[var(--ks-dim)]" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          autoFocus={autoFocus}
          placeholder={`Search ${relatedList?.label ?? 'related items'}...`}
        />
      </div>
      {ids.length ? (
        <div className="flex flex-wrap gap-1.5">
          {ids.map((id) => (
            <span
              key={id}
              className="inline-flex h-6 items-center gap-1.5 rounded-[6px] bg-[var(--ks-track)] px-2 text-[12px] text-[var(--ks-ink-2)] shadow-[inset_0_0_0_1px_var(--ks-line)]"
            >
              {selectedLabelById.get(id) ?? id}
              <button
                type="button"
                onClick={() => setIds(ids.filter((entry) => entry !== id))}
                className="text-[var(--ks-dim)] hover:text-foreground"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="max-h-44 overflow-auto rounded-[8px] bg-[var(--ks-surface)] shadow-[inset_0_0_0_1px_var(--ks-line)]">
        {options.length === 0 ? (
          <div className="p-3 text-[13px] text-[var(--ks-dim)]">
            No related items found.
          </div>
        ) : null}
        {options.map((option) => {
          const checked = selectedSet.has(option.id)
          return (
            <button
              key={option.id}
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-[var(--ks-hover)]"
              onClick={() => {
                if (many)
                  setIds(
                    checked
                      ? ids.filter((id) => id !== option.id)
                      : [...ids, option.id],
                  )
                else setIds(checked ? [] : [option.id])
              }}
            >
              <span>{option.label}</span>
              <span className="font-mono text-[12px] text-[var(--ks-dim)]">
                {checked ? 'Selected' : option.id}
              </span>
            </button>
          )
        })}
        {options.length < optionsData.count ? (
          <button
            type="button"
            className="w-full border-t px-3 py-2 text-left text-[13px] text-[var(--ks-dim)] hover:bg-[var(--ks-hover)]"
            onClick={() => setPage((current) => current + 1)}
          >
            Load more related items
          </button>
        ) : null}
      </div>
    </div>
  )
}
