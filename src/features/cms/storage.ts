import { mkdir, rm, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { Readable } from 'node:stream'
import type { Readable as NodeReadable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { createHash, createHmac } from 'node:crypto'

import { getStorageConfig, getStorageConfigs } from './storage-config'
import type {
  CmsStorageConfig,
  CmsStorageKind,
  CmsStorageType,
} from './storage-config'
import { storageUrl } from './storage-url'

export {
  getStorageConfig,
  getStorageConfigs,
  type CmsStorageConfig,
  type CmsStorageKind,
  type CmsStorageType,
}

export type StoredFileMetadata = {
  id: string
  filename: string
  filesize: number
  extension: string
  url: string
  storage: string
  width?: number
  height?: number
}

export type StoredUploadResult = StoredFileMetadata & {
  path: string
}

const defaultLocalStoragePath = 'public/files'
const defaultSignedExpirySeconds = 3600

export async function normaliseStoredFileMetadata(
  storageKey: string,
  file: { name: string; size: number; type?: string },
  id = createStoredFileId(file.name),
  storageOverride?: CmsStorageConfig,
  transformName?: (originalFilename: string) => string | Promise<string>,
): Promise<StoredFileMetadata> {
  const storage = storageOverride ?? getStorageConfig(storageKey)
  if (!storage) throw new Error(`Unknown storage ${storageKey}`)
  const transformedName = transformName
    ? await transformName(file.name)
    : undefined
  const baseFilename =
    transformedName ??
    `${id}${extensionFromFilename(file.name) ? `.${extensionFromFilename(file.name)}` : ''}`
  const extension = extensionFromFilename(baseFilename)
  const safeFilename = sanitizeFilename(baseFilename)
  const safeId =
    sanitizePathSegment(safeFilename.replace(/\.[^/.]+$/, '')) || 'upload'
  const filename = `${safeId}${extension ? `.${extension}` : ''}`
  return {
    id: safeId,
    filename,
    filesize: file.size,
    extension,
    storage: storageKey,
    url: storageUrl(storage, filename),
  }
}

export async function storeUploadedFile(
  storageKey: string,
  file: File,
  metadata?: StoredFileMetadata,
  storageOverride?: CmsStorageConfig,
): Promise<StoredUploadResult> {
  const storage = storageOverride ?? getStorageConfig(storageKey)
  if (!storage) throw new Error(`Unknown storage ${storageKey}`)
  assertUploadSize(storageKey, storage, file.size)
  return storeUploadedBytes(
    storageKey,
    file,
    Buffer.from(await file.arrayBuffer()),
    metadata,
    storage,
  )
}

export async function storeUploadedBytes(
  storageKey: string,
  file: { name: string; size: number; type?: string },
  bytes: Uint8Array,
  metadata?: StoredFileMetadata,
  storageOverride?: CmsStorageConfig,
): Promise<StoredUploadResult> {
  const storage = storageOverride ?? getStorageConfig(storageKey)
  if (!storage) throw new Error(`Unknown storage ${storageKey}`)
  assertUploadSize(storageKey, storage, bytes.byteLength)

  const normalized =
    metadata ??
    (await normaliseStoredFileMetadata(storageKey, file, undefined, storage))
  const safeFilename = sanitizeFilename(normalized.filename)
  if (safeFilename !== normalized.filename)
    throw new Error('Unsafe generated upload filename.')

  const imageMetadata =
    storage.type === 'image' ? imageMetadataFromBytes(bytes) : undefined
  if (storage.type === 'image' && !imageMetadata)
    throw new Error('File type not found')
  const finalFilename = imageMetadata
    ? `${normalized.id}.${imageMetadata.extension}`
    : safeFilename

  if (storage.kind === 'local') {
    const root = resolve(
      process.cwd(),
      storage.storagePath ?? defaultLocalStoragePath,
    )
    await mkdir(root, { recursive: true })
    const targetPath = resolve(root, finalFilename)
    if (!targetPath.startsWith(`${root}/`) && targetPath !== root)
      throw new Error('Refusing to write upload outside storage root.')

    await writeFile(targetPath, bytes)
    const imageFields = imageMetadata
      ? {
          extension: imageMetadata.extension,
          filename: finalFilename,
          url: storageUrl(storage, finalFilename),
          width: imageMetadata.width,
          height: imageMetadata.height,
        }
      : undefined
    return {
      ...normalized,
      ...imageFields,
      filesize: bytes.byteLength,
      path: targetPath,
    }
  }

  assertS3StorageConfig(storageKey, storage)
  await putRemoteObject(
    storage,
    finalFilename,
    bytes,
    contentTypeForUpload(storage.type, file.type, imageMetadata?.extension),
  )
  const remoteUrl = storageUrl(storage, finalFilename)
  const imageFields = imageMetadata
    ? {
        extension: imageMetadata.extension,
        filename: finalFilename,
        url: remoteUrl,
        width: imageMetadata.width,
        height: imageMetadata.height,
      }
    : undefined
  return {
    ...normalized,
    ...imageFields,
    filesize: bytes.byteLength,
    path: `s3://${storage.bucketName}/${finalFilename}`,
  }
}

export async function deleteStoredObject(
  storageKey: string,
  filename: string,
  storageOverride?: CmsStorageConfig,
) {
  const storage = storageOverride ?? getStorageConfig(storageKey)
  if (!storage) throw new Error(`Unknown storage ${storageKey}`)

  if (storage.kind === 'local') {
    const root = resolve(
      process.cwd(),
      storage.storagePath ?? defaultLocalStoragePath,
    )
    const safeFilename = sanitizeFilename(filename)
    if (safeFilename !== filename) throw new Error('Unsafe storage filename.')
    const targetPath = resolve(root, safeFilename)
    if (!targetPath.startsWith(`${root}/`) && targetPath !== root)
      throw new Error('Refusing to delete upload outside storage root.')
    await rm(targetPath, { force: true })
    return
  }

  assertS3StorageConfig(storageKey, storage)
  await deleteRemoteObject(storage, filename)
}

export async function storedUploadResponse(
  storageKey: string,
  file: File,
  transformName?: (originalFilename: string) => string | Promise<string>,
  storageOverride?: CmsStorageConfig,
  onStored?: (stored: StoredUploadResult) => void | Promise<void>,
) {
  const metadata = await normaliseStoredFileMetadata(
    storageKey,
    file,
    undefined,
    storageOverride,
    transformName,
  )
  const stored = await storeUploadedFile(
    storageKey,
    file,
    metadata,
    storageOverride,
  )
  await onStored?.(stored)
  const { path: _path, ...publicMetadata } = stored
  return publicMetadata
}

export async function storedGraphQLUploadResponse(
  storageKey: string,
  uploadValue: unknown,
  transformName?: (originalFilename: string) => string | Promise<string>,
  storageOverride?: CmsStorageConfig,
  onStored?: (stored: StoredUploadResult) => void | Promise<void>,
) {
  const upload = await unwrapUpload(uploadValue)
  if (upload instanceof File)
    return storedUploadResponse(
      storageKey,
      upload,
      transformName,
      storageOverride,
      onStored,
    )
  if (!isUploadLike(upload)) throw new Error('Invalid Upload value.')
  // Intentional local compromise vs official Keystone streaming storage strategies:
  // this starter fully buffers GraphQL upload streams into memory before persisting them.
  // The behavior is covered by focused validators for Promise<FileUpload>-style inputs,
  // multi-chunk reads, and stream failure propagation, but it is not full streaming parity.
  const storage = storageOverride ?? getStorageConfig(storageKey)
  if (!storage) throw new Error(`Unknown storage ${storageKey}`)
  assertUploadSize(storageKey, storage, 0)
  const bytes = await bytesFromNodeReadable(
    upload.createReadStream(),
    storage.maxFileSize,
  )
  const metadata = await normaliseStoredFileMetadata(
    storageKey,
    { name: upload.filename, size: bytes.byteLength, type: upload.mimetype },
    undefined,
    storageOverride,
    transformName,
  )
  const stored = await storeUploadedBytes(
    storageKey,
    { name: upload.filename, size: bytes.byteLength, type: upload.mimetype },
    bytes,
    metadata,
    storageOverride,
  )
  await onStored?.(stored)
  const { path: _path, ...publicMetadata } = stored
  return publicMetadata
}

export function getSignedStorageUrl(
  storage: CmsStorageConfig,
  filename: string,
  now = new Date(),
) {
  if (storage.kind !== 's3') return storageUrl(storage, filename)
  assertS3StorageConfig('signed-url', storage)
  if (!storage.signed) return storageUrl(storage, filename)
  return getSignedStorageRequestUrl(
    'GET',
    storage,
    filename,
    now,
    storage.signed.expiry ?? defaultSignedExpirySeconds,
  )
}

export { storageUrl }

function extensionFromFilename(filename: string) {
  const cleaned = basename(filename.split(/[?#]/)[0] ?? '')
  const index = cleaned.lastIndexOf('.')
  const extension = index === -1 ? '' : cleaned.slice(index + 1).toLowerCase()
  return sanitizePathSegment(extension)
}

function imageMetadataFromBytes(bytes: Uint8Array):
  | (Pick<StoredFileMetadata, 'width' | 'height'> & {
      extension: 'png' | 'gif' | 'jpg' | 'webp'
    })
  | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  if (
    bytes.byteLength >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[12] === 0x49 &&
    bytes[13] === 0x48 &&
    bytes[14] === 0x44 &&
    bytes[15] === 0x52
  ) {
    return {
      extension: 'png',
      width: view.getUint32(16),
      height: view.getUint32(20),
    }
  }

  if (
    bytes.byteLength >= 10 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return {
      extension: 'gif',
      width: view.getUint16(6, true),
      height: view.getUint16(8, true),
    }
  }

  if (bytes.byteLength >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < bytes.byteLength) {
      if (bytes[offset] !== 0xff) break
      const marker = bytes[offset + 1]
      const length = view.getUint16(offset + 2)
      if (length < 2 || offset + 2 + length > bytes.byteLength) break
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        return {
          extension: 'jpg',
          height: view.getUint16(offset + 5),
          width: view.getUint16(offset + 7),
        }
      }
      offset += 2 + length
    }
  }

  if (
    bytes.byteLength >= 30 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50 &&
    bytes[12] === 0x56 &&
    bytes[13] === 0x50 &&
    bytes[14] === 0x38 &&
    bytes[15] === 0x58
  ) {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16)
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)
    return { extension: 'webp', width, height }
  }

  return undefined
}

