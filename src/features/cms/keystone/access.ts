import type { CmsListAccessOperation, CmsOperationAccessArgs } from '../types'

type AccessFunction = (
  args: CmsOperationAccessArgs,
) => boolean | Promise<boolean>

type AccessValue = boolean | AccessFunction

export const allowAll = true
export const denyAll = false

export function allOperations(
  access: AccessValue = true,
): Record<CmsListAccessOperation, AccessValue> {
  return {
    query: access,
    create: access,
    update: access,
    delete: access,
  }
}
