import { describe, expect, it } from 'vitest'

import {
  replaceActionTokens,
  visibleItemActions,
} from '../src/components/dashboard/item-page-actions'

describe('dashboard item page actions', () => {
  it('filters hidden actions and preserves disabled actions', () => {
    const actions = visibleItemActions({
      list: {
        key: 'Task',
        path: 'tasks',
        label: 'Tasks',
        singular: 'Task',
        plural: 'Tasks',
        description: '',
        fields: [],
        fieldMap: {},
        actions: [
          {
            key: 'archive',
            label: 'Archive',
            icon: null,
            messages: {
              promptTitle: 'Archive {singular}',
              promptTitleMany: 'Archive {count} {singular|plural}',
              prompt: 'Prompt',
              promptMany: 'PromptMany',
              promptConfirmLabel: 'Confirm',
              promptConfirmLabelMany: 'ConfirmMany',
              fail: 'Fail',
              failMany: 'FailMany',
              success: 'Success',
              successMany: 'SuccessMany',
            },
            graphql: { names: { one: 'archiveTask', many: 'archiveTasks' } },
            itemView: {
              actionMode: 'enabled',
              navigation: 'follow',
              hidePrompt: false,
              hideToast: false,
            },
            listView: { actionMode: 'enabled' },
          },
          {
            key: 'secret',
            label: 'Secret',
            icon: null,
            messages: {
              promptTitle: 'Secret {singular}',
              promptTitleMany: 'Secret {count} {singular|plural}',
              prompt: 'Prompt',
              promptMany: 'PromptMany',
              promptConfirmLabel: 'Confirm',
              promptConfirmLabelMany: 'ConfirmMany',
              fail: 'Fail',
              failMany: 'FailMany',
              success: 'Success',
              successMany: 'SuccessMany',
            },
            graphql: { names: { one: 'secretTask', many: 'secretTasks' } },
            itemView: {
              actionMode: 'enabled',
              navigation: 'follow',
              hidePrompt: false,
              hideToast: false,
            },
            listView: { actionMode: 'enabled' },
          },
        ],
      } as any,
      actionMetaByKey: {
        archive: {
          actionMode: 'disabled',
          navigation: 'follow',
          hidePrompt: false,
          hideToast: false,
        },
        secret: {
          actionMode: 'hidden',
          navigation: 'follow',
          hidePrompt: false,
          hideToast: false,
        },
      },
    })

    expect(actions).toHaveLength(1)
    expect(actions[0].key).toBe('archive')
    expect(actions[0].itemView.actionMode).toBe('disabled')
  })

  it('replaces Keystone-style action message tokens', () => {
    expect(
      replaceActionTokens('Archive {singular} "{itemLabel}"', {
        singular: 'Task',
        plural: 'Tasks',
        itemLabel: 'Write docs',
      }),
    ).toBe('Archive task "Write docs"')
  })

  it('replaces singular-or-plural tokens using count', () => {
    expect(
      replaceActionTokens('Archive {count} {singular|plural}', {
        singular: 'Task',
        plural: 'Tasks',
        itemLabel: '',
        count: 1,
      }),
    ).toBe('Archive 1 task')

    expect(
      replaceActionTokens('Archive {count} {singular|plural}', {
        singular: 'Task',
        plural: 'Tasks',
        itemLabel: '',
        count: 3,
      }),
    ).toBe('Archive 3 tasks')
  })
})
