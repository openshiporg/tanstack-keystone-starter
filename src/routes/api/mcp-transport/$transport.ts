import { createFileRoute } from '@tanstack/react-router'

import { handleMcpRequest } from '@/features/cms/mcp'

export function handleMcpTransportRouteRequest(
  request: Request,
  transport: string,
) {
  return handleMcpRequest(request, transport)
}

export const Route = createFileRoute('/api/mcp-transport/$transport')({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleMcpTransportRouteRequest(request, params.transport),
    },
  },
})
