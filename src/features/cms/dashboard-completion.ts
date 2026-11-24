import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import { getOperationAccess } from './access'
import { cmsGraphQLSchema } from './graphql'
import {
  createDashboardAuthRequest,
  getDashboardAuthState,
} from './dashboard-auth'
import { createCmsContext } from './runtime'
import { getAdminMetaForContext } from './admin-meta'
import { handleMcpRequest } from './mcp'

export type DashboardAssistantAction = {
  tool: 'createData' | 'updateData' | 'deleteData'
  listKey: string
  operation: string
  arguments: Record<string, unknown>
  summary: string
  approvalNonce?: string
  approvalIssuedAt?: number
  approvalToken?: string
}

export type DashboardCompletionRequest = {
  prompt?: string
  messages?: Array<{ role?: string; content?: string }>
  action?: DashboardAssistantAction
  confirmed?: boolean
}

export type DashboardCompletionResult = {
  message: string
  invalidateDashboardQueries?: boolean
  pendingAction?: DashboardAssistantAction
}

function latestPrompt(input: DashboardCompletionRequest) {
  const directPrompt =
    typeof input.prompt === 'string' ? input.prompt.trim() : ''
  if (directPrompt) return directPrompt
  const lastMessage = [...(input.messages ?? [])]
    .reverse()
    .find(
      (message) =>
        typeof message.content === 'string' &&
        message.content.trim().length > 0,
    )
  return lastMessage?.content?.trim() ?? ''
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern))
}

const approvalKey = randomBytes(32)
const approvalLifetimeMs = 10 * 60 * 1000
const usedApprovalTokens = new Map<string, number>()

function unsignedAction(action: DashboardAssistantAction) {
  const { approvalToken: _, ...unsigned } = action
  return unsigned
}

function actionSignature(action: DashboardAssistantAction) {
  return createHmac('sha256', approvalKey)
    .update(JSON.stringify(unsignedAction(action)))
    .digest('base64url')
}

function issueApprovalToken(action: DashboardAssistantAction) {
  const issuedAction = {
    ...action,
    approvalNonce: crypto.randomUUID(),
    approvalIssuedAt: Date.now(),
  }
  return { ...issuedAction, approvalToken: actionSignature(issuedAction) }
}

