import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { DATE_SENSITIVE_REVALIDATE_SECONDS, PAGES_USING_DATE_SENSITIVE_REVALIDATE } from '../revalidate'

// Next.js requires each page's `export const revalidate = ...` to be a literal,
// so the shared constant can't be imported into that export - this test is the
// actual single source of truth enforcement instead.
describe('DATE_SENSITIVE_REVALIDATE_SECONDS', () => {
  it.each(PAGES_USING_DATE_SENSITIVE_REVALIDATE)('%s exports the shared revalidate value', (relativePath) => {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8')
    expect(source).toContain(`export const revalidate = ${DATE_SENSITIVE_REVALIDATE_SECONDS}`)
  })
})
