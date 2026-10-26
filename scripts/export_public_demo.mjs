#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG_PATH = path.join(repoRoot, 'scripts', 'export_public_demo.config.json')
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|fit|zip|gz|pdf)$/i

function globToRegExp(glob) {
  const source = glob
    .split('**')
    .map((part) => part.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*'))
    .join('.*')
  return new RegExp(`^${source}$`)
}

/** A trailing slash names a directory, a `*` a glob, anything else one exact path. */
export function matchesPath(file, pattern) {
  if (pattern.endsWith('/')) return file.startsWith(pattern)
  if (pattern.includes('*')) return globToRegExp(pattern).test(file)
  return file === pattern
}

export function isDenied(file, config) {
  return (
    config.deny.some((entry) => matchesPath(file, entry.path)) &&
    !config.denyExceptions.some((entry) => matchesPath(file, entry.path))
  )
}

export function isKept(file, config) {
  return config.keep.some((entry) => matchesPath(file, entry.path))
}

export function transformPackageJson(privatePkg, publicPkg, rules) {
  const scripts = {}
  for (const [name, command] of Object.entries(privatePkg.scripts ?? {})) {
    if (rules.dropScripts.some((pattern) => matchesPath(name, pattern))) continue
    scripts[name] = rules.scriptReplacements.reduce((cmd, { from, to }) => cmd.split(from).join(to), command)
  }
  for (const name of rules.publicScripts) {
    if (publicPkg.scripts?.[name]) scripts[name] = publicPkg.scripts[name]
  }

  const out = { name: privatePkg.name, version: privatePkg.version }
  for (const key of Object.keys(publicPkg)) {
    if (rules.fromPublic.includes(key)) out[key] = publicPkg[key]
  }
  for (const [key, value] of Object.entries(privatePkg)) {
    if (!(key in out)) out[key] = key === 'scripts' ? scripts : value
  }
  return out
}

export function transformLockfile(lock, pkg) {
  const root = lock.packages?.['']
  if (!root) return { ...lock, name: pkg.name, version: pkg.version }
  const { name: _name, version: _version, license: _license, ...rest } = root
  const head = { name: pkg.name, version: pkg.version, ...(pkg.license ? { license: pkg.license } : {}) }
  return { ...lock, name: pkg.name, version: pkg.version, packages: { ...lock.packages, '': { ...head, ...rest } } }
}

export function compilePatterns(patterns) {
  return patterns.map((p) => ({
    ...p,
    re: new RegExp(p.regex, p.flags.includes('g') ? p.flags : `${p.flags}g`),
    exceptRe: p.except ? new RegExp(p.except, 'i') : null,
  }))
}

/** Each allow entry that clears a hit is recorded in `used`, so a stale one can be reported. */
export function scanText(file, text, patterns, allow, used = new Set()) {
  const findings = []
  text.split('\n').forEach((line, index) => {
    for (const pattern of patterns) {
      for (const m of line.matchAll(pattern.re)) {
        const match = m[0]
        if (pattern.exceptRe?.test(match)) continue
        const entry = allow.find(
          (a) => a.pattern === pattern.id && matchesPath(file, a.path) && (!a.match || line.includes(a.match))
        )
        if (entry) {
          used.add(entry)
          continue
        }
        findings.push({ file, line: index + 1, pattern: pattern.id, match, text: line.trim().slice(0, 140) })
      }
    }
  })
  return findings
}

function git(args, cwd, options = {}) {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024, ...options })
}

