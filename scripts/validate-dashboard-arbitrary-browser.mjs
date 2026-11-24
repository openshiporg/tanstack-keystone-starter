import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { runBoundedChild } from './lib/bounded-child.mjs'

const sourceRoot = path.resolve('.')
let temporaryRoot
let fixtureRoot
let sourceNitroFingerprint
let sourceNitroWasPresent = false
const originalWorkingDirectory = process.cwd()
const environmentKeys = [
  'CMS_ADAPTER',
  'CMS_BOOTSTRAP_MODE',
  'DASHBOARD_BROWSER_CURRENT_BUILD',
  'DASHBOARD_BROWSER_MATRIX_MODE',
  'ARBITRARY_BROWSER_EXPECTED_LIST_KEYS',
  'DASHBOARD_FIELD_ZOO',
  'DASHBOARD_FIELD_ZOO_PRISMA',
]
const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
)
const sourceNitroDirectory = path.join(sourceRoot, 'node_modules/.nitro')
const arbitraryCacheMarker = 'Project: list({'

async function directoryFingerprint(directory) {
  const hash = createHash('sha256')
  async function visit(current, relative = '') {
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch (error) {
      if (error?.code === 'ENOENT') {
        hash.update('absent')
        return
      }
      throw error
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const entryRelative = path.join(relative, entry.name)
      const entryPath = path.join(current, entry.name)
      hash.update(`${entry.isDirectory() ? 'd' : 'f'}:${entryRelative}\0`)
      if (entry.isDirectory()) await visit(entryPath, entryRelative)
      else hash.update(await readFile(entryPath))
    }
  }
  await visit(directory)
  return hash.digest('hex')
}

async function directoryContains(directory, marker) {
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (await directoryContains(entryPath, marker)) return true
      } else if ((await readFile(entryPath)).includes(marker)) return true
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  return false
}

async function linkReadOnlyDependencies() {
  const sourceModules = path.join(sourceRoot, 'node_modules')
  const fixtureModules = path.join(fixtureRoot, 'node_modules')
  await mkdir(fixtureModules)
  const writableCacheNames = new Set([
    '.cache',
    '.nitro',
    '.vite',
    '.vite-temp',
  ])
  for (const entry of await readdir(sourceModules, { withFileTypes: true })) {
    if (writableCacheNames.has(entry.name)) continue
    const sourceEntry = path.join(sourceModules, entry.name)
    const fixtureEntry = path.join(fixtureModules, entry.name)
    if (entry.name.startsWith('@') && entry.isDirectory()) {
      await mkdir(fixtureEntry)
      for (const scopedEntry of await readdir(sourceEntry)) {
        await symlink(
          path.join(sourceEntry, scopedEntry),
          path.join(fixtureEntry, scopedEntry),
        )
      }
    } else {
      await symlink(sourceEntry, fixtureEntry)
    }
  }
}

const fixtureConfig = `import { mergeSchemas } from '@graphql-tools/schema'
import type { GraphQLSchema } from 'graphql'

import { createAuth, statelessSessions } from './src/features/cms/keystone/auth'
import { config, list } from './src/features/cms/keystone/core'
import { checkbox, integer, password, text } from './src/features/cms/keystone/fields'
import type { CmsContext } from './src/features/cms/adapters'

function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: 'type Query { redirectToInit: Boolean }',
    resolvers: {
      Query: {
        redirectToInit: async (_root: unknown, _args: unknown, context: CmsContext) =>
          (await context.sudo().query.Account.count({})) === 0,
      },
    },
  })
}

const session = statelessSessions<{ itemId: string; listKey?: string }>({
  maxAge: 60 * 60 * 24,
})

const { withAuth } = createAuth({
  listKey: 'Account',
  identityField: 'handle',
  secretField: 'secret',
  initFirstItem: { fields: ['displayName', 'handle', 'secret'] },
  sessionData: 'displayName handle',
})

export default withAuth(
  config({
    db: { provider: 'postgresql', url: 'env("DATABASE_URL")' },
    session,
    ui: {
      isAccessAllowed: ({ session: currentSession }) => Boolean(currentSession),
    },
    graphql: { extendGraphqlSchema },
    lists: {
      Account: list({
        ui: {
          hideCreate: true,
          hideNavigation: true,
          labelField: 'displayName',
        },
        fields: {
          displayName: text({ validation: { isRequired: true } }),
          handle: text({
            isIndexed: 'unique',
            validation: { isRequired: true },
          }),
          secret: password({ validation: { isRequired: true } }),
        },
      }),
      Project: list({
        ui: {
          labelField: 'title',
          listView: { initialColumns: ['title', 'code', 'quantity', 'published'] },
        },
        fields: {
          title: text({
            validation: { isRequired: true },
            ui: { views: './custom-field-view.tsx' },
          }),
          code: text({
            isIndexed: 'unique',
            validation: { isRequired: true },
          }),
          quantity: integer({ defaultValue: 0 }),
          published: checkbox({ defaultValue: false }),
        },
      }),
    },
  }),
)
`

