// Lets plain .mjs scripts import the TypeScript palette modules, so build-time
// tooling reads the same color source the app does instead of keeping copies.
//
// Transpiles with the TypeScript already in devDependencies (rather than pulling
// in a runner like tsx) into a temp dir, rewriting relative specifiers to .mjs
// so Node's ESM loader can follow them.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Imports `src/lib/<entry>.ts` along with the given relative dependencies.
 * Every module named in `modules` must be alias-free (`./x`, never `@/x`).
 *
 * @param {string} entry - module name to import, e.g. 'themeTokens'
 * @param {string[]} modules - all module names to stage, dependencies first
 */
export async function loadLibModules(entry, modules) {
  const stage = mkdtempSync(join(tmpdir(), 'runomics-lib-'))
  try {
    for (const name of modules) {
      const src = readFileSync(join(root, 'src/lib', `${name}.ts`), 'utf8')
      const { outputText } = ts.transpileModule(src, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      })
      writeFileSync(
        join(stage, `${name}.mjs`),
        outputText.replace(/(from\s+['"]\.\/[^'"]+)(['"])/g, '$1.mjs$2'),
      )
    }
    return await import(pathToFileURL(join(stage, `${entry}.mjs`)).href)
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
}

export const ROOT = root
