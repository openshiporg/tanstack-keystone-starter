import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  buildSchema,
  findBreakingChanges,
  findDangerousChanges,
  isInputObjectType,
  isObjectType,
} from 'graphql'

const sourceRoot = path.resolve(
  process.env.NEXT_KEYSTONE_STARTER_DIR ?? '../next-keystone-starter',
)
const replacementRoot = process.cwd()

function read(root, relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

function difference(left, right) {
  return [...left].filter((value) => !right.has(value)).sort()
}

function schemaTypeNames(schema) {
  return new Set(
    Object.keys(schema.getTypeMap()).filter((name) => !name.startsWith('__')),
  )
}

function fieldSignature(field) {
  return `${field.name}(${field.args
    .map((argument) => `${argument.name}:${argument.type}`)
    .join(',')}):${field.type}`
}

function compareGraphQL() {
  const source = buildSchema(read(sourceRoot, 'schema.graphql'))
  const replacement = buildSchema(read(replacementRoot, '.cms/schema.graphql'))
  const sourceTypes = schemaTypeNames(source)
  const replacementTypes = schemaTypeNames(replacement)
  const rootDifferences = {}

  for (const rootName of ['Query', 'Mutation']) {
    const sourceRootType = source.getType(rootName)
    const replacementRootType = replacement.getType(rootName)
    assert.ok(isObjectType(sourceRootType) && isObjectType(replacementRootType))
    const sourceFields = sourceRootType.getFields()
    const replacementFields = replacementRootType.getFields()
    const sourceNames = new Set(Object.keys(sourceFields))
    const replacementNames = new Set(Object.keys(replacementFields))
    const signatures = Object.keys(sourceFields)
      .filter((name) => replacementFields[name])
      .filter(
        (name) =>
          fieldSignature(sourceFields[name]) !==
          fieldSignature(replacementFields[name]),
      )
      .map((name) => ({
        field: name,
        source: fieldSignature(sourceFields[name]),
        replacement: fieldSignature(replacementFields[name]),
      }))
    rootDifferences[rootName] = {
      sourceOnly: difference(sourceNames, replacementNames),
      replacementOnly: difference(replacementNames, sourceNames),
      changedSignatures: signatures,
    }
  }

  let sharedInputCount = 0
  const changedInputs = []
  for (const [name, sourceType] of Object.entries(source.getTypeMap())) {
    const replacementType = replacement.getType(name)
    if (!isInputObjectType(sourceType) || !isInputObjectType(replacementType))
      continue
    sharedInputCount += 1
    const sourceFields = sourceType.getFields()
    const replacementFields = replacementType.getFields()
    const changes = []
    const fieldNames = new Set([
      ...Object.keys(sourceFields),
      ...Object.keys(replacementFields),
    ])
    for (const fieldName of fieldNames) {
      const sourceField = sourceFields[fieldName]?.type?.toString() ?? null
      const replacementField =
        replacementFields[fieldName]?.type?.toString() ?? null
      if (sourceField !== replacementField)
        changes.push({ field: fieldName, sourceField, replacementField })
    }
    if (changes.length) changedInputs.push({ input: name, changes })
  }

  return {
    sourceTypeCount: sourceTypes.size,
    replacementTypeCount: replacementTypes.size,
    sourceOnlyTypes: difference(sourceTypes, replacementTypes),
    replacementOnlyTypes: difference(replacementTypes, sourceTypes),
    rootDifferences,
    sharedInputCount,
    changedInputs,
    breakingChanges: findBreakingChanges(source, replacement),
    dangerousChanges: findDangerousChanges(source, replacement),
  }
}

function comparePrisma() {
  const temporaryDirectory = mkdtempSync(
    path.join(os.tmpdir(), 'tks-source-audit-'),
  )
  try {
    const sourceSchemaPath = path.join(temporaryDirectory, 'source.prisma')
    const sourceSchema = read(sourceRoot, 'schema.prisma')
      .split('\n')
      .filter(
        (line) =>
          !line.trimStart().startsWith('url ') &&
          !line.trimStart().startsWith('shadowDatabaseUrl '),
      )
      .join('\n')
    writeFileSync(sourceSchemaPath, sourceSchema)
    const prismaBinary = path.join(replacementRoot, 'node_modules/.bin/prisma')
    const sql = execFileSync(
      prismaBinary,
      [
        'migrate',
        'diff',
        '--from-schema',
        sourceSchemaPath,
        '--to-schema',
        path.join(replacementRoot, 'prisma/schema.prisma'),
        '--script',
      ],
      {
        cwd: replacementRoot,
        env: {
          ...process.env,
          DATABASE_URL:
            process.env.DATABASE_URL ??
            'postgresql://source_audit:source_audit@127.0.0.1:1/source_audit',
        },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    const nonEmptyLines = sql
      .split('\n')
      .filter((line) => line.trim())
      .filter((line) => line.trim() !== '-- This is an empty migration.')
    return {
      sqlLineCount: nonEmptyLines.length,
      dropsTables: (sql.match(/DROP TABLE/g) ?? []).length,
      dropsColumns: (sql.match(/DROP COLUMN/g) ?? []).length,
      typeChanges: (sql.match(/SET DATA TYPE/g) ?? []).length,
      relationTableReplacement:
        sql.includes('DROP TABLE "_Todo_todoImages"') &&
        sql.includes('CREATE TABLE "_TodoImages"'),
      hasDifferences: nonEmptyLines.length > 0,
    }
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}

function compareMigrationHistory() {
  const sourceDirectory = path.join(sourceRoot, 'migrations')
  const replacementDirectory = path.join(replacementRoot, 'prisma/migrations')
  const sourceNames = readdirSync(sourceDirectory)
    .filter((name) => /^\d/.test(name))
    .sort()
  const replacementNames = readdirSync(replacementDirectory)
    .filter((name) => /^\d/.test(name))
    .sort()
  const replacementNameSet = new Set(replacementNames)
  const missingSourceMigrations = sourceNames.filter(
    (name) => !replacementNameSet.has(name),
  )
  const changedSourceMigrations = sourceNames.filter((name) => {
    if (!replacementNameSet.has(name)) return false
    return (
      readFileSync(
        path.join(sourceDirectory, name, 'migration.sql'),
        'utf8',
      ) !==
      readFileSync(
        path.join(replacementDirectory, name, 'migration.sql'),
        'utf8',
      )
    )
  })
  const addedMigrations = replacementNames.filter(
    (name) => !sourceNames.includes(name),
  )
  const adaptationName = '20260718000000_prisma7_join_table_primary_key'
  const adaptationSql = replacementNameSet.has(adaptationName)
    ? readFileSync(
        path.join(replacementDirectory, adaptationName, 'migration.sql'),
        'utf8',
      )
    : ''
  const adaptationIsBounded =
    adaptationSql.includes('DROP INDEX "_Todo_todoImages_AB_unique"') &&
    adaptationSql.includes(
      'ADD CONSTRAINT "_Todo_todoImages_AB_pkey" PRIMARY KEY ("A", "B")',
    ) &&
    !/DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/i.test(adaptationSql)

  return {
    sourceMigrationCount: sourceNames.length,
    copiedSourceMigrationCount:
      sourceNames.length -
      missingSourceMigrations.length -
      changedSourceMigrations.length,
    missingSourceMigrations,
    changedSourceMigrations,
    addedMigrations,
    adaptationName,
    adaptationIsBounded,
  }
}

function sourcePackages() {
  const sourcePackage = JSON.parse(read(sourceRoot, 'package.json'))
  const dependencies = sourcePackage.dependencies ?? {}
  return Object.keys(dependencies)
    .filter((name) => name === 'next' || name.startsWith('@keystone-6/'))
    .sort()
    .map((name) => ({ name, range: dependencies[name] }))
}

const graphql = compareGraphQL()
const prisma = comparePrisma()
const migrationHistory = compareMigrationHistory()
const result = {
  sourceRoot,
  readOnly: true,
  sourceRuntimePackages: sourcePackages(),
  graphql: {
    sourceTypeCount: graphql.sourceTypeCount,
    replacementTypeCount: graphql.replacementTypeCount,
    sourceOnlyTypeCount: graphql.sourceOnlyTypes.length,
    replacementOnlyTypeCount: graphql.replacementOnlyTypes.length,
    sourceOnlyTypes: graphql.sourceOnlyTypes,
    replacementOnlyTypes: graphql.replacementOnlyTypes,
    rootDifferences: graphql.rootDifferences,
    sharedInputCount: graphql.sharedInputCount,
    changedInputCount: graphql.changedInputs.length,
    changedInputs: graphql.changedInputs,
    breakingChangeCount: graphql.breakingChanges.length,
    breakingChanges: graphql.breakingChanges,
    dangerousChangeCount: graphql.dangerousChanges.length,
    dangerousChanges: graphql.dangerousChanges,
  },
  prisma,
  migrationHistory,
}
result.removalGate =
  !prisma.hasDifferences &&
  migrationHistory.missingSourceMigrations.length === 0 &&
  migrationHistory.changedSourceMigrations.length === 0 &&
  migrationHistory.adaptationIsBounded &&
  graphql.sourceOnlyTypes.length === 0 &&
  graphql.changedInputs.length === 0 &&
  graphql.breakingChanges.length === 0 &&
  Object.values(graphql.rootDifferences).every(
    (root) =>
      root.sourceOnly.length === 0 &&
      root.replacementOnly.length === 0 &&
      root.changedSignatures.length === 0,
  )

console.log(JSON.stringify(result, null, 2))
console.log(
  result.removalGate
    ? '\nDirect next-keystone-starter schema/migration removal gate: PASS'
    : '\nDirect next-keystone-starter schema/migration removal gate: BLOCKED',
)
