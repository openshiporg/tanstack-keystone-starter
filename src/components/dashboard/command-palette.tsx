/**
 * Command palette (⌘K / Ctrl+K): jump to a list, create in a list, open a record.
 * Record search reuses the list search the list page already runs (`buildWhere`:
 * id equals + initialSearchFields contains), one small query per visible list.
 */
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { useNavigate } from '@tanstack/react-router'
import {
  CornerDownLeft,
  Home,
  Monitor,
  Moon,
  Plus,
  Search,
  Sun,
} from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import { useTheme } from '@/components/ui/theme-provider'
import type { DashboardListSummary } from '@/features/cms/graphql-client'
import {
  buildWhere,
  executeDashboardGraphQL,
} from '@/features/cms/graphql-client'
import { cn } from '@/lib/utils'

type PaletteCtx = { open: () => void }
const CommandPaletteContext = createContext<PaletteCtx>({ open: () => {} })

export function useCommandPalette() {
  return useContext(CommandPaletteContext)
}

type RecordHit = {
  listKey: string
  listLabel: string
  path: string
  id: string
  label: string
}

type PaletteItem = {
  id: string
  group: string
  label: string
  hint?: string
  icon?: ReactNode
  run: () => void
}

function useRecordSearch(
  lists: DashboardListSummary[],
  query: string,
  enabled: boolean,
) {
  const [hits, setHits] = useState<RecordHit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const term = query.trim()
    if (!enabled || term.length < 2) {
      setHits([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(async () => {
      const results = await Promise.all(
        lists.map(async (list) => {
          const labelField = list.labelField || 'id'
          const names = list.graphql.names
          try {
            const data = await executeDashboardGraphQL<
              Record<string, Array<Record<string, unknown>>>
            >(
              `query PaletteSearch($where: ${names.whereInputName}!) { items: ${names.listQueryName}(where: $where, take: 4) { id ${labelField === 'id' ? '' : labelField} } }`,
              { where: buildWhere(list, term) },
            )
            return (data.items ?? []).map((item) => ({
              listKey: list.key,
              listLabel: list.singular || list.label,
              path: list.path,
              id: String(item.id),
              label: String(item[labelField] ?? item.id),
            }))
          } catch {
            return []
          }
        }),
      )
      if (!cancelled) {
        setHits(results.flat())
        setLoading(false)
      }
    }, 180)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [lists, query, enabled])

  return { hits, loading }
}

function matches(label: string, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return label.toLowerCase().includes(q)
}

export function CommandPaletteProvider({
  children,
  lists: allLists,
}: {
  children: ReactNode
  lists: DashboardListSummary[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const listRef = useRef<HTMLDivElement>(null)

  const lists = useMemo(
    () => allLists.filter((list) => !list.isSingleton),
    [allLists],
  )
  const { hits, loading } = useRecordSearch(lists, query, isOpen)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!isOpen) setQuery('')
  }, [isOpen])

  const go = useCallback(
    (href: string) => {
      setIsOpen(false)
      void navigate({ to: href })
    },
    [navigate],
  )

  const items = useMemo(() => {
    const out: PaletteItem[] = hits.map((hit) => ({
      id: `record:${hit.listKey}:${hit.id}`,
      group: 'Records',
      label: hit.label,
      hint: hit.listLabel,
      run: () => go(`/dashboard/${hit.path}/${hit.id}`),
    }))
    const goTo: PaletteItem[] = [
      {
        id: 'go:overview',
        group: 'Go to',
        label: 'Overview',
        icon: <Home />,
        run: () => go('/dashboard'),
      },
      ...lists.map((list) => ({
        id: `go:${list.key}`,
        group: 'Go to',
        label: list.label,
        run: () => go(`/dashboard/${list.path}`),
      })),
    ]
    const create: PaletteItem[] = lists
      .filter((list) => !list.hideCreate)
      .map((list) => ({
        id: `new:${list.key}`,
        group: 'Create',
        label: `New ${list.singular}`,
        icon: <Plus />,
        run: () => go(`/dashboard/${list.path}/create`),
      }))
    const theme: PaletteItem[] = (
      [
        ['light', 'Light', <Sun key="s" />],
        ['dark', 'Dark', <Moon key="m" />],
        ['system', 'System', <Monitor key="o" />],
      ] as const
    ).map(([value, label, icon]) => ({
      id: `theme:${value}`,
      group: 'Theme',
      label,
      icon,
      run: () => {
        setTheme(value)
        setIsOpen(false)
      },
    }))
    return [
      ...out,
      ...[...goTo, ...create, ...theme].filter((item) =>
        matches(`${item.group} ${item.label}`, query),
      ),
    ]
  }, [go, hits, lists, query, setTheme])

  useEffect(() => setActive(0), [query, hits.length])

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${active}"]`,
    )
    node?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => Math.min(items.length - 1, i + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      items[active]?.run()
    }
  }

  const ctx = useMemo(() => ({ open: () => setIsOpen(true) }), [])

  let lastGroup = ''

  return (
    <CommandPaletteContext.Provider value={ctx}>
      {children}
      <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-[2px]" />
          <DialogPrimitive.Popup className="ks-pop fixed top-[12vh] left-1/2 z-50 flex w-[min(640px,calc(100%-1.5rem))] -translate-x-1/2 flex-col overflow-hidden p-0 text-[13px] outline-none">
            <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
            <div className="flex h-12 items-center gap-2 border-b border-[var(--ks-line)] px-3">
              <Search className="size-4 shrink-0 text-[var(--ks-label)]" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKey}
                placeholder="Search"
                role="combobox"
                aria-expanded="true"
                aria-controls="command-palette-list"
                aria-activedescendant={
                  items[active] ? `cp-${items[active].id}` : undefined
                }
                className="h-full flex-1 bg-transparent text-[14px] text-[var(--ks-ink)] outline-none placeholder:text-[var(--ks-label)]"
              />
            </div>
            <div
              id="command-palette-list"
              ref={listRef}
              role="listbox"
              className="max-h-[min(60vh,420px)] overflow-y-auto p-1 pb-1"
            >
              {items.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-[var(--ks-dim)]">
                  {loading ? 'Searching' : 'No results'}
                </div>
              ) : null}
              {items.map((item, index) => {
                const heading = item.group !== lastGroup ? item.group : null
                lastGroup = item.group
                return (
                  <div key={item.id}>
                    {heading ? (
                      <div className="ks-label px-2 pt-2.5 pb-1">{heading}</div>
                    ) : null}
                    <div
                      id={`cp-${item.id}`}
                      role="option"
                      aria-selected={index === active}
                      data-index={index}
                      onMouseMove={() => setActive(index)}
                      onClick={item.run}
                      className={cn(
                        'flex h-8 cursor-default items-center gap-2 rounded-[7px] px-2 text-[var(--ks-ink-2)] select-none [&_svg]:size-3.5 [&_svg]:text-[var(--ks-label)]',
                        index === active &&
                          'bg-[var(--ks-hover)] text-[var(--ks-ink)]',
                      )}
                    >
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                      {item.hint ? (
                        <span className="ml-auto shrink-0 text-[12px] text-[var(--ks-label)]">
                          {item.hint}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-3 border-t border-[var(--ks-line)] px-3 py-2 text-[12px] text-[var(--ks-label)] max-md:hidden">
              <span className="inline-flex items-center gap-1.5">
                <span className="ks-kbd">↑↓</span>Move
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="ks-kbd">
                  <CornerDownLeft className="size-3" />
                </span>
                Open
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="ks-kbd">esc</span>Close
              </span>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </CommandPaletteContext.Provider>
  )
}

