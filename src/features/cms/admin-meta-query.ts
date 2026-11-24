export const adminMetaGraphQLQuery = /* GraphQL */ `
  query KsFetchAdminMeta {
    keystone {
      adminMeta {
        views
        isAccessAllowed
        auth {
          listKey
          identityField
          secretField
          sessionData
          initFirstItemFields
        }
        lists {
          key
          initialSort {
            field
            direction
          }
          initialFilter
          path
          label
          singular
          plural
          description
          initialColumns
          initialSearchFields
          pageSize
          labelField
          isSingleton
          isHidden
          hideNavigation
          hideCreate
          hideDelete
          graphql {
            names {
              outputTypeName
              whereInputName
              whereUniqueInputName
              createInputName
              createMutationName
              createManyMutationName
              relateToOneForCreateInputName
              relateToManyForCreateInputName
              itemQueryName
              listQueryName
              listQueryCountName
              listOrderName
              updateInputName
              updateMutationName
              updateManyInputName
              updateManyMutationName
              relateToOneForUpdateInputName
              relateToManyForUpdateInputName
              deleteMutationName
              deleteManyMutationName
            }
          }
          fields {
            key
            path
            label
            description
            fieldMeta
            isOrderable
            isFilterable
            viewsIndex
            customViewsIndex
            search
            isNonNull
            createView {
              fieldMode
              fieldPosition
              isRequired
            }
            itemView {
              fieldMode
              fieldPosition
              isRequired
            }
            listView {
              fieldMode
              fieldPosition
            }
          }
          groups {
            label
            description
            fields {
              key
              path
            }
          }
          actions {
            key
            label
            icon
            messages {
              promptTitle
              promptTitleMany
              prompt
              promptMany
              promptConfirmLabel
              promptConfirmLabelMany
              fail
              failMany
              success
              successMany
            }
            graphql {
              names {
                one
                many
              }
            }
            itemView {
              actionMode
              navigation
              hidePrompt
              hideToast
            }
            listView {
              actionMode
            }
          }
        }
      }
    }
  }
`
