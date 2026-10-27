import { PUSH_CATEGORIES, type PushCategories, type PushCategory } from '@/lib/pushCategories'

// The records key keeps its old name, so a phone that already chose keeps its switch.
const STORAGE_KEYS: Record<PushCategory, string> = {
  training: 'notif_training',
  shoes:    'notif_shoes',
  records:  'notif_races',
}

const TOKEN_KEY = 'notif_token'
const SAVED_AT_KEY = 'notif_token_saved_at'
const FAILED_KEY = 'notif_unregistered'
const REGISTRATION_EVENT = 'runomics:push-registration'

export const ALL_OFF: PushCategories = { training: false, shoes: false, records: false }

/** FCM rotates tokens and drops ones it has not seen refreshed in about 270 days; a monthly save keeps this one live. */
export const TOKEN_REFRESH_MS = 30 * 24 * 60 * 60 * 1000

/** A mirror for drawing the switches: the server reads the copy on the device's token, which a client cannot read back. */
export function loadPrefs(): PushCategories {
  if (typeof window === 'undefined') return ALL_OFF
  return { training: stored('training'), shoes: stored('shoes'), records: stored('records') }
}

function stored(category: PushCategory): boolean {
  return localStorage.getItem(STORAGE_KEYS[category]) === 'true'
}

export function savePrefs(prefs: PushCategories) {
  for (const category of PUSH_CATEGORIES) localStorage.setItem(STORAGE_KEYS[category], String(prefs[category]))
}

export function hasPushPrefs(): boolean {
  const prefs = loadPrefs()
  return PUSH_CATEGORIES.some((category) => prefs[category])
}

export function canReceivePush(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export interface SavedRegistration {
  token: string
  savedAt: number
}

export function savedRegistration(): SavedRegistration | null {
  const token = localStorage.getItem(TOKEN_KEY)
  const savedAt = Number(localStorage.getItem(SAVED_AT_KEY))
  return token && Number.isFinite(savedAt) ? { token, savedAt } : null
}

/** A device enabled before the app remembered its token has none stored, and is saved once more. */
export function isRegistrationDue(saved: SavedRegistration | null, token: string, now: number): boolean {
  return !saved || saved.token !== token || now - saved.savedAt > TOKEN_REFRESH_MS
}

export function rememberRegistration(token: string, now: number) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(SAVED_AT_KEY, String(now))
  setRegistrationFailed(false)
}

export function forgetRegistration() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(SAVED_AT_KEY)
  setRegistrationFailed(false)
}

export function setRegistrationFailed(failed: boolean) {
  if (failed) localStorage.setItem(FAILED_KEY, 'true')
  else localStorage.removeItem(FAILED_KEY)
  window.dispatchEvent(new Event(REGISTRATION_EVENT))
}

export function registrationFailed(): boolean {
  return typeof window !== 'undefined' && localStorage.getItem(FAILED_KEY) === 'true'
}

export function subscribeRegistration(listener: () => void): () => void {
  window.addEventListener(REGISTRATION_EVENT, listener)
  return () => window.removeEventListener(REGISTRATION_EVENT, listener)
}
