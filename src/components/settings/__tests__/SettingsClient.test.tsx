import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SettingsClient, zonesSummary } from '@/components/settings/SettingsClient'
import { t } from '@/i18n'
import { GARMIN_CONNECT_URL } from '@/lib/garminConnect'
import { replacePage } from '@/lib/siteSession'

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
vi.mock('@/lib/siteSession', async (original) => ({ ...(await original<object>()), replacePage: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

vi.mock('@/lib/firebase', () => ({
  isClientFirebaseConfigured: true,
  getClientAuth: () => ({}),
}))

vi.mock('@/lib/firebaseAuth', () => ({ getClientAuth: () => ({}) }))

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

  it('signs in on a private site through the sign-in page, then comes back', async () => {
    render(<SettingsClient lastSyncedAt={null} activityCount={0} privateSite />)
    fireEvent.click(await screen.findByText(t.settings.auth.signIn))

    expect(replacePage).toHaveBeenCalledWith('/sign-in?next=%2Fsettings')
  })

  it('groups the page into Appearance, Profile, Data and Notifications, even signed out', async () => {
    renderSettings()
    await screen.findByText(t.settings.auth.signIn)

    const sections = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(sections).toEqual([
      t.settings.sections.appearance,
      t.settings.sections.profile,
      t.settings.sections.data,
      t.settings.sections.notifications,
    ])
    const appearance = screen.getByTestId('settings-appearance').textContent!
    expect(appearance.indexOf(t.settings.appearance.themeLabel)).toBeLessThan(appearance.indexOf(t.settings.accent.title))
    expect(appearance).toContain(t.settings.accent.caption)
    expect(screen.getByTestId('garmin-row').textContent).toContain(t.settings.dataSource.garmin)
    expect(screen.getByTestId('garmin-connected').className).toContain('text-[var(--pos)]')
    // The sync is the owner's: signed out there is no Sync.
    expect(screen.queryByText(t.settings.sync.action)).not.toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(t.common.runs(12))).length).toBeGreaterThan(0)
    expect(screen.getByText(t.settings.auth.signInToManage)).toBeInTheDocument()
    expect(screen.getByText(t.settings.dataExport.title)).toBeInTheDocument()
    expect(screen.getByText(t.settings.rowAction.signIn)).toBeInTheDocument()
  })

  it('draws height and weight as read-only facts, then the row to Athlete & zones', async () => {
    render(<SettingsClient lastSyncedAt={null} activityCount={0} body={{ heightCm: 178, weightKg: 70 }} zones={{ lthrBpm: 179, maxHrBpm: 200 }} />)
    await screen.findByText(t.settings.auth.signIn)

    const profile = screen.getByTestId('settings-profile')
    expect(within(profile).queryByRole('button')).toBeNull()
    const values = within(profile).getAllByTestId('profile-value')
    expect(values.map((value) => value.textContent)).toEqual([`178${t.units.cm}`, `70${t.units.kg}`])
    for (const value of values) expect(value.className).toContain('text-muted-foreground')
    expect(profile.textContent).not.toContain('BMI')

    const athlete = screen.getByTestId('athlete-zones-row')
    expect(athlete.getAttribute('href')).toBe('/athlete')
    expect(athlete.textContent).toBe(`${t.pages.athlete.title}LTHR 179 · Max 200`)
    const garmin = within(profile).getByRole('link', { name: t.settings.profile.readOnly })
    expect(garmin.getAttribute('href')).toBe(GARMIN_CONNECT_URL)
    expect(garmin.className).toContain('hit-44')
    expect(garmin.className).toContain('text-[13px]')
    expect(garmin.className).toContain('text-muted-foreground')
    expect(garmin.className).not.toContain('accent')
  })

  it('lays every grouped row out as the group\'s own child, with no lines of its own', async () => {
    render(<SettingsClient lastSyncedAt={null} activityCount={0} body={{ heightCm: 178, weightKg: 70 }} zones={{ lthrBpm: 179, maxHrBpm: 200 }} />)
    await screen.findByText(t.settings.auth.signIn)

    const groups = document.querySelectorAll<HTMLElement>('.inset-group')
    expect(groups.length).toBeGreaterThan(0)
    for (const group of groups) {
      expect(group.querySelectorAll('.border-b, .border-t, .divide-y')).toHaveLength(0)
    }
    const profile = within(screen.getByTestId('settings-profile')).getAllByTestId('profile-value').map((v) => v.closest('dl')!)
    const group = profile[0]!.parentElement!
    expect(group.className).toContain('inset-group')
    expect([...group.children]).toEqual([...profile, screen.getByTestId('athlete-zones-row')])
    // data-row-thumb: the separator under the row starts under its text.
    expect(screen.getByTestId('garmin-row').hasAttribute('data-row-thumb')).toBe(true)
  })

  it('names only the heart rate Garmin has on the Athlete & zones row', () => {
    expect(zonesSummary({ lthrBpm: 179, maxHrBpm: 200 })).toBe('LTHR 179 · Max 200')
    expect(zonesSummary({ maxHrBpm: 200 })).toBe('Max 200')
    expect(zonesSummary({})).toBeNull()
    expect(zonesSummary(undefined)).toBeNull()
  })

  it('ends on the build line signed in and signed out', async () => {
    const { unmount } = renderSettings()
    await screen.findByText(t.settings.auth.signIn)
    const out = screen.getByTestId('build-info')
    expect(out.textContent).toMatch(/^RunOmics /)
    const last = screen.getByRole('heading', { name: t.settings.sections.notifications }).closest('section')!
    expect(last.compareDocumentPosition(out) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
    expect(screen.getByText(t.settings.auth.signOut).className).toContain('text-[var(--neg)]')
    expect(screen.getByText(t.settings.auth.signOut).className).not.toContain('border')
    expect(screen.queryByText(t.settings.auth.accessDenied)).not.toBeInTheDocument()
  })

  it('shows the loading state until the claim resolves', async () => {
    const notAskedYet = () => {}
    resolveClaims = notAskedYet
    mockUser = signedIn(OWNER_EMAIL, { owner: true })
    const { container } = renderSettings()

    expect(container.querySelector('.animate-spin')).not.toBeNull()
    expect(screen.queryByText(t.settings.auth.accessDenied)).not.toBeInTheDocument()

    // The claim is asked for only once the auth SDK has loaded, after mount.
    await vi.waitFor(() => expect(resolveClaims).not.toBe(notAskedYet))
    expect(container.querySelector('.animate-spin')).not.toBeNull()
    resolveClaims!()
    expect(await screen.findByTestId('notifications-form')).toBeInTheDocument()
  })
})
