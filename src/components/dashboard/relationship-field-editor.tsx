import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type {
  DashboardField,
  DashboardList,
  DashboardRelationshipOption,
} from '@/features/cms/graphql-client'
import {
  dashboardQueryKeys,
  fetchDashboardRelationshipOptions,
  fetchDashboardRelationshipOptionsByIds,
  fetchKeystoneAdminMeta,
  findDashboardListByPath,
} from '@/features/cms/graphql-client'
import { cn } from '@/lib/utils'

import { resolveDashboardFieldMode } from './field-value-editor'
import { RelationshipCreateSheet } from './relationship-create-sheet'
import { RelationshipEditSheet } from './relationship-edit-sheet'
import { relationshipViewUiConfig } from './views/relationship'
import { getFieldViewsForField } from './views/registry'

function relationListKey(field: DashboardField) {
  const ref = typeof field.fieldMeta.ref === 'string' ? field.fieldMeta.ref : ''
  return ref.split('.')[0] || ''
}

function relationListPath(field: DashboardField) {
  return typeof field.fieldMeta.refListPath === 'string'
    ? field.fieldMeta.refListPath
    : relationListKey(field)
}

type RelationshipOptionState = { id: string; label: string }

type StructuredRelationshipValue =
  | { kind: 'count'; count: number }
  | {
      kind: 'one'
      value: RelationshipOptionState | null
      initialValue: RelationshipOptionState | null
    }
  | {
      kind: 'many'
      value: RelationshipOptionState[]
      initialValue: RelationshipOptionState[]
    }
  | {
      kind: 'cards-view'
      value: RelationshipOptionState[]
      initialValue: RelationshipOptionState[]
      itemBeingCreated: boolean
      itemsBeingEdited: string[]
    }

function asRelationshipOption(entry: unknown): RelationshipOptionState | null {
  if (!entry || typeof entry !== 'object') return null
  const record = entry as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id : String(record.id ?? '')
  if (!id) return null
  return { id, label: typeof record.label === 'string' ? record.label : id }
}

function normalizeRelationshipState(
  value: unknown,
): StructuredRelationshipValue {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    if (record.kind === 'count')
      return { kind: 'count', count: Number(record.count ?? 0) }
    if (record.kind === 'one') {
      return {
        kind: 'one',
        value: asRelationshipOption(record.value),
        initialValue: asRelationshipOption(record.initialValue),
      }
    }
    if (record.kind === 'many') {
      const current = Array.isArray(record.value)
        ? record.value
            .map(asRelationshipOption)
            .filter((entry): entry is RelationshipOptionState => entry !== null)
        : []
      const initial = Array.isArray(record.initialValue)
        ? record.initialValue
            .map(asRelationshipOption)
            .filter((entry): entry is RelationshipOptionState => entry !== null)
        : []
      return { kind: 'many', value: current, initialValue: initial }
    }
    if (record.kind === 'cards-view') {
      const current = Array.isArray(record.value)
        ? record.value
            .map(asRelationshipOption)
            .filter((entry): entry is RelationshipOptionState => entry !== null)
        : []
      const initial = Array.isArray(record.initialValue)
        ? record.initialValue
            .map(asRelationshipOption)
            .filter((entry): entry is RelationshipOptionState => entry !== null)
        : []
      const itemsBeingEdited = Array.isArray(record.itemsBeingEdited)
        ? record.itemsBeingEdited.filter(
            (entry): entry is string =>
              typeof entry === 'string' && entry.length > 0,
          )
        : []
      return {
        kind: 'cards-view',
        value: current,
        initialValue: initial,
        itemBeingCreated: record.itemBeingCreated === true,
        itemsBeingEdited,
      }
    }
  }
  if (Array.isArray(value)) {
    const current = value
      .map(asRelationshipOption)
      .filter((entry): entry is RelationshipOptionState => entry !== null)
    return { kind: 'many', value: current, initialValue: current }
  }
  if (value && typeof value === 'object') {
    const option = asRelationshipOption(value)
    return { kind: 'one', value: option, initialValue: option }
  }
  const raw = String(value ?? '').trim()
  if (!raw) return { kind: 'one', value: null, initialValue: null }
  const options = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((id) => ({ id, label: id }))
  return options.length > 1
    ? { kind: 'many', value: options, initialValue: options }
    : {
        kind: 'one',
        value: options[0] ?? null,
        initialValue: options[0] ?? null,
      }
}

