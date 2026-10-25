import type { MetadataRoute } from 'next'

// Only the public demo sets it: a personal deployment stays out of search engines.
const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      ...(allowIndexing ? { allow: '/' } : { disallow: '/' }),
    },
  }
}
