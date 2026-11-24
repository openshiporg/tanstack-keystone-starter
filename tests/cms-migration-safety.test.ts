import { describe, expect, it } from 'vitest'

import {
  assertMigrationIsSafe,
  inspectMigrationSql,
} from '../src/features/cms/migration-safety'

describe('CMS migration safety boundary', () => {
  it('allows additive Prisma SQL without an acknowledgement', () => {
    const risk = inspectMigrationSql(
      'ALTER TABLE "Project" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;',
    )

    expect(risk).toEqual({ destructive: false, operations: [] })
    expect(() =>
      assertMigrationIsSafe(risk, {
        allowDestructive: false,
        migrationName: 'add_priority',
      }),
    ).not.toThrow()
  })

  it('requires explicit acknowledgement for data-removing SQL', () => {
    const risk = inspectMigrationSql(
      'ALTER TABLE "Project" DROP COLUMN "legacyText";',
    )

    expect(risk).toEqual({ destructive: true, operations: ['drop-column'] })
    expect(() =>
      assertMigrationIsSafe(risk, {
        allowDestructive: false,
        migrationName: 'remove_legacy_text',
      }),
    ).toThrow(/requires explicit acknowledgement.*drop-column/)
  })

  it('permits an acknowledged destructive migration after inspection', () => {
    const risk = inspectMigrationSql(
      'DROP TABLE "Project";\nDELETE FROM "Project";',
    )

    expect(() =>
      assertMigrationIsSafe(risk, {
        allowDestructive: true,
        migrationName: 'remove_project',
      }),
    ).not.toThrow()
  })
})
