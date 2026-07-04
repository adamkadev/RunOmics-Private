import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityNotes } from '@/components/activity/ActivityNotes'
import { t } from '@/i18n'

// The component reads NEXT_PUBLIC_OWNER_EMAIL at module load, so it must be
// set before the import graph is evaluated - vi.hoisted runs first.
const OWNER_EMAIL = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_OWNER_EMAIL = 'owner@test.dev'
  return 'owner@test.dev'
})

let mockUser: { email: string } | null = null
let mockStoredNote: { note: string; tags: string[] } | null = null

vi.mock('@/lib/firebase', () => ({
  isClientFirebaseConfigured: true,
  getClientAuth: () => ({}),
  getClientFirestore: () => ({}),
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
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

describe('ActivityNotes owner gate', () => {
  beforeEach(() => {
    mockUser = null
    mockStoredNote = null
  })

  it('renders nothing for a visitor when the activity has no note', async () => {
    const { container } = render(<ActivityNotes activityId="a1" />)
    // Wait for the auth + note effects to settle.
    await vi.waitFor(() => expect(container.firstChild).toBeNull())
  })

  it('shows the read-only note to a visitor when one exists', async () => {
    mockStoredNote = { note: 'Great tempo run', tags: ['tempo'] }
    render(<ActivityNotes activityId="a1" />)

    const toggle = await screen.findByRole('button', { name: new RegExp(t.activity.notes.title) })
    await userEvent.click(toggle)

    expect(await screen.findByText('Great tempo run')).toBeInTheDocument()
    // Visitors never get the editor.
    expect(screen.queryByPlaceholderText(t.activity.notes.notePlaceholder)).not.toBeInTheDocument()
  })

  it('shows the editor only to the owner account', async () => {
    mockUser = { email: OWNER_EMAIL }
    render(<ActivityNotes activityId="a1" />)

    const toggle = await screen.findByRole('button', { name: new RegExp(t.activity.notes.title) })
    await userEvent.click(toggle)

    expect(await screen.findByPlaceholderText(t.activity.notes.notePlaceholder)).toBeInTheDocument()
  })

  it('treats a signed-in non-owner like a visitor', async () => {
    mockUser = { email: 'someone-else@example.com' }
    const { container } = render(<ActivityNotes activityId="a1" />)
    await vi.waitFor(() => expect(container.firstChild).toBeNull())
  })
})
