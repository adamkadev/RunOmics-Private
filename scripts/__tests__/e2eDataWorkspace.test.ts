import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { E2E_DATA_DIRNAME, E2E_DATA_DIRNAMES, prepareE2eData, VISUAL_DATA_DIRNAMES } from '../prepare-e2e-data.mjs'
import { prepareData } from '../prepare-data.mjs'

const temporaryRoots: string[] = []

function temporaryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-e2e-workspace-'))
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

describe('prepare-e2e-data', () => {
  it('generates the demo dataset into the e2e workspace', () => {
    const root = temporaryRoot()
    const writeDemo = vi.fn((dataDir: string) => writeActivityIndex(dataDir))

    const dataDir = prepareE2eData({ root, writeDemo })

    expect(dataDir).toBe(path.join(root, E2E_DATA_DIRNAME))
    expect(writeDemo).toHaveBeenCalledWith(dataDir)
    expect(fs.existsSync(path.join(dataDir, 'activities', 'index.json'))).toBe(true)
  })

  it('writes the sparse profile into a workspace of its own', () => {
    const root = temporaryRoot()

    const dataDir = prepareE2eData({ root, profile: 'sparse' })

    expect(dataDir).toBe(path.join(root, E2E_DATA_DIRNAMES.sparse))
    expect(JSON.parse(fs.readFileSync(path.join(dataDir, 'athlete.json'), 'utf8')).deviceName).toBe('Forerunner 55')
    expect(fs.existsSync(path.join(root, E2E_DATA_DIRNAME))).toBe(false)
  })

  it('keeps the visual suite’s workspace apart from the e2e one', () => {
    const root = temporaryRoot()

    const dataDir = prepareE2eData({ root, profile: 'sparse', suite: 'visual', writeDemo: (dir: string) => writeActivityIndex(dir) })

    expect(dataDir).toBe(path.join(root, VISUAL_DATA_DIRNAMES.sparse))
    expect(fs.existsSync(path.join(root, E2E_DATA_DIRNAMES.sparse))).toBe(false)
  })

  it('resets stale state from a previous run', () => {
    const root = temporaryRoot()
    const dataDir = path.join(root, E2E_DATA_DIRNAME)
    writeActivityIndex(dataDir)
    fs.writeFileSync(path.join(dataDir, 'left-over.json'), '{}\n')

    prepareE2eData({ root, writeDemo: (dir: string) => writeActivityIndex(dir) })

    expect(fs.existsSync(path.join(dataDir, 'left-over.json'))).toBe(false)
    expect(fs.existsSync(path.join(dataDir, 'activities', 'index.json'))).toBe(true)
  })

  it('never touches the repository data workspace or a configured one', () => {
    const root = temporaryRoot()
    const realData = path.join(root, 'data')
    writeActivityIndex(realData)
    const external = path.join(root, 'runomics-data-adam')
    writeActivityIndex(external)

    prepareE2eData({ root, writeDemo: (dir: string) => writeActivityIndex(dir) })

    expect(fs.existsSync(path.join(realData, 'activities', 'index.json'))).toBe(true)
    expect(fs.existsSync(path.join(external, 'activities', 'index.json'))).toBe(true)
  })

  it('hands prepare-data a workspace it accepts as explicit and leaves alone', () => {
    const root = temporaryRoot()
    const dataDir = prepareE2eData({ root, writeDemo: (dir: string) => writeActivityIndex(dir) })
    const fetchData = vi.fn()
    const writeDemo = vi.fn()

    const result = prepareData({
      root,
      env: { NODE_ENV: 'test', RUNOMICS_DATA_DIR: dataDir },
      fetchData,
      writeDemo,
    })

    expect(result).toEqual({ mode: 'explicit', dataDir })
    expect(fetchData).not.toHaveBeenCalled()
    expect(writeDemo).not.toHaveBeenCalled()
  })
})
