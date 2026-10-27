#!/usr/bin/env node
import { fileURLToPath } from 'node:url'

/** One missed nightly sync: the app's own stale-sync push waits for three. */
export const MAX_SYNC_AGE_HOURS = 36
export const REQUIRED_INTEGRATIONS = ['firebaseAdmin', 'cron']

const HOUR_MS = 3_600_000
const TIMEOUT_MS = 30_000

export function healthProblems(httpStatus, body, now = Date.now()) {
  if (httpStatus === 401) return ['health refused INTERNAL_NOTIFY_SECRET (401)']
  if (typeof body?.status !== 'string') return [`health answered ${httpStatus} without a health report`]
  if (body.status === 'unloaded') {
    const refused = body.rejectedData?.commit ? `: it refused data commit ${body.rejectedData.commit}` : ''
    return [`the deployment could not load its data${refused}`]
  }

  const problems = []
  const syncedAt = typeof body.lastSyncedAt === 'string' ? new Date(body.lastSyncedAt).getTime() : NaN
  if (Number.isNaN(syncedAt)) {
    problems.push('no sync has been recorded')
  } else {
    const hours = (now - syncedAt) / HOUR_MS
    if (hours >= MAX_SYNC_AGE_HOURS) problems.push(`the last sync landed ${Math.round(hours)} h ago (${body.lastSyncedAt})`)
  }
  const missing = REQUIRED_INTEGRATIONS.filter((name) => body.integrations?.[name] !== true)
  if (missing.length) problems.push(`no credentials for: ${missing.join(', ')}`)
  if (problems.length === 0 && httpStatus !== 200) problems.push(`health answered ${httpStatus}`)
  return problems
}

async function fetchHealth(appUrl, secret) {
  const url = `${appUrl.replace(/\/+$/, '')}/api/internal/health`
  let lastError
  // One retry, for a cold start or a dropped connection rather than an answer.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'x-internal-secret': secret }, signal: AbortSignal.timeout(TIMEOUT_MS) })
      return { status: response.status, body: await response.json().catch(() => null) }
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(`health did not answer: ${lastError?.name ?? 'unknown error'}`)
}

async function main() {
  const appUrl = process.env.APP_URL?.trim()
  const secret = process.env.INTERNAL_NOTIFY_SECRET?.trim()
  const unset = [!appUrl && 'APP_URL', !secret && 'INTERNAL_NOTIFY_SECRET'].filter(Boolean)
  if (unset.length) throw new Error(`${unset.join(' and ')} unset in this environment`)

  const { status, body } = await fetchHealth(appUrl, secret)
  const problems = healthProblems(status, body)
  for (const problem of problems) console.log(`::error::${problem}`)
  if (problems.length) process.exit(1)
  console.log(`Healthy: last sync ${body.lastSyncedAt}, data commit ${body.dataCommit ?? 'unknown'}.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.log(`::error::${err.message}`)
    process.exit(1)
  })
}
