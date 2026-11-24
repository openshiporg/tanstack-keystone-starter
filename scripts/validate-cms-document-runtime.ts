import { graphql } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
  setCmsAdapterForTests,
} from '../src/features/cms/adapters'
import { initialiseLists } from '../src/features/cms/config'
import { config, list } from '../src/features/cms/keystone/core'
import { relationship, text } from '../src/features/cms/keystone/fields'
import { document } from '../src/features/cms/keystone/fields-document'
import {
  buildCmsContext,
  createCmsContext,
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
  getCmsGraphQLSchema,
} from '../src/features/cms/runtime'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

async function main() {
  process.env.CMS_ADAPTER = 'memory'
  process.env.CMS_DEV_AUTH_FALLBACK = 'true'
  process.env.CMS_DEV_AUTH_ITEM_ID = 'user_admin'
  setCmsAdapterForTests(memoryCmsAdapter)
  resetMemoryAdapter()

  const context = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { 'x-cms-user-id': 'user_admin' },
    }),
  )
  const schema = getCmsGraphQLSchema()

  const result = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      query ValidateDocumentRuntimeOutput {
        todos(where: { id: { equals: "todo_launch" } }) {
          id
          description {
            hydrated: document(hydrateRelationships: true)
            raw: document(hydrateRelationships: false)
          }
        }
      }
    `,
  })

  if (result.errors?.length)
    throw new Error(result.errors.map((error) => error.message).join('\n'))

  const todos = (asRecord(result.data).todos ?? []) as Array<unknown>
  const firstTodo = asRecord(todos[0])
  const description = asRecord(firstTodo.description)
  const hydratedDocument = description.hydrated
  const rawDocument = description.raw

  assert(
    Array.isArray(hydratedDocument),
    'document field should resolve hydrated document output to an array',
  )
  assert(
    Array.isArray(rawDocument),
    'document field should resolve raw document output to an array',
  )
  const firstNode = asRecord(hydratedDocument[0])
  assert(
    firstNode.type === 'paragraph',
    'document field should preserve structured paragraph nodes',
  )
  const hydratedRelationshipNode = asRecord(hydratedDocument[1])
  const rawRelationshipNode = asRecord(rawDocument[1])
  assert(
    hydratedRelationshipNode.type === 'relationship',
    'document field should preserve relationship nodes',
  )
  assert(
    asRecord(rawRelationshipNode.data).id === 'user_admin',
    'hydrateRelationships: false should preserve raw relationship node payloads',
  )
  assert(
    JSON.stringify(hydratedDocument) === JSON.stringify(rawDocument),
    'documents without configured relationships should preserve relationship-shaped nodes without inventing hydration',
  )

  const relationshipDocumentLists = initialiseLists(
    config({
      lists: {
        DocumentPerson: list({
          fields: {
            name: text(),
            email: text(),
            posts: relationship({ ref: 'DocumentPost.author', many: true }),
          },
        }),
        DocumentPost: list({
          fields: {
            title: text(),
            author: relationship({ ref: 'DocumentPerson.posts' }),
            content: document({
              relationships: {
                author: {
                  listKey: 'DocumentPerson',
                  label: 'Author',
                  labelField: 'name',
                  selection: 'email',
                },
              },
            }),
          },
        }),
      },
    }),
  )
  resetMemoryAdapter(
    {
      DocumentPerson: [
        {
          id: 'document_person_1',
          name: 'Fixture Author',
          email: 'fixture@example.com',
          posts: ['document_post_1'],
        },
      ],
      DocumentPost: [
        {
          id: 'document_post_1',
          title: 'Fixture Post',
          author: 'document_person_1',
          content: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'relationship',
                  relationship: 'author',
                  data: { id: 'document_person_1', label: 'Fixture Author' },
                  children: [{ text: '' }],
                },
              ],
            },
          ],
        },
      ],
    },
    relationshipDocumentLists,
  )
  const relationshipDocumentSchema = makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(relationshipDocumentLists),
    resolvers: generateCmsResolversForLists(relationshipDocumentLists),
  })
  const relationshipDocumentContext = buildCmsContext({
    adapter: memoryCmsAdapter,
    sudo: true,
    internal: false,
    schema: relationshipDocumentSchema,
    lists: relationshipDocumentLists,
  })
  const relationshipDocumentResult = await graphql({
    schema: relationshipDocumentSchema,
    contextValue: relationshipDocumentContext,
    source: /* GraphQL */ `
      query ValidateIsolatedDocumentRelationshipHydration {
        documentPost(where: { id: "document_post_1" }) {
          content {
            hydrated: document(hydrateRelationships: true)
            raw: document(hydrateRelationships: false)
          }
        }
      }
    `,
  })
  if (relationshipDocumentResult.errors?.length)
    throw new Error(
      relationshipDocumentResult.errors
        .map((error) => error.message)
        .join('\n'),
    )
  const isolatedContent = asRecord(
    asRecord(asRecord(relationshipDocumentResult.data).documentPost).content,
  )
  const isolatedHydrated = isolatedContent.hydrated as Array<unknown>
  const isolatedRaw = isolatedContent.raw as Array<unknown>
  const isolatedRelationship = asRecord(
    (asRecord(isolatedHydrated[0]).children as Array<unknown>)[0],
  )
  assert(
    asRecord(asRecord(isolatedRelationship.data).data).email ===
      'fixture@example.com',
    'isolated document fixtures should prove configured relationship hydration without changing production starter models',
  )
  assert(
    JSON.stringify(isolatedHydrated) !== JSON.stringify(isolatedRaw),
    'configured document relationship hydration should materially enrich the isolated fixture',
  )
  const invalidIsolatedRelationshipPayload = await graphql({
    schema: relationshipDocumentSchema,
    contextValue: relationshipDocumentContext,
    source: /* GraphQL */ `
      mutation ValidateIsolatedDocumentRelationshipPayload {
        updateDocumentPost(
          where: { id: "document_post_1" }
          data: {
            content: [
              {
                type: "paragraph"
                children: [
                  {
                    type: "relationship"
                    relationship: "author"
                    data: { label: "Missing id" }
                    children: [{ text: "" }]
                  }
                ]
              }
            ]
          }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (invalidIsolatedRelationshipPayload.errors?.[0]?.message ?? '').includes(
      'content relationship nodes must include a string id',
    ),
    'isolated document fixtures should reject configured relationship payloads without string ids',
  )
  resetMemoryAdapter()

  const mutationResult = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeMutations {
        createTodo(data: { label: "Document default create validation" }) {
          id
          description {
            raw: document(hydrateRelationships: false)
          }
        }
      }
    `,
  })

  if (mutationResult.errors?.length)
    throw new Error(
      mutationResult.errors.map((error) => error.message).join('\n'),
    )
  const createdTodo = asRecord(asRecord(mutationResult.data).createTodo)
  const createdDescription = asRecord(createdTodo.description).raw
  assert(
    Array.isArray(createdDescription),
    'createTodo without explicit document input should default document output to an array',
  )
  const createdFirstNode = asRecord((createdDescription as Array<unknown>)[0])
  assert(
    createdFirstNode.type === 'paragraph',
    'createTodo without explicit document input should default document output to a paragraph node',
  )

  const richFormattingUpdate = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeRichFormatting {
        updateTodo(
          where: { id: "todo_launch" }
          data: {
            description: [
              {
                type: "heading"
                level: 2
                textAlign: "center"
                children: [
                  { text: "Rich heading", bold: true, underline: true }
                ]
              }
            ]
          }
        ) {
          description {
            document
          }
        }
      }
    `,
  })
  if (richFormattingUpdate.errors?.length)
    throw new Error(
      richFormattingUpdate.errors.map((error) => error.message).join('\n'),
    )
  const richDocument = asRecord(
    asRecord(asRecord(richFormattingUpdate.data).updateTodo).description,
  ).document as unknown[]
  const richHeading = asRecord(richDocument[0])
  const richText = asRecord((richHeading.children as unknown[])[0])
  assert(
    richHeading.type === 'heading' &&
      richHeading.level === 2 &&
      richHeading.textAlign === 'center' &&
      richText.bold === true &&
      richText.underline === true,
    'document input normalization should preserve heading alignment and enabled text marks',
  )

  const invalidRootStructure = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeInvalidRootStructure {
        updateTodo(
          where: { id: "todo_launch" }
          data: { description: { bogus: true } }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (invalidRootStructure.errors?.[0]?.message ?? '').includes(
      'Invalid document structure',
    ) ||
      (invalidRootStructure.errors?.[0]?.message ?? '').includes(
        'document fields must',
      ),
    'document update should reject invalid non-array root structure',
  )

  const nullUpdate = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeNullUpdate {
        updateTodo(where: { id: "todo_launch" }, data: { description: null }) {
          id
        }
      }
    `,
  })
  assert(
    (nullUpdate.errors?.[0]?.message ?? '').includes(
      'description document fields cannot be set to null',
    ),
    'document update should reject null values',
  )

  const invalidChildStructure = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeInvalidChildStructure {
        updateTodo(
          where: { id: "todo_launch" }
          data: { description: [{ type: "paragraph", children: [123] }] }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (invalidChildStructure.errors?.[0]?.message ?? '').includes(
      'Invalid document structure',
    ),
    'document update should reject malformed child nodes instead of silently filtering them',
  )

  const missingChildrenParagraph = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeMissingParagraphChildren {
        updateTodo(
          where: { id: "todo_launch" }
          data: { description: [{ type: "paragraph" }] }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (missingChildrenParagraph.errors?.[0]?.message ?? '').includes(
      'Invalid document structure',
    ),
    'document update should reject paragraph nodes without children arrays',
  )

  const invalidLinkNode = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeInvalidLinkNode {
        updateTodo(
          where: { id: "todo_launch" }
          data: {
            description: [
              {
                type: "paragraph"
                children: [
                  {
                    type: "link"
                    href: "javascript:alert(1)"
                    children: [{ text: "bad link" }]
                  }
                ]
              }
            ]
          }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (invalidLinkNode.errors?.[0]?.message ?? '').includes(
      'Invalid document structure',
    ),
    'document update should reject malformed link nodes with invalid href values',
  )

  const invalidTextExtraField = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeInvalidTextExtraField {
        updateTodo(
          where: { id: "todo_launch" }
          data: {
            description: [
              { type: "paragraph", children: [{ text: "hello", sneaky: true }] }
            ]
          }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (invalidTextExtraField.errors?.[0]?.message ?? '').includes(
      'Invalid document structure',
    ),
    'document update should reject text nodes with unknown fields',
  )

  const invalidTextMarkValue = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeInvalidTextMarkValue {
        updateTodo(
          where: { id: "todo_launch" }
          data: {
            description: [
              { type: "paragraph", children: [{ text: "hello", bold: false }] }
            ]
          }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (invalidTextMarkValue.errors?.[0]?.message ?? '').includes(
      'Invalid document structure',
    ),
    'document update should reject invalid text mark values',
  )

  const invalidHeadingNode = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeInvalidHeadingNode {
        updateTodo(
          where: { id: "todo_launch" }
          data: {
            description: [
              { type: "heading", level: 9, children: [{ text: "bad heading" }] }
            ]
          }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (invalidHeadingNode.errors?.[0]?.message ?? '').includes(
      'Invalid document structure',
    ),
    'document update should reject heading nodes with invalid levels',
  )

  const invalidLayoutNode = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeInvalidLayoutNode {
        updateTodo(
          where: { id: "todo_launch" }
          data: {
            description: [
              {
                type: "layout"
                layout: [1, "bad"]
                children: [{ type: "layout-area", children: [{ text: "x" }] }]
              }
            ]
          }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (invalidLayoutNode.errors?.[0]?.message ?? '').includes(
      'Invalid document structure',
    ),
    'document update should reject layout nodes with non-numeric layout arrays',
  )

  const invalidComponentBlockNode = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeInvalidComponentBlockNode {
        updateTodo(
          where: { id: "todo_launch" }
          data: {
            description: [
              {
                type: "component-block"
                component: "Hero"
                props: "bad"
                children: [{ text: "x" }]
              }
            ]
          }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (invalidComponentBlockNode.errors?.[0]?.message ?? '').includes(
      'Invalid document structure',
    ),
    'document update should reject component-block nodes with non-object props',
  )

  const invalidUnknownNodeType = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeUnknownNodeType {
        updateTodo(
          where: { id: "todo_launch" }
          data: {
            description: [
              { type: "totally-unknown-node", children: [{ text: "mystery" }] }
            ]
          }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (invalidUnknownNodeType.errors?.[0]?.message ?? '').includes(
      'Invalid document structure',
    ),
    'document update should reject unknown node types',
  )

  const invalidTopLevelInline = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeTopLevelInline {
        updateTodo(
          where: { id: "todo_launch" }
          data: {
            description: [
              {
                type: "relationship"
                relationship: "assignee"
                data: { id: "user_admin" }
                children: [{ text: "inline at root" }]
              }
            ]
          }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (invalidTopLevelInline.errors?.[0]?.message ?? '').includes(
      'Invalid document structure',
    ),
    'document update should reject top-level inline nodes',
  )

  const invalidBlockquoteExtraField = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeInvalidBlockquoteExtraField {
        updateTodo(
          where: { id: "todo_launch" }
          data: {
            description: [
              {
                type: "blockquote"
                sneaky: true
                children: [{ text: "quoted" }]
              }
            ]
          }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (invalidBlockquoteExtraField.errors?.[0]?.message ?? '').includes(
      'Invalid document structure',
    ),
    'document update should reject strict basic block nodes with unknown fields',
  )

  const missingChildrenLink = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeMissingLinkChildren {
        updateTodo(
          where: { id: "todo_launch" }
          data: {
            description: [
              {
                type: "paragraph"
                children: [{ type: "link", href: "https://example.com" }]
              }
            ]
          }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (missingChildrenLink.errors?.[0]?.message ?? '').includes(
      'Invalid document structure',
    ),
    'document update should reject link nodes without children arrays',
  )

  const invalidLinkExtraField = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeInvalidLinkExtraField {
        updateTodo(
          where: { id: "todo_launch" }
          data: {
            description: [
              {
                type: "paragraph"
                children: [
                  {
                    type: "link"
                    href: "https://example.com"
                    extra: true
                    children: [{ text: "ok" }]
                  }
                ]
              }
            ]
          }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (invalidLinkExtraField.errors?.[0]?.message ?? '').includes(
      'Invalid document structure',
    ),
    'document update should reject link nodes with unknown fields',
  )

  const invalidUnknownComponentBlock = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeUnknownComponentBlock {
        updateTodo(
          where: { id: "todo_launch" }
          data: {
            description: [
              {
                type: "component-block"
                component: "MissingComponent"
                props: {}
                children: [{ text: "x" }]
              }
            ]
          }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (invalidUnknownComponentBlock.errors?.[0]?.message ?? '').includes(
      'component-block nodes must reference a configured component block',
    ),
    'document update should reject component-block nodes with unknown component keys',
  )

  const invalidComponentPropNode = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeInvalidComponentPropNode {
        updateTodo(
          where: { id: "todo_launch" }
          data: {
            description: [
              {
                type: "component-block-prop"
                propPath: ["hero", true]
                children: [{ text: "x" }]
              }
            ]
          }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (invalidComponentPropNode.errors?.[0]?.message ?? '').includes(
      'Invalid document structure',
    ),
    'document update should reject component prop nodes with invalid propPath entries',
  )

  const invalidRelationshipKey = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeInvalidRelationshipKey {
        updateTodo(
          where: { id: "todo_launch" }
          data: {
            description: [
              {
                type: "paragraph"
                children: [
                  {
                    type: "relationship"
                    relationship: "unknownRelationship"
                    data: { id: "user_admin" }
                    children: [{ text: "" }]
                  }
                ]
              }
            ]
          }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (invalidRelationshipKey.errors?.[0]?.message ?? '').includes(
      'description relationship nodes must reference a configured relationship',
    ),
    'document update should reject unknown relationship keys',
  )

  const componentLists = initialiseLists(
    config({
      lists: {
        ComponentDocThing: list({
          fields: {
            title: text(),
            content: document({
              componentBlocks: {
                hero: {
                  label: 'Hero',
                  schema: {
                    title: { kind: 'form' },
                    meta: {
                      kind: 'object',
                      fields: {
                        tone: { kind: 'form' },
                      },
                    },
                  },
                },
              },
            }),
          },
        }),
      },
    }),
  )
  resetMemoryAdapter(
    {
      ComponentDocThing: [
        {
          id: 'component_doc_1',
          title: 'Doc',
          content: [{ type: 'paragraph', children: [{ text: '' }] }],
        },
      ],
    },
    componentLists,
  )
  const componentSchema = makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(componentLists),
    resolvers: generateCmsResolversForLists(componentLists),
  })
  const componentContext = buildCmsContext({
    adapter: memoryCmsAdapter,
    sudo: true,
    internal: false,
    schema: componentSchema,
    lists: componentLists,
  })

  const invalidComponentProps = await graphql({
    schema: componentSchema,
    contextValue: componentContext,
    source: /* GraphQL */ `
      mutation ValidateDocumentRuntimeInvalidComponentProps {
        updateComponentDocThing(
          where: { id: "component_doc_1" }
          data: {
            content: [
              {
                type: "component-block"
                component: "hero"
                props: { unknown: "bad" }
                children: [{ text: "x" }]
              }
            ]
          }
        ) {
          id
        }
      }
    `,
  })
  assert(
    (invalidComponentProps.errors?.[0]?.message ?? '').includes(
      'component-block object props',
    ),
    'document update should reject component-block props that violate the configured schema',
  )
  resetMemoryAdapter()

  const scalarIntrospection = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      query ValidateScalarProviderIntrospection {
        dateTimeFilter: __type(name: "DateTimeFilter") {
          inputFields {
            name
            type {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
        decimalFilter: __type(name: "DecimalFilter") {
          inputFields {
            name
            type {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
        bigIntFilter: __type(name: "BigIntFilter") {
          inputFields {
            name
            type {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
        userWhere: __type(name: "UserWhereInput") {
          inputFields {
            name
          }
        }
        userOrder: __type(name: "UserOrderByInput") {
          inputFields {
            name
          }
        }
      }
    `,
  })
  if (scalarIntrospection.errors?.length)
    throw new Error(
      scalarIntrospection.errors.map((error) => error.message).join('\n'),
    )
  const dateTimeFields = (asRecord(
    asRecord(scalarIntrospection.data).dateTimeFilter,
  ).inputFields ?? []) as Array<unknown>
  const decimalFields = (asRecord(
    asRecord(scalarIntrospection.data).decimalFilter,
  ).inputFields ?? []) as Array<unknown>
  const bigIntFields = (asRecord(
    asRecord(scalarIntrospection.data).bigIntFilter,
  ).inputFields ?? []) as Array<unknown>
  const userWhereFields = (asRecord(
    asRecord(scalarIntrospection.data).userWhere,
  ).inputFields ?? []) as Array<unknown>
  const userOrderFields = (asRecord(
    asRecord(scalarIntrospection.data).userOrder,
  ).inputFields ?? []) as Array<unknown>
  const dateTimeEqualsType = asRecord(
    asRecord(
      dateTimeFields.map(asRecord).find((field) => field.name === 'equals'),
    ).type,
  )
  const decimalEqualsType = asRecord(
    asRecord(
      decimalFields.map(asRecord).find((field) => field.name === 'equals'),
    ).type,
  )
  const bigIntEqualsType = asRecord(
    asRecord(
      bigIntFields.map(asRecord).find((field) => field.name === 'equals'),
    ).type,
  )
  assert(
    dateTimeEqualsType.name === 'DateTime',
    'DateTimeFilter.equals should use the DateTime scalar instead of String',
  )
  assert(
    decimalEqualsType.name === 'Decimal',
    'DecimalFilter.equals should use the Decimal scalar instead of String',
  )
  assert(
    bigIntEqualsType.name === 'BigInt',
    'BigIntFilter.equals should use the BigInt scalar instead of String',
  )
  assert(
    !userWhereFields.map(asRecord).some((field) => field.name === 'email'),
    'UserWhereInput should omit User.email when normalized graphql filter enablement disables filtering',
  )
  assert(
    !userOrderFields.map(asRecord).some((field) => field.name === 'email'),
    'UserOrderByInput should omit User.email when normalized graphql order enablement disables ordering',
  )

  const scalarValueQuery = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      query ValidateScalarProviderValues {
        todos(where: { id: { equals: "todo_launch" } }) {
          id
          dueDate
          budget
          largeNumber
        }
      }
    `,
  })
  if (scalarValueQuery.errors?.length)
    throw new Error(
      scalarValueQuery.errors.map((error) => error.message).join('\n'),
    )
  const scalarValueTodo = asRecord(
    ((asRecord(scalarValueQuery.data).todos ?? []) as Array<unknown>)[0],
  )
  assert(
    scalarValueTodo.dueDate === '2026-06-01T00:00:00.000Z',
    'DateTime scalar should serialize timestamp values as ISO strings',
  )
  assert(
    scalarValueTodo.budget === '1250.00',
    'Decimal scalar should serialize decimal values without collapsing precision metadata shape',
  )
  assert(
    scalarValueTodo.largeNumber === '9007199254740993',
    'BigInt scalar should serialize big integer values as exact strings',
  )

  const introspection = await graphql({
    schema,
    contextValue: context,
    source: /* GraphQL */ `
      query ValidateDocumentRuntimeIntrospection {
        __type(name: "Todo") {
          fields {
            name
            type {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
      }
    `,
  })

  if (introspection.errors?.length)
    throw new Error(
      introspection.errors.map((error) => error.message).join('\n'),
    )
  const todoType = asRecord(asRecord(introspection.data).__type)
  const fields = ((todoType.fields ?? []) as Array<unknown>).map(asRecord)
  const descriptionField = fields.find((field) => field.name === 'description')
  assert(descriptionField, 'Todo.description should exist in introspection')
  const descriptionType = asRecord(descriptionField.type)
  assert(
    descriptionType.name === 'Todo_description_Document',
    'Todo.description should expose the source-compatible field-specific document output type',
  )

  const readNonNullLists = initialiseLists(
    config({
      lists: {
        ReadNonNullPost: list({
          fields: {
            title: text({
              graphql: {
                isNonNull: { read: true, create: false, update: false },
              },
            }),
          },
        }),
      },
    }),
  )
  const readNonNullPost = readNonNullLists[0]
  assert(
    readNonNullPost.fields[1]?.graphql?.isNonNull?.read === true,
    'read-non-null fixture should preserve explicit graphql.isNonNull.read metadata',
  )
  const readNonNullField = readNonNullPost.fields.find(
    (field) => field.path === 'title',
  )
  assert(
    readNonNullField,
    'read-non-null fixture should preserve configured title field',
  )
  const readNonNullTypeName =
    readNonNullField.graphql.isNonNull.read === true ? 'String!' : 'String'
  assert(
    readNonNullTypeName === 'String!',
    'explicit graphql.isNonNull.read metadata should drive non-null output typing for read fields',
  )

  console.info('CMS document runtime validation passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