const fieldZooFixtureConfig = `import { mergeSchemas } from '@graphql-tools/schema'
import type { GraphQLSchema } from 'graphql'
import { createAuth, statelessSessions } from './src/features/cms/keystone/auth'
import { config, list } from './src/features/cms/keystone/core'
import type { CmsContext } from './src/features/cms/adapters'
import { bigInt, checkbox, decimal, file, float, image, integer, json, multiselect, password, relationship, select, text, timestamp, virtual } from './src/features/cms/keystone/fields'
import { document } from './src/features/cms/keystone/fields-document'

function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: 'type Query { redirectToInit: Boolean }',
    resolvers: {
      Query: {
        redirectToInit: async (_root: unknown, _args: unknown, context: CmsContext) =>
          (await context.sudo().query.Account.count({})) === 0,
      },
    },
  })
}

const session = statelessSessions<{ itemId: string; listKey?: string }>({ maxAge: 60 * 60 * 24 })
const { withAuth } = createAuth({
  listKey: 'Account',
  identityField: 'handle',
  secretField: 'secret',
  initFirstItem: { fields: ['displayName', 'handle', 'secret'] },
  sessionData: 'displayName handle',
})

export default withAuth(config({
  db: { provider: 'postgresql', url: 'env("DATABASE_URL")' },
  session,
  ui: { isAccessAllowed: ({ session: currentSession }) => Boolean(currentSession) },
  graphql: { extendGraphqlSchema },
  storage: {
    zooImages: { kind: 'local', type: 'image', storagePath: '.cms-temp/zoo-images', serverRoute: '/zoo-images' },
    zooFiles: { kind: 'local', type: 'file', storagePath: '.cms-temp/zoo-files', serverRoute: '/zoo-files' },
  },
  lists: {
    Account: list({
      ui: { hideCreate: true, hideNavigation: true, labelField: 'displayName' },
      fields: {
        displayName: text({ validation: { isRequired: true } }),
        handle: text({ isIndexed: 'unique', validation: { isRequired: true } }),
        secret: password({ validation: { isRequired: true } }),
      },
    }),
    FieldZoo: list({
      ui: { labelField: 'title', listView: { initialColumns: ['title', 'status', 'quantity', 'published'] } },
      fields: {
        title: text({ validation: { isRequired: true }, itemView: { fieldMode: 'edit' } }),
        notes: text({ ui: { displayMode: 'textarea' }, itemView: { fieldMode: 'edit' } }),
        published: checkbox({ defaultValue: false, itemView: { fieldMode: 'edit' } }),
        status: select({ defaultValue: 'draft', options: [{ label: 'Draft', value: 'draft' }, { label: 'Live', value: 'live' }], itemView: { fieldMode: 'edit' } }),
        tags: multiselect({ defaultValue: [], options: [{ label: 'Red', value: 'red' }, { label: 'Blue', value: 'blue' }], itemView: { fieldMode: 'edit' } }),
        quantity: integer({ defaultValue: 0, itemView: { fieldMode: 'edit' } }),
        ratio: float({ defaultValue: 0, itemView: { fieldMode: 'edit' } }),
        amount: decimal({ itemView: { fieldMode: 'edit' } }),
        bigCount: bigInt({ itemView: { fieldMode: 'edit' } }),
        occurredAt: timestamp({ itemView: { fieldMode: 'edit' } }),
        metadata: json({ itemView: { fieldMode: 'edit' } }),
        content: document({
          formatting: true,
          links: true,
          dividers: true,
          defaultValue: [{ type: 'paragraph', children: [{ text: 'Zoo document' }] }],
          createView: { fieldMode: 'edit' },
          itemView: { fieldMode: 'edit' },
        }),
        avatar: image({
          storage: 'zooImages',
          createView: { fieldMode: 'hidden' },
          itemView: { fieldMode: 'read' },
        }),
        attachment: file({
          storage: 'zooFiles',
          createView: { fieldMode: 'hidden' },
          itemView: { fieldMode: 'read' },
        }),
        related: relationship({ ref: 'ZooRelated.zoo', many: false, itemView: { fieldMode: 'edit' } }),
        relatedMany: relationship({ ref: 'ZooRelated.zooMany', many: true, itemView: { fieldMode: 'edit' }, ui: { displayMode: 'cards', cardFields: ['label'] } }),
        computed: virtual({ graphQLReturnType: 'String', resolver: (item) => 'Zoo:' + String(item.title ?? '') }),
      },
    }),
    ZooRelated: list({
      ui: { labelField: 'label', hideNavigation: true },
      fields: {
        label: text({ validation: { isRequired: true }, ui: { views: './custom-field-view.tsx' } }),
        zoo: relationship({ ref: 'FieldZoo.related' }),
        zooMany: relationship({ ref: 'FieldZoo.relatedMany', many: true }),
      },
    }),
  },
}))
`

