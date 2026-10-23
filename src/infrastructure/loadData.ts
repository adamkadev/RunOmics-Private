import 'server-only'
import { checkDataDirectory } from './contracts/dataContract'
import { dataFs, liveSnapshot, swapSnapshot, withSnapshot } from './dataFs'
import { readsFromGitHub } from './dataSource'
import { dataPath } from './dataPath'
import { headCommit, readSnapshot } from './githubData'

export interface RejectedData {
  commit: string
  errors: string[]
}

let pending: { commit: string; done: Promise<void> } | null = null
let rejected: RejectedData | null = null

export const rejectedData = () => rejected

/** Every page and route that reads data awaits this first; with the data on disk there is nothing to do. */
export async function loadData(): Promise<void> {
  if (!readsFromGitHub()) return
  try {
    const commit = await headCommit()
    if (liveSnapshot()?.commit === commit || rejected?.commit === commit) return
    if (pending?.commit !== commit) pending = { commit, done: adopt(commit) }
    await pending.done
  } catch (error) {
    if (!liveSnapshot()) throw error
    console.error('[data] GitHub unreachable; still serving the commit already loaded:', error)
  }
}

async function adopt(commit: string) {
  try {
    const live = liveSnapshot()
    const candidate = await readSnapshot(commit, live)
    // No build stands between a push and the site, so a dataset that would crash a page is refused here.
    const errors = withSnapshot(candidate, () => checkDataDirectory(dataPath(), dataFs))
      .filter((problem) => problem.severity === 'error')
      .map((problem) => `${problem.file} ${problem.path}: ${problem.message}`)
    if (errors.length) {
      rejected = { commit, errors }
      console.error(`[data] refused ${commit}: ${errors.length} error(s), first: ${errors[0]}`)
      return
    }
    // Two loads can finish out of order; the older commit never replaces a newer one.
    if (!live || candidate.committedAt >= live.committedAt) {
      swapSnapshot(candidate)
      rejected = null
    }
  } finally {
    if (pending?.commit === commit) pending = null
  }
}
