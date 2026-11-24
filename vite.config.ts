import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const includeParityFaultRoute =
  process.env.CMS_PARITY_FAULT_INJECTION_BUILD === '1'
const isolatedViteCacheDir = process.env.VITE_CACHE_DIR
const isolatedNitroBuildDir = process.env.NITRO_BUILD_DIR

const config = defineConfig({
  ...(isolatedViteCacheDir ? { cacheDir: isolatedViteCacheDir } : {}),
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({
      ...(isolatedNitroBuildDir
        ? { rootDir: process.cwd(), buildDir: isolatedNitroBuildDir }
        : {}),
      errorHandler: './src/server/error-handler.ts',
      plugins: [
        './src/server/nitro-plugin.ts',
        ...(includeParityFaultRoute
          ? ['./src/server/parity-fault-plugin.ts']
          : []),
      ],
      ...(includeParityFaultRoute
        ? {
            routes: {
              '/__parity/fault': './src/server/parity-fault-handler.ts',
            },
          }
        : {}),
      rollupConfig: { external: [/^@sentry\//] },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
