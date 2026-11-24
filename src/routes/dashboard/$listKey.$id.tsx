import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Link,
  createFileRoute,
  notFound,
  redirect,
} from '@tanstack/react-router'
import {
  Check,
  Copy,
  FileQuestion,
  RotateCw,
  Trash2,
  TriangleAlert,
  Undo2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { PageSkeleton } from '@/components/dashboard/page-skeleton'
import { enhanceFields } from '@/components/dashboard/enhance-fields'
import {
  EnhancedFormFields,
  getEnhancedFieldGroups,
  invalidFieldsForValues,
} from '@/components/dashboard/enhanced-form-fields'
import {
  hasFormChanges,
  makeDefaultValueState,
  serializeValueToOperationItem,
} from '@/components/dashboard/form-state'
import {
  graphQLErrorState,
  mutationErrorState,
} from '@/components/dashboard/graphql-error-details'
import { statusTone } from '@/components/dashboard/keystone-list-table'
import { ItemPageActions } from '@/components/dashboard/item-page-actions'
import { MutationErrorNotice } from '@/components/dashboard/mutation-error-notice'
import { PageBreadcrumbs } from '@/components/dashboard/page-breadcrumbs'
import { usePreventNavigation } from '@/components/dashboard/use-prevent-navigation'
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
import { Button, buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/components/ui/toaster'
import {
  dashboardQueryKeys,
  executeRawDashboardGraphQL,
  fetchDashboardItemPage,
  fetchKeystoneAdminMeta,
  findDashboardListByPath,
  findStatusField,
} from '@/features/cms/graphql-client'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/dashboard/$listKey/$id')({
  loader: async ({ context, params }) => {
    const adminMeta = await context.queryClient.ensureQueryData({
      queryKey: dashboardQueryKeys.adminMeta,
      queryFn: () => fetchKeystoneAdminMeta(),
    })
    const list = findDashboardListByPath(adminMeta, params.listKey)
    if (!list) throw notFound()
    if (params.listKey !== list.path)
      throw redirect({
        to: '/dashboard/$listKey/$id',
        params: { listKey: list.path, id: params.id },
      })

    try {
      return await context.queryClient.ensureQueryData({
        queryKey: dashboardQueryKeys.itemPage(params.listKey, params.id),
        queryFn: () =>
          fetchDashboardItemPage({ listPath: params.listKey, id: params.id }),
      })
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.startsWith('List not found:') ||
          error.message.startsWith('Item not found:'))
      )
        throw notFound()
      throw error
    }
  },
  component: DashboardItemRoute,
  pendingComponent: PageSkeleton,
})

