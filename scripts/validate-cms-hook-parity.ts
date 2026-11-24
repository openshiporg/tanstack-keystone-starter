import assert from 'node:assert/strict'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
} from '../src/features/cms/adapters'
import { config, initialiseLists, list } from '../src/features/cms/config'
import {
  resolveInputForMutation,
  runAfterOperationHooks,
  runBeforeOperationHooks,
  validateResolvedInput,
} from '../src/features/cms/hooks'
import { allowAll } from '../src/features/cms/keystone/access'
import { text } from '../src/features/cms/keystone/fields'
import { buildCmsContext } from '../src/features/cms/runtime'

function barrier(counter: { value: number }, expected: number) {
  counter.value += 1
  return new Promise<void>((resolve, reject) => {
    const startedAt = Date.now()
    const timer = setInterval(() => {
      if (counter.value === expected) {
        clearInterval(timer)
        resolve()
      } else if (Date.now() - startedAt > 500) {
        clearInterval(timer)
        reject(new Error('field hooks ran serially instead of concurrently'))
      }
    }, 1)
  })
}

const resolveStarted = { value: 0 }
const beforeStarted = { value: 0 }
const afterStarted = { value: 0 }
const lists = initialiseLists(
  config({
    lists: {
      HookThing: list({
        access: {
          operation: {
            query: allowAll,
            create: allowAll,
            update: allowAll,
            delete: allowAll,
          },
        },
        hooks: {
          validate: {
            create: ({ addValidationError }) =>
              addValidationError('list validation message'),
          },
        },
        fields: {
          alpha: text({
            hooks: {
              resolveInput: {
                create: async () => {
                  await barrier(resolveStarted, 2)
                  return 'A'
                },
              },
              validate: {
                create: ({ addValidationError }) =>
                  addValidationError('alpha validation message'),
              },
              beforeOperation: { create: () => barrier(beforeStarted, 2) },
              afterOperation: { create: () => barrier(afterStarted, 2) },
            },
          }),
          beta: text({
            hooks: {
              resolveInput: {
                create: async () => {
                  await barrier(resolveStarted, 2)
                  return 'B'
                },
              },
              validate: {
                create: ({ addValidationError }) =>
                  addValidationError('beta validation message'),
              },
              beforeOperation: { create: () => barrier(beforeStarted, 2) },
              afterOperation: { create: () => barrier(afterStarted, 2) },
            },
          }),
        },
      }),
    },
  }),
)
resetMemoryAdapter({ HookThing: [] }, lists)
const context = buildCmsContext({
  adapter: memoryCmsAdapter,
  sudo: true,
  lists,
})
const inputData = { alpha: 'input-a', beta: 'input-b' }
const resolvedData = await resolveInputForMutation({
  listKey: 'HookThing',
  operation: 'create',
  inputData,
  context,
})
assert.deepEqual(
  { alpha: resolvedData.alpha, beta: resolvedData.beta },
  { alpha: 'A', beta: 'B' },
  'concurrent field resolveInput results should merge before the list hook',
)

let validationMessage = ''
try {
  await validateResolvedInput({
    listKey: 'HookThing',
    operation: 'create',
    inputData,
    resolvedData,
    context,
  })
} catch (error) {
  validationMessage = error instanceof Error ? error.message : String(error)
}
for (const expected of [
  'HookThing.alpha: alpha validation message',
  'HookThing.beta: beta validation message',
  'HookThing: list validation message',
]) {
  assert(
    validationMessage.includes(expected),
    `missing aggregated validation message: ${expected}`,
  )
}

const operationArgs = {
  listKey: 'HookThing',
  operation: 'create' as const,
  inputData,
  resolvedData,
  context,
  item: { id: 'hook_1', ...resolvedData },
}
await runBeforeOperationHooks(operationArgs)
await runAfterOperationHooks({ ...operationArgs, originalItem: null })
assert.equal(beforeStarted.value, 2)
assert.equal(afterStarted.value, 2)

const throwingLists = initialiseLists(
  config({
    lists: {
      ThrowingThing: list({
        fields: {
          first: text({
            hooks: {
              resolveInput: {
                create: () => {
                  throw new Error('first failed')
                },
              },
            },
          }),
          second: text({
            hooks: {
              resolveInput: {
                create: () => {
                  throw new Error('second failed')
                },
              },
            },
          }),
        },
      }),
    },
  }),
)
const throwingContext = buildCmsContext({
  adapter: memoryCmsAdapter,
  sudo: true,
  lists: throwingLists,
})
let extensionMessage = ''
try {
  await resolveInputForMutation({
    listKey: 'ThrowingThing',
    operation: 'create',
    inputData: { first: 'x', second: 'y' },
    context: throwingContext,
  })
} catch (error) {
  extensionMessage = error instanceof Error ? error.message : String(error)
}
assert(extensionMessage.includes('ThrowingThing.first.hooks.resolveInput'))
assert(extensionMessage.includes('ThrowingThing.second.hooks.resolveInput'))
assert(extensionMessage.includes('first failed'))
assert(extensionMessage.includes('second failed'))

console.log('CMS hook concurrency and aggregation parity validation passed.')
