#!/usr/bin/env node
/**
 * Pulls real Garmin-derived data from the private RunOmics-data repository
 * into a target directory - data/ for the personal deployment (see
 * .env.example), the throwaway public/data/ workspace when the sync workflow
 * hydrates a runner. Only runs when RUNOMICS_DATA_REPO_URL is set
 * (scripts/prepare-data.mjs decides that); a failure here must stop the build
 * rather than silently falling back to demo data for what's supposed to be
 * the real personal deployment.
 *
 * RUNOMICS_DATA_REPO_TOKEN never touches process argv, the cloned repo's
 * .git/config, or an error message:
 *  - it is never embedded in the clone URL, so git never writes it into
 *    .git/config, and it never appears in `ps`/`/proc/<pid>/cmdline`;
 *  - it reaches `git` only via GIT_ASKPASS, a helper script git invokes as
 *    its own subprocess and that reads the token from ITS inherited
 *    environment - env vars aren't visible via `ps` the way argv is;
 *  - the helper script file itself contains only a reference to the env
 *    var name, never the token value, and lives in a temp dir removed in
 *    `finally`;
 *  - anything git prints on failure is redacted before this function ever
 *    constructs or throws an Error, so a caller that logs the exception
 *    (Vercel/GitHub Actions build logs, an uncaught-exception handler)
 *    cannot leak the token even indirectly.
 *
 * GIT_ASKPASS needs an HTTPS remote (RUNOMICS_DATA_REPO_URL must be
 * https://..., not git@/ssh://) - see .env.example.
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

// Git calls "$GIT_ASKPASS '<prompt>'" once for the username, once for the
// password, and reads the answer from stdout. The token is read here from
// process.env at the moment git invokes this script - never written into
// the script file, never passed as an argument to `git` itself.
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

    try {
      execFileSync('git', ['clone', '--depth', '1', url, cloneDir], { stdio: 'pipe', env })
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
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const targetDir = process.argv[2] ?? path.join(process.cwd(), 'data')
  fetchPrivateData(targetDir)
  console.log(`Private data fetched into ${targetDir}`)
}
