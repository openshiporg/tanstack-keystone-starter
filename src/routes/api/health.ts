import { createFileRoute } from '@tanstack/react-router'

import { cmsLivenessResponse } from '@/features/cms/health'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: () => cmsLivenessResponse(),
    },
  },
})
