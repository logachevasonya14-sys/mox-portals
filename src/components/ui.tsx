/**
 * Мелкие детали интерфейса, которые нужны в нескольких местах: значок риска, плашка сообщения,
 * плитка с цифрой и форматирование времени.
 */
import { LEVEL_LABELS, type RiskLevel } from '../logic'

export type Notice = { type: 'error' | 'success'; text: string }

export function formatCollapse(minutes: number) {
  if (minutes <= 0) return '—'
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins ? `${hours} ч ${mins} мин` : `${hours} ч`
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** `floating` pins the notice to the corner of the screen, so the page under it does not shift. */
export function NoticeBar({ notice, onClose, floating = false }: { notice: Notice; onClose: () => void; floating?: boolean }) {
  return (
    <div className={`notice ${notice.type} ${floating ? 'toast' : ''}`} role={notice.type === 'error' ? 'alert' : 'status'}>
      <span>{notice.type === 'error' ? '⛔ ' : '✓ '}{notice.text}</span>
      <button onClick={onClose} aria-label="Закрыть">×</button>
    </div>
  )
}

export function RiskBadge({ level, score, large = false, sealed = false }: { level: RiskLevel; score: number; large?: boolean; sealed?: boolean }) {
  if (sealed) return <span className={`risk-badge sealed ${large ? 'large' : ''}`}>закрыт</span>
  return <span className={`risk-badge ${level} ${large ? 'large' : ''}`}><b>{score}</b> {LEVEL_LABELS[level]}</span>
}

/** Confirmation for irreversible actions: overlays the trigger buttons (desktop) or pops up at the bottom (phone), so nothing shifts. */
export function ConfirmInline({ message, confirmLabel, onConfirm, onCancel }: { message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="confirm-inline" role="alertdialog" aria-label={message}>
      <span>⚠ {message}</span>
      <button className="danger-button" onClick={onConfirm}>{confirmLabel}</button>
      <button className="secondary-button" autoFocus onClick={onCancel}>Отмена</button>
    </div>
  )
}

/** `tone` highlights a value that makes the portal dangerous: red for critical, yellow for worrying. */
export function Metric({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'warn' }) {
  return <div className={`metric ${tone ?? ''}`}><span>{label}</span><strong>{value}</strong></div>
}
