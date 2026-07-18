/**
 * Per-route SEO — title, meta description, Open Graph and Twitter tags, canonical.
 * Every page calls this in its route `head()` so crawlers and share cards get real
 * per-page data. The default share image is the growth-split card.
 */
import { SITE_NAME, SITE_URL } from '@/config'

export type Seo = {
  title: string
  description: string
  /** absolute or root-relative image; defaults to the growth-split OG card */
  image?: string
  /** path for canonical + og:url, e.g. "/how-it-works" */
  path?: string
}

export function seo({ title, description, image, path }: Seo) {
  const url = `${SITE_URL}${path ?? ''}`
  const img = (image ?? '/og-default.png').startsWith('http')
    ? image!
    : `${SITE_URL}${image ?? '/og-default.png'}`

  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: url },
      { property: 'og:image', content: img },
      { property: 'og:site_name', content: SITE_NAME },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: img },
    ],
    links: [{ rel: 'canonical', href: url }],
  }
}
