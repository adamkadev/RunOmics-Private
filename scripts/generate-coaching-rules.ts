#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { GENERATED_PATH, expectedGenerated } from './coachingRules'

function main(): void {
  const source = expectedGenerated()
  const target = path.join(process.cwd(), GENERATED_PATH)
  const unchanged = fs.existsSync(target) && fs.readFileSync(target, 'utf-8') === source

  fs.writeFileSync(target, source)
  console.log(`${unchanged ? 'Unchanged' : 'Wrote'} ${GENERATED_PATH}`)
}

main()
