import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
  setCmsAdapterForTests,
} from '../src/features/cms/adapters'
import { cmsGraphQLYoga } from '../src/features/cms/graphql'
import { getStorageConfigs } from '../src/features/cms/storage'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

async function main() {
  process.env.CMS_ADAPTER = 'memory'
  process.env.CMS_DEV_AUTH_FALLBACK = 'true'
  process.env.CMS_DEV_AUTH_ITEM_ID = 'user_admin'
  setCmsAdapterForTests(memoryCmsAdapter)
  resetMemoryAdapter()

  const dir = await mkdtemp(join(tmpdir(), 'cms-gql-upload-http-'))
  const storageConfigs = getStorageConfigs()
  const previousStorage = storageConfigs.my_images
  storageConfigs.my_images = {
    kind: 'local',
    type: 'image',
    storagePath: 'public/files',
    serverRoute: '/files',
  }
  try {
    const uploadBytes = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000030000000208060000009d74661a0000000049454e44ae426082',
      'hex',
    )
    const sourcePath = join(dir, 'fixture.png')
    await writeFile(sourcePath, uploadBytes)

    const form = new FormData()
    form.set(
      'operations',
      JSON.stringify({
        query: /* GraphQL */ `
          mutation ValidateGraphQLHttpUpload($upload: Upload!) {
            createTodoImage(
              data: {
                altText: "HTTP GraphQL Upload"
                image: { upload: $upload }
              }
            ) {
              id
              image {
                id
                url
                extension
                filesize
                width
                height
              }
            }
          }
        `,
        variables: { upload: null },
      }),
    )
    form.set('map', JSON.stringify({ '0': ['variables.upload'] }))
    const uploadFile = new File([uploadBytes], 'GraphQL Upload.PNG', {
      type: 'image/png',
    })
    assert(
      uploadFile.type === 'image/png',
      'HTTP multipart GraphQL upload fixture should provide a mimetype-compatible File payload',
    )
    form.set('0', uploadFile)

    const cmsResponseHeaders = new Headers()
    const response = await cmsGraphQLYoga.handle(
      new Request('http://local.test/api/graphql', {
        method: 'POST',
        body: form,
      }),
      { cmsResponseHeaders },
    )

    assert(
      response.status === 200,
      `HTTP multipart GraphQL upload should return 200, received ${response.status}`,
    )
    const payload = asRecord(await response.json())
    const created = asRecord(asRecord(payload.data).createTodoImage)
    const image = asRecord(created.image)
    assert(
      image.extension === 'png',
      'HTTP multipart GraphQL upload should derive extension from bytes/filename',
    )
    assert(
      image.filesize === uploadBytes.byteLength,
      'HTTP multipart GraphQL upload should persist and report byte size',
    )
    assert(
      image.width === 3 && image.height === 2,
      'HTTP multipart GraphQL upload should extract PNG dimensions from bytes',
    )
    assert(
      typeof image.url === 'string' && image.url.startsWith('/files/'),
      'HTTP multipart GraphQL upload should produce a local file URL',
    )

    const storedFilename = String(image.url).split('/').pop()
    assert(
      storedFilename,
      'HTTP multipart GraphQL upload should include a stored filename',
    )
    assert(
      storedFilename.endsWith('.png'),
      'HTTP multipart GraphQL upload should produce a stored PNG filename in the URL',
    )
    const storedPath = join(process.cwd(), 'public/files', storedFilename)
    const stored = await stat(storedPath)
    assert(
      stored.isFile() && stored.size === uploadBytes.byteLength,
      'HTTP multipart GraphQL upload should write bytes to local storage',
    )
    await rm(storedPath, { force: true })

    console.info('CMS HTTP GraphQL Upload validation passed.')
  } finally {
    storageConfigs.my_images = previousStorage
    await rm(dir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
