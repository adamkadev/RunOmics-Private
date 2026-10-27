import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { deleteDocument, readDocument, signInAsOwner } from './owner'

const localToday = (page: Page) =>
  page.evaluate(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

async function firstActivityId(page: Page): Promise<string> {
  await page.goto('/activities')
  const href = await page.locator('main a[href^="/activities/"]').first().getAttribute('href')
  return decodeURIComponent(href!.split('/').pop()!.split('?')[0]!)
}

test('the morning check-in saves each answer to Firestore, eases Today off when ill, and folds once done', async ({ page, t }) => {
  await signInAsOwner(page)
  const today = await localToday(page)
  await deleteDocument(`wellness/${today}`)
  const c = t.wellness.checkIn

  await page.goto('/')
  const card = page.getByTestId('checkin-card')
  await expect(card).toBeVisible()
  await expect(page.getByTestId('checkin-done')).toBeHidden()

  for (const field of ['sleep', 'soreness', 'stress', 'mood'] as const) {
    const s = c.scores[field]
    await card.getByRole('button', { name: c.scoreButton(s.label, 4, s.words[3]!) }).click()
  }
  await card.getByTestId('checkin-flag-ill').click()
  await expect(page.getByText(t.wellness.readiness.ill.headline)).toBeVisible()

  await expect.poll(async () => (await readDocument(`wellness/${today}`))?.ill?.booleanValue).toBe(true)
  const saved = (await readDocument(`wellness/${today}`))!
  expect(['sleep', 'soreness', 'stress', 'mood'].map((field) => saved[field]?.integerValue)).toEqual(['4', '4', '4', '4'])

  await page.getByTestId('checkin-done').click()
  await expect(page.getByTestId('checkin-summary')).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('checkin-summary')).toBeVisible()
  await expect(page.getByTestId('checkin-card')).toBeHidden()
})

test('a note with a tag and the HR-unreliable switch save to Firestore, and the switch clears the field', async ({ page, t }) => {
  await signInAsOwner(page)
  const id = await firstActivityId(page)
  await deleteDocument(`activityNotes/${id}`)
  const n = t.activity.notes

  await page.goto(`/activities/${id}`)
  await page.getByTestId('note-row').click()
  const sheet = page.getByRole('dialog', { name: n.sheetTitle })
  await sheet.getByPlaceholder(n.notePlaceholder).fill('Strap slipped at 3 km.')
  await sheet.getByPlaceholder(n.tagPlaceholder).fill('strap')
  await sheet.getByPlaceholder(n.tagPlaceholder).press('Enter')
  await sheet.getByRole('switch', { name: n.hrUnreliable }).click()
  await sheet.getByRole('button', { name: t.settings.actions.save }).click()
  await expect(sheet).toBeHidden()

  const saved = (await readDocument(`activityNotes/${id}`))!
  expect(saved.note?.stringValue).toBe('Strap slipped at 3 km.')
  expect(saved.tags?.arrayValue?.values?.map((tag) => tag.stringValue)).toEqual(['strap'])
  expect(saved.hrUnreliable?.booleanValue).toBe(true)

  await page.reload()
  await expect(page.getByTestId('note-row')).toHaveText(t.activity.noteRow.label)
  await page.getByTestId('note-row').click()
  const text = page.getByTestId('note-text')
  await expect(text).toContainText('Strap slipped at 3 km.')
  await expect(text).toContainText('strap')
  await expect(text).toContainText(n.hrUnreliable)

  await text.getByRole('button', { name: t.activity.noteRow.edit }).click()
  await sheet.getByRole('switch', { name: n.hrUnreliable }).click()
  await sheet.getByRole('button', { name: t.settings.actions.save }).click()
  await expect(sheet).toBeHidden()
  await expect.poll(async () => (await readDocument(`activityNotes/${id}`))?.hrUnreliable).toBeUndefined()
  expect((await readDocument(`activityNotes/${id}`))?.note?.stringValue).toBe('Strap slipped at 3 km.')
})

test('the owner gets the three notification switches, with the reminder time', async ({ page, t }) => {
  await page.goto('/settings')
  await expect(page.getByTestId('notifications-card')).toBeHidden()

  await signInAsOwner(page)
  const card = page.getByTestId('notifications-card')
  for (const category of ['training', 'shoes', 'records'] as const) {
    await expect(card.getByRole('switch', { name: t.settings.notifications.types[category].title })).toHaveAttribute('aria-checked', 'false')
  }
  await expect(card.getByTestId('reminder-time')).toHaveText(/^\d{2}:\d{2}$/)
})

test('blocked notifications disable the switches and say where to allow them', async ({ page, t }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Notification, 'permission', { get: () => 'denied' })
  })
  await signInAsOwner(page)
  const card = page.getByTestId('notifications-card')
  await expect(card.getByRole('switch', { name: t.settings.notifications.types.training.title })).toBeDisabled()
  await expect(page.getByTestId('push-blocked')).toHaveText(t.settings.notifications.denied)
})
