import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../appState'
import { ChoiceRow } from '../../components/ChoiceRow'
import { Status, type StatusMessage } from '../../components/Status'
import { todayLocal } from '../../lib/dates'
import { copyText } from '../../lib/deliver'
import { buildSummaryText } from '../../lib/export/exportActions'
import { SUMMARY_WEEK_CHOICES } from '../../lib/export/summary'

export function SummaryCard() {
  const { db, settings, updateSetting } = useApp()
  const [text, setText] = useState<string | null>(null)
  const [copied, setCopied] = useState<'copied' | 'blocked' | null>(null)
  const [message, setMessage] = useState<StatusMessage>(null)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const weeks = settings.summaryWeeks

  // The text is out of date as soon as the length changes.
  useEffect(() => { setText(null); setCopied(null); setMessage(null) }, [weeks])
  // If the clipboard is blocked, the text is shown selected so it can be copied by hand.
  useEffect(() => {
    if (copied === 'blocked') { box.current?.focus(); box.current?.select() }
  }, [copied, text])

  async function copy() {
    setBusy(true)
    setMessage(null)
    try {
      const summary = await buildSummaryText(db, weeks, settings.weeklyTarget, todayLocal())
      setText(summary)
      const outcome = await copyText(summary)
      setCopied(outcome)
      setMessage(outcome === 'copied'
        ? { kind: 'ok', text: `Copied ${summary.length.toLocaleString('en-GB')} characters. Paste it into a chat with Claude.` }
        : { kind: 'info', text: 'Copying was blocked by the browser. The text is selected below: long-press it and choose Copy.' })
    } catch (e) {
      setMessage({ kind: 'error', text: `The summary could not be built (${e instanceof Error ? e.message : String(e)}). Your data has not been changed.` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" role="region" aria-label="Copy summary for Claude">
      <h2>Copy summary for Claude</h2>
      <p className="muted">A plain-text digest to paste into a chat. It leaves out opponent names and match notes.</p>
      <ChoiceRow
        label="Period (weeks)" value={weeks}
        options={SUMMARY_WEEK_CHOICES.map((w) => ({ value: w as number, label: String(w), ariaLabel: `${w} weeks` }))}
        onChange={(w) => { void updateSetting({ summaryWeeks: w }) }}
      />
      <button type="button" className="btn btn-big btn-primary" disabled={busy} onClick={copy}>{busy ? 'Building summary' : 'Copy summary for Claude'}</button>
      <Status message={message} />
      {text && (
        <details open={copied === 'blocked'}>
          <summary>{copied === 'blocked' ? 'Summary text (selected for copying)' : 'Show the text that was copied'}</summary>
          <label className="field">
            <span className="sr-only">Summary text</span>
            <textarea ref={box} className="summary-box" readOnly value={text} rows={10} />
          </label>
        </details>
      )}
    </div>
  )
}
