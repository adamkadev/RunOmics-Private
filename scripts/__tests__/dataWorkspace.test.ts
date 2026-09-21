import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareData } from '../prepare-data.mjs'
import { assertCompleteDataWorkspace } from '../push_private_data.mjs'

const temporaryRoots: string[] = []

function temporaryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-data-workspace-'))
  temporaryRoots.push(root)
  return root
}

function writeActivityIndex(dataDir: string): void {
  const activities = path.join(dataDir, 'activities')
  fs.mkdirSync(activities, { recursive: true })
  fs.writeFileSync(path.join(activities, 'index.json'), '{"months":[]}\n')
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

describe('prepare-data workspace selection', () => {
  it('leaves an already populated default workspace untouched', () => {
    const root = temporaryRoot()
    const dataDir = path.join(root, 'data')
    writeActivityIndex(dataDir)
    const coaching = path.join(dataDir, 'coaching', 'current_plan.json')
    fs.mkdirSync(path.dirname(coaching), { recursive: true })
    fs.writeFileSync(coaching, '{"revision":9}\n')
    const fetchData = vi.fn()
    const writeDemo = vi.fn()

    const result = prepareData({
      root,
      env: { NODE_ENV: 'test', RUNOMICS_DATA_REPO_URL: 'https://example.test/private.git' },
      fetchData,
      writeDemo,
    })

    expect(result).toEqual({ mode: 'existing', dataDir })
    expect(fetchData).not.toHaveBeenCalled()
    expect(writeDemo).not.toHaveBeenCalled()
    expect(fs.readFileSync(coaching, 'utf-8')).toBe('{"revision":9}\n')
  })

  it('leaves an explicit RUNOMICS_DATA_DIR completely untouched', () => {
    const root = temporaryRoot()
    const external = path.join(root, 'external-data')
    writeActivityIndex(external)
    const coaching = path.join(external, 'coaching', 'current_plan.json')
    fs.mkdirSync(path.dirname(coaching), { recursive: true })
    fs.writeFileSync(coaching, '{"revision":7}\n')
    const fetchData = vi.fn()
    const writeDemo = vi.fn()

    const result = prepareData({
      root: path.join(root, 'app'),
      env: { NODE_ENV: 'test', RUNOMICS_DATA_DIR: external, RUNOMICS_DATA_REPO_URL: 'ignored' },
      fetchData,
      writeDemo,
    })

    expect(result).toEqual({ mode: 'explicit', dataDir: external })
    expect(fetchData).not.toHaveBeenCalled()
    expect(writeDemo).not.toHaveBeenCalled()
    expect(fs.readFileSync(coaching, 'utf-8')).toBe('{"revision":7}\n')
    expect(fs.existsSync(path.join(root, 'app', 'data'))).toBe(false)
  })

  it('fails clearly instead of populating an incomplete explicit workspace', () => {
    const root = temporaryRoot()
    const external = path.join(root, 'missing-data')

    expect(() => prepareData({
      root: path.join(root, 'app'),
      env: { NODE_ENV: 'test', RUNOMICS_DATA_DIR: external },
      fetchData: vi.fn(),
      writeDemo: vi.fn(),
    })).toThrow(/activities\/index\.json is missing/)
    expect(fs.existsSync(external)).toBe(false)
  })

  it('generates demo data only in root data when no source is configured', () => {
    const root = temporaryRoot()
    const writeDemo = vi.fn((dataDir: string) => writeActivityIndex(dataDir))

    const result = prepareData({ root, env: { NODE_ENV: 'test' }, fetchData: vi.fn(), writeDemo })

    expect(result).toEqual({ mode: 'demo', dataDir: path.join(root, 'data') })
    expect(writeDemo).toHaveBeenCalledWith(path.join(root, 'data'))
    expect(fs.existsSync(path.join(root, 'data', 'activities', 'index.json'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'public', 'data'))).toBe(false)
  })

  it('fetches private data into root data when the private source is configured', () => {
    const root = temporaryRoot()
    const fetchData = vi.fn((dataDir: string) => {
      writeActivityIndex(dataDir)
      fs.mkdirSync(path.join(dataDir, 'coaching'), { recursive: true })
      return { commit: 'abc123', url: 'https://example.test/private.git' }
    })

    const result = prepareData({
      root,
      env: { NODE_ENV: 'test', RUNOMICS_DATA_REPO_URL: 'https://example.test/private.git' },
      fetchData,
      writeDemo: vi.fn(),
    })

    expect(result).toEqual({ mode: 'private', dataDir: path.join(root, 'data') })
    expect(fetchData).toHaveBeenCalledWith(path.join(root, 'data'))
    expect(fs.existsSync(path.join(root, 'public', 'data'))).toBe(false)
  })
})

describe('private-data push safety', () => {
  it('rejects an incomplete workspace before replacement', () => {
    const root = temporaryRoot()
    const source = path.join(root, 'source')
    const existing = path.join(root, 'existing')
    fs.mkdirSync(source)
    fs.mkdirSync(existing)

    expect(() => assertCompleteDataWorkspace(source, existing)).toThrow(/activities\/index\.json is missing/)
  })

  it('cannot erase coaching from a previously coached private dataset', () => {
    const root = temporaryRoot()
    const source = path.join(root, 'source')
    const existing = path.join(root, 'existing')
    writeActivityIndex(source)
    fs.mkdirSync(path.join(existing, 'coaching'), { recursive: true })

    expect(() => assertCompleteDataWorkspace(source, existing)).toThrow(/contains data\/coaching but the source does not/)

    fs.mkdirSync(path.join(source, 'coaching'), { recursive: true })
    expect(() => assertCompleteDataWorkspace(source, existing)).not.toThrow()
  })
})