export function relationshipEditorSelectedIds(value: unknown) {
  const normalized = normalizeRelationshipState(value)
  if (normalized.kind === 'count') return []
  if (normalized.kind === 'many' || normalized.kind === 'cards-view')
    return normalized.value.map((entry) => entry.id)
  return normalized.value ? [normalized.value.id] : []
}

export function relationshipCardsStateAfterSave(
  value: unknown,
  item: { id: string; label?: string },
) {
  const normalized = normalizeRelationshipState(value)
  if (normalized.kind !== 'cards-view') return normalized
  return {
    kind: 'cards-view',
    initialValue: normalized.initialValue,
    value: normalized.value.map((entry) =>
      entry.id === item.id
        ? { ...entry, label: item.label ?? entry.label }
        : entry,
    ),
    itemBeingCreated: false,
    itemsBeingEdited: normalized.itemsBeingEdited.filter(
      (entry) => entry !== item.id,
    ),
  } satisfies StructuredRelationshipValue
}

export function relationshipCardsStateAfterCreate(
  value: unknown,
  item: { id: string; label?: string },
) {
  const normalized = normalizeRelationshipState(value)
  if (normalized.kind !== 'cards-view') return normalized
  if (normalized.value.some((entry) => entry.id === item.id)) {
    return {
      kind: 'cards-view',
      initialValue: normalized.initialValue,
      value: normalized.value.map((entry) =>
        entry.id === item.id
          ? { ...entry, label: item.label ?? entry.label }
          : entry,
      ),
      itemBeingCreated: false,
      itemsBeingEdited: normalized.itemsBeingEdited,
    } satisfies StructuredRelationshipValue
  }
  return {
    kind: 'cards-view',
    initialValue: normalized.initialValue,
    value: [...normalized.value, { id: item.id, label: item.label ?? item.id }],
    itemBeingCreated: false,
    itemsBeingEdited: normalized.itemsBeingEdited,
  } satisfies StructuredRelationshipValue
}

export function relationshipCardsStateAfterCreateSheetClose(value: unknown) {
  const normalized = normalizeRelationshipState(value)
  if (normalized.kind !== 'cards-view') return normalized
  return {
    kind: 'cards-view',
    initialValue: normalized.initialValue,
    value: normalized.value,
    itemBeingCreated: false,
    itemsBeingEdited: normalized.itemsBeingEdited,
  } satisfies StructuredRelationshipValue
}

export function relationshipCardsStateAfterEditSheetClose(
  value: unknown,
  id: string | null,
) {
  const normalized = normalizeRelationshipState(value)
  if (normalized.kind !== 'cards-view') return normalized
  return {
    kind: 'cards-view',
    initialValue: normalized.initialValue,
    value: normalized.value,
    itemBeingCreated: normalized.itemBeingCreated,
    itemsBeingEdited: normalized.itemsBeingEdited.filter(
      (entry) => entry !== id,
    ),
  } satisfies StructuredRelationshipValue
}

function relationshipUiConfig(field: DashboardField) {
  return field.fieldMeta.ui &&
    typeof field.fieldMeta.ui === 'object' &&
    !Array.isArray(field.fieldMeta.ui)
    ? (field.fieldMeta.ui as Record<string, unknown>)
    : undefined
}

function uiFieldList(
  uiConfig: Record<string, unknown> | undefined,
  key: 'inlineCreate' | 'inlineEdit',
) {
  const candidate = uiConfig?.[key]
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate))
    return undefined
  const fields = (candidate as { fields?: unknown }).fields
  if (!Array.isArray(fields)) return undefined
  const fieldPaths = fields.filter(
    (entry): entry is string =>
      typeof entry === 'string' && entry.trim().length > 0,
  )
  return fieldPaths.length ? fieldPaths : undefined
}

export function relationshipCardFieldSelections(
  list: DashboardList | undefined,
  fieldPaths: string[],
) {
  return fieldPaths.map((fieldPath) => {
    const field = list?.fields.find((candidate) => candidate.path === fieldPath)
    const selection = field?.fieldMeta.graphqlSelection
    return typeof selection === 'string' && selection.trim()
      ? selection
      : fieldPath
  })
}

function displayCardValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(
      record.label ??
        record.name ??
        record.filename ??
        record.altText ??
        record.id ??
        '—',
    )
  }
  return String(value)
}

