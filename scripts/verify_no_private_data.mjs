#!/usr/bin/env node
/**
 * Lightweight pre-publication check: scans git-tracked files for the private-
 * data patterns this project has already been audited for (see CLAUDE.md /
 * project history). Not a DLP system - a handful of structural and pattern
 * checks meant to run once, right before a repo built from this codebase is
 * ever made public.
 *
 * Exits non-zero if anything CRITICAL is found.
 *
 *   node scripts/verify_no_private_data.mjs
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

function trackedFiles() {
  return execFileSync('git', ['ls-files'], { encoding: 'utf-8' }).trim().split('\n').filter(Boolean)
}

function trackedUnder(files, prefix) {
  return files.filter((f) => f === prefix || f.startsWith(prefix.endsWith('/') ? prefix : prefix + '/'))
}

function grepTracked(files, pattern, { exclude = [] } = {}) {
  const hits = []
  for (const f of files) {
    if (exclude.some((ex) => f === ex)) continue
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) continue
    let content
    try {
      content = fs.readFileSync(f, 'utf-8')
    } catch {
      continue // binary or unreadable - not a text-secret risk
    }
    const lines = content.split('\n')
    lines.forEach((line, i) => {
      if (pattern.test(line)) hits.push({ file: f, line: i + 1 })
    })
  }
  return hits
}

const findings = []

function critical(title, detail) {
  findings.push({ severity: 'CRITICAL', title, detail })
}
function warn(title, detail) {
  findings.push({ severity: 'WARN', title, detail })
}

const files = trackedFiles()

// --- Structural: directories that must never ship in a public repo -------
const dataFiles = trackedUnder(files, 'public/data')
if (dataFiles.length) {
  critical(
    'public/data/ is tracked',
    `${dataFiles.length} file(s) - real Garmin data belongs in the private data repo, not here. ` +
      `Expected today in the still-private app repo; must be empty before anything built from this ` +
      `tree is published. First hit: ${dataFiles[0]}`
  )
}

const fitFiles = trackedUnder(files, 'public/fit')
if (fitFiles.length) critical('public/fit/ is tracked', `${fitFiles.length} file(s) - raw FIT binaries must never be committed.`)

const eventFiles = trackedUnder(files, 'public/events')
if (eventFiles.length) warn('public/events/ is tracked', `${eventFiles.length} file(s) - race-day photos, if real, must not ship.`)

// --- Structural: env/credential files -------------------------------------
for (const f of files) {
  if (/^\.env(\..+)?$/.test(f) && f !== '.env.e2e' && f !== '.env.example') {
    critical('An env file beyond .env.e2e/.env.example is tracked', f)
  }
  if (/serviceAccountKey.*\.json$/i.test(f) || /firebase-adminsdk-.*\.json$/i.test(f)) {
    critical('A Firebase service-account key file is tracked', f)
  }
}

// --- Pattern: common secret/key shapes in tracked file contents ----------
const secretChecks = [
  { name: 'Google/Firebase API key (AIza...)', pattern: /AIza[0-9A-Za-z_-]{35}/, exclude: ['.env.e2e'] },
  { name: 'AWS access key (AKIA...)', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'PEM private key header', pattern: /BEGIN (RSA )?PRIVATE KEY/, exclude: ['.env.example', 'README.md'] },
  { name: 'Firebase service-account JSON shape', pattern: /"type"\s*:\s*"service_account"/ },
]
for (const { name, pattern, exclude } of secretChecks) {
  const hits = grepTracked(files, pattern, { exclude: exclude ?? [] })
  for (const hit of hits) critical(`Possible ${name}`, `${hit.file}:${hit.line}`)
}

// --- .gitignore sanity: the protections this project relies on -----------
const gitignore = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf-8') : ''
const expectedPatterns = ['/public/fit/', '/public/data/', '.env*']
for (const pattern of expectedPatterns) {
  if (!gitignore.includes(pattern)) warn('.gitignore is missing an expected pattern', pattern)
}

// --- Report ----------------------------------------------------------------
const criticalCount = findings.filter((f) => f.severity === 'CRITICAL').length
const warnCount = findings.filter((f) => f.severity === 'WARN').length

if (!findings.length) {
  console.log(`OK - ${files.length} tracked files checked, nothing flagged.`)
  process.exit(0)
}

for (const f of findings) {
  console.log(`[${f.severity}] ${f.title}\n    ${f.detail}`)
}
console.log(`\n${criticalCount} critical, ${warnCount} warning(s).`)
process.exit(criticalCount > 0 ? 1 : 0)
