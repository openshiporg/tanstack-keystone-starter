import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import type {
  DashboardField,
  DashboardListItem,
  DashboardListPageData,
} from '@/features/cms/graphql-client'
import {
  dashboardQueryKeys,
  executeRawDashboardGraphQL,
} from '@/features/cms/graphql-client'

import { BulkEditDialog, bulkEditableFields } from './bulk-edit-dialog'
import { ListPageActions } from './list-page-actions'
import { Pagination } from './pagination'
import { getFieldViewsForField } from './views/registry'

export function collectBulkDeleteResult(args: {
  mutationName: string
  ids: string[]
  result: {
    data?: Record<string, unknown>
    errors?: Array<{ message: string; path?: Array<string | number> }>
  }
}) {
  const deletedItems = (args.result.data?.[args.mutationName] ?? []) as Array<{
    id: string
  } | null>
  const deletedIds = new Set(
    deletedItems
      .filter((entry): entry is { id: string } => Boolean(entry?.id))
      .map((entry) => entry.id),
  )
  const failedIds = args.ids.filter((id) => !deletedIds.has(id))
  const errorDetails = (args.result.errors ?? []).map((error, index) => {
    const pathIndex =
      typeof error.path?.[1] === 'number' ? error.path[1] : undefined
    const itemId =
      pathIndex !== undefined
        ? args.ids[pathIndex]
        : (failedIds[index] ?? 'unknown item')
    return `${itemId}: ${error.message}`
  })
  return { deletedIds, failedIds, errorDetails }
}

export function formatBulkDeleteMessage(args: {
  singular: string
  plural: string
  deletedCount: number
  failedIds: string[]
  errorDetails: string[]
}) {
  const summary = `${args.deletedCount} ${args.deletedCount === 1 ? args.singular.toLowerCase() : args.plural.toLowerCase()} deleted, ${args.failedIds.length} failed.`
  return args.errorDetails.length
    ? `${summary}\n${args.errorDetails.join('\n')}`
    : summary
}

const INTERACTIVE =
  'a,button,input,select,textarea,label,[role="checkbox"],[role="button"]'

/** Presentation only: map a status-like option value to a dot tone. Unknown values stay neutral. */
export function statusTone(value: unknown) {
  const v = String(value ?? '').toLowerCase()
  if (!v) return 'gray'
  if (
    /(block|fail|error|cancel|reject|revoked|expired|disabled|overdue|lost)/.test(
      v,
    )
  )
    return 'red'
  if (
    /^(done|complete|completed|active|approved|paid|published|resolved|success|succeeded|enabled|live|true)$/.test(
      v,
    )
  )
    return 'green'
  if (/(progress|doing|started|running|review|processing)/.test(v))
    return 'blue'
  if (/(pending|waiting|scheduled|hold|paused|draft)/.test(v)) return 'amber'
  return 'gray'
}

/**
 * The list body: a dense table on desktop (title + status dot, then the chosen columns), one card
 * per row on phones, and the sticky footer that becomes the bulk-action bar on selection.
 * Empty and filtered-empty states are rendered by the route.
 */