function createStoredFileId(filename: string) {
  const base =
    basename(filename)
      .replace(/\.[^/.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'upload'
  const suffix = Math.random().toString(36).slice(2, 10)
  return `${base}-${suffix}`
}

function sanitizePathSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/\.+/g, '.')
    .replace(/^-+|-+$/g, '')
    .replace(/^\.+|\.+$/g, '')
}

function sanitizeFilename(filename: string) {
  const safeBase = basename(filename)
  const extension = extensionFromFilename(safeBase)
  const stem = safeBase.replace(/\.[^/.]+$/, '')
  const safeStem = sanitizePathSegment(stem) || 'upload'
  return `${safeStem}${extension ? `.${extension}` : ''}`
}

function assertS3StorageConfig(
  storageKey: string,
  storage: CmsStorageConfig,
): asserts storage is CmsStorageConfig & {
  bucketName: string
  region: string
  accessKeyId: string
  secretAccessKey: string
} {
  if (!storage.bucketName)
    throw new Error(`Storage ${storageKey} requires bucketName for s3 usage.`)
  if (!storage.region)
    throw new Error(`Storage ${storageKey} requires region for s3 usage.`)
  if (!storage.accessKeyId)
    throw new Error(`Storage ${storageKey} requires accessKeyId for s3 usage.`)
  if (!storage.secretAccessKey)
    throw new Error(
      `Storage ${storageKey} requires secretAccessKey for s3 usage.`,
    )
}

