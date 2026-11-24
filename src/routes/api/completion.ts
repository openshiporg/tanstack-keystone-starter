import { createFileRoute } from '@tanstack/react-router'

import { completeDashboardPrompt } from '@/features/cms/dashboard-completion'
import type { DashboardCompletionRequest } from '@/features/cms/dashboard-completion'

export async function handleCompletionRequest(request: Request) {
  try {
    const body = (await request
      .json()
      .catch(() => ({}))) as DashboardCompletionRequest
    const data = await completeDashboardPrompt(request, body)
    return Response.json({ data })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to complete dashboard request.'
    const status =
      message.includes('signed in') || message.includes('access') ? 403 : 500
    return Response.json({ error: message }, { status })
  }
}

export const Route = createFileRoute('/api/completion')({
  server: {
    handlers: {
      POST: ({ request }) => handleCompletionRequest(request),
    },
  },
})
