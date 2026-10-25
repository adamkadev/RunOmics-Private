import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const REPO = '/repos/adamkadev/runomics-data-test'
const sha = (text: string) => createHash('sha1').update(text).digest('hex')
const syncMeta = (at: string) => JSON.stringify({ lastSyncedAt: at })
const months = (...names: string[]) => JSON.stringify({ months: names })
const runs = (...dates: string[]) => JSON.stringify({ activities: dates.map((date) => ({ id: date, date, type: 'Base' })) })

const COMMITS: Record<string, { date: string; files: Record<string, string> }> = {
  c1: { date: '2026-10-20T10:00:00Z', files: { 'sync_meta.json': syncMeta('2026-10-20T10:00:00Z'), 'pbs.json': '{"years":[]}' } },
  c2: { date: '2026-10-21T10:00:00Z', files: { 'sync_meta.json': syncMeta('2026-10-21T10:00:00Z'), 'pbs.json': '{"years":[]}' } },
  broken: { date: '2026-10-22T10:00:00Z', files: { 'sync_meta.json': syncMeta('not a date') } },
  september: { date: '2026-10-23T10:00:00Z', files: { 'activities/index.json': months('2026-09'), 'activities/2026-09.json': runs('2026-09-01') } },
  october: {
    date: '2026-10-24T10:00:00Z',
    files: { 'activities/index.json': months('2026-09', '2026-10'), 'activities/2026-09.json': runs('2026-09-01'), 'activities/2026-10.json': runs('2026-10-02') },
  },
}
const BLOBS = new Map(Object.values(COMMITS).flatMap(({ files }) => Object.values(files).map((text) => [sha(text), text])))

let head = 'c1'
const fetchMock = vi.fn(async (url: string) => {
  const path = new URL(url).pathname.slice(REPO.length)
  if (path === '/commits/HEAD') return new Response(head)
  const [, kind, id] = path.match(/^\/git\/(commits|trees|blobs)\/(\w+)$/) ?? []
  if (kind === 'commits') return Response.json({ tree: { sha: `tree${id}` }, committer: { date: COMMITS[id!]!.date } })
  if (kind === 'trees') {
    const { files } = COMMITS[id!.slice('tree'.length)]!
    const tree = Object.entries(files).map(([file, text]) => ({ path: `data/${file}`, type: 'blob', sha: sha(text) }))
    return Response.json({ truncated: false, tree })
  }
  if (kind === 'blobs' && BLOBS.has(id!)) return new Response(BLOBS.get(id!))
  return new Response('Not Found', { status: 404 })
})

async function load() {
  vi.resetModules()
  const { loadData, rejectedData } = await import('../loadData')
  const { getLastSyncedAt } = await import('@/application/usecases/GetSyncStatus')
  const { getAllActivities } = await import('../repositories/JsonActivityRepository')
  return { loadData, rejectedData, getLastSyncedAt, getAllActivities }
}

const blobReads = () => fetchMock.mock.calls.map(([url]) => url).filter((url) => url.includes('/git/blobs/'))

beforeEach(() => {
  head = 'c1'
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('RUNOMICS_DATA_SOURCE', 'github')
  vi.stubEnv('VERCEL', '1')
  vi.stubEnv('RUNOMICS_DATA_REPO_URL', 'https://github.com/adamkadev/runomics-data-test.git')
  vi.stubEnv('RUNOMICS_DATA_REPO_TOKEN', 'github_pat_test')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('loadData from GitHub', () => {
  it('serves the commit it loaded, reads only what the next commit changed, and follows a rollback', async () => {
    const { loadData, getLastSyncedAt } = await load()
    expect(() => getLastSyncedAt()).toThrow(/before loadData/)

    await loadData()
    expect(getLastSyncedAt()).toBe('2026-10-20T10:00:00Z')

    head = 'c2'
    fetchMock.mockClear()
    await loadData()
    expect(getLastSyncedAt()).toBe('2026-10-21T10:00:00Z')
    expect(blobReads()).toEqual([`https://api.github.com${REPO}/git/blobs/${sha(syncMeta('2026-10-21T10:00:00Z'))}`])

    head = 'c1'
    await loadData()
    expect(getLastSyncedAt()).toBe('2026-10-20T10:00:00Z')
  })

  it('keeps the runs of a month the next commit left alone, rather than parsing them again', async () => {
    head = 'september'
    const { loadData, getAllActivities } = await load()
    await loadData()
    const [september] = getAllActivities()

    head = 'october'
    await loadData()

    expect(getAllActivities().map((a) => a.id)).toEqual(['2026-10-02', '2026-09-01'])
    expect(getAllActivities()[1]).toBe(september)
  })

  it('refuses a commit whose data would crash a page, and keeps serving the one before', async () => {
    const { loadData, rejectedData, getLastSyncedAt } = await load()
    await loadData()

    head = 'broken'
    await loadData()

    expect(getLastSyncedAt()).toBe('2026-10-20T10:00:00Z')
    expect(rejectedData()).toMatchObject({ commit: 'broken', errors: [expect.stringContaining('sync_meta.json')] })
  })

  it('fails loudly on a cold instance whose HEAD is refused, naming the commit', async () => {
    head = 'broken'
    const { loadData } = await load()

    await expect(loadData()).rejects.toThrow(/HEAD broken was refused/)
  })
})
