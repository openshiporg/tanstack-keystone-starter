type StorageUrlConfig = {
  kind?: 'local' | 's3'
  serverRoute?: string
  endpoint?: string
  bucketName?: string
  region?: string
  forcePathStyle?: boolean
  pathPrefix?: string
  generateUrl?: (path: string) => string
}

export function storageUrl(storage: StorageUrlConfig, filename: string) {
  const objectName =
    storage.kind === 's3'
      ? `${storage.pathPrefix?.replace(/^\/+|\/+$/g, '') || ''}${storage.pathPrefix ? '/' : ''}${filename}`
      : filename
  if (typeof storage.generateUrl === 'function')
    return storage.generateUrl(
      storage.kind === 'local' ? `/${filename}` : objectName,
    )
  if (storage.kind === 'local' || !storage.kind) {
    const route = storage.serverRoute ?? '/files'
    return `${route.replace(/\/$/, '')}/${filename}`
  }
  const endpoint = storage.endpoint?.replace(/\/$/, '')
  if (endpoint && storage.bucketName) {
    if (storage.forcePathStyle)
      return `${endpoint}/${storage.bucketName}/${objectName}`
    const url = new URL(endpoint)
    return `${url.protocol}//${storage.bucketName}.${url.host}/${objectName}`
  }
  if (storage.bucketName && storage.region) {
    if (storage.forcePathStyle)
      return `https://s3.${storage.region}.amazonaws.com/${storage.bucketName}/${objectName}`
    return `https://${storage.bucketName}.s3.${storage.region}.amazonaws.com/${objectName}`
  }
  return filename
}
