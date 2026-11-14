#!/usr/bin/env node
// The nightly sync's step: the sessions the athlete moved on intervals.icu, recorded so the app's plan follows them.
import path from 'path'
import { appTodayIso, addDays, isoDate } from '@/lib/calendarDate'
import { detectSessionMoves } from '@/domain/coaching/movedSessions'
import { intervalsAthleteId } from '@/application/coaching/syncRoute'
import { JsonCoachingRepository } from '@/infrastructure/repositories/JsonCoachingRepository'
import { JsonIntervalsSyncStore } from '@/infrastructure/repositories/JsonIntervalsSyncStore'
import { HttpIntervalsGateway } from '@/infrastructure/intervals/HttpIntervalsGateway'

const DAYS_BACK = 35
const DAYS_AHEAD = 56

async function main(): Promise<void> {
  const root = path.resolve(process.argv[2] ?? process.env.RUNOMICS_DATA_DIR ?? 'data')
  const apiKey = process.env.INTERVALS_API_KEY?.trim()
  if (!apiKey) {
    console.log('No INTERVALS_API_KEY: sessions moved on intervals.icu are not read for this profile.')
    return
  }

  const repository = new JsonCoachingRepository(root)
  const plan = repository.getCurrentPlanAsWritten()
  const entries = new JsonIntervalsSyncStore(root).read().entries
  if (!plan || entries.length === 0) {
    console.log('No plan pushed to intervals.icu: nothing to compare.')
    return
  }

  const today = new Date(`${appTodayIso()}T00:00:00`)
  const gateway = new HttpIntervalsGateway({ apiKey, athleteId: intervalsAthleteId(process.env) })
  const events = await gateway.listWorkoutEvents(isoDate(addDays(today, -DAYS_BACK)), isoDate(addDays(today, DAYS_AHEAD)))

  const previous = repository.getSessionMoves()
  const moves = detectSessionMoves(plan, entries, events, previous)
  if (JSON.stringify(moves) === JSON.stringify(previous)) {
    console.log(`${Object.keys(moves).length} session(s) moved on intervals.icu, unchanged.`)
    return
  }
  repository.saveSessionMoves(moves)
  console.log(`${Object.keys(moves).length} session(s) moved on intervals.icu (was ${Object.keys(previous).length}).`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
