'use client'

import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from 'recharts'
import { CHART_COLORS } from '@/lib/colors'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartCardHead } from '@/components/ui/ChartCard'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { StatusPill } from '@/components/ui/StatusPill'
import { formFade } from '@/domain/activity/formFade'
import { cleanStream, paddedDomain } from '@/domain/activity/cleanStream'
import { t } from '@/i18n'
import { kmTicks } from './chartAxis'

interface Props {
  cadenceSamples: number[] | null
  distanceKm: number
}

const HEIGHT = 96

export function FormThroughRun({ cadenceSamples, distanceKm }: Props) {
  const fade = formFade(cadenceSamples, distanceKm)
  if (!fade || !cadenceSamples) return null

  const f = t.activity.dynamics.form
  const values = cleanStream(cadenceSamples, { min: 60, max: 250, spikeFloor: 25 })
  const domain = paddedDomain(values, 20)
  if (!domain) return null

  const n = values.length
  const data = values.map((spm, i) => ({ d: (i / (n - 1)) * distanceKm, spm }))

  const faded = fade.fadedFromKm != null

  return (
    <GlassSurface variant="card" className="p-5">
      <ChartCardHead
        title={f.title}
        unit={t.units.spm}
        footnote={f.definition}
        controls={<StatusPill tone={faded ? 'warn' : 'good'}>{faded ? f.faded(fade.fadedFromKm!.toFixed(1)) : f.held}</StatusPill>}
      />
      <ChartFigure summary={f.summary}>
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <LineChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
            <XAxis
              dataKey="d"
              type="number"
              domain={[0, distanceKm]}
              ticks={kmTicks(distanceKm)}
              tickFormatter={(v) => (v === 0 ? '' : `${v}`)}
              tick={{ fontSize: 10, fill: CHART_COLORS.axisTick }}
              axisLine={false}
              tickLine={false}
              height={18}
            />
            <YAxis domain={domain} hide />
            {fade.fadedFromKm != null && (
              <ReferenceLine x={fade.fadedFromKm} stroke={CHART_COLORS.hr} strokeOpacity={0.5} strokeDasharray="3 3" />
            )}
            <Line
              type="monotone"
              dataKey="spm"
              stroke={CHART_COLORS.cadence}
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFigure>
    </GlassSurface>
  )
}
