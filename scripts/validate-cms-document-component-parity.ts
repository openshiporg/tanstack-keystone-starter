import { graphql } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'
import {
  memoryCmsAdapter,
  resetMemoryAdapter,
} from '../src/features/cms/adapters'
import { config, initialiseLists, list } from '../src/features/cms/config'
import { document, text } from '../src/features/cms/fields'
import {
  buildCmsContext,
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
} from '../src/features/cms/runtime'

const form = (validate: (value: unknown) => boolean) => ({
  kind: 'form',
  defaultValue: '',
  options: {},
  validate,
})

const lists = initialiseLists(
  config({
    lists: {
      Person: list({ fields: { name: text(), email: text() } }),
      Page: list({
        fields: {
          title: text(),
          content: document({
            componentBlocks: {
              hero: {
                label: 'Hero',
                preview: () => null,
                schema: {
                  title: form(
                    (value) => typeof value === 'string' && value.length > 0,
                  ),
                  body: {
                    kind: 'child',
                    options: { kind: 'block', placeholder: '' },
                  },
                  author: {
                    kind: 'relationship',
                    listKey: 'Person',
                    label: 'Author',
                    many: false,
                    selection: 'email',
                  },
                  reviewers: {
                    kind: 'relationship',
                    listKey: 'Person',
                    label: 'Reviewers',
                    many: true,
                    selection: 'email',
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
const schema = makeExecutableSchema({
  typeDefs: generateCmsTypeDefsForLists(lists),
  resolvers: generateCmsResolversForLists(lists),
})

function context() {
  return buildCmsContext({
    adapter: memoryCmsAdapter,
    sudo: true,
    lists,
    schema,
  })
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  resetMemoryAdapter(
    {
      Person: [{ id: 'p1', name: 'Ada', email: 'person@example.test' }],
      Page: [],
    },
    lists,
  )

  const result = await graphql({
    schema,
    contextValue: context(),
    source: `mutation {
      createPage(data: { title: "Home", content: [{
        type: "component-block", component: "hero",
        props: { title: "Welcome", body: "discarded", author: { id: "p1", label: "forged" }, reviewers: [{ id: "p1", label: "forged" }] },
        children: [{ type: "component-block-prop", propPath: ["body"], children: [{ type: "paragraph", children: [{ text: "Body" }] }] }]
      }] }) { content { raw: document(hydrateRelationships: false) hydrated: document(hydrateRelationships: true) } }
    }`,
  })
  assert(
    !result.errors,
    result.errors?.map((error) => error.message).join('\n') ??
      'component mutation failed',
  )
  const content = (result.data as any).createPage.content
  assert(
    JSON.stringify(content.raw[0].props) ===
      JSON.stringify({
        title: 'Welcome',
        body: null,
        author: { id: 'p1' },
        reviewers: [{ id: 'p1' }],
      }),
    'component props should normalize to form values, null children, and relationship ids',
  )
  assert(
    content.hydrated[0].props.author.label === 'Ada' &&
      content.hydrated[0].props.author.data.email === 'person@example.test',
    'to-one component relationship props should hydrate labels and selections',
  )
  assert(
    content.hydrated[0].props.reviewers[0].label === 'Ada' &&
      content.hydrated[0].props.reviewers[0].data.email ===
        'person@example.test',
    'to-many component relationship props should hydrate labels and selections',
  )

  const invalidResult = await graphql({
    schema,
    contextValue: context(),
    source: `mutation {
      createPage(data: { title: "Bad", content: [{
        type: "component-block", component: "hero",
        props: { title: 1, body: null, author: { label: "missing id" }, reviewers: [] }, children: []
      }] }) { id }
    }`,
  })
  assert(
    invalidResult.errors?.[0]?.message.includes('component-block form prop'),
    'invalid component form props should be rejected',
  )
  console.info('CMS document component normalization/hydration parity passed.')
}

await main()
