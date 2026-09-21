#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchPrivateData } from './fetch_private_data.mjs'
import { writeDemoDataset } from './generate_demo_data.mjs'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

export function prepareData({
  root = repoRoot,
  env = process.env,
  fetchData = fetchPrivateData,
  writeDemo = writeDemoDataset,
} = {}) {
  const explicitDataDir = env.RUNOMICS_DATA_DIR?.trim()
  if (explicitDataDir) {
    const selected = path.resolve(explicitDataDir)
    if (!fs.existsSync(path.join(selected, 'activities', 'index.json'))) {
      throw new Error(
        `RUNOMICS_DATA_DIR points to ${selected}, but activities/index.json is missing. ` +
        'Explicit data workspaces are never generated, fetched, or overwritten implicitly.'
      )
    }
    console.log(`[prepare-data] using explicit data workspace ${selected} unchanged.`)
    return { mode: 'explicit', dataDir: selected }
  }

  const dataDir = path.join(root, 'data')

  if (fs.existsSync(path.join(dataDir, 'activities', 'index.json'))) {
    console.log('[prepare-data] data/ already populated - leaving it as-is.')
    return { mode: 'existing', dataDir }
  }

  if (env.RUNOMICS_DATA_REPO_URL) {
    console.log('[prepare-data] fetching real data from the private data repository...')
    fetchData(dataDir)
    console.log('[prepare-data] private data ready.')
    return { mode: 'private', dataDir }
  }

  console.log('[prepare-data] no private data source configured - generating the demo dataset.')
  writeDemo(dataDir)
  console.log('[prepare-data] demo dataset ready.')
  return { mode: 'demo', dataDir }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) prepareData()
