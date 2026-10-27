import fs from 'fs'
import path from 'path'
import ts from 'typescript'

/**
 * Only imports that exist at runtime count: type-only imports are erased, and a dynamic import() never takes part
 * in module initialisation order.
 */
export function importGraph(root = process.cwd()): Map<string, string[]> {
  const configPath = path.join(root, 'tsconfig.json')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
  const cache = ts.createModuleResolutionCache(root, (name) => name, options)
  const src = path.join(root, 'src') + path.sep

  const graph = new Map<string, string[]>()
  for (const file of sourceFiles(path.join(root, 'src'))) {
    const text = ts.createSourceFile(file, fs.readFileSync(file, 'utf-8'), ts.ScriptTarget.Latest, false)
    const targets = new Set<string>()
    for (const specifier of runtimeSpecifiers(text)) {
      const resolved = ts.resolveModuleName(specifier, file, options, ts.sys, cache).resolvedModule
      const target = resolved?.resolvedFileName
      if (target && target.startsWith(src) && !target.endsWith('.d.ts')) targets.add(path.relative(root, target))
    }
    graph.set(path.relative(root, file), [...targets].sort())
  }
  return graph
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full)
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')
      ? [full]
      : []
  })
}

function runtimeSpecifiers(file: ts.SourceFile): string[] {
  const specifiers: string[] = []
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause
      const typeOnly =
        clause !== undefined &&
        (clause.isTypeOnly ||
          (clause.name === undefined &&
            clause.namedBindings !== undefined &&
            ts.isNamedImports(clause.namedBindings) &&
            clause.namedBindings.elements.length > 0 &&
            clause.namedBindings.elements.every((element) => element.isTypeOnly)))
      if (!typeOnly) specifiers.push(statement.moduleSpecifier.text)
    }
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.exportClause
      const typeOnly =
        statement.isTypeOnly ||
        (clause !== undefined && ts.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every((element) => element.isTypeOnly))
      if (!typeOnly) specifiers.push(statement.moduleSpecifier.text)
    }
  }
  return specifiers
}

/** The strongly connected components of more than one module, plus any module that imports itself (Tarjan's algorithm). */
export function findCycles(graph: Map<string, string[]>): string[][] {
  let counter = 0
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const cycles: string[][] = []

  function visit(node: string): void {
    index.set(node, counter)
    low.set(node, counter)
    counter += 1
    stack.push(node)
    onStack.add(node)

    for (const next of graph.get(node) ?? []) {
      if (!index.has(next)) {
        visit(next)
        low.set(node, Math.min(low.get(node)!, low.get(next)!))
      } else if (onStack.has(next)) {
        low.set(node, Math.min(low.get(node)!, index.get(next)!))
      }
    }

    if (low.get(node) !== index.get(node)) return
    const component: string[] = []
    let member: string
    do {
      member = stack.pop()!
      onStack.delete(member)
      component.push(member)
    } while (member !== node)
    if (component.length > 1 || (graph.get(node) ?? []).includes(node)) cycles.push(component.sort())
  }

  for (const node of [...graph.keys()].sort()) if (!index.has(node)) visit(node)
  return cycles.sort((a, b) => a[0]!.localeCompare(b[0]!))
}

/** Pages, layouts and routes that reach the data layer without awaiting loadData() themselves. */
export function entryPointsWithoutLoadData(graph: Map<string, string[]>, root = process.cwd()): string[] {
  const reaches = new Map<string, boolean>()
  function reachesData(file: string): boolean {
    if (file === 'src/infrastructure/dataFs.ts') return true
    if (!reaches.has(file)) {
      reaches.set(file, false)
      reaches.set(file, (graph.get(file) ?? []).some(reachesData))
    }
    return reaches.get(file)!
  }

  return [...graph.keys()]
    .filter((file) => /^src\/app\/(?:.+\/)?(?:page|layout|route)\.tsx?$/.test(file) && reachesData(file))
    .filter((file) => !/\bawait loadData\(\)/.test(fs.readFileSync(path.join(root, file), 'utf-8')))
    .sort()
}

/** Pages that await loadData() without an ISR window, which Next would otherwise render on every request. */
export function pagesWithoutRevalidate(graph: Map<string, string[]>, root = process.cwd()): string[] {
  return [...graph.keys()]
    .filter((file) => /^src\/app\/(?:.+\/)?page\.tsx?$/.test(file))
    .filter((file) => {
      const text = fs.readFileSync(path.join(root, file), 'utf-8')
      return /\bawait loadData\(\)/.test(text) && !/^export const revalidate = \d+/m.test(text)
    })
    .sort()
}
