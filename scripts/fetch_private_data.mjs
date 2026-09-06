#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { recordBaseRevision } from './private_data_revision.mjs'

function redact(text, secret) {
  if (!secret || !text) return text ?? ''
  return text.split(secret).join('***REDACTED***')
}

function writeAskpassScript(tmpDir) {
  const scriptPath = path.join(tmpDir, 'askpass.mjs')
  fs.writeFileSync(
    scriptPath,
    "#!/usr/bin/env node\n" +
      "const prompt = process.argv[2] || ''\n" +
      "if (/username/i.test(prompt)) process.stdout.write('x-access-token')\n" +
      "else process.stdout.write(process.env.RUNOMICS_DATA_REPO_TOKEN || '')\n",
    { mode: 0o700 }
  )
  return scriptPath
}

export function fetchPrivateData(targetDir) {
  const url = process.env.RUNOMICS_DATA_REPO_URL
  const token = process.env.RUNOMICS_DATA_REPO_TOKEN

  if (!url) {
    throw new Error('RUNOMICS_DATA_REPO_URL is not set - cannot fetch private data.')
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-data-'))
  try {
    const cloneDir = path.join(tmpDir, 'repo')
    const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    if (token) env.GIT_ASKPASS = writeAskpassScript(tmpDir)

    let baseRevision
    try {
      execFileSync('git', ['clone', '--depth', '1', url, cloneDir], { stdio: 'pipe', env })
      baseRevision = execFileSync('git', ['-C', cloneDir, 'rev-parse', 'HEAD'], { stdio: 'pipe', env })
        .toString()
        .trim()
    } catch (err) {
      const raw = [err?.message, err?.stderr?.toString?.(), err?.stdout?.toString?.()].filter(Boolean).join('\n')
      throw new Error(`git clone of the private data repository failed: ${redact(raw, token)}`)
    }

    const sourceDataDir = path.join(cloneDir, 'data')
    if (!fs.existsSync(sourceDataDir)) {
      throw new Error('Cloned the private data repository but it has no top-level data/ directory.')
    }

    fs.rmSync(targetDir, { recursive: true, force: true })
    fs.mkdirSync(path.dirname(targetDir), { recursive: true })
    fs.cpSync(sourceDataDir, targetDir, { recursive: true })

    recordBaseRevision(targetDir, { commit: baseRevision, url })
    return { commit: baseRevision, url }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const targetDir = process.argv[2] ?? path.join(process.cwd(), 'data')
  const { commit } = fetchPrivateData(targetDir)
  console.log(`Private data fetched into ${targetDir} at ${commit}`)
}
