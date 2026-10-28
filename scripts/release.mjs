#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/
const UNRELEASED = '## [Unreleased]'

export function compareVersions(a, b) {
  const [pa, pb] = [a, b].map((v) => {
    const match = SEMVER.exec(v)
    if (!match) throw new Error(`${v} is not a version like 3.3.0`)
    return match.slice(1).map(Number)
  })
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]
  return 0
}

export function releaseChangelog(changelog, version, date) {
  const start = changelog.indexOf(UNRELEASED)
  if (start < 0) throw new Error(`CHANGELOG.md has no ${UNRELEASED} section`)
  if (changelog.includes(`## [${version}]`)) throw new Error(`CHANGELOG.md already has a ${version} section`)
  const bodyStart = start + UNRELEASED.length
  const next = changelog.indexOf('\n## [', bodyStart)
  const bodyEnd = next < 0 ? changelog.length : next + 1
  const body = changelog.slice(bodyStart, bodyEnd).trim()
  if (!body) throw new Error(`${UNRELEASED} is empty: nothing to release`)
  return `${changelog.slice(0, start)}${UNRELEASED}\n\n## [${version}] - ${date}\n\n${body}\n\n${changelog.slice(bodyEnd)}`
}

function parseArgs(argv) {
  const args = { version: undefined, date: new Date().toLocaleDateString('sv-SE') }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--date') args.date = argv[++i]
    else if (!args.version) args.version = argv[i]
    else throw new Error(`Unexpected argument ${argv[i]}`)
  }
  if (!args.version) throw new Error('Usage: npm run release -- <version> [--date YYYY-MM-DD]')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date ?? '')) throw new Error(`--date ${args.date} is not YYYY-MM-DD`)
  return args
}

function main() {
  const { version, date } = parseArgs(process.argv.slice(2))
  const git = (...cmd) => execFileSync('git', cmd, { cwd: repoRoot, encoding: 'utf8' })
  if (git('status', '--porcelain').trim()) throw new Error('The working tree has changes: commit or stash them first')

  const current = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version
  if (compareVersions(version, current) <= 0) throw new Error(`${version} is not greater than the current ${current}`)

  const changelogPath = path.join(repoRoot, 'CHANGELOG.md')
  fs.writeFileSync(changelogPath, releaseChangelog(fs.readFileSync(changelogPath, 'utf8'), version, date))
  execFileSync('npm', ['version', version, '--no-git-tag-version'], { cwd: repoRoot, stdio: 'ignore' })

  console.log(`CHANGELOG.md, package.json and package-lock.json are at ${version} (${date}). Review, then:

  git commit -am "chore(release): ${version}"
  # once that commit is on main:
  git tag -a v${version} -m "v${version}" && git push origin v${version}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (err) {
    console.error(`release: ${err.message}`)
    process.exit(1)
  }
}
