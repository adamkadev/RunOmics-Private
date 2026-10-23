import type { Instrumentation } from 'next'

/**
 * One JSON line per error a request throws past its handler, searchable in the Vercel logs. Never the
 * headers, cookies or body, nor a secret the message quotes; the guarded routes log their own errors.
 */

const MESSAGE_LIMIT = 300

const SECRET_ENV = [
  'INTERNAL_NOTIFY_SECRET',
  'GEMINI_API_KEY',
  'GEMINI_COACH_API_KEY',
  'FIREBASE_PRIVATE_KEY',
  'GITHUB_SYNC_TOKEN',
  // Vercel holds the data repository's token too, for the build's fetch.
  'RUNOMICS_DATA_REPO_TOKEN',
  'ORS_API_KEY',
]

// Short values are not worth it: replacing a two-letter value would shred the message.
const MIN_SECRET_LENGTH = 8

function redact(text: string): string {
  return SECRET_ENV.reduce((redacted, name) => {
    const value = process.env[name]
    return value && value.length >= MIN_SECRET_LENGTH ? redacted.split(value).join('[redacted]') : redacted
  }, text)
}

function digestOf(error: unknown): string | undefined {
  const digest = (error as { digest?: unknown } | null)?.digest
  return typeof digest === 'string' ? digest : undefined
}

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const digest = digestOf(error)

  console.error(
    JSON.stringify({
      level: 'error',
      event: 'request-error',
      method: request.method,
      path: request.path.split('?')[0],
      route: context.routePath,
      routeType: context.routeType,
      ...(digest === undefined ? {} : { digest }),
      error: {
        name: error instanceof Error ? error.name : typeof error,
        message: redact(error instanceof Error ? error.message : String(error)).slice(0, MESSAGE_LIMIT),
      },
    })
  )
}
