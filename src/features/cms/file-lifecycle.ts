import { deleteStoredObject } from './storage'
import { getStorageConfig } from './storage-config'
import type { CmsStorageConfig } from './storage-config'
import type { CmsField } from './types'
import type { CmsItem } from './adapters'

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function storageKeyForField(field: CmsField) {
  return typeof field.fieldMeta?.storage === 'string'
    ? field.fieldMeta.storage
    : undefined
}

function filenameFromStoredValue(value: unknown) {
  const record = asRecord(value)
  const filename = record?.filename
  return typeof filename === 'string' && filename.length > 0
    ? filename
    : undefined
}

function isSameStoredFile(previous: unknown, next: unknown) {
  const previousRecord = asRecord(previous)
  const nextRecord = asRecord(next)
  return Boolean(
    previousRecord?.filename &&
    nextRecord &&
    previousRecord.filename === nextRecord.filename &&
    previousRecord.storage === nextRecord.storage,
  )
}

async function deleteStoredFile(
  field: CmsField,
  value: unknown,
  storageConfigs?: Record<string, CmsStorageConfig>,
) {
  const storageKey = storageKeyForField(field)
  if (!storageKey) return
  const filename = filenameFromStoredValue(value)
  if (!filename) return
  const storage = storageConfigs?.[storageKey] ?? getStorageConfig(storageKey)
  if (!storage || storage.preserve) return
  await deleteStoredObject(storageKey, filename, storage)
}

export async function cleanupReplacedFiles(
  fields: CmsField[],
  originalItem: CmsItem | null | undefined,
  nextData: Record<string, unknown>,
  storageConfigs?: Record<string, CmsStorageConfig>,
) {
  if (!originalItem) return
  for (const field of fields) {
    if (field.kind !== 'image' && field.kind !== 'file') continue
    if (!(field.path in nextData)) continue
    const previous = originalItem[field.path]
    const next = nextData[field.path]
    if (!previous || isSameStoredFile(previous, next)) continue
    await deleteStoredFile(field, previous, storageConfigs)
  }
}

export async function cleanupDeletedItemFiles(
  fields: CmsField[],
  item: CmsItem | null | undefined,
  storageConfigs?: Record<string, CmsStorageConfig>,
) {
  if (!item) return
  for (const field of fields) {
    if (field.kind !== 'image' && field.kind !== 'file') continue
    await deleteStoredFile(field, item[field.path], storageConfigs)
  }
}