const fieldZooHarnessBranch =
  "    if (process.env.DASHBOARD_FIELD_ZOO === '1') {\n      const fieldZooList = creatableLists.find(\n        (list) => list.key === 'FieldZoo',\n      )\n      assert.ok(fieldZooList, 'FieldZoo was not exposed in AdminMeta')\n      const relatedResult = JSON.parse(\n        await evaluate(`(async () => JSON.stringify(await (await fetch('/api/graphql', {\n        method: 'POST',\n        headers: { 'content-type': 'application/json' },\n        body: JSON.stringify({ query: 'mutation CreateZooRelated { createZooRelated(data: { label: \"Zoo relation\" }) { id label } }' }),\n      })).json()))()`),\n      )\n      assert.deepEqual(relatedResult.errors, undefined)\n      const relatedId = relatedResult.data.createZooRelated.id\n      const values = {\n        title: 'Zoo dashboard item',\n        notes: 'Long form notes',\n        published: true,\n        status: 'live',\n        tags: ['red', 'blue'],\n        quantity: 42,\n        ratio: 3.5,\n        amount: '19.99',\n        bigCount: '9007199254740993',\n        occurredAt: new Date('2026-01-02T03:04:05').toISOString(),\n        metadata: { source: 'field-zoo', enabled: true },\n        content: {\n          document: [\n            { type: 'paragraph', children: [{ text: 'Zoo document' }] },\n          ],\n        },\n        related: { connect: { id: relatedId } },\n        relatedMany: { connect: [{ id: relatedId }] },\n      }\n      const fieldContainer = (path) =>\n        `document.querySelector('label[for=${JSON.stringify(`field-${path}`)}]')?.parentElement`\n      const setNativeValue = async (rootExpression, controlSelector, value) => {\n        await evaluate(`(() => {\n          const root = ${rootExpression}\n          const node = root?.querySelector(${JSON.stringify(controlSelector)})\n          if (!node) throw new Error('Missing field control: ' + ${JSON.stringify(controlSelector)})\n          const prototype = node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype\n          const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set\n          setter?.call(node, ${JSON.stringify(String(value))})\n          node.dispatchEvent(new Event('input', { bubbles: true }))\n          node.dispatchEvent(new Event('change', { bubbles: true }))\n        })()`)\n      }\n      const uploadFile = async (path, filename, type) => {\n        await evaluate(`(() => {\n          const inputs = Array.from(document.querySelectorAll('input[type=file]'))\n          const input = inputs[${path === 'avatar' ? 0 : 1}]\n          if (!input) throw new Error('Missing upload input for ${path}')\n          const transfer = new DataTransfer()\n          transfer.items.add(new File([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,3,0,0,0,2,8,6,0,0,0,157,116,97,26,0,0,0,0,73,69,78,68,174,66,96,130])], ${JSON.stringify(filename)}, { type: ${JSON.stringify(type)} }))\n          input.files = transfer.files\n          input.dispatchEvent(new Event('change', { bubbles: true }))\n        })()`)\n      }\n      await createDashboardItem({\n        listPath: fieldZooList.path,\n        singular: fieldZooList.singular,\n        mutationName: fieldZooList.graphql.names.createMutationName,\n        persistedText: values.title,\n        fill: async () => {\n          for (const field of fieldZooList.fields.filter(\n            (field) => field.createView.fieldMode === 'edit',\n          )) {\n            const kind = field.fieldMeta.kind\n            const root = fieldContainer(field.path)\n            if (kind === 'checkbox') {\n              await clickExpression(`${root}?.querySelector('[role=checkbox]')`)\n            } else if (kind === 'select') {\n              await setNativeValue(root, 'select', values[field.path] ?? 'live')\n            } else if (kind === 'multiselect') {\n              await evaluate(\n                `(() => { const root = ${root}; const inputs = Array.from(root?.querySelectorAll('input[type=checkbox]') ?? []); inputs.forEach((input) => { if (!input.checked) input.click() }); })()`,\n              )\n            } else if (kind === 'document') {\n              await clickExpression(\n                `Array.from(document.querySelectorAll('button')).find((button) => button.innerText.includes('JSON'))`,\n              )\n              await waitForPage(\n                `${root}?.querySelector('textarea') !== null`,\n                'field-zoo document JSON editor',\n              )\n              await typeNode(\n                await evaluateNode(`${root}?.querySelector('textarea')`),\n                JSON.stringify(values.content),\n              )\n            } else if (kind === 'timestamp') {\n              await setNativeValue(root, 'input[type=date]', '2026-01-02')\n              await setNativeValue(root, 'input[type=time]', '03:04:05')\n            } else if (kind === 'json') {\n              await setNativeValue(\n                root,\n                'textarea',\n                JSON.stringify(values.metadata),\n              )\n            } else if (kind === 'image') {\n              await uploadFile(field.path, 'zoo.png', 'image/png')\n            } else if (kind === 'file') {\n              await uploadFile(field.path, 'zoo.txt', 'text/plain')\n            } else if (kind === 'relationship') {\n              await waitForPage(\n                `${root} && Array.from(${root}.querySelectorAll('button')).some((button) => button.innerText.includes('Zoo relation'))`,\n                `${field.path} relationship option`,\n              )\n              await clickExpression(\n                `Array.from(${root}.querySelectorAll('button')).find((button) => button.innerText.includes('Zoo relation'))`,\n              )\n            } else {\n              const value = values[field.path] ?? `Zoo ${field.path}`\n              await typeNode(\n                await evaluateNode(`${root}?.querySelector('input, textarea')`),\n                String(value),\n              )\n            }\n          }\n        },\n        assertRequest: () => {},\n        afterReload: async ({ createdId, createdPath }) => {\n          const documentUpdate = JSON.parse(\n            await evaluate(`(async () => JSON.stringify(await (await fetch('/api/graphql', {\n            method: 'POST', headers: { 'content-type': 'application/json' },\n            body: JSON.stringify({ query: 'mutation ZooDocument($id: ID!, $related: ID!) { updateFieldZoo(where: { id: $id }, data: { ratio: 3.5, amount: \"19.99\", bigCount: \"9007199254740993\", occurredAt: \"${values.occurredAt}\", metadata: { source: \"field-zoo\", enabled: true }, content: { document: [{ type: \"paragraph\", children: [{ text: \"Zoo document\" }] }] }, related: { connect: { id: $related } }, relatedMany: { connect: [{ id: $related }] } }) { id } }', variables: { id: ${JSON.stringify(createdId)}, related: ${JSON.stringify(relatedId)} } }),\n          })).json()))()`),\n          )\n          assert.deepEqual(documentUpdate.errors, undefined)\n          const persisted = JSON.parse(\n            await evaluate(`(async () => JSON.stringify(await (await fetch('/api/graphql', {\n            method: 'POST', headers: { 'content-type': 'application/json' },\n            body: JSON.stringify({ query: 'query ZooPersisted($id: ID!) { fieldZoo(where: { id: $id }) { id title notes published status tags quantity ratio amount bigCount occurredAt metadata content { document } avatar { id extension filesize } attachment { filename filesize } related { id label } relatedMany { id label } computed } }', variables: { id: ${JSON.stringify(createdId)} } }),\n          })).json()))()`),\n          )\n          assert.deepEqual(persisted.errors, undefined)\n          const item = persisted.data.fieldZoo\n          assert.equal(item.title, values.title)\n          assert.equal(item.notes, values.notes)\n          assert.equal(item.published, true)\n          assert.equal(item.status, values.status)\n          assert.deepEqual(item.tags, values.tags)\n          assert.equal(item.quantity, values.quantity)\n          assert.equal(item.ratio, values.ratio)\n          assert.equal(item.amount, values.amount)\n          assert.equal(item.bigCount, values.bigCount)\n          assert.equal(item.occurredAt, values.occurredAt)\n          assert.equal(item.metadata.source, 'field-zoo')\n          assert.equal(\n            item.content.document[0].children[0].text,\n            'Zoo document',\n          )\n          assert.equal(item.related.id, relatedId)\n          assert.equal(item.relatedMany[0].id, relatedId)\n          assert.equal(item.computed, `Zoo:${values.title}`)\n\n          await navigate(createdPath)\n          await waitForPage(`${fieldContainer('title')}?.querySelector('input')?.value === ${JSON.stringify(values.title)}`, 'field-zoo edit form after mutation reload')\n          await waitForPage(\n            `document.querySelector('#field-related')?.parentElement?.parentElement?.innerText.includes('Zoo relation') && document.querySelector('#field-relatedMany')?.parentElement?.parentElement?.innerText.includes('Zoo relation') && document.querySelector('[data-custom-card-marker=card]')?.textContent === 'CARD:Zoo relation'`,\n            'field-zoo relationship hydration after mutation reload',\n          )\n          const reloadedUi = JSON.parse(\n            await evaluate(`(() => JSON.stringify({\n              title: document.querySelector('#field-title')?.value,\n              notes: document.querySelector('#field-notes')?.value,\n              published: document.querySelector('#field-published')?.getAttribute('aria-checked'),\n              status: document.querySelector('#field-status')?.value,\n              tags: Array.from(document.querySelectorAll('#field-tags input[type=checkbox]')).filter((input) => input.checked).map((input) => input.nextSibling?.textContent?.trim()),\n              quantity: document.querySelector('#field-quantity')?.value,\n              ratio: document.querySelector('#field-ratio')?.value,\n              amount: document.querySelector('#field-amount')?.value,\n              bigCount: document.querySelector('#field-bigCount')?.value,\n              occurredAt: [document.querySelector('#field-occurredAt input[type=date]')?.value, document.querySelector('#field-occurredAt input[type=time]')?.value],\n              metadata: document.querySelector('#field-metadata textarea')?.value,\n              content: document.querySelector('label[for=\\\"field-content\\\"]')?.parentElement?.innerText.includes('Zoo document'),\n              related: document.querySelector('#field-related')?.parentElement?.parentElement?.innerText.includes('Zoo relation'),\n              relatedMany: document.querySelector('#field-relatedMany')?.parentElement?.parentElement?.innerText.includes('Zoo relation'),\n              cardValues: Array.from(document.querySelectorAll('[data-custom-card-marker=card]')).map((node) => node.textContent),\n              computed: document.querySelector('#field-computed-label')?.parentElement?.innerText.includes('Zoo:Zoo dashboard item'),\n            }))()`),\n          )\n          assert.deepEqual(reloadedUi, {\n            title: values.title,\n            notes: values.notes,\n            published: 'true',\n            status: values.status,\n            tags: ['Red', 'Blue'],\n            quantity: String(values.quantity),\n            ratio: String(values.ratio),\n            amount: values.amount,\n            bigCount: values.bigCount,\n            occurredAt: ['2026-01-02', '03:04:05'],\n            metadata: JSON.stringify(values.metadata, null, 2),\n            content: true,\n            related: true,\n            relatedMany: true,\n            cardValues: ['CARD:Zoo relation'],\n            computed: true,\n          })\n          await replaceNode(\n            await evaluateNode(`${fieldContainer('title')} input`),\n            'Zoo dashboard item updated',\n          )\n          await captureGraphQLMutation('updateFieldZoo', () =>\n            clickText('Save Changes'),\n          )\n          await waitForPage(\n            \"document.body.innerText.includes('Saved changes.') || document.body.innerText.includes('Zoo dashboard item updated')\",\n            'field-zoo edit save',\n          )\n          await navigate(\n            '/dashboard/field-zoos?search=Zoo%20dashboard%20item%20updated',\n          )\n          await waitForPage(\n            \"document.body.innerText.includes('Zoo dashboard item updated')\",\n            'field-zoo list search persistence',\n          )\n        },\n      })\n      return ['FieldZoo']\n    }\n\n"

