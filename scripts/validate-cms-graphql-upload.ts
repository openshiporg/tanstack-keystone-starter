import { createReadStream } from 'node:fs'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

import { graphql } from 'graphql'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
  setCmsAdapterForTests,
} from '../src/features/cms/adapters'
import {
  createCmsContext,
  getCmsGraphQLSchema,
} from '../src/features/cms/runtime'
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

  const sourceDirectory = await mkdtemp(
    join(tmpdir(), 'cms-gql-upload-source-'),
  )
  const sourcePath = join(sourceDirectory, 'fixture.png')
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
    await writeFile(sourcePath, uploadBytes)

    let createReadStreamCalls = 0
    const upload = Promise.resolve({
      filename: 'GraphQL Upload.PNG',
      mimetype: 'image/png',
      encoding: '7bit',
      createReadStream: () => {
        createReadStreamCalls += 1
        return Readable.from(createReadStream(sourcePath))
      },
    })

    const schema = getCmsGraphQLSchema()
    const contextValue = await createCmsContext(
      new Request('http://local.test/api/graphql'),
    )
    const result = await graphql({
      schema,
      source: /* GraphQL */ `
        mutation ValidateGraphQLUpload($upload: Upload!) {
          createTodoImage(
            data: { altText: "GraphQL Upload", image: { upload: $upload } }
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
      variableValues: { upload },
      contextValue,
    })

    if (result.errors?.length)
      throw new Error(result.errors.map((error) => error.message).join('\n'))
    const image = asRecord(asRecord(result.data).createTodoImage).image
    const imageRecord = asRecord(image)
    assert(
      createReadStreamCalls === 1,
      'GraphQL Upload should consume Promise<FileUpload>-style input through createReadStream() exactly once',
    )
    assert(
      imageRecord.extension === 'png',
      'GraphQL Upload image input should derive extension from filename',
    )
    assert(
      imageRecord.filesize === uploadBytes.byteLength,
      'GraphQL Upload image input should persist and report byte size',
    )
    assert(
      imageRecord.width === 3 && imageRecord.height === 2,
      'GraphQL Upload image input should extract PNG dimensions from bytes',
    )
    assert(
      typeof imageRecord.url === 'string' &&
        imageRecord.url.startsWith('/files/'),
      'GraphQL Upload image input should produce a local file URL',
    )

    const storedFilename = String(imageRecord.url).split('/').pop()
    assert(
      storedFilename,
      'GraphQL Upload image input should include a stored filename',
    )
    assert(
      storedFilename.endsWith('.png'),
      'GraphQL Upload image input should produce a stored PNG filename in the URL',
    )
    assert(
      !storedFilename.includes('GraphQL Upload.PNG'),
      'GraphQL Upload image input should not preserve the raw unsafe original filename verbatim in stored output',
    )
    const storedPath = join(process.cwd(), 'public/files', storedFilename)
    const stored = await stat(storedPath)
    assert(
      stored.isFile() && stored.size === uploadBytes.byteLength,
      'GraphQL Upload image input should write bytes to local storage',
    )
    await rm(storedPath, { force: true })

    const chunkedResult = await graphql({
      schema,
      source: /* GraphQL */ `
        mutation ValidateChunkedGraphQLUpload($upload: Upload!) {
          createTodoImage(
            data: {
              altText: "Chunked GraphQL Upload"
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
      variableValues: {
        upload: Promise.resolve({
          filename: 'chunked-upload.png',
          mimetype: 'image/png',
          encoding: '7bit',
          createReadStream: () =>
            Readable.from(
              (async function* () {
                yield uploadBytes.subarray(0, 8)
                yield uploadBytes.subarray(8, 20)
                yield uploadBytes.subarray(20)
              })(),
            ),
        }),
      },
      contextValue: await createCmsContext(
        new Request('http://local.test/api/graphql'),
      ),
    })
    if (chunkedResult.errors?.length)
      throw new Error(
        chunkedResult.errors.map((error) => error.message).join('\n'),
      )
    const chunkedImage = asRecord(
      asRecord(chunkedResult.data).createTodoImage,
    ).image
    const chunkedImageRecord = asRecord(chunkedImage)
    assert(
      chunkedImageRecord.extension === 'png',
      'GraphQL Upload should preserve detected image extension when upload streams arrive in multiple chunks',
    )
    assert(
      chunkedImageRecord.filesize === uploadBytes.byteLength,
      'GraphQL Upload should buffer and persist the full byte length across multi-chunk streams',
    )
    assert(
      chunkedImageRecord.width === 3 && chunkedImageRecord.height === 2,
      'GraphQL Upload should extract image metadata correctly from multi-chunk streams',
    )
    const chunkedStoredFilename = String(chunkedImageRecord.url)
      .split('/')
      .pop()
    const chunkedStoredPath = join(
      process.cwd(),
      'public/files',
      chunkedStoredFilename ?? '',
    )
    const chunkedStored = await stat(chunkedStoredPath)
    assert(
      chunkedStored.isFile() && chunkedStored.size === uploadBytes.byteLength,
      'GraphQL Upload should write the buffered multi-chunk stream bytes to local storage',
    )
    await rm(chunkedStoredPath, { force: true })

    const failingResult = await graphql({
      schema,
      source: /* GraphQL */ `
        mutation ValidateGraphQLUploadStreamFailure($upload: Upload!) {
          createTodoImage(
            data: {
              altText: "GraphQL Upload Failure"
              image: { upload: $upload }
            }
          ) {
            id
          }
        }
      `,
      variableValues: {
        upload: Promise.resolve({
          filename: 'broken.png',
          mimetype: 'image/png',
          encoding: '7bit',
          createReadStream: () =>
            Readable.from(
              (async function* () {
                yield uploadBytes
                throw new Error('Synthetic upload stream failure')
              })(),
            ),
        }),
      },
      contextValue: await createCmsContext(
        new Request('http://local.test/api/graphql'),
      ),
    })
    assert(
      failingResult.errors?.length,
      'GraphQL Upload should surface stream failures as GraphQL errors',
    )
    assert(
      failingResult.errors[0].message.includes(
        'Synthetic upload stream failure',
      ),
      'GraphQL Upload should preserve the underlying stream failure reason',
    )

    console.info('CMS GraphQL Upload validation passed.')
  } finally {
    storageConfigs.my_images = previousStorage
    await rm(sourceDirectory, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
