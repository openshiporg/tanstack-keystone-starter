import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { Check, Copy, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toaster'
import {
  dashboardQueryKeys,
  executeRawDashboardGraphQL,
  fetchDashboardItemPage,
  fetchKeystoneAdminMeta,
  findDashboardListByPath,
} from '@/features/cms/graphql-client'

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

  useEffect(() => {
    setDraft(currentDraft)
  }, [currentDraft])

  function resetChanges() {
    setDraft(currentDraft)
    setShowResetDialog(false)
    setMessage({ message: 'Unsaved changes reset.', details: null })
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
      setMessage({ message: 'Saved changes.', details: null })
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
    setMessage({ message: 'ID copied to clipboard', details: null })
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

  if (error) {
    return (
      <main className="w-full max-w-5xl p-4 md:p-6">
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load item: {error.message}
        </div>
      </main>
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
      <main className="w-full max-w-5xl p-4 md:p-6">
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          Item not found.
        </div>
      </main>
    )
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
          { type: 'page', label: data.title },
        ]}
        actions={
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {hasChanges ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Unsaved changes
              </span>
            ) : null}
            <ItemPageActions
              data={data}
              item={item}
              itemLabel={data.title}
              disabled={saving || deleting}
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
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground shadow-xs hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-50"
                  disabled={deleting || saving}
                >
                  <Trash2 className="size-3.5" />
                  {deleting ? 'Deleting…' : 'Delete'}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete {data.list.singular}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this{' '}
                      {data.list.singular.toLowerCase()}? This action cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void deleteItem()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetDialog(true)}
              disabled={!hasChanges || saving || deleting}
            >
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
            <AlertDialog
              open={showResetDialog}
              onOpenChange={setShowResetDialog}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset changes</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure? Lost changes cannot be recovered.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={resetChanges}>
                    Yes, reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              size="sm"
              onClick={saveChanges}
              disabled={!hasChanges || saving || deleting}
            >
              <Save className="size-3.5" />
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        }
      />

      <main className="w-full max-w-5xl p-4 md:p-6">
        <div className="grid min-w-0 gap-6 gap-y-8 lg:grid-cols-[minmax(240px,2fr)_3fr]">
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div>
              <h1 className="[overflow-wrap:anywhere] text-lg font-semibold md:text-2xl">
                {data.title}
              </h1>
              <p className="text-sm text-muted-foreground">
                Edit {data.list.singular.toLowerCase()} fields and save changes.
              </p>
            </div>
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  ID
                </CardTitle>
              </CardHeader>
              <CardContent className="flex min-w-0 flex-wrap items-center gap-2">
                <code className="min-w-0 break-all rounded bg-muted px-2 py-1 text-sm">
                  {item.id}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCopyId()}
                >
                  <Copy className="size-3.5" />
                  Copy ID
                </Button>
              </CardContent>
            </Card>
            {sidebarGroups.length ? (
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
            ) : null}
          </aside>
          <div className="min-w-0 space-y-6">
            {message ? (
              <MutationErrorNotice error={message} variant="neutral" />
            ) : null}
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
        </div>
      </main>
    </>
  )
}
function MissingSingletonMessage({
  data,
}: {
  data: NonNullable<ReturnType<typeof Route.useLoaderData>>
}) {
  return (
    <main className="w-full max-w-5xl p-4 md:p-6">
      <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-sm text-muted-foreground">
          &quot;{data.list.label}&quot; doesn&apos;t exist, or you don&apos;t
          have access to it.
        </p>
      </div>
    </main>
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
          <Button
            size="sm"
            className="text-xs sm:text-sm"
            onClick={() => void createSingleton()}
            disabled={saving}
          >
            Create {data.list.singular}
            <Check className="ml-1 stroke-[1.5px]" width="8" height="8" />
          </Button>
        }
      />
      <main className="w-full max-w-5xl p-4 md:p-6">
        <div className="grid min-w-0 gap-6 gap-y-8 lg:grid-cols-[minmax(240px,2fr)_3fr]">
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div>
              <h1 className="text-lg font-semibold md:text-2xl">
                Create {data.list.singular}
              </h1>
              <p className="text-sm text-muted-foreground">
                &quot;{data.list.label}&quot; doesn&apos;t exist yet. Create it
                here.
              </p>
              {hasChanges ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Unsaved changes
                </p>
              ) : null}
            </div>
            {sidebarGroups.length ? (
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
            ) : null}
          </aside>
          <div className="min-w-0 space-y-6">
            {error ? <MutationErrorNotice error={error} /> : null}
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
        </div>
      </main>
    </>
  )
}
