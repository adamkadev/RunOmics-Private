import { scrubText, type ClientErrorSource } from '@/domain/diagnostics/clientError'
import { currentEnv, deviceSummary } from '@/lib/device'
import { BUILD_COMMIT } from '@/lib/version'

/** A page that fails in a loop sends a handful, not hundreds. */
const MAX_PER_PAGE = 10
const sent = new Set<string>()

/** Never throws and never logs: a reporter that failed loudly would report itself. */
export function reportClientError(source: ClientErrorSource, error: unknown): void {
  try {
    // Scrubbed here too, so a coordinate in a message never leaves the phone.
    const message = scrubText(error instanceof Error ? `${error.name}: ${error.message}` : String(error))
    const key = `${source}|${message}`
    if (sent.size >= MAX_PER_PAGE || sent.has(key)) return
    sent.add(key)
    const body = JSON.stringify({ source, message, page: location.pathname, build: BUILD_COMMIT, device: deviceSummary(currentEnv()) })
    void fetch('/api/client-errors', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {})
  } catch {
    // Nothing to do: the error it was reporting is already lost.
  }
}
