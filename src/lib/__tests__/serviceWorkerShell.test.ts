import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const PUBLIC = join(process.cwd(), 'public')

describe('the service worker shell', () => {
  // One missing file fails cache.addAll and with it the whole install.
  it('pre-caches only files that exist', () => {
    const sw = readFileSync(join(PUBLIC, 'sw.js'), 'utf8')
    const list = sw.match(/const SHELL_URLS = \[([^\]]*)\]/)?.[1]
    expect(list).toBeDefined()
    const files = [...list!.matchAll(/'([^']+)'/g)].map((m) => m[1]!).filter((u) => u !== '/')
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) expect(existsSync(join(PUBLIC, file)), file).toBe(true)
  })
})
