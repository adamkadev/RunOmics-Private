/**
 * `await import()` of an app module from a tsx-run script, on any Node version.
 *
 * The coaching CLIs cannot import `@/infrastructure/...` statically: those
 * modules resolve `RUNOMICS_DATA_DIR` into a module-level constant the moment
 * they load (see `src/infrastructure/dataPath.ts`), and the CLI only knows
 * which workspace to use after it has parsed `--data-dir`. So every one of them
 * is loaded with a dynamic `import()` once the environment is settled.
 *
 * That is where Node versions disagree. `package.json` has no `"type":
 * "module"`, so tsx compiles these files to CommonJS, and whether the dynamic
 * import namespace carries their named exports depends on cjs-module-lexer
 * recognising tsx's output: Node 24 hoists them, Node 22 does not and hands
 * back `{ default: exports }` instead. A plain
 * `const { JsonCoachingRepository } = await import(...)` therefore destructures
 * to `undefined` on Node 22 and dies one line later with
 * "JsonCoachingRepository is not a constructor" - while CI, pinned to Node 24,
 * stays green.
 *
 * Wrapping the import normalises both shapes. Named exports still win where
 * Node provides them, so this is a no-op on Node 24.
 *
 * The caller keeps the literal specifier - `interopImport(import('@/x'))`, not
 * `interopImport('@/x')` - because tsx and the TypeScript path mapping both
 * need to see it statically.
 */
export async function interopImport<T>(loading: Promise<T>): Promise<T> {
  const loaded = (await loading) as Record<string, unknown>
  const fallback = loaded.default

  if (fallback === null || typeof fallback !== 'object') return loaded as T
  return { ...(fallback as Record<string, unknown>), ...loaded } as T
}
