import { expect, type Page } from '@playwright/test'
import { t } from '@/i18n'

export const AUTH_EMULATOR_HOST = '127.0.0.1:9099'

const PROJECT_ID = 'runomics-dev'
const OWNER = { sub: 'screenshot-owner', email: 'owner@example.com', name: 'Screenshot Owner' }
const BASE = `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`
// The emulator takes any key, and "Bearer owner" as an admin token.
const ADMIN = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }

async function post<T>(url: string, body: unknown, headers: Record<string, string> = ADMIN): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`Auth emulator ${url} answered ${res.status}: ${await res.text()}`)
  return (await res.json()) as T
}

async function ensureOwner(): Promise<void> {
  // The emulator accepts an unsigned JSON id_token for a federated sign-in.
  const idToken = encodeURIComponent(JSON.stringify({ ...OWNER, email_verified: true }))
  const { localId } = await post<{ localId: string }>(
    `${BASE}/accounts:signInWithIdp?key=emulator`,
    { postBody: `id_token=${idToken}&providerId=google.com`, requestUri: 'http://localhost', returnSecureToken: true },
    { 'Content-Type': 'application/json' }
  )
  await post(`${BASE}/projects/${PROJECT_ID}/accounts:update`, {
    localId,
    customAttributes: JSON.stringify({ owner: true }),
  })
}

/** The popup's hand-off back to the page is sometimes lost, so up to three tries. */
export async function signInAsOwner(page: Page): Promise<void> {
  await ensureOwner()

  for (let attempt = 1; ; attempt++) {
    const popupOpened = page.waitForEvent('popup')
    await page.getByRole('button', { name: t.settings.auth.signIn }).click()
    const popup = await popupOpened
    await popup.locator('li.js-reuse-account', { hasText: OWNER.email }).click()

    // The owner's Data card only renders once the claim has been read.
    const card = page.getByTestId('data-card')
    const signedIn = await card.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true, () => false)
    if (signedIn) return
    if (attempt === 3) {
      await expect(card).toBeVisible()
      return
    }
    if (!popup.isClosed()) await popup.close()
    await page.reload({ waitUntil: 'domcontentloaded' })
  }
}