function hasValidApprovalToken(action: DashboardAssistantAction) {
  if (
    typeof action.approvalToken !== 'string' ||
    typeof action.approvalNonce !== 'string' ||
    typeof action.approvalIssuedAt !== 'number' ||
    action.approvalIssuedAt > Date.now() + 60_000 ||
    Date.now() - action.approvalIssuedAt > approvalLifetimeMs ||
    usedApprovalTokens.has(action.approvalToken)
  )
    return false
  const actual = Buffer.from(action.approvalToken)
  const expected = Buffer.from(actionSignature(action))
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function consumeApprovalToken(action: DashboardAssistantAction) {
  if (!hasValidApprovalToken(action) || !action.approvalToken) return false
  const now = Date.now()
  for (const [token, expiresAt] of usedApprovalTokens) {
    if (expiresAt <= now) usedApprovalTokens.delete(token)
  }
  // Fail closed under abnormal approval volume rather than evicting a live
  // token and making it replayable within its validity window.
  if (usedApprovalTokens.size >= 10_000) return false
  usedApprovalTokens.set(
    action.approvalToken,
    (action.approvalIssuedAt ?? now) + approvalLifetimeMs,
  )
  return true
}

function parseJsonObject(value: string) {
  const parsed = JSON.parse(value) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('Mutation input must be a JSON object.')
  return parsed as Record<string, unknown>
}

async function proposalFromPrompt(
  prompt: string,
  lists: Awaited<ReturnType<typeof getAdminMetaForContext>>['lists'],
  context: Awaited<ReturnType<typeof createCmsContext>>,
): Promise<DashboardAssistantAction | null> {
  const match = prompt.match(
    /^\s*(create|update|delete)\s+([^\s]+)\s+([\s\S]+)$/i,
  )
  if (!match) return null
  const action = match[1].toLowerCase() as 'create' | 'update' | 'delete'
  const requestedList = match[2].toLowerCase()
  const list = lists.find((candidate) =>
    [
      candidate.key,
      candidate.path,
      candidate.label,
      candidate.singular,
      candidate.plural,
    ].some((value) => value.toLowerCase() === requestedList),
  )
  if (
    !list ||
    (action === 'create' && list.hideCreate) ||
    !(await getOperationAccess(list.key, action, context))
  )
    throw new Error(`Unknown or inaccessible list: ${match[2]}`)
  const payload = parseJsonObject(match[3])
  const sensitiveFields = new Set(
    list.fields
      .filter((field) => field.fieldMeta.kind === 'password')
      .map((field) => field.path),
  )
  const redactSummaryValue = (value: unknown, key?: string): unknown => {
    if (
      key &&
      (sensitiveFields.has(key) ||
        /(?:password|secret|token|credential|api[_-]?key)/i.test(key))
    )
      return '[redacted]'
    if (Array.isArray(value))
      return value.map((entry) => redactSummaryValue(entry))
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(
          ([entryKey, entry]) => [
            entryKey,
            redactSummaryValue(entry, entryKey),
          ],
        ),
      )
    return value
  }
  const summarize = (value: Record<string, unknown>) =>
    JSON.stringify(redactSummaryValue(value))
  const fields = Array.from(new Set(['id', list.labelField]))
  if (action === 'create') {
    return issueApprovalToken({
      tool: 'createData',
      listKey: list.key,
      operation: list.gqlNames.createMutationName,
      arguments: {
        operation: list.gqlNames.createMutationName,
        data: payload,
        fields,
      },
      summary: `Create one ${list.singular} with ${summarize(payload)}`,
    })
  }
  if (action === 'delete') {
    return issueApprovalToken({
      tool: 'deleteData',
      listKey: list.key,
      operation: list.gqlNames.deleteMutationName,
      arguments: {
        operation: list.gqlNames.deleteMutationName,
        where: payload,
        fields,
      },
      summary: `Delete one ${list.singular} matching ${summarize(payload)}`,
    })
  }
  const where = payload.where
  const data = payload.data
  if (
    !where ||
    typeof where !== 'object' ||
    Array.isArray(where) ||
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data)
  )
    throw new Error(
      'Update syntax requires a JSON object with "where" and "data" objects.',
    )
  return issueApprovalToken({
    tool: 'updateData',
    listKey: list.key,
    operation: list.gqlNames.updateMutationName,
    arguments: {
      operation: list.gqlNames.updateMutationName,
      where,
      data,
      fields,
    },
    summary: `Update one ${list.singular} matching ${summarize(where as Record<string, unknown>)} with ${summarize(data as Record<string, unknown>)}`,
  })
}

async function executeConfirmedAction(
  request: Request,
  action: DashboardAssistantAction,
) {
  const url = new URL('/api/mcp-transport/streamable-http', request.url)
  const headers = new Headers({ 'content-type': 'application/json' })
  const cookie = request.headers.get('cookie')
  const authorization = request.headers.get('authorization')
  if (cookie) headers.set('cookie', cookie)
  if (authorization) headers.set('authorization', authorization)
  headers.set('origin', new URL(request.url).origin)
  const response = await handleMcpRequest(
    new Request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tools/call',
        params: {
          name: action.tool,
          arguments: { ...action.arguments, confirmed: true },
        },
      }),
    }),
    'streamable-http',
  )
  const payload = (await response.json()) as {
    result?: {
      isError?: boolean
      content?: Array<{ text?: string }>
    }
    error?: { message?: string }
  }
  const text = payload.result?.content?.[0]?.text
  const result = text ? (JSON.parse(text) as Record<string, unknown>) : null
  if (!response.ok || payload.error || payload.result?.isError)
    throw new Error(
      typeof result?.message === 'string'
        ? result.message
        : payload.error?.message || 'The confirmed dashboard action failed.',
    )
  return result
}

