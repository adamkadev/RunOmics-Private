/**
 * tsx compiles these modules to CommonJS, and below Node 24 a dynamic-import namespace is `{ default: exports }`.
 * The caller keeps the literal specifier: `interopImport(import('@/x'))`.
 */
export async function interopImport<T>(loading: Promise<T>): Promise<T> {
  const loaded = (await loading) as Record<string, unknown>
  const fallback = loaded.default

  if (fallback === null || typeof fallback !== 'object') return loaded as T
  return { ...(fallback as Record<string, unknown>), ...loaded } as T
}
