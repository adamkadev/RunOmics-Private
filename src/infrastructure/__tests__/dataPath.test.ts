import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { dataPath } from '../dataPath'

const original = process.env.RUNOMICS_DATA_DIR

afterEach(() => {
  if (original === undefined) delete process.env.RUNOMICS_DATA_DIR
  else process.env.RUNOMICS_DATA_DIR = original
})

describe('dataPath', () => {
  it('follows a workspace chosen after the module was imported', () => {
    // The CLIs pick the workspace at run time, possibly after a static import loaded this module.
    process.env.RUNOMICS_DATA_DIR = path.join('workspace', 'chosen-late')

    expect(dataPath('coaching')).toBe(path.resolve('workspace', 'chosen-late', 'coaching'))
  })

  it('falls back to ./data when no workspace is configured', () => {
    delete process.env.RUNOMICS_DATA_DIR

    expect(dataPath('activities')).toBe(path.join(process.cwd(), 'data', 'activities'))
  })
})
