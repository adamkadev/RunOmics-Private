import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { BootstrapRequest } from '@/application/ports/CoachingAdvisor'
import { buildCoachingContext } from '@/application/coaching/context'
import { ManualCoachingAdvisor, renderManualPrompt } from '../ManualCoachingAdvisor'

let workspace: string

beforeEach(() => {
  workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-coach-'))
})

afterEach(() => {
  fs.rmSync(workspace, { recursive: true, force: true })
})

const promptPath = () => path.join(workspace, 'coach-prompt.md')
const answerPath = () => path.join(workspace, 'answer.json')

function request(guidance?: string): BootstrapRequest {
  return {
    context: buildCoachingContext({
      activities: [],
      plan: null,
      athlete: {},
      trainingStatus: null,
      loadBalance: null,
      trainingZones: null, trajectories: null,
      latestVo2max: null,
      racePredictions: null,
      goals: [],
      personalBests: [],
      upcomingRaces: [],
      officialResults: [],
    }, '2026-09-07'),
    availableWeekdays: [2, 4, 6],
    runsPerWeek: 3,
    planningStartDate: '2026-09-07',
    horizonEndDate: '2026-09-20',
    macrocycleStartDate: '2026-09-01',
    primaryTargetEvent: { id: 'race-1', name: 'Autumn 10K', date: '2026-09-20', role: 'primary', distanceLabel: '10K', distanceMeters: 10_000 },
    tuneUpEvents: [],
    ...(guidance ? { guidance } : {}),
  }
}

const PLAN = {
  name: 'Autumn block',
  focus: 'Build aerobic volume.',
  weeks: [{
    startDate: '2026-09-07',
    endDate: '2026-09-13',
    focus: 'Steady week.',
    workouts: [{
      date: '2026-09-08',
      type: 'easy',
      title: 'Easy run',
      description: 'A structurally valid session.',
      blocks: [{ kind: 'effort', target: { distanceMeters: 5_000 } }],
    }],
  }],
}

describe('renderManualPrompt', () => {
  it('carries the rules, the athlete context and the answer schema', () => {
    const prompt = renderManualPrompt(request())

    expect(prompt).toContain('Create a conservative running prescription')
    expect(prompt).toContain('"schemaVersion":1')
    expect(prompt).toContain('Return exactly 2 weeks')
    expect(prompt).toContain('no markdown code fence')
  })

  it('states the schema in the dialect a chat reads, not Gemini\'s', () => {
    const prompt = renderManualPrompt(request())
    const schema = prompt.slice(prompt.indexOf('{', prompt.indexOf('validate against this schema')))

    expect(JSON.parse(schema)).toMatchObject({ type: 'object', properties: { weeks: { type: 'array' } } })
    expect(schema).not.toContain('OBJECT')
  })

  it('passes a rejection reason through so the correction can be asked for', () => {
    expect(renderManualPrompt(request('Your previous answer was rejected: too timid'))).toContain('too timid')
  })
})

describe('ManualCoachingAdvisor', () => {
  it('writes the prompt and stops when no answer has been supplied', async () => {
    const advisor = new ManualCoachingAdvisor(promptPath(), undefined)

    await expect(advisor.bootstrap(request())).rejects.toThrow(/coach-prompt\.md/)
    expect(fs.readFileSync(promptPath(), 'utf-8')).toContain('You are a running coach')
  })

  it('returns the pasted plan as a draft', async () => {
    fs.writeFileSync(answerPath(), JSON.stringify(PLAN))

    await expect(new ManualCoachingAdvisor(promptPath(), answerPath()).bootstrap(request()))
      .resolves.toMatchObject({ name: 'Autumn block', weeks: [{ startDate: '2026-09-07' }] })
    expect(fs.existsSync(promptPath())).toBe(false)
  })

  it('accepts a reply the chat wrapped in a code fence anyway', async () => {
    fs.writeFileSync(answerPath(), '```json\n' + JSON.stringify(PLAN) + '\n```')

    await expect(new ManualCoachingAdvisor(promptPath(), answerPath()).bootstrap(request()))
      .resolves.toMatchObject({ name: 'Autumn block' })
  })

  it('says the reply has not been saved yet rather than reporting a bare ENOENT', async () => {
    await expect(new ManualCoachingAdvisor(promptPath(), answerPath()).bootstrap(request()))
      .rejects.toThrow(/--from-answer .*answer\.json does not exist/)
  })

  it('names the file when the reply is not JSON at all', async () => {
    fs.writeFileSync(answerPath(), 'Sure! Here is your training plan:')

    await expect(new ManualCoachingAdvisor(promptPath(), answerPath()).bootstrap(request()))
      .rejects.toThrow(/answer\.json is not valid JSON/)
  })

  it('asks again on disk rather than replaying a plan the validator rejected', async () => {
    fs.writeFileSync(answerPath(), JSON.stringify(PLAN))
    const advisor = new ManualCoachingAdvisor(promptPath(), answerPath())
    await advisor.bootstrap(request())

    await expect(advisor.bootstrap(request('Your previous answer was rejected: too timid')))
      .rejects.toThrow(/coach-prompt\.md/)
    expect(fs.readFileSync(promptPath(), 'utf-8')).toContain('too timid')
  })

  it('covers bootstrap only', async () => {
    const advisor = new ManualCoachingAdvisor(promptPath(), answerPath())

    await expect(advisor.evaluateActivity()).rejects.toThrow(/bootstrap only/)
    await expect(advisor.reviewWeek()).rejects.toThrow(/bootstrap only/)
  })
})
