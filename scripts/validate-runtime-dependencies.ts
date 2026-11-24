import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const forbiddenPackage = /^(?:@keystone-6\/|@keystone-ui\/|next$)/
const forbiddenImport =
  /(?:from\s+|import\s*\(|require\s*\()\s*['"](?:@keystone-6\/|@keystone-ui\/|next(?:\/|['"]))/g
const sourceExtensions = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx'])
const starterDomainLiteral =
  /['"](?:User|Role|Todo|TodoImage|users|roles|todos|todo-images|user_admin|role_admin|todo_launch)['"]/g

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name)
      if (entry.isDirectory()) return sourceFiles(path)
      return sourceExtensions.has(extname(entry.name)) ? [path] : []
    }),
  )
  return files.flat()
}

async function main() {
  const root = process.cwd()
  const packageJson = JSON.parse(
    await readFile(join(root, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
  }
  const declaredPackages = Object.keys({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.optionalDependencies,
    ...packageJson.peerDependencies,
  })
  const forbiddenDeclarations = declaredPackages.filter((name) =>
    forbiddenPackage.test(name),
  )
  assert(
    forbiddenDeclarations.length === 0,
    `Forbidden runtime/framework package declarations: ${forbiddenDeclarations.join(', ')}`,
  )

  const lock = JSON.parse(
    await readFile(join(root, 'package-lock.json'), 'utf8'),
  ) as { packages?: Record<string, unknown> }
  const forbiddenLockEntries = Object.keys(lock.packages ?? {}).filter((path) =>
    /node_modules\/(?:@keystone-6\/|@keystone-ui\/|next$)/.test(path),
  )
  assert(
    forbiddenLockEntries.length === 0,
    `Forbidden packages remain in package-lock.json: ${forbiddenLockEntries.join(', ')}`,
  )

  const files = [
    ...(await sourceFiles(join(root, 'src'))).filter(
      (path) => !path.includes(`${join('src', 'generated')}`),
    ),
    ...(await sourceFiles(join(root, 'scripts'))).filter(
      (path) =>
        !path.endsWith('validate-keystone-differential.mjs') &&
        !path.endsWith('keystone-differential-oracle.cjs') &&
        !path.endsWith('validate-fields-document-structure.mjs') &&
        !path.endsWith('fields-document-structure-oracle.cjs'),
    ),
    join(root, 'cms.config.ts'),
    join(root, 'keystone.ts'),
    join(root, 'prisma.config.ts'),
  ]
  const forbiddenImports: string[] = []
  for (const path of files) {
    const source = await readFile(path, 'utf8')
    if (forbiddenImport.test(source))
      forbiddenImports.push(relative(root, path))
    forbiddenImport.lastIndex = 0
  }
  assert(
    forbiddenImports.length === 0,
    `Forbidden Keystone/Next imports remain: ${forbiddenImports.join(', ')}`,
  )

  const genericRuntimeFiles = (await sourceFiles(join(root, 'src'))).filter(
    (path) =>
      !path.includes(`${join('src', 'generated')}`) &&
      !path.includes(`${join('features', 'cms', 'models')}`),
  )
  const domainHardCodes: string[] = []
  for (const path of genericRuntimeFiles) {
    const source = await readFile(path, 'utf8')
    if (starterDomainLiteral.test(source))
      domainHardCodes.push(relative(root, path))
    starterDomainLiteral.lastIndex = 0
  }
  assert(
    domainHardCodes.length === 0,
    `Generic runtime contains starter-specific model/list literals: ${domainHardCodes.join(', ')}`,
  )

  console.info(
    'Runtime dependency validation passed: no Keystone/Next package/import or starter-domain hard-code remains in the generic runtime.',
  )
}

await main()
