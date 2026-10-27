import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isPublicPath } from '@/lib/siteAccess'

const API_DIR = join(process.cwd(), 'src/app/api')
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

const GATE_ONLY = new Set([
  'GET /api/activities/[id]/note',
  'POST /api/client-errors',
  'GET /api/coaching/words',
  'GET /api/explore/areas/[id]',
  'POST /api/explore/route',
  'GET /api/location-override',
  'GET /api/map/routes',
  'GET /api/map/shell',
  'POST /api/session',
  'DELETE /api/session',
  'GET /api/version',
])

const SIGN_IN_ROUTES = new Set(['/api/session'])

interface Handler {
  method: string
  path: string
  body: string
}

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : routeFiles(path)
    return entry.name === 'route.ts' ? [path] : []
  })
}

function urlPath(file: string): string {
  return `/api/${relative(API_DIR, file).split(sep).slice(0, -1).join('/')}`
}

function handlers(file: string): Handler[] {
  const source = readFileSync(file, 'utf8')
  const path = urlPath(file)
  const chunks = source.split(/^(?=export )/m)
  return chunks.flatMap((chunk) => {
    const fn = chunk.match(/^export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b/)
    if (fn) return [{ method: fn[1]!, path, body: chunk }]
    const destructured = chunk.match(/^export const \{([^}]+)\} = (\w+)\(/)
    if (destructured) {
      return destructured[1]!.split(',').map((name) => ({ method: name.trim(), path, body: `${destructured[2]}(` }))
    }
    return []
  })
}

function exportedMethodCount(file: string): number {
  const source = readFileSync(file, 'utf8')
  const named = source.match(new RegExp(`^export (?:async )?(?:function|const) (?:${METHODS.join('|')})\\b`, 'gm')) ?? []
  const destructured = [...source.matchAll(/^export const \{([^}]+)\}/gm)].flatMap((match) => match[1]!.split(',').map((name) => name.trim()))
  return named.length + destructured.filter((name) => (METHODS as readonly string[]).includes(name)).length
}

const FILES = routeFiles(API_DIR)
const HANDLERS = FILES.flatMap(handlers)
const key = (handler: Handler) => `${handler.method} ${handler.path}`
const isOwnerGuarded = (handler: Handler) => /\brequireOwner\(req\)|\bhandleOwnerRoute\(/.test(handler.body)

describe('API route inventory', () => {
  it('finds every route handler it audits', () => {
    expect(FILES.length).toBeGreaterThan(20)
    for (const file of FILES) expect(handlers(file).length, relative(process.cwd(), file)).toBe(exportedMethodCount(file))
  })

  it('sends every /api/internal handler through handleInternalRoute or scheduledRoute', () => {
    const unguarded = HANDLERS.filter((handler) => handler.path.startsWith('/api/internal/'))
      .filter((handler) => !/\breturn handleInternalRoute\(|^scheduledRoute\($/.test(handler.body))
      .map(key)

    expect(unguarded).toEqual([])
  })

  it('puts every other handler behind the owner guard, or on the gate-only list', () => {
    const unguarded = HANDLERS.filter((handler) => !handler.path.startsWith('/api/internal/'))
      .filter((handler) => !isOwnerGuarded(handler) && !GATE_ONLY.has(key(handler)))
      .map(key)

    expect(unguarded).toEqual([])
  })

  it('lists no gate-only handler that is gone or has an owner guard of its own', () => {
    const live = new Map(HANDLERS.map((handler) => [key(handler), handler]))
    const stale = [...GATE_ONLY].filter((entry) => !live.has(entry) || isOwnerGuarded(live.get(entry)!))

    expect(stale).toEqual([])
  })

  it('keeps every gate-only handler behind the private site gate, the sign-in route aside', () => {
    const open = [...GATE_ONLY].map((entry) => entry.split(' ')[1]!).filter((path) => !SIGN_IN_ROUTES.has(path) && isPublicPath(path))

    expect(open).toEqual([])
  })
})

describe('vercel.json crons', () => {
  const crons = (JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as { crons: { path: string }[] }).crons

  it.each(crons.map((cron) => cron.path))('%s exports GET through scheduledRoute', (path) => {
    const source = readFileSync(join(process.cwd(), 'src/app', path, 'route.ts'), 'utf8')

    expect(source).toMatch(/^export const \{[^}]*\bGET\b[^}]*\} = scheduledRoute\(/m)
  })
})
