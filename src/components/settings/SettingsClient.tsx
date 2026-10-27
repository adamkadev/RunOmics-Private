'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { SectionDivider } from '@/components/ui/SectionLabel'
import { isClientFirebaseConfigured } from '@/lib/firebaseConfig'
import { loadAuth } from '@/lib/loadAuth'
import { useOwnerAuth } from '@/lib/useOwnerAuth'
import { authorizedFetch } from '@/lib/ownerFetch'
import { SIGN_IN_PATH, endSiteSession, replacePage } from '@/lib/siteSession'
import { formatRelativeAgo } from '@/lib/formatters'
import { useMounted } from '@/lib/useMounted'
import { t } from '@/i18n'
import { BackButton } from '@/components/ui/BackButton'
import { Button } from '@/components/ui/Button'
import { Toast, useToast } from '@/components/ui/Toast'
import { AccentPicker } from './AccentPicker'
import { ThemeSegmented } from './ThemeSegmented'
import { GlowRow } from './GlowRow'
import { DataSourceInfo, type SyncDevice } from './DataSourceInfo'
import { RecentErrors } from './RecentErrors'
import { ScheduledJobs } from './ScheduledJobs'
import { GarminSeriesStatus, type GarminSeriesProps } from './GarminSeriesStatus'
import { ConnectedMark, GarminTile } from './GarminMark'
import { NotificationsForm } from './NotificationsForm'
import { BuildInfo } from './BuildInfo'
import { GoalsRacesSection } from './GoalsRacesSection'
import type { GoalYear, UpcomingRace } from '@/domain/goals/types'
import { GROUP_CARD, GROUP_ROW } from './settingsGroup'
import { bodyMetrics } from '@/components/profile/ProfileAthleteStats'
import { GARMIN_CONNECT_URL } from '@/lib/garminConnect'

interface Body {
  heightCm?: number
  weightKg?: number
}

interface Zones {
  lthrBpm?: number
  maxHrBpm?: number
}

interface Props {
  goalsRaces?: { syncedRaces: UpcomingRace[]; writtenGoals: GoalYear[]; today: string }
  lastSyncedAt: string | null
  activityCount: number
  device?: SyncDevice
  zones?: Zones
  privateSite?: boolean
  garminSeries?: GarminSeriesProps
}

export const ATHLETE_HREF = '/athlete'

export function SettingsClient({ goalsRaces, lastSyncedAt, activityCount, device, zones, privateSite = false, garminSeries }: Props) {
  const { user, isOwner, loading } = useOwnerAuth()
  // Signed out from the first render (no Firebase), a page cached hours ago would not hydrate on a relative time.
  const mounted = useMounted()
  const router = useRouter()
  const [signingIn, setSigningIn] = useState(false)
  const { toast, leaving, showToast } = useToast()

  async function handleSignIn() {
    if (!isClientFirebaseConfigured) {
      showToast(t.settings.auth.notConfigured, false)
      return
    }
    if (privateSite) {
      // Safari blocks a popup that waits on Google's iframe; a fresh /sign-in load readies it before the tap.
      replacePage(`${SIGN_IN_PATH}?next=${encodeURIComponent('/settings')}`)
      return
    }
    setSigningIn(true)
    try {
      const { auth, GoogleAuthProvider, browserPopupRedirectResolver, signInWithPopup } = await loadAuth()
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      auth.languageCode = t.locale
      await signInWithPopup(auth, provider, browserPopupRedirectResolver)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        console.error('Google sign-in failed:', err)
        showToast(t.settings.auth.error, false)
      }
    } finally {
      setSigningIn(false)
    }
  }

  async function handleSignOut() {
    // The private site's session first: it ends at /sign-in and clears this device's cached pages.
    const site = await endSiteSession()
    const { auth, signOut } = await loadAuth()
    await signOut(auth)
    if (site.private) replacePage(SIGN_IN_PATH)
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-accent" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col gap-3.5">
        <SettingsHeader />
        <AppearanceSection />
        <ProfileSection zones={zones} />

        <Section title={t.settings.sections.data}>
          <div className={GROUP_CARD}>
            <div className="flex items-center gap-3 px-4 py-3" data-testid="garmin-row" data-row-thumb>
              <GarminTile />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{device?.name ?? t.settings.dataSource.garmin}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {lastSyncedAt && <ConnectedMark />}
                  {lastSyncedAt && mounted
                    ? t.settings.dataSource.readOnlySynced(formatRelativeAgo(lastSyncedAt), t.common.runs(activityCount))
                    : t.settings.dataSource.readOnly}
                </p>
              </div>
            </div>
            {/* The export is owner-only, so signed out the row asks for the sign-in. */}
            <button type="button" onClick={handleSignIn} className={`${GROUP_ROW} transition-colors hover:bg-[var(--surface-2)]`}>
              <span className="min-w-0 truncate text-sm text-foreground">{t.settings.dataExport.title}</span>
              <span className="shrink-0 text-sm font-medium text-accent-text">{t.settings.rowAction.signIn}</span>
            </button>
          </div>
        </Section>

        <Section title={t.settings.sections.notifications}>
          <div className={`${GROUP_CARD} flex flex-col gap-3.5 px-4 py-4`}>
            <p className="text-sm text-muted-foreground">{t.settings.auth.signInToManage}</p>
            <Button variant="primary" onClick={handleSignIn} disabled={signingIn} className="h-11 w-full rounded-xl text-sm">
              {signingIn ? t.settings.auth.signingIn : t.settings.auth.signIn}
            </Button>
          </div>
        </Section>

        <BuildInfo onCopied={() => showToast(t.settings.buildCopied, true)} />
        <Toast toast={toast} leaving={leaving} />
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-4">
        <BackButton label={t.pages.settings.back} fallbackHref="/profile" className="lg:hidden" />
        <p className="text-center text-sm text-muted-foreground">{t.settings.auth.accessDenied}</p>
        <Button variant="secondary" onClick={handleSignOut} className="h-11 rounded-xl px-4 text-sm font-medium">
          {t.settings.auth.switchAccount}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      <SettingsHeader />
      <AppearanceSection />
      <ProfileSection owner={user} zones={zones} />

      {goalsRaces && (
        <Section title={t.settings.sections.goalsRaces} testId="goals-races">
          <GoalsRacesSection {...goalsRaces} onSaved={showToast} />
        </Section>
      )}

      <Section title={t.settings.sections.data}>
        <DataSourceInfo lastSyncedAt={lastSyncedAt} activityCount={activityCount} device={device} user={user} onDataLive={router.refresh} />
      </Section>

      <Section title={t.settings.sections.notifications}>
        <NotificationsForm />
      </Section>

      <Section title={t.settings.sections.diagnostics}>
        <RecentErrors user={user} />
        <ScheduledJobs user={user} />
        {garminSeries && <GarminSeriesStatus {...garminSeries} />}
      </Section>

      <button
        type="button"
        onClick={handleSignOut}
        className="mt-1.5 flex min-h-11 w-full items-center justify-center text-sm font-medium text-[var(--neg)] transition-opacity active:opacity-60"
      >
        {t.settings.auth.signOut}
      </button>

      <BuildInfo onCopied={() => showToast(t.settings.buildCopied, true)} />
      <Toast toast={toast} leaving={leaving} />
    </div>
  )
}

