import 'server-only'
import { createHash } from 'node:crypto'
import { getSecurityRules } from 'firebase-admin/security-rules'
import { getAdminApp } from '@/lib/firebase-admin'

export function rulesHash(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}

/** The ruleset Firestore enforces now. The service account needs the Firebase Rules Viewer role to read it. */
export async function liveFirestoreRulesHash(): Promise<string> {
  const ruleset = await getSecurityRules(getAdminApp()).getFirestoreRuleset()
  return rulesHash(ruleset.source.map((file) => file.content).join('\n'))
}
