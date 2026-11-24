import type { DashboardField } from '@/features/cms/graphql-client'

import { getFieldViews } from './views/registry'

export type EnhancedDashboardField = DashboardField & {
  views: {
    Field: (props: {
      field: DashboardField
      value: unknown
      onChange?: (value: unknown) => void
      forceValidation?: boolean
      isRequired?: boolean
      view?: 'createView' | 'itemView'
    }) => React.ReactNode
    [key: string]: unknown
  }
  graphql: { isNonNull: string[] }
  controller: {
    path: string
    label: string
    description?: string | null
    graphqlSelection: string
    defaultValue: unknown
    deserialize: (data: Record<string, unknown>) => unknown
    serialize: (value: unknown) => Record<string, unknown>
    validate: (value: unknown, opts: { isRequired: boolean }) => boolean
    filter?: {
      types: Record<
        string,
        { label: string; initialValue: unknown; needsValue?: boolean }
      >
      Filter: (props: {
        value: unknown
        onChange: (value: unknown) => void
        type: string
        field?: EnhancedDashboardField
        context?: 'add' | 'edit'
        autoFocus?: boolean
      }) => React.ReactNode
      Label: (props: { label: string; type: string; value: unknown }) => string
    }
  }
}

const expectedExports = new Set(['Field', 'controller'])

export function enhanceFields(fields: DashboardField[], listKey: string) {
  const enhancedFields: Record<string, EnhancedDashboardField> = {}

  for (const field of fields) {
    if (typeof field.viewsIndex !== 'number') continue
    const baseViews = getFieldViews(field.viewsIndex, field) as Record<
      string,
      unknown
    >

    for (const exportName of expectedExports) {
      if (baseViews[exportName] === undefined)
        throw new Error(
          `The view for the field at ${listKey}.${field.path} is missing the ${exportName} export`,
        )
    }

    const views = { ...baseViews }
    const customViews: Record<string, unknown> = {}

    if (typeof field.customViewsIndex === 'number') {
      const customViewsSource = getFieldViews(
        field.customViewsIndex,
        field,
      ) as Record<string, unknown>
      const allowedExportsOnCustomViews = new Set(
        (views.allowedExportsOnCustomViews as string[] | undefined) ?? [],
      )
      for (const exportName in customViewsSource) {
        if (allowedExportsOnCustomViews.has(exportName))
          customViews[exportName] = customViewsSource[exportName]
        else if (expectedExports.has(exportName))
          views[exportName] = customViewsSource[exportName]
      }
    }

    const controllerFactory = views.controller
    if (typeof controllerFactory !== 'function')
      throw new Error(
        `The view for the field at ${listKey}.${field.path} has an invalid controller export`,
      )

    enhancedFields[field.path] = {
      ...field,
      createView: {
        fieldMode: field.createView.fieldMode,
        fieldPosition: field.createView.fieldPosition,
        isRequired: field.createView.isRequired ?? false,
      },
      itemView: {
        fieldMode: field.itemView.fieldMode,
        fieldPosition: field.itemView.fieldPosition,
        isRequired: field.itemView.isRequired ?? false,
      },
      listView: {
        fieldMode: field.listView.fieldMode,
        fieldPosition: field.listView.fieldPosition,
      },
      graphql: {
        isNonNull: field.isNonNull ?? [],
        ...(field.graphql ? field.graphql : {}),
      },
      views: views as EnhancedDashboardField['views'],
      controller: controllerFactory({
        listKey,
        fieldMeta: field.fieldMeta,
        label: field.label,
        description: field.description,
        path: field.path,
        kind: field.kind,
        customViews,
      }),
    }
  }

  return enhancedFields
}
