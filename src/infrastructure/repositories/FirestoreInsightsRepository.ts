import { getAdminFirestore } from '@/lib/firebase-admin'
import { activeLocale } from '@/i18n'
import type { Insight } from '@/lib/gemini'

const COLLECTION = 'aiInsights'
const HISTORY_SIZE = 5

// Firestore retries a failed connection with backoff rather than rejecting, so
// an unreachable project would hang a page render instead of falling back.
// These are cosmetic strings on otherwise complete cards: give up early.
const READ_TIMEOUT_MS = 2000

export interface CachedInsight extends Insight {
  hash: string
  generatedAt: string
  recentHeadlines?: string[]
}

function docId(surface: string): string {
  return `${surface}_${activeLocale}`
}

export async function getCachedInsight(surface: string): Promise<CachedInsight | null> {
  const doc = await getAdminFirestore().collection(COLLECTION).doc(docId(surface)).get()
  return doc.exists ? (doc.data() as CachedInsight) : null
}

/**
 * A cached insight, but only when it still matches the facts the caller just
 * computed - a stale one would contradict the tone badge rendered beside it.
 * Null also covers no admin credentials (local dev, e2e build) and a Firestore
 * that is slow or unreachable, so callers can always fall back quietly.
 */
export async function readVerifiedInsight(surface: string, expectedHash: string): Promise<Insight | null> {
  if (!process.env.FIREBASE_PROJECT_ID) return null

  try {
    const cached = await Promise.race([
      getCachedInsight(surface),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), READ_TIMEOUT_MS)),
    ])
    if (!cached || cached.hash !== expectedHash) return null
    return { headline: cached.headline, body: cached.body }
  } catch {
    return null
  }
}

/**
 * Surface -> stored hash for everything already generated in the active locale,
 * in one query. The backfill needs the hash, not just the presence of a
 * document: an entry written from facts that have since changed is one the
 * pages already ignore, so it has to be picked up again rather than skipped
 * forever.
 */
export async function listCachedHashes(prefix: string): Promise<Map<string, string>> {
  const snapshot = await getAdminFirestore().collection(COLLECTION).select('hash').get()
  const suffix = `_${activeLocale}`

  return new Map(
    snapshot.docs
      .filter((doc) => doc.id.startsWith(prefix) && doc.id.endsWith(suffix))
      .map((doc) => [doc.id.slice(0, -suffix.length), doc.get('hash') as string])
  )
}

export async function saveCachedInsight(
  surface: string,
  insight: Insight,
  hash: string,
  previous: CachedInsight | null
): Promise<void> {
  const recentHeadlines = [insight.headline, ...(previous?.recentHeadlines ?? [])].slice(0, HISTORY_SIZE)

  await getAdminFirestore()
    .collection(COLLECTION)
    .doc(docId(surface))
    .set({ ...insight, hash, generatedAt: new Date().toISOString(), recentHeadlines })
}
