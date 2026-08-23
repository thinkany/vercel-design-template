import { defineConfig } from 'vite'
import path from 'path'
import { pathToFileURL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// A bulk file operation (upgrade / revert) rewrites many project files at once. Vite
// watches the project, so left alone it fires one HMR reload PER file — the browser
// flashes repeatedly mid-operation and it feels glitchy even though it works. This
// detaches Vite's watcher change-handlers for the duration of the write, lets chokidar
// drain any trailing fs events (so those don't trigger a late reload either), then
// restores normal watching. The dashboard's own "Refresh" button does the single,
// intentional reload afterward. Only wrap operations that actually write.
async function withWatcherPaused<T>(server: any, fn: () => Promise<T>): Promise<T> {
  const w = server?.watcher
  if (!w) return fn()
  const events = ['change', 'add', 'unlink', 'addDir', 'unlinkDir']
  const saved: Record<string, ((...a: any[]) => void)[]> = {}
  for (const e of events) {
    saved[e] = w.listeners(e)
    w.removeAllListeners(e)
  }
  try {
    return await fn()
  } finally {
    // Drain trailing events (emitted with no listener → dropped) BEFORE reattaching,
    // so the just-written files don't cause one last reload after we resume watching.
    await new Promise((r) => setTimeout(r, 300))
    for (const e of events) saved[e].forEach((l) => w.on(e, l))
  }
}

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
            const tz = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() || ''
            const fmt = (ms: number) => { const d = new Date(ms); return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())} ${tz}` }
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
              const doUpgrade = () => runUpgrade({
                targetDir: __dirname,
                url: body.url || 'https://create.thinkany.design/template-latest.zip',
                dryRun: !!body.dryRun,
                force: !!body.force,
              })
              // A dry run writes nothing, so only pause the watcher for a real apply.
              const report = body.dryRun
                ? await doUpgrade()
                : await withWatcherPaused(server, doUpgrade)
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

        // /api/upgrade/revert — GET returns whether a revert is available (a backup
        // exists); POST restores the most recent update's pre-change state.
        if (req.url === '/api/upgrade/revert' && (req.method === 'GET' || req.method === 'POST')) {
          const run = async () => {
            const mod = await import(pathToFileURL(path.resolve(__dirname, 'scripts/upgrade.mjs')).href)
            // A revert rewrites many files too — pause the watcher so it doesn't flash.
            // GET (status only) writes nothing, so leave the watcher alone for it.
            const result = req.method === 'POST'
              ? await withWatcherPaused(server, () => mod.runRevert(__dirname))
              : await mod.revertStatus(__dirname)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result))
          }
          run().catch((err: any) => {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message }))
          })
          return
        }

        // POST /api/variation/update — patch a variation's variation.json (status,
        // removed, title…). The single source of truth for variation metadata, so
        // "Mark established" / remove / rename all write here. Dev-only.
        if (req.url === '/api/variation/update' && req.method === 'POST') {
          const chunks: Buffer[] = []
          req.on('data', (c: Buffer) => chunks.push(c))
          req.on('end', async () => {
            try {
              const { id, patch } = JSON.parse(Buffer.concat(chunks).toString())
              const { readFile, writeFile } = await import('fs/promises')
              const file = path.resolve(__dirname, 'src/variations', id, 'variation.json')
              let cur: any = {}
              try { cur = JSON.parse(await readFile(file, 'utf8')) } catch {}
              const d = new Date(), p = (n: number) => String(n).padStart(2, '0')
              const tz = d.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() || ''
              const modifiedAt = `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())} ${tz}`
              const nextMeta = { ...metaDefaults(id), ...cur, ...patch, modifiedAt }
              await writeFile(file, JSON.stringify(nextMeta, null, 2) + '\n')
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, id, meta: nextMeta }))
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
            const { sourceId, meta } = JSON.parse(Buffer.concat(chunks).toString())
            const { cp, mkdir, writeFile, readdir } = await import('fs/promises')
            const root = path.resolve(__dirname, 'src')

            const srcComponents = sourceId === 'v00'
              ? path.resolve(root, 'app/components')
              : path.resolve(root, `variations/${sourceId}/components`)
            const srcStyles = sourceId === 'v00'
              ? path.resolve(root, 'styles')
              : path.resolve(root, `variations/${sourceId}/styles`)

            // The server owns the numbering: the next id is (max existing v## folder) + 1,
            // scanning ALL folders on disk — including soft-removed ones (remove keeps the
            // folder), so a delete never frees a number for reuse. The client's proposed
            // targetId is only an optimistic preview and is ignored here, which is what makes
            // the modal / "Start designing" path collision-proof after any delete.
            let max = 0
            try {
              for (const e of await readdir(path.resolve(root, 'variations'), { withFileTypes: true })) {
                const m = e.isDirectory() && /^v(\d+)$/.exec(e.name)
                if (m) max = Math.max(max, parseInt(m[1], 10))
              }
            } catch { /* no variations dir yet */ }
            const targetId = 'v' + String(max + 1).padStart(2, '0')

            const targetDir = path.resolve(root, `variations/${targetId}`)
            await mkdir(path.resolve(targetDir, 'components'), { recursive: true })
            await mkdir(path.resolve(targetDir, 'styles'), { recursive: true })
            await cp(srcComponents, path.resolve(targetDir, 'components'), { recursive: true })
            await cp(srcStyles, path.resolve(targetDir, 'styles'), { recursive: true })

            // Write the variation's metadata as its single source of truth. Client meta can
            // set title/description/status, but the VERSION is forced from the assigned id so
            // the badge is always unique and matches the number (never a duplicate "v0.2").
            const finalMeta = { ...metaDefaults(targetId), ...(meta || {}), version: metaDefaults(targetId).version }
            await writeFile(path.resolve(targetDir, 'variation.json'), JSON.stringify(finalMeta, null, 2) + '\n')

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, targetId, meta: finalMeta }))
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

// Server-side defaults for a variation lacking a variation.json (a legacy/edge
// folder). Every variation created through the app writes its own variation.json;
// this just keeps a bare folder from rendering blank.
function metaDefaults(id: string) {
  const n = parseInt(id.replace(/\D/g, ''), 10) || 0
  const isFirst = n === 1
  return {
    version: `v${Math.floor(n / 10)}.${n % 10}`,
    title: isFirst ? 'Initial Design' : `Design ${n}`,
    description: isFirst ? 'Initial Design Concept, color and font variations.' : '',
    styleguideStatus: 'updated',
    brandStatus: 'established',
  }
}

// Variations manifest: every on-disk variation under src/variations/ WITH its
// committed metadata (read from each folder's variation.json — the single source of
// truth). Base v00 is NOT here (it has no folder; the app seeds it from code).
// Served live in dev AND emitted into the build output, so the dashboard reads
// identical, correct data in every browser and on Vercel — no localStorage.
async function scanVariations(): Promise<any[]> {
  const { readdir, readFile, stat } = await import('fs/promises')
  const dir = path.resolve(__dirname, 'src/variations')
  const p = (n: number) => String(n).padStart(2, '0')
  let ids: string[] = []
  try {
    ids = (await readdir(dir, { withFileTypes: true }))
      .filter((e: any) => e.isDirectory())
      .map((e: any) => e.name)
      .filter((id: string) => id !== 'v00')
  } catch {}
  const out: any[] = []
  for (const id of ids) {
    let meta: any = {}
    try { meta = JSON.parse(await readFile(path.resolve(dir, id, 'variation.json'), 'utf8')) } catch {}
    // Fall back to the folder's creation time for createdAt when the metadata omits it.
    let createdAt: string | undefined
    if (!meta.createdAt) {
      try {
        const s = await stat(path.resolve(dir, id))
        const d = new Date(s.birthtimeMs || s.ctimeMs)
        createdAt = `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`
      } catch {}
    }
    out.push({ id, ...metaDefaults(id), ...(createdAt ? { createdAt } : {}), ...meta })
  }
  return out
}

function variationsManifestPlugin() {
  return {
    name: 'ta-variations-manifest',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url === '/variations.json' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ variations: await scanVariations() }))
          return
        }
        next()
      })
    },
    async generateBundle(this: any) {
      this.emitFile({
        type: 'asset',
        fileName: 'variations.json',
        source: JSON.stringify({ variations: await scanVariations() }),
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

      // git-tracked files = the distributable template source, MINUS files that
      // must never ship: internal planning docs AND the app-owned export-to-Figma
      // tooling. This is the single choke point: the upgrade overlay can only write
      // files present in this zip, so excluding them here plugs both the public
      // download AND the upgrade-push. Also enforced via .gitattributes
      // export-ignore (for git-archive consumers) and TEMPLATE_EXCLUDE.
      const EXCLUDE_PREFIXES = ['docs/']
      // Export tooling: the 4 `export-*.mjs` exporters + 3 `figma-*.plugin.js`
      // builder bodies. Spares the infra scripts (company-profile/upgrade/lib).
      const EXCLUDE_PATTERNS = [/^scripts\/export-.*\.mjs$/, /^scripts\/figma-.*\.plugin\.js$/]
      let files: string[]
      try {
        files = execSync('git ls-files', { cwd: __dirname, encoding: 'utf8' })
          .split('\n').map((s) => s.trim()).filter(Boolean)
          .filter((rel) => !EXCLUDE_PREFIXES.some((p) => rel.startsWith(p))
                        && !EXCLUDE_PATTERNS.some((re) => re.test(rel)))
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
