// Timer-end alerts: vibration and a WebAudio beep. Both are feature-detected and fail quietly.
// Audio can only start after a user gesture, so primeAudio() is called from the Start button's click.

let ctx: AudioContext | null = null

type AudioCtor = new () => AudioContext

function audioCtor(): AudioCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor }
  return w.AudioContext ?? w.webkitAudioContext
}

export function audioSupported(): boolean {
  return !!audioCtor()
}

export function vibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/** Call from a tap/click handler. Creates or resumes the audio context so a later beep is allowed. */
export function primeAudio(): void {
  try {
    const Ctor = audioCtor()
    if (!Ctor) return
    if (!ctx) ctx = new Ctor()
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  } catch { /* ignore */ }
}

export function beep(): void {
  try {
    if (!ctx) return // never primed by a gesture: stay silent rather than fail
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.25
    osc.connect(gain)
    gain.connect(ctx.destination)
    const t = ctx.currentTime
    osc.start(t)
    osc.stop(t + 0.35)
  } catch { /* ignore */ }
}

export function vibrate(): void {
  try {
    if (vibrationSupported()) navigator.vibrate([300, 150, 300])
  } catch { /* ignore */ }
}

/** Fire the alerts the settings allow. */
export function timerAlert(opts: { sound: boolean; vibrate: boolean }): void {
  if (opts.sound) beep()
  if (opts.vibrate) vibrate()
}
