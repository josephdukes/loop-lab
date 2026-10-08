// Countdown timer for one drill: start, pause, +1 minute; vibration and a beep at zero (gated by settings).
import { useEffect, useRef, useState, type Dispatch } from 'react'
import { primeAudio, timerAlert } from '../lib/alerts'
import { timerRemainingSec, type RunnerAction, type TimerState } from '../lib/runnerState'

function mmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export function DrillTimer({ timer, index, dispatch, sound, vibrate }: {
  timer: TimerState
  index: number
  dispatch: Dispatch<RunnerAction>
  sound: boolean
  vibrate: boolean
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!timer.running) return
    const id = setInterval(() => {
      const n = Date.now()
      setNow(n)
      if (timerRemainingSec(timer, n) <= 0) dispatch({ type: 'timerFinish', index, now: n })
    }, 250)
    return () => clearInterval(id)
  }, [timer, index, dispatch])

  const wasRunning = useRef(timer.running)
  useEffect(() => {
    if (wasRunning.current && !timer.running && timer.remainingSec === 0) timerAlert({ sound, vibrate })
    wasRunning.current = timer.running
  }, [timer.running, timer.remainingSec, sound, vibrate])

  const remaining = timer.running ? timerRemainingSec(timer, now) : timer.remainingSec
  const done = !timer.running && timer.remainingSec === 0 && timer.totalSec > 0

  return (
    <div className="timer" role="group" aria-label="Drill timer">
      {/* The countdown is a timer role (never announced as it ticks); only "Time is up." is spoken, once, at zero. */}
      <output className="timer-face" role="timer" aria-label="Time left" aria-live="off">{mmss(remaining)}</output>
      <p className="muted timer-status" role="status">{done ? 'Time is up.' : ''}</p>
      <div className="row">
        {timer.running ? (
          <button type="button" className="btn btn-big" onClick={() => dispatch({ type: 'timerPause', index, now: Date.now() })}>Pause</button>
        ) : (
          <button
            type="button" className="btn btn-big btn-primary" disabled={timer.remainingSec <= 0}
            onClick={() => { primeAudio(); dispatch({ type: 'timerStart', index, now: Date.now() }) }}
          >{timer.remainingSec < timer.totalSec ? 'Resume timer' : 'Start timer'}</button>
        )}
        <button type="button" className="btn btn-big" onClick={() => dispatch({ type: 'timerAddMinute', index, now: Date.now() })}>+1 minute</button>
      </div>
    </div>
  )
}