function restoreEnvironment() {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

let primaryError
let sourceNitroBackup
try {
  temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'tks-arbitrary-browser-'),
  )
  fixtureRoot = path.join(temporaryRoot, 'fixture')
  if (process.env.ARBITRARY_BROWSER_FORCE_PREFLIGHT_FAILURE === '1') {
    throw new Error('Intentional arbitrary fixture preflight failure probe')
  }
  try {
    await access(sourceNitroDirectory)
    sourceNitroWasPresent = true
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  sourceNitroFingerprint = await directoryFingerprint(sourceNitroDirectory)
  if (sourceNitroWasPresent) {
    sourceNitroBackup = path.join(temporaryRoot, 'source-nitro-backup')
    await cp(sourceNitroDirectory, sourceNitroBackup, { recursive: true })
  }
  assert.equal(
    await directoryContains(sourceNitroDirectory, arbitraryCacheMarker),
    false,
    'Source Nitro cache already contains the arbitrary fixture marker',
  )

  await cp(sourceRoot, fixtureRoot, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(sourceRoot, source)
      const topLevel = relative.split(path.sep)[0]
      return !['node_modules', '.output', '.git'].includes(topLevel)
    },
  })
  await linkReadOnlyDependencies()
  const useFieldZoo = process.env.DASHBOARD_FIELD_ZOO === '1'
  await writeFile(
    path.join(fixtureRoot, 'cms.config.ts'),
    useFieldZoo ? fieldZooFixtureConfig : fixtureConfig,
  )
  await writeFile(
    path.join(fixtureRoot, 'custom-field-view.tsx'),
    `import type { ReactNode } from 'react'

export function Field({ value, onChange }: { value: string; onChange?: (value: string) => void }): ReactNode {
  return <input data-custom-field-marker="field" value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} />
}

export function Cell({ item }: { item: Record<string, unknown> }): ReactNode {
  return <span data-custom-cell-marker="cell">CUSTOM:{String(item.title ?? item.label ?? '—')}</span>
}

export function CardValue({ item }: { item: Record<string, unknown> }): ReactNode {
  return <span data-custom-card-marker="card">CARD:{String(item.title ?? item.label ?? '—')}</span>
}

const customControllerPrefix = 'controller:'

export function controller(config: { path: string; label: string; description?: string | null }): Record<string, unknown> {
  return {
    path: config.path,
    label: config.label,
    description: config.description,
    graphqlSelection: config.path,
    defaultValue: '',
    deserialize: (data: Record<string, unknown>) => {
      const raw = String(data[config.path] ?? '')
      return raw.startsWith(customControllerPrefix) ? raw.slice(customControllerPrefix.length) : raw
    },
    serialize: (value: unknown) => ({ [config.path]: customControllerPrefix + String(value ?? '') }),
    validate: (value: unknown, options: { isRequired: boolean }) => !options.isRequired || String(value ?? '').trim().length > 0,
  }
}
`,
  )
  await writeFile(
    path.join(fixtureRoot, 'custom-field-view-contract.test.ts'),
    `import assert from 'node:assert/strict'
import { CardValue, Cell, Field, controller } from './custom-field-view'

const contract = controller({ path: 'title', label: 'Title' }) as any
assert.deepEqual(contract.serialize('Project title'), { title: 'controller:Project title' })
assert.equal(contract.deserialize({ title: 'controller:Project title' }), 'Project title')
assert.equal(typeof Field, 'function')
assert.equal(typeof Cell, 'function')
assert.equal(typeof CardValue, 'function')
`,
  )
  await runBoundedChild('npx', ['tsx', 'custom-field-view-contract.test.ts'], {
    label: 'custom Field/Cell/CardValue/controller fixture contract',
    timeout: 60_000,
    termGrace: 1_000,
    cwd: fixtureRoot,
    env: process.env,
    stdio: 'inherit',
  })

  const usePrisma = process.env.DASHBOARD_FIELD_ZOO_PRISMA === '1'
  const fixtureEnvironment = {
    ...process.env,
    CMS_ADAPTER: usePrisma ? 'prisma' : 'memory',
    CMS_BOOTSTRAP_MODE: 'fresh',
    VITE_CACHE_DIR: path.join(fixtureRoot, '.vite-cache'),
    NITRO_BUILD_DIR: path.join(fixtureRoot, '.nitro-build'),
  }
  if (usePrisma) {
    await runBoundedChild(
      'npm',
      ['run', 'db:push', '--', '--accept-data-loss', '--skip-generate'],
      {
        label: 'field-zoo disposable Prisma schema push',
        timeout: 180_000,
        termGrace: 1_000,
        cwd: fixtureRoot,
        env: fixtureEnvironment,
        stdio: 'inherit',
      },
    )
  }

  await runBoundedChild('npm', ['run', 'build'], {
    label: 'arbitrary-model fixture build',
    timeout: 180_000,
    termGrace: 1_000,
    cwd: fixtureRoot,
    env: fixtureEnvironment,
    stdio: 'inherit',
  })

  if (process.env.ARBITRARY_BROWSER_FORCE_FAILURE_AFTER_BUILD === '1') {
    throw new Error('Intentional arbitrary fixture post-build failure probe')
  }

  {
    const browserHarnessPath = path.join(
      fixtureRoot,
      useFieldZoo
        ? 'scripts/validate-dashboard-field-zoo-browser.mjs'
        : 'scripts/validate-dashboard-custom-browser.mjs',
    )
    const browserHarnessSource = await readFile(
      path.join(fixtureRoot, 'scripts/validate-dashboard-browser.mjs'),
      'utf8',
    )
    const patchedBrowserHarness = browserHarnessSource
      .replace(
        '    for (const list of creatableLists) {',
        fieldZooHarnessBranch + '\n    for (const list of creatableLists) {',
      )
      .replace(
        "await evaluateNode(`${fieldContainer('title')} input`)",
        "await evaluateNode(`${fieldContainer('title')}?.querySelector('input')`)",
      )
      .replace(
        "document.querySelector('#field-title')?.value",
        "document.querySelector('label[for=\\\"field-title\\\"]')?.parentElement?.querySelector('input')?.value",
      )
      .replace(
        "document.querySelector('#field-notes')?.value",
        "document.querySelector('label[for=\\\"field-notes\\\"]')?.parentElement?.querySelector('textarea')?.value",
      )
      .replace(
        "document.querySelector('#field-published')?.getAttribute('aria-checked')",
        "document.querySelector('label[for=\\\"field-published\\\"]')?.parentElement?.querySelector('[role=checkbox]')?.getAttribute('aria-checked')",
      )
      .replace(
        "document.querySelector('#field-status')?.value",
        "document.querySelector('label[for=\\\"field-status\\\"]')?.parentElement?.querySelector('select')?.value",
      )
      .replace(
        "document.querySelectorAll('#field-tags input[type=checkbox]')",
        "document.querySelector('label[for=\\\"field-tags\\\"]')?.parentElement?.querySelectorAll('input[type=checkbox]') ?? []",
      )
      .replace(
        "document.querySelector('#field-quantity')?.value",
        "document.querySelector('label[for=\\\"field-quantity\\\"]')?.parentElement?.querySelector('input')?.value",
      )
      .replace(
        "document.querySelector('#field-ratio')?.value",
        "document.querySelector('label[for=\\\"field-ratio\\\"]')?.parentElement?.querySelector('input')?.value",
      )
      .replace(
        "document.querySelector('#field-amount')?.value",
        "document.querySelector('label[for=\\\"field-amount\\\"]')?.parentElement?.querySelector('input')?.value",
      )
      .replace(
        "document.querySelector('#field-bigCount')?.value",
        "document.querySelector('label[for=\\\"field-bigCount\\\"]')?.parentElement?.querySelector('input')?.value",
      )
      .replace(
        "document.querySelector('#field-occurredAt input[type=date]')?.value",
        "document.querySelector('label[for=\\\"field-occurredAt\\\"]')?.parentElement?.querySelector('input[type=date]')?.value",
      )
      .replace(
        "document.querySelector('#field-occurredAt input[type=time]')?.value",
        "document.querySelector('label[for=\\\"field-occurredAt\\\"]')?.parentElement?.querySelector('input[type=time]')?.value",
      )
      .replace(
        "document.querySelector('#field-metadata textarea')?.value",
        "document.querySelector('label[for=\\\"field-metadata\\\"]')?.parentElement?.querySelector('textarea')?.value",
      )
      .replace(
        "document.querySelector('#field-related')?.innerText.includes('Zoo relation')",
        "document.querySelector('label[for=\\\"field-related\\\"]')?.parentElement?.innerText.includes('Zoo relation')",
      )
      .replace(
        "document.querySelector('#field-relatedMany')?.innerText.includes('Zoo relation')",
        "document.querySelector('label[for=\\\"field-relatedMany\\\"]')?.parentElement?.innerText.includes('Zoo relation')",
      )
      .replace(
        'createView { fieldMode isRequired }',
        'createView { fieldMode isRequired } itemView { fieldMode }',
      )
      .replace(
        'assertRequest: () => {},',
        `assertRequest: (data) => {
          assert.deepEqual(data, {
            title: values.title,
            notes: values.notes,
            published: values.published,
            status: values.status,
            tags: values.tags,
            quantity: values.quantity,
            ratio: values.ratio,
            amount: values.amount,
            bigCount: values.bigCount,
            occurredAt: values.occurredAt,
            metadata: values.metadata,
            content: values.content,
            related: { connect: { id: relatedId } },
            relatedMany: { connect: [{ id: relatedId }] },
          })
        },`,
      )
      .replace(
        "      assert.ok(fieldZooList, 'FieldZoo was not exposed in AdminMeta')",
        `      assert.ok(fieldZooList, 'FieldZoo was not exposed in AdminMeta')
      const hiddenCreateFields = fieldZooList.fields.filter((field) => field.createView.fieldMode === 'hidden').map((field) => field.path)
      assert.deepEqual(
        hiddenCreateFields,
        ['id', 'avatar', 'attachment', 'computed'],
        'Field-zoo hidden create fields changed: ' + JSON.stringify(hiddenCreateFields),
      )
      const readOnlyFields = fieldZooList.fields.filter((field) => field.itemView?.fieldMode === 'read').map((field) => field.path)
      assert.deepEqual(
        readOnlyFields,
        ['id', 'avatar', 'attachment', 'computed'],
        'Field-zoo read-only fields changed: ' + JSON.stringify(readOnlyFields),
      )`,
      )
      .replace(
        'assertRequest: (data) => {\n          assert.deepEqual(data, submittedValues)\n        },',
        "assertRequest: (data) => {\n          assert.deepEqual(data, { ...submittedValues, title: 'controller:' + submittedValues.title })\n        },",
      )
      .replace(
        `            await waitForPage(
              "document.querySelector('[data-custom-cell-marker=cell]') !== null",
              'custom Cell module marker',
            )`,
        `            const expectedCustomCell = 'CUSTOM:controller:' + submittedValues.title
            await waitForPage(
              "document.querySelector('[data-custom-cell-marker=cell]')?.textContent === " + JSON.stringify(expectedCustomCell),
              'custom Cell controller rehydration',
            )`,
      )
      .replace(
        '            ...submittedValues,\n          })',
        "            ...submittedValues,\n            title: 'controller:' + submittedValues.title,\n          })",
      )
    assert.notEqual(
      patchedBrowserHarness,
      browserHarnessSource,
      'Fixture browser harness patch target was not found',
    )
    await writeFile(browserHarnessPath, patchedBrowserHarness)
  }

  process.chdir(fixtureRoot)
  process.env.CMS_ADAPTER = usePrisma ? 'prisma' : 'memory'
  process.env.CMS_BOOTSTRAP_MODE = 'fresh'
  process.env.DASHBOARD_BROWSER_CURRENT_BUILD = '1'
  process.env.DASHBOARD_BROWSER_MATRIX_MODE = 'arbitrary'
  process.env.DASHBOARD_FIELD_ZOO = useFieldZoo ? '1' : '0'
  process.env.ARBITRARY_BROWSER_EXPECTED_LIST_KEYS = useFieldZoo
    ? 'FieldZoo'
    : 'Project'
  try {
    await import(
      `${
        pathToFileURL(
          path.join(
            fixtureRoot,
            useFieldZoo
              ? 'scripts/validate-dashboard-field-zoo-browser.mjs'
              : 'scripts/validate-dashboard-custom-browser.mjs',
          ),
        ).href
      }?arbitrary=${Date.now()}`
    )

    console.log(
      useFieldZoo
        ? 'Field-zoo dashboard acceptance passed for text, textarea, checkbox, select, multiselect, integer, float, decimal, bigInt, timestamp, JSON, document, one/many relationship, and scalar virtual fields; image/file are explicitly hidden/read-only and separately asserted.'
        : 'Arbitrary-model dashboard acceptance passed from AdminMeta discovery without modifying the source workspace.',
    )
  } catch (error) {
    primaryError = error
  }
} finally {
  const cleanupResults = await Promise.allSettled([
    Promise.resolve().then(() => process.chdir(originalWorkingDirectory)),
    Promise.resolve().then(restoreEnvironment),
  ])
  const sourceCacheResult = await Promise.allSettled([
    sourceNitroFingerprint
      ? (async () => {
          if (!sourceNitroWasPresent) {
            await rm(sourceNitroDirectory, { recursive: true, force: true })
            return
          }
          if (sourceNitroBackup) {
            await rm(sourceNitroDirectory, { recursive: true, force: true })
            await cp(sourceNitroBackup, sourceNitroDirectory, {
              recursive: true,
            })
          }
          assert.equal(
            await directoryFingerprint(sourceNitroDirectory),
            sourceNitroFingerprint,
            'Arbitrary fixture changed the source Nitro cache',
          )
          assert.equal(
            await directoryContains(sourceNitroDirectory, arbitraryCacheMarker),
            false,
            'Arbitrary fixture marker leaked into the source Nitro cache',
          )
          assert.equal(
            await directoryContains(sourceNitroDirectory, temporaryRoot),
            false,
            'Arbitrary fixture path leaked into the source Nitro cache',
          )
        })()
      : Promise.resolve(),
  ])
  const removalResult = await Promise.allSettled([
    temporaryRoot
      ? rm(temporaryRoot, { recursive: true, force: true })
      : Promise.resolve(),
  ])
  const errors = [...cleanupResults, ...removalResult, ...sourceCacheResult]
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason)
  if (primaryError && errors.length > 0) {
    throw new AggregateError(
      [primaryError, ...errors],
      'Arbitrary browser fixture and cleanup failed',
    )
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, 'Arbitrary browser fixture cleanup failed')
  }
  if (primaryError) throw primaryError
}
