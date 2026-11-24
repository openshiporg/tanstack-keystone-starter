import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../../generated/prisma/client'

export { PrismaClient }

export type CmsPrismaProvider = 'postgresql' | 'sqlite' | 'mysql'

type PrismaClientLike = { $disconnect: () => Promise<void> }
type PrismaClientConstructor<TClient extends PrismaClientLike> = new (options: {
  adapter: never
}) => TClient

export type CreateCmsPrismaClientOptions<
  TClient extends PrismaClientLike = PrismaClient,
> = {
  url?: string
  provider?: CmsPrismaProvider
  Client?: PrismaClientConstructor<TClient>
}

function inferProvider(url: string): CmsPrismaProvider {
  if (url === ':memory:' || url.startsWith('file:')) return 'sqlite'
  if (/^(mysql|mariadb):\/\//i.test(url)) return 'mysql'
  if (/^(postgres|postgresql):\/\//i.test(url)) return 'postgresql'
  throw new Error(
    'Unable to infer Prisma provider from DATABASE_URL; pass provider explicitly',
  )
}

export function createCmsPrismaDriverAdapter(options: {
  url: string
  provider?: CmsPrismaProvider
}) {
  const provider = options.provider ?? inferProvider(options.url)
  if (provider === 'sqlite')
    return new PrismaBetterSqlite3({ url: options.url })
  if (provider === 'mysql') return new PrismaMariaDb(options.url)
  return new PrismaPg(options.url)
}

export function createCmsPrismaClient<
  TClient extends PrismaClientLike = PrismaClient,
>(options: CreateCmsPrismaClientOptions<TClient> = {}): TClient {
  const connectionString = options.url ?? process.env.DATABASE_URL
  if (!connectionString)
    throw new Error('DATABASE_URL is required to create the Prisma CMS client')
  const Client = (options.Client ??
    PrismaClient) as PrismaClientConstructor<TClient>
  return new Client({
    adapter: createCmsPrismaDriverAdapter({
      url: connectionString,
      provider: options.provider,
    }) as never,
  })
}
