import { AlertTriangleIcon, DatabaseIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  DashboardField,
  DashboardListPageData,
} from '@/features/cms/graphql-client'

export function ListPreviewTable({
  data,
  isLoading = false,
  error,
}: {
  data?: DashboardListPageData
  isLoading?: boolean
  error?: Error | null
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 rounded-xl border bg-card p-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <AlertTriangleIcon className="mt-0.5 size-4 text-destructive" />
        <div>
          <div className="font-medium text-destructive">
            Could not load list records
          </div>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  if (data.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-8 text-center">
        <DatabaseIcon className="size-8 text-muted-foreground" />
        <div className="font-medium">
          No {data.list.label.toLowerCase()} found
        </div>
        <p className="max-w-md text-sm text-muted-foreground">
          The GraphQL read path is working, but this list does not currently
          have matching records.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {data.selectedFields.map((field) => (
              <TableHead key={field.path}>{field.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((item) => (
            <TableRow key={item.id}>
              {data.selectedFields.map((field, index) => (
                <TableCell
                  key={field.path}
                  className={index === 0 ? 'font-medium' : undefined}
                >
                  <FieldValue field={field} value={item[field.path]} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function FieldValue({
  field,
  value,
}: {
  field: DashboardField
  value: unknown
}) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">—</span>
  }

  if (field.kind === 'checkbox') {
    const checked = value === true
    return (
      <Badge variant={checked ? 'secondary' : 'outline'}>
        {checked ? 'Yes' : 'No'}
      </Badge>
    )
  }

  if (field.kind === 'multiselect' && Array.isArray(value)) {
    if (value.length === 0)
      return <span className="text-muted-foreground">—</span>

    return (
      <div className="flex flex-wrap gap-1">
        {value.map((entry) => (
          <Badge key={String(entry)} variant="outline">
            {String(entry)}
          </Badge>
        ))}
      </div>
    )
  }

  if (field.kind === 'relationship') {
    if (Array.isArray(value)) {
      if (value.length === 0)
        return <span className="text-muted-foreground">—</span>

      return (
        <div className="flex flex-wrap gap-1">
          {value.slice(0, 3).map((entry) => (
            <Badge key={relationshipKey(entry)} variant="outline">
              {relationshipLabel(entry)}
            </Badge>
          ))}
          {value.length > 3 ? (
            <Badge variant="secondary">+{value.length - 3}</Badge>
          ) : null}
        </div>
      )
    }

    return <span>{relationshipLabel(value)}</span>
  }

  if (field.kind === 'password' && typeof value === 'object') {
    return (
      <Badge variant="outline">
        {(value as { isSet?: boolean }).isSet ? 'Set' : 'Not set'}
      </Badge>
    )
  }

  if (typeof value === 'object') {
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
        {JSON.stringify(value)}
      </code>
    )
  }

  return <span>{String(value)}</span>
}

function relationshipKey(value: unknown) {
  if (value && typeof value === 'object' && 'id' in value)
    return String(value.id)
  return String(value)
}

function relationshipLabel(value: unknown) {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.label ?? record.name ?? record.id ?? 'Related item')
  }

  return String(value)
}
