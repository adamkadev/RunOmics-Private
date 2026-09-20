/**
 * tsx compiles these modules to CommonJS, and only Node >=24 hoists their named
 * exports onto a dynamic-import namespace. Below that the namespace is
 * `{ default: exports }` and every destructure yields undefined.
 *
 * The caller keeps the literal specifier: `interopImport(import('@/x'))`.
 */
export async function interopImport<T>(loading: Promise<T>): Promise<T> {
  const loaded = (await loading) as Record<string, unknown>
  const fallback = loaded.default

  if (fallback === null || typeof fallback !== 'object') return loaded as T
  return { ...(fallback as Record<string, unknown>), ...loaded } as T
}
