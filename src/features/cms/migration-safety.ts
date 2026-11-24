export type MigrationRisk = {
  destructive: boolean
  operations: string[]
}

const destructivePatterns: Array<[string, RegExp]> = [
  ['drop-column', /\bDROP\s+COLUMN\b/i],
  ['drop-table', /\bDROP\s+TABLE\b/i],
  ['delete-data', /\bDELETE\s+FROM\b/i],
  ['truncate-data', /\bTRUNCATE\b/i],
  ['drop-index', /\bDROP\s+INDEX\b/i],
  ['drop-constraint', /\bDROP\s+CONSTRAINT\b/i],
]

/**
 * Classify the SQL Prisma generated before it is applied.
 *
 * Prisma remains responsible for migration generation and its shadow-database
 * data-loss analysis. This small classifier is only the explicit application
 * boundary required by this project: destructive SQL must be acknowledged by
 * the caller before `migrate deploy` is allowed to run.
 */
export function inspectMigrationSql(sql: string): MigrationRisk {
  const operations = destructivePatterns
    .filter(([, pattern]) => pattern.test(sql))
    .map(([operation]) => operation)

  return {
    destructive: operations.length > 0,
    operations,
  }
}

export function assertMigrationIsSafe(
  risk: MigrationRisk,
  options: { allowDestructive: boolean; migrationName: string },
) {
  if (!risk.destructive || options.allowDestructive) return

  throw new Error(
    `Destructive Prisma migration "${options.migrationName}" requires explicit acknowledgement. ` +
      `Detected operations: ${risk.operations.join(', ')}. ` +
      'Customize/inspect the migration first, then rerun with --allow-destructive only after a verified backup.',
  )
}
