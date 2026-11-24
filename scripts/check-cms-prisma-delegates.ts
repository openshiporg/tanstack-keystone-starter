import cmsConfig from '../cms.config'
import {
  findMissingPrismaDelegates,
  formatPrismaDelegatePreflightError,
} from '../src/features/cms/adapters/prisma-preflight'
import { initialiseLists } from '../src/features/cms/config'
import { createCmsPrismaClient } from '../src/features/cms/prisma-client'

const prisma = createCmsPrismaClient({
  url: 'postgresql://cms_check:cms_check@127.0.0.1:1/cms_check',
})
const lists = initialiseLists(cmsConfig)
const issues = findMissingPrismaDelegates(
  prisma as unknown as Record<string, unknown>,
  lists,
)

await prisma.$disconnect()

if (issues.length > 0)
  throw new Error(formatPrismaDelegatePreflightError(issues))

console.log('Prisma Client exposes delegates for all initialized CMS lists.')
