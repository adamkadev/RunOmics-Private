#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateDemoDataset, writeDemoDataset } from './generate_demo_data.mjs'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

export const E2E_DATA_DIRNAME = '.e2e-data'
export const E2E_DATA_DIRNAMES = { rich: E2E_DATA_DIRNAME, sparse: '.e2e-data-sparse' }
// The visual suite's, generated on its fixed day, so an e2e run beside it never swaps its data.
export const VISUAL_DATA_DIRNAMES = { rich: '.visual-data', sparse: '.visual-data-sparse' }

export function prepareE2eData({
  root = repoRoot,
  profile = 'rich',
  suite = 'e2e',
  writeDemo = (dir) => writeDemoDataset(dir, generateDemoDataset({ profile })),
} = {}) {
  const dirname = (suite === 'visual' ? VISUAL_DATA_DIRNAMES : E2E_DATA_DIRNAMES)[profile]
  if (!dirname) throw new Error(`Unknown e2e profile ${profile}: use rich or sparse.`)
  const dataDir = path.resolve(root, dirname)

  // Deliberately ignores RUNOMICS_DATA_DIR, so no real athlete workspace can be deleted by accident.
  if (path.basename(dataDir) !== dirname) {
    throw new Error(`Refusing to reset ${dataDir}: not the e2e data workspace.`)
  }

  fs.rmSync(dataDir, { recursive: true, force: true })
  writeDemo(dataDir)
  return dataDir
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const profile = process.env.RUNOMICS_E2E_PROFILE || 'rich'
  const suite = process.env.RUNOMICS_E2E_SUITE || 'e2e'
  console.log(`[prepare-e2e-data] regenerated the ${profile} demo dataset in ${prepareE2eData({ profile, suite })}.`)
}
