import { getAdminFirestore } from '@/lib/firebase-admin'
import { activeLocale } from '@/i18n'
import type { Insight } from '@/lib/gemini'

const COLLECTION = 'aiInsights'
const HISTORY_SIZE = 5

// Firestore retries a failed connection with backoff rather than rejecting, so
// an unreachable project would hang a page render instead of falling back.
// These are cosmetic strings on otherwise complete cards: give up early.
const READ_TIMEOUT_MS = 2000

// An insight is keyed on every fact it was written from, and some of those facts
// move on their own overnight: the days since the last run, the rolling week,
// the race predictions Garmin revises every night. Read on exact match alone,
// the copy therefore blanks itself at midnight and stays blank all day whenever
// a generation pass fails - the analytics tab renders nothing, the hero drops
// back to its canned line. Yesterday's sentence is worth more than either, so
// it is still served for this long once its own facts have moved on.
const STALE_GRACE_MS = 48 * 60 * 60 * 1000

export interface CachedInsight extends Insight {
  hash: string
  generatedAt: string
  recentHeadlines?: string[]
  /** See InsightKey.guard - stored so a later read can check it. */
  guard?: string
}

/** What a reader knows about the copy it is asking for. */
export interface InsightKey {
  /** Hash of every fact the copy was written from. Regeneration is keyed on this. */
  hash: string
  /**
   * Hash of the facts the copy is rendered beside and must never contradict -
   * the tone badge on the hero, say. Copy whose own facts have since moved is
   * served through the grace window only while this still holds; a surface with
   * nothing beside it to contradict passes nothing.
   */
  guard?: string
}

function docId(surface: string): string {
  return `${surface}_${activeLocale}`
}

function servable(cached: CachedInsight, key: InsightKey, now: number): boolean {
  if (cached.hash === key.hash) return true

  // Past its own facts: only the guard and the grace window can still carry it.
  // A document written before this surface had a guard cannot be checked, so it
  // is not served either - the next generation stores one and it heals itself.
  if (key.guard !== undefined && cached.guard !== key.guard) return false

  const age = now - Date.parse(cached.generatedAt)
  return Number.isFinite(age) && age < STALE_GRACE_MS
}

export async function getCachedInsight(surface: string): Promise<CachedInsight | null> {
  const doc = await getAdminFirestore().collection(COLLECTION).doc(docId(surface)).get()
  return doc.exists ? (doc.data() as CachedInsight) : null
}

/**
 * A cached insight, while it is still safe to show: written from exactly the
 * facts the caller just computed, or - once those have moved - recent enough
 * and still guarded against contradicting what is rendered beside it.
 * Null also covers no admin credentials (local dev, e2e build) and a Firestore
 * that is slow or unreachable, so callers can always fall back quietly.
 */
/** The insight itself, once a caller already holds the document - the part of readVerifiedInsight after the fetch. */
export function servableInsight(cached: CachedInsight | undefined, key: string | InsightKey, now = Date.now()): Insight | null {
  if (!cached) return null
  const wanted = typeof key === 'string' ? { hash: key } : key
  return servable(cached, wanted, now) ? { headline: cached.headline, body: cached.body, bullets: cached.bullets } : null
}

export async function readVerifiedInsight(surface: string, key: string | InsightKey): Promise<Insight | null> {
  if (!process.env.FIREBASE_PROJECT_ID) return null

  try {
    const cached = await Promise.race([
      getCachedInsight(surface),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), READ_TIMEOUT_MS)),
    ])
    return cached ? servableInsight(cached, key) : null
  } catch {
    return null
  }
}

/**
 * Every cached insight under one surface prefix, in a single query. A static
 * build pre-renders one page per run - a few hundred of them - and each used to
 * read its own verdict from Firestore individually via readVerifiedInsight,
 * racing its own two-second timeout. One slow connection anywhere in a build
 * that large silently dropped that page's verdict even though the cache held a
 * perfectly good one, with nothing after the fact to notice or fix it. Read
 * every document once instead and let callers look theirs up in memory.
 */
export async function getCachedInsightsByPrefix(prefix: string): Promise<Map<string, CachedInsight>> {
  const snapshot = await getAdminFirestore().collection(COLLECTION).get()
  const suffix = `_${activeLocale}`

  return new Map(
    snapshot.docs
      .filter((doc) => doc.id.startsWith(prefix) && doc.id.endsWith(suffix))
      .map((doc) => [doc.id.slice(0, -suffix.length), doc.data() as CachedInsight])
  )
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
  previous: CachedInsight | null,
  guard?: string
): Promise<void> {
  const recentHeadlines = [insight.headline, ...(previous?.recentHeadlines ?? [])].slice(0, HISTORY_SIZE)

  await getAdminFirestore()
    .collection(COLLECTION)
    .doc(docId(surface))
    .set({
      ...insight,
      hash,
      // Firestore rejects an undefined field outright, and a surface with
      // nothing to contradict has no guard to store.
      ...(guard !== undefined && { guard }),
      generatedAt: new Date().toISOString(),
      recentHeadlines,
    })
}
