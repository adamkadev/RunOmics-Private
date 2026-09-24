#!/usr/bin/env node
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
      continue
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

const FIT_CACHE_DIR = '.fit-cache'

const files = trackedFiles()

for (const prefix of ['data', 'public/data']) {
  const dataFiles = trackedUnder(files, prefix)
  if (dataFiles.length) {
    critical(
      `${prefix}/ is tracked`,
      `${dataFiles.length} file(s) - real Garmin data belongs in the private data repo, not here. ` +
        `First hit: ${dataFiles[0]}`
    )
  }
}

// Everything under public/ is served as a static asset, so neither of these may
// exist there at all - not merely be untracked.
const servedDirsThatMustNotExist = [
  {
    dir: 'public/data',
    detail: 'Move any needed files into the selected private data workspace, then delete public/data/.',
  },
  {
    dir: 'public/fit',
    detail: `Raw FIT holds the GPS the privacy zone hides. The cache lives in ${FIT_CACHE_DIR}/ - move it there and delete public/fit/.`,
  },
]
for (const { dir, detail } of servedDirsThatMustNotExist) {
  if (fs.existsSync(dir)) critical(`${dir}/ exists on disk`, detail)
}

for (const prefix of ['public/fit', FIT_CACHE_DIR]) {
  const fitFiles = trackedUnder(files, prefix)
  if (fitFiles.length) critical(`${prefix}/ is tracked`, `${fitFiles.length} file(s) - raw FIT binaries must never be committed.`)
}


// Race-day photos are real people at real places, and a phone photo's EXIF can
// carry the GPS the privacy zone exists to hide. Everything under public/
// ships to every deployment.
const eventFiles = trackedUnder(files, 'public/events')
if (eventFiles.length) critical('public/events/ is tracked', `${eventFiles.length} file(s) - race-day photos belong in the data repository.`)

// The coaching CLI writes these wherever --prompt-out points; both carry the
// athlete's health data (see .gitignore).
for (const f of files) {
  if (/(^|\/)(coach-prompt\.md|answer\.json)$/.test(f)) critical('A coaching prompt or reply is tracked', f)
}

for (const f of files) {
  if (/^\.env(\..+)?$/.test(f) && f !== '.env.e2e' && f !== '.env.example') {
    critical('An env file beyond .env.e2e/.env.example is tracked', f)
  }
  if (/serviceAccountKey.*\.json$/i.test(f) || /firebase-adminsdk-.*\.json$/i.test(f)) {
    critical('A Firebase service-account key file is tracked', f)
  }
}

const secretChecks = [
  { name: 'Google/Firebase API key (AIza...)', pattern: /AIza[0-9A-Za-z_-]{35}/, exclude: ['.env.e2e'] },
  { name: 'AWS access key (AKIA...)', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'PEM private key header', pattern: /BEGIN (RSA )?PRIVATE KEY/, exclude: ['.env.example', 'README.md'] },
  { name: 'Firebase service-account JSON shape', pattern: /"type"\s*:\s*"service_account"/ },
  // The data repository PAT and the sync-dispatch token both live in env vars;
  // a pasted one is a write credential for the only copy of the history.
  { name: 'GitHub token', pattern: /\b(gh[pousr]_[0-9A-Za-z]{36,}|github_pat_[0-9A-Za-z_]{50,})\b/ },
  { name: 'Vercel deploy hook URL', pattern: /api\.vercel\.com\/v1\/integrations\/deploy\/prj_[0-9A-Za-z]+\/[0-9A-Za-z]+/ },
  // Real coordinates carry decimals; the placeholders in .env.example and the
  // fictional zones in the tests do not reach three.
  { name: 'PRIVACY_ZONES set to real-looking coordinates', pattern: /PRIVACY_ZONES\s*[=:]\s*['"]?\[\s*\[\s*-?\d+\.\d{3,}/ },
]
for (const { name, pattern, exclude } of secretChecks) {
  const hits = grepTracked(files, pattern, { exclude: exclude ?? [] })
  for (const hit of hits) critical(`Possible ${name}`, `${hit.file}:${hit.line}`)
}

const gitignore = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf-8') : ''
const expectedPatterns = ['/public/fit/', `/${FIT_CACHE_DIR}/`, '/public/data/', '/data/', '.env*']
for (const pattern of expectedPatterns) {
  if (!gitignore.includes(pattern)) warn('.gitignore is missing an expected pattern', pattern)
}

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
