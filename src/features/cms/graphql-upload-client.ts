type Variables = Record<string, unknown> | undefined

type FileReference = {
  path: string
  file: File
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function collectGraphQLFiles(
  value: unknown,
  currentPath = 'variables',
): FileReference[] {
  if (value instanceof File) return [{ path: currentPath, file: value }]
  if (Array.isArray(value))
    return value.flatMap((entry, index) =>
      collectGraphQLFiles(entry, `${currentPath}.${index}`),
    )
  if (!isPlainObject(value)) return []
  return Object.entries(value).flatMap(([key, entry]) =>
    collectGraphQLFiles(entry, `${currentPath}.${key}`),
  )
}

function replaceFilesWithNull(value: unknown): unknown {
  if (value instanceof File) return null
  if (Array.isArray(value)) return value.map(replaceFilesWithNull)
  if (!isPlainObject(value)) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      replaceFilesWithNull(entry),
    ]),
  )
}

export function createGraphQLMultipartRequestPayload(
  query: string,
  variables?: Variables,
) {
  const fileReferences = collectGraphQLFiles(variables)
  const operations = {
    query,
    variables: replaceFilesWithNull(variables ?? {}),
  }
  const map = Object.fromEntries(
    fileReferences.map((entry, index) => [String(index), [entry.path]]),
  )
  return { operations, map, fileReferences }
}

export function buildGraphQLMultipartFormData(
  query: string,
  variables?: Variables,
) {
  const { operations, map, fileReferences } =
    createGraphQLMultipartRequestPayload(query, variables)
  const formData = new FormData()
  formData.set('operations', JSON.stringify(operations))
  formData.set('map', JSON.stringify(map))
  fileReferences.forEach((entry, index) => {
    formData.set(String(index), entry.file)
  })
  return formData
}

export function hasGraphQLFileUpload(variables?: Variables) {
  return collectGraphQLFiles(variables).length > 0
}
