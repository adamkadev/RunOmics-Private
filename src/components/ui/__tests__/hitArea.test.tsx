import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Pill } from '@/components/ui/Pill'
import { BackButton } from '@/components/ui/BackButton'
import { SaveButton } from '@/components/ui/SaveButton'
import { ShareButton } from '@/components/activity/ShareButton'
import type { ShareActivity } from '@/lib/shareCardStats'
import { t } from '@/i18n'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }))

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

  it('wraps the back link, Share and Save', () => {
    render(
      <>
        <BackButton label="Progress" fallbackHref="/profile" />
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
