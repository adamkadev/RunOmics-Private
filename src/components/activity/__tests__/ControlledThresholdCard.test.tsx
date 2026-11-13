import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ControlledRunView } from '@/application/coaching/controlledRunView'
import { t } from '@/i18n'
import { ControlledThresholdCard } from '../ControlledThresholdCard'

const view: ControlledRunView = {
  windowStartSeconds: 180,
  reading: {
    date: '2026-10-21',
    activityId: 'run',
    prescriptionId: 'session',
    repClass: 'long',
    guide: { min: 272, max: 280 },
    targetHr: 169,
    ceilingHr: 173,
    tempC: 12,
    reps: [
      { seconds: 480, paceSecPerKm: 276, windowHr: 166, windowMaxHr: 170 },
      { seconds: 480, paceSecPerKm: 275, windowHr: 171, windowMaxHr: 174 },
    ],
    verdict: 'over',
  },
}

describe('ControlledThresholdCard', () => {
  it("puts each rep's pace against the plan's guide, then its heart rate from minute 3 against the target and ceiling", () => {
    render(<ControlledThresholdCard view={view} />)

    expect(screen.getByTestId('controlled-verdict').textContent).toBe(t.coaching.controlledRun.verdicts.over)
    expect(screen.getAllByTestId('controlled-rep').map((row) => row.textContent)).toEqual(['14:36166170', '24:35171174'])
    expect(screen.getAllByTestId('pace-track').every((track) => !track.querySelector('[data-off]'))).toBe(true)
    expect(screen.getByText(t.coaching.controlledRun.footnote(3, 169, 173))).toBeTruthy()
  })

  it('says which way the reps left the guide', () => {
    const fast = { ...view, reading: { ...view.reading, verdict: 'off_guide' as const, reps: [{ ...view.reading.reps[0]!, paceSecPerKm: 262 }] } }
    render(<ControlledThresholdCard view={fast} />)

    expect(screen.getByTestId('controlled-verdict').textContent).toBe(t.coaching.controlledRun.offGuideFaster)
    expect(screen.getByTestId('pace-track').querySelector('[data-off]')).not.toBeNull()
  })
})
