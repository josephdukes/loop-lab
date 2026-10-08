// A short result message under a button: success is a polite "status", a problem is an "alert". Always text, never colour alone.
export type StatusMessage = { kind: 'ok' | 'error' | 'info'; text: string } | null

export function Status({ message }: { message: StatusMessage }) {
  if (!message) return null
  const prefix = message.kind === 'ok' ? 'Done: ' : message.kind === 'error' ? 'Problem: ' : ''
  return (
    <p className={`status status-${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>
      {prefix && <strong>{prefix}</strong>}{message.text}
    </p>
  )
}
