import { GraphQLError } from 'graphql'

type TaggedError = { error: Error; tag: string }
type AccessReturnDetail = { tag: string; returned: string }

function debugPayload(things: TaggedError[]) {
  return things.map((thing) => ({
    stacktrace: thing.error.stack,
    message: thing.error.message,
  }))
}

function formatKeys(keys: string[]) {
  if (keys.length < 4) return keys.join(', ')
  return `${keys.slice(0, 3).join(', ')} and ${keys.length - 3} others...`
}

export const CMS_ERROR_CODES = {
  ACCESS_DENIED: 'KS_ACCESS_DENIED',
  ACCESS_RETURN_ERROR: 'KS_ACCESS_RETURN_ERROR',
  VALIDATION_FAILURE: 'KS_VALIDATION_FAILURE',
  RELATIONSHIP_ERROR: 'KS_RELATIONSHIP_ERROR',
  EXTENSION_ERROR: 'KS_EXTENSION_ERROR',
  RESOLVER_ERROR: 'KS_RESOLVER_ERROR',
  FILTER_DENIED: 'KS_FILTER_DENIED',
  NOT_FOUND: 'KS_NOT_FOUND',
  CONFIG_ERROR: 'KS_CONFIG_ERROR',
  GRAPHQL_ERROR: 'KS_GRAPHQL_ERROR',
} as const

export type CmsErrorCode =
  (typeof CMS_ERROR_CODES)[keyof typeof CMS_ERROR_CODES]

export function cmsGraphQLError(
  message: string,
  code: CmsErrorCode = CMS_ERROR_CODES.GRAPHQL_ERROR,
  details?: Record<string, unknown>,
) {
  return new GraphQLError(message, {
    extensions: {
      code,
      ...details,
    },
  })
}

export function accessDenied(
  message: string,
  details?: Record<string, unknown>,
) {
  const normalized = message.startsWith('Access denied: ')
    ? message
    : `Access denied: ${message}`
  return cmsGraphQLError(normalized, CMS_ERROR_CODES.ACCESS_DENIED, details)
}

export function accessReturnFailure(
  messageOrThings: string | AccessReturnDetail[],
  details?: Record<string, unknown>,
) {
  if (typeof messageOrThings === 'string') {
    return cmsGraphQLError(
      messageOrThings,
      CMS_ERROR_CODES.ACCESS_RETURN_ERROR,
      details,
    )
  }
  const bulletList = messageOrThings
    .map(
      (thing) =>
        `  - ${thing.tag}: Returned: ${thing.returned}. Expected: boolean.`,
    )
    .join('\n')
  return cmsGraphQLError(
    `Invalid values returned from access control function.\n${bulletList}`,
    CMS_ERROR_CODES.ACCESS_RETURN_ERROR,
    details,
  )
}

export function validationFailure(
  messageOrMessages: string | string[],
  details?: Record<string, unknown>,
) {
  if (typeof messageOrMessages === 'string') {
    return cmsGraphQLError(
      messageOrMessages,
      CMS_ERROR_CODES.VALIDATION_FAILURE,
      details,
    )
  }
  const bulletList = messageOrMessages
    .map((message) => `  - ${message}`)
    .join('\n')
  return cmsGraphQLError(
    `You provided invalid data for this operation.\n${bulletList}`,
    CMS_ERROR_CODES.VALIDATION_FAILURE,
    details,
  )
}

export function relationshipFailure(
  messageOrThings: string | TaggedError[],
  details?: Record<string, unknown>,
) {
  if (typeof messageOrThings === 'string') {
    return cmsGraphQLError(
      messageOrThings,
      CMS_ERROR_CODES.RELATIONSHIP_ERROR,
      details,
    )
  }
  const bulletList = messageOrThings
    .map((thing) => `  - ${thing.tag}: ${thing.error.message}`)
    .sort()
    .join('\n')
  return cmsGraphQLError(
    `An error occurred while resolving relationship fields.\n${bulletList}`,
    CMS_ERROR_CODES.RELATIONSHIP_ERROR,
    { ...details, debug: debugPayload(messageOrThings) },
  )
}

export function extensionFailure(
  messageOrThings: string | TaggedError[],
  detailsOrExtension?: Record<string, unknown> | string,
  maybeDetails?: Record<string, unknown>,
) {
  if (typeof messageOrThings === 'string') {
    return cmsGraphQLError(
      messageOrThings,
      CMS_ERROR_CODES.EXTENSION_ERROR,
      typeof detailsOrExtension === 'object'
        ? detailsOrExtension
        : maybeDetails,
    )
  }
  const extensionName =
    typeof detailsOrExtension === 'string' ? detailsOrExtension : 'extension'
  const details =
    typeof detailsOrExtension === 'object' ? detailsOrExtension : maybeDetails
  const bulletList = messageOrThings
    .map((thing) => `  - ${thing.tag}: ${thing.error.message}`)
    .join('\n')
  return cmsGraphQLError(
    `An error occurred while running "${extensionName}".\n${bulletList}`,
    CMS_ERROR_CODES.EXTENSION_ERROR,
    { ...details, debug: debugPayload(messageOrThings) },
  )
}

export function resolverFailure(
  things: TaggedError[],
  details?: Record<string, unknown>,
) {
  const bulletList = things
    .map((thing) => `  - ${thing.tag}: ${thing.error.message}`)
    .join('\n')
  return cmsGraphQLError(
    `An error occurred while resolving input fields.\n${bulletList}`,
    CMS_ERROR_CODES.RESOLVER_ERROR,
    { ...details, debug: debugPayload(things) },
  )
}

export function filterDenied(
  messageOrArgs:
    | string
    | { operation: 'filter' | 'orderBy'; fieldKeys: string[] },
  details?: Record<string, unknown>,
) {
  if (typeof messageOrArgs === 'string') {
    return cmsGraphQLError(
      messageOrArgs,
      CMS_ERROR_CODES.FILTER_DENIED,
      details,
    )
  }
  return cmsGraphQLError(
    `Access denied: You cannot ${messageOrArgs.operation} by ${formatKeys(messageOrArgs.fieldKeys)}`,
    CMS_ERROR_CODES.FILTER_DENIED,
    details,
  )
}

export function notFoundFailure(
  message: string,
  details?: Record<string, unknown>,
) {
  return cmsGraphQLError(message, CMS_ERROR_CODES.NOT_FOUND, details)
}

export function configFailure(
  message: string,
  details?: Record<string, unknown>,
) {
  return cmsGraphQLError(message, CMS_ERROR_CODES.CONFIG_ERROR, details)
}
