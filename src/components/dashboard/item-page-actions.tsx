import { MoreHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'

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
  DashboardItemActionMeta,
  DashboardItemPageData,
} from '@/features/cms/graphql-client'
import { executeRawDashboardGraphQL } from '@/features/cms/graphql-client'

import {
  formatGraphQLErrorDetails,
  summarizeGraphQLErrors,
} from './graphql-error-details'

type VisibleItemAction = DashboardItemPageData['list']['actions'][number] & {
  itemView: DashboardItemActionMeta
}

type ItemActionRunnerArgs = {
  action: VisibleItemAction
  itemId: string
  list: DashboardItemPageData['list']
  itemLabel: string
  onError: (error: {
    title: string
    message: string
    details: string | null
  }) => void
  onSuccess: (args: {
    message: string
    resultId: string | null
    navigation: 'follow' | 'refetch' | 'return'
    hideToast: boolean
  }) => Promise<void> | void
}

export function replaceActionTokens(
  template: string,
  args: {
    singular: string
    plural: string
    itemLabel: string
    count?: number
    countFail?: number
    countSuccess?: number
  },
) {
  const singularLower = args.singular.toLowerCase()
  const pluralLower = args.plural.toLowerCase()
  const count = args.count ?? 0
  const countFail = args.countFail ?? 0
  const countSuccess = args.countSuccess ?? 0

  return template
    .replaceAll('{count}', String(count))
    .replaceAll('{countFail}', String(countFail))
    .replaceAll('{countSuccess}', String(countSuccess))
    .replaceAll('{singular|plural}', count === 1 ? singularLower : pluralLower)
    .replaceAll('{Singular|Plural}', count === 1 ? args.singular : args.plural)
    .replaceAll('{singular}', singularLower)
    .replaceAll('{plural}', pluralLower)
    .replaceAll('{Singular}', args.singular)
    .replaceAll('{Plural}', args.plural)
    .replaceAll('{itemLabel}', args.itemLabel)
}

export function visibleItemActions(
  data: Pick<DashboardItemPageData, 'list' | 'actionMetaByKey'>,
): VisibleItemAction[] {
  return data.list.actions
    .map((action) => ({
      ...action,
      itemView: data.actionMetaByKey[action.key] ?? action.itemView,
    }))
    .filter((action) => action.itemView.actionMode !== 'hidden')
}

async function runItemAction(args: ItemActionRunnerArgs) {
  const mutationName = args.action.graphql.names.one
  const failureTitle = replaceActionTokens(args.action.messages.fail, {
    singular: args.list.singular,
    plural: args.list.plural,
    itemLabel: args.itemLabel,
  })

  const result = await executeRawDashboardGraphQL<
    Record<string, { id: string } | null>
  >(
    `mutation DashboardItemAction($id: ID!) { ${mutationName}(where: { id: $id }) { id } }`,
    { id: args.itemId },
  )

  if (result.errors?.length) {
    args.onError({
      title: failureTitle,
      message: summarizeGraphQLErrors(result.errors, {
        fallbackMessage: failureTitle,
      }),
      details: formatGraphQLErrorDetails(result.errors),
    })
    return
  }

  const resultId = result.data?.[mutationName]?.id ?? null
  await args.onSuccess({
    message: replaceActionTokens(args.action.messages.success, {
      singular: args.list.singular,
      plural: args.list.plural,
      itemLabel: args.itemLabel,
    }),
    resultId,
    navigation: args.action.itemView.navigation,
    hideToast: args.action.itemView.hideToast,
  })
}

export function ItemPageActions({
  data,
  item,
  itemLabel,
  disabled,
  onError,
  onSuccess,
}: {
  data: DashboardItemPageData
  item: { id: string }
  itemLabel: string
  disabled?: boolean
  onError: (error: {
    title: string
    message: string
    details: string | null
  }) => void
  onSuccess: (args: {
    message: string
    resultId: string | null
    navigation: 'follow' | 'refetch' | 'return'
    hideToast: boolean
  }) => Promise<void> | void
}) {
  const [runningActionKey, setRunningActionKey] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<VisibleItemAction | null>(
    null,
  )

  const actions = useMemo(() => visibleItemActions(data), [data])

  async function triggerAction(action: VisibleItemAction) {
    setRunningActionKey(action.key)
    try {
      await runItemAction({
        action,
        itemId: item.id,
        list: data.list,
        itemLabel,
        onError,
        onSuccess,
      })
    } finally {
      setRunningActionKey(null)
      setPendingAction(null)
    }
  }

  if (actions.length === 0) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || runningActionKey !== null}
            />
          }
        >
          <MoreHorizontal className="size-3.5" />
          Actions
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.key}
              disabled={
                disabled ||
                action.itemView.actionMode === 'disabled' ||
                runningActionKey !== null
              }
              onClick={() => {
                if (
                  action.itemView.actionMode === 'disabled' ||
                  runningActionKey !== null
                )
                  return
                if (action.itemView.hidePrompt) {
                  void triggerAction(action)
                  return
                }
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
                ? replaceActionTokens(pendingAction.messages.promptTitle, {
                    singular: data.list.singular,
                    plural: data.list.plural,
                    itemLabel,
                  })
                : 'Confirm action'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction
                ? replaceActionTokens(pendingAction.messages.prompt, {
                    singular: data.list.singular,
                    plural: data.list.plural,
                    itemLabel,
                  })
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingAction) return
                void triggerAction(pendingAction)
              }}
            >
              {pendingAction
                ? replaceActionTokens(
                    pendingAction.messages.promptConfirmLabel,
                    {
                      singular: data.list.singular,
                      plural: data.list.plural,
                      itemLabel,
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
