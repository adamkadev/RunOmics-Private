import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
let mockStoredNote: { note: string; tags: string[] } | null = null

function signedIn(email: string, claims: Record<string, unknown> = {}): MockUser {
  return { email, getIdTokenResult: () => Promise.resolve({ claims }) }
}

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
  doc: () => ({}),
  getDoc: async () => ({
    exists: () => mockStoredNote !== null,
    data: () => mockStoredNote,
  }),
  setDoc: async () => {},
}))

async function openNotes() {
  const toggle = await screen.findByRole('button', { name: new RegExp(t.activity.notes.title) })
  await userEvent.click(toggle)
}

describe('ActivityNotes owner gate', () => {
  beforeEach(() => {
    mockUser = null
    mockStoredNote = null
  })

  it('renders nothing for a signed-out visitor when the activity has no note', async () => {
    const { container } = render(<ActivityNotes activityId="a1" />)
    await vi.waitFor(() => expect(container.firstChild).toBeNull())
  })

  it('shows the read-only note to a visitor when one exists', async () => {
    mockStoredNote = { note: 'Great tempo run', tags: ['tempo'] }
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
    const { container } = render(<ActivityNotes activityId="a1" />)
    await vi.waitFor(() => expect(container.firstChild).toBeNull())
  })

  it('does not grant the editor on a matching email alone', async () => {
    mockUser = signedIn(OWNER_EMAIL)
    mockStoredNote = { note: 'Great tempo run', tags: [] }
    render(<ActivityNotes activityId="a1" />)
    await openNotes()

    expect(await screen.findByText('Great tempo run')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(t.activity.notes.notePlaceholder)).not.toBeInTheDocument()
  })
})
