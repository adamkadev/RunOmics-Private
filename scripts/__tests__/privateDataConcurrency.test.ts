import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fetchPrivateData } from '../fetch_private_data.mjs'
import { assertBaseRevisionCurrent, pushPrivateData } from '../push_private_data.mjs'
import { baseRevisionPath, readBaseRevision, sameRepository } from '../private_data_revision.mjs'

const temporaryRoots: string[] = []
const IDENTITY = ['-c', 'user.name=test', '-c', 'user.email=test@example.test']

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', [...IDENTITY, '-C', cwd, ...args], { stdio: 'pipe' }).toString().trim()
}

function temporaryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-concurrency-'))
  temporaryRoots.push(root)
  return root
}

const env = (vars: Record<string, string> = {}): NodeJS.ProcessEnv => ({ NODE_ENV: 'test', ...vars })

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

interface Remote {
  url: string
  bare: string
  other: string
}

function createRemote(root: string): Remote {
  const bare = path.join(root, 'remote.git')
  execFileSync('git', ['init', '--bare', '-b', 'main', bare], { stdio: 'pipe' })
  const url = `file://${bare}`

  const other = path.join(root, 'other')
  execFileSync('git', ['clone', url, other], { stdio: 'pipe' })
  write(path.join(other, 'data', 'activities', 'index.json'), '{"months":[]}\n')
  write(path.join(other, 'data', 'coaching', 'current_plan.json'), '{"revision":1}\n')
  git(other, 'add', '-A')
  git(other, 'commit', '-m', 'seed')
  git(other, 'push', '-u', 'origin', 'main')

  return { url, bare, other }
}

function commitToRemote(remote: Remote, file: string, content: string, message: string): string {
  git(remote.other, 'pull', '--ff-only')
  write(path.join(remote.other, file), content)
  git(remote.other, 'add', '-A')
  git(remote.other, 'commit', '-m', message)
  git(remote.other, 'push')
  return git(remote.other, 'rev-parse', 'HEAD')
}

function remoteHead(remote: Remote): string {
  return git(remote.bare, 'rev-parse', 'main')
}

function remoteFile(remote: Remote, file: string): string {
  return execFileSync('git', ['-C', remote.bare, 'show', `main:${file}`], { stdio: 'pipe' }).toString()
}

function remoteFiles(remote: Remote): string[] {
  return git(remote.bare, 'ls-tree', '-r', '--name-only', 'main').split('\n').filter(Boolean)
}

const savedEnv = { ...process.env }

beforeEach(() => {
  delete process.env.RUNOMICS_DATA_BASE_REVISION
  delete process.env.RUNOMICS_DATA_REPO_TOKEN
})