export function KeystoneListTable({
  data,
  isFetching = false,
}: {
  data: DashboardListPageData
  isFiltered?: boolean
  isFetching?: boolean
}) {
  const navigate = useNavigate({ from: '/dashboard/$listKey/' })
  const search = useSearch({ from: '/dashboard/$listKey/' })
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [deleting, setDeleting] = useState(false)
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)
  const canBulkDelete = !data.list.hideDelete
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const canBulkEdit = useMemo(
    () => bulkEditableFields(data.list).length > 0,
    [data.list],
  )
  const [selectedItemsState, setSelectedItems] = useState<{
    itemsFromServer?: DashboardListItem[]
    selectedItems: Set<string>
  }>(() => ({ itemsFromServer: undefined, selectedItems: new Set() }))

  useEffect(() => {
    if (selectedItemsState.itemsFromServer !== data.items) {
      const newSelectedItems = new Set<string>()
      data.items.forEach((item) => {
        if (selectedItemsState.selectedItems.has(item.id))
          newSelectedItems.add(item.id)
      })
      setSelectedItems({
        itemsFromServer: data.items,
        selectedItems: newSelectedItems,
      })
    }
  }, [
    data.items,
    selectedItemsState.itemsFromServer,
    selectedItemsState.selectedItems,
  ])

  const selected = selectedItemsState.selectedItems
  const setSelected = (next: Set<string>) =>
    setSelectedItems((state) => ({ ...state, selectedItems: next }))

  // Esc clears a selection
  useEffect(() => {
    if (selected.size === 0) return
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !document.querySelector('[role="dialog"],[role="alertdialog"],[role="menu"]')
      ) {
        setSelectedItems((state) => ({ ...state, selectedItems: new Set() }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected.size])

  const invalidateList = () =>
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === dashboardQueryKeys.adminMeta[0] &&
        (query.queryKey[1] === 'overview' ||
          (query.queryKey[1] === 'listPage' &&
            query.queryKey[2] === data.list.path)),
    })

  async function deleteSelectedItems() {
    if (!canBulkDelete) return
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setDeleting(true)
    setBulkMessage(null)
    try {
      const result = await executeRawDashboardGraphQL<
        Array<{ id: string } | null>
      >(
        `mutation DashboardBulkDelete($where: [${data.list.gqlNames.whereUniqueInputName}!]!) {
          ${data.list.gqlNames.deleteManyMutationName}(where: $where) { id }
        }`,
        { where: ids.map((id) => ({ id })) },
      )
      const { deletedIds, failedIds, errorDetails } = collectBulkDeleteResult({
        mutationName: data.list.gqlNames.deleteManyMutationName,
        ids,
        result: result as {
          data?: Record<string, unknown>
          errors?: Array<{ message: string; path?: Array<string | number> }>
        },
      })

      if (deletedIds.size > 0) {
        setSelectedItems({
          itemsFromServer: undefined,
          selectedItems: new Set(failedIds),
        })
        await invalidateList()
      }

      if (failedIds.length === 0) {
        toast({
          title: 'Items deleted',
          description: `${ids.length} ${ids.length === 1 ? data.list.singular.toLowerCase() : data.list.plural.toLowerCase()} removed.`,
        })
        return
      }

      const summary = `${deletedIds.size} ${deletedIds.size === 1 ? data.list.singular.toLowerCase() : data.list.plural.toLowerCase()} deleted, ${failedIds.length} failed.`
      setBulkMessage(
        formatBulkDeleteMessage({
          singular: data.list.singular,
          plural: data.list.plural,
          deletedCount: deletedIds.size,
          failedIds,
          errorDetails,
        }),
      )
      toast({ title: 'Bulk delete partially completed', description: summary })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to delete selected items.'
      setBulkMessage(message)
      toast({ title: 'Could not delete selected items', description: message })
    } finally {
      setDeleting(false)
    }
  }

  const list = data.list
  const canSelect = canBulkDelete || canBulkEdit
  const titleField =
    list.labelField && list.fieldMap[list.labelField] ? list.labelField : 'id'
  const titleLabel =
    titleField === 'id' ? 'ID' : (list.fieldMap[titleField]?.label ?? 'Title')
  const statusField = data.statusFieldPath
    ? list.fieldMap[data.statusFieldPath]
    : null
  const columns = data.selectedFields.filter(
    (field) => field.path !== 'id' && field.path !== titleField,
  )

  const explicitSortBy =
    typeof search.sortBy === 'string' && search.sortBy
      ? search.sortBy
      : data.sortBy
  const descending = explicitSortBy.startsWith('-')
  const sortField = descending ? explicitSortBy.slice(1) : explicitSortBy

  function handleSort(path: string) {
    const field = path === 'id' ? { isOrderable: true } : list.fieldMap[path]
    if (!field?.isOrderable) return
    const nextSort = sortField === path && !descending ? `-${path}` : path
    void navigate({
      search: (previous) => ({ ...previous, sortBy: nextSort, page: 1 }),
    })
  }

  function openItem(event: React.MouseEvent, item: DashboardListItem) {
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return
    if (window.getSelection()?.toString()) return
    const href = `/dashboard/${list.path}/${encodeURIComponent(item.id)}`
    if (event.metaKey || event.ctrlKey) {
      window.open(href, '_blank')
      return
    }
    void navigate({
      to: '/dashboard/$listKey/$id',
      params: { listKey: list.path, id: item.id },
    })
  }

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selected)
    if (checked) next.add(id)
    else next.delete(id)
    setSelected(next)
  }
  const allChecked =
    data.items.length > 0 && selected.size === data.items.length
  const someChecked = selected.size > 0 && !allChecked
  const toggleAll = (checked: boolean) =>
    setSelected(
      checked ? new Set(data.items.map((item) => item.id)) : new Set(),
    )

  const titleOf = (item: DashboardListItem) => {
    const raw = item[titleField]
    if (raw === null || raw === undefined || raw === '') return item.id
    return typeof raw === 'object' ? relationshipLabel(raw) : String(raw)
  }
  const statusOf = (item: DashboardListItem) => {
    if (!statusField) return null
    const raw = item[statusField.path]
    return {
      tone: statusTone(raw),
      label:
        raw === null || raw === undefined
          ? 'None'
          : optionLabel(statusField, String(raw)),
    }
  }

  const SortIcon = ({ path }: { path: string }) =>
    path === sortField ? (
      descending ? (
        <ArrowDown className="size-3 text-[var(--ks-ink-2)]" />
      ) : (
        <ArrowUp className="size-3 text-[var(--ks-ink-2)]" />
      )
    ) : null

  const sortLabel = (path: string, label: string, orderable?: boolean) =>
    orderable
      ? `${label}, ${
          sortField === path
            ? descending
              ? 'sorted descending; activate to sort ascending'
              : 'sorted ascending; activate to sort descending'
            : 'not sorted; activate to sort ascending'
        }`
      : label

  const titleSortable =
    titleField === 'id' || Boolean(list.fieldMap[titleField]?.isOrderable)
  const selectAllChecked = allChecked ? true : false

  return (
    <div
      className={cn('relative transition-opacity', isFetching && 'opacity-60')}
      aria-busy={isFetching || deleting}
    >
      {isFetching ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden">
          <div className="h-full w-1/3 animate-[ks-progress_1s_ease-in-out_infinite] bg-[var(--ks-accent)]" />
        </div>
      ) : null}

      {bulkMessage ? (
        <div
          className="m-3 rounded-[8px] bg-[color-mix(in_oklab,var(--ks-danger)_8%,transparent)] p-3 text-[13px] whitespace-pre-line text-[var(--ks-danger)]"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          {bulkMessage}
        </div>
      ) : null}

      {/* Desktop: dense table */}
      <div
        className="hidden overflow-x-auto md:block"
        role="region"
        aria-label={`${list.label} table, scrollable`}
        tabIndex={0}
      >
        <table className="w-full border-separate border-spacing-0 text-[13px] [&_.text-sm]:text-[13px]">
          <caption className="sr-only">{list.label}</caption>
          <thead>
            <tr className="[&>th]:h-9 [&>th]:border-b [&>th]:border-[var(--ks-line)] [&>th]:bg-[var(--ks-surface-2)] [&>th]:px-3 [&>th]:text-left [&>th]:align-middle">
              {canSelect ? (
                <th scope="col" className="w-10 !pr-1 !pl-6">
                  <Checkbox
                    aria-label={`Select all ${list.label.toLowerCase()}`}
                    checked={selectAllChecked}
                    indeterminate={someChecked}
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                  />
                </th>
              ) : null}
              <th
                scope="col"
                className={cn('min-w-[240px]', !canSelect && '!pl-6')}
                aria-sort={
                  sortField === titleField
                    ? descending
                      ? 'descending'
                      : 'ascending'
                    : 'none'
                }
              >
                <button
                  type="button"
                  onClick={() => handleSort(titleField)}
                  aria-label={sortLabel(titleField, titleLabel, titleSortable)}
                  className={cn(
                    'ks-label inline-flex items-center gap-1',
                    titleSortable
                      ? 'hover:text-[var(--ks-ink-2)]'
                      : 'cursor-default',
                  )}
                >
                  {titleLabel}
                  <SortIcon path={titleField} />
                </button>
              </th>
              {columns.map((field) => (
                <th
                  key={field.path}
                  scope="col"
                  className="whitespace-nowrap"
                  aria-sort={
                    sortField === field.path
                      ? descending
                        ? 'descending'
                        : 'ascending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    onClick={() => handleSort(field.path)}
                    aria-label={sortLabel(
                      field.path,
                      field.label,
                      field.isOrderable,
                    )}
                    className={cn(
                      'ks-label inline-flex items-center gap-1',
                      field.isOrderable
                        ? 'hover:text-[var(--ks-ink-2)]'
                        : 'cursor-default',
                    )}
                  >
                    {field.label}
                    <SortIcon path={field.path} />
                  </button>
                </th>
              ))}
              <th className="w-full !p-0" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => {
              const isSelected = selected.has(item.id)
              const status = statusOf(item)
              return (
                <tr
                  key={item.id}
                  onClick={(event) => openItem(event, item)}
                  data-selected={isSelected || undefined}
                  aria-selected={isSelected || undefined}
                  className="group cursor-pointer hover:[&>td]:bg-[var(--ks-hover)] data-[selected]:[&>td]:bg-[var(--ks-selected)] [&>td]:h-10 [&>td]:border-b [&>td]:border-[var(--ks-line)] [&>td]:px-3 [&>td]:align-middle"
                >
                  {canSelect ? (
                    <td className="relative w-10 !pr-1 !pl-6">
                      {isSelected ? (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-0 left-0 w-0.5 bg-[var(--ks-accent)]"
                        />
                      ) : null}
                      <Checkbox
                        aria-label={`Select ${titleOf(item)}`}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          toggle(item.id, checked === true)
                        }
                      />
                    </td>
                  ) : null}
                  <td className={cn('max-w-[420px]', !canSelect && '!pl-6')}>
                    <div className="flex min-w-0 items-center gap-2.5">
                      {status ? (
                        <span
                          className="ks-dot"
                          data-tone={status.tone}
                          title={status.label}
                          aria-label={status.label}
                          role="img"
                        />
                      ) : null}
                      <Link
                        to="/dashboard/$listKey/$id"
                        params={{ listKey: list.path, id: item.id }}
                        className="truncate font-medium text-[var(--ks-ink)] outline-none hover:underline focus-visible:underline"
                      >
                        {titleOf(item)}
                      </Link>
                    </div>
                  </td>
                  {columns.map((field) => (
                    <td
                      key={field.path}
                      className="max-w-[280px] whitespace-nowrap text-[var(--ks-ink-2)] [&_*]:truncate"
                    >
                      <CellContent
                        listPath={list.path}
                        item={item}
                        field={field}
                        isFirstField={false}
                      />
                    </td>
                  ))}
                  <td aria-hidden="true" className="!p-0" />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Phone: one card row per item */}
      <div className="md:hidden">
        <div className="flex h-9 items-center gap-3 border-b border-[var(--ks-line)] bg-[var(--ks-surface-2)] px-4">
          {canSelect ? (
            <Checkbox
              aria-label={`Select all ${list.label.toLowerCase()}`}
              checked={selectAllChecked}
              indeterminate={someChecked}
              onCheckedChange={(checked) => toggleAll(checked === true)}
            />
          ) : null}
          <span className="ks-label">{titleLabel}</span>
        </div>
        <ul>
          {data.items.map((item) => {
            const isSelected = selected.has(item.id)
            const status = statusOf(item)
            return (
              <li
                key={item.id}
                onClick={(event) => openItem(event, item)}
                data-selected={isSelected || undefined}
                className="relative flex cursor-pointer gap-3 border-b border-[var(--ks-line)] px-4 py-3 active:bg-[var(--ks-hover)] data-[selected]:bg-[var(--ks-selected)]"
              >
                {isSelected ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-0.5 bg-[var(--ks-accent)]"
                  />
                ) : null}
                {canSelect ? (
                  <div className="pt-0.5">
                    <Checkbox
                      aria-label={`Select ${titleOf(item)}`}
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        toggle(item.id, checked === true)
                      }
                    />
                  </div>
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex min-w-0 items-center gap-2">
                    {status ? (
                      <span
                        className="ks-dot"
                        data-tone={status.tone}
                        title={status.label}
                        aria-label={status.label}
                        role="img"
                      />
                    ) : null}
                    <Link
                      to="/dashboard/$listKey/$id"
                      params={{ listKey: list.path, id: item.id }}
                      className="truncate text-[14px] leading-5 font-medium text-[var(--ks-ink)]"
                    >
                      {titleOf(item)}
                    </Link>
                  </div>
                  {columns.length > 0 ? (
                    <dl className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] leading-4 text-[var(--ks-dim)] [&_.text-sm]:text-[12px]">
                      {columns.slice(0, 4).map((field) => (
                        <div
                          key={field.path}
                          className="flex max-w-full min-w-0 items-center gap-1"
                        >
                          <dt className="shrink-0 text-[var(--ks-label)]">
                            {field.label}
                          </dt>
                          <dd className="min-w-0 truncate text-[var(--ks-ink-2)] [&_*]:truncate">
                            <CellContent
                              listPath={list.path}
                              item={item}
                              field={field}
                              isFirstField={false}
                            />
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <Pagination
        currentPage={data.page}
        total={data.count || 0}
        pageSize={data.pageSize}
        list={{ singular: list.singular, plural: list.plural }}
        selectedItems={canSelect ? selected : new Set<string>()}
        selectionActions={
          canBulkDelete ? (
            <ListPageActions
              data={data}
              selectedItems={selected}
              selectedRows={data.items.filter((item) => selected.has(item.id))}
              disabled={deleting}
              onError={({ title, description, details }) => {
                setBulkMessage(details ?? description)
                toast({ title, description })
              }}
              onSuccess={async ({
                remainingIds,
                title,
                description,
                details,
              }) => {
                setSelectedItems({
                  itemsFromServer: undefined,
                  selectedItems: remainingIds,
                })
                await invalidateList()
                setBulkMessage(details ?? null)
                toast({ title, description })
              }}
            />
          ) : undefined
        }
        onResetSelection={canSelect ? () => setSelected(new Set()) : undefined}
        onDelete={canBulkDelete ? () => void deleteSelectedItems() : undefined}
        onEdit={canBulkEdit ? () => setBulkEditOpen(true) : undefined}
        isDeleteLoading={deleting}
      />
      {canBulkEdit ? (
        <BulkEditDialog
          list={list}
          ids={Array.from(selected)}
          open={bulkEditOpen}
          onOpenChange={setBulkEditOpen}
          onDone={() => setSelected(new Set())}
        />
      ) : null}
    </div>
  )
}

function CellContent({
  listPath,
  item,
  field,
  isFirstField,
}: {
  listPath: string
  item: DashboardListItem
  field: DashboardField
  isFirstField: boolean
}) {
  const value = item[field.path]
  const viewCell = renderViewCell({ listPath, item, field, isFirstField })
  if (viewCell) return viewCell

  if (shouldForceRowLink(field, isFirstField)) {
    return (
      <Link
        to="/dashboard/$listKey/$id"
        params={{ listKey: listPath, id: item.id }}
        className="font-medium text-[var(--ks-ink)] hover:underline"
      >
        {valueToLabel(field, value)}
      </Link>
    )
  }

  if (value === null || value === undefined) {
    return (
      <span className="text-[var(--ks-label)]">—</span>
    )
  }

  if (field.kind === 'checkbox') {
    const checked = value === true
    return (
      <Badge variant={checked ? 'secondary' : 'outline'}>
        {checked ? 'Yes' : 'No'}
      </Badge>
    )
  }

  if (field.kind === 'select') {
    return (
      <span className="select-text">{optionLabel(field, String(value))}</span>
    )
  }

  if (field.kind === 'multiselect' && Array.isArray(value)) {
    return (
      <span className="select-text">
        {value.map((entry) => optionLabel(field, String(entry))).join(', ')}
      </span>
    )
  }

  if (field.kind === 'relationship') {
    if (Array.isArray(value)) {
      return (
        <span className="inline-flex max-w-md flex-wrap gap-1 select-text">
          {value.length
            ? value.map((entry) => (
                <RelationshipLink
                  key={relationshipKey(entry)}
                  field={field}
                  value={entry}
                />
              ))
            : '—'}
        </span>
      )
    }
    return <RelationshipLink field={field} value={value} />
  }

  if (field.kind === 'password' && typeof value === 'object') {
    return (
      <Badge variant="outline">
        {(value as { isSet?: boolean }).isSet ? 'Set' : 'Not set'}
      </Badge>
    )
  }

  if (typeof value === 'object')
    return (
      <span className="text-[var(--ks-label)]">Complex data</span>
    )

  return <span className="select-text">{String(value)}</span>
}

function renderViewCell({
  listPath,
  item,
  field,
  isFirstField,
}: {
  listPath: string
  item: DashboardListItem
  field: DashboardField
  isFirstField: boolean
}) {
  try {
    const fieldViews = getFieldViewsForField(field)
    const CellComponent = fieldViews.Cell as (props: {
      field: DashboardField
      item: DashboardListItem
      linkTo?: { href: string }
    }) => ReactNode
    const shouldLinkToRow =
      field.kind !== 'relationship' &&
      ((CellComponent as { supportsLinkTo?: boolean }).supportsLinkTo ||
        shouldForceRowLink(field, isFirstField))
    const linkTo = shouldLinkToRow
      ? { href: `/dashboard/${listPath}/${encodeURIComponent(item.id)}` }
      : undefined
    return <CellComponent field={field} item={item} linkTo={linkTo} />
  } catch (error) {
    console.warn(`Failed to render cell for field ${field.path}:`, error)
    return null
  }
}

function shouldForceRowLink(field: DashboardField, isFirstField: boolean) {
  return (
    field.path === 'id' ||
    (isFirstField && (field.viewsIndex === 0 || field.viewsIndex === 1))
  )
}

function RelationshipLink({
  field,
  value,
}: {
  field: DashboardField
  value: unknown
}) {
  const id = relationshipId(value)
  const listKey = String(
    field.fieldMeta.refListPath ??
      String(field.fieldMeta.ref ?? '').split('.')[0],
  )
  if (!id || !listKey)
    return <span className="select-text">{relationshipLabel(value)}</span>
  return (
    <Link
      to="/dashboard/$listKey/$id"
      params={{ listKey, id }}
      className="rounded-[5px] bg-[var(--ks-track)] px-1.5 py-0.5 text-[var(--ks-ink-2)] shadow-[inset_0_0_0_1px_var(--ks-line)] hover:text-[var(--ks-ink)]"
    >
      {relationshipLabel(value)}
    </Link>
  )
}

function relationshipId(value: unknown) {
  if (value && typeof value === 'object')
    return String((value as { id?: unknown }).id ?? '')
  return typeof value === 'string' ? value : ''
}

function relationshipKey(value: unknown) {
  return relationshipId(value) || relationshipLabel(value)
}

function optionLabel(field: DashboardField, value: string) {
  return field.options?.find((option) => option.value === value)?.label ?? value
}

function valueToLabel(field: DashboardField, value: unknown) {
  if (value === null || value === undefined || value === '') return 'null'
  if (field.kind === 'select') return optionLabel(field, String(value))
  if (field.kind === 'relationship') return relationshipLabel(value)
  if (typeof value === 'object') return relationshipLabel(value)
  return String(value)
}

function relationshipLabel(value: unknown) {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.label ?? record.name ?? record.id ?? 'Related item')
  }
  return String(value)
}
