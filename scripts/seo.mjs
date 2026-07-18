/**
 * Post-build: generate sitemap.xml and robots.txt from the prerendered pages.
 *
 * Walks dist/client for the static HTML the prerenderer produced and lists every
 * indexable route. Pages carrying <meta name="robots" content="noindex"> (e.g.
 * /results, /app) are skipped automatically, so this never needs a hand-kept list.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, dirname } from 'node:path'

const ROOT = 'dist/client'
const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://thewodge.co.uk').replace(
  /\/$/,
  '',
)

async function findIndexHtml(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await findIndexHtml(full)))
    else if (entry.name === 'index.html') out.push(full)
  }
  return out
}

function toRoute(file) {
  const rel = relative(ROOT, dirname(file)).split('\\').join('/')
  return rel === '' ? '/' : `/${rel}`
}

const files = await findIndexHtml(ROOT)
const routes = []
for (const file of files) {
  const html = await readFile(file, 'utf8')
  if (/content="noindex"/.test(html)) continue
  routes.push(toRoute(file))
}
routes.sort()

const urls = routes
  .map((r) => `  <url>\n    <loc>${SITE_URL}${r === '/' ? '/' : r}</loc>\n  </url>`)
  .join('\n')

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

const robots = `User-agent: *
Allow: /
Disallow: /results
Disallow: /app

Sitemap: ${SITE_URL}/sitemap.xml
`

await writeFile(join(ROOT, 'sitemap.xml'), sitemap, 'utf8')
await writeFile(join(ROOT, 'robots.txt'), robots, 'utf8')
console.log(`[seo] sitemap.xml (${routes.length} routes) + robots.txt written`)
