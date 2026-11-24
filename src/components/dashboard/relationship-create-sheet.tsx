import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toaster'
import { useModalBackgroundInert } from '@/components/ui/modal-background-inert'
import {
  dashboardQueryKeys,
  executeDashboardGraphQL,
} from '@/features/cms/graphql-client'
import type {
  DashboardList,
  DashboardRelationshipOption,
} from '@/features/cms/graphql-client'

export function RelationshipCreateSheet({
  list,
  open,
  onOpenChange,
  onCreated,
  fieldPaths,
}: {
  list: DashboardList
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (item: DashboardRelationshipOption) => void
  fieldPaths?: string[]
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [state, setState] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showValidation, setShowValidation] = useState(false)
  useModalBackgroundInert(open)

  const enhancedFields = useMemo(
    () => enhanceFields(list.fields, list.key),
    [list.fields, list.key],
  )
  const allowedPaths = useMemo(
    () => new Set(fieldPaths?.filter(Boolean) ?? []),
    [fieldPaths],
  )
  const formFields = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(enhancedFields).filter(
          ([, field]) =>
            field.path !== 'id' &&
            (allowedPaths.size === 0 || allowedPaths.has(field.path)),
        ),
      ),
    [allowedPaths, enhancedFields],
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

  useEffect(() => {
    if (!open) return
    setState(initialState)
    setError(null)
    setShowValidation(false)
  }, [initialState, open])

  function requestClose() {
    if (saving) return
    if (
      hasChanges &&
      !window.confirm(
        'There are unsaved changes, are you sure you want to leave?',
      )
    )
      return
    onOpenChange(false)
  }

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      setShowValidation(true)
      if (invalidFields.size > 0)
        throw new Error(
          `Please resolve the highlighted field errors before creating this ${list.singular.toLowerCase()}.`,
        )

      const mutationName = list.gqlNames.createMutationName
      const labelField = list.fields.some(
        (field) => field.path === list.labelField,
      )
        ? list.labelField
        : 'id'
      const result = await executeDashboardGraphQL<
        Record<string, { id: string; label?: unknown }>
      >(
        `mutation RelationshipCreateItem($data: ${list.gqlNames.createInputName}!) { ${mutationName}(data: $data) { id label: ${labelField} } }`,
        {
          data: serializeValueToOperationItem(
            'create',
            formFields,
            state,
            initialState,
          ),
        },
      )
      const created = result[mutationName]
      if (!created.id)
        throw new Error('Create succeeded but no item id was returned.')

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.overview,
        }),
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === 'dashboard' &&
            query.queryKey[1] === 'relationshipOptions' &&
            query.queryKey[2] === list.path,
        }),
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === 'dashboard' &&
            query.queryKey[1] === 'relationshipOptionsByIds' &&
            query.queryKey[2] === list.path,
        }),
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === 'dashboard' &&
            query.queryKey[1] === 'listPage' &&
            query.queryKey[2] === list.path,
        }),
      ])

      onCreated({ id: created.id, label: String(created.label ?? created.id) })
      toast({
        title: `${list.singular} created`,
        description: 'The new related item has been selected.',
      })
      onOpenChange(false)
    } catch (creationError) {
      const message =
        creationError instanceof Error
          ? creationError.message
          : `Unable to create ${list.singular.toLowerCase()}.`
      setError(message)
      toast({
        title: `Could not create ${list.singular.toLowerCase()}`,
        description: message,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) =>
        nextOpen ? onOpenChange(true) : requestClose()
      }
      disablePointerDismissal
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl"
        showCloseButton={!saving}
      >
        <SheetHeader>
          <SheetTitle>Create related {list.singular}</SheetTitle>
          <SheetDescription>
            Add a new {list.singular.toLowerCase()} without leaving this form.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault()
            void handleCreate()
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <div className="grid gap-6 gap-y-8 lg:grid-cols-[minmax(220px,2fr)_3fr]">
              <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
                <div>
                  <h2 className="text-lg font-semibold">
                    Create {list.singular}
                  </h2>
                  <p className="text-[13px] text-[var(--ks-dim)]">
                    Fill out the related item details below.
                  </p>
                  {hasChanges ? (
                    <p className="text-[12px] text-[var(--ks-amber)]">
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
                    invalidFields={showValidation ? invalidFields : undefined}
                    onChange={setState}
                  />
                ) : null}
              </aside>
              <div className="space-y-6">
                {error ? (
                  <div
                    className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-[12px] text-[var(--ks-danger)]"
                    role="alert"
                    aria-live="assertive"
                  >
                    {error}
                  </div>
                ) : null}
                <EnhancedFormFields
                  list={list}
                  fields={formFields}
                  values={state}
                  serialized={serialized}
                  view="createView"
                  region="form"
                  invalidFields={showValidation ? invalidFields : undefined}
                  onChange={setState}
                />
              </div>
            </div>
          </div>

          <SheetFooter className="relative z-10 shrink-0 border-t border-[var(--ks-line)] bg-[var(--ks-surface)]">
            <div className="flex justify-end"><div className="ks-track">
              <button
                type="button"
                className="ks-pill h-7 px-2.5 text-[12px]"
                onClick={requestClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                data-variant="primary"
                className="ks-pill h-7 px-2.5 text-[12px]"
                disabled={saving}
              >
                {saving ? 'Creating…' : `Create ${list.singular}`}
              </button>
            </div></div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
