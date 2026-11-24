import {
  GraphQLError,
  GraphQLScalarType,
  Kind,
  valueFromASTUntyped,
} from 'graphql'
import GraphQLUpload from 'graphql-upload/GraphQLUpload.js'
import { Decimal as DecimalValue } from 'decimal.js'
import { bindGraphQLSchemaAPIToContext } from '@graphql-ts/schema'
import * as schemaWithContext from '@graphql-ts/schema/api-with-context'
import * as schemaWithoutContext from '@graphql-ts/schema/api-without-context'
import { extend, wrap } from '@graphql-ts/extend'

import {
  config as cmsConfig,
  group as cmsGroup,
  list as cmsList,
} from '../config'
import type { CmsFieldConfig } from '../fields'
import type {
  CmsConfig,
  CmsListConfig,
  FieldGroupConfig,
  KeystoneFieldGroupConfig,
} from '../config'
import type { GraphQLSchema } from 'graphql'

export type KeystoneConfig = CmsConfig
export type KeystoneListConfig = CmsListConfig

function identityScalar(
  name: string,
  options: {
    description?: string
    specifiedByURL?: string
    validate?: (value: unknown) => void
  } = {},
) {
  return schemaWithoutContext.scalar(
    new GraphQLScalarType({
      name,
      description: options.description,
      specifiedByURL: options.specifiedByURL,
      serialize(value) {
        options.validate?.(value)
        return value
      },
      parseValue(value) {
        options.validate?.(value)
        return value
      },
      parseLiteral(value) {
        const parsed = valueFromASTUntyped(value)
        options.validate?.(parsed)
        return parsed
      },
    }),
  )
}

const jsonScalar = identityScalar('JSON', {
  description:
    'The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf).',
  specifiedByURL:
    'http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf',
})

const uploadScalar = schemaWithoutContext.scalar(GraphQLUpload)

const decimalScalar = schemaWithoutContext.scalar(
  new GraphQLScalarType({
    name: 'Decimal',
    serialize(value) {
      if (!DecimalValue.isDecimal(value))
        throw new GraphQLError(
          `unexpected value provided to Decimal scalar: ${value}`,
        )
      const decimal = value as DecimalValue & { scaleToPrint?: number }
      return decimal.scaleToPrint === undefined
        ? decimal.toString()
        : decimal.toFixed(decimal.scaleToPrint)
    },
    parseValue(value) {
      if (DecimalValue.isDecimal(value)) {
        if (!value.isFinite())
          throw new GraphQLError('Decimal values must be finite')
        return value
      }
      if (typeof value !== 'string')
        throw new GraphQLError('Decimal only accepts values as strings')
      const decimal = new DecimalValue(value)
      if (!decimal.isFinite())
        throw new GraphQLError('Decimal values must be finite')
      return decimal
    },
    parseLiteral(value) {
      if (value.kind !== Kind.STRING)
        throw new GraphQLError('Decimal only accepts values as strings')
      const decimal = new DecimalValue(value.value)
      if (!decimal.isFinite())
        throw new GraphQLError('Decimal values must be finite')
      return decimal
    },
  }),
)

const bigIntScalar = schemaWithoutContext.scalar(
  new GraphQLScalarType({
    name: 'BigInt',
    serialize(value) {
      if (typeof value !== 'bigint')
        throw new GraphQLError(
          `unexpected value provided to BigInt scalar: ${value}`,
        )
      return value.toString()
    },
    parseValue(value) {
      if (typeof value === 'bigint') return value
      if (typeof value !== 'string')
        throw new GraphQLError('BigInt only accepts values as strings')
      return globalThis.BigInt(value)
    },
    parseLiteral(value) {
      if (value.kind !== Kind.STRING)
        throw new GraphQLError('BigInt only accepts values as strings')
      return globalThis.BigInt(value.value)
    },
  }),
)

const dateTimePattern =
  /^(\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]|60))(\.\d{1,})?(([Z])|([+|-]([01][0-9]|2[0-3]):[0-5][0-9]))$/

function parseDateTime(value: unknown) {
  if (value instanceof Date) return value
  if (typeof value !== 'string' || !dateTimePattern.test(value))
    throw new GraphQLError(
      'DateTime scalars must be in the form of a full ISO 8601 date-time string',
    )
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf()))
    throw new GraphQLError(
      'DateTime scalars must be in the form of a full ISO 8601 date-time string',
    )
  return parsed
}

const dateTimeScalar = schemaWithoutContext.scalar(
  new GraphQLScalarType({
    name: 'DateTime',
    specifiedByURL: 'https://datatracker.ietf.org/doc/html/rfc3339#section-5.6',
    serialize(value) {
      if (!(value instanceof Date) || Number.isNaN(value.valueOf()))
        throw new GraphQLError(
          `unexpected value provided to DateTime scalar: ${value}`,
        )
      return value.toISOString()
    },
    parseValue: parseDateTime,
    parseLiteral(value) {
      if (value.kind !== Kind.STRING)
        throw new GraphQLError('DateTime only accepts values as strings')
      return parseDateTime(value.value)
    },
  }),
)

