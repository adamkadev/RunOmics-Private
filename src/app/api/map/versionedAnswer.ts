import { createHash } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'

/** `private` throughout: the tracks outline where the athlete lives, which no shared cache should hold. */
const IMMUTABLE = 'private, max-age=31536000, immutable'
// A request without the current version, from a page built on older data, is revalidated instead.
const REVALIDATE = 'private, no-cache'

export interface Built {
  body: string
  etag: string
}

export function build(value: unknown): Built {
  const body = JSON.stringify(value)
  return { body, etag: `"${createHash('sha1').update(body).digest('base64url')}"` }
}

export function versionedAnswer(req: NextRequest, version: string, answer: Built): NextResponse {
  const headers = { 'Cache-Control': req.nextUrl.searchParams.get('v') === version ? IMMUTABLE : REVALIDATE, etag: answer.etag }
  if (req.headers.get('if-none-match') === answer.etag) return new NextResponse(null, { status: 304, headers })
  return new NextResponse(answer.body, { headers: { ...headers, 'content-type': 'application/json' } })
}
