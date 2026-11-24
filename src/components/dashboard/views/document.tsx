import { createElement, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type { DashboardField } from '@/features/cms/graphql-client'

import {
  componentBlockInitialProps,
  documentEditorConfig,
  RichDocumentEditor,
} from '@/components/dashboard/rich-document-editor'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export { componentBlockInitialProps, documentEditorConfig }

export function Field({
  field,
  value,
  onChange,
}: {
  field: DashboardField
  value: unknown
  onChange?: (value: unknown) => void
  view?: 'createView' | 'itemView'
}) {
  const normalized = useMemo(() => normalizeDocumentValue(value), [value])
  const [mode, setMode] = useState<'visual' | 'json'>('visual')
  const [visualRevision, setVisualRevision] = useState(0)
  const changeMode = (nextMode: 'visual' | 'json') => {
    if (nextMode === 'visual' && mode === 'json')
      setVisualRevision((revision) => revision + 1)
    setMode(nextMode)
  }

  if (!onChange) {
    if (!normalized.document)
      return <span className="text-[13px] text-[var(--ks-dim)]">—</span>
    return (
      <DocumentPreview
        field={field}
        value={normalized.document}
        compact={false}
      />
    )
  }

  if (mode === 'json') {
    return (
      <div className="space-y-3">
        <DocumentEditorToolbar mode={mode} onModeChange={changeMode} />
        <Textarea
          id={`field-${field.path}`}
          rows={10}
          value={asJsonEditorValue(value)}
          placeholder={field.description || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <p className="text-[12px] text-[var(--ks-dim)]">
          Advanced mode: edit the underlying document JSON directly. Invalid
          JSON will block save.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <DocumentEditorToolbar mode={mode} onModeChange={changeMode} />
      <RichDocumentEditor
        key={visualRevision}
        id={`field-${field.path}`}
        initialDocument={normalized.document}
        placeholder={field.description || undefined}
        {...documentEditorConfig(field.fieldMeta)}
        onChange={(document) => onChange(JSON.stringify({ document }, null, 2))}
      />
      <p className="text-[12px] text-[var(--ks-dim)]">
        Rich text is stored as Keystone-compatible structured document JSON.
        Switch to JSON for advanced blocks and diagnostics.
      </p>
    </div>
  )
}

export function Cell({
  field,
  item,
}: {
  field: DashboardField
  item: Record<string, unknown>
}) {
  const normalized = normalizeDocumentValue(item[field.path])
  if (!normalized.document)
    return <span className="text-[13px] text-[var(--ks-dim)]">—</span>
  const excerpt = normalized.plainText.trim()
  if (!excerpt) return <span className="text-[13px] text-[var(--ks-dim)]">—</span>
  const trimmed = excerpt.length > 120 ? `${excerpt.slice(0, 117)}…` : excerpt
  return <span className="text-[13px] text-[var(--ks-dim)]">{trimmed}</span>
}

export function controller(config: {
  path: string
  label: string
  description?: string | null
  fieldMeta: Record<string, unknown>
}) {
  return {
    path: config.path,
    label: config.label,
    description: config.description,
    graphqlSelection:
      typeof config.fieldMeta.graphqlSelection === 'string' &&
      config.fieldMeta.graphqlSelection.trim()
        ? config.fieldMeta.graphqlSelection
        : `${config.path} { document(hydrateRelationships: true) }`,
    defaultValue: '',
    deserialize: (item: Record<string, unknown>) => {
      const value = item[config.path]
      const normalized = normalizeDocumentValue(value)
      if (normalized.originalKind === 'string') return normalized.plainText
      if (!normalized.document) return ''
      return JSON.stringify({ document: normalized.document }, null, 2)
    },
    serialize: (value: unknown) => {
      if (Array.isArray(value))
        return { [config.path]: { document: normalizeDocumentNodes(value) } }
      if (value && typeof value === 'object') {
        const normalized = normalizeDocumentValue(value)
        return {
          [config.path]: normalized.document
            ? { document: normalized.document }
            : undefined,
        }
      }

      const raw = String(value ?? '').trim()
      if (!raw) return { [config.path]: undefined }
      try {
        const parsed = JSON.parse(raw) as unknown
        const normalized = normalizeDocumentValue(parsed)
        return {
          [config.path]: normalized.document
            ? { document: normalized.document }
            : undefined,
        }
      } catch {
        return { [config.path]: { document: textToDocument(raw) } }
      }
    },
    validate: (value: unknown, opts: { isRequired: boolean }) => {
      if (Array.isArray(value)) return value.length > 0 || !opts.isRequired
      if (value && typeof value === 'object')
        return normalizeDocumentValue(value).document !== undefined
      const raw = String(value ?? '').trim()
      if (!raw) return !opts.isRequired
      try {
        const parsed = JSON.parse(raw) as unknown
        return normalizeDocumentValue(parsed).document !== undefined
      } catch {
        return true
      }
    },
  }
}

export const allowedExportsOnCustomViews = ['Cell', 'CardValue']

type DocumentNode = {
  type?: string
  children?: DocumentNode[]
  text?: string
  [key: string]: unknown
}

function DocumentEditorToolbar({
  mode,
  onModeChange,
}: {
  mode: 'visual' | 'json'
  onModeChange: (mode: 'visual' | 'json') => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={mode === 'visual' ? 'default' : 'outline'}
        onClick={() => onModeChange('visual')}
      >
        Rich text
      </Button>
      <Button
        type="button"
        size="sm"
        variant={mode === 'json' ? 'default' : 'outline'}
        onClick={() => onModeChange('json')}
      >
        JSON
      </Button>
    </div>
  )
}

function DocumentPreview({
  field,
  value,
  compact = false,
}: {
  field: DashboardField
  value: DocumentNode[] | undefined
  compact?: boolean
}) {
  const plainText = documentToPlainText(value)
  const hasContent = plainText.trim().length > 0

  return (
    <Card size="sm" className={cn('bg-[var(--ks-track)] shadow-[inset_0_0_0_1px_var(--ks-line)]', compact && 'gap-2')}>
      <CardHeader className={cn(compact && 'pb-0')}>
        <CardTitle className="text-[13px]">
          {compact ? 'Preview' : field.label}
        </CardTitle>
        <CardDescription>
          {hasContent
            ? 'Structured document preview'
            : 'No document content yet'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasContent ? (
          <DocumentContent nodes={value ?? []} compact={compact} />
        ) : (
          <span className="text-[13px] text-[var(--ks-dim)]">—</span>
        )}
      </CardContent>
    </Card>
  )
}

function DocumentContent({
  nodes,
  compact = false,
}: {
  nodes: DocumentNode[]
  compact?: boolean
}) {
  return (
    <div className={cn('space-y-3 text-[13px]', compact && 'space-y-2')}>
      {nodes.map((node, index) => renderNode(node, `${index}`, compact))}
    </div>
  )
}

function renderNode(
  node: DocumentNode,
  key: string,
  compact: boolean,
): ReactNode {
  const text = nodeText(node).trim()
  const childNodes = Array.isArray(node.children) ? node.children : []

  if (node.type === 'paragraph') {
    if (!text) return null
    return (
      <p key={key} className="leading-6 whitespace-pre-wrap">
        {text}
      </p>
    )
  }

  if (node.type === 'heading') {
    const level = clampHeadingLevel(node)
    const Tag = `h${level}` as const
    return createElement(
      Tag,
      {
        key,
        className: cn(
          'font-semibold tracking-tight',
          headingClassName(level, compact),
        ),
      },
      text || 'Untitled heading',
    )
  }

  if (node.type === 'blockquote') {
    if (!text) return null
    return (
      <blockquote
        key={key}
        className="border-l-2 pl-3 text-[var(--ks-dim)] italic"
      >
        {text}
      </blockquote>
    )
  }

  if (node.type === 'layout') {
    return (
      <div
        key={key}
        className="grid gap-3 rounded-md border border-dashed p-3 md:grid-cols-2"
      >
        {childNodes.flatMap((child, index) => {
          if (child.type === 'layout-area')
            return (
              child.children?.map((grandchild, grandchildIndex) =>
                renderNode(
                  grandchild,
                  `${key}-${index}-${grandchildIndex}`,
                  compact,
                ),
              ) ?? []
            )
          return [renderNode(child, `${key}-${index}`, compact)]
        })}
      </div>
    )
  }

  if (node.type === 'ordered-list') {
    return renderList('ol', childNodes, key, compact)
  }

  if (node.type === 'unordered-list') {
    return renderList('ul', childNodes, key, compact)
  }

  if (node.type === 'list-item') {
    if (!text && !childNodes.length) return null
    return (
      <li key={key}>
        {text || childNodes.map((child) => nodeText(child)).join(' ')}
      </li>
    )
  }

  if (node.type === 'divider') {
    return <hr key={key} className="border-border" />
  }

  if (node.type === 'code') {
    if (!text) return null
    return (
      <pre key={key} className="overflow-auto rounded-[8px] bg-[var(--ks-track)] p-3 font-mono text-[12px] text-[var(--ks-ink-2)]">
        <code>{text}</code>
      </pre>
    )
  }

  if (childNodes.length > 0) {
    return (
      <div key={key} className="space-y-2">
        {childNodes.map((child, index) =>
          renderNode(child, `${key}-${index}`, compact),
        )}
      </div>
    )
  }

  if (!text) return null
  return (
    <p key={key} className="leading-6 whitespace-pre-wrap">
      {text}
    </p>
  )
}

function renderList(
  type: 'ol' | 'ul',
  nodes: DocumentNode[],
  key: string,
  compact: boolean,
) {
  const items = nodes
    .map((node, index) => renderNode(node, `${key}-${index}`, compact))
    .filter(Boolean)
  if (!items.length) return null
  const Tag = type
  return (
    <Tag
      key={key}
      className={cn(
        'space-y-1 pl-5',
        type === 'ol' ? 'list-decimal' : 'list-disc',
      )}
    >
      {items}
    </Tag>
  )
}

function headingClassName(level: number, compact: boolean) {
  if (level <= 1) return compact ? 'text-base' : 'text-xl'
  if (level === 2) return compact ? 'text-[13px]' : 'text-lg'
  return 'text-[13px]'
}

function clampHeadingLevel(node: DocumentNode) {
  const rawLevel =
    typeof (node as { level?: unknown }).level === 'number'
      ? Number((node as { level?: unknown }).level)
      : 2
  return Math.min(6, Math.max(1, rawLevel))
}

function asJsonEditorValue(value: unknown) {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return JSON.stringify(value, null, 2)
}

function nodeText(node: DocumentNode): string {
  const directText = typeof node.text === 'string' ? node.text : ''
  const children = Array.isArray(node.children) ? node.children : []
  const childText = children
    .map(nodeText)
    .join(node.type === 'list-item' ? ' ' : '')
  return `${directText}${childText}`
}

function documentToPlainText(document: DocumentNode[] | undefined) {
  if (!Array.isArray(document)) return ''
  return document
    .map((node) => nodeText(node).trim())
    .filter(Boolean)
    .join('\n\n')
}

function textToDocument(text: string): DocumentNode[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (!paragraphs.length) return []

  return paragraphs.map((paragraph) => ({
    type: 'paragraph',
    children: paragraph.split('\n').map((line, index, lines) => ({
      text: `${line}${index < lines.length - 1 ? '\n' : ''}`,
    })),
  }))
}

function normalizeDocumentValue(value: unknown): {
  document?: DocumentNode[]
  plainText: string
  originalKind: 'string' | 'document' | 'unknown'
} {
  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw)
      return { document: undefined, plainText: '', originalKind: 'string' }
    try {
      const parsed = JSON.parse(raw) as unknown
      const document = documentFromUnknown(parsed)
      return {
        document,
        plainText: documentToPlainText(document),
        originalKind: 'string',
      }
    } catch {
      const document = textToDocument(value)
      return { document, plainText: value, originalKind: 'string' }
    }
  }

  const document = documentFromUnknown(value)
  return {
    document,
    plainText: documentToPlainText(document),
    originalKind: document ? 'document' : 'unknown',
  }
}

function documentFromUnknown(value: unknown): DocumentNode[] | undefined {
  if (Array.isArray(value)) return normalizeDocumentNodes(value)
  if (
    value &&
    typeof value === 'object' &&
    Array.isArray((value as { document?: unknown }).document)
  ) {
    return normalizeDocumentNodes((value as { document: unknown[] }).document)
  }
  return undefined
}

function normalizeDocumentNodes(nodes: unknown[]): DocumentNode[] {
  return nodes
    .map(normalizeDocumentNode)
    .filter((node): node is DocumentNode => node !== null)
}

function normalizeDocumentNode(node: unknown): DocumentNode | null {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null
  const record = node as Record<string, unknown>
  const directText = typeof record.text === 'string' ? record.text : undefined
  const children = Array.isArray(record.children)
    ? normalizeDocumentNodes(record.children)
    : undefined
  const type = typeof record.type === 'string' ? record.type : undefined

  if (!type && directText === undefined && (!children || children.length === 0))
    return null

  const normalized = normalizeJsonObject(record) as DocumentNode
  if (children) normalized.children = children
  else delete normalized.children
  return normalized
}

function normalizeJsonObject(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype')
      continue
    const cloned = normalizeJsonValue(entry)
    if (cloned !== undefined) normalized[key] = cloned
  }
  return normalized
}

function normalizeJsonValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return value
  if (Array.isArray(value))
    return value.map(normalizeJsonValue).filter((entry) => entry !== undefined)
  if (value && typeof value === 'object')
    return normalizeJsonObject(value as Record<string, unknown>)
  return undefined
}