function normalizedS3BaseUrl(
  storage: CmsStorageConfig & { bucketName: string; region: string },
) {
  const endpoint = storage.endpoint?.replace(/\/$/, '')
  if (endpoint) {
    if (storage.forcePathStyle) return endpoint
    const url = new URL(endpoint)
    return `${url.protocol}//${storage.bucketName}.${url.host}`
  }
  if (storage.forcePathStyle)
    return `https://s3.${storage.region}.amazonaws.com`
  return `https://${storage.bucketName}.s3.${storage.region}.amazonaws.com`
}

function canonicalObjectPath(
  storage: CmsStorageConfig & { bucketName: string },
  filename: string,
) {
  const prefix = storage.pathPrefix?.replace(/^\/+|\/+$/g, '')
  const objectKey = prefix ? `${prefix}/${filename}` : filename
  const encodedFilename = objectKey.split('/').map(encodeURIComponent).join('/')
  return storage.endpoint && storage.forcePathStyle
    ? `${storage.bucketName}/${encodedFilename}`
    : encodedFilename
}

function getSignedStorageRequestUrl(
  method: 'GET' | 'PUT' | 'DELETE',
  storage: CmsStorageConfig & {
    bucketName: string
    region: string
    accessKeyId: string
    secretAccessKey: string
  },
  filename: string,
  now = new Date(),
  expires = defaultSignedExpirySeconds,
) {
  const endpoint = normalizedS3BaseUrl(storage)
  const datetime = formatAmzDate(now)
  const datestamp = datetime.slice(0, 8)
  const scope = `${datestamp}/${storage.region}/s3/aws4_request`
  const encodedCredential = encodeURIComponent(
    `${storage.accessKeyId}/${scope}`,
  )
  const host = new URL(endpoint).host
  const canonicalUri = `/${canonicalObjectPath(storage, filename)}`
  const canonicalQuery = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', encodedCredential],
    ['X-Amz-Date', datetime],
    ['X-Amz-Expires', String(expires)],
    ['X-Amz-SignedHeaders', 'host'],
    ...(storage.sessionToken
      ? ([
          ['X-Amz-Security-Token', encodeURIComponent(storage.sessionToken)],
        ] as const)
      : []),
  ]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetime,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n')
  const signingKey = getSignatureKey(
    storage.secretAccessKey,
    datestamp,
    storage.region,
    's3',
  )
  const signature = createHmac('sha256', signingKey)
    .update(stringToSign)
    .digest('hex')
  return `${endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`
}

