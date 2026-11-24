import { useQuery } from '@tanstack/react-query'
import {
  Link,
  createFileRoute,
  notFound,
  redirect,
} from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

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
import { Button, buttonVariants } from '@/components/ui/button'
import { useToast } from '@/components/ui/toaster'
import {
  dashboardQueryKeys,
  executeRawDashboardGraphQL,
  fetchDashboardCreatePage,
  fetchKeystoneAdminMeta,
  findDashboardListByPath,
} from '@/features/cms/graphql-client'
import { cn } from '@/lib/utils'

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

  // Cmd/Ctrl+S creates
  const createRef = useRef<() => void>(() => {})
  createRef.current = () => {
    if (!saving) void onCreate()
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        createRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const hasSidebar = sidebarGroups.length > 0

  return (
    <>
      <PageBreadcrumbs
        items={[
          { type: 'link', label: 'Overview', href: '/dashboard' },
          { type: 'model', label: list.label, href: `/dashboard/${list.path}` },
          { type: 'page', label: `New ${list.singular.toLowerCase()}` },
        ]}
        actions={
          <div className="ks-track">
            <Link
              to="/dashboard/$listKey"
              params={{ listKey: list.path }}
              aria-label="Cancel"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'max-sm:w-7 max-sm:px-0',
              )}
            >
              <X />
              <span className="max-sm:hidden">Cancel</span>
            </Link>
            <Button
              size="sm"
              onClick={() => void onCreate()}
              disabled={saving}
              title="Create (⌘S)"
            >
              {saving ? 'Creating' : 'Create'}
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
        <div className="mb-5 flex min-w-0 items-center gap-2.5">
          <span className="ks-dot" data-tone="gray" aria-hidden="true" />
          <h1 className="min-w-0 truncate text-[18px] leading-7 font-semibold tracking-[-0.01em] text-[var(--ks-ink)] md:text-[20px]">
            New {list.singular.toLowerCase()}
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
            hasSidebar
              ? 'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]'
              : undefined
          }
        >
          <div className="min-w-0">
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
          {hasSidebar ? (
            <aside className="min-w-0 lg:sticky lg:top-16 lg:self-start">
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
            </aside>
          ) : null}
        </div>
      </div>
    </>
  )
}
