import { FieldPath } from 'firebase-admin/firestore'
import { getAdminFirestore } from '@/lib/firebase-admin'
import { activeLocale } from '@/i18n'
import type { Insight } from '@/lib/gemini'
import { withTimeout } from '../withTimeout'

const COLLECTION = 'aiInsights'
const HISTORY_SIZE = 5

const READ_TIMEOUT_MS = 2000

const STALE_GRACE_MS = 48 * 60 * 60 * 1000

const ID_RANGE_END = '\uf8ff'

export interface CachedInsight extends Insight {
  hash: string
  generatedAt: string
  recentHeadlines?: string[]
  guard?: string
  noteKey?: string
}

export interface InsightKey {
  hash: string
  guard?: string
}

function docId(surface: string): string {
  return `${surface}_${activeLocale}`
}

function bySurface<D extends { id: string }, T>(docs: D[], prefix: string, read: (doc: D) => T): Map<string, T> {
  const suffix = `_${activeLocale}`
  return new Map(
    docs
      .filter((doc) => doc.id.startsWith(prefix) && doc.id.endsWith(suffix))
      .map((doc) => [doc.id.slice(0, -suffix.length), read(doc)])
  )
}

function servable(cached: CachedInsight, key: InsightKey, now: number): boolean {
  if (cached.hash === key.hash) return true

  if (key.guard !== undefined && cached.guard !== key.guard) return false

  const age = now - Date.parse(cached.generatedAt)
  return Number.isFinite(age) && age < STALE_GRACE_MS
}

export async function getCachedInsight(surface: string): Promise<CachedInsight | null> {
  const doc = await getAdminFirestore().collection(COLLECTION).doc(docId(surface)).get()
  return doc.exists ? (doc.data() as CachedInsight) : null
}

async function readStored(surface: string): Promise<CachedInsight | null> {
  if (!process.env.FIREBASE_PROJECT_ID) return null
  try {
    return await withTimeout(getCachedInsight(surface), READ_TIMEOUT_MS, null)
  } catch {
    return null
  }
}

const insightOf = (cached: CachedInsight): Insight => ({ headline: cached.headline, body: cached.body, bullets: cached.bullets })
const keyOf = (key: string | InsightKey): InsightKey => (typeof key === 'string' ? { hash: key } : key)

/** The whole stored document, so a caller needing *when* a surface was written need not read it twice. */
export async function readVerifiedCachedInsight(
  surface: string,
  key: string | InsightKey
): Promise<CachedInsight | null> {
  const cached = await readStored(surface)
  return cached && servable(cached, keyOf(key), Date.now()) ? cached : null
}

export interface StoredInsight {
  insight: Insight
  generatedAt: string
  /** Whether it still answers the key asked with; Today shows an unverified one only as yesterday's. */
  verified: boolean
}

export async function readStoredInsight(surface: string, key: string | InsightKey): Promise<StoredInsight | null> {
  const cached = await readStored(surface)
  return cached ? { insight: insightOf(cached), generatedAt: cached.generatedAt, verified: servable(cached, keyOf(key), Date.now()) } : null
}

export async function readVerifiedInsight(surface: string, key: string | InsightKey): Promise<Insight | null> {
  const cached = await readVerifiedCachedInsight(surface, key)
  return cached ? insightOf(cached) : null
}

function surfaceRange(prefix: string) {
  return getAdminFirestore()
    .collection(COLLECTION)
    .orderBy(FieldPath.documentId())
    .startAt(prefix)
    .endAt(`${prefix}${ID_RANGE_END}`)
}

/** What a stored card was written from: its facts hash, and for a run verdict the athlete's note. */
export interface CachedKeys {
  hash: string
  noteKey?: string
}

export async function listCachedKeys(prefix: string): Promise<Map<string, CachedKeys>> {
  const snapshot = await surfaceRange(prefix).select('hash', 'noteKey').get()
  return bySurface(snapshot.docs, prefix, (doc) => {
    const noteKey = doc.get('noteKey')
    return { hash: doc.get('hash') as string, ...(typeof noteKey === 'string' && { noteKey }) }
  })
}

const PHRASING_SURFACE = 'verdictPhrasing'
/** Enough for the latest few of each kind of session, which the pass shows first. */
const PHRASING_SIZE = 40

export interface VerdictPhrasing {
  headline: string
  body: string
  /** Optional: phrasing stored before kinds were recorded has none. */
  kind?: string
}

function isPhrasing(value: unknown): value is VerdictPhrasing {
  const entry = value as Partial<VerdictPhrasing> | null
  return !!entry && typeof entry.headline === 'string' && typeof entry.body === 'string' && (entry.kind === undefined || typeof entry.kind === 'string')
}

export async function readVerdictPhrasing(): Promise<VerdictPhrasing[]> {
  if (!process.env.FIREBASE_PROJECT_ID) return []

  try {
    const doc = await withTimeout(
      getAdminFirestore().collection(COLLECTION).doc(docId(PHRASING_SURFACE)).get(),
      READ_TIMEOUT_MS,
      null
    )
    const recent = doc?.exists ? (doc.data() as { recent?: unknown }).recent : undefined
    return Array.isArray(recent) ? recent.filter(isPhrasing) : []
  } catch {
    return []
  }
}

export async function saveVerdictPhrasing(recent: VerdictPhrasing[]): Promise<void> {
  await getAdminFirestore()
    .collection(COLLECTION)
    .doc(docId(PHRASING_SURFACE))
    .set({ recent: recent.slice(0, PHRASING_SIZE), updatedAt: new Date().toISOString() })
}

export async function saveCachedInsight(
  surface: string,
  insight: Insight,
  hash: string,
  previous: CachedInsight | null,
  guard?: string,
  noteKey?: string
): Promise<void> {
  const recentHeadlines = [insight.headline, ...(previous?.recentHeadlines ?? [])].slice(0, HISTORY_SIZE)

  await getAdminFirestore()
    .collection(COLLECTION)
    .doc(docId(surface))
    .set({
      ...insight,
      hash,
      ...(guard !== undefined && { guard }),
      ...(noteKey !== undefined && { noteKey }),
      generatedAt: new Date().toISOString(),
      recentHeadlines,
    })
}
