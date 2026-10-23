/**
 * A client view names what it carries, so nothing else reaches the page
 * payload; an undefined key is left out rather than serialised.
 */
export function pickDefined<T extends object, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K> {
  const picked = {} as Pick<T, K>
  for (const key of keys) {
    if (source[key] !== undefined) picked[key] = source[key]
  }
  return picked
}
