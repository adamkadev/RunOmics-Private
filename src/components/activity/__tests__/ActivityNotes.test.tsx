import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityNotes } from '@/components/activity/ActivityNotes'
import { t } from '@/i18n'

const OWNER_EMAIL = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_OWNER_EMAIL = 'owner@test.dev'
  return 'owner@test.dev'
})

interface MockUser {
  email: string
  getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }>
}

let mockUser: MockUser | null = null
let mockAllNotes: { note: string; tags: string[] }[] = []
let mockNotesById: Record<string, { note: string; tags: string[] }> = {}
let mockLastRequestedId = ''

const ACTIVITY_ID = 'a1'

function signedIn(email: string, claims: Record<string, unknown> = {}): MockUser {
  return { email, getIdTokenResult: () => Promise.resolve({ claims }) }
}

vi.mock('@/lib/firebaseConfig', () => ({ isClientFirebaseConfigured: true }))

vi.mock('@/lib/firebase', () => ({
  isClientFirebaseConfigured: true,
  getClientAuth: () => ({}),
  getClientFirestore: () => ({}),
}))

vi.mock('firebase/auth', () => ({
  onIdTokenChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    cb(mockUser)
    return () => {}
  },
}))

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, _collection: string, id: string) => {
    mockLastRequestedId = id
    return { id }
  },
  collection: () => ({}),
  getDoc: async (ref: { id: string }) => {
    mockFirestoreReads += 1
    if (mockFirestoreDenied) throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' })
    const stored = mockNotesById[ref.id] ?? null
    return { exists: () => stored !== null, data: () => stored }
  },
  getDocs: async () => ({ docs: mockAllNotes.map((note) => ({ data: () => note })) }),
  setDoc: async () => {},
}))

async function openNotes() {
  const row = await screen.findByTestId('note-row')
  await vi.waitFor(() => expect(row).toBeEnabled())
  await userEvent.click(row)
}

let mockNoteApiStatus = 200
let mockFirestoreReads = 0
/** The rules: only the owner reads a note straight from Firestore. */
let mockFirestoreDenied = false

// The page reads a note through the app (/api/activities/[id]/note), so the
// private site's gate covers it; Firestore is the owner's fallback.
function noteApi(url: string) {
  const id = decodeURIComponent(url.split('/')[3] ?? '')
  mockLastRequestedId = id
  const ok = mockNoteApiStatus === 200
  return Promise.resolve({ ok, status: mockNoteApiStatus, json: async () => mockNotesById[id] ?? { note: '', tags: [] } })
}

beforeEach(() => {
  mockUser = null
  mockAllNotes = []
  mockNotesById = {}
  mockLastRequestedId = ''
  mockNoteApiStatus = 200
  mockFirestoreReads = 0
  mockFirestoreDenied = false
  vi.stubGlobal('fetch', vi.fn(noteApi))
})

afterEach(() => vi.unstubAllGlobals())

describe('ActivityNotes owner gate', () => {

  // The row is always there - the note had no visible entry point - but a
  // visitor with nothing to read has nothing to open.
  it('shows a signed-out visitor a row with no note and nothing to open', async () => {
    render(<ActivityNotes activityId="a1" />)
    const row = await screen.findByTestId('note-row')

    expect(row).toHaveTextContent(t.activity.noteRow.none)
    expect(row).toBeDisabled()
  })

  it('shows the read-only note to a visitor when one exists', async () => {
    mockNotesById = { [ACTIVITY_ID]: { note: 'Great tempo run', tags: ['tempo'] } }
    render(<ActivityNotes activityId="a1" />)
    await openNotes()

    expect(await screen.findByText('Great tempo run')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(t.activity.notes.notePlaceholder)).not.toBeInTheDocument()
  })

  it('shows the editor to an account carrying the owner claim', async () => {
    mockUser = signedIn('anything@example.com', { owner: true })
    render(<ActivityNotes activityId="a1" />)
    await openNotes()

    expect(await screen.findByPlaceholderText(t.activity.notes.notePlaceholder)).toBeInTheDocument()
  })

  it('treats a signed-in account without the owner claim like a visitor', async () => {
    mockUser = signedIn('someone-else@example.com')
    render(<ActivityNotes activityId="a1" />)
    const row = await screen.findByTestId('note-row')

    await vi.waitFor(() => expect(row).toHaveTextContent(t.activity.noteRow.none))
    expect(row).toBeDisabled()
  })

  it('offers the owner a way to add a note', async () => {
    mockUser = signedIn('anything@example.com', { owner: true })
    render(<ActivityNotes activityId="a1" />)
    const row = await screen.findByTestId('note-row')

    await vi.waitFor(() => expect(row).toHaveTextContent(t.activity.noteRow.add))
  })

  it('does not grant the editor on a matching email alone', async () => {
    mockUser = signedIn(OWNER_EMAIL)
    mockNotesById = { [ACTIVITY_ID]: { note: 'Great tempo run', tags: [] } }
    render(<ActivityNotes activityId="a1" />)
    await openNotes()

    expect(await screen.findByText('Great tempo run')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(t.activity.notes.notePlaceholder)).not.toBeInTheDocument()
  })
})