afterEach(() => {
  process.env = { ...savedEnv }
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

describe('private data optimistic concurrency', { timeout: 20_000 }, () => {
  it('refuses to push a workspace whose base commit is no longer the remote head, and preserves the concurrent commit once re-fetched', () => {
    const root = temporaryRoot()
    const remote = createRemote(root)
    process.env.RUNOMICS_DATA_REPO_URL = remote.url
    const workspace = path.join(root, 'workspace', 'data')

    const fetched = fetchPrivateData(workspace)
    expect(fetched.commit).toBe(remoteHead(remote))

    const mapping = '{"workouts":{"2026-09-07":{"garminId":123}}}\n'
    const commitB = commitToRemote(remote, 'data/coaching/garmin-sync.json', mapping, 'Persist Garmin coaching sync state')
    expect(commitB).not.toBe(fetched.commit)

    write(path.join(workspace, 'sync_meta.json'), '{"lastSyncedAt":"2026-09-06T02:00:00Z"}\n')
    expect(fs.existsSync(path.join(workspace, 'coaching', 'garmin-sync.json'))).toBe(false)

    expect(() => pushPrivateData(workspace)).toThrow(/Private data changed since this workspace was fetched/)
    expect(() => pushPrivateData(workspace)).toThrow(
      new RegExp(`Expected base: ${fetched.commit}[\\s\\S]*Current remote: ${commitB}`)
    )
    expect(() => pushPrivateData(workspace)).toThrow(/Refusing to overwrite newer data/)

    expect(remoteHead(remote)).toBe(commitB)
    expect(remoteFile(remote, 'data/coaching/garmin-sync.json')).toBe(mapping)
    expect(remoteFiles(remote)).not.toContain('data/sync_meta.json')
    expect(readBaseRevision(workspace)?.commit).toBe(fetched.commit)

    fetchPrivateData(workspace)
    write(path.join(workspace, 'sync_meta.json'), '{"lastSyncedAt":"2026-09-06T02:00:00Z"}\n')
    expect(pushPrivateData(workspace).pushed).toBe(true)

    expect(remoteFile(remote, 'data/coaching/garmin-sync.json')).toBe(mapping)
    expect(remoteFile(remote, 'data/sync_meta.json')).toContain('2026-09-06T02:00:00Z')
  })

  it('protects the whole dataset, not just the file that was lost once', () => {
    const root = temporaryRoot()
    const remote = createRemote(root)
    process.env.RUNOMICS_DATA_REPO_URL = remote.url
    const workspace = path.join(root, 'workspace', 'data')

    fetchPrivateData(workspace)
    for (const [file, content] of [
      ['data/coaching/coach_state.json', '{"state":"active"}\n'],
      ['data/coaching/decisions/2026-09-05.json', '{"outcome":"adjust"}\n'],
      ['data/races/upcoming.json', '{"races":[{"id":"r1"}]}\n'],
    ] as const) {
      commitToRemote(remote, file, content, `add ${file}`)
    }
    const head = remoteHead(remote)

    expect(() => pushPrivateData(workspace)).toThrow(/Refusing to overwrite newer data/)

    expect(remoteHead(remote)).toBe(head)
    expect(remoteFile(remote, 'data/coaching/coach_state.json')).toBe('{"state":"active"}\n')
    expect(remoteFile(remote, 'data/coaching/decisions/2026-09-05.json')).toBe('{"outcome":"adjust"}\n')
    expect(remoteFile(remote, 'data/races/upcoming.json')).toBe('{"races":[{"id":"r1"}]}\n')
  })

  it('keeps the base revision out of the athlete dataset, refuses to push to a repository it was not fetched from, and pushes normally while the remote is still on the fetched base', () => {
    const root = temporaryRoot()
    const remote = createRemote(root)
    process.env.RUNOMICS_DATA_REPO_URL = remote.url
    const workspace = path.join(root, 'workspace', 'data')

    const fetched = fetchPrivateData(workspace)

    expect(baseRevisionPath(workspace)).toBe(path.join(root, 'workspace', '.data.base-revision.json'))
    expect(fs.existsSync(baseRevisionPath(workspace))).toBe(true)
    const inside = fs.readdirSync(workspace).filter((entry) => entry.includes('base-revision'))
    expect(inside).toEqual([])

    expect(() => assertBaseRevisionCurrent(workspace, fetched.commit, 'https://example.test/other.git', env())).toThrow(
      /different private data repository/
    )
    expect(() => assertBaseRevisionCurrent(workspace, fetched.commit, `${remote.url}/`, env())).not.toThrow()

    write(path.join(workspace, 'coaching', 'current_plan.json'), '{"revision":2}\n')

    const result = pushPrivateData(workspace)

    expect(result.pushed).toBe(true)
    expect(remoteHead(remote)).not.toBe(fetched.commit)
    expect(remoteFile(remote, 'data/coaching/current_plan.json')).toBe('{"revision":2}\n')
    expect(readBaseRevision(workspace)?.commit).toBe(remoteHead(remote))
    expect(remoteFiles(remote).filter((file) => file.includes('base-revision'))).toEqual([])
  })
})

describe('assertBaseRevisionCurrent', () => {
  it('refuses a workspace with no recorded base rather than guessing', () => {
    const root = temporaryRoot()
    const workspace = path.join(root, 'data')
    fs.mkdirSync(workspace, { recursive: true })

    expect(() => assertBaseRevisionCurrent(workspace, 'abc123', 'https://example.test/private.git', env())).toThrow(
      /No base revision recorded/
    )
  })

  it('accepts an explicitly supplied base revision', () => {
    const root = temporaryRoot()
    const workspace = path.join(root, 'data')
    fs.mkdirSync(workspace, { recursive: true })

    expect(() =>
      assertBaseRevisionCurrent(workspace, 'abc123', 'https://example.test/private.git', env({ RUNOMICS_DATA_BASE_REVISION: 'abc123' }))
    ).not.toThrow()
  })

  it('treats cosmetic URL differences as the same repository', () => {
    expect(sameRepository('https://example.test/private.git', 'https://example.test/private')).toBe(true)
    expect(sameRepository('https://example.test/private/', 'https://example.test/private.git')).toBe(true)
    expect(sameRepository('https://example.test/private', 'https://example.test/other')).toBe(false)
  })
})
