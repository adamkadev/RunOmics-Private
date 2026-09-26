import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettingsClient } from '@/components/settings/SettingsClient'
import { t } from '@/i18n'

const OWNER_EMAIL = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_OWNER_EMAIL = 'owner@test.dev'
  return 'owner@test.dev'
})

interface MockUser {
  email: string
  getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }>
}

let mockUser: MockUser | null = null
let resolveClaims: (() => void) | null = null

function signedIn(email: string, claims: Record<string, unknown> = {}): MockUser {
  return {
    email,
    getIdTokenResult: () =>
      new Promise((resolve) => {
        const settle = () => resolve({ claims })
        if (resolveClaims === null) settle()
        else resolveClaims = settle
      }),
  }
}

vi.mock('@/lib/firebaseConfig', () => ({ isClientFirebaseConfigured: true }))

vi.mock('@/lib/firebase', () => ({
  isClientFirebaseConfigured: true,
  getClientAuth: () => ({}),
}))

vi.mock('firebase/auth', () => ({
  onIdTokenChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    cb(mockUser)
    return () => {}
  },
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: class {
    setCustomParameters() {}
  },
}))

vi.mock('@/components/ui/BackButton', () => ({
  BackButton: () => <div data-testid="back-button" />,
}))

vi.mock('@/components/settings/NotificationsForm', () => ({
  NotificationsForm: () => <div data-testid="notifications-form" />,
}))

vi.mock('@/components/settings/DataSourceInfo', () => ({
  DataSourceInfo: () => <div data-testid="data-source-info" />,
}))

function renderSettings() {
  return render(<SettingsClient lastSyncedAt="2026-09-01T06:00:00Z" activityCount={12} />)
}

describe('SettingsClient owner gate', () => {
  beforeEach(() => {
    mockUser = null
    resolveClaims = null
  })

  it('offers sign-in when signed out', async () => {
    renderSettings()

    expect(await screen.findByText(t.settings.auth.signIn)).toBeInTheDocument()
    expect(screen.queryByTestId('notifications-form')).not.toBeInTheDocument()
  })

  it('groups the page into Appearance, Data and Account, even signed out', async () => {
    renderSettings()
    await screen.findByText(t.settings.auth.signIn)

    const sections = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(sections).toEqual([t.settings.sections.appearance, t.settings.sections.data, t.settings.sections.account])
    // Where the runs come from, and what signing in unlocks.
    expect(screen.getByText(t.settings.dataSource.garmin)).toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(t.common.runs(12))).length).toBeGreaterThan(0)
    expect(screen.getByText(t.settings.auth.signInToManage)).toBeInTheDocument()
    // R7f: export is on the page signed out too, asking for the sign-in.
    expect(screen.getByText(t.settings.dataExport.title)).toBeInTheDocument()
    expect(screen.getByText(t.settings.dataExport.signedOut(t.common.runs(12)))).toBeInTheDocument()
  })

  // v4.8 2g: the build line ends the page signed out too, after Account.
  it('ends on the build line signed in and signed out', async () => {
    const { unmount } = renderSettings()
    await screen.findByText(t.settings.auth.signIn)
    const out = screen.getByTestId('build-info')
    expect(out.textContent).toMatch(/^RunOmics /)
    const account = screen.getByRole('heading', { name: t.settings.sections.account }).closest('section')!
    expect(account.compareDocumentPosition(out) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    unmount()

    mockUser = signedIn('owner@test.dev', { owner: true })
    renderSettings()
    await screen.findByTestId('notifications-form')
    expect(screen.getByTestId('build-info').textContent).toMatch(/^RunOmics /)
  })

  it('denies access to a signed-in account without the owner claim', async () => {
    mockUser = signedIn('someone-else@example.com')
    renderSettings()

    expect(await screen.findByText(t.settings.auth.accessDenied)).toBeInTheDocument()
    expect(screen.getByText(t.settings.auth.switchAccount)).toBeInTheDocument()
    expect(screen.queryByTestId('notifications-form')).not.toBeInTheDocument()
  })

  it('denies access on a matching email without the owner claim', async () => {
    mockUser = signedIn(OWNER_EMAIL)
    renderSettings()

    expect(await screen.findByText(t.settings.auth.accessDenied)).toBeInTheDocument()
  })

  it('grants access on the owner claim whatever the email is', async () => {
    mockUser = signedIn('a-completely-different@example.com', { owner: true })
    renderSettings()

    expect(await screen.findByTestId('notifications-form')).toBeInTheDocument()
    expect(screen.getByText(t.settings.auth.signOut)).toBeInTheDocument()
    expect(screen.queryByText(t.settings.auth.accessDenied)).not.toBeInTheDocument()
  })

  it('shows the loading state until the claim resolves', async () => {
    const notAskedYet = () => {}
    resolveClaims = notAskedYet
    mockUser = signedIn(OWNER_EMAIL, { owner: true })
    const { container } = renderSettings()

    expect(container.querySelector('.animate-spin')).not.toBeNull()
    expect(screen.queryByText(t.settings.auth.accessDenied)).not.toBeInTheDocument()

    // The claim is only asked for once the auth SDK has loaded, which is now
    // after mount rather than with the page.
    await vi.waitFor(() => expect(resolveClaims).not.toBe(notAskedYet))
    expect(container.querySelector('.animate-spin')).not.toBeNull()
    resolveClaims!()
    expect(await screen.findByTestId('notifications-form')).toBeInTheDocument()
  })
})
