import { memoryCmsAdapter } from './memory'
import type { CmsAdapter } from './types'

let selectedAdapter: CmsAdapter | undefined

function getConfiguredAdapterName() {
  const requested = process.env.CMS_ADAPTER
  if (requested === 'memory' || requested === 'prisma') return requested
  if (requested) {
    throw new Error(
      `Unsupported CMS_ADAPTER ${JSON.stringify(requested)}; expected "memory" or "prisma"`,
    )
  }
  if (process.env.DATABASE_URL) return 'prisma'
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CMS persistence is not configured: set DATABASE_URL or explicitly select CMS_ADAPTER',
    )
  }
  return 'memory'
}

export async function getCmsAdapter(): Promise<CmsAdapter> {
  if (selectedAdapter) return selectedAdapter

  const adapterName = getConfiguredAdapterName()
  if (adapterName === 'memory') {
    selectedAdapter = memoryCmsAdapter
    return selectedAdapter
  }

  const { createPrismaCmsAdapter } = await import('./prisma')
  selectedAdapter = createPrismaCmsAdapter()
  return selectedAdapter
}

export function setCmsAdapterForTests(adapter?: CmsAdapter) {
  selectedAdapter = adapter
}

export { memoryCmsAdapter, resetMemoryAdapter } from './memory'
export type {
  CmsAdapter,
  CmsContext,
  CmsItem,
  CmsListKey,
  CmsMemorySeed,
  CmsSession,
  CmsSessionStrategy,
  CmsTransactionOptions,
} from './types'
