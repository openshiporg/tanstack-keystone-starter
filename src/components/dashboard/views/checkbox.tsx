import type { DashboardField } from '@/features/cms/graphql-client'

import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

export function Field({
  field,
  value,
  onChange,
}: {
  field: DashboardField
  value: unknown
  onChange?: (value: unknown) => void
}) {
  if (!onChange)
    return (
      <Badge variant={value === true ? 'secondary' : 'outline'}>
        {value === true ? 'Yes' : 'No'}
      </Badge>
    )

  return (
    <div className="flex h-8 items-center gap-2">
      <Checkbox
        id={`field-${field.path}`}
        aria-label={field.label}
        checked={value === true}
        onCheckedChange={(checked) => onChange(checked === true)}
      />
      <Label
        htmlFor={`field-${field.path}`}
        className="text-[13px] text-[var(--ks-dim)]"
      >
        {field.label}
      </Label>
    </div>
  )
}

export function Cell({
  field,
  item,
}: {
  field: DashboardField
  item: Record<string, unknown>
}) {
  const value = item[field.path]
  return (
    <Badge variant={value === true ? 'secondary' : 'outline'}>
      {value === true ? 'Yes' : 'No'}
    </Badge>
  )
}

export function controller(config: {
  path: string
  label: string
  description?: string | null
  fieldMeta: Record<string, unknown>
}) {
  return {
    path: config.path,
    label: config.label,
    description: config.description,
    graphqlSelection:
      typeof config.fieldMeta.graphqlSelection === 'string'
        ? config.fieldMeta.graphqlSelection
        : config.path,
    defaultValue: false,
    deserialize: (item: Record<string, unknown>) => item[config.path] === true,
    serialize: (value: unknown) => ({ [config.path]: value === true }),
    validate: () => true,
  }
}

export const allowedExportsOnCustomViews = ['Cell', 'CardValue']
