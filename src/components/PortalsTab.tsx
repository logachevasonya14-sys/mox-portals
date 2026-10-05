/**
 * Вкладка «Порталы»: сводка, три самых опасных портала, таблица и место для карточки справа.
 * Саму карточку App передаёт внутрь как children — так эта вкладка не знает про действия и журнал.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { calculateRisk, LEVEL_LABELS, STATUS_LABELS, type Portal, type RiskBreakdown } from '../logic'
import { ConfirmInline, formatCollapse, RiskBadge } from './ui'

type PortalWithRisk = { portal: Portal; risk: RiskBreakdown }

type Props = {
  portals: Portal[]
  selectedId: string | null
  onSelect: (id: string) => void
  onClear: () => void
  onReset: () => void
  /** Empty state: loads the demo portals without touching the log. */
  onLoadDemo: () => void
  /** The selected portal's card; null shows the "choose a portal" placeholder. */
  children: ReactNode
}

export function PortalsTab({ portals, selectedId, onSelect, onClear, onReset, onLoadDemo, children }: Props) {
  // Demo controls wipe data, so each asks for confirmation first.
  const [confirmDemo, setConfirmDemo] = useState<'clear' | 'reset' | null>(null)

  // Most dangerous first, closed portals at the end.
  const enriched = useMemo(
    () =>
      portals
        .map((portal) => ({ portal, risk: calculateRisk(portal) }))
        .sort((a, b) =>
          Number(a.portal.status === 'closed') - Number(b.portal.status === 'closed') ||
          b.risk.total - a.risk.total),
    [portals],
  )

  const summary = useMemo(() => {
    const active = enriched.filter(({ portal }) => portal.status !== 'closed')
    return {
      open: active,
      critical: active.filter(({ risk }) => risk.level === 'critical'),
      closed: enriched.filter(({ portal }) => portal.status === 'closed'),
      priority: active.filter(({ portal, risk }) =>
        risk.level === 'critical' || risk.level === 'high' || portal.status === 'questionable'),
    }
  }, [enriched])

  return (
    <main>
      <section className="summary-grid">
        <SummaryCard label="Открыто" items={summary.open} helper="открыты или под вопросом" onSelect={onSelect} />
        <SummaryCard label="Критичных" items={summary.critical} helper="риск ≥ 80, действовать сейчас" urgent={summary.critical.length > 0} onSelect={onSelect} />
        <SummaryCard label="Закрыто" items={summary.closed} helper="запечатанные порталы" onSelect={onSelect} />
        <SummaryCard label="Требуют внимания" items={summary.priority} helper="критичные / высокий риск / под вопросом" onSelect={onSelect} />
      </section>

      <section className="section-heading">
        <div>
          <p className="eyebrow">РЕЕСТР ПОРТАЛОВ</p>
          <h2>Состояние порталов</h2>
        </div>
        {/* The buttons always stay in place; the confirmation is laid over them (desktop) or pops up at the bottom (phone). */}
        <div className="demo-controls" aria-label="Демо-данные">
          <span className="demo-label">ДЕМО-ДАННЫЕ</span>
          <button className="ghost-button" onClick={() => setConfirmDemo('clear')} disabled={portals.length === 0}>Очистить список</button>
          <button className="ghost-button" onClick={() => setConfirmDemo('reset')}>Сбросить демо</button>
        </div>
        {confirmDemo && (
          <ConfirmInline
            message={confirmDemo === 'clear' ? 'Удалить все порталы? Журнал сохранится.' : 'Вернуть демо-данные? Текущие порталы и журнал будут удалены.'}
            confirmLabel={confirmDemo === 'clear' ? 'Да, очистить' : 'Да, сбросить'}
            onConfirm={() => {
              if (confirmDemo === 'clear') onClear()
              else onReset()
              setConfirmDemo(null)
            }}
            onCancel={() => setConfirmDemo(null)}
          />
        )}
      </section>

      {portals.length === 0 ? (
        <section className="empty-or-error-card empty-state">
          <div className="portal-glyph">◌</div>
          <p className="eyebrow">СИГНАЛОВ НЕТ</p>
          <h2>В лаборатории подозрительно тихо.</h2>
          <p>Ни одного портала не загружено.</p>
          <button className="primary-button" onClick={onLoadDemo}>Загрузить демо-данные</button>
        </section>
      ) : (
        <section className="portal-layout">
          <div className="portal-main">
            <PortalDoors rows={enriched} selectedId={selectedId} onSelect={onSelect} />
            <PortalTable rows={enriched} selectedId={selectedId} onSelect={onSelect} />
          </div>

          {/* On phones the card opens as a separate full-screen view (see styles.css). */}
          <aside className={`detail-card ${children ? 'has-portal' : ''}`}>
            {children ?? (
              <div className="detail-placeholder">
                <div className="portal-glyph small">◉</div>
                <h3>Выберите портал</h3>
                <p>Нажмите на портал в ряду или на строку таблицы, чтобы увидеть риск, историю и доступные действия.</p>
              </div>
            )}
          </aside>
        </section>
      )}
    </main>
  )
}

