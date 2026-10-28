import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../..')

const DOCS = [
  'README.md',
  ...fs
    .readdirSync(path.join(ROOT, 'docs'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `docs/${name}`),
]

const CODE_ROOTS = ['src', 'scripts', 'e2e', 'screenshots', '.github', 'public/sw.js', 'firestore.rules', '.env.example', '.env.e2e']
const CODE_FILE = /\.(?:ts|tsx|mts|mjs|js|py|ya?ml|json|css|rules)$|^\.env\./

const ALLOWED = new Set(['wClimb', 'public/data'])

function codeFiles(relative: string): string[] {
  const full = path.join(ROOT, relative)
  if (!fs.existsSync(full)) return []
  if (fs.statSync(full).isFile()) return [relative]
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) =>
    entry.name === 'node_modules' || entry.name === '__pycache__' ? [] : codeFiles(path.join(relative, entry.name)),
  )
}

const code = [...CODE_ROOTS, ...fs.readdirSync(ROOT).filter((name) => /\.(?:ts|mjs|json)$/.test(name))]
  .flatMap(codeFiles)
  .filter((file) => CODE_FILE.test(path.basename(file)))
  .map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8'))
  .join('\n')

const looksLikeCode = (word: string) =>
  /[a-z][A-Z]/.test(word) || /^[A-Z][a-z0-9]+[A-Z]/.test(word) || /^[A-Z][A-Z0-9]*_[A-Z0-9_]+$/.test(word)
const repoPath = /^(?:src|scripts|docs|e2e|public|fixtures|screenshots|\.github)\/[\w./[\]-]+$/

function backticked(doc: string): string[] {
  const text = fs.readFileSync(path.join(ROOT, doc), 'utf8').replace(/```[\s\S]*?```/g, '')
  return [...text.matchAll(/`([^`\n]+)`/g)].map((match) => match[1]!.replace(/\(\)$/, ''))
}

describe.each(DOCS)('%s', (doc) => {
  it('names only identifiers the code still has', () => {
    const stale = backticked(doc).filter(
      (word) =>
        /^[A-Za-z_$][\w$]*$/.test(word) &&
        looksLikeCode(word) &&
        !ALLOWED.has(word) &&
        !new RegExp(`\\b${word.replace(/\$/g, '\\$')}\\b`).test(code),
    )
    expect([...new Set(stale)]).toEqual([])
  })

  it('names only files and folders the repository still has', () => {
    const stale = backticked(doc).filter(
      (word) => repoPath.test(word) && !/[*<{]/.test(word) && !ALLOWED.has(word) && !fs.existsSync(path.join(ROOT, word.replace(/:\d+$/, ''))),
    )
    expect([...new Set(stale)]).toEqual([])
  })
})
