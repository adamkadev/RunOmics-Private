#!/usr/bin/env node
/**
 * Populates public/data/ before dev/build - the one place that decides which
 * data source powers this build. Runs via predev/prebuild (see package.json).
 *
 * Deliberately conservative: this only ever fills a *gap*. If
 * public/data/activities/index.json already exists - true for every
 * environment today, since this repo still tracks its own real data - it is
 * a no-op. It never overwrites what's already there, so it cannot clobber
 * real data, whether committed or previously fetched.
 *
 *   index.json present            -> no-op (today's reality everywhere)
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

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')

function main() {
  if (fs.existsSync(path.join(dataDir, 'activities', 'index.json'))) {
    console.log('[prepare-data] public/data already populated - leaving it as-is.')
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
