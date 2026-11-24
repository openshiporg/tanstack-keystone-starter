import { useNavigate } from '@tanstack/react-router'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PencilLine,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { DASHBOARD_PAGE_SIZES, normalizeDashboardPageSize } from './page-size'

const bar =
  'sticky bottom-0 z-20 flex h-12 items-center gap-2 border-t border-[var(--ks-line)] bg-[color-mix(in_oklab,var(--ks-surface)_90%,transparent)] px-3 backdrop-blur-md md:rounded-b-[12px] md:px-6'

/**
 * List footer. Sticky at the bottom of the page: range + pager + page size.
 * With rows selected it becomes the bulk-action bar (count, actions, edit, delete, clear).
 */
export function Pagination({
  currentPage = 1,
  total = 0,
  pageSize = 10,
  list = { singular: 'item', plural: 'items' },
  selectedItems = new Set<string>(),
  selectionActions,
  onResetSelection,
  onDelete,
  onEdit,
  isDeleteLoading = false,
}: {
  currentPage?: number
  total?: number
  pageSize?: number
  list?: { singular: string; plural: string }
  selectedItems?: Set<string>
  selectionActions?: React.ReactNode
  onResetSelection?: () => void
  onDelete?: () => void
  onEdit?: () => void
  isDeleteLoading?: boolean
}) {
  const [currentPageInput, setCurrentPageInput] = useState(
    currentPage.toString(),
  )
  const [customSize, setCustomSize] = useState('')
  const navigate = useNavigate({ from: '/dashboard/$listKey' })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    setCurrentPageInput(currentPage.toString())
  }, [currentPage])

  function handlePageChange(newPage: number) {
    const page = Math.max(1, Math.min(totalPages, Number(newPage) || 1))
    setCurrentPageInput(page.toString())
    if (page === currentPage) return
    void navigate({ search: (previous) => ({ ...previous, page }) })
  }

  function handlePageSizeChange(newSize: number) {
    const size = normalizeDashboardPageSize(newSize, pageSize)
    void navigate({
      search: (previous) => ({ ...previous, pageSize: size, page: 1 }),
    })
  }

  const start = total === 0 ? 0 : pageSize * (currentPage - 1) + 1
  const end = Math.min(pageSize * currentPage, total)
  const noun = (n: number) => (n === 1 ? list.singular : list.plural)

  if (selectedItems.size > 0 && (onDelete || onEdit || selectionActions)) {
    const n = selectedItems.size
    return (
      <div
        className={bar}
        role="toolbar"
        aria-label={`${list.plural} selection actions`}
      >
        <span className="flex min-w-0 items-center gap-2 text-[13px]">
          <span className="grid h-5 min-w-5 place-items-center rounded-[6px] bg-[var(--ks-accent)] px-1 font-mono text-[12px] font-medium text-white">
            {n}
          </span>
          <span className="truncate text-[var(--ks-ink-2)]">selected</span>
        </span>
        <div className="ks-track ml-auto">
          {selectionActions}
          {onEdit ? (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <PencilLine />
              Edit
            </Button>
          ) : null}
          {onDelete ? (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    data-variant="danger"
                    disabled={isDeleteLoading}
                  />
                }
              >
                <Trash2 />
                {isDeleteLoading ? 'Deleting' : 'Delete'}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete {n} {noun(n).toLowerCase()}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    data-variant="danger-fill"
                    onClick={() => onDelete?.()}
                    disabled={isDeleteLoading}
                  >
                    Delete {n}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Clear selection"
            title="Clear (Esc)"
            onClick={onResetSelection}
          >
            <X />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <nav className={bar} aria-label={`${list.plural} pagination`}>
      <span
        className="min-w-0 truncate text-[12px] text-[var(--ks-dim)]"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="font-mono text-[var(--ks-ink-2)]">
          {total > pageSize ? `${start}–${end}` : total}
        </span>
        {total > pageSize ? (
          <>
            {' of '}
            <span className="font-mono text-[var(--ks-ink-2)]">{total}</span>
          </>
        ) : null}{' '}
        <span className="max-sm:hidden">{noun(total).toLowerCase()}</span>
      </span>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Change rows per page, currently ${pageSize}`}
            render={
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 px-2 text-[12px]"
              />
            }
          >
            <span className="font-mono text-[var(--ks-ink-2)]">{pageSize}</span>
            <span className="max-sm:hidden">per page</span>
            <ChevronDown className="!size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Page size</DropdownMenuLabel>
              {DASHBOARD_PAGE_SIZES.map((size) => (
                <DropdownMenuItem
                  key={size}
                  onClick={() => handlePageSizeChange(size)}
                  className="justify-between"
                >
                  <span className="font-mono">{size}</span>
                  {size === pageSize ? (
                    <Check className="size-3.5 text-[var(--ks-accent)]" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <form
              className="p-1"
              onSubmit={(event) => {
                event.preventDefault()
                if (customSize) handlePageSizeChange(Number(customSize))
              }}
            >
              <input
                inputMode="numeric"
                aria-label="Custom page size"
                placeholder="Custom"
                value={customSize}
                onKeyDown={(event) => event.stopPropagation()}
                onChange={(event) =>
                  /^\d*$/.test(event.target.value) &&
                  setCustomSize(event.target.value)
                }
                className="ks-field h-7 w-full px-2 font-mono text-[12px]"
              />
            </form>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ks-track">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft />
          </Button>
          <label className="flex h-7 items-center gap-1 px-1.5 font-mono text-[12px] text-[var(--ks-dim)]">
            <span className="sr-only">Page number</span>
            <input
              className="w-6 bg-transparent text-center text-[var(--ks-ink)] outline-none"
              inputMode="numeric"
              value={currentPageInput}
              onChange={(event) =>
                /^\d*$/.test(event.target.value) &&
                setCurrentPageInput(event.target.value)
              }
              onBlur={() =>
                currentPageInput === ''
                  ? setCurrentPageInput(currentPage.toString())
                  : handlePageChange(Number(currentPageInput))
              }
              onKeyDown={(event) =>
                event.key === 'Enter' &&
                handlePageChange(Number(currentPageInput))
              }
            />
            <span>/</span>
            <span>{totalPages}</span>
          </label>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </nav>
  )
}
