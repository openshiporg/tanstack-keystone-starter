import { ChevronRight } from 'lucide-react'

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

/**
 * One section card. Loose (ungrouped) fields share a plain card; a named group gets its own
 * collapsible card with a field count.
 */
export function FieldSection({
  title,
  description,
  count,
  children,
}: {
  title?: string | null
  description?: string | null
  count?: number
  children: React.ReactNode
}) {
  if (!title)
    return (
      <section className="ks-card flex flex-col gap-5 p-4 md:p-5">
        {children}
      </section>
    )
  return (
    <section className="ks-card overflow-hidden" aria-label={title}>
      <details open className="group/fg">
        <summary className="flex cursor-pointer list-none items-start gap-2 px-4 py-3 outline-none group-open/fg:border-b group-open/fg:border-[var(--ks-line)] md:px-5 focus-visible:[&>span:first-child]:ring-2 focus-visible:[&>span:first-child]:ring-[var(--ks-focus)] [&::-webkit-details-marker]:hidden">
          <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-[4px] text-[var(--ks-label)] transition-transform group-open/fg:rotate-90">
            <ChevronRight className="size-3.5" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-[13px] leading-5 font-semibold text-[var(--ks-ink)]">
              {title}
            </h2>
            {description ? (
              <span className="text-[12px] leading-4 text-[var(--ks-dim)]">
                {description}
              </span>
            ) : null}
          </span>
          {count !== undefined ? (
            <span className="mt-0.5 ml-auto font-mono text-[12px] text-[var(--ks-label)]">
              {count}
            </span>
          ) : null}
        </summary>
        <div className="flex flex-col gap-5 p-4 md:p-5">{children}</div>
      </details>
    </section>
  )
}
