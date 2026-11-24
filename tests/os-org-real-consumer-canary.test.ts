import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, it } from 'vitest'

// Resolve the external source oracle independently of this repository's location.
// The parity suite is intentionally run from disposable copies, where ../../os.org
// points into /private/tmp rather than the shared Code workspace.
const sourceRoot = path.resolve(
  process.env.OS_ORG_SOURCE_ROOT ?? '/Users/junaid/Code/os.org',
)
const { permissions, rules } = await import(
  pathToFileURL(path.join(sourceRoot, 'features/keystone/access.ts')).href
)

type Session = {
  itemId: string
  listKey: string
  data: {
    name: string
    role: Record<string, string | boolean>
  }
}
const originalPublicSignups = process.env.PUBLIC_SIGNUPS_ALLOWED

const memberSession: Session = {
  itemId: 'member-1',
  listKey: 'User',
  data: {
    name: 'Member',
    role: {
      id: 'member-role',
      name: 'Member',
      canCreateTodos: false,
      canManageAllTodos: false,
      canSeeOtherPeople: false,
      canEditOtherPeople: false,
      canManagePeople: false,
      canManageRoles: false,
      canAccessDashboard: false,
    },
  },
}

const adminSession: Session = {
  ...memberSession,
  itemId: 'admin-1',
  data: {
    ...memberSession.data,
    name: 'Admin',
    role: {
      ...memberSession.data.role,
      id: 'admin-role',
      name: 'Admin',
      canManagePeople: true,
      canManageRoles: true,
      canAccessDashboard: true,
    },
  },
}

afterEach(() => {
  if (originalPublicSignups === undefined) {
    delete process.env.PUBLIC_SIGNUPS_ALLOWED
  } else {
    process.env.PUBLIC_SIGNUPS_ALLOWED = originalPublicSignups
  }
})

describe('os.org real-consumer canary source contract', () => {
  it('retains owner filters, item billing access, and privileged overrides', () => {
    assert.deepEqual(rules.canReadOwnedInstances({ session: memberSession }), {
      user: { id: { equals: 'member-1' } },
    })
    assert.deepEqual(
      rules.canReadOwnedSubscriptions({ session: memberSession }),
      { user: { id: { equals: 'member-1' } } },
    )
    assert.equal(rules.canReadOwnedInstances({ session: adminSession }), true)
    assert.equal(
      rules.canReadOwnedSubscriptions({ session: adminSession }),
      true,
    )
    assert.equal(rules.canReadOwnBilling({ session: memberSession }), false)
    assert.equal(
      rules.canReadOwnBilling({
        session: memberSession,
        item: { id: 'member-1' },
      }),
      true,
    )
    assert.equal(
      rules.canReadOwnBilling({
        session: memberSession,
        item: { id: 'other-1' },
      }),
      false,
    )
    assert.equal(
      rules.canReadOwnBilling({
        session: adminSession,
        item: { id: 'member-1' },
      }),
      true,
    )
  })

  it('keeps people/role writes privileged and public signup explicitly opt-in', () => {
    process.env.PUBLIC_SIGNUPS_ALLOWED = 'false'
    assert.equal(permissions.canCreatePeople({ session: memberSession }), false)
    assert.equal(permissions.canManagePeople({ session: memberSession }), false)
    assert.equal(permissions.canManageRoles({ session: memberSession }), false)
    assert.equal(permissions.canCreatePeople({ session: adminSession }), true)
    assert.equal(permissions.canManagePeople({ session: adminSession }), true)
    assert.equal(permissions.canManageRoles({ session: adminSession }), true)

    process.env.PUBLIC_SIGNUPS_ALLOWED = 'true'
    assert.equal(permissions.canCreatePeople({}), true)
  })

  it('binds the fixture to the checked-in auth and six-migration source history', () => {
    const config = readFileSync(
      path.join(sourceRoot, 'features/keystone/index.ts'),
      'utf8',
    )
    assert.match(config, /listKey:\s*["']User["']/)
    assert.match(config, /identityField:\s*["']email["']/)
    assert.match(config, /secretField:\s*["']password["']/)
    assert.match(config, /canManagePeople:\s*true/)
    assert.match(config, /canManageRoles:\s*true/)
    assert.match(config, /canAccessDashboard:\s*true/)
    assert.match(
      config,
      /session\?\.data\.role\?\.canAccessDashboard\s*\?\?\s*false/,
    )
    assert.deepEqual(
      readdirSync(path.join(sourceRoot, 'migrations'))
        .filter((entry) => /^\d/.test(entry))
        .sort(),
      [
        '20250728190557_initial_migration',
        '20250730054036_add_application_field_to_product',
        '20250730193550_add_custom_domain_to_instance_field',
        '20250803194026_add_waitlists',
        '20250804190343_add_password_reset_tokens',
        '20260718120000_scope_deployment_ownership',
      ],
    )
  })
})
