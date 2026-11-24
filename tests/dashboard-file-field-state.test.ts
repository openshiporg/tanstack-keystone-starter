import { describe, expect, it } from 'vitest'

import { normalizeFileFieldEditorValue } from '../src/components/dashboard/file-field-editor'
import { controller as fileController } from '../src/components/dashboard/views/image'

describe('dashboard file/image field state', () => {
  it('normalizes empty values into explicit empty state', () => {
    expect(normalizeFileFieldEditorValue(undefined)).toEqual({ kind: 'empty' })
    expect(normalizeFileFieldEditorValue('')).toEqual({ kind: 'empty' })
  })

  it('normalizes stored metadata into from-server state', () => {
    expect(
      normalizeFileFieldEditorValue({
        id: 'asset_1',
        url: '/files/asset_1.png',
        extension: 'png',
        filesize: 123,
        width: 10,
        height: 20,
      }),
    ).toEqual({
      kind: 'from-server',
      data: {
        id: 'asset_1',
        url: '/files/asset_1.png',
        extension: 'png',
        filesize: 123,
        width: 10,
        height: 20,
      },
    })
  })

  it('normalizes pending upload values that carry a File object', () => {
    const file = new File(['hello'], 'hello.png', { type: 'image/png' })

    expect(
      normalizeFileFieldEditorValue({
        kind: 'upload',
        data: {
          file,
          filename: 'hello.png',
          filesize: file.size,
        },
      }),
    ).toEqual({
      kind: 'upload',
      data: {
        file,
        filename: 'hello.png',
        filesize: file.size,
      },
    })
  })

  it('serializes pending file/image uploads to GraphQL Upload input', () => {
    const controller = fileController({
      path: 'coverImage',
      label: 'Cover Image',
      description: null,
      fieldMeta: {},
    })
    const file = new File(['hello'], 'hello.png', { type: 'image/png' })

    expect(
      controller.serialize({
        kind: 'upload',
        data: {
          file,
          filename: 'hello.png',
          filesize: file.size,
        },
      }),
    ).toEqual({
      coverImage: {
        upload: file,
      },
    })
  })

  it('serializes remove state to null for mutation input', () => {
    const controller = fileController({
      path: 'coverImage',
      label: 'Cover Image',
      description: null,
      fieldMeta: {},
    })

    expect(
      controller.serialize({
        kind: 'remove',
        previous: {
          kind: 'from-server',
          data: {
            id: 'asset_1',
            url: '/files/asset_1.png',
            extension: 'png',
            filesize: 123,
            width: 10,
            height: 20,
          },
        },
      }),
    ).toEqual({ coverImage: null })
  })
})
