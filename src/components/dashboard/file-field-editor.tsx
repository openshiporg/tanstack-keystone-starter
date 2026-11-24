import { FileIcon, ImageIcon, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'

import { Button } from '@/components/ui/button'
import type { DashboardField } from '@/features/cms/graphql-client'

export type FileFieldStoredValue = {
  id?: string
  filename?: string
  filesize?: number
  url?: string
  extension?: string
  width?: number
  height?: number
  storage?: string
}

export type FileFieldPendingUpload = {
  file: File
  filename: string
  filesize: number
  previewUrl?: string
}

export type FileFieldEditorValue =
  | { kind: 'empty' }
  | { kind: 'from-server'; data: FileFieldStoredValue }
  | { kind: 'upload'; data: FileFieldPendingUpload }
  | {
      kind: 'remove'
      previous?: Exclude<FileFieldEditorValue, { kind: 'remove' }>
    }

function asStoredValue(value: unknown): FileFieldStoredValue | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value
}

function isPendingUpload(
  value: FileFieldStoredValue | FileFieldPendingUpload,
): value is FileFieldPendingUpload {
  return 'file' in value
}

function activeValue(
  value: FileFieldEditorValue,
): FileFieldStoredValue | FileFieldPendingUpload | null {
  if (value.kind === 'from-server' || value.kind === 'upload') return value.data
  return null
}

function fileLabel(
  field: DashboardField,
  value: FileFieldStoredValue | FileFieldPendingUpload,
) {
  if (typeof value.filename === 'string' && value.filename.trim())
    return value.filename
  if (
    !isPendingUpload(value) &&
    field.kind === 'image' &&
    typeof value.id === 'string' &&
    typeof value.extension === 'string'
  )
    return `${value.id}.${value.extension}`
  if (
    !isPendingUpload(value) &&
    typeof value.id === 'string' &&
    value.id.trim()
  )
    return value.id
  return field.kind === 'image' ? 'Uploaded image' : 'Uploaded file'
}

function formatBytes(bytes: number | undefined) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function imageDimensions(value: FileFieldStoredValue | FileFieldPendingUpload) {
  return !isPendingUpload(value) &&
    Number.isFinite(value.width) &&
    Number.isFinite(value.height)
    ? `${value.width}×${value.height}`
    : null
}

function pendingUploadFromFile(file: File): FileFieldPendingUpload {
  return {
    file,
    filename: file.name,
    filesize: file.size,
    previewUrl: file.type.startsWith('image/')
      ? URL.createObjectURL(file)
      : undefined,
  }
}

export function normalizeFileFieldEditorValue(
  value: unknown,
): FileFieldEditorValue {
  if (!value) return { kind: 'empty' }
  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return { kind: 'empty' }
    try {
      return normalizeFileFieldEditorValue(JSON.parse(raw) as unknown)
    } catch {
      return { kind: 'empty' }
    }
  }
  if (typeof value === 'object' && !Array.isArray(value) && 'kind' in value) {
    const kind = (value as { kind?: unknown }).kind
    if (kind === 'empty') return { kind: 'empty' }
    if (kind === 'remove') {
      const previous = (value as { previous?: unknown }).previous
      const normalizedPrevious = previous
        ? normalizeFileFieldEditorValue(previous)
        : undefined
      return {
        kind: 'remove',
        previous:
          normalizedPrevious?.kind === 'remove'
            ? normalizedPrevious.previous
            : normalizedPrevious,
      }
    }
    if (kind === 'from-server') {
      const data = asStoredValue((value as { data?: unknown }).data)
      if (!data) return { kind: 'empty' }
      return { kind, data }
    }
    if (kind === 'upload') {
      const data = (value as { data?: unknown }).data
      if (
        data &&
        typeof data === 'object' &&
        'file' in (data as Record<string, unknown>)
      )
        return { kind, data: data as FileFieldPendingUpload }
      const stored = asStoredValue(data)
      if (!stored) return { kind: 'empty' }
      return { kind: 'from-server', data: stored }
    }
  }
  const stored = asStoredValue(value)
  if (!stored) return { kind: 'empty' }
  return { kind: 'from-server', data: stored }
}

