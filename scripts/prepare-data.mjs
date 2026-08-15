#!/usr/bin/env node
/**
 * Populates data/ before dev/build - the one place that decides which data
 * source powers this build. Runs via predev/prebuild (see package.json).
 *
 * data/ sits at the repository root, deliberately outside public/: everything
 * under public/ is served as a static asset, so a dataset there would put the
 * real Garmin-derived data back on the open web.
 *
 * Deliberately conservative: this only ever fills a *gap*. If
 * data/activities/index.json already exists it is a no-op, so it cannot
 * clobber a dataset fetched or synced earlier.
 *
 *   index.json present                 -> no-op
 *   absent, RUNOMICS_DATA_REPO_URL set -> fetch the private data repo
 *                                         (personal use; fails loudly on
 *                                         any error - never falls back to
 *                                         demo data silently)
 *   absent, otherwise                  -> generate the deterministic demo
 *                                         dataset (fresh clone, no config)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchPrivateData } from './fetch_private_data.mjs'
import { writeDemoDataset } from './generate_demo_data.mjs'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(repoRoot, 'data')
const legacyDir = path.join(repoRoot, 'public', 'data')

// public/data/ is where the Python sync pipeline writes and where the dataset
// itself used to live, so whatever is there is the fresher copy - and leaving it
// in place would serve the whole dataset as a static asset.
function absorbSyncWorkspace() {
  if (!fs.existsSync(legacyDir)) return

  console.log('[prepare-data] moving public/data/ into the server-only data/ directory.')
  fs.rmSync(dataDir, { recursive: true, force: true })
  fs.renameSync(legacyDir, dataDir)
}

function main() {
  absorbSyncWorkspace()

  if (fs.existsSync(path.join(dataDir, 'activities', 'index.json'))) {
    console.log('[prepare-data] data/ already populated - leaving it as-is.')
    return
  }

  if (process.env.RUNOMICS_DATA_REPO_URL) {
    console.log('[prepare-data] fetching real data from the private data repository...')
    fetchPrivateData(dataDir)
    console.log('[prepare-data] private data ready.')
    return
  }

  console.log('[prepare-data] no private data source configured - generating the demo dataset.')
  writeDemoDataset(dataDir)
  console.log('[prepare-data] demo dataset ready.')
}

main()
