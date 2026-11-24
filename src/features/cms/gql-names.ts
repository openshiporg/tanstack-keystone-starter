import type { GraphQLNames } from './types'

const irregularPlurals: Record<string, string> = {
  Person: 'People',
}

export function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z]+)/g, '$1 $2')
    .split(/\s|_|-/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function pluralizeLabel(value: string) {
  if (irregularPlurals[value]) return irregularPlurals[value]
  if (/[^aeiou]y$/i.test(value)) return `${value.slice(0, -1)}ies`
  if (value.endsWith('s')) return `${value}es`
  return `${value}s`
}

export function labelToPath(value: string) {
  return value.split(' ').join('-').toLowerCase()
}

export function labelToClass(value: string) {
  return value.replace(/\s+/g, '')
}

export function getGqlNames({
  listKey,
  pluralGraphQLName,
}: {
  listKey: string
  pluralGraphQLName: string
}): GraphQLNames {
  const lowerPluralName =
    pluralGraphQLName.charAt(0).toLowerCase() + pluralGraphQLName.slice(1)
  const lowerSingularName = listKey.charAt(0).toLowerCase() + listKey.slice(1)

  return {
    outputTypeName: listKey,
    whereInputName: `${listKey}WhereInput`,
    whereUniqueInputName: `${listKey}WhereUniqueInput`,
    createInputName: `${listKey}CreateInput`,
    createMutationName: `create${listKey}`,
    createManyMutationName: `create${pluralGraphQLName}`,
    relateToOneForCreateInputName: `${listKey}RelateToOneForCreateInput`,
    relateToManyForCreateInputName: `${listKey}RelateToManyForCreateInput`,
    itemQueryName: lowerSingularName,
    listQueryName: lowerPluralName,
    listQueryCountName: `${lowerPluralName}Count`,
    listOrderName: `${listKey}OrderByInput`,
    updateInputName: `${listKey}UpdateInput`,
    updateMutationName: `update${listKey}`,
    updateManyInputName: `${listKey}UpdateArgs`,
    updateManyMutationName: `update${pluralGraphQLName}`,
    relateToOneForUpdateInputName: `${listKey}RelateToOneForUpdateInput`,
    relateToManyForUpdateInputName: `${listKey}RelateToManyForUpdateInput`,
    deleteMutationName: `delete${listKey}`,
    deleteManyMutationName: `delete${pluralGraphQLName}`,
  }
}

export function getGraphQLNames(listKey: string, pluralLabel?: string) {
  const computedSingular = humanize(listKey)
  const computedPlural = pluralLabel ?? pluralizeLabel(computedSingular)
  const pluralGraphQLName = labelToClass(computedPlural)

  return getGqlNames({ listKey, pluralGraphQLName })
}
