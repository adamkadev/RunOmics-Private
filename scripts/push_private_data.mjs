#!/usr/bin/env node
/**
 * Pushes a freshly-synced data directory into the private RunOmics-data
 * repository. Used by .github/workflows/sync.yml after it hydrates the complete
 * private dataset into the server-only data/ workspace and syncs in place.
 *
 * Same token handling as fetch_private_data.mjs, and for the same reasons:
 * RUNOMICS_DATA_REPO_TOKEN never touches argv, the clone URL, .git/config,
 * or an error message - only GIT_ASKPASS ever sees it, reading it from its
 * own inherited environment. See fetch_private_data.mjs's header for the
 * full rationale; this script deliberately duplicates the small helper
 * rather than sharing a module, so each script stays independently readable
 * and auditable.
 *
 * Mirrors sync.yml's own commit-message convention (today's inline step)
 * so the data repo's history reads the same way this app repo's did:
 * activities > other metrics > timestamp-only, each "[skip ci]".
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

// activities > other metrics > timestamp-only - same three tiers the app repo's
// own sync commits used, computed from the data repo clone's own diff.
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

export function pushPrivateData(sourceDataDir) {
  const url = process.env.RUNOMICS_DATA_REPO_URL
  const token = process.env.RUNOMICS_DATA_REPO_TOKEN
  if (!url) throw new Error('RUNOMICS_DATA_REPO_URL is not set - cannot push private data.')

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-data-push-'))
  try {
    const cloneDir = path.join(tmpDir, 'repo')
    const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    if (token) env.GIT_ASKPASS = writeAskpassScript(tmpDir)

    git(['clone', '--depth', '1', url, cloneDir], { env }, token)

    const targetDataDir = path.join(cloneDir, 'data')
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

    console.log(message)
    return { pushed: true, kind, message }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sourceDataDir = process.argv[2] ?? path.join(process.cwd(), 'data')
  const result = pushPrivateData(sourceDataDir)
  if (!result.pushed) process.exitCode = 0
}
