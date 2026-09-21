import { NextResponse, type NextRequest } from 'next/server'
import { handleOwnerRoute } from '@/lib/ownerRoute'

/**
 * Starts the Garmin sync from the app, so the Sync button in Settings does what
 * the iOS shortcut does without the phone holding a GitHub token.
 *
 * The token lives here instead: a shortcut keeps its PAT in a Shortcuts
 * dictionary that syncs to iCloud and shows in plain text to anyone holding an
 * unlocked phone, while this one is a server env var the browser never sees,
 * reachable only behind the owner claim.
 */

interface SyncConfig {
  repo: string
  workflow: string
  ref: string
  token: string
  profile: string | null
}

export function syncConfig(env: NodeJS.ProcessEnv): SyncConfig | { missing: string[] } {
  const missing = (['GITHUB_SYNC_TOKEN', 'GITHUB_SYNC_REPO'] as const).filter((key) => !env[key])
  if (missing.length) return { missing }

  return {
    repo: env.GITHUB_SYNC_REPO!,
    // A file name rather than a numeric id: it survives the workflow being
    // deleted and recreated, which changes the id and nothing else.
    workflow: env.GITHUB_SYNC_WORKFLOW || 'sync.yml',
    ref: env.GITHUB_SYNC_REF || 'main',
    token: env.GITHUB_SYNC_TOKEN!,
    // One deployment is one athlete, so a dispatch from this app should sync
    // that athlete and not the whole matrix. Unset keeps the workflow default.
    profile: env.GITHUB_SYNC_PROFILE || null,
  }
}

export async function POST(req: NextRequest) {
  return handleOwnerRoute('sync-dispatch', req, async () => {
    const config = syncConfig(process.env)
    if ('missing' in config) {
      return NextResponse.json(
        { error: `Sync is not configured: ${config.missing.join(', ')} unset` },
        { status: 503 }
      )
    }

    // Stamped before the call, never after: a verdict written between the
    // dispatch and this timestamp would be read as this run's answer.
    const since = new Date().toISOString()

    const response = await fetch(
      `https://api.github.com/repos/${config.repo}/actions/workflows/${config.workflow}/dispatches`,
      {
        method: 'POST',
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${config.token}`,
          'x-github-api-version': '2022-11-28',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          ref: config.ref,
          ...(config.profile ? { inputs: { profile: config.profile } } : {}),
        }),
      }
    )

    // 204 is the success case; anything else carries a body worth logging but
    // not worth returning, since it can name the repository and the workflow.
    if (!response.ok) {
      console.error('[owner:sync-dispatch] github said', response.status, await response.text())
      return NextResponse.json(
        { error: `GitHub refused the dispatch (${response.status})` },
        { status: 502 }
      )
    }

    return NextResponse.json({ since })
  })
}
