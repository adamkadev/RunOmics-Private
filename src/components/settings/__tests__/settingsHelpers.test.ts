import { describe, expect, it } from 'vitest'
import { formatCacheSize, offlineCacheBytes } from '../offlineCache'
import { dailyReminderTime } from '../reminderTime'
import { en } from '@/i18n/en'
import { fr } from '@/i18n/fr'
import { t } from '@/i18n'

const MB = 1024 * 1024

describe('offlineCacheBytes', () => {
  it('takes the Cache API share where the estimate splits one out, the whole usage otherwise', async () => {
    expect(await offlineCacheBytes({ estimate: async () => ({ usage: 30 * MB, usageDetails: { caches: 24 * MB } }) })).toBe(24 * MB)
    expect(await offlineCacheBytes({ estimate: async () => ({ usage: 30 * MB }) })).toBe(30 * MB)
  })

  it('is null where the browser will not say', async () => {
    expect(await offlineCacheBytes(undefined)).toBeNull()
    expect(await offlineCacheBytes({})).toBeNull()
    expect(await offlineCacheBytes({ estimate: async () => { throw new Error('denied') } })).toBeNull()
  })
})

describe('formatCacheSize', () => {
  it('reads megabytes, with a decimal under ten', () => {
    expect(formatCacheSize(24 * MB)).toBe(`24 ${t.units.mb}`)
    expect(formatCacheSize(1.24 * MB)).toBe(`1.2 ${t.units.mb}`)
  })

  it('reads kilobytes under a megabyte, and nothing for an empty cache or none', () => {
    expect(formatCacheSize(380 * 1024)).toBe(`380 ${t.units.kb}`)
    expect(formatCacheSize(200)).toBeNull()
    expect(formatCacheSize(null)).toBeNull()
  })
})

describe('dailyReminderTime', () => {
  it('reads 08:00 Paris time in the athlete zone, summer time included', () => {
    expect(dailyReminderTime(new Date('2026-07-01T12:00:00Z'), 'Europe/Paris')).toBe('08:00')
    expect(dailyReminderTime(new Date('2026-12-01T12:00:00Z'), 'Europe/Paris')).toBe('08:00')
    expect(dailyReminderTime(new Date('2026-07-01T12:00:00Z'), 'UTC')).toBe('06:00')
    expect(dailyReminderTime(new Date('2026-12-01T12:00:00Z'), 'UTC')).toBe('07:00')
  })

  it('writes the time the French way in French', () => {
    expect(en.settings.notifications.at(8, '11')).toBe('08:11')
    expect(fr.settings.notifications.at(8, '11')).toBe('8 h 11')
  })
})