function providerRequestTimeoutMs(
  storageKey: string,
  storage: CmsStorageConfig,
) {
  const timeout = storage.requestTimeoutMs ?? 30_000
  if (!Number.isSafeInteger(timeout) || timeout <= 0)
    throw new Error(
      `Storage ${storageKey} requestTimeoutMs must be a positive safe integer.`,
    )
  return timeout
}

async function putRemoteObject(
  storage: CmsStorageConfig & {
    bucketName: string
    region: string
    accessKeyId: string
    secretAccessKey: string
  },
  filename: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const url = getSignedStorageRequestUrl('PUT', storage, filename)
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: new Blob([Uint8Array.from(bytes)], { type: contentType }),
    signal: AbortSignal.timeout(providerRequestTimeoutMs('s3', storage)),
  })
  if (!response.ok) {
    throw new Error(
      `Failed to upload remote object: ${response.status} ${await response.text()}`,
    )
  }
}

async function deleteRemoteObject(
  storage: CmsStorageConfig & {
    bucketName: string
    region: string
    accessKeyId: string
    secretAccessKey: string
  },
  filename: string,
) {
  const url = getSignedStorageRequestUrl('DELETE', storage, filename)
  const response = await fetch(url, {
    method: 'DELETE',
    signal: AbortSignal.timeout(providerRequestTimeoutMs('s3', storage)),
  })
  if (!response.ok) {
    throw new Error(
      `Failed to delete remote object: ${response.status} ${await response.text()}`,
    )
  }
}

function contentTypeForUpload(
  type: CmsStorageType,
  declaredContentType: string | undefined,
  detectedExtension?: string,
) {
  if (type === 'file') return 'application/octet-stream'
  return (
    {
      png: 'image/png',
      jpg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
    }[detectedExtension ?? 'png'] ??
    declaredContentType ??
    'application/octet-stream'
  )
}

function formatAmzDate(now: Date) {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function hmac(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value).digest()
}

function getSignatureKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  return hmac(kService, 'aws4_request')
}

export function nodeReadableFromWebStream(stream: ReadableStream<Uint8Array>) {
  return Readable.fromWeb(stream as unknown as NodeReadableStream)
}

type UploadLike = {
  filename: string
  mimetype?: string
  createReadStream: () => NodeReadable
}

async function unwrapUpload(value: unknown): Promise<unknown> {
  const awaited = value instanceof Promise ? await value : value
  if (awaited && typeof awaited === 'object' && 'upload' in awaited)
    return unwrapUpload((awaited as { upload?: unknown }).upload)
  return awaited
}

function isUploadLike(value: unknown): value is UploadLike {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as UploadLike).filename === 'string' &&
    typeof (value as UploadLike).createReadStream === 'function',
  )
}

function assertUploadSize(
  storageKey: string,
  storage: CmsStorageConfig,
  size: number,
) {
  if (storage.maxFileSize === undefined) return
  if (!Number.isSafeInteger(storage.maxFileSize) || storage.maxFileSize <= 0)
    throw new Error(
      `Storage ${storageKey} maxFileSize must be a positive safe integer.`,
    )
  if (size > storage.maxFileSize)
    throw new Error(
      `Upload exceeds the ${storageKey} storage limit of ${storage.maxFileSize} bytes.`,
    )
}

async function bytesFromNodeReadable(stream: NodeReadable, maxBytes?: number) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk as ArrayBuffer)
    size += buffer.byteLength
    if (maxBytes !== undefined && size > maxBytes)
      throw new Error(`Upload exceeds the configured storage size limit.`)
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}
