import { adminMeta } from './admin-meta'
import type { AdminMetaList } from './types'

export type CmsFieldWithKind = AdminMetaList['fields'][number] & {
  kind: string
}

export type CmsListWithCount = Omit<AdminMetaList, 'fields'> & {
  count: number
  description: string
  fields: CmsFieldWithKind[]
}

export const cmsAdminMeta = {
  lists: adminMeta.lists.map((list) => ({
    ...list,
    description: list.description ?? '',
    count: 0,
    fields: list.fields.map((field) => ({
      ...field,
      kind: String(field.fieldMeta.kind),
    })),
  })) satisfies CmsListWithCount[],
}

export const migrationMilestones = [
  {
    title: 'Shell',
    status: 'in progress',
    description:
      'TanStack Start routes, Base UI primitives, app chrome, and dashboard navigation.',
  },
  {
    title: 'CMS contracts',
    status: 'next',
    description:
      'Portable list, field, view, and GraphQL operation metadata independent of Next.js.',
  },
  {
    title: 'Keystone runtime',
    status: 'planned',
    description:
      'Run Keystone beside TanStack Start through a decoupled server adapter/API boundary.',
  },
  {
    title: 'CRUD screens',
    status: 'planned',
    description:
      'List, item, create, auth, reset, init, and relationship workflows rebuilt in route files.',
  },
]
