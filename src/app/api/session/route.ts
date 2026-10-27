import { NextResponse, type NextRequest } from 'next/server'
import { logRejectedRequest } from '@/lib/internalAuth'
import { verifyFirebaseIdToken } from '@/lib/verifyFirebaseIdToken'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  isSitePrivate,
  mayView,
  sessionSecret,
  signSession,
  verifiedEmail,
  viewerEmails,
} from '@/lib/siteAccess'

export const runtime = 'nodejs'

// /sign-in sends the Firebase ID token here once and gets back the cookie the proxy reads (src/lib/siteAccess.ts).

function cookieOptions(req: NextRequest, maxAge: number) {
  return {
    httpOnly: true,
    // Over https only, as served; plain http is a local build on a phone.
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}

export async function POST(req: NextRequest) {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const secret = sessionSecret(process.env)
  if (!projectId || !secret) {
    console.error('[session] not configured:', [!projectId && 'FIREBASE_PROJECT_ID', !secret && 'SESSION_SECRET (32+ characters)'].filter(Boolean).join(', '))
    logRejectedRequest(req, 'not-configured')
    return NextResponse.json({ error: 'Sign-in is not configured' }, { status: 503 })
  }

  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token) {
    logRejectedRequest(req, 'unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let claims: Awaited<ReturnType<typeof verifyFirebaseIdToken>>
  try {
    claims = await verifyFirebaseIdToken(token, projectId)
  } catch {
    logRejectedRequest(req, 'unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const viewer = { owner: claims.owner === true, email: verifiedEmail(claims) }
  if (!mayView(viewer, viewerEmails(process.env))) {
    logRejectedRequest(req, 'forbidden')
    return NextResponse.json({ error: 'This account is not invited' }, { status: 403 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, signSession({ sub: claims.sub, ...viewer }, secret), cookieOptions(req, SESSION_MAX_AGE_SEC))
  return response
}

/** The answer says whether the site is private, for the page to send the reader to /sign-in. */
export async function DELETE(req: NextRequest) {
  const privateSite = isSitePrivate(process.env)
  // "cache" only: "storage" would also unregister the service worker, and with it the phone's pushes.
  const headers = privateSite ? { 'Clear-Site-Data': '"cache"' } : undefined
  const response = NextResponse.json({ private: privateSite }, { headers })
  response.cookies.set(SESSION_COOKIE, '', cookieOptions(req, 0))
  return response
}