function DashboardItemRoute() {
  const params = Route.useParams()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const loaderData = Route.useLoaderData()
  const { data, error, refetch } = useQuery({
    queryKey: dashboardQueryKeys.itemPage(params.listKey, params.id),
    queryFn: () =>
      fetchDashboardItemPage({ listPath: params.listKey, id: params.id }),
    initialData: loaderData,
  })
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [message, setMessage] = useState<{
    message: string
    details: string | null
    fieldPaths?: string[]
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const item = data.item

  const enhancedFields = useMemo(() => {
    const baseFields = enhanceFields(data.list.fields, data.list.key)
    return Object.fromEntries(
      Object.entries(baseFields).map(([fieldPath, field]) => {
        const runtimeMeta = data.fieldMetaByPath[fieldPath]
        const mergedField = {
          ...field,
          isNonNull: runtimeMeta.isNonNull,
          fieldMeta: runtimeMeta.fieldMeta
            ? { ...field.fieldMeta, ...runtimeMeta.fieldMeta }
            : field.fieldMeta,
          itemView: runtimeMeta.itemView
            ? { ...field.itemView, ...runtimeMeta.itemView }
            : field.itemView,
        }
        return [fieldPath, mergedField]
      }),
    )
  }, [data.fieldMetaByPath, data.list.fields, data.list.key])
  const allVisibleFields = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(enhancedFields).filter(
          ([, field]) =>
            field.path === 'id' || field.itemView.fieldMode !== 'hidden',
        ),
      ),
    [enhancedFields],
  )
  const editableFields = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(allVisibleFields).filter(
          ([, field]) => field.path !== 'id',
        ),
      ),
    [allVisibleFields],
  )
  const currentDraft = useMemo(() => {
    const itemRecord = data.item ?? {}
    return Object.fromEntries(
      Object.entries(allVisibleFields).map(([fieldPath, field]) => [
        fieldPath,
        field.controller.deserialize(itemRecord),
      ]),
    )
  }, [data.item, allVisibleFields])
  const serialized = useMemo(
    () =>
      serializeValueToOperationItem(
        'update',
        editableFields,
        draft,
        currentDraft,
      ),
    [currentDraft, draft, editableFields],
  )
  const invalidFields = useMemo(
    () => invalidFieldsForValues(editableFields, draft, 'itemView'),
    [editableFields, draft],
  )
  const highlightedFields = useMemo(
    () =>
      new Set([
        ...invalidFields,
        ...((showValidation ? message?.fieldPaths : []) ?? []),
      ]),
    [invalidFields, message?.fieldPaths, showValidation],
  )
  const hasChanges = useMemo(
    () =>
      Object.keys(draft).length > 0 &&
      hasFormChanges('update', editableFields, draft, currentDraft),
    [currentDraft, draft, editableFields],
  )
  const { sidebarGroups } = useMemo(
    () =>
      getEnhancedFieldGroups(
        data.list,
        Object.values(allVisibleFields),
        'itemView',
      ),
    [allVisibleFields, data.list],
  )

  usePreventNavigation(hasChanges && !saving && !deleting)

  // Status dot on the title line follows the live value of the list's status select, if any
  const status = useMemo(() => {
    const statusField = findStatusField(data.list)
    if (!statusField || !data.item) return null
    const enhanced = allVisibleFields[statusField.path]
    let raw: unknown = data.item[statusField.path]
    if (enhanced && statusField.path in draft) {
      const live = enhanced.controller.serialize(draft[statusField.path])
      if (statusField.path in live) raw = live[statusField.path]
    }
    const options = Array.isArray(statusField.fieldMeta.options)
      ? (statusField.fieldMeta.options as Array<{
          label: string
          value: unknown
        }>)
      : []
    const option = options.find((entry) => String(entry.value) === String(raw))
    return {
      tone: statusTone(raw),
      label:
        option?.label ??
        (raw === null || raw === undefined ? 'None' : String(raw)),
    }
  }, [allVisibleFields, data.item, data.list, draft])

  // Cmd/Ctrl+S saves, like every desktop editor
  const saveRef = useRef<() => void>(() => {})
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    setDraft(currentDraft)
  }, [currentDraft])

  function resetChanges() {
    setDraft(currentDraft)
    setShowResetDialog(false)
    setMessage(null)
    setShowValidation(false)
    toast({
      title: 'Changes reset',
      description: 'Unsaved edits were discarded.',
    })
  }

  async function saveChanges() {
    setSaving(true)
    setMessage(null)
    try {
      if (!data.item) throw new Error('Item does not exist.')
      setShowValidation(true)
      if (invalidFields.size > 0)
        throw new Error(
          'Please resolve the highlighted field errors before saving this item.',
        )
      const updateData = serializeValueToOperationItem(
        'update',
        editableFields,
        draft,
        currentDraft,
      )
      const result = await executeRawDashboardGraphQL<
        Record<string, { id: string } | null>
      >(
        `mutation DashboardUpdate($where: ${data.list.gqlNames.whereUniqueInputName}!, $data: ${data.list.gqlNames.updateInputName}!) { ${data.list.gqlNames.updateMutationName}(where: $where, data: $data) { id } }`,
        { where: { id: item.id }, data: updateData },
      )
      if (result.errors?.length) {
        const nextError = graphQLErrorState(result.errors, {
          fallbackMessage: 'Unable to save item.',
        })
        setMessage(nextError)
        toast({
          title: `Could not save ${data.list.singular.toLowerCase()}`,
          description: nextError.message,
        })
        return
      }
      if (!result.data?.[data.list.gqlNames.updateMutationName])
        throw new Error('Update returned no item.')
      await queryClient.invalidateQueries({
        queryKey: ['dashboard', 'listPage', data.list.path],
      })
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.itemPage(data.list.path, item.id),
      })
      await refetch()
      setShowValidation(false)
      setJustSaved(true)
      window.setTimeout(() => setJustSaved(false), 3000)
      toast({
        title: 'Changes saved',
        description: `${data.list.singular} was updated successfully.`,
      })
    } catch (saveError) {
      const nextError = mutationErrorState(saveError, 'Unable to save item.')
      setMessage(nextError)
      toast({
        title: `Could not save ${data.list.singular.toLowerCase()}`,
        description: nextError.message,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleCopyId() {
    if (!data.item) return
    await navigator.clipboard.writeText(item.id)
    toast({
      title: 'ID copied',
      description: 'The item id is now in your clipboard.',
    })
  }

  async function handleActionSuccess(args: {
    message: string
    resultId: string | null
    navigation: 'follow' | 'refetch' | 'return'
    hideToast: boolean
  }) {
    await queryClient.invalidateQueries({
      queryKey: ['dashboard', 'listPage', data.list.path],
    })
    await queryClient.invalidateQueries({
      queryKey: dashboardQueryKeys.itemPage(data.list.path, item.id),
    })

    if (!args.hideToast) {
      toast({ title: 'Action completed', description: args.message })
    }

    if (args.navigation === 'refetch') {
      await refetch()
      return
    }

    if (
      args.navigation === 'follow' &&
      args.resultId &&
      args.resultId !== item.id
    ) {
      await navigate({
        to: '/dashboard/$listKey/$id',
        params: { listKey: data.list.path, id: args.resultId },
        ignoreBlocker: true,
      })
      return
    }

    if (args.navigation === 'return') {
      await navigate({
        to: '/dashboard/$listKey',
        params: { listKey: data.list.path },
        ignoreBlocker: true,
      })
      return
    }

    await refetch()
  }

  async function deleteItem() {
    setDeleting(true)
    setMessage(null)
    try {
      if (!data.item) throw new Error('Item does not exist.')
      const result = await executeRawDashboardGraphQL<
        Record<string, { id: string } | null>
      >(
        `mutation DashboardDelete($where: ${data.list.gqlNames.whereUniqueInputName}!) { ${data.list.gqlNames.deleteMutationName}(where: $where) { id } }`,
        { where: { id: item.id } },
      )
      if (result.errors?.length) {
        const nextError = graphQLErrorState(result.errors, {
          fallbackMessage: 'Unable to delete item.',
        })
        setMessage(nextError)
        toast({
          title: `Could not delete ${data.list.singular.toLowerCase()}`,
          description: nextError.message,
        })
        return
      }
      await queryClient.invalidateQueries({
        queryKey: ['dashboard', 'listPage', data.list.path],
      })
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.itemPage(data.list.path, item.id),
      })
      toast({
        title: `${data.list.singular} deleted`,
        description: 'The item was removed successfully.',
      })
      if (data.list.isSingleton) {
        await navigate({ to: '/dashboard', ignoreBlocker: true })
      } else {
        await navigate({
          to: '/dashboard/$listKey',
          params: { listKey: data.list.path },
          ignoreBlocker: true,
        })
      }
    } catch (deleteError) {
      const nextError = mutationErrorState(
        deleteError,
        'Unable to delete item.',
      )
      setMessage(nextError)
      toast({
        title: `Could not delete ${data.list.singular.toLowerCase()}`,
        description: nextError.message,
      })
    } finally {
      setDeleting(false)
    }
  }

  saveRef.current = () => {
    if (hasChanges && !saving && !deleting) void saveChanges()
  }

  const crumbsBase = [
    { type: 'link' as const, label: 'Overview', href: '/dashboard' },
    {
      type: 'model' as const,
      label: data.list.label,
      href: `/dashboard/${data.list.path}`,
    },
  ]

  if (error) {
    return (
      <>
        <PageBreadcrumbs
          items={[...crumbsBase, { type: 'page', label: 'Error' }]}
        />
        <div className="ks-card mx-4 mt-6 md:mx-6">
          <EmptyState
            title={`Couldn't load ${data.list.singular.toLowerCase()}`}
            description={error.message}
            icons={[TriangleAlert]}
          >
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              <RotateCw />
              Retry
            </Button>
          </EmptyState>
        </div>
      </>
    )
  }

  const missingItem = data.item == undefined

  if (missingItem && data.list.isSingleton && params.id === '1') {
    return data.list.hideCreate ? (
      <MissingSingletonMessage data={data} />
    ) : (
      <SingletonCreateForm data={data} />
    )
  }

  if (missingItem) {
    return (
      <>
        <PageBreadcrumbs
          items={[...crumbsBase, { type: 'page', label: 'Not found' }]}
        />
        <div className="ks-card mx-4 mt-6 md:mx-6">
          <EmptyState title="Not found" icons={[FileQuestion]}>
            <Link
              to="/dashboard/$listKey"
              params={{ listKey: data.list.path }}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              {data.list.label}
            </Link>
          </EmptyState>
        </div>
      </>
    )
  }

  const hasSidebar = sidebarGroups.length > 0
  const pageTitle = data.list.isSingleton ? data.list.label : data.title
  const busy = saving || deleting

  return (
    <>
      <PageBreadcrumbs
        items={[...crumbsBase, { type: 'page', label: pageTitle }]}
        actions={
          <div className="ks-track">
            <ItemPageActions
              data={data}
              item={item}
              itemLabel={data.title}
              disabled={busy}
              onError={(errorState) => {
                setMessage({
                  message: errorState.message,
                  details: errorState.details,
                  fieldPaths: [],
                })
                toast({
                  title: errorState.title,
                  description: errorState.message,
                })
              }}
              onSuccess={handleActionSuccess}
            />
            {!data.list.hideDelete ? (
              <AlertDialog>
                <AlertDialogTrigger
                  aria-label="Delete"
                  disabled={busy}
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      data-variant="danger"
                      className="max-sm:w-7 max-sm:px-0"
                    />
                  }
                >
                  <Trash2 />
                  <span className="max-sm:hidden">
                    {deleting ? 'Deleting' : 'Delete'}
                  </span>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete {data.list.singular.toLowerCase()}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      data-variant="danger-fill"
                      onClick={() => void deleteItem()}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
            {hasChanges ? (
              <Button
                variant="outline"
                size="sm"
                aria-label="Reset"
                className="max-sm:w-7 max-sm:px-0"
                onClick={() => setShowResetDialog(true)}
                disabled={busy}
              >
                <Undo2 />
                <span className="max-sm:hidden">Reset</span>
              </Button>
            ) : null}
            <AlertDialog
              open={showResetDialog}
              onOpenChange={setShowResetDialog}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Discard changes</AlertDialogTitle>
                  <AlertDialogDescription>
                    Unsaved edits will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep editing</AlertDialogCancel>
                  <AlertDialogAction
                    data-variant="danger-fill"
                    onClick={resetChanges}
                  >
                    Discard
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              size="sm"
              onClick={() => void saveChanges()}
              disabled={!hasChanges || busy}
              title="Save (⌘S)"
            >
              {justSaved && !hasChanges ? <Check /> : null}
              {saving ? 'Saving' : justSaved && !hasChanges ? 'Saved' : 'Save'}
            </Button>
          </div>
        }
      />

      <div
        className={cn(
          'mx-auto w-full px-4 pt-5 pb-16 md:px-6 md:pt-6',
          hasSidebar ? 'max-w-[1120px]' : 'max-w-[760px]',
        )}
      >
        {/* Title line: status dot + record label; meta: status, ID */}
        <div className="mb-5 flex flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {status ? (
              <span
                className="ks-dot"
                data-tone={status.tone}
                role="img"
                aria-label={status.label}
                title={status.label}
              />
            ) : null}
            <h1
              className="min-w-0 truncate text-[18px] leading-7 font-semibold tracking-[-0.01em] text-[var(--ks-ink)] md:text-[20px]"
              title={pageTitle}
            >
              {pageTitle}
            </h1>
            {hasChanges ? (
              <span className="shrink-0 rounded-[6px] bg-[color-mix(in_oklab,var(--ks-amber)_14%,transparent)] px-1.5 py-0.5 text-[12px] leading-4 font-medium text-[var(--ks-amber)]">
                Edited
              </span>
            ) : null}
          </div>
          <div className="flex min-w-0 items-center gap-2 text-[12px] text-[var(--ks-dim)]">
            {status ? <span className="shrink-0">{status.label}</span> : null}
            {status ? (
              <span aria-hidden="true" className="text-[var(--ks-label)]">
                ·
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void handleCopyId()}
              className="group/id flex min-w-0 items-center gap-1.5 rounded-[6px] font-mono text-[12px] text-[var(--ks-dim)] hover:text-[var(--ks-ink)]"
              aria-label="Copy ID"
            >
              <span className="truncate">{item.id}</span>
              <Copy className="size-3 shrink-0 opacity-60 group-hover/id:opacity-100" />
            </button>
          </div>
        </div>

        {message ? (
          <div className="mb-4">
            <MutationErrorNotice error={message} />
          </div>
        ) : null}

        <div
          className={
            hasSidebar
              ? 'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]'
              : undefined
          }
        >
          <div className="min-w-0">
            <EnhancedFormFields
              list={data.list}
              fields={allVisibleFields}
              values={draft}
              serialized={serialized}
              view="itemView"
              region="form"
              invalidFields={showValidation ? highlightedFields : undefined}
              onChange={setDraft}
            />
          </div>
          {hasSidebar ? (
            <aside className="min-w-0 lg:sticky lg:top-16 lg:self-start">
              <EnhancedFormFields
                list={data.list}
                fields={allVisibleFields}
                values={draft}
                serialized={serialized}
                view="itemView"
                region="sidebar"
                invalidFields={showValidation ? highlightedFields : undefined}
                onChange={setDraft}
              />
            </aside>
          ) : null}
        </div>
      </div>
    </>
  )
}

