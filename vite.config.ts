import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { normalizePath, type Plugin } from 'vite'

const contentScriptEntries = {
  codePaster: resolve(__dirname, 'src/content/codePaster.ts'),
  pageScanner: resolve(__dirname, 'src/content/pageScanner.ts'),
}
const wrappedContentScriptEntryIds = new Set(Object.values(contentScriptEntries).map(normalizePath))

export default defineConfig({
  plugins: [tailwindcss(), svelte(), wrapContentScriptEntries()],
  publicDir: 'assets/extension',
  build: {
    outDir: 'dist/app',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background.ts'),
        ...contentScriptEntries,
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})

function wrapContentScriptEntries(): Plugin {
  return {
    name: 'auth-wrap-content-script-entries',
    apply: 'build',
    renderChunk(code, chunk) {
      const entry = chunk.facadeModuleId && normalizePath(chunk.facadeModuleId)
      if (!entry || !wrappedContentScriptEntryIds.has(entry)) {
        return null
      }

      if (chunk.imports.length > 0 || chunk.dynamicImports.length > 0 || chunk.exports.length > 0) {
        this.error(`Content script ${chunk.name} must be self-contained`)
      }

      return {
        code: `(() => {\n${code}\n})();\n`,
        map: null,
      }
    },
  }
}
