import 'server-only'
import type { DataSnapshot } from './dataFs'

const API = 'https://api.github.com'
const POINTER_TTL_SECONDS = 600
const TIMEOUT_MS = 15_000
// Addressed by SHA, so never stale; and an ISR render may cache them, where no-store would make the page dynamic.
const IMMUTABLE = { cache: 'force-cache' } as const
const PARALLEL_READS = 8

interface DataRepo {
  slug: string
  token: string
}

function dataRepo(): DataRepo {
  const slug = process.env.RUNOMICS_DATA_REPO_URL?.match(/^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/)?.[1]
  const token = process.env.RUNOMICS_DATA_REPO_TOKEN
  if (!slug || !token) {
    throw new Error('Reading the data from GitHub needs RUNOMICS_DATA_REPO_URL (https://github.com/owner/repo) and RUNOMICS_DATA_REPO_TOKEN')
  }
  return { slug, token }
}

/** Per repository: the Hobby plan shares one Data Cache across projects, and a tag expires everywhere it is used. */
export const dataTag = () => `data:${dataRepo().slug}`

async function github(path: string, accept: string, caching: Pick<RequestInit, 'cache' | 'next'>): Promise<Response> {
  const { slug, token } = dataRepo()
  const response = await fetch(`${API}/repos/${slug}${path}`, {
    ...caching,
    headers: { accept, authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${path.split('?')[0]}`)
  return response
}

/** Tagged, so the sync's ping expires it and every page rendered from it. */
export async function headCommit(): Promise<string> {
  const response = await github('/commits/HEAD', 'application/vnd.github.sha', {
    next: { tags: [dataTag()], revalidate: POINTER_TTL_SECONDS },
  })
  return (await response.text()).trim()
}

interface TreeEntry {
  path: string
  type: string
  sha: string
}

export async function readSnapshot(commit: string, previous: DataSnapshot | null): Promise<DataSnapshot> {
  const { tree, committer } = (await (await github(`/git/commits/${commit}`, 'application/vnd.github+json', IMMUTABLE)).json()) as {
    tree: { sha: string }
    committer: { date: string }
  }
  const listing = (await (await github(`/git/trees/${tree.sha}?recursive=1`, 'application/vnd.github+json', IMMUTABLE)).json()) as {
    tree: TreeEntry[]
    truncated: boolean
  }
  if (listing.truncated) throw new Error(`GitHub truncated the tree of ${commit}`)

  const known = new Map<string, string>()
  previous?.blobs.forEach((sha, file) => known.set(sha, previous.files.get(file)!))

  const entries = listing.tree.filter((entry) => entry.type === 'blob' && entry.path.startsWith('data/'))
  const files = new Map<string, string>()
  const blobs = new Map<string, string>()
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL_READS, entries.length) }, async () => {
      while (next < entries.length) {
        const entry = entries[next++]!
        const file = entry.path.slice('data/'.length)
        const text = known.get(entry.sha) ?? (await (await github(`/git/blobs/${entry.sha}`, 'application/vnd.github.raw+json', IMMUTABLE)).text())
        files.set(file, text)
        blobs.set(file, entry.sha)
      }
    })
  )

  return { commit, committedAt: committer.date, files, blobs }
}
