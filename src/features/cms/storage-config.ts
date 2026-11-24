import cmsConfig from '../../../cms.config'

export type CmsStorageKind = 'local' | 's3'
export type CmsStorageType = 'image' | 'file'

export type CmsStorageConfig = {
  kind: CmsStorageKind
  type: CmsStorageType
  storagePath?: string
  serverRoute?: string
  generateUrl?: (path: string) => string
  bucketName?: string
  region?: string
  endpoint?: string
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
  signed?: { expiry?: number }
  forcePathStyle?: boolean
  /** Prefix S3 object keys, matching Keystone's storage pathPrefix contract. */
  pathPrefix?: string
  /** Keep objects when their database value is replaced or deleted. */
  preserve?: boolean
  /** Reject uploads larger than this many bytes before persisting them. */
  maxFileSize?: number
  /** Bound provider PUT/DELETE requests; defaults to 30 seconds. */
  requestTimeoutMs?: number
}

const storageConfig = (cmsConfig.storage ?? {}) as Partial<
  Record<string, CmsStorageConfig>
>

export function getStorageConfig(storageKey: string) {
  return storageConfig[storageKey]
}

export function getStorageConfigs() {
  return storageConfig as Record<string, CmsStorageConfig>
}
