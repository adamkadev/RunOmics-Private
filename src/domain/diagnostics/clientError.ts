export const CLIENT_ERROR_SOURCES = ['error', 'rejection', 'route', 'route-fetch', 'worker'] as const
export type ClientErrorSource = (typeof CLIENT_ERROR_SOURCES)[number]

export interface ClientErrorReport {
  /** ISO time, the server's. */
  at: string
  source: ClientErrorSource
  message: string
  /** The path alone: a query can carry a quartier or a distance, never needed to read an error. */
  page: string
  /** The commit the page runs: an app left open across a deploy keeps the old one. */
  build: string
  /** "iOS 26.1 · Safari PWA". */
  device: string
}

/** Errors newer than the last one announced; with none announced yet, the first check only takes note. */
export function errorsSince(reports: readonly ClientErrorReport[], lastAt: string | null): ClientErrorReport[] {
  return lastAt === null ? [] : reports.filter((report) => report.at > lastAt)
}

const MAX_MESSAGE = 300
const MAX_FIELD = 80

/** Decimals that could be a coordinate are cut: a stack or an error message can quote where a run started. */
export function scrubText(text: string, max = MAX_MESSAGE): string {
  return text.replace(/-?\d+\.\d{3,}/g, '#').replace(/\s+/g, ' ').trim().slice(0, max)
}

const text = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

export function parseClientError(body: unknown, at: Date): ClientErrorReport | null {
  if (typeof body !== 'object' || body === null) return null
  const { source, message, page, build, device } = body as Record<string, unknown>
  if (!(CLIENT_ERROR_SOURCES as readonly unknown[]).includes(source) || !text(message)) return null
  const path = text(page) ? page.split(/[?#]/)[0]! : '/'
  return {
    at: at.toISOString(),
    source: source as ClientErrorSource,
    message: scrubText(message),
    page: scrubText(path, MAX_FIELD),
    build: text(build) ? scrubText(build, MAX_FIELD) : 'unknown',
    device: text(device) ? scrubText(device, MAX_FIELD) : 'unknown',
  }
}
