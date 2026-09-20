import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readJsonFile } from '@/infrastructure/readJsonFile'

let root: string

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-readjson-'))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function write(name: string, contents: string): string {
  const filePath = path.join(root, name)
  fs.writeFileSync(filePath, contents, 'utf-8')
  return filePath
}

describe('readJsonFile', () => {
  it('parses a well-formed file', () => {
    const filePath = write('ok.json', JSON.stringify({ days: [1, 2] }))

    expect(readJsonFile(filePath, { days: [] as number[] })).toEqual({ days: [1, 2] })
  })

  it('falls back silently when the file is not there', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // A fresh checkout has no data/ at all, and every optional section of every
    // page is expected to render without one. That is not worth a line of log
    // on every request.
    expect(readJsonFile(path.join(root, 'missing.json'), [])).toEqual([])
    expect(warn).not.toHaveBeenCalled()
  })

  it('falls back LOUDLY when the file exists but does not parse', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // What a sync interrupted mid-write leaves behind.
    const filePath = write('truncated.json', '{"days": [{"date": "2026-09-0')

    expect(readJsonFile(filePath, { days: [] })).toEqual({ days: [] })
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0]?.[0])).toContain('truncated.json')
  })

  it('reports a read that fails for a reason other than absence', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // A directory where a file is expected reads as EISDIR, not ENOENT: the
    // data is not merely missing, the workspace is wrong, and that is worth
    // saying out loud.
    const dirPath = path.join(root, 'shaped-like-a-file.json')
    fs.mkdirSync(dirPath)

    expect(readJsonFile(dirPath, null)).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
  })

  it('hands back the fallback identity, so callers can cache it', () => {
    const fallback: string[] = []

    expect(readJsonFile(path.join(root, 'nope.json'), fallback)).toBe(fallback)
  })
})
