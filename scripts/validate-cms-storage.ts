import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  cleanupDeletedItemFiles,
  cleanupReplacedFiles,
} from '../src/features/cms/file-lifecycle'
import {
  deleteStoredObject,
  getSignedStorageUrl,
  getStorageConfigs,
  normaliseStoredFileMetadata,
  storeUploadedFile,
} from '../src/features/cms/storage'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), 'cms-storage-'))
  const remoteCalls: string[] = []
  const remoteRequestHeaders: Array<{
    method: string
    url: string
    contentType: string | null
  }> = []
  const remoteServer = createServer(async (request, response) => {
    remoteCalls.push(`${request.method ?? 'GET'} ${request.url ?? '/'}`)
    remoteRequestHeaders.push({
      method: request.method ?? 'GET',
      url: request.url ?? '/',
      contentType:
        typeof request.headers['content-type'] === 'string'
          ? request.headers['content-type']
          : null,
    })
    for await (const _chunk of request) {
      // drain request body
    }
    response.statusCode = 200
    response.end('ok')
  })
  remoteServer.listen(0, '127.0.0.1')
  await once(remoteServer, 'listening')
  const address = remoteServer.address()
  if (!address || typeof address === 'string')
    throw new Error('Failed to bind remote storage validation server')
  const remoteEndpoint = `http://127.0.0.1:${address.port}`

  const storageConfigs = getStorageConfigs()
  const hadRemoteLifecycleConfig = Object.prototype.hasOwnProperty.call(
    storageConfigs,
    'test_remote_lifecycle',
  )
  const previousRemoteLifecycleConfig = storageConfigs.test_remote_lifecycle
  const hadImageLifecycleConfig = Object.prototype.hasOwnProperty.call(
    storageConfigs,
    'my_images',
  )
  const previousImageLifecycleConfig = storageConfigs.my_images
  storageConfigs.my_images = {
    kind: 'local',
    type: 'image',
    storagePath: 'public/files',
    serverRoute: '/files',
  }
  storageConfigs.test_remote_lifecycle = {
    kind: 's3',
    type: 'file',
    bucketName: 'keystone-test',
    region: 'ap-southeast-2',
    accessKeyId: 'keystone',
    secretAccessKey: 'keystone-secret',
    endpoint: remoteEndpoint,
    forcePathStyle: true,
  }

  try {
    const file = new File(['hello keystone storage'], '../Unsafe Name.PNG', {
      type: 'image/png',
    })
    const metadata = await normaliseStoredFileMetadata(
      'test_local',
      file,
      'unsafe-name-test',
      {
        kind: 'local',
        type: 'file',
        storagePath: root,
        serverRoute: '/files',
      },
    )

    assert(
      metadata.filename === 'unsafe-name-test.png',
      'metadata should sanitize extension and derive deterministic filename',
    )
    assert(
      metadata.url === '/files/unsafe-name-test.png',
      'metadata should derive deterministic local URL',
    )

    const generatedUrlMetadata = await normaliseStoredFileMetadata(
      'test_local',
      file,
      'custom-url-test',
      {
        kind: 'local',
        type: 'file',
        storagePath: root,
        serverRoute: '/files',
        generateUrl: (path) => `/signed${path}`,
      },
    )
    assert(
      generatedUrlMetadata.url === '/signed/custom-url-test.png',
      'metadata should honor custom generateUrl when provided',
    )

    const s3Metadata = await normaliseStoredFileMetadata(
      'test_s3',
      file,
      'remote-object-test',
      {
        kind: 's3',
        type: 'file',
        bucketName: 'keystone-test',
        region: 'ap-southeast-2',
        accessKeyId: 'keystone',
        secretAccessKey: 'keystone-secret',
        endpoint: remoteEndpoint,
        forcePathStyle: true,
      },
    )
    assert(
      s3Metadata.url ===
        `${remoteEndpoint}/keystone-test/remote-object-test.png`,
      's3 metadata should derive a remote object URL',
    )

    const signedUrl = getSignedStorageUrl(
      {
        kind: 's3',
        type: 'file',
        bucketName: 'keystone-test',
        region: 'ap-southeast-2',
        accessKeyId: 'keystone',
        secretAccessKey: 'keystone-secret',
        endpoint: remoteEndpoint,
        forcePathStyle: true,
        pathPrefix: 'tenant/assets',
        signed: { expiry: 5000 },
      },
      'remote-object-test.png',
      new Date('2026-01-02T03:04:05.000Z'),
    )
    assert(
      signedUrl.includes('X-Amz-Algorithm=AWS4-HMAC-SHA256'),
      'signed storage URLs should include SigV4 algorithm query params',
    )
    assert(
      signedUrl.includes('X-Amz-Signature='),
      'signed storage URLs should include a SigV4 signature',
    )
    assert(
      new URL(signedUrl).pathname ===
        '/keystone-test/tenant/assets/remote-object-test.png',
      'path-style signed storage URLs should include the bucket and configured object prefix exactly once',
    )

    const s3Stored = await storeUploadedFile('test_s3', file, s3Metadata, {
      kind: 's3',
      type: 'file',
      bucketName: 'keystone-test',
      region: 'ap-southeast-2',
      accessKeyId: 'keystone',
      secretAccessKey: 'keystone-secret',
      endpoint: remoteEndpoint,
      forcePathStyle: true,
      signed: { expiry: 5000 },
    })
    assert(
      s3Stored.path === 's3://keystone-test/remote-object-test.png',
      's3 storage should report a remote object path instead of a local filesystem path',
    )
    assert(
      s3Stored.url === `${remoteEndpoint}/keystone-test/remote-object-test.png`,
      's3 storage should preserve the remote object URL in stored metadata',
    )
    await deleteStoredObject('test_s3', 'remote-object-test.png', {
      kind: 's3',
      type: 'file',
      bucketName: 'keystone-test',
      region: 'ap-southeast-2',
      accessKeyId: 'keystone',
      secretAccessKey: 'keystone-secret',
      endpoint: remoteEndpoint,
      forcePathStyle: true,
      signed: { expiry: 5000 },
    }).catch(() => undefined)
    assert(
      remoteCalls.some((entry) => entry.startsWith('PUT ')),
      's3 storage should execute a remote PUT request',
    )
    assert(
      remoteCalls.some((entry) => entry.startsWith('DELETE ')),
      's3 storage should execute a remote DELETE request',
    )
    const remoteFilePut = remoteRequestHeaders.find(
      (entry) =>
        entry.method === 'PUT' && entry.url.includes('remote-object-test.png'),
    )
    assert(
      remoteFilePut?.contentType === 'application/octet-stream',
      'remote file uploads should send application/octet-stream content type',
    )

    const transformedMetadata = await normaliseStoredFileMetadata(
      'test_local',
      file,
      undefined,
      {
        kind: 'local',
        type: 'file',
        storagePath: root,
        serverRoute: '/files',
      },
      () => 'renamed-file.png',
    )
    assert(
      transformedMetadata.filename === 'renamed-file.png',
      'transformName should rewrite file upload names before storage metadata is finalized',
    )

    const stored = await storeUploadedFile('test_local', file, metadata, {
      kind: 'local',
      type: 'file',
      storagePath: root,
      serverRoute: '/files',
    })

    assert(
      stored.filename === metadata.filename,
      'stored metadata should preserve filename',
    )
    const info = await stat(stored.path)
    assert(info.isFile(), 'stored upload should exist on disk')
    assert(
      info.size === file.size,
      'stored upload byte size should match input file',
    )
    const bytes = await readFile(stored.path, 'utf8')
    assert(
      bytes === 'hello keystone storage',
      'stored upload bytes should match input file bytes',
    )
    assert(
      !stored.path.includes('..'),
      'stored path should not contain traversal segments',
    )

    const pngBytes = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000030000000208060000009d74661a0000000049454e44ae426082',
      'hex',
    )
    const pngFile = new File([pngBytes], 'tiny.png', { type: 'image/png' })
    const transformedImageMetadata = await normaliseStoredFileMetadata(
      'test_local',
      pngFile,
      undefined,
      {
        kind: 'local',
        type: 'image',
        storagePath: root,
        serverRoute: '/files',
      },
      () => 'hero-banner',
    )
    assert(
      transformedImageMetadata.filename === 'hero-banner',
      'transformName should be able to set the base stored image name before detected extension is applied',
    )

    const remotePngMetadata = await normaliseStoredFileMetadata(
      'test_s3',
      pngFile,
      undefined,
      {
        kind: 's3',
        type: 'image',
        bucketName: 'keystone-test',
        region: 'ap-southeast-2',
        accessKeyId: 'keystone',
        secretAccessKey: 'keystone-secret',
        endpoint: remoteEndpoint,
        forcePathStyle: true,
      },
      () => 'hero-banner',
    )
    const remotePngStored = await storeUploadedFile(
      'test_s3',
      pngFile,
      remotePngMetadata,
      {
        kind: 's3',
        type: 'image',
        bucketName: 'keystone-test',
        region: 'ap-southeast-2',
        accessKeyId: 'keystone',
        secretAccessKey: 'keystone-secret',
        endpoint: remoteEndpoint,
        forcePathStyle: true,
      },
    )
    assert(
      remotePngStored.extension === 'png' &&
        remotePngStored.filename === 'hero-banner.png',
      'remote image uploads should append the detected extension onto a transformed base name',
    )
    const remoteImagePut = remoteRequestHeaders.find(
      (entry) =>
        entry.method === 'PUT' && entry.url.includes('hero-banner.png'),
    )
    assert(
      remoteImagePut?.contentType === 'image/png',
      'remote image uploads should send detected image content types',
    )

    const pngStored = await storeUploadedFile(
      'test_local',
      pngFile,
      transformedImageMetadata,
      {
        kind: 'local',
        type: 'image',
        storagePath: root,
        serverRoute: '/files',
      },
    )
    assert(
      pngStored.width === 3 && pngStored.height === 2,
      'PNG uploads should extract dimensions from bytes',
    )
    assert(
      pngStored.extension === 'png' && pngStored.filename === 'hero-banner.png',
      'image uploads should append the detected extension onto a transformed base name',
    )

    const gifBytes = Buffer.from(
      '47494638396104000500800000000000ffffff2c00000000040005000002024401003b',
      'hex',
    )
    const gifFile = new File([gifBytes], 'tiny.gif', { type: 'image/gif' })
    const gifStored = await storeUploadedFile(
      'test_local',
      gifFile,
      undefined,
      {
        kind: 'local',
        type: 'image',
        storagePath: root,
        serverRoute: '/files',
      },
    )
    assert(
      gifStored.width === 4 && gifStored.height === 5,
      'GIF uploads should extract dimensions from bytes',
    )

    const webpBytes = Buffer.from(
      '524946461600000057454250565038580a00000000000000060000080000',
      'hex',
    )
    const webpFile = new File([webpBytes], 'tiny.webp', { type: 'image/webp' })
    const webpStored = await storeUploadedFile(
      'test_local',
      webpFile,
      undefined,
      {
        kind: 'local',
        type: 'image',
        storagePath: root,
        serverRoute: '/files',
      },
    )
    assert(
      webpStored.width === 7 && webpStored.height === 9,
      'WebP VP8X uploads should extract dimensions from bytes',
    )

    const jpegBytes = Buffer.from(
      'ffd8ffc0001108000b000d03011100021101031101ffd9',
      'hex',
    )
    const jpegFile = new File([jpegBytes], 'tiny.jpg', { type: 'image/jpeg' })
    const jpegStored = await storeUploadedFile(
      'test_local',
      jpegFile,
      undefined,
      {
        kind: 'local',
        type: 'image',
        storagePath: root,
        serverRoute: '/files',
      },
    )
    assert(
      jpegStored.width === 13 && jpegStored.height === 11,
      'JPEG uploads should extract dimensions from bytes',
    )

    const jpegAliasFile = new File([jpegBytes], 'tiny.jpeg', {
      type: 'image/jpeg',
    })
    const jpegAliasStored = await storeUploadedFile(
      'test_local',
      jpegAliasFile,
      undefined,
      {
        kind: 'local',
        type: 'image',
        storagePath: root,
        serverRoute: '/files',
      },
    )
    assert(
      jpegAliasStored.width === 13 && jpegAliasStored.height === 11,
      'JPEG .jpeg uploads should be accepted as jpg bytes',
    )
    assert(
      jpegAliasStored.extension === 'jpg' &&
        jpegAliasStored.filename.endsWith('.jpg'),
      'JPEG .jpeg uploads should be stored with the detected jpg extension',
    )

    const mismatchedStored = await storeUploadedFile(
      'test_local',
      new File([pngBytes], 'not-a-gif.gif', { type: 'image/gif' }),
      undefined,
      {
        kind: 'local',
        type: 'image',
        storagePath: root,
        serverRoute: '/files',
      },
    )
    assert(
      mismatchedStored.extension === 'png' &&
        mismatchedStored.filename.endsWith('.png'),
      'image uploads should use detected bytes instead of trusting mismatched extensions',
    )

    let invalidImageRejected = false
    try {
      await storeUploadedFile(
        'test_local',
        new File(['not an image'], 'not-an-image.png', { type: 'image/png' }),
        undefined,
        {
          kind: 'local',
          type: 'image',
          storagePath: root,
          serverRoute: '/files',
        },
      )
    } catch {
      invalidImageRejected = true
    }
    assert(
      invalidImageRejected,
      'image uploads should reject unknown image bytes',
    )

    const configuredStorageRoot = join(process.cwd(), 'public/files')
    await mkdir(configuredStorageRoot, { recursive: true })
    const lifecycleFields = [
      { kind: 'image', path: 'photo', fieldMeta: { storage: 'my_images' } },
    ] as any

    const sameImagePath = join(configuredStorageRoot, 'lifecycle-same.png')
    await writeFile(sameImagePath, pngBytes)
    await cleanupReplacedFiles(
      lifecycleFields,
      {
        photo: { filename: 'lifecycle-same.png', storage: 'my_images' },
      } as any,
      {
        photo: { filename: 'lifecycle-same.png', storage: 'my_images' },
      },
    )
    const sameImageStillExists = await stat(sameImagePath)
    assert(
      sameImageStillExists.isFile(),
      'cleanupReplacedFiles should not delete image storage objects when the stored file is unchanged',
    )
    await rm(sameImagePath, { force: true })

    const replaceImagePath = join(
      configuredStorageRoot,
      'lifecycle-replace.png',
    )
    await writeFile(replaceImagePath, pngBytes)
    await cleanupReplacedFiles(
      lifecycleFields,
      {
        photo: { filename: 'lifecycle-replace.png', storage: 'my_images' },
      } as any,
      {
        photo: { filename: 'lifecycle-new.png', storage: 'my_images' },
      },
    )
    let oldImageStillExists = true
    try {
      await stat(replaceImagePath)
    } catch {
      oldImageStillExists = false
    }
    assert(
      oldImageStillExists === false,
      'cleanupReplacedFiles should delete replaced image storage objects for configured storage keys',
    )

    const deleteImagePath = join(configuredStorageRoot, 'lifecycle-delete.png')
    await writeFile(deleteImagePath, pngBytes)
    await cleanupDeletedItemFiles(lifecycleFields, {
      photo: { filename: 'lifecycle-delete.png', storage: 'my_images' },
    } as any)
    let deletedImageStillExists = true
    try {
      await stat(deleteImagePath)
    } catch {
      deletedImageStillExists = false
    }
    assert(
      deletedImageStillExists === false,
      'cleanupDeletedItemFiles should delete image storage objects for deleted items when storage keys are configured',
    )

    const fileLifecycleFields = [
      { kind: 'file', path: 'attachment', fieldMeta: { storage: 'my_images' } },
    ] as any

    const replaceFilePath = join(
      configuredStorageRoot,
      'lifecycle-file-replace.txt',
    )
    await writeFile(replaceFilePath, 'replace me')
    await cleanupReplacedFiles(
      fileLifecycleFields,
      {
        attachment: {
          filename: 'lifecycle-file-replace.txt',
          storage: 'my_images',
        },
      } as any,
      {
        attachment: {
          filename: 'lifecycle-file-new.txt',
          storage: 'my_images',
        },
      },
    )
    let replacedFileStillExists = true
    try {
      await stat(replaceFilePath)
    } catch {
      replacedFileStillExists = false
    }
    assert(
      replacedFileStillExists === false,
      'cleanupReplacedFiles should delete configured-storage file objects when a file field changes',
    )

    const deleteFilePath = join(
      configuredStorageRoot,
      'lifecycle-file-delete.txt',
    )
    await writeFile(deleteFilePath, 'delete me')
    await cleanupDeletedItemFiles(fileLifecycleFields, {
      attachment: {
        filename: 'lifecycle-file-delete.txt',
        storage: 'my_images',
      },
    } as any)
    let deletedFileStillExists = true
    try {
      await stat(deleteFilePath)
    } catch {
      deletedFileStillExists = false
    }
    assert(
      deletedFileStillExists === false,
      'cleanupDeletedItemFiles should delete configured-storage file objects for deleted items',
    )

    const preservedFilePath = join(configuredStorageRoot, 'preserved.txt')
    await writeFile(preservedFilePath, 'keep me')
    await cleanupDeletedItemFiles(
      fileLifecycleFields,
      {
        attachment: { filename: 'preserved.txt', storage: 'my_images' },
      } as any,
      {
        my_images: {
          kind: 'local',
          type: 'file',
          storagePath: configuredStorageRoot,
          serverRoute: '/files',
          preserve: true,
        },
      },
    )
    assert(
      (await stat(preservedFilePath)).isFile(),
      'preserve storage must retain objects when database items are deleted',
    )
    await rm(preservedFilePath, { force: true })

    const remoteDeleteCallsBeforeLifecycle = remoteCalls.filter((entry) =>
      entry.startsWith('DELETE '),
    ).length
    const remoteLifecycleFields = [
      {
        kind: 'file',
        path: 'attachment',
        fieldMeta: { storage: 'test_remote_lifecycle' },
      },
    ] as any
    await cleanupReplacedFiles(
      remoteLifecycleFields,
      {
        attachment: {
          filename: 'remote-lifecycle-old.txt',
          storage: 'test_remote_lifecycle',
        },
      } as any,
      {
        attachment: {
          filename: 'remote-lifecycle-new.txt',
          storage: 'test_remote_lifecycle',
        },
      },
    )
    await cleanupDeletedItemFiles(remoteLifecycleFields, {
      attachment: {
        filename: 'remote-lifecycle-delete.txt',
        storage: 'test_remote_lifecycle',
      },
    } as any)
    const remoteDeleteCallsAfterLifecycle = remoteCalls.filter((entry) =>
      entry.startsWith('DELETE '),
    ).length
    assert(
      remoteDeleteCallsAfterLifecycle === remoteDeleteCallsBeforeLifecycle + 2,
      'file lifecycle helpers should issue remote DELETE requests for configured remote storage keys on replace and delete',
    )
    assert(
      remoteCalls.some(
        (entry) =>
          entry.startsWith('DELETE ') &&
          entry.includes('/remote-lifecycle-old.txt'),
      ),
      'cleanupReplacedFiles should delete the previous remote stored object when a configured remote file field changes',
    )
    assert(
      remoteCalls.some(
        (entry) =>
          entry.startsWith('DELETE ') &&
          entry.includes('/remote-lifecycle-delete.txt'),
      ),
      'cleanupDeletedItemFiles should delete the remote stored object when a configured remote file item is deleted',
    )

    console.info('CMS storage upload validation passed.')
  } finally {
    if (hadRemoteLifecycleConfig)
      storageConfigs.test_remote_lifecycle = previousRemoteLifecycleConfig
    else delete storageConfigs.test_remote_lifecycle
    if (hadImageLifecycleConfig)
      storageConfigs.my_images = previousImageLifecycleConfig
    else delete storageConfigs.my_images
    remoteServer.close()
    await rm(root, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
