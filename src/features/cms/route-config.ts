import { BoxesIcon, HomeIcon } from 'lucide-react'

import { adminMeta } from './admin-meta'

export const dashboardNavItems = [
  {
    title: 'Overview',
    to: '/dashboard',
    icon: HomeIcon,
    description: 'Migration status and CMS health',
  },
  ...adminMeta.lists.map((list) => ({
    title: list.label,
    to: `/dashboard/${list.path}`,
    icon: BoxesIcon,
    description: list.description ?? '',
  })),
]
