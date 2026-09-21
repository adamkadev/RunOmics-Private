import fs from 'fs'
import path from 'path'
import type { CoachingProposal } from './proposal'
import { parseCoachingProposal } from './proposal'

export function writeProposalPreview(proposal: CoachingProposal, outputDir: string): string {
  const parsed = parseCoachingProposal(proposal)
  fs.mkdirSync(outputDir, { recursive: true })
  const filePath = path.join(outputDir, `${parsed.createdAt.replace(/[:.]/g, '-')}-${parsed.kind}-${parsed.id}.json`)
  fs.writeFileSync(filePath, `${JSON.stringify(parsed, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 })
  return filePath
}

export function readProposalPreview(filePath: string): CoachingProposal {
  return parseCoachingProposal(JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown)
}
