import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

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
