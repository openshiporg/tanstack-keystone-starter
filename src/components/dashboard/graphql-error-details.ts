import type { DashboardGraphQLError } from '@/features/cms/graphql-client'

type ErrorDetailOptions = {
  fallbackMessage: string
}

export type DashboardMutationErrorState = {
  message: string
  details: string | null
  fieldPaths?: string[]
}

export function summarizeGraphQLErrors(
  errors: DashboardGraphQLError[] | undefined,
  options: ErrorDetailOptions,
) {
  if (!errors?.length) return options.fallbackMessage
  return errors.map((error) => error.message).join('\n')
}

export function formatGraphQLErrorDetails(
  errors: DashboardGraphQLError[] | undefined,
) {
  if (!errors?.length) return null
  return errors
    .map((error) => {
      const path = error.path?.length ? ` (${error.path.join(' → ')})` : ''
      return `${error.message}${path}`
    })
    .join('\n')
}

export function graphQLErrorFieldPaths(
  errors: DashboardGraphQLError[] | undefined,
) {
  if (!errors?.length) return []
  const fieldPaths = new Set<string>()

  for (const error of errors) {
    const extensionFieldPath =
      typeof error.extensions?.fieldPath === 'string'
        ? error.extensions.fieldPath
        : undefined
    if (extensionFieldPath) fieldPaths.add(extensionFieldPath)

    const messageMatch = /\b[A-Z][A-Za-z0-9_]*\.([A-Za-z0-9_]+)\b/.exec(
      error.message,
    )
    if (messageMatch?.[1]) fieldPaths.add(messageMatch[1])
  }

  return Array.from(fieldPaths)
}

export function graphQLErrorState(
  errors: DashboardGraphQLError[] | undefined,
  options: ErrorDetailOptions,
): DashboardMutationErrorState {
  return {
    message: summarizeGraphQLErrors(errors, options),
    details: formatGraphQLErrorDetails(errors),
    fieldPaths: graphQLErrorFieldPaths(errors),
  }
}

export function mutationErrorState(
  error: unknown,
  fallbackMessage: string,
): DashboardMutationErrorState {
  return {
    message: error instanceof Error ? error.message : fallbackMessage,
    details: null,
    fieldPaths: [],
  }
}
