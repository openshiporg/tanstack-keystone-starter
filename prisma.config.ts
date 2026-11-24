import 'dotenv/config'
import { defineConfig } from 'prisma/config'

import cmsConfig from './cms.config'
import { resolveCmsPrismaDatasourceUrl } from './src/features/cms/prisma-schema'

const shadowDatabaseUrl =
  cmsConfig.db?.shadowDatabaseUrl ?? process.env.SHADOW_DATABASE_URL

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: resolveCmsPrismaDatasourceUrl(cmsConfig.db?.url),
    ...(shadowDatabaseUrl
      ? {
          shadowDatabaseUrl: resolveCmsPrismaDatasourceUrl(shadowDatabaseUrl),
        }
      : {}),
  },
})
