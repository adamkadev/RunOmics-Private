import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(process.cwd(), 'src')
const CALL = /formatPace(Range)?\(/g
// `formatPace()` already ends with `/km`, so a unit right after the call duplicates it.
const TRAILING_UNIT = /^\}?\s*(\/km|\$?\{\s*t\.units\.(perKm|minPerKm))/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

function endOfCall(source: string, openParen: number): number {
  let depth = 0
  for (let i = openParen; i < source.length; i++) {
    if (source[i] === '(') depth++
    if (source[i] === ')' && --depth === 0) return i + 1
  }
  return source.length
}

function duplicatedUnits(source: string): string[] {
  return [...source.matchAll(CALL)]
    .map((match) => source.slice(endOfCall(source, match.index + match[0].length - 1), match.index + 200))
    .filter((after) => TRAILING_UNIT.test(after))
    .map((after) => after.split('\n')[0] ?? after)
}

describe('pace unit duplication', () => {
  it('never appends a /km unit to a formatPace result', () => {
    const offenders = sourceFiles(SRC).flatMap((file) =>
      duplicatedUnits(readFileSync(file, 'utf8')).map((snippet) => `${relative(SRC, file)}: ${snippet}`),
    )

    expect(offenders).toEqual([])
  })
})
