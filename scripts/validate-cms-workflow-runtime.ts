import { graphql, isObjectType } from 'graphql'

import { createPrismaCmsAdapter } from '../src/features/cms/adapters/prisma'
import type { CmsContext } from '../src/features/cms/adapters'
import { initialiseLists } from '../src/features/cms/config'
import cmsConfig from '../cms.config'
import { createCmsPrismaClient } from '../src/features/cms/prisma-client'
import { getCmsGraphQLSchema } from '../src/features/cms/runtime'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

async function execute(source: string, variables?: Record<string, unknown>) {
  const lists = initialiseLists(cmsConfig)
  const prisma = createCmsPrismaClient()
  const adapter = createPrismaCmsAdapter({ prisma, lists })
  const context = {
    adapter,
    session: undefined,
    __internal: { sudo: true, lists },
    sudo() {
      return this
    },
    withSession() {
      return this
    },
  } as unknown as CmsContext

  try {
    const result = await graphql({
      schema: getCmsGraphQLSchema(),
      source,
      variableValues: variables,
      contextValue: context,
    })
    if (result.errors?.length)
      throw new Error(result.errors.map((error) => error.message).join('\n'))
    return record(result.data)
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  const phase = process.env.GAP14_PHASE ?? 'baseline'
  const projectId = process.env.GAP14_PROJECT_ID

  if (phase === 'baseline') {
    const data = await execute(/* GraphQL */ `
      mutation Gap14Baseline {
        createProject(
          data: {
            name: "Existing Project"
            legacyText: "preserve-me"
            customLabel: "Custom value"
          }
        ) {
          id
          name
          legacyText
          customLabel
        }
      }
    `)
    const project = record(data.createProject)
    assert(
      project.id,
      'baseline CRUD did not create the representative project',
    )
    console.log(JSON.stringify({ projectId: project.id }))
    return
  }

  assert(projectId, 'GAP14_PROJECT_ID is required after baseline')
  const schema = getCmsGraphQLSchema()
  const lists = initialiseLists(cmsConfig)
  const project = await execute(
    phase === 'add'
      ? `query Gap14Add { project(where: { id: "${projectId}" }) { id name legacyText customLabel priority } }`
      : phase === 'rename'
        ? `query Gap14Rename { project(where: { id: "${projectId}" }) { id name legacyText customLabel rank } }`
        : phase === 'type'
          ? `query Gap14Type { project(where: { id: "${projectId}" }) { id name legacyText customLabel rank } }`
          : phase === 'relation'
            ? `query Gap14Relation { project(where: { id: "${projectId}" }) { id name legacyText customLabel rank owner { id name } } }`
            : phase === 'remove'
              ? `query Gap14Remove { project(where: { id: "${projectId}" }) { id name customLabel rank owner { id name } } }`
              : `query Gap14Revert { project(where: { id: "${projectId}" }) { id name legacyText customLabel rank owner { id name } } }`,
  )
  const existing = record(project.project)
  assert(existing.id === projectId, `${phase} lost the existing project row`)
  const projectType = schema.getType('Project')
  if (isObjectType(projectType)) {
    const hasLegacyText = Boolean(projectType.getFields().legacyText)
    assert(
      hasLegacyText === (phase !== 'remove'),
      'unexpected Project GraphQL schema state',
    )
  }

  let relationOwnerId: string | undefined
  if (phase === 'relation') {
    const memberData = await execute(/* GraphQL */ `
      mutation Gap14Member {
        createMember(data: { name: "Existing Member" }) {
          id
        }
      }
    `)
    const member = record(memberData.createMember)
    assert(member.id, 'relation migration did not expose Member CRUD')
    const ownerUpdate = await execute(
      `mutation Gap14Owner($projectId: ID!, $memberId: ID!) { updateProject(where: { id: $projectId }, data: { owner: { connect: { id: $memberId } } }) { id owner { id name } } }`,
      { projectId, memberId: member.id },
    )
    relationOwnerId = String(record(record(ownerUpdate.updateProject).owner).id)
    assert(
      relationOwnerId === String(member.id),
      'relation migration did not persist the connected owner through CRUD',
    )
  }

  const updateData =
    phase === 'add'
      ? 'priority: 7'
      : phase === 'rename'
        ? 'rank: 7'
        : phase === 'type'
          ? 'rank: 7.5'
          : phase === 'revert'
            ? 'legacyText: "restored-field"'
            : 'customLabel: "updated-custom-value"'
  const createFields =
    phase === 'add'
      ? 'name priority legacyText customLabel'
      : phase === 'rename' || phase === 'type'
        ? 'name rank legacyText customLabel'
        : phase === 'relation'
          ? 'name rank legacyText customLabel owner { id }'
          : phase === 'revert'
            ? 'name legacyText customLabel rank owner { id }'
            : 'name customLabel rank owner { id }'
  const createData =
    phase === 'add'
      ? 'name: "CRUD Add" priority: 2 legacyText: "temporary" customLabel: "custom"'
      : phase === 'rename' || phase === 'type'
        ? 'name: "CRUD Changed" rank: 2 legacyText: "temporary" customLabel: "custom"'
        : phase === 'relation'
          ? 'name: "CRUD Relation" rank: 2 legacyText: "temporary" customLabel: "custom"'
          : phase === 'revert'
            ? 'name: "CRUD Revert" legacyText: "temporary" customLabel: "custom"'
            : 'name: "CRUD Remove" customLabel: "custom"'

  const updated = await execute(
    `mutation Gap14Update($projectId: ID!) { updateProject(where: { id: $projectId }, data: { ${updateData} }) { id ${createFields} } }`,
    { projectId },
  )
  const updatedProject = record(updated.updateProject)
  assert(updatedProject.id === projectId, `${phase} dashboard update failed`)
  if (phase === 'add')
    assert(updatedProject.priority === 7, 'add field update was not persisted')
  if (phase === 'rename' || phase === 'type')
    assert(
      updatedProject.rank === (phase === 'type' ? 7.5 : 7),
      `${phase} update was not persisted`,
    )
  if (phase === 'relation')
    assert(
      record(updatedProject.owner).id === relationOwnerId,
      'relation owner was not returned by dashboard CRUD',
    )
  if (phase === 'revert')
    assert(
      updatedProject.legacyText === 'restored-field',
      'reverted field update was not persisted',
    )

  const created = await execute(
    `mutation Gap14Create { createProject(data: { ${createData} }) { id ${createFields} } }`,
  )
  const createdProject = record(created.createProject)
  assert(createdProject.id, `${phase} dashboard create failed`)

  const deleted = await execute(
    `mutation Gap14Delete($id: ID!) { deleteProject(where: { id: $id }) { id } }`,
    { id: createdProject.id },
  )
  assert(
    record(deleted.deleteProject).id === createdProject.id,
    `${phase} dashboard delete failed`,
  )

  const customField = lists
    .find((list) => list.key === 'Project')
    ?.fields.find((field) => field.path === 'customLabel')
  assert(
    customField?.fieldMeta?.customViewMarker === 'gap14-custom-view',
    `${phase} lost custom-view metadata in a fresh process`,
  )
  console.log(
    JSON.stringify({
      phase,
      projectId,
      fieldPaths: lists
        .find((list) => list.key === 'Project')
        ?.fields.map((field) => field.path),
      customViewMarker: customField.fieldMeta?.customViewMarker,
      rank: existing.rank ?? null,
      ownerId: record(existing.owner).id ?? relationOwnerId ?? null,
    }),
  )
}

await main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
