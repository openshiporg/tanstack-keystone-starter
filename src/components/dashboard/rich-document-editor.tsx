import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import type { KeyboardEvent, ReactNode } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Heading1,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react'
import {
  Editor,
  Element as SlateElement,
  Node,
  Range,
  Transforms,
  createEditor,
} from 'slate'
import type { Descendant } from 'slate'
import { HistoryEditor, withHistory } from 'slate-history'
import {
  Editable,
  ReactEditor,
  Slate,
  useSlate,
  useSlateStatic,
  withReact,
} from 'slate-react'
import type { RenderElementProps, RenderLeafProps } from 'slate-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  dashboardQueryKeys,
  fetchDashboardRelationshipOptions,
} from '@/features/cms/graphql-client'
import { cn } from '@/lib/utils'

type DocumentNode = {
  type?: string
  text?: string
  children?: DocumentNode[]
  [key: string]: unknown
}

type Mark = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code'
type Block =
  | 'paragraph'
  | 'heading-one'
  | 'heading-two'
  | 'blockquote'
  | 'code'
  | 'ordered-list'
  | 'unordered-list'
type Alignment = 'start' | 'center' | 'end'

export type DocumentEditorFeatures = {
  formatting: {
    inlineMarks: Record<string, boolean>
    listTypes: { ordered: boolean; unordered: boolean }
    alignment: { center: boolean; end: boolean }
    headingLevels: number[]
    blockTypes: { blockquote: boolean; code: boolean }
    softBreaks: boolean
  }
  links: boolean
  dividers: boolean
  layouts: number[][]
}

export type DocumentRelationshipConfig = {
  listKey: string
  label: string
  labelField?: string
  selection?: string
  many?: boolean
}

export type ComponentSchema = Record<string, unknown>

export type ComponentBlockConfig = {
  label: string
  schema: ComponentSchema
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeLayout(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return null
  const layout = value.map(Number)
  return layout.every((entry) => Number.isFinite(entry) && entry > 0)
    ? layout
    : null
}

export function documentEditorConfig(fieldMeta: unknown = {}) {
  const meta = asRecord(fieldMeta)
  const features = asRecord(meta.documentFeatures)
  const formatting = asRecord(features.formatting)
  const marks = asRecord(formatting.inlineMarks)
  const lists = asRecord(formatting.listTypes)
  const alignment = asRecord(formatting.alignment)
  const blocks = asRecord(formatting.blockTypes)
  return {
    documentFeatures: {
      formatting: {
        inlineMarks: {
          bold: asBoolean(marks.bold, true),
          italic: asBoolean(marks.italic, true),
          underline: asBoolean(marks.underline, true),
          strikethrough: asBoolean(marks.strikethrough, true),
          code: asBoolean(marks.code, true),
          superscript: asBoolean(marks.superscript, true),
          subscript: asBoolean(marks.subscript, true),
          keyboard: asBoolean(marks.keyboard, true),
        },
        listTypes: {
          ordered: asBoolean(lists.ordered, true),
          unordered: asBoolean(lists.unordered, true),
        },
        alignment: {
          center: asBoolean(alignment.center, true),
          end: asBoolean(alignment.end, true),
        },
        headingLevels: Array.isArray(formatting.headingLevels)
          ? formatting.headingLevels
              .map(Number)
              .filter(
                (level) => Number.isInteger(level) && level >= 1 && level <= 6,
              )
          : [1, 2, 3, 4, 5, 6],
        blockTypes: {
          blockquote: asBoolean(blocks.blockquote, true),
          code: asBoolean(blocks.code, true),
        },
        softBreaks: asBoolean(formatting.softBreaks, true),
      },
      links: asBoolean(features.links, true),
      dividers: asBoolean(features.dividers, true),
      layouts: Array.isArray(features.layouts)
        ? features.layouts
            .map(normalizeLayout)
            .filter((layout): layout is number[] => layout !== null)
        : [],
    } satisfies DocumentEditorFeatures,
    relationships: Object.fromEntries(
      Object.entries(asRecord(meta.relationships)).flatMap(([key, value]) => {
        const relationship = asRecord(value)
        if (typeof relationship.listKey !== 'string' || !relationship.listKey)
          return []
        return [
          [
            key,
            {
              listKey: relationship.listKey,
              label:
                typeof relationship.label === 'string'
                  ? relationship.label
                  : key,
              ...(typeof relationship.labelField === 'string'
                ? { labelField: relationship.labelField }
                : {}),
              ...(typeof relationship.selection === 'string'
                ? { selection: relationship.selection }
                : {}),
              ...(typeof relationship.many === 'boolean'
                ? { many: relationship.many }
                : {}),
            } satisfies DocumentRelationshipConfig,
          ],
        ]
      }),
    ) as Record<string, DocumentRelationshipConfig>,
    componentBlocks: Object.fromEntries(
      Object.entries(asRecord(meta.componentBlocks)).flatMap(([key, value]) => {
        const component = asRecord(value)
        if (
          component.schema !== undefined &&
          typeof component.schema !== 'object'
        )
          return []
        return [
          [
            key,
            {
              label:
                typeof component.label === 'string' ? component.label : key,
              schema: asRecord(component.schema),
            } satisfies ComponentBlockConfig,
          ],
        ]
      }),
    ) as Record<string, ComponentBlockConfig>,
  }
}

export function componentBlockInitialProps(schema: ComponentSchema) {
  return Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [
      key,
      initialComponentValue(asRecord(value)),
    ]),
  )
}

