import type { CmsFilterAccessArgs, CmsOperationAccessArgs } from '../types'

export type Session = NonNullable<CmsOperationAccessArgs['session']>

type AppRole = {
  canCreateTodos?: boolean
  canManageAllTodos?: boolean
  canSeeOtherPeople?: boolean
  canEditOtherPeople?: boolean
  canManagePeople?: boolean
  canManageRoles?: boolean
  canAccessDashboard?: boolean
}

export function roleForSession(session: Session | undefined): AppRole {
  const role = session?.data.role
  return role && typeof role === 'object' && !Array.isArray(role)
    ? (role as AppRole)
    : {}
}

type AccessArgs =
  | CmsOperationAccessArgs
  | CmsFilterAccessArgs
  | { session?: Session }

export function isSignedIn({ session }: AccessArgs) {
  return Boolean(session)
}

export const permissions = {
  canCreateTodos: ({ session }: AccessArgs) =>
    roleForSession(session).canCreateTodos ?? false,
  canManageAllTodos: ({ session }: AccessArgs) =>
    roleForSession(session).canManageAllTodos ?? false,
  canManagePeople: ({ session }: AccessArgs) =>
    roleForSession(session).canManagePeople ?? false,
  canManageRoles: ({ session }: AccessArgs) =>
    roleForSession(session).canManageRoles ?? false,
}

export const rules = {
  canReadTodos: ({ session }: AccessArgs) => {
    if (!session) return false

    if (roleForSession(session).canManageAllTodos) {
      return {
        OR: [
          { assignedTo: { id: { equals: session.itemId } } },
          { assignedTo: null, isPrivate: { equals: true } },
          { NOT: { isPrivate: { equals: true } } },
        ],
      }
    }

    return { assignedTo: { id: { equals: session.itemId } } }
  },
  canManageTodos: ({ session }: AccessArgs) => {
    if (!session) return false

    if (roleForSession(session).canManageAllTodos) return true

    return { assignedTo: { id: { equals: session.itemId } } }
  },
  canReadPeople: ({ session }: AccessArgs) => {
    if (!session) return false

    if (roleForSession(session).canSeeOtherPeople) return true

    return { id: { equals: session.itemId } }
  },
  canUpdatePeople: ({ session }: AccessArgs) => {
    if (!session) return false

    if (roleForSession(session).canEditOtherPeople) return true

    return { id: { equals: session.itemId } }
  },
}
