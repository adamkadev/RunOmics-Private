#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASE_REVISION_ENV, readBaseRevision, recordBaseRevision, sameRepository } from './private_data_revision.mjs'

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

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

function git(args, opts, token) {
  try {
    return execFileSync('git', args, { stdio: 'pipe', ...opts }).toString()
  } catch (err) {
    const raw = [err?.message, err?.stderr?.toString?.(), err?.stdout?.toString?.()].filter(Boolean).join('\n')
    throw new Error(`git ${args.join(' ')} failed: ${redact(raw, token)}`)
  }
}

function countActivities(sourceDataDir) {
  const activitiesDir = path.join(sourceDataDir, 'activities')
  if (!fs.existsSync(activitiesDir)) return 0
  let total = 0
  for (const file of fs.readdirSync(activitiesDir)) {
    if (!file.endsWith('.json') || file === 'index.json') continue
    const data = JSON.parse(fs.readFileSync(path.join(activitiesDir, file), 'utf-8'))
    total += (data.activities ?? []).length
  }
  return total
}

function classifyChanges(cloneDir) {
  const status = execFileSync('git', ['-C', cloneDir, 'status', '--porcelain'], { stdio: 'pipe' })
    .toString()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (!status.length) return 'none'
  if (status.some((l) => l.includes('data/activities/'))) return 'activities'
  if (status.every((l) => l.endsWith('data/sync_meta.json'))) return 'timestamp'
  return 'metrics'
}

export function assertCompleteDataWorkspace(sourceDataDir, existingDataDir) {
  const activityIndex = path.join(sourceDataDir, 'activities', 'index.json')
  if (!fs.existsSync(activityIndex)) {
    throw new Error(
      `Refusing to push incomplete data workspace ${sourceDataDir}: activities/index.json is missing.`
    )
  }

  const existingCoaching = path.join(existingDataDir, 'coaching')
  const sourceCoaching = path.join(sourceDataDir, 'coaching')
  if (fs.existsSync(existingCoaching) && !fs.existsSync(sourceCoaching)) {
    throw new Error(
      'Refusing to push an incomplete workspace: the private repository contains data/coaching but the source does not.'
    )
  }
}

// The deployment checks each commit with the same contract and refuses one that breaks it, so it must never become HEAD.
export function assertDataContract(sourceDataDir) {
  try {
    execFileSync(process.execPath, ['--import', 'tsx', 'scripts/validate-data.ts', path.resolve(sourceDataDir)], {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    })
  } catch (err) {
    const report = err?.stdout?.toString?.() || err?.stderr?.toString?.() || err?.message
    throw new Error(`Refusing to push ${sourceDataDir}: it breaks the data contract.\n${report}`)
  }
}

export function assertBaseRevisionCurrent(sourceDataDir, remoteCommit, url, env = process.env) {
  const recorded = readBaseRevision(sourceDataDir, env)

  if (!recorded) {
    throw new Error(
      `No base revision recorded for ${sourceDataDir}, so it is unknown which private data this ` +
        'workspace was built from and whether pushing it would delete newer data.\n' +
        'Re-hydrate it with scripts/fetch_private_data.mjs, or set ' +
        `${BASE_REVISION_ENV} to the commit it was built from.`
    )
  }

  if (recorded.url && !sameRepository(recorded.url, url)) {
    throw new Error(
      'This workspace was fetched from a different private data repository than the one being ' +
        `pushed to.\nFetched from: ${recorded.url}\nPushing to:   ${url}\n` +
        'Refusing to overwrite an unrelated repository.'
    )
  }

  if (recorded.commit !== remoteCommit) {
    throw new Error(
      'Private data changed since this workspace was fetched.\n' +
        `Expected base: ${recorded.commit}\n` +
        `Current remote: ${remoteCommit}\n` +
        'Refusing to overwrite newer data. Re-fetch and retry.'
    )
  }

  return recorded
}

export function pushPrivateData(sourceDataDir) {
  const url = process.env.RUNOMICS_DATA_REPO_URL
  const token = process.env.RUNOMICS_DATA_REPO_TOKEN
  if (!url) throw new Error('RUNOMICS_DATA_REPO_URL is not set - cannot push private data.')
  assertDataContract(sourceDataDir)

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-data-push-'))
  try {
    const cloneDir = path.join(tmpDir, 'repo')
    const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    if (token) env.GIT_ASKPASS = writeAskpassScript(tmpDir)

    git(['clone', '--depth', '1', url, cloneDir], { env }, token)
    const remoteCommit = git(['-C', cloneDir, 'rev-parse', 'HEAD'], { env }, token).trim()

    const targetDataDir = path.join(cloneDir, 'data')
    assertBaseRevisionCurrent(sourceDataDir, remoteCommit, url)
    assertCompleteDataWorkspace(sourceDataDir, targetDataDir)
    fs.rmSync(targetDataDir, { recursive: true, force: true })
    fs.mkdirSync(targetDataDir, { recursive: true })
    fs.cpSync(sourceDataDir, targetDataDir, { recursive: true })

    git(['-C', cloneDir, 'add', '-A'], {}, token)
    const kind = classifyChanges(cloneDir)
    if (kind === 'none') {
      console.log('No data changes - nothing to push.')
      return { pushed: false }
    }

    const message =
      kind === 'activities'
        ? `sync: update activities (${countActivities(sourceDataDir)} total) [skip ci]`
        : kind === 'timestamp'
          ? 'sync: refresh last-synced timestamp [skip ci]'
          : 'sync: refresh Garmin metrics and timestamp [skip ci]'

    git(
      [
        '-C', cloneDir,
        '-c', 'user.name=github-actions[bot]',
        '-c', 'user.email=github-actions[bot]@users.noreply.github.com',
        'commit', '-m', message,
      ],
      {},
      token
    )
    git(['-C', cloneDir, 'push'], { env }, token)

    const pushedCommit = git(['-C', cloneDir, 'rev-parse', 'HEAD'], { env }, token).trim()
    recordBaseRevision(sourceDataDir, { commit: pushedCommit, url })

    console.log(message)
    return { pushed: true, kind, message, commit: pushedCommit }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sourceDataDir = process.argv[2] ?? path.join(process.cwd(), 'data')
  const result = pushPrivateData(sourceDataDir)
  if (!result.pushed) process.exitCode = 0
}
