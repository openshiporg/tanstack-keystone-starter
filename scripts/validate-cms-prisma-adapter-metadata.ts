import { cmsLists } from '../src/features/cms/registry'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  await import('../src/features/cms/adapters/prisma')
  const prismaPath =
    '/Users/junaid/code/tanstack-keystone-starter/src/features/cms/adapters/prisma.ts'
  const todoList = cmsLists.find((list) => list.key === 'Todo')
  assert(todoList, 'Todo list should exist')
  const budgetField = todoList.fields.find((field) => field.path === 'budget')
  const largeNumberField = todoList.fields.find(
    (field) => field.path === 'largeNumber',
  )
  const dueDateField = todoList.fields.find((field) => field.path === 'dueDate')
  assert(budgetField, 'Todo.budget field should exist')
  assert(largeNumberField, 'Todo.largeNumber field should exist')
  assert(dueDateField, 'Todo.dueDate field should exist')

  const source = await import('node:fs/promises').then((fs) =>
    fs.readFile(prismaPath, 'utf8'),
  )
  assert(
    source.includes("if (field.kind === 'id') {"),
    'Prisma adapter should special-case id coercion',
  )
  assert(
    source.includes("field.fieldMeta?.idFieldKind === 'autoincrement'"),
    'Prisma adapter should detect autoincrement id fields',
  )
  assert(
    source.includes('? Number.parseInt(String(value), 10)'),
    'Prisma adapter should coerce autoincrement id inputs to numbers for Prisma',
  )
  assert(
    source.includes(': String(value)'),
    'Prisma adapter should preserve string coercion for non-autoincrement ids',
  )
  assert(
    source.includes("if (field.kind === 'id') return String(value)"),
    'Prisma adapter should normalize Prisma id readback to strings for CMS/dashboard contracts',
  )
  assert(
    source.includes("if (field.kind === 'decimal') return String(value)"),
    'Prisma adapter should explicitly coerce decimal writes to strings for provider-native Decimal fields',
  )
  assert(
    source.includes("if (field.kind === 'bigInt') return String(value)"),
    'Prisma adapter should explicitly coerce bigInt writes to strings for provider-native BigInt fields',
  )
  assert(
    source.includes(
      "if (field.kind === 'decimal' || field.kind === 'bigInt') return String(value)",
    ),
    'Prisma adapter should explicitly normalize Decimal/BigInt readback to strings',
  )
  assert(
    source.includes(
      "else if (operator === 'equals') mapped.equals = mapFieldValueForPrisma(field, rawValue)",
    ),
    'Prisma adapter should map scalar equals filters through field-aware Prisma coercion',
  )
  assert(
    source.includes(
      "else if (operator === 'in' || operator === 'notIn') mapped[operator] = Array.isArray(rawValue) ? rawValue.map((value) => mapFieldValueForPrisma(field, value)) : rawValue",
    ),
    'Prisma adapter should map scalar in/notIn filters through field-aware Prisma coercion',
  )
  assert(
    source.includes(
      "else if (['lt', 'lte', 'gt', 'gte'].includes(operator)) mapped[operator] = mapFieldValueForPrisma(field, rawValue)",
    ),
    'Prisma adapter should map scalar range filters through field-aware Prisma coercion',
  )
  assert(
    source.includes('function relationIdForPrisma(list: CmsList, id: unknown)'),
    'Prisma adapter should expose a relation-id coercion helper for relationship writes',
  )
  assert(
    source.includes(
      'return idField ? mapFieldValueForPrisma(idField, id) : id',
    ),
    'Prisma adapter should coerce relationship ids through the related list id field',
  )
  assert(
    source.includes(
      'write.set = setIds.map((id) => ({ id: relatedList ? relationIdForPrisma(relatedList, id) : id }))',
    ),
    'Prisma adapter should coerce many relationship set ids through relationIdForPrisma',
  )
  assert(
    source.includes(
      'write.connect = [...connectIds, ...createdIds].map((id) => ({ id: relatedList ? relationIdForPrisma(relatedList, id) : id }))',
    ),
    'Prisma adapter should coerce many relationship connect ids through relationIdForPrisma',
  )
  assert(
    source.includes(
      'write.disconnect = disconnectIds.map((id) => ({ id: relatedList ? relationIdForPrisma(relatedList, id) : id }))',
    ),
    'Prisma adapter should coerce many relationship disconnect ids through relationIdForPrisma',
  )
  assert(
    source.includes(
      'return { [key]: { connect: { id: relatedList ? relationIdForPrisma(relatedList, connectItem.id) : connectItem.id } } }',
    ),
    'Prisma adapter should coerce single relationship connect ids through relationIdForPrisma',
  )
  assert(
    source.includes('const currentListId = relationIdForPrisma(list, item.id)'),
    'Prisma adapter should coerce the current item id before Prisma relationship resolution queries',
  )
  assert(
    source.includes('? { id: { in: explicitIds } }'),
    'Prisma adapter should preserve explicit relationship id lists for Prisma many relationship resolution',
  )
  assert(
    source.includes(
      ': refFieldPath ? mapWhere(listsByKey, refListKey, { [refFieldPath]: { id: { equals: currentListId } } }) : {}',
    ),
    'Prisma adapter should coerce reverse relationship lookup ids through initialized relationship metadata and relationIdForPrisma',
  )
  assert(
    source.includes(
      'findUnique({ where: { id: currentListId }, include: getIncludeForRelationship(field) })',
    ),
    'Prisma adapter should coerce one-side hydration findUnique ids through relationIdForPrisma',
  )
  assert(
    source.includes(
      'const explicitRelatedId = relationIdForPrisma(listsByKey[refListKey], explicitValue)',
    ),
    'Prisma adapter should coerce explicit related ids through the related list id field before Prisma lookup',
  )
  assert(
    source.includes(
      'const cursorWhere = args.cursor ? uniqueWhereForPrisma(relatedList, args.cursor) : undefined',
    ),
    'Prisma adapter should route relationship cursors through uniqueWhereForPrisma for id-kind-aware coercion',
  )
  assert(
    source.includes(
      'findMany({ where: { AND: [{ id: relationIdForPrisma(relatedList, mapped.id) }, relatedWhere] } })',
    ),
    'Prisma adapter should coerce one-side filtered relationship ids through relationIdForPrisma before Prisma lookup',
  )
  assert(
    source.includes(
      'if (operator in filterRecord && refListKey) mapped[operator] = mapWhere(listsByKey, refListKey, filterRecord[operator])',
    ),
    'Prisma adapter should recurse nested relationship operators through initialized relationship metadata for composed Prisma filters',
  )

  console.info('CMS Prisma adapter metadata validation passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