function RelationshipValueCard({
  id,
  option,
  cardFields,
  relatedList,
  canEditInline,
  canRemove,
  onEdit,
  onRemove,
}: {
  id: string
  option?: DashboardRelationshipOption
  cardFields: string[]
  relatedList?: DashboardList
  canEditInline: boolean
  canRemove: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  const data = option?.data ?? {}
  const optionLabel = option?.label ?? id
  return (
    <Card size="sm" className="border bg-muted/20">
      <CardHeader>
        <CardTitle>{optionLabel}</CardTitle>
        <CardDescription className="font-mono text-xs">{id}</CardDescription>
      </CardHeader>
      {cardFields.length ? (
        <CardContent className="space-y-2 text-sm">
          {cardFields.map((fieldPath) => (
            <div
              key={fieldPath}
              className="grid grid-cols-[96px_minmax(0,1fr)] gap-2"
            >
              <span className="text-muted-foreground">{fieldPath}</span>
              <span className="break-words">
                {(() => {
                  const relatedField = relatedList?.fields.find(
                    (candidate: DashboardField) => candidate.path === fieldPath,
                  )
                  const CardValue = relatedField
                    ? (
                        getFieldViewsForField(relatedField) as {
                          CardValue?: (props: {
                            field: DashboardField
                            item: Record<string, unknown>
                          }) => React.ReactNode
                        }
                      ).CardValue
                    : undefined
                  return CardValue ? (
                    <CardValue field={relatedField!} item={data} />
                  ) : (
                    displayCardValue(data[fieldPath])
                  )
                })()}
              </span>
            </div>
          ))}
        </CardContent>
      ) : null}
      {canEditInline || canRemove ? (
        <CardContent className="flex flex-wrap gap-2 pt-0">
          {canEditInline ? (
            <button
              type="button"
              aria-label={`Edit ${optionLabel}`}
              onClick={onEdit}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Edit
            </button>
          ) : null}
          {canRemove ? (
            <button
              type="button"
              aria-label={`Remove ${optionLabel}`}
              onClick={onRemove}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Remove
            </button>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  )
}

export function RelationshipFieldEditor({
  field,
  value,
  onChange,
}: {
  field: DashboardField
  value: unknown
  onChange: (value: unknown) => void
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
  const relationshipUi = relationshipViewUiConfig(field)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const createCompletedRef = useRef(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const relationshipState = useMemo(
    () => normalizeRelationshipState(value),
    [value],
  )
  const ids = useMemo(
    () => relationshipEditorSelectedIds(relationshipState),
    [relationshipState],
  )
  const selectedSet = useMemo(() => new Set(ids), [ids])
  const many = Boolean(field.fieldMeta.many)
  const pageSize = 20
  const { data: adminMeta } = useQuery({
    queryKey: dashboardQueryKeys.adminMeta,
    queryFn: () => fetchKeystoneAdminMeta(),
    enabled: Boolean(listKey),
  })
  const relatedList = adminMeta
    ? findDashboardListByPath(adminMeta, listPath || listKey)
    : undefined
  const resolvedListKey = relatedList?.path ?? listKey
  const optionConfig = useMemo(
    () => ({
      labelField,
      searchFields,
      extraSelection: relationshipCardFieldSelections(
        relatedList,
        relationshipUi.cardFields ?? [],
      ),
    }),
    [labelField, relatedList, relationshipUi.cardFields, searchFields],
  )
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
  const data = optionsData.items
  const { data: selectedOptions = [] } = useQuery({
    queryKey: [
      'dashboard',
      'relationshipOptionsByIds',
      resolvedListKey,
      ids,
      optionConfig,
    ] as const,
    queryFn: () =>
      fetchDashboardRelationshipOptionsByIds({
        listKey: resolvedListKey,
        ids,
        config: optionConfig,
      }),
    enabled: Boolean(resolvedListKey && ids.length),
  })
  const selectedOptionById = useMemo(
    () => new Map(selectedOptions.map((option) => [option.id, option])),
    [selectedOptions],
  )
  const selectedLabelById = useMemo(
    () => new Map(selectedOptions.map((option) => [option.id, option.label])),
    [selectedOptions],
  )
  const uiConfig = relationshipUiConfig(field)
  const inlineCreateFields = useMemo(
    () => uiFieldList(uiConfig, 'inlineCreate'),
    [uiConfig],
  )
  const inlineEditFields = useMemo(
    () => uiFieldList(uiConfig, 'inlineEdit'),
    [uiConfig],
  )
  const linkToItem =
    (uiConfig as { linkToItem?: unknown } | undefined)?.linkToItem !== false
  const canCreateRelated = Boolean(relatedList && !relatedList.hideCreate)
  const canEditInline = Boolean(relatedList && inlineEditFields?.length)
  const canViewRelated =
    resolveDashboardFieldMode(field, 'itemView') !== 'hidden' && linkToItem
  const canInlineConnect = relationshipUi.inlineConnect !== false
  const displayMode = relationshipUi.displayMode ?? 'select'
  const removeMode = relationshipUi.removeMode ?? 'disconnect'

  useEffect(() => {
    setPage(0)
  }, [search, listKey, relatedList?.path])

  function setIds(nextIds: string[]) {
    const uniqueIds = Array.from(new Set(nextIds))
    const optionById = new Map<string, RelationshipOptionState>()
    if (
      relationshipState.kind === 'many' ||
      relationshipState.kind === 'cards-view'
    ) {
      for (const option of [
        ...relationshipState.initialValue,
        ...relationshipState.value,
      ])
        optionById.set(option.id, option)
    }
    if (relationshipState.kind === 'one') {
      if (relationshipState.initialValue)
        optionById.set(
          relationshipState.initialValue.id,
          relationshipState.initialValue,
        )
      if (relationshipState.value)
        optionById.set(relationshipState.value.id, relationshipState.value)
    }
    for (const option of selectedOptions)
      optionById.set(option.id, { id: option.id, label: option.label })

    if (many) {
      const initialValue =
        relationshipState.kind === 'many' ||
        relationshipState.kind === 'cards-view'
          ? relationshipState.initialValue
          : []
      const nextValue = uniqueIds.map(
        (id) => optionById.get(id) ?? { id, label: id },
      )
      if (displayMode === 'cards') {
        onChange({
          kind: 'cards-view',
          initialValue,
          value: nextValue,
          itemBeingCreated:
            relationshipState.kind === 'cards-view'
              ? relationshipState.itemBeingCreated
              : false,
          itemsBeingEdited:
            relationshipState.kind === 'cards-view'
              ? relationshipState.itemsBeingEdited
              : [],
        } satisfies StructuredRelationshipValue)
        return
      }
      onChange({
        kind: 'many',
        initialValue,
        value: nextValue,
      } satisfies StructuredRelationshipValue)
      return
    }

    const nextId = uniqueIds[0]
    onChange({
      kind: 'one',
      initialValue:
        relationshipState.kind === 'one'
          ? relationshipState.initialValue
          : null,
      value: nextId
        ? (optionById.get(nextId) ?? { id: nextId, label: nextId })
        : null,
    } satisfies StructuredRelationshipValue)
  }

  function removeId(id: string) {
    if (removeMode === 'none') return
    setIds(ids.filter((entry) => entry !== id))
  }

  function openCreateRelated() {
    createCompletedRef.current = false
    if (displayMode === 'cards' && relationshipState.kind === 'cards-view') {
      onChange({
        ...relationshipState,
        itemBeingCreated: true,
      } satisfies StructuredRelationshipValue)
    }
    setCreateOpen(true)
  }

  const countValue = typeof value === 'number' ? value : Number(value ?? 0)

  if (displayMode === 'count') {
    return (
      <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
        {Number.isFinite(countValue) ? countValue : 0} related{' '}
        {(Number.isFinite(countValue) ? countValue : 0) === 1
          ? 'item'
          : 'items'}
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" aria-hidden="true" />
        <Input
          id={`field-${field.path}`}
          aria-label={`Search ${field.label}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search related items..."
        />
      </div>
      {displayMode === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {ids.map((id) => {
            const option = selectedOptionById.get(id)
            return (
              <RelationshipValueCard
                key={id}
                id={id}
                option={option}
                cardFields={relationshipUi.cardFields ?? []}
                relatedList={relatedList}
                canEditInline={canEditInline}
                canRemove={removeMode !== 'none'}
                onEdit={() => {
                  if (relationshipState.kind === 'cards-view') {
                    const nextEditing = Array.from(
                      new Set([...relationshipState.itemsBeingEdited, id]),
                    )
                    onChange({
                      ...relationshipState,
                      itemsBeingEdited: nextEditing,
                    } satisfies StructuredRelationshipValue)
                  }
                  setEditingId(id)
                }}
                onRemove={() => removeId(id)}
              />
            )
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {ids.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-2 py-1 text-xs"
            >
              {selectedLabelById.get(id) ?? id}
              {canEditInline ? (
                <button
                  type="button"
                  aria-label={`Edit ${selectedLabelById.get(id) ?? id}`}
                  onClick={() => setEditingId(id)}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Edit
                </button>
              ) : null}
              {removeMode !== 'none' ? (
                <button
                  type="button"
                  aria-label={`Remove ${selectedLabelById.get(id) ?? id}`}
                  onClick={() => removeId(id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
        </div>
      )}
      <div
        className="max-h-44 overflow-auto rounded-md border bg-background"
        role="group"
        aria-label={`${field.label} options`}
      >
        {data.length === 0 ? (
          <div
            className="p-3 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            No related items found.
          </div>
        ) : null}
        {data.map((option) => {
          const checked = selectedSet.has(option.id)
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={checked}
              aria-label={`${checked ? 'Disconnect' : 'Connect'} ${option.label}`}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canInlineConnect}
              onClick={() => {
                if (!canInlineConnect) return
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
              <span className="font-mono text-xs text-muted-foreground">
                {option.id}
              </span>
            </button>
          )
        })}
        {(page + 1) * pageSize < optionsData.count ? (
          <button
            type="button"
            className="w-full border-t px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
            onClick={() => setPage((current) => current + 1)}
          >
            Load more related items
          </button>
        ) : null}
      </div>
      {listKey ? (
        <div className="relative z-10 flex flex-wrap gap-2">
          {canCreateRelated ? (
            relatedList?.isSingleton ? (
              <Link
                to="/dashboard/$listKey/$id"
                params={{ listKey: resolvedListKey, id: '1' }}
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                )}
              >
                <Plus className="size-3.5" />
                Create related {relatedList.singular}
              </Link>
            ) : (
              <button
                type="button"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'relative z-10',
                )}
                onPointerDown={(event) => {
                  if (event.pointerType === 'mouse' && event.button !== 0)
                    return
                  openCreateRelated()
                }}
                onClick={openCreateRelated}
              >
                <Plus className="size-3.5" />
                Create related {relatedList?.singular ?? listKey}
              </button>
            )
          ) : null}
          {canViewRelated && ids.length === 1 ? (
            <Link
              to="/dashboard/$listKey/$id"
              params={{ listKey: resolvedListKey, id: ids[0] ?? '' }}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              View related details
            </Link>
          ) : null}
        </div>
      ) : null}
      {relatedList && !relatedList.isSingleton ? (
        <RelationshipCreateSheet
          list={relatedList}
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open)
            if (open) return
            if (createCompletedRef.current) {
              createCompletedRef.current = false
              return
            }
            if (
              displayMode === 'cards' &&
              relationshipState.kind === 'cards-view'
            ) {
              onChange(
                relationshipCardsStateAfterCreateSheetClose(relationshipState),
              )
            }
          }}
          fieldPaths={inlineCreateFields}
          onCreated={(item) => {
            createCompletedRef.current = true
            if (
              displayMode === 'cards' &&
              relationshipState.kind === 'cards-view'
            ) {
              onChange(
                relationshipCardsStateAfterCreate(relationshipState, item),
              )
              return
            }
            if (many) setIds([...ids, item.id])
            else setIds([item.id])
          }}
        />
      ) : null}
      {relatedList && editingId && canEditInline ? (
        <RelationshipEditSheet
          list={relatedList}
          item={{
            id: editingId,
            label: selectedLabelById.get(editingId) ?? editingId,
          }}
          open={Boolean(editingId)}
          onOpenChange={(open) => {
            if (!open) {
              setEditingId(null)
              if (
                displayMode === 'cards' &&
                relationshipState.kind === 'cards-view'
              ) {
                onChange(
                  relationshipCardsStateAfterEditSheetClose(
                    relationshipState,
                    editingId,
                  ),
                )
              }
            }
          }}
          fieldPaths={inlineEditFields}
          onSaved={(item) => {
            setEditingId(null)
            if (
              displayMode === 'cards' &&
              relationshipState.kind === 'cards-view'
            ) {
              onChange(relationshipCardsStateAfterSave(relationshipState, item))
              return
            }
            setIds(
              many
                ? ids.map((entry) => (entry === item.id ? item.id : entry))
                : [item.id],
            )
          }}
        />
      ) : null}
    </div>
  )
}