const calendarDayPattern = /^\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])$/
function parseCalendarDay(value: unknown) {
  if (typeof value !== 'string')
    throw new GraphQLError('CalendarDay only accepts values as strings')
  if (!calendarDayPattern.test(value))
    throw new GraphQLError(
      'CalendarDay scalars must be in the form of a full-date ISO 8601 string',
    )
  return value
}

const calendarDayScalar = schemaWithoutContext.scalar(
  new GraphQLScalarType({
    name: 'CalendarDay',
    specifiedByURL: 'https://datatracker.ietf.org/doc/html/rfc3339#section-5.6',
    serialize(value) {
      if (typeof value !== 'string')
        throw new GraphQLError(
          `unexpected value provided to CalendarDay scalar: ${value}`,
        )
      return value
    },
    parseValue: parseCalendarDay,
    parseLiteral(value) {
      if (value.kind !== Kind.STRING)
        throw new GraphQLError('CalendarDay only accepts values as strings')
      return parseCalendarDay(value.value)
    },
  }),
)

const emptyScalar = schemaWithoutContext.scalar(
  new GraphQLScalarType({
    name: 'Empty',
    serialize() {
      return null
    },
    parseValue() {
      return {}
    },
    parseLiteral() {
      return {}
    },
  }),
)

/**
 * Source-portable Core 6.5.1 GraphQL construction surface. The underlying
 * GraphQL-TS versions are pinned to the same releases used by that Core build.
 */
function bindNamedScalarsToBaseSchema(schema: GraphQLSchema) {
  const wrapped = {
    JSON: jsonScalar,
    Upload: uploadScalar,
    Decimal: decimalScalar,
    BigInt: bigIntScalar,
    DateTime: dateTimeScalar,
    CalendarDay: calendarDayScalar,
    Empty: emptyScalar,
  }
  for (const name of Object.keys(wrapped) as Array<keyof typeof wrapped>) {
    const existing = schema.getType(name)
    if (existing instanceof GraphQLScalarType)
      wrapped[name] = wrap.scalar(existing) as (typeof wrapped)[typeof name]
  }
  return wrapped
}

type GraphQLTsType = {
  kind: string
  graphQLType: { name?: string }
  of?: GraphQLTsType
}

function rebindTypeToSchema(
  type: GraphQLTsType,
  schema: GraphQLSchema,
): GraphQLTsType {
  if (type.kind === 'scalar') {
    const existing = type.graphQLType.name
      ? schema.getType(type.graphQLType.name)
      : undefined
    return existing instanceof GraphQLScalarType
      ? (wrap.scalar(existing) as GraphQLTsType)
      : type
  }
  if (type.kind === 'list')
    return schemaWithoutContext.list(
      rebindTypeToSchema(type.of as GraphQLTsType, schema) as never,
    ) as GraphQLTsType
  if (type.kind === 'non-null')
    return schemaWithoutContext.nonNull(
      rebindTypeToSchema(type.of as GraphQLTsType, schema) as never,
    ) as GraphQLTsType
  return type
}

function rebindExtensionFields(value: unknown, schema: GraphQLSchema): unknown {
  if (Array.isArray(value))
    return value.map((entry) => rebindExtensionFields(entry, schema))
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  if (
    record.type &&
    typeof record.type === 'object' &&
    'kind' in record.type &&
    'graphQLType' in record.type
  ) {
    return {
      ...record,
      type: rebindTypeToSchema(record.type as GraphQLTsType, schema),
    }
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [
      key,
      rebindExtensionFields(entry, schema),
    ]),
  )
}

function extendCmsSchema(
  extension: Parameters<typeof extend>[0],
): (schema: GraphQLSchema) => GraphQLSchema {
  return (schema) => {
    const scalars = bindNamedScalarsToBaseSchema(schema)
    if (typeof extension !== 'function')
      return extend(rebindExtensionFields(extension, schema) as never)(schema)
    return extend(
      (baseSchema) =>
        rebindExtensionFields(
          extension(
            Object.assign(Object.create(baseSchema), baseSchema, scalars),
          ),
          schema,
        ) as never,
    )(schema)
  }
}

export const graphql = {
  ...schemaWithoutContext,
  ...schemaWithContext,
  bindGraphQLSchemaAPIToContext,
  extend: extendCmsSchema,
  wrap,
  JSON: jsonScalar,
  Upload: uploadScalar,
  Decimal: decimalScalar,
  BigInt: bigIntScalar,
  DateTime: dateTimeScalar,
  CalendarDay: calendarDayScalar,
  Empty: emptyScalar,
}

export function config(configInput: CmsConfig) {
  return cmsConfig(configInput)
}

export function list(listConfig: CmsListConfig) {
  return cmsList(listConfig)
}

export function group(groupConfig: FieldGroupConfig): FieldGroupConfig
export function group(
  groupConfig: KeystoneFieldGroupConfig,
): Record<string, CmsFieldConfig>
export function group(
  groupConfig: FieldGroupConfig | KeystoneFieldGroupConfig,
) {
  if (Array.isArray(groupConfig.fields))
    return cmsGroup(groupConfig as FieldGroupConfig)
  return cmsGroup(groupConfig as KeystoneFieldGroupConfig)
}
