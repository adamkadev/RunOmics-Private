import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const RULES = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8')

vi.mock('@/lib/firebase-admin', () => ({ getAdminApp: () => ({}) }))
vi.mock('firebase-admin/security-rules', () => ({
  getSecurityRules: () => ({ getFirestoreRuleset: async () => ({ source: [{ name: 'firestore.rules', content: RULES }] }) }),
}))

const { liveFirestoreRulesHash } = await import('../firestoreRulesHash')

describe('liveFirestoreRulesHash', () => {
  it('hashes the deployed file as sha256sum hashes the repository’s firestore.rules', async () => {
    expect(await liveFirestoreRulesHash()).toBe(createHash('sha256').update(readFileSync(join(process.cwd(), 'firestore.rules'))).digest('hex'))
  })
})
