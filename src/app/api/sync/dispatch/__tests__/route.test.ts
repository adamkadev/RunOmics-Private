import { describe, expect, it } from 'vitest'
import { syncConfig } from '../route'

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
