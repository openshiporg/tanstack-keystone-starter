import { useQuery } from '@tanstack/react-query'
import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { Check } from 'lucide-react'
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
import { MutationErrorNotice } from '@/components/dashboard/mutation-error-notice'
import { PageBreadcrumbs } from '@/components/dashboard/page-breadcrumbs'
import { usePreventNavigation } from '@/components/dashboard/use-prevent-navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toaster'
import {
  dashboardQueryKeys,
  executeRawDashboardGraphQL,
  fetchDashboardCreatePage,
  fetchKeystoneAdminMeta,
  findDashboardListByPath,
} from '@/features/cms/graphql-client'

export const Route = createFileRoute('/dashboard/$listKey/create')({
  loader: async ({ context, params }) => {
    const adminMeta = await context.queryClient.ensureQueryData({
      queryKey: dashboardQueryKeys.adminMeta,
      queryFn: () => fetchKeystoneAdminMeta(),
    })
    const list = findDashboardListByPath(adminMeta, params.listKey)
    if (!list) throw notFound()
    if (params.listKey !== list.path)
      throw redirect({
        to: '/dashboard/$listKey/create',
        params: { listKey: list.path },
      })
    if (list.isSingleton)
      throw redirect({
        to: '/dashboard/$listKey/$id',
        params: { listKey: list.path, id: '1' },
      })
    if (list.hideCreate)
      throw redirect({
        to: '/dashboard/$listKey',
        params: { listKey: list.path },
      })
    return await context.queryClient.ensureQueryData({
      queryKey: dashboardQueryKeys.createPage(list.path),
      queryFn: () => fetchDashboardCreatePage({ listPath: list.path }),
    })
  },
  component: CreateRoute,
})

function CreateRoute() {
  const navigate = Route.useNavigate()
  const { toast } = useToast()
  const loaderData = Route.useLoaderData()
  const { data } = useQuery({
    queryKey: dashboardQueryKeys.createPage(loaderData.list.path),
    queryFn: () => fetchDashboardCreatePage({ listPath: loaderData.list.path }),
    initialData: loaderData,
  })
  const { list } = data
  const [state, setState] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<{
    message: string
    details: string | null
    fieldPaths?: string[]
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [showValidation, setShowValidation] = useState(false)

  const enhancedFields = useMemo(() => {
    const baseFields = enhanceFields(list.fields, list.key)
    return Object.fromEntries(
      Object.entries(baseFields).map(([fieldPath, field]) => {
        const runtimeMeta = data.fieldMetaByPath[fieldPath]
        const mergedField = {
          ...field,
          isNonNull: runtimeMeta?.isNonNull ?? field.isNonNull,
          fieldMeta: runtimeMeta?.fieldMeta
            ? { ...field.fieldMeta, ...runtimeMeta.fieldMeta }
            : field.fieldMeta,
          createView: runtimeMeta?.createView
            ? { ...field.createView, ...runtimeMeta.createView }
            : field.createView,
        }
        return [fieldPath, mergedField]
      }),
    )
  }, [data.fieldMetaByPath, list.fields, list.key])
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
    () => getEnhancedFieldGroups(list, Object.values(formFields), 'createView'),
    [formFields, list],
  )

  usePreventNavigation(hasChanges && !saving)

  useEffect(() => {
    setState(initialState)
  }, [initialState])

  async function onCreate() {
    setSaving(true)
    setError(null)
    try {
      setShowValidation(true)
      if (invalidFields.size > 0)
        throw new Error(
          'Please resolve the highlighted field errors before creating this item.',
        )

      const createData = serializeValueToOperationItem(
        'create',
        formFields,
        state,
        initialState,
      )

      const mutationName = list.gqlNames.createMutationName
      const result = await executeRawDashboardGraphQL<
        Record<string, { id: string }>
      >(
        `mutation DashboardCreate($data: ${list.gqlNames.createInputName}!) { ${mutationName}(data: $data) { id } }`,
        { data: createData },
      )
      if (result.errors?.length) {
        const nextError = graphQLErrorState(result.errors, {
          fallbackMessage: 'Unable to create item.',
        })
        setError(nextError)
        toast({
          title: `Could not create ${list.singular.toLowerCase()}`,
          description: nextError.message,
        })
        return
      }

      const created = result.data?.[mutationName]
      if (!created?.id)
        throw new Error('Create succeeded but no item id was returned.')

      toast({
        title: `${list.singular} created`,
        description: 'Your new item is ready to edit.',
        actionLabel: 'Create another',
        onAction: () => {
          void navigate({
            to: '/dashboard/$listKey/create',
            params: { listKey: list.path },
            ignoreBlocker: true,
          })
        },
      })
      await navigate({
        to: '/dashboard/$listKey/$id',
        params: { listKey: list.path, id: created.id },
        ignoreBlocker: true,
      })
    } catch (creationError) {
      const nextError = mutationErrorState(
        creationError,
        'Unable to create item',
      )
      setError(nextError)
      toast({
        title: `Could not create ${list.singular.toLowerCase()}`,
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
          { type: 'model', label: list.label, href: `/dashboard/${list.path}` },
          { type: 'page', label: 'Create' },
        ]}
        actions={
          <Button
            size="sm"
            className="text-xs sm:text-sm"
            onClick={onCreate}
            disabled={saving}
          >
            Create {list.singular}
            <Check className="ml-1 stroke-[1.5px]" width="8" height="8" />
          </Button>
        }
      />

      <main className="w-full max-w-5xl p-4 md:p-6">
        <div className="grid min-w-0 gap-6 gap-y-8 lg:grid-cols-[minmax(240px,2fr)_3fr]">
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div>
              <h1 className="text-lg font-semibold md:text-2xl">
                Create {list.singular}
              </h1>
              <p className="text-sm text-muted-foreground">
                Add a new {list.singular.toLowerCase()} to{' '}
                {list.label.toLowerCase()}
              </p>
              {hasChanges ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Unsaved changes
                </p>
              ) : null}
            </div>
            {sidebarGroups.length ? (
              <EnhancedFormFields
                list={list}
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
              list={list}
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
