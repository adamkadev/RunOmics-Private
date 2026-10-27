import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { findCycles, importGraph, pagesWithoutRevalidate } from '../importCycles'

describe('findCycles', () => {
  it('finds a ring of any length, and nothing in a tree', () => {
    const graph = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', ['a', 'd']],
      ['d', []],
    ])
    expect(findCycles(graph)).toEqual([['a', 'b', 'c']])
    expect(findCycles(new Map([['a', ['b', 'c']], ['b', ['c']], ['c', []]]))).toEqual([])
  })

  it('reports a module that imports itself', () => {
    expect(findCycles(new Map([['a', ['a']]]))).toEqual([['a']])
  })
})

describe('importGraph', () => {
  let root: string | undefined

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
  })

  function workspace(files: Record<string, string>): string {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'import-cycles-'))
    fs.writeFileSync(
      path.join(root, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { moduleResolution: 'bundler', module: 'esnext', paths: { '@/*': ['./src/*'] } } })
    )
    for (const [name, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
      fs.writeFileSync(path.join(root, name), text)
    }
    return root
  }

  it('follows the @/ alias and relative paths alike', () => {
    const dir = workspace({
      'src/a.ts': "import { b } from '@/b'\nexport const a = b",
      'src/b.ts': "import { a } from './a'\nexport const b = 1; export const c = () => a",
    })
    expect(findCycles(importGraph(dir))).toEqual([['src/a.ts', 'src/b.ts']])
  })

  it('leaves out imports that are erased before anything runs, and dynamic ones', () => {
    const dir = workspace({
      'src/a.ts': "import type { B } from './b'\nimport { type C } from './c'\nexport type A = B | C",
      'src/b.ts': "import type { A } from './a'\nexport type B = { a?: A }",
      'src/c.ts': "export { type A } from './a'\nexport const load = () => import('./a')\nexport type C = number",
    })
    expect(findCycles(importGraph(dir))).toEqual([])
  })

  it('leaves out tests', () => {
    const dir = workspace({
      'src/a.ts': 'export const a = 1',
      'src/__tests__/a.test.ts': "import { a } from '../a'",
    })
    expect([...importGraph(dir).keys()]).toEqual(['src/a.ts'])
  })

  it('reports a page that awaits loadData() without exporting revalidate', () => {
    const dir = workspace({
      'src/app/page.tsx': 'export const revalidate = 3600\nexport default async function Page() { await loadData() }',
      'src/app/settings/page.tsx': 'export default async function Page() { await loadData() }',
      'src/app/about/page.tsx': 'export default function Page() { return null }',
    })
    expect(pagesWithoutRevalidate(importGraph(dir), dir)).toEqual(['src/app/settings/page.tsx'])
  })
})
