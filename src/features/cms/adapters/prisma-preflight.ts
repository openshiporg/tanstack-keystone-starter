import type { CmsList } from '../types'

export type PrismaDelegatePreflightIssue = {
  listKey: string
  delegateName: string
  reason: string
}

type PrismaLike = Record<string, unknown>

const REQUIRED_DELEGATE_METHODS = [
  'findUnique',
  'findFirst',
  'findMany',
  'count',
  'create',
  'update',
  'delete',
] as const

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function prismaDelegateNameForList(listKey: string) {
  if (!listKey) return listKey
  return `${listKey.charAt(0).toLowerCase()}${listKey.slice(1)}`
}

export function isPrismaCmsDelegate(value: unknown) {
  const delegate = asRecord(value)
  return REQUIRED_DELEGATE_METHODS.every(
    (method) => typeof delegate[method] === 'function',
  )
}

export function findMissingPrismaDelegates(
  prisma: PrismaLike,
  lists: CmsList[],
): PrismaDelegatePreflightIssue[] {
  return lists.flatMap((list) => {
    const delegateName = prismaDelegateNameForList(list.key)
    const delegate = prisma[delegateName]
    if (!delegate)
      return [
        { listKey: list.key, delegateName, reason: 'delegate is missing' },
      ]
    if (!isPrismaCmsDelegate(delegate))
      return [
        {
          listKey: list.key,
          delegateName,
          reason: `delegate is missing one or more required methods: ${REQUIRED_DELEGATE_METHODS.join(', ')}`,
        },
      ]
    return []
  })
}

export function formatPrismaDelegatePreflightError(
  issues: PrismaDelegatePreflightIssue[],
) {
  return [
    `Prisma adapter preflight failed: ${issues.length} initialized CMS list${issues.length === 1 ? '' : 's'} do${issues.length === 1 ? 'es' : ''} not have a matching Prisma Client delegate.`,
    ...issues.map(
      (issue) =>
        `- ${issue.listKey} -> prisma.${issue.delegateName}: ${issue.reason}`,
    ),
    'Run npm run cms:generate, promote .cms/schema.prisma to prisma/schema.prisma, then run npm run db:generate/db:push before serving with CMS_ADAPTER=prisma.',
  ].join('\n')
}

export function assertPrismaDelegatesForLists(
  prisma: PrismaLike,
  lists: CmsList[],
) {
  const issues = findMissingPrismaDelegates(prisma, lists)
  if (issues.length > 0)
    throw new Error(formatPrismaDelegatePreflightError(issues))
}
