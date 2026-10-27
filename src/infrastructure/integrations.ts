import 'server-only'
import { isSitePrivate } from '@/lib/siteAccess'

/** Which integrations this deployment has credentials for, by name only - never a value; the health probe reports it. */
export interface IntegrationStatus {
  /** Firestore, and every push notification. */
  firebaseAdmin: boolean
  /** The AI insight pass. */
  gemini: boolean
  /** The owner's Sync button, and the nightly sync's dispatch from Vercel Cron. */
  syncButton: boolean
  /** Every Vercel Cron job: without it each scheduled call is refused, and nothing says so. */
  cron: boolean
  /**
   * The site answers only to the owner and invited viewers. Not a credential,
   * but the sync's check reads it from here: routes are stored as recorded,
   * start and finish included, and a public site serves them to anyone.
   */
  privateSite: boolean
  /** Explore's route generator (OpenRouteService). Optional: coverage and the map work without it. */
  routing: boolean
}

export function integrationStatus(env: Readonly<Record<string, string | undefined>> = process.env): IntegrationStatus {
  const set = (...names: string[]) => names.every((name) => Boolean(env[name]?.trim()))
  return {
    // Against the emulator the project id is all getAdminApp() needs.
    firebaseAdmin: env.FIRESTORE_EMULATOR_HOST
      ? set('FIREBASE_PROJECT_ID')
      : set('FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'),
    gemini: set('GEMINI_API_KEY'),
    syncButton: set('GITHUB_SYNC_TOKEN', 'GITHUB_SYNC_REPO'),
    cron: set('CRON_SECRET'),
    privateSite: isSitePrivate(env),
    routing: set('ORS_API_KEY'),
  }
}
