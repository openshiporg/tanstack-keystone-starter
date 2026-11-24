import { createElement } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { sanitizeUrl } from '@braintree/sanitize-url'

import type { StructureGraphQLType } from '../structure'
import { graphql } from './core'

function isValidUrl(value: string) {
  const sanitized = sanitizeUrl(value)
  return value === sanitized || value === encodeURI(sanitized)
}

const emptyInput = () => null

function formField<T>(options: {
  defaultValue: T
  validate: (value: unknown) => boolean
  input: StructureGraphQLType
  output?: { type: StructureGraphQLType; resolve?: unknown }
  fieldOptions?: unknown
}) {
  return {
    kind: 'form' as const,
    Input: emptyInput,
    options: options.fieldOptions,
    defaultValue: options.defaultValue,
    validate: options.validate,
    graphql: {
      input: options.input,
      output:
        options.output ??
        ({ type: options.input } as {
          type: StructureGraphQLType
          resolve?: (source: { value: T }) => T
        }),
    },
  }
}

export const fields = {
  text({ defaultValue = '' }: { label: string; defaultValue?: string }) {
    return formField({
      defaultValue,
      validate: (value) => typeof value === 'string',
      input: graphql.String,
    })
  },
  integer({ defaultValue = 0 }: { label: string; defaultValue?: number }) {
    return formField({
      defaultValue,
      validate: (value) => typeof value === 'number' && Number.isFinite(value),
      input: graphql.Int,
    })
  },
  url({ defaultValue = '' }: { label: string; defaultValue?: string }) {
    return formField({
      defaultValue,
      validate: (value) =>
        typeof value === 'string' && (value === '' || isValidUrl(value)),
      input: graphql.String,
    })
  },
  select<
    TOption extends {
      label: string
      value: string
    },
  >({
    options,
    defaultValue,
  }: {
    label: string
    options: readonly TOption[]
    defaultValue: TOption['value']
  }) {
    const values = new Set(options.map((option) => option.value))
    if (!values.has(defaultValue))
      throw new Error(
        `A defaultValue of ${defaultValue} was provided to a select field but it does not match the value of one of the options provided`,
      )
    return formField({
      defaultValue,
      validate: (value) => typeof value === 'string' && values.has(value),
      input: graphql.String,
      fieldOptions: options,
      output: {
        type: graphql.String,
        resolve: ({ value }: { value: string }) => value,
      },
    })
  },
  multiselect<
    TOption extends {
      label: string
      value: string
    },
  >({
    options,
    defaultValue,
  }: {
    label: string
    options: readonly TOption[]
    defaultValue: readonly TOption['value'][]
  }) {
    const values = new Set(options.map((option) => option.value))
    const type = graphql.list(graphql.nonNull(graphql.String))
    return formField({
      defaultValue,
      validate: (value) =>
        Array.isArray(value) &&
        value.every((entry) => typeof entry === 'string' && values.has(entry)),
      input: type,
      fieldOptions: options,
      output: {
        type,
        resolve: ({ value }: { value: readonly string[] }) => value,
      },
    })
  },
  checkbox({
    defaultValue = false,
  }: {
    label: string
    defaultValue?: boolean
  }) {
    return formField({
      defaultValue,
      validate: (value) => typeof value === 'boolean',
      input: graphql.Boolean,
    })
  },
  empty() {
    return {
      kind: 'form' as const,
      Input: emptyInput,
      options: undefined,
      defaultValue: null,
      validate: (value: unknown) => value === null || value === undefined,
    }
  },
  child(options: Record<string, unknown>) {
    const formatting =
      options.formatting === 'inherit'
        ? options.kind === 'block'
          ? {
              blockTypes: 'inherit',
              headingLevels: 'inherit',
              inlineMarks: 'inherit',
              listTypes: 'inherit',
              alignment: 'inherit',
              softBreaks: 'inherit',
            }
          : { inlineMarks: 'inherit', softBreaks: 'inherit' }
        : options.formatting
    return {
      kind: 'child' as const,
      options:
        options.kind === 'block'
          ? {
              kind: 'block',
              placeholder: options.placeholder,
              dividers: options.dividers,
              formatting,
              links: options.links,
              relationships: options.relationships,
            }
          : {
              kind: 'inline',
              placeholder: options.placeholder,
              formatting,
              links: options.links,
              relationships: options.relationships,
            },
    }
  },
  object<TFields extends Record<string, unknown>>(objectFields: TFields) {
    return { kind: 'object' as const, fields: objectFields }
  },
  conditional<
    TDiscriminant extends { validate: (value: unknown) => boolean },
    TValues extends Record<string, unknown>,
  >(discriminant: TDiscriminant, values: TValues) {
    if (
      (discriminant.validate('true') || discriminant.validate('false')) &&
      (discriminant.validate(true) || discriminant.validate(false))
    )
      throw new Error(
        'The discriminant of a conditional field only supports string values, or boolean values, not both.',
      )
    return { kind: 'conditional' as const, discriminant, values }
  },
  relationship<TMany extends boolean | undefined = false>({
    listKey,
    selection,
    label,
    many,
  }: {
    listKey: string
    selection?: string
    label: string
    many?: TMany
  }) {
    return {
      kind: 'relationship' as const,
      listKey,
      selection,
      label,
      many: many === true,
    }
  },
  array<TElement>(
    element: TElement,
    options?: { itemLabel?: (props: unknown) => string; label?: string },
  ) {
    return {
      kind: 'array' as const,
      element,
      itemLabel: options?.itemLabel,
      label: options?.label,
    }
  },
}

export function component<T>(options: T): T {
  return options
}

export function NotEditable({
  children,
  style,
  ...props
}: ComponentProps<'span'> & { children?: ReactNode }) {
  return createElement(
    'span',
    {
      ...props,
      contentEditable: false,
      style: { userSelect: 'none', ...style },
    },
    children,
  )
}
