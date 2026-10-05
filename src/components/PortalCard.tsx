/**
 * Карточка выбранного портала: цифры, рекомендация, риски, разбор формулы, кнопки действий и история.
 * Сама ничего не решает и не меняет — только показывает данные и сообщает App о нажатиях.
 */
import {
  ACTION_LABELS, calculateRisk, getRecommendedAction, getRiskFactors, STATUS_LABELS, validateAction,
  type EventLogItem, type Portal, type PortalAction,
} from '../logic'
import { formatCollapse, formatTime, Metric, NoticeBar, RiskBadge, type Notice } from './ui'

/** An allowed action that came with a warning and waits for the keeper's second confirmation. */
export type PendingAction = { portalId: string; action: PortalAction; warning: string }

const ACTIONS: PortalAction[] = ['stabilize', 'observer', 'questionable', 'close']
const HISTORY_PREVIEW = 6

type Props = {
  portal: Portal
  history: EventLogItem[]
  feedback: Notice | null
  pending: PendingAction | null
  onAction: (action: PortalAction) => void
  onConfirm: (action: PortalAction) => void
  onCancel: () => void
  onCloseFeedback: () => void
  /** "← К порталам" — shown only on phones, where the card is a separate screen. */
  onClose: () => void
}

export function PortalCard({ portal, history, feedback, pending, onAction, onConfirm, onCancel, onCloseFeedback, onClose }: Props) {
  const risk = calculateRisk(portal)
  const sealed = portal.status === 'closed'
  const tone = sealed ? 'sealed' : risk.level

  return (
    <>
      {/* On phones the card is a separate screen; this bar (hidden on desktop) leads back to the list. */}
      <div className="card-back-bar">
        <button className="card-back" onClick={onClose}>← К порталам</button>
      </div>

      {/* Fixed-height header: the status is a chip, not part of the title, so long statuses don't wrap and push content. */}
      <div className={`card-head ${tone}`}>
        <div className="card-head-row">
          <p className="eyebrow">КАРТОЧКА ПОРТАЛА</p>
          <span className={`status-chip ${portal.status}`}>{STATUS_LABELS[portal.status]}</span>
        </div>
        <h2>{portal.name}</h2>
        <div className="card-head-row">
          <p className="card-destination">→ {portal.destination}</p>
          <RiskBadge level={risk.level} score={risk.total} sealed={sealed} large />
        </div>
      </div>

      <div className={`risk-meter ${tone}`}><span style={{ width: `${risk.total}%` }} /></div>

      {/* Dangerous values are highlighted with the same thresholds as the risk factors in logic.ts. */}
      <div className="metric-grid">
        <Metric label="Энергия" value={`${portal.energy}/100`} tone={!sealed && portal.energy >= 70 ? 'danger' : undefined} />
        <Metric
          label="Стабильность"
          value={`${portal.stability}/100`}
          tone={sealed ? undefined : portal.stability < 40 ? 'danger' : portal.stability < 70 ? 'warn' : undefined}
        />
        <Metric
          label="До схлопывания"
          value={formatCollapse(portal.collapseMinutes)}
          tone={sealed ? undefined : portal.collapseMinutes <= 30 ? 'danger' : portal.collapseMinutes <= 60 ? 'warn' : undefined}
        />
        <Metric
          label="Существ внутри"
          value={String(portal.creaturesInside)}
          tone={portal.creaturesInside === 0 ? undefined : sealed ? 'danger' : 'warn'}
        />
      </div>

      {/* Buttons sit right under the fixed-size metrics, so nothing above them changes height;
          confirmation and feedback appear below them. */}
      <div className="action-grid">
        {ACTIONS.map((action) => {
          const v = validateAction(portal, action)
          const blocked = !v.allowed
          return (
            <button
              key={action}
              className={`${action === 'stabilize' ? 'primary-button' : action === 'close' ? 'danger-button' : 'secondary-button'} ${blocked ? 'is-blocked' : ''}`}
              title={blocked ? v.reason : v.warning}
              aria-disabled={blocked}
              onClick={() => onAction(action)}
            >
              {blocked && '🔒 '}{action === 'questionable' && portal.status === 'questionable' ? 'Снять пометку «под вопросом»' : ACTION_LABELS[action]}
            </button>
          )
        })}
      </div>

      {pending?.portalId === portal.id ? (
        <div className="confirm-box" role="alertdialog" aria-label={`Подтверждение: ${ACTION_LABELS[pending.action]}`}>
          <p><b>⚠ {pending.warning}</b></p>
          <div className="action-grid">
            <button className="danger-button" onClick={() => onConfirm(pending.action)}>
              {pending.action === 'close' ? 'Да, закрыть навсегда' : `Всё равно: ${ACTION_LABELS[pending.action]}`}
            </button>
            <button className="secondary-button" autoFocus onClick={onCancel}>Отмена</button>
          </div>
        </div>
      ) : (
        feedback && <NoticeBar notice={feedback} onClose={onCloseFeedback} />
      )}

      <div className="recommendation">
        <p className="eyebrow">РЕКОМЕНДУЕМОЕ ДЕЙСТВИЕ</p>
        <strong>{getRecommendedAction(portal)}</strong>
      </div>

      <RiskFactors portal={portal} />

      <details className="risk-breakdown">
        <summary>Почему {risk.total}/100? Разбор формулы</summary>
        <div><span>Энергия × 0.35</span><b>+{risk.energy}</b></div>
        <div><span>(100 − стабильность) × 0.45</span><b>+{risk.instability}</b></div>
        <div><span>Срочность схлопывания × 0.20</span><b>+{risk.urgency}</b></div>
        <div className="total"><span>Итого</span><b>{risk.total}/100</b></div>
      </details>

      <div className="history">
        <p className="eyebrow">
          ИСТОРИЯ ({history.length > HISTORY_PREVIEW
            ? `последние ${HISTORY_PREVIEW} из ${history.length}`
            : history.length})
        </p>
        {history.length === 0 ? (
          <p className="muted small">С этим порталом ещё ничего не делали.</p>
        ) : (
          <ul>
            {history.slice(0, HISTORY_PREVIEW).map((item) => (
              <li key={item.id} className={item.outcome}>
                <time>{formatTime(item.createdAt)}</time>
                <span>{item.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function RiskFactors({ portal }: { portal: Portal }) {
  const factors = getRiskFactors(portal)
  if (factors.length === 0) return null
  return (
    <div className="risk-factors">
      <p className="eyebrow">РИСКИ</p>
      <ul>{factors.map((f) => <li key={f}>{f}</li>)}</ul>
    </div>
  )
}
