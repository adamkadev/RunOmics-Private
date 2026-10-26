import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const roots: string[] = []

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

describe('the coach when Firestore cannot answer', () => {
  it('reads the notes from the nightly backup', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-coach-notes-'))
    roots.push(root)
    fs.cpSync(path.join(process.cwd(), 'data'), root, { recursive: true })
    vi.stubEnv('RUNOMICS_DATA_DIR', root)
    vi.stubEnv('FIREBASE_PROJECT_ID', '')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getAllActivities } = await import('@/infrastructure/repositories/JsonActivityRepository')
    const latest = getAllActivities()[0]!
    fs.writeFileSync(path.join(root, 'activity_notes.json'), JSON.stringify({
      notes: { [latest.id]: { note: 'Heavy legs after a night shift', tags: ['sleep'] }, other: { note: '', tags: [] } },
    }))
    const { getCoachingContext } = await import('../GetCoachingContext')

    const context = await getCoachingContext(null, latest.date.slice(0, 10))

    expect(context.recentActivities.find((run) => run.id === latest.id)).toMatchObject({ note: 'Heavy legs after a night shift', tags: ['sleep'] })
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('activity_notes.json'))
  })
})