function MissingSingletonMessage({
  data,
}: {
  data: NonNullable<ReturnType<typeof Route.useLoaderData>>
}) {
  return (
    <>
      <PageBreadcrumbs
        items={[
          { type: 'link', label: 'Overview', href: '/dashboard' },
          { type: 'page', label: data.list.label },
        ]}
      />
      <div className="ks-card mx-4 mt-6 md:mx-6">
        <EmptyState
          title="Not found"
          description={`“${data.list.label}” doesn't exist, or you don't have access to it.`}
          icons={[FileQuestion]}
        />
      </div>
    </>
  )
}

function SingletonCreateForm({
  data,
}: {
  data: NonNullable<ReturnType<typeof Route.useLoaderData>>
}) {
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [state, setState] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<{
    message: string
    details: string | null
    fieldPaths?: string[]
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const enhancedFields = useMemo(
    () => enhanceFields(data.list.fields, data.list.key),
    [data.list.fields, data.list.key],
  )
  const formFields = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(enhancedFields).filter(
          ([, field]) => field.path !== 'id',
        ),
      ),
    [enhancedFields],
  )
  const initialState = useMemo(
    () => makeDefaultValueState(formFields),
    [formFields],
  )
  const serialized = useMemo(
    () =>
      serializeValueToOperationItem('create', formFields, state, initialState),
    [formFields, initialState, state],
  )
  const invalidFields = useMemo(
    () => invalidFieldsForValues(formFields, state, 'createView'),
    [formFields, state],
  )
  const highlightedFields = useMemo(
    () =>
      new Set([
        ...invalidFields,
        ...((showValidation ? error?.fieldPaths : []) ?? []),
      ]),
    [error?.fieldPaths, invalidFields, showValidation],
  )
  const hasChanges = useMemo(
    () =>
      Object.keys(state).length > 0 &&
      hasFormChanges('create', formFields, state, initialState),
    [formFields, initialState, state],
  )
  const { sidebarGroups } = useMemo(
    () =>
      getEnhancedFieldGroups(
        data.list,
        Object.values(formFields),
        'createView',
      ),
    [data.list, formFields],
  )

  usePreventNavigation(hasChanges && !saving)

  useEffect(() => {
    setState(initialState)
  }, [initialState])

  async function createSingleton() {
    setSaving(true)
    setError(null)
    try {
      setShowValidation(true)
      if (invalidFields.size > 0)
        throw new Error(
          'Please resolve the highlighted field errors before creating this singleton.',
        )
      const createData = serializeValueToOperationItem(
        'create',
        formFields,
        state,
        initialState,
      )

      const mutationName = data.list.gqlNames.createMutationName
      const result = await executeRawDashboardGraphQL<
        Record<string, { id: string }>
      >(
        `mutation DashboardCreateSingleton($data: ${data.list.gqlNames.createInputName}!) { ${mutationName}(data: $data) { id } }`,
        { data: createData },
      )
      if (result.errors?.length) {
        const nextError = graphQLErrorState(result.errors, {
          fallbackMessage: 'Unable to create singleton item.',
        })
        setError(nextError)
        toast({
          title: `Could not create ${data.list.singular.toLowerCase()}`,
          description: nextError.message,
        })
        return
      }
      const created = result.data?.[mutationName]
      if (!created?.id)
        throw new Error('Create succeeded but no item id was returned.')
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.overview,
      })
      await queryClient.invalidateQueries({
        queryKey: ['dashboard', 'listPage', data.list.path],
      })
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.itemPage(data.list.path, '1'),
      })
      toast({
        title: `${data.list.singular} created`,
        description: 'The singleton item is ready to edit.',
      })
      await navigate({
        to: '/dashboard/$listKey/$id',
        params: { listKey: data.list.path, id: '1' },
        ignoreBlocker: true,
      })
    } catch (creationError) {
      const nextError = mutationErrorState(
        creationError,
        'Unable to create singleton item.',
      )
      setError(nextError)
      toast({
        title: `Could not create ${data.list.singular.toLowerCase()}`,
        description: nextError.message,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageBreadcrumbs
        items={[
          { type: 'link', label: 'Overview', href: '/dashboard' },
          {
            type: 'model',
            label: data.list.label,
            href: `/dashboard/${data.list.path}`,
          },
          { type: 'page', label: `Create ${data.list.singular}` },
        ]}
        actions={
          <div className="ks-track">
            <Button
              size="sm"
              onClick={() => void createSingleton()}
              disabled={saving}
            >
              {saving ? 'Creating' : `Create ${data.list.singular.toLowerCase()}`}
            </Button>
          </div>
        }
      />
      <div
        className={cn(
          'mx-auto w-full px-4 pt-5 pb-16 md:px-6 md:pt-6',
          sidebarGroups.length ? 'max-w-[1120px]' : 'max-w-[760px]',
        )}
      >
        <div className="mb-5 flex min-w-0 items-center gap-2.5">
          <h1 className="min-w-0 truncate text-[18px] leading-7 font-semibold tracking-[-0.01em] text-[var(--ks-ink)] md:text-[20px]">
            New {data.list.singular.toLowerCase()}
          </h1>
          {hasChanges ? (
            <span className="shrink-0 rounded-[6px] bg-[color-mix(in_oklab,var(--ks-amber)_14%,transparent)] px-1.5 py-0.5 text-[12px] leading-4 font-medium text-[var(--ks-amber)]">
              Edited
            </span>
          ) : null}
        </div>
        {error ? (
          <div className="mb-4">
            <MutationErrorNotice error={error} />
          </div>
        ) : null}
        <div
          className={
            sidebarGroups.length
              ? 'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]'
              : undefined
          }
        >
          <div className="min-w-0">
            <EnhancedFormFields
              list={data.list}
              fields={formFields}
              values={state}
              serialized={serialized}
              view="createView"
              region="form"
              invalidFields={showValidation ? highlightedFields : undefined}
              onChange={setState}
            />
          </div>
          {sidebarGroups.length ? (
            <aside className="min-w-0 lg:sticky lg:top-16 lg:self-start">
              <EnhancedFormFields
                list={data.list}
                fields={formFields}
                values={state}
                serialized={serialized}
                view="createView"
                region="sidebar"
                invalidFields={showValidation ? highlightedFields : undefined}
                onChange={setState}
              />
            </aside>
          ) : null}
        </div>
      </div>
    </>
  )
}
