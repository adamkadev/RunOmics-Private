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

if (fs.existsSync('public/data')) {
  critical(
    'public/data/ exists on disk',
    'Everything under public/ is served as a static asset. Move any needed files into the selected private data workspace, then delete public/data/.'
  )
}

for (const prefix of ['public/fit', '.fit-cache']) {
  const fitFiles = trackedUnder(files, prefix)
  if (fitFiles.length) critical(`${prefix}/ is tracked`, `${fitFiles.length} file(s) - raw FIT binaries must never be committed.`)
}

// The FIT downloads are the un-cropped source: crop_privacy_zone only ever
// touches the route derived from them. They used to live at public/fit/, where
// `next start` published every one of them at /fit/<activityId>.fit - ids that
// /api/activities hands out. The cache moved to .fit-cache/; this catches a
// checkout still carrying the old one, whether tracked or not.
if (fs.existsSync('public/fit')) {
  critical(
    'public/fit/ exists on disk',
    'Everything under public/ is served as a static asset, and these hold the GPS the privacy zone is meant to hide. ' +
      'The cache now lives in .fit-cache/ - move it there and delete public/fit/.'
  )
}

const eventFiles = trackedUnder(files, 'public/events')
if (eventFiles.length) warn('public/events/ is tracked', `${eventFiles.length} file(s) - race-day photos, if real, must not ship.`)

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
]
for (const { name, pattern, exclude } of secretChecks) {
  const hits = grepTracked(files, pattern, { exclude: exclude ?? [] })
  for (const hit of hits) critical(`Possible ${name}`, `${hit.file}:${hit.line}`)
}

const gitignore = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf-8') : ''
const expectedPatterns = ['/public/fit/', '/.fit-cache/', '/public/data/', '/data/', '.env*']
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
