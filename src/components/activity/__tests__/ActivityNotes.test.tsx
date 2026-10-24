import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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

vi.mock('@/lib/firebaseAuth', () => ({ getClientAuth: () => ({}) }))

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

/** The note chip: it opens the editor, or shows the note and then Edit for the owner. */
async function openNotes() {
  const chip = await screen.findByTestId('note-row')
  await userEvent.click(chip)
  const edit = screen.queryByRole('button', { name: t.activity.noteRow.edit })
  if (edit) await userEvent.click(edit)
}

let mockNotesUnavailable = false
let mockFirestoreReads = 0
/** Firestore's rules: only the owner reads a note straight from Firestore. */
let mockFirestoreDenied = false

// The page reads a note through the app, so the private site's gate covers it; Firestore is the owner's fallback.
function noteApi(url: string) {
  const id = decodeURIComponent(url.split('/')[3] ?? '')
  mockLastRequestedId = id
  // "Unavailable" is a server without the admin credentials: the answer says so.
  const body = mockNotesUnavailable ? { available: false } : { available: true, ...(mockNotesById[id] ?? { note: '', tags: [] }) }
  return Promise.resolve({ ok: true, status: 200, json: async () => body })
}

beforeEach(() => {
  mockUser = null
  mockAllNotes = []
  mockNotesById = {}
  mockLastRequestedId = ''
  mockNotesUnavailable = false
  mockFirestoreReads = 0
  mockFirestoreDenied = false
  vi.stubGlobal('fetch', vi.fn(noteApi))
})

afterEach(() => vi.unstubAllGlobals())

describe('ActivityNotes owner gate', () => {

  it('draws no chip for a signed-out visitor when there is no note', async () => {
    render(<ActivityNotes activityId="a1" />)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(screen.queryByTestId('note-row')).toBeNull()
  })

  it('expands the note in place for a visitor when one exists', async () => {
    mockNotesById = { [ACTIVITY_ID]: { note: 'Great tempo run', tags: ['tempo'] } }
    render(<ActivityNotes activityId="a1" />)
    const chip = await screen.findByTestId('note-row')
    await vi.waitFor(() => expect(chip).toHaveAttribute('aria-expanded', 'false'))
    await userEvent.click(chip)

    expect(chip).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('note-text')).toHaveTextContent('Great tempo run')
    expect(screen.getByTestId('note-text')).toHaveTextContent('tempo')
    expect(screen.queryByRole('button', { name: t.activity.noteRow.edit })).toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(chip)
    expect(screen.queryByTestId('note-text')).toBeNull()
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
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(screen.queryByTestId('note-row')).toBeNull()
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
    const chip = await screen.findByTestId('note-row')
    await vi.waitFor(() => expect(chip).toHaveAttribute('aria-expanded', 'false'))
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

    // The sheet slides away before it goes.
    await userEvent.click(screen.getByRole('button', { name: t.common.close }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('discards the draft on cancel rather than keeping it for next time', async () => {
    render(<ActivityNotes activityId="a1" />)
    await openNotes()

    await userEvent.type(await screen.findByPlaceholderText(t.activity.notes.notePlaceholder), 'felt heavy')
    await userEvent.click(screen.getByRole('button', { name: t.common.close }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
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

  it('gives every control a 44 pt target', async () => {
    mockAllNotes = [{ note: '', tags: ['rain', 'trail'] }]
    render(<ActivityNotes activityId="a1" />)
    expect((await screen.findByTestId('note-row')).className).toContain('hit-44')
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
    // ActivityNav navigates with a <Link>, so the component stays mounted and only activityId changes:
    // a note left on screen would be saved to the new activity's document.
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
    mockNotesUnavailable = true
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
    // Both reads are done - the app's, then Firestore's refusal - and nothing showed.
    await vi.waitFor(() => expect(mockFirestoreReads).toBe(1))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByTestId('note-row')).toBeNull()
  })
})
