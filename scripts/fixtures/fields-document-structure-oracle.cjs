const path = require('node:path')
const { readFile } = require('node:fs/promises')

async function main() {
  const root = process.env.KEYSTONE_STRUCTURE_ORACLE_ROOT
  const { getContext } = require(
    path.join(root, 'node_modules/@keystone-6/core/context'),
  )
  const PrismaModule = require(path.join(root, 'node_modules/@prisma/client'))
  const config = require(path.join(root, '.keystone/config.js')).default
  const context = getContext(config, PrismaModule).sudo()
  await context.prisma.page.deleteMany()
  await context.prisma.person.deleteMany()
  await context.prisma.person.create({ data: { id: 'person-1', name: 'Ada' } })

  const run = async (query, variables) => {
    const result = await context.graphql.raw({ query, variables })
    if (result.errors?.length) throw result.errors[0]
    return JSON.parse(JSON.stringify(result.data))
  }

  const defaults = await run(
    `mutation { createPage(data: {}) { id settings { json } } }`,
  )
  const created = await run(`mutation { createPage(data: { settings: {
    title: "Launch", count: 2,
    author: { connect: { id: "person-1" } },
    reviewers: { connect: [{ id: "person-1" }] },
    tags: ["cms", "parity"],
    mode: { featured: { emphasis: true } }
  } }) { id settings {
    structure { title count author { id name } reviewers { id name } tags }
    raw: json
    hydrated: json(hydrateRelationships: true)
  } } }`)
  const updated =
    await run(`mutation { updatePage(where: { id: "${created.createPage.id}" }, data: {
    settings: { title: "Changed" }
  }) { settings { json } } }`)
  const introspection = await run(`query { __schema { types { kind name } } }`)
  const typeKinds = Object.fromEntries(
    introspection.__schema.types
      .filter((type) => type.name.startsWith('PageSettings'))
      .map((type) => [type.name, type.kind]),
  )
  const prismaField = (await readFile(path.join(root, 'schema.prisma'), 'utf8'))
    .split('\n')
    .find((line) => line.trimStart().startsWith('settings '))
    ?.trim()
  console.log(
    JSON.stringify({
      schema: {
        output: 'PageSettingsOutput',
        createInput: 'PageSettingsCreateInput',
        updateInput: 'PageSettingsUpdateInput',
        conditional: 'PageSettingsMode',
        typeKinds,
        prismaField,
      },
      defaults: defaults.createPage.settings.json,
      created: created.createPage.settings,
      updated: updated.updatePage.settings.json,
    }),
  )
  await context.prisma.$disconnect()
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
