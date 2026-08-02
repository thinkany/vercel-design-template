import { defineConfig } from 'vite'
import path from 'path'
import { pathToFileURL } from 'node:url'
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
        // POST /api/upgrade — overlay a newer template version onto THIS project.
        // Dev-only (Node can write files; the browser can't), which is why the
        // update pill is local-only too. Body: { url, dryRun?, force? }. Fetches the
        // zip server-side, runs the shared engine against the project root, returns
        // the report. The dashboard previews (dryRun) then applies on confirm.
        if (req.url === '/api/upgrade' && req.method === 'POST') {
          const chunks: Buffer[] = []
          req.on('data', (c: Buffer) => chunks.push(c))
          req.on('end', async () => {
            try {
              const body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
              const { runUpgrade } = await import(
                pathToFileURL(path.resolve(__dirname, 'scripts/upgrade.mjs')).href
              )
              const report = await runUpgrade({
                targetDir: __dirname,
                url: body.url || 'https://create.thinkany.design/template-latest.zip',
                dryRun: !!body.dryRun,
                force: !!body.force,
              })
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(report))
            } catch (err: any) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: err.message }))
            }
          })
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

// Variations manifest: the list of variation folders that actually exist on disk
// under src/variations/ (plus base v00). The Dashboard reconciles its localStorage
// records against this so a variation created by *files alone* — a skill scaffolding
// v01, or a committed variation a client's fresh browser has no record of — still
// shows up. Served live in dev (scan) AND emitted into the build output, so it works
// on the static Vercel deploy too (fixing the old "client sees only base" gap).
async function scanVariationIds(): Promise<string[]> {
  const { readdir } = await import('fs/promises')
  let ids: string[] = []
  try {
    ids = (await readdir(path.resolve(__dirname, 'src/variations'), { withFileTypes: true }))
      .filter((e: any) => e.isDirectory())
      .map((e: any) => e.name)
  } catch {}
  // Base is always present; keep it first and de-duped.
  return ['v00', ...ids.filter((id) => id !== 'v00')]
}

function variationsManifestPlugin() {
  return {
    name: 'ta-variations-manifest',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url === '/variations.json' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ids: await scanVariationIds() }))
          return
        }
        next()
      })
    },
    async generateBundle(this: any) {
      this.emitFile({
        type: 'asset',
        fileName: 'variations.json',
        source: JSON.stringify({ ids: await scanVariationIds() }),
      })
    },
  }
}

// Template distribution: at build, zip the git-tracked source into
// dist/template-latest.zip so the canonical deploy (create.thinkany.design) serves
// the archive the upgrade overlay pulls. It's the full source snapshot; the overlay
// (scripts/upgrade.mjs) decides each file's fate via upgrade.manifest.json. Emitted
// into the build output (never committed as a binary blob). Uses the zero-dep zip
// module so nothing new enters package.json.
function templateZipPlugin() {
  return {
    name: 'ta-template-zip',
    async generateBundle(this: any) {
      const { execSync } = await import('node:child_process')
      const { readFile } = await import('node:fs/promises')
      const { createZip } = await import(
        pathToFileURL(path.resolve(__dirname, 'scripts/lib/zip.mjs')).href
      )

      // git-tracked files = exactly the distributable template source.
      let files: string[]
      try {
        files = execSync('git ls-files', { cwd: __dirname, encoding: 'utf8' })
          .split('\n').map((s) => s.trim()).filter(Boolean)
      } catch {
        this.warn('template-zip: `git ls-files` failed; skipping archive')
        return
      }

      const entries: { name: string; data: Buffer }[] = []
      for (const rel of files) {
        try {
          entries.push({ name: rel, data: await readFile(path.resolve(__dirname, rel)) })
        } catch {} // a listed-but-absent file (rare) is skipped
      }

      this.emitFile({
        type: 'asset',
        fileName: 'template-latest.zip',
        source: createZip(entries),
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
    variationsManifestPlugin(),
    templateZipPlugin(),
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
