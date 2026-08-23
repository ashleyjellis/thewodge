/**
 * Post-build: generate sitemap.xml and robots.txt.
 *
 * The sitemap walks dist/client for the static HTML the prerenderer produced
 * and lists every indexable route, skipping anything carrying
 * <meta name="robots" content="noindex">. That scan is self-maintaining.
 *
 * robots.txt cannot work the same way, because the surfaces that most need
 * excluding are exactly the ones that are never prerendered — they are
 * client-routed, so a crawler fetching /app2/today receives the SPA shell and
 * no amount of scanning built HTML will reveal a noindex that the router only
 * applies at runtime. Its Disallow rules are therefore generated from
 * src/surfaces.json, the same list the app's navigation reads, so a surface
 * cannot be hidden in one place and left exposed in the other.
 *
 * This previously emitted a hardcoded `Disallow: /app`, which covered /app2
 * only by prefix coincidence and would not have covered anything added later.
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

const { surfaces, alwaysDisallow } = JSON.parse(
  await readFile('src/surfaces.json', 'utf8'),
)

// Every non-indexable surface, plus paths that are noindex for their own
// reasons rather than because they are experiments (/results is per-user, not
// a surface that gets switched on or off).
const disallowed = [
  ...surfaces.filter((s) => !s.indexable).map((s) => s.basePath),
  ...alwaysDisallow,
].sort()

const robots = `User-agent: *
Allow: /
${disallowed.map((path) => `Disallow: ${path}`).join('\n')}

Sitemap: ${SITE_URL}/sitemap.xml
`

await writeFile(join(ROOT, 'sitemap.xml'), sitemap, 'utf8')
await writeFile(join(ROOT, 'robots.txt'), robots, 'utf8')
console.log(
  `[seo] sitemap.xml (${routes.length} routes) + robots.txt (${disallowed.length} disallowed) written`,
)
