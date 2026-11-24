import { createFileRoute } from '@tanstack/react-router'

import { getStorageConfig, storedUploadResponse } from '@/features/cms/storage'

export const Route = createFileRoute('/api/cms/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const formData = await request.formData()
        const storageValue = formData.get('storage')
        const storageKey = typeof storageValue === 'string' ? storageValue : ''
        const file = formData.get('file')
        if (storageKey.length === 0)
          return Response.json(
            { error: 'Missing storage key.' },
            { status: 400 },
          )
        if (!getStorageConfig(storageKey))
          return Response.json(
            { error: `Unknown storage ${storageKey}.` },
            { status: 400 },
          )
        if (!(file instanceof File))
          return Response.json({ error: 'Missing file.' }, { status: 400 })

        try {
          const metadata = await storedUploadResponse(storageKey, file)
          return Response.json({ data: metadata })
        } catch (error) {
          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Unable to store uploaded file.',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
