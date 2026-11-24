import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toaster'
import {
  dashboardQueryKeys,
  executeRawDashboardGraphQL,
} from '@/features/cms/graphql-client'
import type { DashboardList } from '@/features/cms/graphql-client'

import { enhanceFields } from './enhance-fields'
import { graphQLErrorState } from './graphql-error-details'

const BULK_KINDS = new Set([
  'text',
  'select',
  'integer',
  'float',
  'decimal',
  'bigInt',
  'checkbox',
  'timestamp',
  'calendarDay',
  'multiselect',
  'relationship',
])

/** Fields that can be set to one value across many items: simple, editable, visible on the item page. */
export function bulkEditableFields(list: DashboardList) {
  return list.fields.filter((field) => {
    if (field.path === 'id' || !BULK_KINDS.has(field.kind)) return false
    const mode = field.itemView.fieldMode
    if (mode === 'hidden' || mode === 'read') return false
    if (
      field.kind === 'relationship' &&
      ['count', 'cards'].includes(String(field.fieldMeta.displayMode ?? ''))
    )
      return false
    return true
  })
}

/**
 * Set one field to the same value on every selected item. The value comes from the field's own
 * view and controller (same Field component and serialize() as the item page) and is written with
 * the generated updateMany mutation, so access control and hooks run per item.
 */
export function BulkEditDialog({
  list,
  ids,
  open,
  onOpenChange,
  onDone,
}: {
  list: DashboardList
  ids: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const editable = useMemo(
    () => enhanceFields(bulkEditableFields(list), list.key),
    [list],
  )
  const [fieldPath, setFieldPath] = useState('')
  const [value, setValue] = useState<unknown>(undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const field = fieldPath ? editable[fieldPath] : undefined
  const data = useMemo(() => {
    if (!field || value === undefined) return null
    try {
      const serialized = field.controller.serialize(value)
      return Object.keys(serialized).length ? serialized : null
    } catch {
      return null
    }
  }, [field, value])

  function reset() {
    setFieldPath('')
    setValue(undefined)
    setError(null)
  }

  function pick(path: string) {
    setFieldPath(path)
    setError(null)
    setValue(path ? editable[path]?.controller.defaultValue : undefined)
  }

  async function apply() {
    if (!field || !data) return
    setSaving(true)
    setError(null)
    try {
      const mutationName = list.gqlNames.updateManyMutationName
      const result = await executeRawDashboardGraphQL<
        Record<string, Array<{ id: string } | null> | null>
      >(
        `mutation DashboardBulkUpdate($data: [${list.gqlNames.updateManyInputName}!]!) { ${mutationName}(data: $data) { id } }`,
        { data: ids.map((id) => ({ where: { id }, data })) },
      )
      const updated = (result.data?.[mutationName] ?? []).filter(Boolean).length
      if (updated > 0)
        await queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === dashboardQueryKeys.adminMeta[0],
        })
      if (result.errors?.length) {
        const state = graphQLErrorState(result.errors, {
          fallbackMessage: 'Unable to update the selected items.',
        })
        setError(
          updated > 0
            ? `${updated} of ${ids.length} updated. ${state.message}`
            : state.message,
        )
        return
      }
      toast({
        title: `Updated ${ids.length} ${(ids.length === 1 ? list.singular : list.plural).toLowerCase()}`,
        description: `${field.label} was set on every selected item.`,
      })
      reset()
      onOpenChange(false)
      onDone()
    } catch (applyError) {
      setError(
        applyError instanceof Error
          ? applyError.message
          : 'Unable to update the selected items.',
      )
    } finally {
      setSaving(false)
    }
  }

  const FieldView = field?.views.Field
  const noun = (ids.length === 1 ? list.singular : list.plural).toLowerCase()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Edit {ids.length} {noun}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Set one field on every selected item
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-edit-field">Field</Label>
            <select
              id="bulk-edit-field"
              className="ks-field h-8 w-full px-2 text-[13px]"
              value={fieldPath}
              onChange={(event) => pick(event.target.value)}
            >
              <option value="">Choose a field</option>
              {Object.entries(editable).map(([path, entry]) => (
                <option key={path} value={path}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>

          {field && FieldView ? (
            <div
              key={fieldPath}
              className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto pb-1"
            >
              <Label htmlFor={`field-${field.path}`}>{field.label}</Label>
              <FieldView
                field={field}
                value={value}
                view="itemView"
                isRequired={false}
                forceValidation={false}
                onChange={setValue}
              />
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-[10px] bg-[color-mix(in_oklab,var(--ks-red)_10%,transparent)] px-3 py-2.5 text-[13px] break-words whitespace-pre-line text-[var(--ks-danger)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--ks-red)_25%,transparent)]"
            >
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!data || saving}
            onClick={() => void apply()}
          >
            {saving ? 'Saving' : `Apply to ${ids.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