/**
 * All portals as glowing doors, most dangerous first.
 * Colour and glow = risk level; frame = status (solid open, dashed questionable, crossed-out closed).
 */
function PortalDoors({ rows, selectedId, onSelect }: { rows: PortalWithRisk[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <section className="doors-block">
      <p className="eyebrow">ВСЕ ПОРТАЛЫ · СНАЧАЛА САМЫЕ ОПАСНЫЕ</p>
      <div className="doors">
        {rows.map(({ portal, risk }) => {
          const closed = portal.status === 'closed'
          return (
            <button
              key={portal.id}
              className={`door ${closed ? 'sealed' : risk.level} ${portal.status} ${selectedId === portal.id ? 'selected' : ''}`}
              onClick={() => onSelect(portal.id)}
              aria-label={`${portal.name} → ${portal.destination}: ${closed ? 'закрыт' : `риск ${risk.total}, ${LEVEL_LABELS[risk.level]}`}`}
            >
              {/* one word per line: every name is two words, so all doors get the same two-line, centred label */}
              <span className="door-name">{portal.name.split(' ').map((word) => <span key={word}>{word}</span>)}</span>
              <span className="door-destination" title={portal.destination}>→ {portal.destination}</span>
              <svg className="door-svg" viewBox="0 0 64 88" aria-hidden="true">
                <rect className="door-frame" x="4" y="4" width="56" height="80" rx="4" />
                <rect className="door-inner" x="13" y="13" width="38" height="62" rx="2" />
                {closed ? (
                  <path className="door-x" d="M19 21 L45 67 M45 21 L19 67" />
                ) : (
                  <text className="door-score" x="32" y="50" textAnchor="middle">{risk.total}</text>
                )}
                {portal.status === 'questionable' && <text className="door-q" x="32" y="25" textAnchor="middle">?</text>}
              </svg>
              <span className="door-status">{closed ? 'запечатан' : portal.status === 'questionable' ? 'под вопросом' : LEVEL_LABELS[risk.level]}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function PortalTable({ rows, selectedId, onSelect }: { rows: PortalWithRisk[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Портал / мир</th>
              <th>Энергия</th>
              <th>Стабильность</th>
              <th>До схлопывания</th>
              <th>Существ</th>
              <th>Риск</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ portal, risk }) => (
              <tr
                key={portal.id}
                className={`row-${portal.status === 'closed' ? 'sealed' : risk.level} ${selectedId === portal.id ? 'selected-row' : ''} ${portal.status === 'closed' ? 'closed-row' : ''}`}
                tabIndex={0}
                aria-current={selectedId === portal.id ? 'true' : undefined}
                onClick={() => onSelect(portal.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(portal.id)
                  }
                }}
              >
                <td>
                  <strong>{portal.name}</strong>
                  <small>{portal.destination}</small>
                </td>
                {/* data-label is shown on phones, where the table turns into cards */}
                <td data-label="Энергия">{portal.energy}</td>
                <td data-label="Стабильность">{portal.stability}</td>
                <td data-label="До схлопывания">{formatCollapse(portal.collapseMinutes)}</td>
                <td data-label="Существ">{portal.creaturesInside}</td>
                <td><RiskBadge level={risk.level} score={risk.total} sealed={portal.status === 'closed'} /></td>
                <td><span className={`status-dot ${portal.status}`} /> {STATUS_LABELS[portal.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Summary tile; the portal list drops down over the page, so nothing below it shifts. */
function SummaryCard({ label, items, helper, urgent = false, onSelect }: {
  label: string
  items: PortalWithRisk[]
  helper: string
  urgent?: boolean
  onSelect: (id: string) => void
}) {
  const ref = useRef<HTMLDetailsElement>(null)

  // Close the dropdown on a click anywhere outside it.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  return (
    <details ref={ref} className={`summary-card ${urgent ? 'urgent' : ''}`}>
      <summary>
        <p>{label}</p>
        <strong>{items.length}</strong>
        <small>{helper}</small>
        <span className="summary-toggle" aria-hidden="true">
          <span className="when-closed">Развернуть ▾</span>
          <span className="when-open">Свернуть ▴</span>
        </span>
      </summary>
      <div className="summary-pop">
        {items.length === 0 ? (
          <span className="summary-empty">Таких порталов нет</span>
        ) : (
          <ul className="summary-list">
            {items.map(({ portal, risk }) => (
              <li key={portal.id}>
                <button
                  onClick={() => {
                    if (ref.current) ref.current.open = false
                    onSelect(portal.id)
                  }}
                >
                  <span>{portal.name}</span>
                  <RiskBadge level={risk.level} score={risk.total} sealed={portal.status === 'closed'} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}
