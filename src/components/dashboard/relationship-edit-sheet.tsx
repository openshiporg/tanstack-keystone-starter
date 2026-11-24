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

export function RelationshipEditSheet({
  list,
  item,
  open,
  onOpenChange,
  onSaved,
  fieldPaths,
}: {
  list: DashboardList
  item: { id: string; label?: string }
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (item: DashboardRelationshipOption) => void
  fieldPaths?: string[]
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [state, setState] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showValidation, setShowValidation] = useState(false)
  const [loadedItem, setLoadedItem] = useState<Record<string, unknown> | null>(
    null,
  )
  useModalBackgroundInert(open)

  const enhancedFields = useMemo(
    () => enhanceFields(list.fields, list.key),
    [list.fields, list.key],
  )
  const allowedPaths = useMemo(
    () => new Set(fieldPaths?.filter(Boolean) ?? []),
    [fieldPaths],
  )
  const allVisibleFields = useMemo(
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
  const currentDraft = useMemo(() => {
    const itemRecord = loadedItem ?? {}
    return Object.fromEntries(
      Object.entries(allVisibleFields).map(([fieldPath, field]) => [
        fieldPath,
        field.controller.deserialize(itemRecord),
      ]),
    )
  }, [allVisibleFields, loadedItem])
  const serialized = useMemo(
    () =>
      serializeValueToOperationItem(
        'update',
        allVisibleFields,
        state,
        currentDraft,
      ),
    [allVisibleFields, currentDraft, state],
  )
  const invalidFields = useMemo(
    () => invalidFieldsForValues(allVisibleFields, state, 'itemView'),
    [allVisibleFields, state],
  )
  const hasChanges = useMemo(
    () =>
      Object.keys(state).length > 0 &&
      hasFormChanges('update', allVisibleFields, state, currentDraft),
    [allVisibleFields, currentDraft, state],
  )
  const { sidebarGroups } = useMemo(
    () =>
      getEnhancedFieldGroups(list, Object.values(allVisibleFields), 'itemView'),
    [allVisibleFields, list],
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const fieldSelections = Array.from(
      new Set([
        'id',
        list.labelField,
        ...Object.values(allVisibleFields).map(
          (field) => field.controller.graphqlSelection,
        ),
      ]),
    ).join('\n')

    setError(null)
    setShowValidation(false)
    setLoadedItem(null)
    void executeDashboardGraphQL<{ item: Record<string, unknown> | null }>(
      `query RelationshipEditItem($where: ${list.gqlNames.whereUniqueInputName}!) { item: ${list.gqlNames.itemQueryName}(where: $where) { ${fieldSelections} } }`,
      { where: { id: item.id } },
    )
      .then((result) => {
        if (cancelled) return
        if (!result.item) throw new Error('Related item not found.')
        setLoadedItem(result.item)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load related item.',
        )
      })

    return () => {
      cancelled = true
    }
  }, [
    allVisibleFields,
    item.id,
    list.gqlNames.itemQueryName,
    list.gqlNames.whereUniqueInputName,
    list.labelField,
    open,
  ])

  useEffect(() => {
    if (!open || !loadedItem) return
    setState(currentDraft)
  }, [currentDraft, loadedItem, open])

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

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      setShowValidation(true)
      if (invalidFields.size > 0)
        throw new Error(
          `Please resolve the highlighted field errors before saving this ${list.singular.toLowerCase()}.`,
        )

      const mutationName = list.gqlNames.updateMutationName
      const labelField = list.fields.some(
        (field) => field.path === list.labelField,
      )
        ? list.labelField
        : 'id'
      const result = await executeDashboardGraphQL<
        Record<string, { id: string; label?: unknown } | null>
      >(
        `mutation RelationshipEditItem($where: ${list.gqlNames.whereUniqueInputName}!, $data: ${list.gqlNames.updateInputName}!) { ${mutationName}(where: $where, data: $data) { id label: ${labelField} } }`,
        {
          where: { id: item.id },
          data: serializeValueToOperationItem(
            'update',
            allVisibleFields,
            state,
            currentDraft,
          ),
        },
      )
      const updated = result[mutationName]
      if (!updated?.id) throw new Error('Update returned no item.')

      await Promise.all([
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
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.itemPage(list.path, item.id),
        }),
      ])

      onSaved({ id: updated.id, label: String(updated.label ?? updated.id) })
      toast({
        title: `${list.singular} updated`,
        description: 'The related item was updated successfully.',
      })
      onOpenChange(false)
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : `Unable to save ${list.singular.toLowerCase()}.`
      setError(message)
      toast({
        title: `Could not save ${list.singular.toLowerCase()}`,
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
          <SheetTitle>Edit related {list.singular}</SheetTitle>
          <SheetDescription>
            Update this related {list.singular.toLowerCase()} without leaving
            the current form.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSave()
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {!loadedItem && !error ? (
              <div
                className="rounded-[10px] bg-[var(--ks-track)] shadow-[inset_0_0_0_1px_var(--ks-line)] p-4 text-[13px] text-[var(--ks-dim)]"
                role="status"
                aria-live="polite"
              >
                Loading related item…
              </div>
            ) : null}
            {error ? (
              <div
                className="rounded-[10px] bg-[color-mix(in_oklab,var(--ks-red)_10%,transparent)] px-3 py-2.5 text-[13px] text-[var(--ks-danger)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--ks-red)_25%,transparent)]"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </div>
            ) : null}
            {loadedItem ? (
              <div className="grid gap-6 gap-y-8 lg:grid-cols-[minmax(220px,2fr)_3fr]">
                <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {item.label ?? item.id}
                    </h2>
                    <p className="text-[13px] text-[var(--ks-dim)]">
                      Edit the related item fields below.
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
                      fields={allVisibleFields}
                      values={state}
                      serialized={serialized}
                      view="itemView"
                      region="sidebar"
                      invalidFields={showValidation ? invalidFields : undefined}
                      onChange={setState}
                    />
                  ) : null}
                </aside>
                <div className="space-y-6">
                  <EnhancedFormFields
                    list={list}
                    fields={allVisibleFields}
                    values={state}
                    serialized={serialized}
                    view="itemView"
                    region="form"
                    invalidFields={showValidation ? invalidFields : undefined}
                    onChange={setState}
                  />
                </div>
              </div>
            ) : null}
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
                disabled={saving || !loadedItem}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div></div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