describe('ActivityNotes sheet', () => {
  beforeEach(() => {
    mockUser = signedIn('owner@example.com', { owner: true })
  })

  it('names itself and offers a way out that is not a guess', async () => {
    render(<ActivityNotes activityId="a1" />)
    await openNotes()

    const sheet = await screen.findByRole('dialog')
    expect(sheet).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('heading', { name: t.activity.notes.sheetTitle })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: t.settings.actions.confirmCancel }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('discards the draft on cancel rather than keeping it for next time', async () => {
    render(<ActivityNotes activityId="a1" />)
    await openNotes()

    await userEvent.type(await screen.findByPlaceholderText(t.activity.notes.notePlaceholder), 'felt heavy')
    await userEvent.click(screen.getByRole('button', { name: t.settings.actions.confirmCancel }))
    await openNotes()

    expect(await screen.findByPlaceholderText(t.activity.notes.notePlaceholder)).toHaveValue('')
  })

  it('offers the tags used on other runs as chips', async () => {
    mockAllNotes = [
      { note: '', tags: ['rain', 'trail'] },
      { note: '', tags: ['rain'] },
    ]
    render(<ActivityNotes activityId="a1" />)
    await openNotes()

    const rain = await screen.findByRole('button', { name: t.activity.notes.addTag('rain') })
    await userEvent.click(rain)

    expect(screen.getByRole('button', { name: t.activity.notes.removeTag('rain') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.activity.notes.addTag('rain') })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.activity.notes.addTag('trail') })).toBeInTheDocument()
  })

  // Design review, Oct 2026: the row that opens the sheet is a full-width
  // 44 pt row, and every control on the sheet is a 44 pt target, however
  // small it is drawn - Cancel, Save, a tag's ✕ and each suggested tag.
  it('gives every control a 44 pt target', async () => {
    mockAllNotes = [{ note: '', tags: ['rain', 'trail'] }]
    render(<ActivityNotes activityId="a1" />)
    expect((await screen.findByTestId('note-row')).className).toContain('min-h-11')
    await openNotes()
    await userEvent.click(await screen.findByRole('button', { name: t.activity.notes.addTag('rain') }))

    for (const button of within(screen.getByRole('dialog')).getAllByRole('button')) {
      expect(button.className, button.getAttribute('aria-label') ?? button.textContent ?? '').toContain('hit-44')
    }
  })
})

describe('ActivityNotes across a client-side navigation', () => {
  beforeEach(() => {
    mockUser = signedIn(OWNER_EMAIL, { owner: true })
  })

  it('does not carry one activity\'s note onto the next one', async () => {
    // ActivityNav navigates with a <Link>, so the component stays mounted and
    // only activityId changes. It used to `return` early on a missing note,
    // leaving the previous activity's text on screen - and saving would then
    // write it to the new activity's document.
    mockNotesById = { a1: { note: 'legs were dead', tags: ['tired'] } }
    const { rerender } = render(<ActivityNotes activityId="a1" />)

    await openNotes()
    expect(await screen.findByPlaceholderText(t.activity.notes.notePlaceholder)).toHaveValue('legs were dead')

    rerender(<ActivityNotes activityId="a2" />)

    await openNotes()
    expect(await screen.findByPlaceholderText(t.activity.notes.notePlaceholder)).toHaveValue('')
    expect(screen.queryByText('legs were dead')).not.toBeInTheDocument()
  })

  it('reads the note for the activity it is actually showing', async () => {
    mockNotesById = { a1: { note: 'one', tags: [] }, a2: { note: 'two', tags: [] } }
    const { rerender } = render(<ActivityNotes activityId="a1" />)
    await openNotes()
    expect(await screen.findByPlaceholderText(t.activity.notes.notePlaceholder)).toHaveValue('one')

    rerender(<ActivityNotes activityId="a2" />)
    await openNotes()

    expect(mockLastRequestedId).toBe('a2')
    expect(await screen.findByPlaceholderText(t.activity.notes.notePlaceholder)).toHaveValue('two')
  })
})

describe('ActivityNotes when the server cannot read notes', () => {
  beforeEach(() => {
    mockNoteApiStatus = 503
    mockNotesById = { a1: { note: 'legs were dead', tags: [] } }
  })

  // An editor that opened empty over a note it could not fetch would let a
  // save replace it.
  it('reads the owner\'s note straight from Firestore', async () => {
    mockUser = signedIn('owner@example.com', { owner: true })
    render(<ActivityNotes activityId="a1" />)
    await openNotes()
    expect(await screen.findByPlaceholderText(t.activity.notes.notePlaceholder)).toHaveValue('legs were dead')
    expect(mockFirestoreReads).toBeGreaterThan(0)
  })

  it('shows a visitor no note rather than an error', async () => {
    mockFirestoreDenied = true
    render(<ActivityNotes activityId="a1" />)
    const row = await screen.findByTestId('note-row')
    // Both reads are done - the app's, then Firestore's refusal - and nothing showed.
    await vi.waitFor(() => expect(mockFirestoreReads).toBe(1))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(row).toHaveTextContent(t.activity.noteRow.none)
    expect(row).toBeDisabled()
  })
})
