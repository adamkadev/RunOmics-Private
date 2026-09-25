import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { NoPinchZoom } from '../NoPinchZoom'

function touchmove(fingers: number): Event {
  const event = new Event('touchmove', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', { value: Array.from({ length: fingers }, () => ({})) })
  return event
}

function mapElement(): HTMLElement {
  const map = document.createElement('div')
  map.className = 'maplibregl-map'
  const canvas = document.createElement('canvas')
  map.appendChild(canvas)
  document.body.appendChild(map)
  return canvas
}

describe('NoPinchZoom', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('cancels a two-finger touchmove on the page', () => {
    render(<NoPinchZoom />)
    const event = touchmove(2)
    document.body.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves one-finger scrolling alone', () => {
    render(<NoPinchZoom />)
    const event = touchmove(1)
    document.body.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })

  it("cancels Safari's own pinch gesture", () => {
    render(<NoPinchZoom />)
    const event = new Event('gesturestart', { bubbles: true, cancelable: true })
    document.body.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('lets the maps keep their pinch', () => {
    render(<NoPinchZoom />)
    const canvas = mapElement()
    const pinch = touchmove(2)
    const gesture = new Event('gesturestart', { bubbles: true, cancelable: true })
    canvas.dispatchEvent(pinch)
    canvas.dispatchEvent(gesture)
    expect(pinch.defaultPrevented).toBe(false)
    expect(gesture.defaultPrevented).toBe(false)
  })

  it('stops blocking once unmounted', () => {
    const { unmount } = render(<NoPinchZoom />)
    unmount()
    const event = touchmove(2)
    document.body.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })
})
