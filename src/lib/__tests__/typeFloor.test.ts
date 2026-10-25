import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(full)
    return entry.name.endsWith('.tsx') ? [full] : []
  })
}

const FILES = sources(path.join(process.cwd(), 'src'))

describe('the type-scale floor', () => {
  it('uses text-micro nowhere', () => {
    const offenders = FILES.filter((f) => /\btext-micro\b/.test(fs.readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('sets no text below 11 px outside chart ticks', () => {
    const offenders: string[] = []
    for (const file of FILES) {
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        const small =
          /text-\[(?:[0-9]|10)(?:\.\d+)?px\]/.test(line) ||
          /fontSize:\s*'(?:[0-9]|10)(?:\.\d+)?px'/.test(line) ||
          (/fontSize:\s*(?:[0-9]|10)\b/.test(line) && !/tick|label=\{\{|fontSize: 10,$/.test(line))
        if (small) offenders.push(`${path.relative(process.cwd(), file)}:${i + 1}`)
      })
    }
    expect(offenders).toEqual([])
  })
})
