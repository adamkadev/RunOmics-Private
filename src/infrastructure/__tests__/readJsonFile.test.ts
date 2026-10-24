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

    // A fresh checkout has no data/ at all, and every page renders without it.
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

  it('warns when the path is a directory - EISDIR, not a missing file', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const directoryWhereAFileIsExpected = path.join(root, 'shaped-like-a-file.json')
    fs.mkdirSync(directoryWhereAFileIsExpected)

    expect(readJsonFile(directoryWhereAFileIsExpected, null)).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
  })

  it('hands back the fallback identity, so callers can cache it', () => {
    const fallback: string[] = []

    expect(readJsonFile(path.join(root, 'nope.json'), fallback)).toBe(fallback)
  })

  it('falls back when the file is valid JSON but not an object', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(readJsonFile(write('null.json', 'null'), { years: [] })).toEqual({ years: [] })
    expect(readJsonFile(write('scalar.json', '42'), null)).toBeNull()
    expect(readJsonFile(write('string.json', '"nope"'), null)).toBeNull()
    expect(readJsonFile(write('array.json', '[1, 2]'), null)).toBeNull()
    expect(warn).toHaveBeenCalledTimes(4)
  })
})
