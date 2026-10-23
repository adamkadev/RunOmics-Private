import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BuildInfo, LONG_PRESS_MS, buildReport, deviceSummary } from '../BuildInfo'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1'
const HOME_SCREEN = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'

describe('deviceSummary', () => {
  it('names the OS version, the browser and whether it runs from the home screen', () => {
    expect(deviceSummary({ userAgent: HOME_SCREEN, standalone: true })).toBe('iOS 26.0 · Safari PWA')
    expect(deviceSummary({ userAgent: IPHONE, standalone: false })).toBe('iOS 26.0 · Safari')
    expect(deviceSummary({ userAgent: MAC_CHROME, standalone: false })).toBe('macOS · Chrome')
  })
})

describe('buildReport', () => {
  it('reads like the mock: version, commit, device', () => {
    expect(buildReport({ userAgent: HOME_SCREEN, standalone: true }, '4.9.0', '22687eb'))
      .toBe('RunOmics 4.9.0 (22687eb) · iOS 26.0 · Safari PWA')
  })
})

describe('BuildInfo', () => {
  const writeText = vi.fn(() => Promise.resolve())
  beforeEach(() => {
    vi.useFakeTimers()
    // Defined, not assigned: a file before this one in the worker may have
    // left a getter-only clipboard behind (user-event installs one).
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  })
  afterEach(() => {
    vi.useRealTimers()
    writeText.mockClear()
  })

  it('shows "RunOmics <version> · <commit>" and no button', () => {
    render(<BuildInfo onCopied={() => {}} />)
    expect(screen.getByTestId('build-info').textContent).toMatch(/^RunOmics \S+ · \S+$/)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('copies after a 500 ms press, then reports it', async () => {
    const onCopied = vi.fn()
    render(<BuildInfo onCopied={onCopied} />)
    const line = screen.getByTestId('build-info')
    fireEvent.pointerDown(line)
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS - 1) })
    expect(writeText).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^RunOmics \S+ \(\S+\) · /))
    expect(onCopied).toHaveBeenCalled()
  })

  it('does nothing on a tap', () => {
    render(<BuildInfo onCopied={() => {}} />)
    const line = screen.getByTestId('build-info')
    fireEvent.pointerDown(line)
    act(() => { vi.advanceTimersByTime(200) })
    fireEvent.pointerUp(line)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(writeText).not.toHaveBeenCalled()
  })
})
