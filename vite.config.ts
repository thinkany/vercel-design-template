import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Dev-only plugin: handles POST /api/variation/create to copy files for new variations
function variationApiPlugin() {
  return {
    name: 'ta-variation-api',
    apply: 'serve' as const,
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        // GET /api/variation/mtimes — latest design-file mtime per variation, so
        // the Dashboard shows a real "Modified" date that tracks actual edits
        // (edits happen by changing files, which the app otherwise can't observe).
        // Dev-only; on the Vercel static deploy this 404s and the stored date shows.
        if (req.url === '/api/variation/mtimes' && req.method === 'GET') {
          try {
            const { readdir, stat } = await import('fs/promises')
            const root = path.resolve(__dirname, 'src')
            const pad = (n: number) => String(n).padStart(2, '0')
            const fmt = (ms: number) => { const d = new Date(ms); return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}` }
            const latest = async (dir: string): Promise<number> => {
              let max = 0, entries
              try { entries = await readdir(dir, { withFileTypes: true }) } catch { return 0 }
              for (const e of entries) {
                const full = path.resolve(dir, e.name)
                if (e.isDirectory()) max = Math.max(max, await latest(full))
                else { try { max = Math.max(max, (await stat(full)).mtimeMs) } catch {} }
              }
              return max
            }
            const result: Record<string, string> = {}
            const base = Math.max(await latest(path.resolve(root, 'app/components')), await latest(path.resolve(root, 'styles')))
            if (base) result['v00'] = fmt(base)
            let ids: string[] = []
            try { ids = (await readdir(path.resolve(root, 'variations'), { withFileTypes: true })).filter((e: any) => e.isDirectory()).map((e: any) => e.name) } catch {}
            for (const id of ids) { const m = await latest(path.resolve(root, 'variations', id)); if (m) result[id] = fmt(m) }
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }
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
