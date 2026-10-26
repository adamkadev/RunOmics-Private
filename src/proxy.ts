import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, gateDecision, returnPath } from '@/lib/siteAccess'
import { SIGN_IN_PATH } from '@/lib/siteSession'

/** The private site's gate: it runs before any page, cached or not, is served. */
export function proxy(request: NextRequest) {
  const decision = gateDecision({
    pathname: request.nextUrl.pathname,
    cookie: request.cookies.get(SESSION_COOKIE)?.value,
    env: process.env,
  })
  if (decision === 'pass') return NextResponse.next()
  if (decision === 'unauthorized') return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const signIn = new URL(SIGN_IN_PATH, request.nextUrl)
  const back = returnPath(request.nextUrl)
  if (back !== '/') signIn.searchParams.set('next', back)
  return NextResponse.redirect(signIn)
}

export const config = {
  // Everything but what a signed-out browser must fetch to sign in or to
  // install the app, none of which holds the athlete's data.
  matcher: ['/((?!_next/|icons/|maplibre/|manifest\\.json$|sw\\.js$|robots\\.txt$|favicon\\.ico$).*)'],
}
