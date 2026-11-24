import { createElement } from 'react'
import type { ComponentType, ReactElement, ReactNode } from 'react'

type DocumentNode = {
  type?: string
  text?: string
  children?: DocumentNode[]
  [key: string]: unknown
}

type OnlyChildrenComponent = ComponentType<{ children?: ReactNode }> | string

type Renderers = {
  inline: Record<string, ComponentType<any> | string> & {
    link: ComponentType<{ children?: ReactNode; href: string }> | 'a'
    relationship: ComponentType<{
      relationship: string
      data: {
        id: string
        label?: string
        data?: Record<string, unknown>
      } | null
    }>
  }
  block: {
    block: OnlyChildrenComponent
    paragraph: ComponentType<{
      children?: ReactNode
      textAlign?: 'center' | 'end'
    }>
    blockquote: OnlyChildrenComponent
    code: ComponentType<{ children: string }> | string
    layout: ComponentType<{
      layout: [number, ...number[]]
      children?: ReactElement[]
    }>
    divider: ComponentType<Record<string, never>> | string
    heading: ComponentType<{
      level: 1 | 2 | 3 | 4 | 5 | 6
      children?: ReactNode
      textAlign?: 'center' | 'end'
    }>
    list: ComponentType<{
      type: 'ordered' | 'unordered'
      children?: ReactElement[]
    }>
  }
}

export const defaultRenderers: Renderers = {
  inline: {
    bold: 'strong',
    code: 'code',
    keyboard: 'kbd',
    strikethrough: 's',
    italic: 'em',
    link: 'a',
    subscript: 'sub',
    superscript: 'sup',
    underline: 'u',
    relationship: ({ data }) => <span>{data?.label || data?.id}</span>,
  },
  block: {
    block: 'div',
    blockquote: 'blockquote',
    paragraph: ({ children, textAlign }) => (
      <p style={{ textAlign }}>{children}</p>
    ),
    divider: 'hr',
    heading: ({ level, children, textAlign }) =>
      createElement(`h${level}`, { style: { textAlign } }, children),
    code: 'pre',
    list: ({ children = [], type }) => {
      const List = type === 'ordered' ? 'ol' : 'ul'
      return createElement(
        List,
        null,
        children.map((child, index) => <li key={index}>{child}</li>),
      )
    },
    layout: ({ children = [], layout }) => (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: layout.map((x) => `${x}fr`).join(' '),
        }}
      >
        {children.map((child, index) => (
          <div key={index}>{child}</div>
        ))}
      </div>
    ),
  },
}

export type DocumentRendererProps<
  TComponentBlocks extends Record<string, ComponentType<any>> = Record<
    string,
    ComponentType<any>
  >,
> = {
  document: DocumentNode[]
  renderers?: {
    inline?: Partial<Renderers['inline']>
    block?: Partial<Renderers['block']>
  }
  componentBlocks?: TComponentBlocks
}

function setAtPath(
  target: Record<string | number, any>,
  path: (string | number)[],
  value: ReactNode,
) {
  const [head, ...tail] = path
  if (head === undefined) return
  if (tail.length === 0) target[head] = value
  else if (target[head] && typeof target[head] === 'object')
    setAtPath(target[head], tail, value)
}

function componentProps(node: DocumentNode, children: ReactNode[]) {
  const props = JSON.parse(JSON.stringify(node.props ?? {})) as Record<
    string,
    any
  >
  node.children?.forEach((child, index) => {
    if (Array.isArray(child.propPath))
      setAtPath(
        props,
        [...child.propPath] as (string | number)[],
        children[index],
      )
  })
  return props
}

function DocumentNodeView({
  node,
  componentBlocks,
  renderers,
}: {
  node: DocumentNode
  componentBlocks: Record<string, ComponentType<any>>
  renderers: Renderers
}): ReactNode {
  if (typeof node.text === 'string') {
    let child: ReactNode = <>{node.text}</>
    Object.keys(renderers.inline).forEach((mark) => {
      if (mark !== 'link' && mark !== 'relationship' && node[mark])
        child = createElement(renderers.inline[mark], null, child)
    })
    return child
  }
  const children = (node.children ?? []).map((child, index) => (
    <DocumentNodeView
      key={index}
      node={child}
      componentBlocks={componentBlocks}
      renderers={renderers}
    />
  ))
  switch (node.type) {
    case 'blockquote':
      return createElement(renderers.block.blockquote, null, children)
    case 'paragraph':
      return createElement(
        renderers.block.paragraph,
        { textAlign: node.textAlign as any },
        children,
      )
    case 'code':
      return node.children?.length === 1 &&
        typeof node.children[0]?.text === 'string' ? (
        createElement(renderers.block.code, null, node.children[0].text)
      ) : (
        <>{children}</>
      )
    case 'layout':
      return createElement(
        renderers.block.layout,
        { layout: node.layout as [number, ...number[]] },
        children,
      )
    case 'divider':
      return createElement(renderers.block.divider)
    case 'heading':
      return createElement(
        renderers.block.heading,
        { level: node.level as any, textAlign: node.textAlign as any },
        children,
      )
    case 'component-block': {
      const Component = componentBlocks[String(node.component)]
      return Component ? (
        createElement(
          renderers.block.block,
          null,
          <Component {...componentProps(node, children)} />,
        )
      ) : (
        <>{children}</>
      )
    }
    case 'ordered-list':
    case 'unordered-list':
      return createElement(
        renderers.block.list,
        { type: node.type === 'ordered-list' ? 'ordered' : 'unordered' },
        children,
      )
    case 'relationship':
      return createElement(renderers.inline.relationship, {
        relationship: String(node.relationship),
        data: node.data ? (node.data as any) : null,
      })
    case 'link':
      return createElement(
        renderers.inline.link,
        { href: String(node.href) },
        children,
      )
    default:
      return <>{children}</>
  }
}

export function DocumentRenderer<
  TComponentBlocks extends Record<string, ComponentType<any>>,
>(props: DocumentRendererProps<TComponentBlocks>) {
  const renderers: Renderers = {
    inline: {
      ...defaultRenderers.inline,
      ...props.renderers?.inline,
    } as Renderers['inline'],
    block: {
      ...defaultRenderers.block,
      ...props.renderers?.block,
    } as Renderers['block'],
  }
  const componentBlocks = props.componentBlocks ?? {}
  return (
    <>
      {props.document.map((node, index) => (
        <DocumentNodeView
          key={index}
          node={node}
          componentBlocks={componentBlocks}
          renderers={renderers}
        />
      ))}
    </>
  )
}
