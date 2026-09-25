#!/usr/bin/env node
/**
 * Fails when modules under src/ import one another in a ring - see
 * scripts/importCycles.ts for what counts as an import.
 *
 *   npm run check:cycles
 */
import { findCycles, importGraph } from './importCycles'

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
