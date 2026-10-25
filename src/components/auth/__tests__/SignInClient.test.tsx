import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { SignInClient } from '../SignInClient'
import { t } from '@/i18n'

interface MockUser {
  email: string | null
  getIdToken: (forceRefresh?: boolean) => Promise<string>
}

const auth = vi.hoisted(() => ({
  user: null as MockUser | null,
  listener: null as ((user: MockUser | null) => void) | null,
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}))

const session = vi.hoisted(() => ({
  openSiteSession: vi.fn(),
  replacePage: vi.fn(),
}))

vi.mock('@/lib/firebaseConfig', () => ({ isClientFirebaseConfigured: true }))
vi.mock('@/lib/firebaseAuth', () => ({ getClientAuth: () => ({}) }))
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (user: MockUser | null) => void) => {
    auth.listener = cb
    cb(auth.user)
    return () => {}
  },
  signInWithPopup: auth.signInWithPopup,
  signOut: auth.signOut,
  browserPopupRedirectResolver: 'popup-resolver',
  GoogleAuthProvider: class {
    setCustomParameters() {}
  },
}))
vi.mock('@/lib/siteSession', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/siteSession')>()),
  openSiteSession: session.openSiteSession,
  replacePage: session.replacePage,
}))

function account(email: string): MockUser {
  return { email, getIdToken: vi.fn().mockResolvedValue('fresh-token') }
}

describe('the sign-in page', () => {
  beforeEach(() => {
    auth.user = null
    auth.listener = null
    session.openSiteSession.mockReset()
    session.replacePage.mockReset()
    auth.signInWithPopup.mockReset()
    auth.signOut.mockReset()
    window.history.replaceState(null, '', '/sign-in?next=%2Fplan%3Fview%3Dmonth')
  })
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('offers the Google sign-in to a browser with no account', async () => {
    render(<SignInClient />)
    expect(await screen.findByRole('button', { name: t.settings.auth.signIn })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: t.signIn.heading })).toBeInTheDocument()
  })

  it('opens the page the reader came for with an account Firebase still holds', async () => {
    const owner = account('adam@example.com')
    auth.user = owner
    session.openSiteSession.mockResolvedValue('open')
    render(<SignInClient />)

    await vi.waitFor(() => expect(session.replacePage).toHaveBeenCalledWith('/plan?view=month'))
    expect(owner.getIdToken).toHaveBeenCalledWith(true)
    expect(session.openSiteSession).toHaveBeenCalledWith('fresh-token')
  })

  it('says so to an account nobody invited, and offers another', async () => {
    auth.user = account('someone@example.com')
    session.openSiteSession.mockResolvedValue('notInvited')
    render(<SignInClient />)

    expect(await screen.findByText(t.signIn.notInvited('someone@example.com'))).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: t.signIn.otherAccount }))
    await vi.waitFor(() => expect(auth.signOut).toHaveBeenCalled())
    expect(session.replacePage).not.toHaveBeenCalled()
  })

  it('signs in through Google, then opens the site', async () => {
    auth.signInWithPopup.mockImplementation(async () => {
      act(() => auth.listener?.(account('adam@example.com')))
    })
    session.openSiteSession.mockResolvedValue('open')
    render(<SignInClient />)

    fireEvent.click(await screen.findByRole('button', { name: t.settings.auth.signIn }))
    await vi.waitFor(() => expect(session.replacePage).toHaveBeenCalledWith('/plan?view=month'))
    expect(auth.signInWithPopup).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'popup-resolver')
  })

  it('says when the deployment is not set up for it', async () => {
    auth.user = account('adam@example.com')
    session.openSiteSession.mockResolvedValue('unavailable')
    render(<SignInClient />)
    expect(await screen.findByText(t.signIn.unavailable)).toBeInTheDocument()
  })

  it('offers a retry after a failure, with the same account', async () => {
    const owner = account('adam@example.com')
    auth.user = owner
    session.openSiteSession.mockResolvedValueOnce('failed').mockResolvedValueOnce('open')
    render(<SignInClient />)

    fireEvent.click(await screen.findByRole('button', { name: t.signIn.retry }))
    await vi.waitFor(() => expect(session.replacePage).toHaveBeenCalled())
    expect(auth.signInWithPopup).not.toHaveBeenCalled()
  })
})
