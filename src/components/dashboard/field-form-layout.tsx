import type {
  DashboardField,
  DashboardList,
} from '@/features/cms/graphql-client'

export function partitionFieldsByPosition<TField extends DashboardField>(
  fields: TField[],
  mode: 'createView' | 'itemView',
) {
  const form: TField[] = []
  const sidebar: TField[] = []
  for (const field of fields) {
    const view = field[mode]
    if (view.fieldMode === 'hidden') continue
    if (view.fieldPosition === 'sidebar') sidebar.push(field)
    else form.push(field)
  }
  return { form, sidebar }
}

export function groupFields<TField extends DashboardField>(
  list: DashboardList,
  fields: TField[],
) {
  const remaining = new Map(fields.map((field) => [field.path, field]))
  const sections: Array<{
    key: string
    label: string
    description?: string | null
    fields: TField[]
  }> = []

  for (const group of list.groups) {
    const groupFieldsForSection = group.fields
      .map((entry) => remaining.get(entry.path))
      .filter((field): field is TField => Boolean(field))
    if (!groupFieldsForSection.length) continue
    for (const field of groupFieldsForSection) remaining.delete(field.path)
    sections.push({
      key: group.label,
      label: group.label,
      description: group.description,
      fields: groupFieldsForSection,
    })
  }

  const ungrouped = Array.from(remaining.values())
  if (ungrouped.length)
    sections.push({ key: '__ungrouped', label: 'Fields', fields: ungrouped })
  return sections
}

export function FieldSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string | null
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border bg-background p-4 shadow-xs">
      <div className="mb-4">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
