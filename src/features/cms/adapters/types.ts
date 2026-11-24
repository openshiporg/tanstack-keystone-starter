import type { DocumentNode, ExecutionResult, GraphQLSchema } from 'graphql'

import type { CmsMutationState } from '../mutation-state'
import type { CmsStorageConfig } from '../storage-config'
import type { CmsField, CmsList } from '../types'

export type CmsListKey = string
export type CmsItem = Record<string, unknown> & { id: string }
export type CmsMemorySeed = Record<string, CmsItem[]>

export type CmsSession<
  TData extends Record<string, unknown> = Record<string, unknown>,
> = {
  itemId: string
  listKey: string
  data: TData
}

export type CmsSessionStrategy<TSessionData = unknown> = {
  get: (args: {
    context: CmsContext
  }) => Promise<TSessionData | undefined> | TSessionData | undefined
  start: (args: {
    data: TSessionData
    context: CmsContext
  }) => Promise<string | undefined> | string | undefined
  end: (args: { context: CmsContext }) => Promise<void> | void
}

export type CmsWhereUnique = Record<string, unknown> & {
  id?: string | number | null
}

export type CmsContextDbRootValue = Record<string, unknown>

export type CmsContextListDbApi = {
  findOne: (
    args?: { where?: CmsWhereUnique },
    rootValue?: CmsContextDbRootValue,
  ) => Promise<CmsItem | null>
  findMany: (
    args?: Omit<FindManyArgs, 'context'>,
    rootValue?: CmsContextDbRootValue,
  ) => Promise<CmsItem[]>
  count: (
    args?: { where?: unknown },
    rootValue?: CmsContextDbRootValue,
  ) => Promise<number>
  createOne: (
    args: { data: Record<string, unknown> },
    rootValue?: CmsContextDbRootValue,
  ) => Promise<CmsItem>
  createMany: (
    args: { data: Record<string, unknown>[] },
    rootValue?: CmsContextDbRootValue,
  ) => Promise<CmsItem[]>
  updateOne: (
    args: { where: CmsWhereUnique; data: Record<string, unknown> },
    rootValue?: CmsContextDbRootValue,
  ) => Promise<CmsItem | null>
  updateMany: (
    args: {
      data: Array<{ where: CmsWhereUnique; data: Record<string, unknown> }>
    },
    rootValue?: CmsContextDbRootValue,
  ) => Promise<Array<CmsItem | null>>
  deleteOne: (
    args: { where: CmsWhereUnique },
    rootValue?: CmsContextDbRootValue,
  ) => Promise<CmsItem | null>
  deleteMany: (
    args: { where: CmsWhereUnique[] },
    rootValue?: CmsContextDbRootValue,
  ) => Promise<Array<CmsItem | null>>
}

export type CmsContextListQueryApi = {
  findOne: (args?: {
    where?: CmsWhereUnique
    query?: string
  }) => Promise<unknown>
  findMany: (
    args?: Omit<FindManyArgs, 'context'> & { query?: string },
  ) => Promise<unknown>
  count: (args?: { where?: unknown }) => Promise<number>
  createOne: (args: {
    data: Record<string, unknown>
    query?: string
  }) => Promise<unknown>
  createMany: (args: {
    data: Record<string, unknown>[]
    query?: string
  }) => Promise<unknown>
  updateOne: (args: {
    where: CmsWhereUnique
    data: Record<string, unknown>
    query?: string
  }) => Promise<unknown>
  updateMany: (args: {
    data: Array<{ where: CmsWhereUnique; data: Record<string, unknown> }>
    query?: string
  }) => Promise<unknown>
  deleteOne: (args: {
    where: CmsWhereUnique
    query?: string
  }) => Promise<unknown>
  deleteMany: (args: {
    where: CmsWhereUnique[]
    query?: string
  }) => Promise<unknown>
}

export type CmsGraphQLApi = {
  schema: GraphQLSchema
  raw: (args: {
    query: string | DocumentNode
    variables?: Record<string, unknown>
  }) => Promise<ExecutionResult>
  run: (args: {
    query: string | DocumentNode
    variables?: Record<string, unknown>
  }) => Promise<Record<string, unknown>>
}

export type CmsTransactionOptions = {
  maxWait?: number
  timeout?: number
  isolationLevel?:
    | 'ReadUncommitted'
    | 'ReadCommitted'
    | 'RepeatableRead'
    | 'Snapshot'
    | 'Serializable'
    | { Serializable: 'Serializable' }
}

export type CmsContext = {
  adapter: CmsAdapter
  db: Record<string, CmsContextListDbApi>
  query: Record<string, CmsContextListQueryApi>
  prisma: unknown | null
  graphql: CmsGraphQLApi
  session?: CmsSession
  sessionStrategy?: CmsSessionStrategy<{
    itemId: string
    listKey?: string
  }>
  transaction: <T>(
    fn: (context: CmsContext) => Promise<T>,
    options?: CmsTransactionOptions,
  ) => Promise<T>
  __internal: {
    sudo: boolean
    internal: boolean
    lists?: CmsList[]
    storage?: Record<string, CmsStorageConfig>
    request?: Request
    responseHeaders?: Headers
    mutationState?: CmsMutationState
    deferAfterOperation?: boolean
  }
  internal: () => CmsContext
  sudo: () => CmsContext
  withRequest: (
    request: Request,
    responseHeaders?: Headers,
  ) => Promise<CmsContext>
  withSession: (session?: CmsSession) => CmsContext
}

export type FindManyArgs = {
  where?: unknown
  orderBy?: unknown
  take?: number
  skip?: number
  cursor?: { id?: string | number | null } | null
  context: CmsContext
}

export type CreateArgs = {
  data: Record<string, unknown>
  context: CmsContext
}

export type UpdateArgs = {
  where: CmsWhereUnique
  data: Record<string, unknown>
  context: CmsContext
}

export interface CmsAdapter {
  readonly kind: 'memory' | 'prisma'
  readonly prisma?: unknown | null
  findUnique: (
    listKey: CmsListKey,
    where: CmsWhereUnique,
    context?: CmsContext,
  ) => Promise<CmsItem | null>
  findMany: (listKey: CmsListKey, args: FindManyArgs) => Promise<CmsItem[]>
  count: (
    listKey: CmsListKey,
    args: Omit<FindManyArgs, 'take' | 'skip' | 'cursor' | 'orderBy'>,
  ) => Promise<number>
  create: (listKey: CmsListKey, args: CreateArgs) => Promise<CmsItem>
  update: (listKey: CmsListKey, args: UpdateArgs) => Promise<CmsItem | null>
  delete: (
    listKey: CmsListKey,
    where: CmsWhereUnique,
    context: CmsContext,
  ) => Promise<CmsItem | null>
  resolveRelationship: (
    listKey: CmsListKey,
    item: CmsItem,
    field: CmsField,
    context: CmsContext,
    args?: {
      where?: unknown
      orderBy?: unknown
      take?: number
      skip?: number
      cursor?: { id?: string | number | null } | null
    },
  ) => Promise<CmsItem[]>
  transaction: <T>(
    fn: (adapter: CmsAdapter) => Promise<T>,
    options?: CmsTransactionOptions,
  ) => Promise<T>
}
