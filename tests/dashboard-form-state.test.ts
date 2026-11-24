import { describe, expect, it } from 'vitest'

import {
  hasFormChanges,
  makeDefaultValueState,
  serializeValueToOperationItem,
} from '../src/components/dashboard/form-state'

type FakeField = {
  path: string
  graphql: { isNonNull: boolean[] }
  controller: {
    defaultValue: unknown
    serialize: (value: unknown) => Record<string, unknown>
  }
}

function textField(
  path: string,
  options?: {
    requiredCreate?: boolean
    requiredUpdate?: boolean
    defaultValue?: string
  },
): FakeField {
  return {
    path,
    graphql: {
      isNonNull: [
        options?.requiredCreate === true,
        options?.requiredUpdate === true,
      ],
    },
    controller: {
      defaultValue: options?.defaultValue ?? '',
      serialize: (value) => {
        const raw = String(value ?? '').trim()
        return { [path]: raw || undefined }
      },
    },
  }
}

function structuredField(path: string, defaultValue: unknown = ''): FakeField {
  return {
    path,
    graphql: { isNonNull: [false, false] },
    controller: {
      defaultValue,
      serialize: (value) => {
        if (typeof value === 'string') {
          const raw = value.trim()
          return { [path]: raw ? JSON.parse(raw) : undefined }
        }
        return { [path]: value }
      },
    },
  }
}

describe('dashboard form-state parity helpers', () => {
  it('builds default state from field controller defaults', () => {
    const fields = {
      title: textField('title'),
      note: textField('note', { defaultValue: 'draft' }),
    }

    expect(makeDefaultValueState(fields as any)).toEqual({
      title: '',
      note: 'draft',
    })
  })

  it('does not treat unchanged required create fields as dirty', () => {
    const fields = {
      name: textField('name', { requiredCreate: true }),
      description: textField('description'),
    }
    const value = makeDefaultValueState(fields as any)

    expect(
      serializeValueToOperationItem('create', fields as any, value, value),
    ).toEqual({ name: undefined })
    expect(hasFormChanges('create', fields as any, value, value)).toBe(false)
  })

  it('detects create changes when a user enters a new value', () => {
    const fields = {
      title: textField('title'),
    }
    const reference = makeDefaultValueState(fields as any)
    const next = { ...reference, title: 'Hello world' }

    expect(
      serializeValueToOperationItem('create', fields as any, next, reference),
    ).toEqual({ title: 'Hello world' })
    expect(hasFormChanges('create', fields as any, next, reference)).toBe(true)
  })

  it('does deep compare structured update values instead of relying on reference equality', () => {
    const fields = {
      image: structuredField('image'),
    }
    const reference = {
      image: JSON.stringify(
        { id: 'asset_1', url: '/uploads/asset_1.png' },
        null,
        2,
      ),
    }
    const next = {
      image: JSON.stringify(
        { id: 'asset_1', url: '/uploads/asset_1.png' },
        null,
        2,
      ),
    }

    expect(
      serializeValueToOperationItem('update', fields as any, next, reference),
    ).toEqual({})
    expect(hasFormChanges('update', fields as any, next, reference)).toBe(false)
  })

  it('detects meaningful update changes for structured values', () => {
    const fields = {
      image: structuredField('image'),
    }
    const reference = {
      image: JSON.stringify(
        { id: 'asset_1', url: '/uploads/asset_1.png' },
        null,
        2,
      ),
    }
    const next = {
      image: JSON.stringify(
        { id: 'asset_2', url: '/uploads/asset_2.png' },
        null,
        2,
      ),
    }

    expect(
      serializeValueToOperationItem('update', fields as any, next, reference),
    ).toEqual({
      image: { id: 'asset_2', url: '/uploads/asset_2.png' },
    })
    expect(hasFormChanges('update', fields as any, next, reference)).toBe(true)
  })
})
