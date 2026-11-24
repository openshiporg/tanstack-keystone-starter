import { useNavigate } from '@tanstack/react-router'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
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
import { Input } from '@/components/ui/input'
import {
  DASHBOARD_PAGE_SIZES,
  normalizeDashboardPageSize,
  snapPageSizeToClosest,
} from './page-size'

export function Pagination({
  currentPage = 1,
  total = 0,
  pageSize = 10,
  list = { singular: 'item', plural: 'items' },
  selectedItems = new Set<string>(),
  selectionActions,
  onResetSelection,
  onDelete,
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
  isDeleteLoading?: boolean
}) {
  const [currentPageInput, setCurrentPageInput] = useState(
    currentPage.toString(),
  )
  const navigate = useNavigate({ from: '/dashboard/$listKey' })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    setCurrentPageInput(currentPage.toString())
  }, [currentPage])

  function handlePageChange(newPage: number) {
    const page = Math.max(1, Math.min(totalPages, Number(newPage)))
    if (page === currentPage) return
    void navigate({ search: (previous) => ({ ...previous, page }) })
  }

  function handlePageSizeChange(newSize: number) {
    const size = normalizeDashboardPageSize(newSize, pageSize)
    void navigate({
      search: (previous) => ({ ...previous, pageSize: size, page: 1 }),
    })
  }

  function statsMessage() {
    if (total > pageSize) {
      const start = pageSize * (currentPage - 1) + 1
      const end = Math.min(start + pageSize - 1, total)
      return (
        <div
          className="flex items-center gap-x-1 text-xs sm:text-sm"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span>{start}</span>
          {start !== end ? (
            <>
              <span className="text-muted-foreground/70">-</span>
              <span>{end}</span>
            </>
          ) : null}
          <span className="text-xs tracking-wide text-muted-foreground/70 uppercase sm:text-sm">
            of
          </span>
          <span>{total}</span>
          <span className="hidden truncate text-xs tracking-wide text-muted-foreground/70 uppercase sm:inline sm:text-sm">
            {list.plural.toLowerCase()}
          </span>
        </div>
      )
    }

    const label = total === 1 ? list.singular : list.plural
    return (
      <div
        className="flex items-center gap-x-1 text-xs sm:text-sm"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span>{total}</span>
        <span className="hidden truncate text-xs tracking-wide text-muted-foreground/70 uppercase sm:inline sm:text-sm">
          {label.toLowerCase()}
        </span>
      </div>
    )
  }

  if (selectedItems.size > 0 && onDelete) {
    return (
      <nav
        className="fixed bottom-4 left-1/2 z-10 -translate-x-1/2 transition-all duration-300"
        aria-label={`${list.plural} selection actions`}
      >
        <div className="flex items-center gap-x-1 rounded-full border border-transparent bg-zinc-100 p-1 text-sm shadow shadow-black/20 ring-1 ring-foreground/5 dark:bg-zinc-900">
          <Button
            type="button"
            onClick={onResetSelection}
            variant="outline"
            className="rounded-l-[20px] rounded-r-md font-semibold"
          >
            <X className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="tracking-wide uppercase">Cancel</span>
          </Button>
          {selectionActions}
          <AlertDialog>
            <AlertDialogTrigger
              className="inline-flex h-9 items-center justify-center gap-3 rounded-l-md rounded-r-[20px] bg-destructive px-4 py-2 text-sm font-semibold tracking-wide text-destructive-foreground uppercase shadow-xs hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-50"
              disabled={isDeleteLoading}
            >
              Delete {selectedItems.size}{' '}
              {selectedItems.size === 1 ? list.singular : list.plural}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Confirmation</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {selectedItems.size}{' '}
                  {selectedItems.size === 1 ? list.singular : list.plural}?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </nav>
    )
  }

  return (
    <nav
      className="fixed bottom-4 left-1/2 z-10 -translate-x-1/2 transition-all duration-300"
      aria-label={`${list.plural} pagination`}
    >
      <div className="flex items-center gap-x-1 rounded-full border border-transparent bg-zinc-100 p-1 text-sm shadow shadow-black/20 ring-1 ring-foreground/5 dark:bg-zinc-900">
        <Button
          variant="outline"
          aria-label="Previous page"
          className="h-8 w-9 rounded-l-[20px] rounded-r-md p-1.5 text-xs font-semibold sm:h-9 sm:w-auto sm:p-2 sm:text-sm"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="size-4 sm:size-5" aria-hidden="true" />
        </Button>

        <div className="flex items-center gap-x-2 px-2">
          {statsMessage()}
          <span className="text-muted-foreground/40">/</span>
          <Input
            value={currentPageInput}
            onChange={(event) => {
              const value = event.target.value
              if (value === '' || /^\d+$/.test(value))
                setCurrentPageInput(value)
            }}
            onBlur={() =>
              currentPageInput === ''
                ? setCurrentPageInput(currentPage.toString())
                : handlePageChange(Number(currentPageInput))
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter')
                handlePageChange(Number(currentPageInput))
            }}
            className="h-7 w-10 rounded-md bg-background px-1 text-center text-xs"
            aria-label="Page number"
          />
          <span className="text-xs text-muted-foreground">of {totalPages}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Change rows per page, currently ${pageSize}`}
            className="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2 text-xs font-medium outline-none hover:bg-accent hover:text-accent-foreground"
          >
            {pageSize} per page
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44" align="center">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Page Size</DropdownMenuLabel>
              {DASHBOARD_PAGE_SIZES.map((size) => (
                <DropdownMenuItem
                  key={size}
                  onClick={() => handlePageSizeChange(size)}
                >
                  {size} per page
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <div className="flex items-center gap-2 p-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-7"
                aria-label="Decrease rows per page"
                onClick={() =>
                  handlePageSizeChange(snapPageSizeToClosest(pageSize - 1))
                }
                disabled={pageSize <= DASHBOARD_PAGE_SIZES[0]}
              >
                <Minus className="size-3" aria-hidden="true" />
              </Button>
              <Input
                value={pageSize}
                onChange={(event) => {
                  const value = event.target.value
                  if (value === '') return
                  if (/^\d+$/.test(value)) handlePageSizeChange(Number(value))
                }}
                className="h-7 w-14 px-1 text-center text-xs"
                aria-label="Rows per page"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-7"
                aria-label="Increase rows per page"
                onClick={() =>
                  handlePageSizeChange(snapPageSizeToClosest(pageSize + 1))
                }
                disabled={
                  pageSize >=
                  DASHBOARD_PAGE_SIZES[DASHBOARD_PAGE_SIZES.length - 1]
                }
              >
                <Plus className="size-3" aria-hidden="true" />
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          aria-label="Next page"
          className="h-8 w-9 rounded-l-md rounded-r-[20px] p-1.5 text-xs font-semibold sm:h-9 sm:w-auto sm:p-2 sm:text-sm"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          <ChevronRight className="size-4 sm:size-5" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