function initialComponentValue(schema: Record<string, unknown>): unknown {
  switch (schema.kind) {
    case 'form':
      return 'defaultValue' in schema ? schema.defaultValue : null
    case 'child':
      return null
    case 'relationship':
      return schema.many === true ? [] : null
    case 'array':
      return []
    case 'object':
      return componentBlockInitialProps(asRecord(schema.fields))
    case 'conditional': {
      const discriminant = initialComponentValue(asRecord(schema.discriminant))
      const values = asRecord(schema.values)
      return {
        discriminant,
        value: initialComponentValue(asRecord(values[String(discriminant)])),
      }
    }
    default:
      return null
  }
}

const listTypes = new Set(['ordered-list', 'unordered-list'])

export function RichDocumentEditor({
  initialDocument,
  placeholder,
  onChange,
  documentFeatures,
  relationships,
  componentBlocks,
  id,
}: {
  initialDocument: DocumentNode[] | undefined
  placeholder?: string
  onChange: (document: DocumentNode[]) => void
  documentFeatures?: DocumentEditorFeatures
  relationships?: Record<string, DocumentRelationshipConfig>
  componentBlocks?: Record<string, ComponentBlockConfig>
  id?: string
}) {
  const editorFeatures =
    documentFeatures ?? documentEditorConfig().documentFeatures
  const relationshipMap = relationships ?? {}
  const componentBlockMap = componentBlocks ?? {}
  const editor = useMemo(() => {
    const next = withReact(withHistory(createEditor()))
    const { isInline, isVoid } = next
    next.isInline = (element) => {
      const type = (element as unknown as DocumentNode).type
      return type === 'link' || type === 'relationship' || isInline(element)
    }
    next.isVoid = (element) =>
      (element as unknown as DocumentNode).type === 'divider' || isVoid(element)
    return next
  }, [])
  const renderElement = useCallback(
    (props: RenderElementProps) => (
      <DocumentElement
        {...props}
        relationships={relationshipMap}
        componentBlocks={componentBlockMap}
      />
    ),
    [componentBlockMap, relationshipMap],
  )
  const renderLeaf = useCallback(
    (props: RenderLeafProps) => <DocumentLeaf {...props} />,
    [],
  )
  const value = ensureEditableDocument(initialDocument)
  const incomingValue = JSON.stringify(value)

  useEffect(() => {
    if (JSON.stringify(editor.children) === incomingValue) return
    editor.children = structuredClone(value) as unknown as Descendant[]
    editor.selection = null
    const historyEditor = editor as typeof editor & HistoryEditor
    historyEditor.history = { undos: [], redos: [] }
    editor.onChange()
  }, [editor, incomingValue, value])

  return (
    <div className="overflow-hidden rounded-lg border bg-background shadow-xs focus-within:ring-2 focus-within:ring-ring/30">
      <Slate
        editor={editor}
        initialValue={value as unknown as Descendant[]}
        onChange={(nextValue) => {
          if (
            editor.operations.some(
              (operation) => operation.type !== 'set_selection',
            )
          )
            onChange(nextValue as unknown as DocumentNode[])
        }}
      >
        <RichDocumentToolbar
          features={editorFeatures}
          relationships={relationshipMap}
          componentBlocks={componentBlockMap}
        />
        <Editable
          id={id}
          aria-label="Rich document content"
          className="min-h-48 px-4 py-3 text-sm leading-6 outline-none [&_[data-slate-placeholder]]:text-muted-foreground"
          placeholder={placeholder || 'Write document content…'}
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          spellCheck
          onKeyDown={(event) => handleEditorKeyDown(event, editor)}
        />
      </Slate>
    </div>
  )
}

