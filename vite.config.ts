import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Dev-only plugin: handles POST /api/variation/create to copy files for new variations
function variationApiPlugin() {
  return {
    name: 'dfr-variation-api',
    apply: 'serve' as const,
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url !== '/api/variation/create' || req.method !== 'POST') {
          return next()
        }
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', async () => {
          try {
            const { sourceId, targetId } = JSON.parse(Buffer.concat(chunks).toString())
            const { cp, mkdir } = await import('fs/promises')
            const root = path.resolve(__dirname, 'src')

            const srcComponents = sourceId === 'v00'
              ? path.resolve(root, 'app/components')
              : path.resolve(root, `variations/${sourceId}/components`)
            const srcStyles = sourceId === 'v00'
              ? path.resolve(root, 'styles')
              : path.resolve(root, `variations/${sourceId}/styles`)

            const targetDir = path.resolve(root, `variations/${targetId}`)
            await mkdir(path.resolve(targetDir, 'components'), { recursive: true })
            await mkdir(path.resolve(targetDir, 'styles'), { recursive: true })
            await cp(srcComponents, path.resolve(targetDir, 'components'), { recursive: true })
            await cp(srcStyles, path.resolve(targetDir, 'styles'), { recursive: true })

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, targetId }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message }))
          }
        })
      })
    },
  }
}

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    variationApiPlugin(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
