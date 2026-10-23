import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * The worker is its own bundle: a stray import of `@/i18n` or `@/lib/formatters` would pull both locale tables
 * into a script that never shows a word, and React or MapLibre would not even run there.
 */

const SRC = path.resolve(__dirname, '../../..')
const WORKER = path.resolve(__dirname, '../explore.worker.ts')

const FORBIDDEN = [/^@\/i18n(\/|$)/, /^@\/lib\/formatters(\/|$)/, /^react(-dom)?(\/|$)/, /^next(\/|$)/, /^maplibre-gl$/]

/** `import … from '…'` and `export … from '…'`, type-only ones excluded (they vanish in the build). */
const IMPORT = /^\s*(?:import|export)\s+(?!type\s)(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm

function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? path.join(SRC, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : null
  if (!base) return null
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  throw new Error(`Cannot resolve ${spec} from ${path.relative(SRC, from)}`)
}

function walk(entry: string) {
  const files = new Set<string>()
  const specifiers = new Set<string>()
  const stack = [entry]
  while (stack.length > 0) {
    const file = stack.pop()!
    if (files.has(file)) continue
    files.add(file)
    for (const [, spec] of fs.readFileSync(file, 'utf8').matchAll(IMPORT)) {
      specifiers.add(spec!)
      const next = resolve(file, spec!)
      if (next) stack.push(next)
    }
  }
  return { files: [...files].map((f) => path.relative(SRC, f)), specifiers: [...specifiers] }
}

describe('explore.worker imports', () => {
  const graph = walk(WORKER)

  it('reaches the coverage domain', () => {
    expect(graph.files).toContain(path.join('domain', 'explore', 'coverage.ts'))
    expect(graph.files).toContain(path.join('components', 'explore', 'workerCore.ts'))
    expect(graph.specifiers).toContain('@/lib/math')
  })

  it('never reaches the locale tables, the formatters, React or MapLibre', () => {
    const offenders = graph.specifiers.filter((spec) => FORBIDDEN.some((rule) => rule.test(spec)))

    expect(offenders).toEqual([])
  })
})