export async function completeDashboardPrompt(
  request: Request,
  input: DashboardCompletionRequest,
): Promise<DashboardCompletionResult> {
  const prompt = latestPrompt(input)

  const authState = await getDashboardAuthState(request)
  if (!authState.authenticatedItem)
    throw new Error('You must be signed in to use the dashboard assistant.')
  if (!authState.authenticatedItem.isAccessAllowed)
    throw new Error('You do not have access to the dashboard assistant.')

  const cmsContext = await createCmsContext(
    createDashboardAuthRequest(request),
    cmsGraphQLSchema,
  )
  const adminMeta = await getAdminMetaForContext(cmsContext)
  const visibleLists = adminMeta.lists.filter((list) => !list.hideNavigation)
  const listSummary = visibleLists
    .map((list) => `${list.label} (${list.path})`)
    .join(', ')

  if (input.action) {
    if (!hasValidApprovalToken(input.action))
      throw new Error(
        'The proposed action changed, expired, or was already used. Request a new review before confirming.',
      )
    if (input.confirmed !== true)
      return {
        message: `Review required: ${input.action.summary}`,
        pendingAction: input.action,
      }
    if (!consumeApprovalToken(input.action))
      throw new Error(
        'The proposed action changed, expired, or was already used. Request a new review before confirming.',
      )
    const result = await executeConfirmedAction(request, input.action)
    const id = typeof result?.id === 'string' ? ` (${result.id})` : ''
    return {
      message: `${input.action.tool.replace('Data', '')} completed${id}.`,
      invalidateDashboardQueries: true,
    }
  }

  if (!prompt)
    return { message: 'Send a prompt to start the dashboard assistant.' }

  const normalizedPrompt = prompt.toLowerCase()

  if (
    includesAny(normalizedPrompt, [
      'who am i',
      'whoami',
      'signed in',
      'my role',
      'my account',
    ])
  ) {
    const sessionData = cmsContext.session?.data
    const displayName =
      (typeof sessionData?.name === 'string' && sessionData.name) ||
      (typeof sessionData?.email === 'string' && sessionData.email) ||
      cmsContext.session?.itemId ||
      'an authenticated item'
    const identity =
      typeof sessionData?.email === 'string' &&
      sessionData.email !== displayName
        ? ` (${sessionData.email})`
        : ''
    return {
      message: `You are signed in as ${displayName}${identity}. Dashboard access is enabled.`,
    }
  }

  if (
    includesAny(normalizedPrompt, [
      'list',
      'model',
      'collection',
      'available tables',
      'available lists',
    ])
  ) {
    return {
      message: visibleLists.length
        ? `The dashboard currently exposes these visible lists: ${listSummary}.`
        : 'No navigation-visible lists are currently available in the dashboard.',
    }
  }

  if (
    includesAny(normalizedPrompt, [
      'filter',
      'search',
      'sort',
      'column',
      'field selection',
      'page size',
    ])
  ) {
    const examples = visibleLists.slice(0, 3).map((list) => {
      const searchable = list.initialSearchFields.length
        ? list.initialSearchFields.join(', ')
        : 'id'
      const columns = list.initialColumns.length
        ? list.initialColumns.join(', ')
        : 'default visible columns'
      return `${list.label}: search ${searchable}; columns ${columns}`
    })

    return {
      message: examples.length
        ? `You can use the toolbar on each list page to search, filter, sort, and change visible columns. Examples — ${examples.join(' · ')}.`
        : 'List-toolbar guidance is available once there are navigation-visible lists in AdminMeta.',
    }
  }

  if (/^\s*(create|update|delete)\s+/i.test(prompt)) {
    const proposal = await proposalFromPrompt(prompt, visibleLists, cmsContext)
    if (!proposal)
      throw new Error(
        'Use: create <list> <data JSON>, update <list> {"where": {...}, "data": {...}}, or delete <list> <where JSON>.',
      )
    return {
      message: `Review this action before it runs: ${proposal.summary}`,
      pendingAction: proposal,
      invalidateDashboardQueries: false,
    }
  }

  return {
    message: visibleLists.length
      ? `I can see your dashboard context and available lists: ${listSummary}. I can help with navigation, and propose create/update/delete actions for explicit confirmation.`
      : 'I can see your authenticated dashboard context, but there are no navigation-visible lists available right now.',
  }
}
