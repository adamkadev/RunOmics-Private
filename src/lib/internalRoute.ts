import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { guardInternalRequest, isAuthorizedCronRequest, isAuthorizedInternalRequest, type InternalAuthorizer } from '@/lib/internalAuth'
import { errorName, jobOutcome, JOB_EVENTS_KEPT, type JobTrigger } from '@/domain/diagnostics/jobEvent'
import { integrationStatus } from '@/infrastructure/integrations'
import { keepJobEvent } from '@/infrastructure/repositories/FirestoreJobEventRepository'
import { withTimeout } from '@/lib/withTimeout'

const TRACE_TIMEOUT_MS = 3_000

/** Vercel keeps a log for about half an hour and Cron never retries, so the run's outcome is kept in Firestore too. */
async function trace(route: string, trigger: JobTrigger, response: NextResponse, error?: unknown): Promise<void> {
  if (!integrationStatus().firebaseAdmin) return
  try {
    const body: unknown = await response.clone().json().catch(() => null)
    const event = {
      at: new Date().toISOString(),
      route,
      trigger,
      outcome: jobOutcome(response.status, body),
      status: response.status,
      ...(error === undefined ? {} : { error: errorName(error) }),
    }
    await withTimeout(keepJobEvent(event, JOB_EVENTS_KEPT), TRACE_TIMEOUT_MS, null)
  } catch (traceError) {
    console.warn(`[internal:${route}] could not keep the run's trace:`, traceError)
  }
}

type Traced = 'every run' | 'errors' | 'never'

async function run(
  name: string,
  req: NextRequest,
  handler: () => Promise<NextResponse>,
  authorize: InternalAuthorizer,
  trigger: JobTrigger,
  traced: Traced
): Promise<NextResponse> {
  const denied = guardInternalRequest(req, authorize)
  if (denied) return denied

  let response: NextResponse
  let thrown: unknown
  try {
    response = await handler()
  } catch (error) {
    console.error(`[internal:${name}]`, error)
    thrown = error
    response = NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  if (traced === 'every run' || (traced === 'errors' && response.status >= 500)) await trace(name, trigger, response, thrown)
  return response
}

/** Traced on a 5xx only, the workflow logs the rest; a probe never, as its 503 is a finding and the sync polls it. */
export function handleInternalRoute(
  name: string,
  req: NextRequest,
  handler: () => Promise<NextResponse>,
  authorize: InternalAuthorizer = isAuthorizedInternalRequest,
  { probe = false }: { probe?: boolean } = {}
): Promise<NextResponse> {
  return run(name, req, handler, authorize, 'sync', probe ? 'never' : 'errors')
}

export type Trigger = 'cron' | 'manual'

/** GET is Vercel Cron's call, POST with the internal secret a run by hand. */
export function scheduledRoute(name: string, handler: (trigger: Trigger) => Promise<NextResponse>) {
  return {
    GET: (req: NextRequest) => run(name, req, () => handler('cron'), isAuthorizedCronRequest, 'cron', 'every run'),
    POST: (req: NextRequest) => run(name, req, () => handler('manual'), isAuthorizedInternalRequest, 'manual', 'every run'),
  }
}
