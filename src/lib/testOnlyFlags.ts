/** Build flags for the e2e, visual and screenshot builds alone: each points the app at an emulator or a blank map. */
export const TEST_ONLY_FLAGS = [
  'NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST',
  'NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST',
  'NEXT_PUBLIC_E2E_MAPS',
] as const

/** An emulator sign-in on a deployment would hand its owner-only screens to anyone who runs one. */
export function assertNoTestFlagsOnDeployment(env: Readonly<Record<string, string | undefined>>): void {
  if (!env.VERCEL) return
  const set = TEST_ONLY_FLAGS.filter((name) => env[name])
  if (set.length > 0) throw new Error(`${set.join(', ')} must never be set on a deployment.`)
}
