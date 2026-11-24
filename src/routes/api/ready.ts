import { createFileRoute } from '@tanstack/react-router'

import { cmsReadinessResponse } from '@/features/cms/health'

export const Route = createFileRoute('/api/ready')({
  server: {
    handlers: {
      GET: ({ request }) => cmsReadinessResponse(request),
    },
  },
})
