import { Link } from '@tanstack/react-router'
import { ArrowUpRightIcon, PlusIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { DashboardListSummary } from '@/features/cms/graphql-client'

export function ListCard({ list }: { list: DashboardListSummary }) {
  const visibleFields = list.fields.filter(
    (field) => field.listView.fieldMode !== 'hidden',
  )

  return (
    <Card className="bg-gradient-to-br from-card to-muted/50 transition-colors hover:bg-muted/60">
      <CardHeader>
        <CardTitle>{list.label}</CardTitle>
        <CardDescription>{list.description}</CardDescription>
        <CardAction className="flex items-center gap-1">
          {!list.hideCreate && !list.isSingleton ? (
            <Link
              to="/dashboard/$listKey/create"
              params={{ listKey: list.path }}
              className={buttonVariants({
                variant: 'outline',
                size: 'icon-sm',
              })}
              title={`Create ${list.singular}`}
            >
              <PlusIcon />
              <span className="sr-only">Create {list.singular}</span>
            </Link>
          ) : null}
          <Link
            to="/dashboard/$listKey"
            params={{ listKey: list.path }}
            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
          >
            <ArrowUpRightIcon />
            <span className="sr-only">Open {list.label}</span>
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{list.count} items</Badge>
          <Badge variant="outline">{visibleFields.length} fields</Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {list.initialColumns.map((column) => (
            <span
              key={column}
              className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground"
            >
              {column}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
