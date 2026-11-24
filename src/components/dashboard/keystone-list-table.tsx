import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
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

export function KeystoneListTable({
  data,
  isFiltered = false,
}: {
  data: DashboardListPageData
  isFiltered?: boolean
}) {
  const navigate = useNavigate({ from: '/dashboard/$listKey' })
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [deleting, setDeleting] = useState(false)
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)
  const canBulkDelete = !data.list.hideDelete
  const emptyStateTitleId = `dashboard-${data.list.path}-empty-title`
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

  async function deleteSelectedItems() {
    if (!canBulkDelete) return
    const ids = Array.from(selectedItemsState.selectedItems)
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
        await queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === dashboardQueryKeys.adminMeta[0] &&
            query.queryKey[1] === 'listPage' &&
            query.queryKey[2] === data.list.path,
        })
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

  if (data.items.length === 0) {
    if (isFiltered) {
      return (
        <section
          className="flex flex-col items-center justify-center rounded-lg border bg-muted/40 p-8 text-center"
          role="status"
          aria-live="polite"
          aria-labelledby={emptyStateTitleId}
        >
          <h2 id={emptyStateTitleId} className="mb-2 text-lg font-semibold">
            No Results Found
          </h2>
          <p className="text-muted-foreground">
            Try adjusting your search filters.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              void navigate({
                to: '/dashboard/$listKey',
                params: { listKey: data.list.path },
              })
            }}
          >
            Reset Filters
          </Button>
        </section>
      )
    }
    return (
      <section
        className="flex flex-col items-center justify-center rounded-lg border bg-muted/40 p-8 text-center"
        role="status"
        aria-live="polite"
        aria-labelledby={emptyStateTitleId}
      >
        <h2 id={emptyStateTitleId} className="mb-2 text-lg font-semibold">
          No {data.list.label} Created
        </h2>
        <p className="text-muted-foreground">
          You can create a new {data.list.singular.toLowerCase()} to get
          started.
        </p>
        {!data.list.hideCreate && !data.list.isSingleton ? (
          <Link
            to="/dashboard/$listKey/create"
            params={{ listKey: data.list.path }}
            className={cn(buttonVariants({ size: 'sm' }), 'mt-4')}
          >
            Create {data.list.singular}
          </Link>
        ) : null}
      </section>
    )
  }

  return (
    <div className="relative">
      {bulkMessage ? (
        <div
          className="mx-4 mb-3 whitespace-pre-line rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive md:mx-6"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          {bulkMessage}
        </div>
      ) : null}
      <div className="relative mb-18 w-full border-y bg-background">
        <div
          className="relative overflow-auto"
          role="region"
          aria-label={`${data.list.label} table, scrollable`}
          tabIndex={0}
        >
          <table
            className="w-full min-w-full border-collapse"
            aria-busy={deleting}
          >
            <caption className="sr-only">{data.list.label}</caption>
            <thead className="sticky top-0 border-b bg-background">
              <tr>
                {canBulkDelete ? (
                  <th
                    scope="col"
                    className="w-[64px] bg-background pl-6 text-left font-normal"
                  >
                    <Checkbox
                      aria-label={`Select all ${data.list.label.toLowerCase()}`}
                      checked={
                        selectedItemsState.selectedItems.size ===
                        data.items.length
                      }
                      onCheckedChange={(checked) => {
                        const selectedItems = new Set<string>()
                        if (checked)
                          data.items.forEach((item) =>
                            selectedItems.add(item.id),
                          )
                        setSelectedItems({
                          itemsFromServer: selectedItemsState.itemsFromServer,
                          selectedItems,
                        })
                      }}
                    />
                  </th>
                ) : null}
                {data.selectedFields.map((field) => (
                  <TableHeaderField
                    key={field.path}
                    field={field}
                    sortBy={data.sortBy}
                  />
                ))}
                <th
                  scope="col"
                  className="whitespace-nowrap bg-background px-5 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((item) => (
                <tr
                  key={item.id}
                  aria-selected={
                    selectedItemsState.selectedItems.has(item.id) || undefined
                  }
                  className={cn(
                    'group hover:bg-muted',
                    selectedItemsState.selectedItems.has(item.id) && 'bg-muted',
                  )}
                  style={{ userSelect: 'text' }}
                >
                  {canBulkDelete ? (
                    <td className="relative w-[64px] py-3 pl-6">
                      {selectedItemsState.selectedItems.has(item.id) ? (
                        <div className="absolute inset-y-0 left-0 w-0.5 bg-blue-500 dark:bg-blue-500" />
                      ) : null}
                      <Checkbox
                        aria-label={`Select ${String(item[data.list.labelField] ?? item.id)}`}
                        checked={selectedItemsState.selectedItems.has(item.id)}
                        onCheckedChange={(checked) => {
                          const selectedItems = new Set(
                            selectedItemsState.selectedItems,
                          )
                          if (checked) selectedItems.add(item.id)
                          else selectedItems.delete(item.id)
                          setSelectedItems({
                            itemsFromServer: selectedItemsState.itemsFromServer,
                            selectedItems,
                          })
                        }}
                      />
                    </td>
                  ) : null}
                  {data.selectedFields.map((field, index) => (
                    <td
                      key={`${item.id}-${field.path}`}
                      className="whitespace-nowrap px-5 py-3 text-sm text-gray-600 select-text dark:text-gray-400"
                      style={{ userSelect: 'text' }}
                    >
                      <CellContent
                        listPath={data.list.path}
                        item={item}
                        field={field}
                        isFirstField={index === 0}
                      />
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-5 py-3 text-sm text-gray-600 dark:text-gray-400">
                    <Link
                      to="/dashboard/$listKey/$id"
                      params={{ listKey: data.list.path, id: item.id }}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        currentPage={data.page}
        total={data.count || 0}
        pageSize={data.pageSize}
        list={{ singular: data.list.singular, plural: data.list.plural }}
        selectedItems={
          canBulkDelete ? selectedItemsState.selectedItems : new Set<string>()
        }
        selectionActions={
          canBulkDelete ? (
            <ListPageActions
              data={data}
              selectedItems={selectedItemsState.selectedItems}
              selectedRows={data.items.filter((item) =>
                selectedItemsState.selectedItems.has(item.id),
              )}
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
                await queryClient.invalidateQueries({
                  predicate: (query) =>
                    Array.isArray(query.queryKey) &&
                    query.queryKey[0] === dashboardQueryKeys.adminMeta[0] &&
                    query.queryKey[1] === 'listPage' &&
                    query.queryKey[2] === data.list.path,
                })
                setBulkMessage(details ?? null)
                toast({ title, description })
              }}
            />
          ) : undefined
        }
        onResetSelection={
          canBulkDelete
            ? () =>
                setSelectedItems({
                  itemsFromServer: selectedItemsState.itemsFromServer,
                  selectedItems: new Set(),
                })
            : undefined
        }
        onDelete={canBulkDelete ? () => void deleteSelectedItems() : undefined}
        isDeleteLoading={deleting}
      />
    </div>
  )
}

