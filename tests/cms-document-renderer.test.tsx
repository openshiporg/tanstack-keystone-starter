import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  DocumentRenderer,
  defaultRenderers,
} from '../src/features/cms/keystone/document-renderer'

describe('Keystone-compatible document renderer', () => {
  it('matches the 1.1.2 default renderer markup for rich document nodes', () => {
    const html = renderToStaticMarkup(
      <DocumentRenderer
        document={[
          {
            type: 'heading',
            level: 2,
            textAlign: 'center',
            children: [{ text: 'Title', bold: true }],
          },
          {
            type: 'paragraph',
            children: [
              { text: 'Visit ' },
              {
                type: 'link',
                href: 'https://example.com',
                children: [{ text: 'Example', italic: true }],
              },
            ],
          },
          {
            type: 'ordered-list',
            children: [
              { type: 'list-item', children: [{ text: 'One' }] },
              { type: 'list-item', children: [{ text: 'Two' }] },
            ],
          },
          {
            type: 'layout',
            layout: [1, 2],
            children: [
              {
                type: 'layout-area',
                children: [{ type: 'paragraph', children: [{ text: 'Left' }] }],
              },
              {
                type: 'layout-area',
                children: [
                  { type: 'paragraph', children: [{ text: 'Right' }] },
                ],
              },
            ],
          },
          {
            type: 'relationship',
            relationship: 'author',
            data: { id: '1', label: 'Ada' },
            children: [{ text: '' }],
          },
          { type: 'divider', children: [{ text: '' }] },
          { type: 'code', children: [{ text: 'const x = 1' }] },
        ]}
      />,
    )
    expect(html).toMatchInlineSnapshot(
      `"<h2 style="text-align:center"><strong>Title</strong></h2><p>Visit <a href="https://example.com"><em>Example</em></a></p><ol><li>One</li><li>Two</li></ol><div style="display:grid;grid-template-columns:1fr 2fr"><div><p>Left</p></div><div><p>Right</p></div></div><span>Ada</span><hr/><pre>const x = 1</pre>"`,
    )
  })

  it('injects child props and hydrated values into component blocks', () => {
    const Hero = ({ title, body, author }: any) => (
      <article data-author={author.label}>
        <h1>{title}</h1>
        {body}
      </article>
    )
    const html = renderToStaticMarkup(
      <DocumentRenderer
        componentBlocks={{ hero: Hero }}
        document={[
          {
            type: 'component-block',
            component: 'hero',
            props: {
              title: 'Hello',
              body: null,
              author: { id: '1', label: 'Ada', data: {} },
            },
            children: [
              {
                type: 'component-block-prop',
                propPath: ['body'],
                children: [{ type: 'paragraph', children: [{ text: 'Body' }] }],
              },
            ],
          },
        ]}
      />,
    )
    expect(html).toMatchInlineSnapshot(
      `"<div><article data-author="Ada"><h1>Hello</h1><p>Body</p></article></div>"`,
    )
    expect(defaultRenderers.inline.bold).toBe('strong')
  })
})
