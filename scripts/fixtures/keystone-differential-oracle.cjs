const path = require('node:path')

async function main() {
  const oracleRoot = process.env.KEYSTONE_DIFFERENTIAL_ORACLE_ROOT
  if (!oracleRoot)
    throw new Error('KEYSTONE_DIFFERENTIAL_ORACLE_ROOT is required')
  const { getContext } = require(
    path.join(oracleRoot, 'node_modules/@keystone-6/core/context'),
  )
  const PrismaModule = require(
    path.join(oracleRoot, 'node_modules/@prisma/client'),
  )
  const builtConfig = require(
    path.join(oracleRoot, '.keystone/config.js'),
  ).default
  const context = getContext(builtConfig, PrismaModule)
  await context.prisma.team.deleteMany()
  await context.prisma.person.deleteMany()
  const team = await context
    .sudo()
    .query.Team.createOne({ data: { name: 'Admins' }, query: 'id name' })
  const ada = await context.sudo().query.Person.createOne({
    data: { name: 'Ada', teams: { connect: [{ id: team.id }] } },
    query: 'id name',
  })
  const ed = await context
    .sudo()
    .query.Person.createOne({ data: { name: 'Ed' }, query: 'id name' })
  await context
    .sudo()
    .query.Person.createOne({ data: { name: 'Zoe' }, query: 'id name' })

  const session = context.withSession({
    itemId: ed.id,
    listKey: 'Person',
    data: { scope: 'self' },
  })
  const unrestricted = context.withSession({
    itemId: ed.id,
    listKey: 'Person',
    data: { scope: 'all' },
  })
  const denied = await context.graphql.raw({
    query: `query { person(where:{id:"${ada.id}"}){id} people{id} peopleCount }`,
  })
  const nested = await session.graphql.raw({
    query: `query { people { name } teams { name people { name } peopleCount } }`,
  })
  const cursor = await unrestricted.graphql.raw({
    query: `query { people(orderBy:[{name:asc}], cursor:{id:"${ada.id}"}) { name } }`,
  })
  const matrix = await unrestricted.graphql.raw({
    query: `query {
      equals: people(where:{name:{equals:"Ed"}}){name}
      contains: people(where:{name:{contains:"e"}}, orderBy:[{name:asc}]){name}
      logical: people(where:{OR:[{name:{equals:"Ada"}},{name:{equals:"Zoe"}}]}, orderBy:[{name:desc}]){name}
      relationSome: people(where:{teams:{some:{name:{equals:"Admins"}}}}){name}
      relationNone: people(where:{teams:{none:{name:{equals:"Admins"}}}}, orderBy:[{name:asc}]){name}
      firstTwo: people(orderBy:[{name:asc}], take:2){name}
      offset: people(orderBy:[{name:asc}], skip:1, take:1){name}
      afterCursor: people(orderBy:[{name:asc}], cursor:{id:"${ada.id}"}, skip:1, take:1){name}
    }`,
  })
  const accessCursor = await session.graphql.raw({
    query: `query { people(orderBy:[{name:asc}], cursor:{id:"${ada.id}"}) { name } }`,
  })
  const contextQuery = await unrestricted.query.Person.findMany({
    where: { name: { contains: 'e' } },
    orderBy: [{ name: 'asc' }],
    query: 'name',
  })
  const contextDb = await unrestricted.db.Person.findMany({
    where: { name: { equals: 'Ed' } },
  })

  globalThis.__probeEvents = []
  const accessThrow = await context
    .withSession({ data: { access: 'throw' } })
    .graphql.raw({
      query: 'mutation { createProbe(data:{label:"x"}) { id } }',
    })
  const accessInvalid = await context
    .withSession({ data: { access: 'invalid' } })
    .graphql.raw({
      query: 'mutation { createProbe(data:{label:"x"}) { id } }',
    })
  const many = await context.graphql.raw({
    query:
      'mutation { createProbes(data:[{label:"good"},{label:"before-bad"},{label:"validate-bad"},{label:"after-bad"}]) { label } }',
  })
  const persistedProbes = await context.prisma.probe.findMany({
    orderBy: { label: 'asc' },
  })
  const normaliseError = (error) => ({
    code: error.extensions?.code ?? null,
    message: error.message.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
  })
  console.log(
    JSON.stringify({
      denial: {
        errors: denied.errors?.map((error) => error.extensions.code) ?? [],
        one: denied.data?.person ?? null,
        many: denied.data?.people ?? null,
        count: denied.data?.peopleCount ?? null,
      },
      nested: {
        errors: nested.errors?.map((error) => error.extensions.code) ?? [],
        top: nested.data.people.map((item) => item.name),
        teams: nested.data.teams.map((team) => ({
          name: team.name,
          people: team.people.map((item) => item.name),
          count: team.peopleCount,
        })),
      },
      cursor: cursor.data.people.map((item) => item.name),
      filtersOrderPagination: Object.fromEntries(
        Object.entries(matrix.data).map(([key, rows]) => [
          key,
          rows.map((item) => item.name),
        ]),
      ),
      inaccessibleCursor: {
        errors:
          accessCursor.errors?.map((error) => error.extensions.code) ?? [],
        rows: accessCursor.data?.people?.map((item) => item.name) ?? null,
      },
      context: {
        query: contextQuery.map((item) => item.name),
        db: contextDb.map((item) => item.name),
      },
      reconciliation: {
        accessThrow: accessThrow.errors?.map(normaliseError) ?? [],
        accessInvalid: accessInvalid.errors?.map(normaliseError) ?? [],
        manyErrors:
          many.errors?.map((error) => error.extensions?.code ?? null) ?? [],
        manyData: many.data?.createProbes ?? null,
        persisted: persistedProbes.map((item) => item.label),
        hookEvents: globalThis.__probeEvents,
      },
    }),
  )
  await context.prisma.$disconnect()
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
