import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Pill } from '@/components/ui/Pill'
import { PeriodNav } from '@/components/ui/PeriodNav'
import { ChartCardHead } from '@/components/ui/ChartCard'
import { ChartRangeChips, ChartWindowPager } from '@/components/ui/ChartWindowNav'
import { BackButton } from '@/components/ui/BackButton'
import { SortDropdown } from '@/components/ui/SortDropdown'
import { SaveButton } from '@/components/ui/SaveButton'
import { ShareButton } from '@/components/activity/ShareButton'
import type { ShareActivity } from '@/lib/shareCardStats'
import { t } from '@/i18n'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }))

/**
 * The ⓘ buttons were about 18 pt, the window chevrons 24, the range chips 32
 * and the filter pills 36. `.hit-44` gives each a 44 pt target without
 * changing how it is drawn, and it lives in the primitives so no page has to
 * remember it.
 */

const css = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('the 44 pt hit area', () => {
  it('is a utility sized by --tap-min', () => {
    expect(css).toMatch(/--tap-min:\s+44px;/)
    const utility = css.slice(css.indexOf('@utility hit-44'))
    expect(utility).toMatch(/width: max\(100%, var\(--tap-min\)\)/)
    expect(utility).toMatch(/height: max\(100%, var\(--tap-min\)\)/)
  })

  it('wraps a pill the thumb has to hit, and leaves a label pill alone', () => {
    render(
      <>
        <Pill as="button" onClick={() => {}}>Filter</Pill>
        <Pill>Label</Pill>
      </>,
    )

    expect(screen.getByRole('button', { name: 'Filter' }).className).toContain('hit-44')
    expect(screen.getByText('Label').className).not.toContain('hit-44')
  })

  it('wraps the ⓘ in a chart head', () => {
    render(<ChartCardHead title="Load" footnote="How load is counted." />)

    expect(screen.getByRole('button', { name: t.analytics.aboutChart }).className).toContain('hit-44')
  })

  it('wraps the window chevrons and each range chip', () => {
    render(
      <>
        <ChartWindowPager
          bounds={{ from: '2026-09-01', to: '2026-09-28' }}
          canGoBack
          canGoForward
          onBack={() => {}}
          onForward={() => {}}
        />
        <ChartRangeChips value="4w" onChange={() => {}} />
      </>,
    )

    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('hit-44')
    }
  })

  it('wraps the small period chevrons', () => {
    render(<PeriodNav size="sm" label="2026" onPrev={() => {}} onNext={() => {}} />)

    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('hit-44')
    }
  })

  // Design review, Oct 2026: the back link, the sort menu, Share and the
  // note's Save were drawn at 22-36 pt and tapped there.
  it('wraps the back link, the sort menu, Share and Save', () => {
    render(
      <>
        <BackButton label="Progress" fallbackHref="/profile" />
        <SortDropdown options={[{ value: 'date', label: 'Date' }]} sortBy="date" order="desc" onChange={() => {}} label="Sort" />
        <ShareButton activity={{} as ShareActivity} />
        <SaveButton state="idle" />
      </>,
    )

    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('hit-44')
    }
    // The compact title bar's chevron and action press these two.
    expect(screen.getByRole('button', { name: 'Progress' }).hasAttribute('data-bar-back')).toBe(true)
    expect(screen.getByRole('button', { name: t.activity.share }).getAttribute('data-bar-action')).toBe('share')
  })
})