export function FileFieldEditor({
  field,
  value,
  onChange,
}: {
  field: DashboardField
  value: FileFieldEditorValue
  onChange?: (value: FileFieldEditorValue) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const current = activeValue(value)
  const inputKey = useMemo(
    () =>
      `${value.kind}-${current && !isPendingUpload(current) ? (current.id ?? current.filename) : (current?.filename ?? 'empty')}`,
    [current, value.kind],
  )

  useEffect(() => {
    if (!current || !isPendingUpload(current) || !current.previewUrl) return
    return () => {
      URL.revokeObjectURL(current.previewUrl!)
    }
  }, [current])

  function selectFile(file: File) {
    if (!onChange) return
    onChange({ kind: 'upload', data: pendingUploadFromFile(file) })
    if (inputRef.current) inputRef.current.value = ''
  }

  const bytesLabel = current ? formatBytes(current.filesize) : null
  const dimensionsLabel = current ? imageDimensions(current) : null
  const statusLabel =
    value.kind === 'upload'
      ? 'Pending save'
      : value.kind === 'remove'
        ? 'Marked for removal'
        : null

  return (
    <div className="space-y-3 rounded-[10px] p-3 shadow-[inset_0_0_0_1px_var(--ks-line)]">
      {current ? (
        <div className="overflow-hidden rounded-[10px] bg-[var(--ks-track)] shadow-[inset_0_0_0_1px_var(--ks-line)]">
          <div className="flex flex-col sm:flex-row">
            <div className="flex h-40 w-full items-center justify-center border-b border-[var(--ks-line)] bg-[var(--ks-surface-2)] sm:h-40 sm:w-40 sm:flex-none sm:border-r sm:border-b-0">
              {field.kind === 'image' &&
              ((isPendingUpload(current) && current.previewUrl) ||
                (!isPendingUpload(current) && current.url)) ? (
                <img
                  src={
                    isPendingUpload(current) ? current.previewUrl : current.url
                  }
                  alt={fileLabel(field, current)}
                  className="h-full w-full object-contain"
                />
              ) : field.kind === 'image' ? (
                <ImageIcon className="size-12 text-[var(--ks-dim)]" />
              ) : (
                <FileIcon className="size-12 text-[var(--ks-dim)]" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
              <div>
                <div
                  className="truncate text-[13px] font-medium"
                  title={fileLabel(field, current)}
                >
                  {fileLabel(field, current)}
                </div>
                <div className="text-[13px] text-[var(--ks-dim)]">
                  {[bytesLabel, dimensionsLabel].filter(Boolean).join(' • ') ||
                    'Ready to save'}
                </div>
                {statusLabel ? (
                  <div className="mt-1 text-[12px] font-medium text-[var(--ks-amber)]">
                    {statusLabel}
                  </div>
                ) : null}
              </div>
              {!isPendingUpload(current) && current.url ? (
                <a
                  className="truncate text-[12px] text-[var(--ks-accent-ink)] hover:underline"
                  href={current.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {current.url}
                </a>
              ) : null}
              {onChange ? (
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => inputRef.current?.click()}
                  >
                    <Upload className="size-3.5" />
                    Change
                  </Button>
                  {value.kind === 'from-server' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onChange({ kind: 'remove', previous: value })
                      }
                    >
                      <X className="size-3.5" />
                      Remove
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {onChange ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="size-3.5" />
                Upload {field.kind}
              </Button>
            ) : null}
            {value.kind === 'remove' && value.previous ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange?.(value.previous!)}
              >
                Undo removal
              </Button>
            ) : null}
          </div>
          {value.kind === 'remove' ? (
            <p className="text-[13px] text-[var(--ks-dim)]">
              This {field.kind} will be removed when you save.
            </p>
          ) : null}
        </div>
      )}
      {onChange ? (
        <input
          key={inputKey}
          ref={inputRef}
          id={`field-${field.path}`}
          type="file"
          className="hidden"
          accept={field.kind === 'image' ? 'image/*' : undefined}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) selectFile(file)
          }}
        />
      ) : null}
    </div>
  )
}
