import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispatchBody, readSyncGate, syncConfig } from '../route'

const CONFIGURED = {
  GITHUB_SYNC_TOKEN: 'ghp_test',
  GITHUB_SYNC_REPO: 'adamkadev/RunOmics-Private',
} as unknown as NodeJS.ProcessEnv

function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return { ...CONFIGURED, ...overrides } as NodeJS.ProcessEnv
}

describe('syncConfig', () => {
  it('names every missing setting at once, so one deploy fixes the button', () => {
    expect(syncConfig({} as NodeJS.ProcessEnv)).toEqual({
      missing: ['GITHUB_SYNC_TOKEN', 'GITHUB_SYNC_REPO'],
    })
    expect(syncConfig(env({ GITHUB_SYNC_TOKEN: undefined }))).toEqual({
      missing: ['GITHUB_SYNC_TOKEN'],
    })
  })

  it('defaults to the workflow file and branch the sync actually lives on', () => {
    expect(syncConfig(env())).toEqual({
      repo: 'adamkadev/RunOmics-Private',
      workflow: 'sync.yml',
      ref: 'main',
      token: 'ghp_test',
      profile: null,
    })
  })

  it('carries a profile so one athlete’s deployment syncs one athlete', () => {
    expect(syncConfig(env({ GITHUB_SYNC_PROFILE: 'adam' }))).toMatchObject({ profile: 'adam' })
  })

  it('treats an empty override as unset rather than as an empty workflow name', () => {
    const config = syncConfig(env({ GITHUB_SYNC_WORKFLOW: '', GITHUB_SYNC_REF: '', GITHUB_SYNC_PROFILE: '' }))
    expect(config).toMatchObject({ workflow: 'sync.yml', ref: 'main', profile: null })
  })
})

describe('dispatchBody', () => {
  it('asks for a quick sync, of the deployment’s profile when it has one', () => {
    const config = { repo: 'adamkadev/RunOmics-Private', workflow: 'sync.yml', ref: 'main', token: 'ghp_test', profile: 'adam' }
    expect(dispatchBody(config)).toEqual({ ref: 'main', inputs: { quick: 'true', profile: 'adam' } })
    expect(dispatchBody({ ...config, profile: null })).toEqual({ ref: 'main', inputs: { quick: 'true' } })
  })
})

describe('readSyncGate', () => {
  const config = { repo: 'adamkadev/RunOmics-Private', workflow: 'sync.yml', ref: 'main', token: 'ghp_test', profile: 'adam' }
  const NOW = Date.parse('2026-10-07T12:00:00Z')

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("asks for the last day's runs of the sync workflow, with the server's token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ workflow_runs: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    expect(await readSyncGate(config, NOW)).toEqual({ kind: 'open' })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(`https://api.github.com/repos/adamkadev/RunOmics-Private/actions/workflows/sync.yml/runs?per_page=50&created=${encodeURIComponent('>=2026-10-06T12:00:00Z')}`)
    expect(init.headers.authorization).toBe('Bearer ghp_test')
  })

  it('reads a run going as running', async () => {
    const run = { status: 'in_progress', conclusion: null, event: 'workflow_dispatch', created_at: '2026-10-07T11:58:00Z', updated_at: '2026-10-07T11:59:00Z', display_title: 'Sync Garmin Activities (adam)' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ workflow_runs: [run] }) }))
    expect(await readSyncGate(config, NOW)).toEqual({ kind: 'running', since: '2026-10-07T11:58:00Z' })
  })

  // The workflow's per-profile concurrency still keeps two runs from overlapping.
  it('lets the sync through when the runs cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }))
    expect(await readSyncGate(config, NOW)).toEqual({ kind: 'open' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await readSyncGate(config, NOW)).toEqual({ kind: 'open' })
  })
})