function SettingsHeader() {
  return (
    <header className="mb-1.5">
      <BackButton label={t.pages.settings.back} fallbackHref="/profile" className="lg:hidden" />
      <h1 className="text-display text-foreground">{t.pages.settings.title}</h1>
    </header>
  )
}

function Section({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section className="flex scroll-mt-16 flex-col gap-2" id={testId} data-testid={testId}>
      <SectionDivider as="h2" className="px-1">
        {title}
      </SectionDivider>
      {children}
    </section>
  )
}

function AppearanceSection() {
  const a = t.settings
  return (
    <Section title={a.sections.appearance}>
      <div className={GROUP_CARD} data-testid="settings-appearance">
        <div className={GROUP_ROW}>
          <p className="text-foreground">{a.appearance.themeLabel}</p>
          <ThemeSegmented />
        </div>
        <GlowRow className={GROUP_ROW} />
        <div className="flex flex-col gap-3 px-4 pb-4 pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[17px] tracking-[-0.027rem] text-foreground">{a.accent.title}</p>
            <p className="text-[13px] text-muted-foreground">{a.accent.caption}</p>
          </div>
          <AccentPicker />
        </div>
      </div>
    </Section>
  )
}

export function zonesSummary(zones: Zones | undefined): string | null {
  const p = t.settings.profile
  const parts = [
    zones?.lthrBpm !== undefined ? p.lthr(zones.lthrBpm) : null,
    zones?.maxHrBpm !== undefined ? p.maxHr(zones.maxHrBpm) : null,
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? parts.join(' · ') : null
}

/** Health data stays the owner's: it comes from an owner-only route, never from the cached page. */
function useOwnerBody(owner: User | null): Body | null {
  const [body, setBody] = useState<Body | null>(null)
  useEffect(() => {
    if (!owner) return
    let alive = true
    authorizedFetch(owner, '/api/athlete/body')
      .then((res) => (res.ok ? (res.json() as Promise<{ heightCm: number | null; weightKg: number | null }>) : null))
      .then((data) => { if (alive && data) setBody({ heightCm: data.heightCm ?? undefined, weightKg: data.weightKg ?? undefined }) })
      .catch(() => {})
    return () => { alive = false }
  }, [owner])
  return body
}

function ProfileSection({ owner = null, zones }: { owner?: User | null; zones?: Zones }) {
  const body = useOwnerBody(owner)
  const rows = body ? bodyMetrics(body) : []
  const summary = zonesSummary(zones)
  return (
    <Section title={t.settings.sections.profile} testId="settings-profile">
      <div className={GROUP_CARD}>
        {/* One <dl> per row: the group draws a separator between its direct children. */}
        {rows.map((row) => (
          <dl key={row.label} className={`${GROUP_ROW} text-sm`}>
            <dt className="text-foreground">{row.label}</dt>
            <dd className="tabular-nums text-muted-foreground" data-testid="profile-value">
              {row.value}
              {row.unit && <span className="ml-1">{row.unit}</span>}
            </dd>
          </dl>
        ))}
        <Link href={ATHLETE_HREF} className={`${GROUP_ROW} text-sm transition-colors hover:bg-[var(--surface-2)]`} data-testid="athlete-zones-row">
          <span className="min-w-0 truncate text-foreground">{t.pages.athlete.title}</span>
          <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
            {summary && <span className="tabular-nums">{summary}</span>}
            <ChevronRight size={16} aria-hidden className="shrink-0 text-subtle" />
          </span>
        </Link>
      </div>
      <a
        href={GARMIN_CONNECT_URL}
        target="_blank"
        rel="noreferrer"
        className="hit-44 self-start px-1 text-[13px] leading-[18px] text-muted-foreground transition-opacity hover:opacity-80"
        data-testid="profile-garmin-link"
      >
        {t.settings.profile.readOnly}
      </a>
    </Section>
  )
}
