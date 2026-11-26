import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Columns3,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  defaultListSearchState,
  isAtDefaultListState,
} from './list-state-defaults'
import {
  formatOfficialFilterParam,
  officialFilterParamsFromSearch,
  parseOfficialFilterParam,
} from './filter-param-compat'
import { normalizeListSearchForUrl } from './list-search-url'
import {
  hasExplicitListSearchStateInUrl,
  listStateStorageKey,
  mergeStoredListSearchState,
  pickPersistedListSearchState,
  stripPersistedListSearchState,
} from './list-state-persistence'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { enhanceFields } from './enhance-fields'
import type { EnhancedDashboardField } from './enhance-fields'
import type { DashboardList } from '@/features/cms/graphql-client'

type FilterType =
  | 'contains'
  | 'not_contains'
  | 'equals'
  | 'is'
  | 'matches'
  | 'not_matches'
  | 'not'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'in'
  | 'not_in'
  | 'empty'
  | 'is_empty'
  | 'not_empty'

export function filterBarSearchPlaceholder(searchLabels: string[]) {
  return `Search by ${searchLabels.length ? searchLabels.join(', ').toLowerCase() : 'id'}`
}

function filterKey(fieldPath: string, type: string) {
  return `!${fieldPath}_${type}`
}

export function FilterBar({
  list,
  selectedFields,
}: {
  list: DashboardList
  selectedFields?: Set<string>
}) {
  const navigate = useNavigate({ from: '/dashboard/$listKey/' })
  const searchParams = useSearch({ from: '/dashboard/$listKey/' })
  const [searchString, setSearchString] = useState(searchParams.search || '')
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [filterField, setFilterField] = useState('')
  const [filterType, setFilterType] = useState<FilterType>('contains')
  const [filterValue, setFilterValue] = useState<unknown>('')

  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSearchString(searchParams.search || '')
  }, [searchParams.search])

  // "/" focuses search, like Linear and GitHub
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (
        event.key !== '/' ||
        event.metaKey ||
        event.ctrlKey ||
        target.closest('input,textarea,[contenteditable=true]')
      )
        return
      event.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const searchableFields = useMemo(
    () => list.fields.filter((field) => field.isFilterable),
    [list.fields],
  )
  const searchLabels = searchableFields.map((field) => field.label)
  const enhancedFields = useMemo(
    () => enhanceFields(list.fields, list.key),
    [list.fields, list.key],
  )
  const storageKey = useMemo(() => listStateStorageKey(list.path), [list.path])
  const filterableFields = useMemo(
    () =>
      Object.values(enhancedFields).filter(
        (field) => field.isFilterable && field.controller.filter,
      ),
    [enhancedFields],
  )
  const hasFilterableFields = filterableFields.length > 0
  const activeFilterField =
    filterableFields.find((field) => field.path === filterField) ??
    filterableFields.at(0)
  const activeFilterTypes = activeFilterField?.controller.filter
    ? Object.entries(activeFilterField.controller.filter.types).map(
        ([type, meta]) => ({ type, ...meta }),
      )
    : []
  const activeFilterType =
    activeFilterTypes.find((entry) => entry.type === filterType) ??
    activeFilterTypes.at(0)
  const ActiveFilterInput = activeFilterField?.controller.filter?.Filter

  const possibleFilters = useMemo(() => {
    const filters = new Map<
      string,
      {
        fieldPath: string
        filterType: string
        field: EnhancedDashboardField
        filterController: NonNullable<
          EnhancedDashboardField['controller']['filter']
        >
      }
    >()
    for (const field of filterableFields) {
      const filterController = field.controller.filter
      if (!filterController) continue
      for (const filterTypeName of Object.keys(filterController.types))
        filters.set(filterKey(field.path, filterTypeName), {
          fieldPath: field.path,
          filterType: filterTypeName,
          field,
          filterController,
        })
    }
    return filters
  }, [filterableFields])
  const activeFilters = useMemo(() => {
    const entries: Array<{
      key: string
      value: unknown
      fieldPath: string
      filterType: string
      field: EnhancedDashboardField
      filterController: NonNullable<
        EnhancedDashboardField['controller']['filter']
      >
    }> = []
    const seen = new Set<string>()

    for (const [key, value] of Object.entries(searchParams)) {
      const filter = possibleFilters.get(key)
      if (!filter) continue
      entries.push({ key, value, ...filter })
      seen.add(`${filter.fieldPath}:${filter.filterType}`)
    }

    for (const rawFilter of officialFilterParamsFromSearch(searchParams)) {
      for (const field of filterableFields) {
        const filterController = field.controller.filter
        if (!filterController) continue
        const parsed = parseOfficialFilterParam(
          rawFilter,
          Object.keys(filterController.types),
        )
        if (!parsed || parsed.fieldPath !== field.path) continue
        const dedupeKey = `${field.path}:${parsed.filterType}`
        if (seen.has(dedupeKey)) break
        let parsedValue: unknown = parsed.rawValue
        if (typeof parsedValue === 'string') {
          try {
            parsedValue = JSON.parse(parsedValue)
          } catch {}
        }
        entries.push({
          key: `filter:${rawFilter}`,
          value: parsedValue,
          fieldPath: field.path,
          filterType: parsed.filterType,
          field,
          filterController,
        })
        seen.add(dedupeKey)
        break
      }
    }

    return entries
  }, [filterableFields, possibleFilters, searchParams])
  const activeSortBy =
    typeof searchParams.sortBy === 'string' && searchParams.sortBy.length > 0
      ? searchParams.sortBy
      : ''
  const showResetControls = useMemo(
    () => !isAtDefaultListState(list, searchParams),
    [list, searchParams],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (hasExplicitListSearchStateInUrl(window.location.search)) return
    const storedRaw = window.localStorage.getItem(storageKey)
    if (!storedRaw) return

    try {
      const stored = JSON.parse(storedRaw) as Record<string, unknown>
      const nextSearch = mergeStoredListSearchState(
        stripPersistedListSearchState(searchParams),
        stored,
      )
      if (Object.keys(nextSearch).length === 0) return
      void navigate({ search: () => nextSearch, replace: true })
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }, [navigate, searchParams, storageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const persistedState = pickPersistedListSearchState(searchParams)
    if (Object.keys(persistedState).length === 0) {
      window.localStorage.removeItem(storageKey)
      return
    }
    window.localStorage.setItem(storageKey, JSON.stringify(persistedState))
  }, [searchParams, storageKey])

  function updateSearch(value: string) {
    void navigate({
      search: (previous) =>
        normalizeListSearchForUrl(
          { ...previous, search: value.trim() || undefined, page: 1 },
          { defaultPageSize: list.pageSize },
        ),
    })
  }

  function updateSort(sortBy: string) {
    void navigate({
      search: (previous) =>
        normalizeListSearchForUrl(
          { ...previous, sortBy: sortBy || undefined, page: 1 },
          { defaultPageSize: list.pageSize },
        ),
    })
  }

  function updateFields(next: Set<string>) {
    const normalized = Array.from(next)
    void navigate({
      search: (previous) =>
        normalizeListSearchForUrl(
          {
            ...previous,
            fields: normalized.length ? normalized.join(',') : undefined,
            column: normalized.length ? normalized : undefined,
            page: 1,
          },
          { defaultPageSize: list.pageSize },
        ),
    })
  }

  function removeSiblingFieldFilters(
    previous: Record<string, unknown>,
    fieldPath: string,
  ) {
    const next: Record<string, unknown> = { ...previous }
    for (const key of Object.keys(next)) {
      if (key.startsWith(`!${fieldPath}_`)) next[key] = undefined
    }
    return next
  }

  function addFilter() {
    if (!activeFilterField || !activeFilterType) return
    const value =
      activeFilterType.needsValue === false
        ? activeFilterType.initialValue
        : filterValue
    const officialFilter = formatOfficialFilterParam(
      activeFilterField.path,
      activeFilterType.type,
      value,
      activeFilterType.needsValue !== false,
    )
    void navigate({
      search: (previous) => {
        const existingOfficialFilters = Array.isArray(previous.filter)
          ? previous.filter.map(String)
          : typeof previous.filter === 'string'
            ? [previous.filter]
            : []
        const nextOfficialFilters = existingOfficialFilters.filter(
          (entry) => !entry.startsWith(`${activeFilterField.path}_`),
        )
        nextOfficialFilters.push(officialFilter)
        return normalizeListSearchForUrl(
          {
            ...previous,
            [filterKey(activeFilterField.path, activeFilterType.type)]:
              JSON.stringify(value),
            filter: nextOfficialFilters,
            page: 1,
          },
          { defaultPageSize: list.pageSize },
        )
      },
    })
    setFilterValue('')
    setFilterPopoverOpen(false)
  }

  function removeFilter(fieldPath: string) {
    void navigate({
      search: (previous) => {
        const next = removeSiblingFieldFilters(previous, fieldPath)
        next.page = 1
        const existingOfficialFilters = Array.isArray(previous.filter)
          ? previous.filter.map(String)
          : typeof previous.filter === 'string'
            ? [previous.filter]
            : []
        next.filter = existingOfficialFilters.filter(
          (entry) => !entry.startsWith(`${fieldPath}_`),
        )
        if (Array.isArray(next.filter) && next.filter.length === 0)
          next.filter = undefined
        return normalizeListSearchForUrl(next, {
          defaultPageSize: list.pageSize,
        })
      },
    })
  }

  function updateFilter(
    key: string,
    value: unknown,
    fieldPath: string,
    filterTypeName: string,
  ) {
    void navigate({
      search: (previous) => {
        const next = removeSiblingFieldFilters(previous, fieldPath)
        next[key] = JSON.stringify(value)
        const existingOfficialFilters = Array.isArray(previous.filter)
          ? previous.filter.map(String)
          : typeof previous.filter === 'string'
            ? [previous.filter]
            : []
        const nextOfficialFilters = existingOfficialFilters.filter(
          (entry) => !entry.startsWith(`${fieldPath}_`),
        )
        const needsValue = filterControllerNeedsValue(
          filterableFields,
          fieldPath,
          filterTypeName,
        )
        nextOfficialFilters.push(
          formatOfficialFilterParam(
            fieldPath,
            filterTypeName,
            value,
            needsValue,
          ),
        )
        next.filter = nextOfficialFilters
        next.page = 1
        return normalizeListSearchForUrl(next, {
          defaultPageSize: list.pageSize,
        })
      },
    })
  }

  function resetToDefaults() {
    if (typeof window !== 'undefined')
      window.localStorage.removeItem(storageKey)
    void navigate({
      search: () =>
        normalizeListSearchForUrl(defaultListSearchState(list), {
          defaultPageSize: list.pageSize,
        }),
    })
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <form
          role="search"
          aria-label={`Search ${list.label}`}
          className="ks-field relative flex h-8 min-w-0 flex-1 items-center md:max-w-[420px]"
          onSubmit={(event) => {
            event.preventDefault()
            updateSearch(searchString)
          }}
        >
          <Search
            className="pointer-events-none absolute left-2.5 size-3.5 text-[var(--ks-label)]"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="search"
            className="h-full w-full min-w-0 bg-transparent pr-8 pl-8 text-[13px] text-[var(--ks-ink)] outline-none placeholder:text-[var(--ks-label)] [&::-webkit-search-cancel-button]:hidden"
            value={searchString}
            onChange={(event) => setSearchString(event.target.value)}
            onBlur={() => {
              if ((searchParams.search || '') !== searchString.trim())
                updateSearch(searchString)
            }}
            aria-label={`Search ${list.label}`}
            placeholder={filterBarSearchPlaceholder(searchLabels)}
          />
          {searchString ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setSearchString('')
                updateSearch('')
              }}
              className="absolute right-1.5 grid size-5 place-items-center rounded-[5px] text-[var(--ks-label)] hover:text-[var(--ks-ink)]"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <span className="ks-kbd pointer-events-none absolute right-1.5 h-5 max-md:hidden">
              /
            </span>
          )}
        </form>

        <div className="ks-track ml-auto shrink-0">
          <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <PopoverTrigger
              aria-label={`Add filter to ${list.label}`}
              disabled={!hasFilterableFields}
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="max-sm:w-7 max-sm:px-0"
                />
              }
            >
              <SlidersHorizontal aria-hidden="true" />
              <span className="max-sm:hidden">Filter</span>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" sideOffset={8}>
              <div className="border-b border-[var(--ks-line)] px-4 py-3">
                <div className="text-[13px] font-medium text-[var(--ks-ink)]">Add filter</div>
                <div className="mt-1 text-[12px] text-[var(--ks-dim)]">
                  Choose a field, condition, and value to filter this list.
                </div>
              </div>
              {activeFilterField && activeFilterType ? (
                <div className="grid gap-3 p-4">
                  <label className="grid gap-1.5 text-[13px]">
                    <span className="font-medium text-[var(--ks-ink-2)]">Field</span>
                    <select
                      className="ks-field h-8 px-2 text-[13px]"
                      value={activeFilterField.path}
                      onChange={(event) => {
                        const nextField = filterableFields.find(
                          (field) => field.path === event.target.value,
                        )
                        const nextFilterType = nextField?.controller.filter
                          ? Object.entries(
                              nextField.controller.filter.types,
                            ).at(0)
                          : undefined
                        if (!nextField || !nextFilterType) return
                        setFilterField(event.target.value)
                        setFilterType(nextFilterType[0] as FilterType)
                        setFilterValue(nextFilterType[1].initialValue ?? '')
                      }}
                    >
                      {filterableFields.map((field) => (
                        <option key={field.path} value={field.path}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-[13px]">
                    <span className="font-medium text-[var(--ks-ink-2)]">Condition</span>
                    <select
                      className="ks-field h-8 px-2 text-[13px]"
                      value={activeFilterType.type}
                      onChange={(event) => {
                        const nextType =
                          activeFilterField.controller.filter?.types[
                            event.target.value
                          ]
                        setFilterType(event.target.value as FilterType)
                        setFilterValue(nextType?.initialValue ?? '')
                      }}
                    >
                      {activeFilterTypes.map((option) => (
                        <option key={option.type} value={option.type}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {activeFilterType.needsValue === false ? null : (
                    <label className="grid gap-1.5 text-[13px]">
                      <span className="font-medium text-[var(--ks-ink-2)]">Value</span>
                      {ActiveFilterInput ? (
                        <ActiveFilterInput
                          value={filterValue}
                          onChange={setFilterValue}
                          type={activeFilterType.type}
                          field={activeFilterField}
                          context="add"
                        />
                      ) : (
                        <Input
                          value={String(filterValue)}
                          onChange={(event) =>
                            setFilterValue(event.target.value)
                          }
                          placeholder="Filter value"
                        />
                      )}
                    </label>
                  )}
                </div>
              ) : (
                <div className="p-4 text-[13px] text-[var(--ks-dim)]">
                  No filters available for this list.
                </div>
              )}
              <div className="flex justify-end border-t border-[var(--ks-line)] px-4 py-3">
                <div className="ks-track">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFilterPopoverOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!activeFilterField || !activeFilterType}
                  onClick={addFilter}
                >
                  Apply filter
                </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <SortSelection
            list={list}
            sortBy={activeSortBy}
            onSortChange={updateSort}
          />
          <FieldSelection
            list={list}
            selectedFields={selectedFields}
            onFieldsChange={updateFields}
          />
          {showResetControls ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
            >
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      {activeFilters.length ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <Filter
              className="size-3.5 text-[var(--ks-label)]"
              aria-hidden="true"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeFilters.map(
              ({
                key,
                value,
                field,
                filterType: activeFilterTypeName,
                filterController,
              }) => (
                <FilterPill
                  key={key}
                  field={field}
                  filterType={activeFilterTypeName}
                  filterController={filterController}
                  value={value}
                  onRemove={() => removeFilter(field.path)}
                  onSave={(nextValue) =>
                    updateFilter(
                      key,
                      nextValue,
                      field.path,
                      activeFilterTypeName,
                    )
                  }
                />
              ),
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function filterControllerNeedsValue(
  fields: EnhancedDashboardField[],
  fieldPath: string,
  filterTypeName: string,
) {
  const field = fields.find((entry) => entry.path === fieldPath)
  const meta = field?.controller.filter?.types[filterTypeName]
  return meta?.needsValue !== false
}

function SortSelection({
  list,
  sortBy,
  onSortChange,
}: {
  list: DashboardList
  sortBy: string
  onSortChange: (sortBy: string) => void
}) {
  const orderableFields = list.fields.filter(
    (field) => field.isOrderable && field.listView.fieldMode !== 'hidden',
  )
  const activeFieldPath = sortBy.startsWith('-') ? sortBy.slice(1) : sortBy
  const activeField = orderableFields.find(
    (field) => field.path === activeFieldPath,
  )
  const direction = sortBy.startsWith('-') ? 'DESC' : 'ASC'

  function handleSortChange(fieldPath: string) {
    if (sortBy === fieldPath) onSortChange(`-${fieldPath}`)
    else if (sortBy === `-${fieldPath}`) onSortChange(fieldPath)
    else onSortChange(fieldPath)
  }

  if (!sortBy || !activeField) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Sort"
          render={
            <Button
              variant="outline"
              size="sm"
              className="max-sm:w-7 max-sm:px-0"
            />
          }
        >
          <ArrowUpDown aria-hidden="true" />
          <span className="max-sm:hidden">Sort</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px]">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="py-1.5">Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-72 overflow-y-auto">
              {orderableFields.map((field) => (
                <DropdownMenuItem
                  key={field.path}
                  onSelect={() => handleSortChange(field.path)}
                >
                  <span className="flex w-full items-center justify-between">
                    {field.label}
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Sorted by ${activeField.label}`}
          render={
            <Button
              variant="outline"
              size="sm"
              className="max-sm:w-7 max-sm:px-0"
            />
          }
        >
          <ArrowUpDown
            className="!text-[var(--ks-accent)]"
            aria-hidden="true"
          />
          <span className="max-w-28 truncate max-sm:hidden">
            {activeField.label}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px]">
          <DropdownMenuGroup>
            <div className="flex items-center justify-between py-1.5">
              <DropdownMenuLabel className="py-0">Sort by</DropdownMenuLabel>
              <Badge
                variant="destructive"
                render={
                  <button
                    type="button"
                    aria-label={`Clear ${activeField.label} sort`}
                  />
                }
                onClick={() => onSortChange('')}
                className="mr-2 cursor-pointer"
              >
                Clear
              </Badge>
            </div>
            <DropdownMenuSeparator />
            <div className="max-h-72 overflow-y-auto">
              {orderableFields.map((field) => (
                <DropdownMenuItem
                  key={field.path}
                  onSelect={() => handleSortChange(field.path)}
                >
                  <span className="flex w-full items-center justify-between">
                    {field.label}
                    {field.path === activeFieldPath ? (
                      <Badge className="font-mono">
                        {direction}
                      </Badge>
                    ) : null}
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="outline"
        aria-label={`Sort ${activeField.label} ${
          direction === 'ASC' ? 'descending' : 'ascending'
        }`}
        size="sm"
        className="px-2 font-mono text-[12px]"
        onClick={() => handleSortChange(activeFieldPath)}
      >
        {direction === 'ASC' ? (
          <ArrowUp aria-hidden="true" />
        ) : (
          <ArrowDown aria-hidden="true" />
        )}
        {direction}
      </Button>
    </>
  )
}

function FieldSelection({
  list,
  selectedFields,
  onFieldsChange,
}: {
  list: DashboardList
  selectedFields?: Set<string>
  onFieldsChange: (fields: Set<string>) => void
}) {
  const selectedFieldsForUI = new Set(
    Array.from(selectedFields ?? []).filter((fieldPath) => fieldPath !== 'id'),
  )
  const visibleFieldPaths = list.fields
    .filter(
      (field) => field.path !== 'id' && field.listView.fieldMode !== 'hidden',
    )
    .map((field) => field.path)
  const defaultColumnPaths =
    list.initialColumns.length > 0
      ? list.initialColumns
      : visibleFieldPaths.slice(0, 1)

  function setNewSelectedFields(fields: Set<string>) {
    const withId = new Set(['id', ...fields])
    const orderedWithoutId = Array.from(fields)
    const isInitial =
      orderedWithoutId.length === defaultColumnPaths.length &&
      orderedWithoutId.every(
        (fieldPath, index) => fieldPath === defaultColumnPaths[index],
      )
    onFieldsChange(isInitial ? new Set() : withId)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Columns"
        render={
          <Button
            variant="outline"
            size="sm"
            className="max-sm:w-7 max-sm:px-0"
          />
        }
      >
        <Columns3 aria-hidden="true" />
        <span className="max-sm:hidden">Columns</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Display columns</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="max-h-72 overflow-y-auto">
            {list.fields
              .filter(
                (field) =>
                  field.path !== 'id' && field.listView.fieldMode !== 'hidden',
              )
              .map((field) => {
                const checked = selectedFieldsForUI.has(field.path)
                const isDisabled = selectedFieldsForUI.size === 1 && checked
                return (
                  <DropdownMenuCheckboxItem
                    key={field.path}
                    checked={checked}
                    disabled={isDisabled}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(nextChecked) => {
                      const next = new Set(selectedFieldsForUI)
                      if (nextChecked) next.add(field.path)
                      else next.delete(field.path)
                      setNewSelectedFields(next)
                    }}
                  >
                    {field.label}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FilterPill({
  field,
  filterType,
  filterController,
  value,
  onRemove,
  onSave,
}: {
  field: EnhancedDashboardField
  filterType: string
  filterController: NonNullable<EnhancedDashboardField['controller']['filter']>
  value: unknown
  onRemove: () => void
  onSave: (nextValue: unknown) => void
}) {
  const [open, setOpen] = useState(false)
  const [draftValue, setDraftValue] = useState(formatEditableFilterValue(value))
  const filterOption = filterController.types[filterType]
  const FilterInput = filterController.Filter
  const filterTypeLabel = filterOption.label
  const fieldLabel = field.label
  const filterLabel = filterController.Label({
    label: filterTypeLabel,
    type: filterType,
    value,
  })

  useEffect(() => {
    if (open) setDraftValue(formatEditableFilterValue(value))
  }, [open, value])

  function save() {
    onSave(
      filterOption.needsValue === false
        ? filterOption.initialValue
        : draftValue,
    )
    setOpen(false)
  }

  return (
    <div className="ks-track">
      <Button
        variant="outline"
        size="icon-sm"
        data-variant="danger"
        aria-label={`Remove ${fieldLabel} filter`}
        onClick={onRemove}
      >
        <X size={16} aria-hidden="true" />
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="flex h-7 max-w-64 items-center justify-start gap-1.5 rounded-[7px] px-2 text-[12px] outline-none hover:text-[var(--ks-ink)] focus-visible:ring-2 focus-visible:ring-[var(--ks-focus)]">
          <span className="truncate text-[var(--ks-dim)]">{fieldLabel}</span>
          <span className="truncate font-medium text-[var(--ks-ink)]">
            {filterLabel}
          </span>
          <ChevronDown
            className="size-3 text-[var(--ks-label)]"
            aria-hidden="true"
          />
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" sideOffset={6}>
          <div className="space-y-3">
            <div>
              <div className="text-[13px] font-medium text-[var(--ks-ink)]">
                {fieldLabel}
              </div>
              <div className="text-[12px] text-[var(--ks-dim)]">
                {filterLabel}
              </div>
            </div>
            {filterOption.needsValue === false ? null : (
              <FilterInput
                value={draftValue}
                onChange={setDraftValue}
                type={filterType}
                field={field}
                context="edit"
                autoFocus
              />
            )}
            <div className="flex justify-end">
              <div className="ks-track">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={save}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function formatEditableFilterValue(value: unknown) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (parsed === true || parsed === null || parsed === undefined) return ''
    return parsed
  } catch {
    return String(value ?? '')
  }
}
