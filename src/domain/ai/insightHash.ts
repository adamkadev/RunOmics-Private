import 'server-only'
import { createHash } from 'crypto'

type Facts = Record<string, string | number | boolean | null>

export function insightHash(facts: Facts): string {
  const canonical = Object.keys(facts)
    .sort()
    .map((key) => `${key}=${String(facts[key])}`)
    .join('|')
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16)
}
