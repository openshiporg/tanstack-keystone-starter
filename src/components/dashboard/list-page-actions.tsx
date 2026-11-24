import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type {
  DashboardListItem,
  DashboardListPageData,
} from '@/features/cms/graphql-client'
import { executeRawDashboardGraphQL } from '@/features/cms/graphql-client'
import { MoreHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'

import { formatBulkDeleteMessage } from './keystone-list-table'
import {
  formatGraphQLErrorDetails,
  summarizeGraphQLErrors,
} from './graphql-error-details'
import { replaceActionTokens } from './item-page-actions'

type VisibleListAction = DashboardListPageData['list']['actions'][number]

function replaceCountTokens(
  template: string,
  args: {
    singular: string
    plural: string
    count: number
    countFail?: number
    countSuccess?: number
  },
) {
  return replaceActionTokens(template, {
    singular: args.singular,
    plural: args.plural,
    itemLabel: '',
    count: args.count,
    countFail: args.countFail,
    countSuccess: args.countSuccess,
  })
}

function collectBulkActionResult(args: {
  mutationName: string
  ids: string[]
  result: {
    data?: Record<string, unknown>
    errors?: Array<{ message: string; path?: Array<string | number> }>
  }
}) {
  const actionItems = (args.result.data?.[args.mutationName] ?? []) as Array<{
    id: string
  } | null>
  const successIds = new Set(
    actionItems
      .filter((entry): entry is { id: string } => Boolean(entry?.id))
      .map((entry) => entry.id),
  )
  const failedIds = args.ids.filter((id) => !successIds.has(id))
  const errorDetails = (args.result.errors ?? []).map((error, index) => {
    const pathIndex =
      typeof error.path?.[1] === 'number' ? error.path[1] : undefined
    const itemId =
      pathIndex !== undefined
        ? args.ids[pathIndex]
        : (failedIds[index] ?? 'unknown item')
    return `${itemId}: ${error.message}`
  })
  return { successIds, failedIds, errorDetails }
}

export function ListPageActions({
  data,
  selectedItems,
  selectedRows,
  disabled,
  onSuccess,
  onError,
}: {
  data: DashboardListPageData
  selectedItems: Set<string>
  selectedRows: DashboardListItem[]
  disabled?: boolean
  onSuccess: (args: {
    remainingIds: Set<string>
    title: string
    description: string
    details?: string | null
  }) => Promise<void> | void
  onError: (args: {
    title: string
    description: string
    details?: string | null
  }) => void
}) {
  const [pendingAction, setPendingAction] = useState<VisibleListAction | null>(
    null,
  )
  const [runningActionKey, setRunningActionKey] = useState<string | null>(null)

  const actions = useMemo(
    () =>
      data.list.actions.filter(
        (action) => action.listView.actionMode !== 'hidden',
      ),
    [data.list.actions],
  )

  async function runAction(action: VisibleListAction) {
    const ids = Array.from(selectedItems)
    if (ids.length === 0) return
    setRunningActionKey(action.key)
    try {
      const result = await executeRawDashboardGraphQL<
        Record<string, Array<{ id: string } | null> | undefined>
      >(
        `mutation DashboardBulkAction($where: [${data.list.gqlNames.whereUniqueInputName}!]!) {
          ${action.graphql.names.many}(where: $where) { id }
        }`,
        { where: ids.map((id) => ({ id })) },
      )

      if (result.errors?.length && !result.data?.[action.graphql.names.many]) {
        onError({
          title: replaceCountTokens(action.messages.failMany, {
            singular: data.list.singular,
            plural: data.list.plural,
            count: ids.length,
            countFail: ids.length,
            countSuccess: 0,
          }),
          description: summarizeGraphQLErrors(result.errors, {
            fallbackMessage: 'Unable to run bulk action.',
          }),
          details: formatGraphQLErrorDetails(result.errors),
        })
        return
      }

      const { successIds, failedIds, errorDetails } = collectBulkActionResult({
        mutationName: action.graphql.names.many,
        ids,
        result: result as {
          data?: Record<string, unknown>
          errors?: Array<{ message: string; path?: Array<string | number> }>
        },
      })

      const countSuccess = successIds.size
      const countFail = failedIds.length
      const title =
        countFail === 0
          ? replaceCountTokens(action.messages.successMany, {
              singular: data.list.singular,
              plural: data.list.plural,
              count: ids.length,
              countSuccess,
              countFail,
            })
          : replaceCountTokens(action.messages.failMany, {
              singular: data.list.singular,
              plural: data.list.plural,
              count: ids.length,
              countSuccess,
              countFail,
            })
      const details = errorDetails.length
        ? formatBulkDeleteMessage({
            singular: data.list.singular,
            plural: data.list.plural,
            deletedCount: countSuccess,
            failedIds,
            errorDetails,
          })
        : null

      await onSuccess({
        remainingIds: new Set(failedIds),
        title,
        description:
          countFail === 0
            ? replaceCountTokens(action.messages.successMany, {
                singular: data.list.singular,
                plural: data.list.plural,
                count: ids.length,
                countSuccess,
                countFail,
              })
            : `${countSuccess} succeeded, ${countFail} failed.`,
        details,
      })
    } finally {
      setRunningActionKey(null)
      setPendingAction(null)
    }
  }

  if (actions.length === 0 || selectedItems.size === 0) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || runningActionKey !== null}
            />
          }
        >
          <MoreHorizontal />
          Actions
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-52">
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.key}
              disabled={
                disabled ||
                action.listView.actionMode === 'disabled' ||
                runningActionKey !== null
              }
              onClick={() => {
                if (
                  action.listView.actionMode === 'disabled' ||
                  runningActionKey !== null
                )
                  return
                setPendingAction(action)
              }}
            >
              {runningActionKey === action.key
                ? `${action.label}…`
                : action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction
                ? replaceCountTokens(pendingAction.messages.promptTitleMany, {
                    singular: data.list.singular,
                    plural: data.list.plural,
                    count: selectedRows.length,
                  })
                : 'Confirm action'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction
                ? replaceCountTokens(pendingAction.messages.promptMany, {
                    singular: data.list.singular,
                    plural: data.list.plural,
                    count: selectedRows.length,
                  })
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingAction) return
                void runAction(pendingAction)
              }}
            >
              {pendingAction
                ? replaceCountTokens(
                    pendingAction.messages.promptConfirmLabelMany,
                    {
                      singular: data.list.singular,
                      plural: data.list.plural,
                      count: selectedRows.length,
                    },
                  )
                : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