function RichDocumentToolbar({
  features,
  relationships,
  componentBlocks,
}: {
  features: DocumentEditorFeatures
  relationships: Record<string, DocumentRelationshipConfig>
  componentBlocks: Record<string, ComponentBlockConfig>
}) {
  const editor = useSlate()
  return (
    <div
      className="flex flex-wrap items-center gap-1 border-b bg-muted/30 p-2"
      role="toolbar"
      aria-label="Document formatting"
    >
      <ToolbarButton
        label="Undo"
        onClick={() => HistoryEditor.undo(editor as Editor & HistoryEditor)}
      >
        <Undo2 />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        onClick={() => HistoryEditor.redo(editor as Editor & HistoryEditor)}
      >
        <Redo2 />
      </ToolbarButton>
      <ToolbarSeparator />
      {features.formatting.inlineMarks.bold ? (
        <MarkButton editor={editor} mark="bold" label="Bold">
          <Bold />
        </MarkButton>
      ) : null}
      {features.formatting.inlineMarks.italic ? (
        <MarkButton editor={editor} mark="italic" label="Italic">
          <Italic />
        </MarkButton>
      ) : null}
      {features.formatting.inlineMarks.underline ? (
        <MarkButton editor={editor} mark="underline" label="Underline">
          <Underline />
        </MarkButton>
      ) : null}
      {features.formatting.inlineMarks.strikethrough ? (
        <MarkButton editor={editor} mark="strikethrough" label="Strikethrough">
          <Strikethrough />
        </MarkButton>
      ) : null}
      {features.formatting.inlineMarks.code ? (
        <MarkButton editor={editor} mark="code" label="Inline code">
          <Code2 />
        </MarkButton>
      ) : null}
      <ToolbarSeparator />
      {features.formatting.headingLevels.includes(1) ? (
        <BlockButton editor={editor} block="heading-one" label="Heading 1">
          <Heading1 />
        </BlockButton>
      ) : null}
      {features.formatting.headingLevels.includes(2) ? (
        <BlockButton editor={editor} block="heading-two" label="Heading 2">
          <Heading2 />
        </BlockButton>
      ) : null}
      {features.formatting.blockTypes.blockquote ? (
        <BlockButton editor={editor} block="blockquote" label="Block quote">
          <Quote />
        </BlockButton>
      ) : null}
      {features.formatting.listTypes.unordered ? (
        <BlockButton
          editor={editor}
          block="unordered-list"
          label="Bulleted list"
        >
          <List />
        </BlockButton>
      ) : null}
      {features.formatting.listTypes.ordered ? (
        <BlockButton editor={editor} block="ordered-list" label="Numbered list">
          <ListOrdered />
        </BlockButton>
      ) : null}
      <ToolbarSeparator />
      <AlignmentButton editor={editor} alignment="start" label="Align left">
        <AlignLeft />
      </AlignmentButton>
      {features.formatting.alignment.center ? (
        <AlignmentButton
          editor={editor}
          alignment="center"
          label="Align center"
        >
          <AlignCenter />
        </AlignmentButton>
      ) : null}
      {features.formatting.alignment.end ? (
        <AlignmentButton editor={editor} alignment="end" label="Align right">
          <AlignRight />
        </AlignmentButton>
      ) : null}
      <ToolbarSeparator />
      {features.links ? (
        <ToolbarButton
          label="Add or edit link"
          onClick={() => editLink(editor)}
        >
          <LinkIcon />
        </ToolbarButton>
      ) : null}
      {features.dividers ? (
        <ToolbarButton
          label="Insert divider"
          onClick={() => insertDivider(editor)}
        >
          <Minus />
        </ToolbarButton>
      ) : null}
      <InsertDocumentMenu
        editor={editor}
        features={features}
        relationships={relationships}
        componentBlocks={componentBlocks}
      />
    </div>
  )
}

function ToolbarSeparator() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
}