function parseArgs(argv) {
  const args = { ref: 'HEAD', to: null, check: false, strict: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--to') args.to = argv[++i]
    else if (arg === '--ref') args.ref = argv[++i]
    else if (arg === '--check') args.check = true
    else if (arg === '--strict') args.strict = true
    else throw new Error(`Unknown argument ${arg}. Usage: export_public_demo.mjs --to <public clone> [--ref <ref>] [--check] [--strict]`)
  }
  if (!args.to) throw new Error('--to <public clone> is required')
  return args
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function extractTree(ref, staging) {
  const tar = execFileSync('git', ['archive', '--format=tar', ref], { cwd: repoRoot, maxBuffer: 1024 * 1024 * 1024 })
  execFileSync('tar', ['-x', '-C', staging], { input: tar })
  return git(['ls-tree', '-r', '-z', '--name-only', ref], repoRoot).split('\0').filter(Boolean)
}

function applyTransforms(staging, target, config, warnings) {
  const pkgPath = path.join(staging, 'package.json')
  const publicPkgPath = path.join(target, 'package.json')
  const publicPkg = fs.existsSync(publicPkgPath) ? readJson(publicPkgPath) : {}
  const pkg = transformPackageJson(readJson(pkgPath), publicPkg, config.packageJson)
  writeJson(pkgPath, pkg)
  const lockPath = path.join(staging, 'package-lock.json')
  if (fs.existsSync(lockPath)) writeJson(lockPath, transformLockfile(readJson(lockPath), pkg))

  const vercelPath = path.join(staging, 'vercel.json')
  if (fs.existsSync(vercelPath)) {
    const vercel = readJson(vercelPath)
    const dropped = config.vercelJson.drop.filter((key) => key in vercel)
    if (dropped.length) {
      for (const key of dropped) delete vercel[key]
      writeJson(vercelPath, vercel)
    }
  }

  for (const { path: file, key, value } of config.envValues) {
    const full = path.join(staging, file)
    const text = fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : ''
    const line = new RegExp(`^${key}=.*$`, 'm')
    if (!line.test(text)) {
      warnings.push(`env value matches nothing: ${key} is not set in ${file}`)
      continue
    }
    fs.writeFileSync(full, text.replace(line, `${key}=${value}`))
  }

  for (const { path: file, from, to } of config.replacements) {
    const full = path.join(staging, file)
    const text = fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : ''
    if (!text.includes(from)) {
      warnings.push(`replacement matches nothing: "${from}" is not in ${file}`)
      continue
    }
    fs.writeFileSync(full, text.split(from).join(to))
  }
  return pkg
}

function copyKeptFiles(target, staging, config, warnings) {
  const kept = []
  const walk = (dir) =>
    fs.readdirSync(path.join(target, dir), { withFileTypes: true }).flatMap((entry) => {
      const rel = dir ? `${dir}/${entry.name}` : entry.name
      if (entry.isDirectory()) return entry.name === '.git' || entry.name === 'node_modules' ? [] : walk(rel)
      return [rel]
    })
  for (const entry of config.keep) {
    const base = entry.path.endsWith('/') ? entry.path.slice(0, -1) : entry.path
    const full = path.join(target, base)
    const files = !fs.existsSync(full) ? [] : fs.statSync(full).isDirectory() ? walk(base) : [base]
    if (!files.length) warnings.push(`keep entry matches nothing in the public clone: ${entry.path}`)
    for (const file of files) {
      fs.mkdirSync(path.dirname(path.join(staging, file)), { recursive: true })
      fs.copyFileSync(path.join(target, file), path.join(staging, file))
      kept.push(file)
    }
  }
  return kept
}

function scanTree(staging, files, config) {
  const patterns = compilePatterns(config.scan.patterns)
  const used = new Set()
  const findings = []
  for (const file of files) {
    if (BINARY.test(file) || config.scan.skipFiles.includes(file)) continue
    const buffer = fs.readFileSync(path.join(staging, file))
    if (buffer.subarray(0, 8000).includes(0)) continue
    findings.push(...scanText(file, buffer.toString('utf-8'), patterns, config.scan.allow, used))
  }
  const unused = config.scan.allow.filter((entry) => !used.has(entry))
  return { findings, unused }
}

function verifyPrivateData(staging) {
  git(['init', '-q'], staging)
  git(['add', '-A'], staging)
  try {
    return { ok: true, output: execFileSync('node', ['scripts/verify_no_private_data.mjs'], { cwd: staging, encoding: 'utf-8' }) }
  } catch (err) {
    return { ok: false, output: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

function syncInto(target, staging, exported, config) {
  const tracked = git(['ls-files', '-z'], target).split('\0').filter(Boolean)
  for (const file of tracked) {
    if (isKept(file, config)) continue
    fs.rmSync(path.join(target, file), { force: true })
    for (let dir = path.dirname(file); dir !== '.'; dir = path.dirname(dir)) {
      const full = path.join(target, dir)
      if (!fs.existsSync(full) || fs.readdirSync(full).length) break
      fs.rmdirSync(full)
    }
  }
  for (const file of exported) {
    const from = path.join(staging, file)
    const to = path.join(target, file)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(from, to)
    fs.chmodSync(to, fs.statSync(from).mode)
  }
  const keptPaths = config.keep.map((entry) => entry.path).filter((p) => fs.existsSync(path.join(target, p)))
  git(['add', '-u'], target)
  git(['add', '-A', '--pathspec-from-file=-', '--pathspec-file-nul'], target, { input: [...exported, ...keptPaths].join('\0') })
  return git(['diff', '--cached', '--name-status', '--no-renames'], target)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'))
}

function printList(title, items) {
  console.log(`\n${title} (${items.length})`)
  for (const item of items) console.log(`  ${item}`)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const config = readJson(CONFIG_PATH)
  const target = path.resolve(args.to)
  if (!fs.existsSync(path.join(target, '.git'))) throw new Error(`${target} is not a git clone of the public repository`)

  const sha = git(['rev-parse', '--verify', `${args.ref}^{commit}`], repoRoot).trim()
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-public-export-'))
  const warnings = []

  const all = extractTree(sha, staging)
  const denied = all.filter((file) => isDenied(file, config))
  const patterns = compilePatterns(config.scan.patterns)
  for (const entry of config.deny.filter((e) => e.found === 'scan')) {
    const full = path.join(staging, entry.path)
    if (fs.existsSync(full) && !scanText(entry.path, fs.readFileSync(full, 'utf-8'), patterns, []).length) {
      warnings.push(`denied for personal content but now scans clean, so it may ship: ${entry.path}`)
    }
  }
  for (const file of denied) fs.rmSync(path.join(staging, file), { force: true })
  const exported = all.filter((file) => !isDenied(file, config) && !isKept(file, config))
  const shadowed = all.filter((file) => !isDenied(file, config) && isKept(file, config))
  for (const entry of config.deny) {
    if (!all.some((file) => matchesPath(file, entry.path))) warnings.push(`deny entry matches nothing at ${args.ref}: ${entry.path}`)
  }

  const pkg = applyTransforms(staging, target, config, warnings)
  const kept = copyKeptFiles(target, staging, config, warnings)
  const verify = verifyPrivateData(staging)
  const { findings, unused } = scanTree(staging, [...exported, ...kept], config)
  for (const entry of unused) warnings.push(`allow entry cleared nothing: ${entry.path} [${entry.pattern}] ${entry.match ?? ''}`)

  console.log(`RunOmics public export of ${args.ref} (${sha.slice(0, 8)}), version ${pkg.version}`)
  console.log(`  ${exported.length} exported, ${denied.length} denied, ${kept.length} kept from the public repo`)
  printList('Denied', denied)
  if (shadowed.length) printList('Private files replaced by the public version', shadowed)
  if (warnings.length) printList('Warnings', warnings)
  console.log(`\nverify_no_private_data: ${verify.output.trim()}`)

  if (findings.length) {
    printList(
      'Personal-content findings',
      findings.map((f) => `${f.file}:${f.line} [${f.pattern}] ${f.match}  |  ${f.text}`)
    )
  }
  // Strict: a stale entry stops the export too, so the config is pruned when the code moves, not years later.
  if (!verify.ok || findings.length || (args.strict && warnings.length)) {
    console.log(`\nExport stopped: ${target} is untouched. Staging left at ${staging}`)
    process.exit(1)
  }
  if (args.check) {
    console.log(`\nCheck passed; nothing written. Staging at ${staging}`)
    return
  }

  const changes = syncInto(target, staging, exported, config)
  fs.rmSync(staging, { recursive: true, force: true })
  const byStatus = (status) => changes.filter(([s]) => s === status).map(([, file]) => file)
  printList('Added', byStatus('A'))
  printList('Removed', byStatus('D'))
  console.log(`\nChanged: ${byStatus('M').length} files (git -C ${target} diff --cached --stat)`)
  console.log('Staged, not committed: review, commit and push by hand.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (err) {
    console.error(`export_public_demo: ${err.message}`)
    process.exit(1)
  }
}
