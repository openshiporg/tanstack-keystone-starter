import { describe, expect, it } from 'vitest'

import {
  replaceActionTokens,
  visibleItemActions,
} from '../src/components/dashboard/item-page-actions'

describe('dashboard list action metadata', () => {
  it('keeps list actions available when not hidden', () => {
    const actions = visibleItemActions({
      list: {
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
        ],
      } as any,
      actionMetaByKey: {},
    })

    expect(actions).toHaveLength(1)
    expect(actions[0].key).toBe('archive')
  })

  it('supports count-aware singular-or-plural action copy', () => {
    expect(
      replaceActionTokens('Archive {countSuccess} {singular|plural}', {
        singular: 'Task',
        plural: 'Tasks',
        itemLabel: '',
        count: 2,
        countSuccess: 2,
      }),
    ).toBe('Archive 2 tasks')
  })
})
