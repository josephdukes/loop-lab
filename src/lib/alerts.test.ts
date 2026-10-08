// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { beep, primeAudio, timerAlert, vibrate, vibrationSupported } from './alerts'

afterEach(() => { vi.unstubAllGlobals() })

describe('timer alerts fail quietly', () => {
  it('do nothing and do not throw when vibration and audio are unsupported', () => {
    expect(vibrationSupported()).toBe(false)
    expect(() => { primeAudio(); beep(); vibrate(); timerAlert({ sound: true, vibrate: true }) }).not.toThrow()
  })

  it('vibrate only when allowed by the setting and supported', () => {
    const vib = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vib, configurable: true })
    timerAlert({ sound: false, vibrate: false })
    expect(vib).not.toHaveBeenCalled()
    timerAlert({ sound: false, vibrate: true })
    expect(vib).toHaveBeenCalledTimes(1)
    delete (navigator as unknown as { vibrate?: unknown }).vibrate
  })

  it('beeps only after the audio context was primed by a gesture, and only when sound is on', () => {
    const osc = { type: '', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
    const gain = { gain: { value: 0 }, connect: vi.fn() }
    class FakeCtx {
      state = 'running'
      currentTime = 0
      destination = {}
      createOscillator() { return osc }
      createGain() { return gain }
      resume() { return Promise.resolve() }
    }
    vi.stubGlobal('AudioContext', FakeCtx)
    ;(window as unknown as { AudioContext: unknown }).AudioContext = FakeCtx
    beep() // not primed yet: silent
    expect(osc.start).not.toHaveBeenCalled()
    primeAudio()
    timerAlert({ sound: false, vibrate: false })
    expect(osc.start).not.toHaveBeenCalled()
    timerAlert({ sound: true, vibrate: false })
    expect(osc.start).toHaveBeenCalledTimes(1)
  })
})
