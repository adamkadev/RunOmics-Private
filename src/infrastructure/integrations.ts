import 'server-only'

/** Which integrations this deployment has credentials for, by name only - never a value; the health probe reports it. */
export interface IntegrationStatus {
  /** Firestore, and every push notification. */
  firebaseAdmin: boolean
  /** The AI insight pass. */
  gemini: boolean
  /** The owner's Sync button. Optional: nothing else depends on it. */
  syncButton: boolean
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
    routing: set('ORS_API_KEY'),
  }
}