function TableHeaderField({
  field,
  sortBy,
}: {
  field: DashboardField
  sortBy: string
}) {
  const navigate = useNavigate({ from: '/dashboard/$listKey' })
  const search = useSearch({ from: '/dashboard/$listKey' })
  const explicitSortBy =
    typeof search.sortBy === 'string' && search.sortBy ? search.sortBy : sortBy
  const descending = explicitSortBy.startsWith('-')
  const sortField = descending ? explicitSortBy.slice(1) : explicitSortBy
  const isActive = sortField === field.path
  const nextSort = isActive && !descending ? `-${field.path}` : field.path

  function updateSort() {
    if (!field.isOrderable) return
    void navigate({
      search: (previous) => ({ ...previous, sortBy: nextSort, page: 1 }),
    })
  }

  return (
    <th
      scope="col"
      aria-sort={isActive ? (descending ? 'descending' : 'ascending') : 'none'}
      className={cn(
        'whitespace-nowrap bg-background px-5 text-left text-sm font-medium',
        'text-gray-700 dark:text-gray-300',
      )}
    >
      <button
        aria-label={
          field.isOrderable
            ? `${field.label}, ${
                isActive
                  ? descending
                    ? 'sorted descending; activate to sort ascending'
                    : 'sorted ascending; activate to sort descending'
                  : 'not sorted; activate to sort ascending'
              }`
            : field.label
        }
        className={cn(
          'inline-flex items-center gap-2 rounded-md py-3',
          field.isOrderable
            ? 'hover:text-gray-900 dark:hover:text-gray-50'
            : 'cursor-default',
        )}
        type="button"
        disabled={!field.isOrderable}
        onClick={updateSort}
      >
        <span>{field.label}</span>
        {field.isOrderable ? (
          <div className="-space-y-2" aria-hidden="true">
            <ChevronUp
              className={cn(
                'size-3.5',
                isActive && !descending ? 'opacity-100' : 'opacity-30',
              )}
            />
            <ChevronDown
              className={cn(
                'size-3.5',
                isActive && descending ? 'opacity-100' : 'opacity-30',
              )}
            />
          </div>
        ) : null}
      </button>
    </th>
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
        className="font-medium text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
      >
        {valueToLabel(field, value)}
      </Link>
    )
  }

  if (value === null || value === undefined) {
    return (
      <div className="rounded-sm border border-dashed px-2 py-1 font-mono text-xs italic select-text">
        null
      </div>
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
      <span className="text-xs text-muted-foreground italic">Complex data</span>
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
      className="rounded bg-muted px-1.5 py-0.5 font-medium text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
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
