import 'server-only'
import { checkDataDirectory } from './contracts/dataContract'
import { DataNotLoadedError, dataFs, liveSnapshot, swapSnapshot, withSnapshot } from './dataFs'
import { readsFromGitHub } from './dataSource'
import { dataPath } from './dataPath'
import { headCommit, readSnapshot } from './githubData'

export interface RejectedData {
  commit: string
  errors: string[]
}

let latestHead: string | null = null
let pending: { commit: string; done: Promise<void> } | null = null
let rejected: RejectedData | null = null

export const rejectedData = () => rejected

/** Every page and route that reads data awaits this first; with the data on disk there is nothing to do. */
export async function loadData(): Promise<void> {
  if (!readsFromGitHub()) return
  try {
    const commit = await headCommit()
    latestHead = commit
    if (liveSnapshot()?.commit !== commit && rejected?.commit !== commit) {
      if (pending?.commit !== commit) pending = { commit, done: adopt(commit) }
      await pending.done
    }
  } catch (error) {
    if (!liveSnapshot()) throw error
    console.error('[data] could not load the HEAD commit; still serving the one already loaded:', error)
  }
  if (!liveSnapshot()) {
    throw new DataNotLoadedError(`The data repository's HEAD ${rejected?.commit} was refused: ${rejected?.errors[0]}`)
  }
}

async function adopt(commit: string) {
  try {
    const candidate = await readSnapshot(commit, liveSnapshot())
    // No build stands between a push and the site, so a dataset that would crash a page is refused here.
    const errors = withSnapshot(candidate, () => checkDataDirectory(dataPath(), dataFs))
      .filter((problem) => problem.severity === 'error')
      .map((problem) => `${problem.file} ${problem.path}: ${problem.message}`)
    if (errors.length) {
      rejected = { commit, errors }
      console.error(`[data] refused ${commit}: ${errors.length} error(s), first: ${errors[0]}`)
      return
    }
    // Only the newest HEAD read goes live: a slower load never wins, and a rollback of the repository does.
    if (commit === latestHead) {
      swapSnapshot(candidate)
      rejected = null
    }
  } finally {
    if (pending?.commit === commit) pending = null
  }
}
