import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { collectionGet } = vi.hoisted(() => ({ collectionGet: vi.fn() }))
vi.mock('@/lib/firebase-admin', () => ({ getAdminFirestore: () => ({ collection: () => ({ get: collectionGet }) }) }))

const { getActivityNotes } = await import('../FirestoreActivityNoteRepository')
const { getActivityNotesBackup, getHrUnreliableIds } = await import('../JsonActivityNoteRepository')

describe('the HR-unreliable mark on a run note', () => {
  let root: string

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-'))
    vi.stubEnv('RUNOMICS_DATA_DIR', root)
    vi.stubEnv('FIREBASE_PROJECT_ID', 'demo')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('is read from Firestore, and keeps a note that holds nothing else', async () => {
    const doc = (id: string, data: Record<string, unknown>) => ({ id, data: () => data })
    collectionGet.mockResolvedValue({
      docs: [
        doc('1', { note: '', tags: [], hrUnreliable: true }),
        doc('2', { note: '', tags: [], hrUnreliable: 'yes' }),
        doc('3', { note: 'Windy', tags: [] }),
      ],
    })

    const { notes } = await getActivityNotes()

    expect([...notes]).toEqual([
      ['1', { note: '', tags: [], hrUnreliable: true }],
      ['3', { note: 'Windy', tags: [] }],
    ])
  })

  it('is read from the nightly backup', () => {
    fs.writeFileSync(path.join(root, 'activity_notes.json'), JSON.stringify({ notes: {
      1: { note: '', tags: [], hrUnreliable: true },
      2: { note: 'Easy', tags: [] },
      3: { note: '', tags: [] },
    } }))

    expect(getActivityNotesBackup()?.get('1')).toEqual({ note: '', tags: [], hrUnreliable: true })
    expect(getActivityNotesBackup()?.has('3')).toBe(false)
    expect(getHrUnreliableIds()).toEqual(new Set(['1']))
  })

  it('marks nothing without a backup', () => {
    expect(getHrUnreliableIds()).toEqual(new Set())
  })
})
