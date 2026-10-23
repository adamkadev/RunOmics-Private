#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeDemoDataset } from './generate_demo_data.mjs'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

export const E2E_DATA_DIRNAME = '.e2e-data'

export function prepareE2eData({ root = repoRoot, writeDemo = writeDemoDataset } = {}) {
  const dataDir = path.resolve(root, E2E_DATA_DIRNAME)

  // Deliberately ignores RUNOMICS_DATA_DIR, so no real athlete workspace can be deleted by accident.
  if (path.basename(dataDir) !== E2E_DATA_DIRNAME) {
    throw new Error(`Refusing to reset ${dataDir}: not the e2e data workspace.`)
  }

  fs.rmSync(dataDir, { recursive: true, force: true })
  writeDemo(dataDir)
  return dataDir
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`[prepare-e2e-data] regenerated the demo dataset in ${prepareE2eData()}.`)
}
