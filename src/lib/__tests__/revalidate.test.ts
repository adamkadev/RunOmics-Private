import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { DATE_SENSITIVE_PAGE_REVALIDATE_SECONDS, PAGE_PATHS_REQUIRING_DATE_SENSITIVE_REVALIDATE } from '../revalidate'

describe('DATE_SENSITIVE_PAGE_REVALIDATE_SECONDS', () => {
  it.each(PAGE_PATHS_REQUIRING_DATE_SENSITIVE_REVALIDATE)('%s exports the shared revalidate value', (relativePath) => {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8')
    expect(source).toContain(`export const revalidate = ${DATE_SENSITIVE_PAGE_REVALIDATE_SECONDS}`)
  })
})
