import 'server-only'
import path from 'path'
import { dataPath } from './dataPath'
import { diskFiles, type DataFiles } from './dataFiles'
import { readsFromGitHub } from './dataSource'

export interface DataSnapshot {
  commit: string
  committedAt: string
  /** Path under the data directory, `/`-separated → the file's text. */
  files: ReadonlyMap<string, string>
  /** Same paths → git blob SHA, so the next commit re-reads only what changed. */
  blobs: ReadonlyMap<string, string>
}

export class DataNotLoadedError extends Error {}

let live: DataSnapshot | null = null
let checking: DataSnapshot | null = null

export const liveSnapshot = () => live

/** By blob SHA, so the check before a commit goes live and the repositories after it share one parse. */
let parsed = new Map<string, unknown>()

export function swapSnapshot(next: DataSnapshot) {
  live = next
  const kept = new Set(next.blobs.values())
  parsed = new Map([...parsed].filter(([sha]) => kept.has(sha)))
}

/** What module caches key on: the live commit, or the directory, which the CLIs choose at run time. */
export const dataGeneration = (): string => live?.commit ?? dataPath()

/** Checks run synchronously, so a candidate can stand in for the live snapshot without another request seeing it. */
export function withSnapshot<T>(snapshot: DataSnapshot, check: () => T): T {
  checking = snapshot
  try {
    return check()
  } finally {
    checking = null
  }
}

const views = new WeakMap<DataSnapshot, DataFiles>()

function source(): DataFiles {
  const snapshot = checking ?? live
  if (snapshot) {
    let view = views.get(snapshot)
    if (!view) views.set(snapshot, (view = snapshotView(snapshot)))
    return view
  }
  // Never the copy bundled at build: an older snapshot would overwrite good pages and resend the new-run pushes.
  if (readsFromGitHub()) throw new DataNotLoadedError('Data read before loadData(): no commit of the data repository is loaded')
  return diskFiles
}

export const dataFs: DataFiles = {
  readFileSync: (file, encoding) => source().readFileSync(file, encoding),
  existsSync: (file) => source().existsSync(file),
  readdirSync: (dir) => source().readdirSync(dir),
  readJsonSync: (file) => source().readJsonSync(file),
  blobSha: (file) => source().blobSha(file),
}

const absent = (message: string) => Object.assign(new Error(message), { code: 'ENOENT' })

function snapshotView({ files, blobs }: DataSnapshot): DataFiles {
  const dirs = new Map<string, Set<string>>()
  for (const file of files.keys()) {
    const parts = file.split('/')
    parts.forEach((name, depth) => {
      const dir = parts.slice(0, depth).join('/')
      dirs.set(dir, (dirs.get(dir) ?? new Set()).add(name))
    })
  }

  const relative = (file: string) => {
    const rel = path.relative(dataPath(), file).split(path.sep).join('/')
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`${file} is outside the data directory`)
    return rel
  }

  const readFileSync = (file: string) => {
    const text = files.get(relative(file))
    if (text === undefined) throw absent(`ENOENT: not in the data snapshot, open '${file}'`)
    return text
  }

  return {
    readFileSync,
    readJsonSync(file) {
      const sha = blobs.get(relative(file))
      if (sha === undefined) return JSON.parse(readFileSync(file))
      if (!parsed.has(sha)) parsed.set(sha, JSON.parse(readFileSync(file)))
      return parsed.get(sha)
    },
    blobSha: (file) => blobs.get(relative(file)),
    existsSync: (file) => {
      const rel = relative(file)
      return files.has(rel) || dirs.has(rel)
    },
    readdirSync(dir) {
      const names = dirs.get(relative(dir))
      if (!names) throw absent(`ENOENT: not in the data snapshot, scandir '${dir}'`)
      return [...names].sort()
    },
  }
}