function InsertDocumentMenu({
  editor,
  features,
  relationships,
  componentBlocks,
}: {
  editor: Editor
  features: DocumentEditorFeatures
  relationships: Record<string, DocumentRelationshipConfig>
  componentBlocks: Record<string, ComponentBlockConfig>
}) {
  const [value, setValue] = useState('')
  const selectionBeforeMenu = useRef(editor.selection)
  const options = [
    ...features.formatting.headingLevels.map((level) => ({
      value: `heading:${level}`,
      label: `Heading ${level}`,
    })),
    ...(features.formatting.blockTypes.code
      ? [{ value: 'code', label: 'Code block' }]
      : []),
    ...(features.formatting.blockTypes.blockquote
      ? [{ value: 'blockquote', label: 'Block quote' }]
      : []),
    ...(features.formatting.listTypes.unordered
      ? [{ value: 'unordered-list', label: 'Bulleted list' }]
      : []),
    ...(features.formatting.listTypes.ordered
      ? [{ value: 'ordered-list', label: 'Numbered list' }]
      : []),
    ...(features.dividers ? [{ value: 'divider', label: 'Divider' }] : []),
    ...features.layouts.map((layout, index) => ({
      value: `layout:${index}`,
      label: `Layout ${layout.join(' / ')}`,
    })),
    ...Object.entries(componentBlocks).map(([key, block]) => ({
      value: `component:${key}`,
      label: block.label,
    })),
    ...Object.entries(relationships).map(([key, relationship]) => ({
      value: `relationship:${key}`,
      label: relationship.label,
    })),
  ]

  return (
    <select
      aria-label="Insert document block"
      className="h-8 rounded-md border bg-background px-2 text-xs"
      value={value}
      onMouseDown={(event) => {
        selectionBeforeMenu.current = editor.selection
          ? structuredClone(editor.selection)
          : null
        event.stopPropagation()
      }}
      onChange={(event) => {
        const next = event.target.value
        setValue('')
        if (!next) return
        const selection = selectionBeforeMenu.current
        if (selection) Transforms.select(editor, selection)
        selectionBeforeMenu.current = null
        insertDocumentOption(
          editor,
          next,
          features,
          relationships,
          componentBlocks,
        )
      }}
    >
      <option value="">Insert…</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function insertDocumentOption(
  editor: Editor,
  option: string,
  features: DocumentEditorFeatures,
  relationships: Record<string, DocumentRelationshipConfig>,
  componentBlocks: Record<string, ComponentBlockConfig>,
) {
  const [kind, value] = option.split(':')
  if (kind === 'relationship' && value && relationships[value]) {
    if (!editor.selection) Transforms.select(editor, Editor.end(editor, []))
    Transforms.insertNodes(editor, {
      type: 'relationship',
      relationship: value,
      data: null,
      children: [{ text: '' }],
    } as never)
    return
  }
  if (kind === 'component' && value && componentBlocks[value]) {
    insertBlockNode(editor, {
      type: 'component-block',
      component: value,
      props: componentBlockInitialProps(componentBlocks[value].schema),
      children: [{ text: '' }],
    })
    return
  }
  if (kind === 'layout' && value) {
    const layout = features.layouts[Number(value)]
    if (layout) {
      insertBlockNode(editor, {
        type: 'layout',
        layout,
        children: layout.map(() => ({
          type: 'layout-area',
          children: [{ type: 'paragraph', children: [{ text: '' }] }],
        })),
      })
    }
    return
  }
  if (kind === 'heading' && value) {
    insertBlockNode(editor, {
      type: 'heading',
      level: Number(value),
      children: [{ text: '' }],
    })
    return
  }
  if (option === 'divider') {
    insertDivider(editor)
    return
  }
  if (
    option === 'code' ||
    option === 'blockquote' ||
    option === 'ordered-list' ||
    option === 'unordered-list'
  ) {
    insertBlockNode(editor, { type: option, children: [{ text: '' }] })
  }
}

function insertBlockNode(editor: Editor, node: Record<string, unknown>) {
  if (!editor.selection) Transforms.select(editor, Editor.end(editor, []))
  const entry = Editor.above(editor, {
    match: (candidate) => {
      if (!SlateElement.isElement(candidate)) return false
      const candidateType = (candidate as unknown as DocumentNode).type
      return candidateType === 'paragraph' || candidateType === 'heading'
    },
  })
  if (entry && Node.string(entry[0]).trim() === '')
    Transforms.removeNodes(editor, { at: entry[1] })
  Transforms.insertNodes(editor, node as never)
}

function ToolbarButton({
  label,
  active,
  children,
  onClick,
}: {
  label: string
  active?: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon-sm"
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      className="[&_svg]:size-4"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function MarkButton({
  editor,
  mark,
  label,
  children,
}: {
  editor: Editor
  mark: Mark
  label: string
  children: ReactNode
}) {
  return (
    <ToolbarButton
      label={label}
      active={isMarkActive(editor, mark)}
      onClick={() => toggleMark(editor, mark)}
    >
      {children}
    </ToolbarButton>
  )
}

function BlockButton({
  editor,
  block,
  label,
  children,
}: {
  editor: Editor
  block: Block
  label: string
  children: ReactNode
}) {
  return (
    <ToolbarButton
      label={label}
      active={isBlockActive(editor, block)}
      onClick={() => toggleBlock(editor, block)}
    >
      {children}
    </ToolbarButton>
  )
}

function AlignmentButton({
  editor,
  alignment,
  label,
  children,
}: {
  editor: Editor
  alignment: Alignment
  label: string
  children: ReactNode
}) {
  return (
    <ToolbarButton
      label={label}
      active={isAlignmentActive(editor, alignment)}
      onClick={() => toggleAlignment(editor, alignment)}
    >
      {children}
    </ToolbarButton>
  )
}

function isMarkActive(editor: Editor, mark: Mark) {
  return (
    (Editor.marks(editor) as Record<string, unknown> | null)?.[mark] === true
  )
}

function toggleMark(editor: Editor, mark: Mark) {
  if (isMarkActive(editor, mark)) Editor.removeMark(editor, mark)
  else Editor.addMark(editor, mark, true)
}

function blockProperties(block: Block): Record<string, unknown> {
  if (block === 'heading-one') return { type: 'heading', level: 1 }
  if (block === 'heading-two') return { type: 'heading', level: 2 }
  return { type: block }
}

function isBlockActive(editor: Editor, block: Block) {
  const expected = blockProperties(block)
  return Boolean(
    Editor.above(editor, {
      match: (node) => {
        if (!SlateElement.isElement(node)) return false
        const record = node as unknown as DocumentNode
        return Object.entries(expected).every(
          ([key, value]) => record[key] === value,
        )
      },
    }),
  )
}

function toggleBlock(editor: Editor, block: Block) {
  const active = isBlockActive(editor, block)
  const list = listTypes.has(block)
  Transforms.unwrapNodes(editor, {
    match: (node) =>
      SlateElement.isElement(node) &&
      listTypes.has((node as unknown as DocumentNode).type ?? ''),
    split: true,
  })
  const properties = active
    ? { type: 'paragraph', level: undefined }
    : list
      ? { type: 'list-item', level: undefined }
      : blockProperties(block)
  Transforms.setNodes(editor, properties, {
    match: (node) =>
      SlateElement.isElement(node) && Editor.isBlock(editor, node),
  })
  if (!active && list) {
    Transforms.wrapNodes(editor, {
      type: block,
      children: [],
    } as never)
  }
}

function isAlignmentActive(editor: Editor, alignment: Alignment) {
  return Boolean(
    Editor.above(editor, {
      match: (node) =>
        SlateElement.isElement(node) &&
        ((node as unknown as DocumentNode).textAlign ?? 'start') === alignment,
    }),
  )
}

function toggleAlignment(editor: Editor, alignment: Alignment) {
  const active = isAlignmentActive(editor, alignment)
  Transforms.setNodes(
    editor,
    {
      textAlign: active || alignment === 'start' ? undefined : alignment,
    } as never,
    {
      match: (node) =>
        SlateElement.isElement(node) && Editor.isBlock(editor, node),
    },
  )
}

function editLink(editor: Editor) {
  if (!editor.selection) return
  const existing = Editor.above(editor, {
    match: (node) =>
      SlateElement.isElement(node) &&
      (node as unknown as DocumentNode).type === 'link',
  })
  const currentHref = existing
    ? String((existing[0] as unknown as DocumentNode).href ?? '')
    : ''
  const href = window.prompt('Link URL', currentHref || 'https://')
  if (href === null) return
  if (existing) Transforms.unwrapNodes(editor, { at: existing[1] })
  const safe = safeHref(href)
  if (!safe || Range.isCollapsed(editor.selection)) return
  Transforms.wrapNodes(
    editor,
    { type: 'link', href: safe, children: [] } as never,
    { split: true },
  )
}

function insertDivider(editor: Editor) {
  Transforms.insertNodes(editor, {
    type: 'divider',
    children: [{ text: '' }],
  } as never)
  Transforms.insertNodes(editor, {
    type: 'paragraph',
    children: [{ text: '' }],
  } as never)
}

function handleEditorKeyDown(event: KeyboardEvent, editor: Editor) {
  if (!(event.metaKey || event.ctrlKey)) return
  const key = event.key.toLowerCase()
  const mark =
    key === 'b'
      ? 'bold'
      : key === 'i'
        ? 'italic'
        : key === 'u'
          ? 'underline'
          : key === '`'
            ? 'code'
            : event.shiftKey && key === 'x'
              ? 'strikethrough'
              : null
  if (!mark) return
  event.preventDefault()
  toggleMark(editor, mark)
}

function InlineRelationshipElement({
  attributes,
  children,
  element,
  relationships,
}: RenderElementProps & {
  relationships: Record<string, DocumentRelationshipConfig>
}) {
  const editor = useSlateStatic()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const relationshipKey = String(
    (element as unknown as DocumentNode).relationship ?? '',
  )
  const config = relationships[relationshipKey]
  const data = asRecord((element as unknown as DocumentNode).data)
  const optionsConfig = {
    labelField: config?.labelField,
    searchFields: config?.labelField ? [config.labelField] : undefined,
  }
  const {
    data: options = { items: [], count: 0 },
    isLoading,
    error,
  } = useQuery({
    queryKey: dashboardQueryKeys.relationshipOptions(
      config?.listKey ?? '',
      search,
      10,
      0,
      optionsConfig,
    ),
    queryFn: () =>
      fetchDashboardRelationshipOptions({
        listKey: config?.listKey ?? '',
        search,
        take: 10,
        skip: 0,
        config: optionsConfig,
      }),
    enabled: Boolean(open && config?.listKey),
  })

  function choose(option: {
    id: string
    label: string
    data?: Record<string, unknown>
  }) {
    const path = ReactEditor.findPath(editor as Editor & ReactEditor, element)
    Transforms.setNodes(
      editor,
      {
        data: {
          id: option.id,
          label: option.label,
          ...(option.data ? { data: option.data } : {}),
        },
      } as never,
      { at: path },
    )
    setOpen(false)
  }

  return (
    <span {...attributes} className="inline-flex items-center align-baseline">
      <span
        contentEditable={false}
        className="relative inline-flex items-center"
      >
        <button
          type="button"
          aria-label={`${config?.label ?? 'Relationship'} selector`}
          aria-expanded={open}
          className="rounded border bg-muted/30 px-1.5 py-0.5 text-xs text-primary hover:bg-muted"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((current) => !current)}
        >
          {typeof data.label === 'string'
            ? data.label
            : (config?.label ?? 'Select relationship')}
        </button>
        {open ? (
          <div
            role="dialog"
            aria-label={`${config?.label ?? 'Relationship'} options`}
            className="absolute left-0 top-full z-30 mt-1 w-64 rounded-md border bg-background p-2 shadow-lg"
          >
            <Input
              autoFocus
              value={search}
              placeholder="Search related items…"
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="mt-2 max-h-40 overflow-auto">
              {isLoading ? (
                <p className="p-2 text-xs text-muted-foreground">Loading…</p>
              ) : null}
              {error ? (
                <p className="p-2 text-xs text-destructive">
                  Unable to load options.
                </p>
              ) : null}
              {!isLoading && !error && options.items.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">
                  No related items found.
                </p>
              ) : null}
              {options.items.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </span>
      {children}
    </span>
  )
}

function ComponentSchemaEditor({
  schema,
  value,
  onChange,
  relationships,
  path = '',
}: {
  schema: Record<string, unknown>
  value: unknown
  onChange: (value: unknown) => void
  relationships: Record<string, DocumentRelationshipConfig>
  path?: string
}) {
  const kind = schema.kind
  if (kind === 'child')
    return (
      <p className="text-xs text-muted-foreground">
        {String(
          asRecord(schema.options).placeholder ?? 'Editable content below',
        )}
      </p>
    )
  if (kind === 'form') {
    const options = Array.isArray(schema.options) ? schema.options : []
    const current = value ?? schema.defaultValue ?? ''
    const inputType = typeof current === 'number' ? 'number' : 'text'
    return (
      <label className="block space-y-1 text-xs">
        <span className="text-muted-foreground">{path || 'Value'}</span>
        {options.length ? (
          <select
            className="h-8 w-full rounded-md border bg-background px-2"
            value={String(current)}
            onChange={(event) => onChange(event.target.value)}
          >
            {options.map((option) => {
              const entry = asRecord(option)
              const optionValue = entry.value ?? option
              return (
                <option key={String(optionValue)} value={String(optionValue)}>
                  {String(entry.label ?? optionValue)}
                </option>
              )
            })}
          </select>
        ) : (
          <Input
            type={inputType}
            value={String(current)}
            onChange={(event) =>
              onChange(
                inputType === 'number'
                  ? Number(event.target.value)
                  : event.target.value,
              )
            }
          />
        )}
      </label>
    )
  }
  if (kind === 'relationship') {
    const relationship = asRecord(schema)
    const config = relationships[String(relationship.listKey ?? '')]
    return (
      <ComponentRelationshipField
        config={
          config ?? {
            listKey: String(relationship.listKey ?? ''),
            label: path || 'Relationship',
          }
        }
        many={relationship.many === true}
        value={value}
        onChange={onChange}
      />
    )
  }
  if (kind === 'object') {
    const fields = asRecord(schema.fields)
    const current = asRecord(value)
    return (
      <div className="space-y-2 rounded border border-dashed p-2">
        {Object.entries(fields).map(([key, childSchema]) => (
          <ComponentSchemaEditor
            key={key}
            schema={asRecord(childSchema)}
            value={current[key]}
            path={path ? `${path}.${key}` : key}
            relationships={relationships}
            onChange={(next) => onChange({ ...current, [key]: next })}
          />
        ))}
      </div>
    )
  }
  if (kind === 'conditional') {
    const current = asRecord(value)
    const discriminantSchema = asRecord(schema.discriminant)
    const values = asRecord(schema.values)
    const discriminant =
      current.discriminant ?? discriminantSchema.defaultValue ?? ''
    return (
      <div className="space-y-2 rounded border border-dashed p-2">
        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">{path || 'Variant'}</span>
          <Input
            value={String(discriminant)}
            onChange={(event) => {
              const next = event.target.value
              onChange({
                discriminant: next,
                value: initialComponentValue(asRecord(values[next])),
              })
            }}
          />
        </label>
        <ComponentSchemaEditor
          schema={asRecord(values[String(discriminant)])}
          value={current.value}
          path={`${path}.value`}
          relationships={relationships}
          onChange={(next) =>
            onChange({ ...current, discriminant, value: next })
          }
        />
      </div>
    )
  }
  if (kind === 'array') {
    const current = Array.isArray(value) ? value : []
    return (
      <label className="block space-y-1 text-xs">
        <span className="text-muted-foreground">{path || 'Items'}</span>
        <textarea
          className="min-h-16 w-full rounded-md border bg-background p-2 font-mono text-xs"
          value={JSON.stringify(current, null, 2)}
          onChange={(event) => {
            try {
              onChange(JSON.parse(event.target.value))
            } catch {
              /* validation reports malformed props on save */
            }
          }}
        />
      </label>
    )
  }
  return null
}

function ComponentRelationshipField({
  config,
  many,
  value,
  onChange,
}: {
  config: DocumentRelationshipConfig
  many: boolean
  value: unknown
  onChange: (value: unknown) => void
}) {
  const [search, setSearch] = useState('')
  const { data: options = { items: [], count: 0 }, isLoading } = useQuery({
    queryKey: dashboardQueryKeys.relationshipOptions(
      config.listKey,
      search,
      10,
      0,
      {
        labelField: config.labelField,
      },
    ),
    queryFn: () =>
      fetchDashboardRelationshipOptions({
        listKey: config.listKey,
        search,
        take: 10,
        skip: 0,
        config: { labelField: config.labelField },
      }),
    enabled: Boolean(config.listKey),
  })
  const selected = many
    ? Array.isArray(value)
      ? value
      : []
    : value
      ? [value]
      : []
  const selectedIds = new Set(
    selected.map((entry) => String(asRecord(entry).id ?? '')),
  )
  return (
    <div className="space-y-1 text-xs">
      <span className="text-muted-foreground">{config.label}</span>
      <Input
        value={search}
        placeholder="Search related items…"
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="max-h-24 overflow-auto rounded border">
        {isLoading ? (
          <p className="p-2 text-muted-foreground">Loading…</p>
        ) : null}
        {options.items.map((option) => {
          const selectedOption = selectedIds.has(option.id)
          return (
            <button
              key={option.id}
              type="button"
              className={cn(
                'block w-full px-2 py-1 text-left hover:bg-muted',
                selectedOption && 'bg-muted',
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const next = selectedOption
                  ? selected.filter(
                      (entry) => String(asRecord(entry).id) !== option.id,
                    )
                  : many
                    ? [...selected, option]
                    : [option]
                onChange(many ? next : (next[0] ?? null))
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DocumentElement({
  attributes,
  children,
  element,
  relationships = {},
  componentBlocks = {},
}: RenderElementProps & {
  relationships?: Record<string, DocumentRelationshipConfig>
  componentBlocks?: Record<string, ComponentBlockConfig>
}) {
  const editor = useSlateStatic()
  const node = element as unknown as DocumentNode
  const style = {
    textAlign:
      node.textAlign === 'center'
        ? ('center' as const)
        : node.textAlign === 'end'
          ? ('right' as const)
          : ('left' as const),
  }
  if (node.type === 'heading') {
    const level = Math.min(6, Math.max(1, Number(node.level) || 2))
    const tag = `h${level}`
    return createElement(
      tag,
      {
        ...attributes,
        style,
        className: cn(
          'mt-4 mb-2 font-semibold tracking-tight first:mt-0',
          level === 1 && 'text-2xl',
          level === 2 && 'text-xl',
          level >= 3 && 'text-lg',
        ),
      },
      children,
    )
  }
  if (node.type === 'blockquote')
    return (
      <blockquote
        {...attributes}
        style={style}
        className="my-3 border-l-2 pl-4 text-muted-foreground italic"
      >
        {children}
      </blockquote>
    )
  if (node.type === 'code')
    return (
      <pre
        {...attributes}
        className="my-3 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs"
      >
        <code>{children}</code>
      </pre>
    )
  if (node.type === 'ordered-list')
    return (
      <ol {...attributes} className="my-2 list-decimal space-y-1 pl-6">
        {children}
      </ol>
    )
  if (node.type === 'unordered-list')
    return (
      <ul {...attributes} className="my-2 list-disc space-y-1 pl-6">
        {children}
      </ul>
    )
  if (node.type === 'list-item') return <li {...attributes}>{children}</li>
  if (node.type === 'link')
    return (
      <a
        {...attributes}
        href={safeHref(String(node.href ?? '')) || undefined}
        className="text-primary underline underline-offset-2"
        onClick={(event) => event.preventDefault()}
      >
        {children}
      </a>
    )
  if (node.type === 'divider')
    return (
      <div {...attributes} contentEditable={false} className="my-4 py-1">
        {children}
        <hr className="border-border" />
      </div>
    )
  if (node.type === 'layout')
    return (
      <div
        {...attributes}
        data-document-node="layout"
        className="my-3 grid gap-3 rounded-md border border-dashed p-3"
        style={{
          gridTemplateColumns: Array.isArray(node.layout)
            ? node.layout.map((ratio) => `${Number(ratio) || 1}fr`).join(' ')
            : undefined,
        }}
      >
        {children}
      </div>
    )
  if (node.type === 'layout-area')
    return (
      <div {...attributes} className="min-w-0 rounded bg-muted/20 p-2">
        {children}
      </div>
    )
  if (node.type === 'relationship')
    return (
      <InlineRelationshipElement
        attributes={attributes}
        children={children}
        element={element}
        relationships={relationships}
      />
    )
  if (node.type === 'component-block') {
    const block =
      typeof node.component === 'string'
        ? componentBlocks[node.component]
        : undefined
    const path = ReactEditor.findPath(editor as Editor & ReactEditor, element)
    return (
      <div
        {...attributes}
        data-document-node="component-block"
        className="my-3 rounded-md border bg-muted/20 p-3"
      >
        <div
          contentEditable={false}
          className="mb-2 text-xs font-medium text-muted-foreground"
        >
          {block?.label ?? `Component: ${String(node.component ?? 'unknown')}`}
        </div>
        {block ? (
          <div contentEditable={false} className="mb-2 space-y-2">
            <ComponentSchemaEditor
              schema={{ kind: 'object', fields: block.schema }}
              value={node.props}
              relationships={relationships}
              onChange={(props) =>
                Transforms.setNodes(editor, { props } as never, { at: path })
              }
            />
          </div>
        ) : null}
        {children}
      </div>
    )
  }
  return (
    <p {...attributes} style={style} className="my-2 first:mt-0 last:mb-0">
      {children}
    </p>
  )
}

function DocumentLeaf({ attributes, children, leaf }: RenderLeafProps) {
  const marks = leaf as unknown as Record<string, unknown>
  let content = children
  if (marks.bold) content = <strong>{content}</strong>
  if (marks.italic) content = <em>{content}</em>
  if (marks.underline) content = <u>{content}</u>
  if (marks.strikethrough) content = <s>{content}</s>
  if (marks.code)
    content = (
      <code className="rounded bg-muted px-1 py-0.5 text-xs">{content}</code>
    )
  if (marks.superscript) content = <sup>{content}</sup>
  if (marks.subscript) content = <sub>{content}</sub>
  if (marks.keyboard)
    content = (
      <kbd className="rounded border bg-muted px-1 text-xs">{content}</kbd>
    )
  return <span {...attributes}>{content}</span>
}

function ensureEditableDocument(document: DocumentNode[] | undefined) {
  if (Array.isArray(document) && document.length > 0) return document
  return [{ type: 'paragraph', children: [{ text: '' }] }]
}

function safeHref(value: string) {
  const href = value.trim()
  if (!href) return ''
  if (href.startsWith('/') || href.startsWith('#')) return href
  try {
    const parsed = new URL(href)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)
      ? href
      : ''
  } catch {
    return ''
  }
}
