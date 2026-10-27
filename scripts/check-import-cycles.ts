#!/usr/bin/env node
import { entryPointsWithoutLoadData, findCycles, importGraph, pagesWithoutRevalidate } from './importCycles'

const graph = importGraph()
const cycles = findCycles(graph)

if (cycles.length === 0) {
  console.log(`No import cycles in ${graph.size} modules under src/.`)
} else {
  console.error(`${cycles.length} import cycle${cycles.length === 1 ? '' : 's'} under src/:`)
  for (const cycle of cycles) console.error(`  - ${cycle.join('\n    ')}`)
  console.error('Move what both sides need into a module that neither imports back.')
  process.exitCode = 1
}

const unloaded = entryPointsWithoutLoadData(graph)
if (unloaded.length > 0) {
  console.error(`${unloaded.length} page(s) or route(s) read data without awaiting loadData() first:`)
  for (const file of unloaded) console.error(`  - ${file}`)
  console.error('Read from GitHub, they would serve whatever commit this instance last loaded, or throw on a cold one.')
  process.exitCode = 1
}

const unrevalidated = pagesWithoutRevalidate(graph)
if (unrevalidated.length > 0) {
  console.error(`${unrevalidated.length} page(s) await loadData() without exporting revalidate:`)
  for (const file of unrevalidated) console.error(`  - ${file}`)
  console.error('Add `export const revalidate = 3600` so the page is served from the ISR cache between data pushes.')
  process.exitCode = 1
}
