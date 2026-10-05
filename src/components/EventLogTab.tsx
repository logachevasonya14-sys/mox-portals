/** Вкладка «Журнал событий»: все действия с порталами, включая заблокированные попытки. */
import { useState } from 'react'
import { ACTION_LABELS, type EventLogItem, type EventOutcome } from '../logic'
import { ConfirmInline, formatTime } from './ui'

type Props = {
  log: EventLogItem[]
  onClear: () => void
  /** Opens the portal's card. */
  onOpenPortal: (id: string) => void
  /** Portals removed from the list keep their log entries, but there is no card to open. */
  portalExists: (id: string) => boolean
}

type Filter = 'all' | EventOutcome

export function EventLogTab({ log, onClear, onOpenPortal, portalExists }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [confirmClear, setConfirmClear] = useState(false)

  const counts = { all: log.length, done: log.filter((e) => e.outcome === 'done').length, blocked: log.filter((e) => e.outcome === 'blocked').length }
  const visible = filter === 'all' ? log : log.filter((e) => e.outcome === filter)
  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Все' },
    { id: 'done', label: 'Выполнено' },
    { id: 'blocked', label: 'Заблокировано' },
  ]

  return (
    <main>
      <section className="section-heading">
        <div><p className="eyebrow">АУДИТ</p><h2>Журнал событий</h2></div>
        <button className="ghost-button" onClick={() => setConfirmClear(true)} disabled={log.length === 0}>Очистить журнал</button>
        {confirmClear && (
          <ConfirmInline
            message="Очистить журнал? Записи нельзя будет восстановить."
            confirmLabel="Да, очистить"
            onConfirm={() => {
              onClear()
              setConfirmClear(false)
            }}
            onCancel={() => setConfirmClear(false)}
          />
        )}
      </section>

      {log.length > 0 && (
        <div className="log-filters" role="group" aria-label="Фильтр журнала">
          {filters.map((f) => (
            <button key={f.id} className={`log-filter ${f.id} ${filter === f.id ? 'active' : ''}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} <b>{counts[f.id]}</b>
            </button>
          ))}
        </div>
      )}

      <section className="log-card">
        {log.length === 0 ? (
          <div className="detail-placeholder"><h3>Пока пусто</h3><p>Здесь появятся все действия с порталами, включая заблокированные попытки.</p></div>
        ) : visible.length === 0 ? (
          <div className="detail-placeholder"><h3>Таких записей нет</h3><p>Выберите другой фильтр.</p></div>
        ) : visible.map((item) => (
          <article className={`log-row ${item.outcome}`} key={item.id}>
            <time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time>
            <div>
              {portalExists(item.portalId) ? (
                <button className="link-button" onClick={() => onOpenPortal(item.portalId)}>
                  {item.portalName}
                </button>
              ) : (
                <span className="log-portal-removed">{item.portalName} <small>· удалён из списка</small></span>
              )}
              <p>{item.message}</p>
            </div>
            <span className={`log-action ${item.outcome}`}>{item.action === 'questionable' ? 'Пометка «под вопросом»' : ACTION_LABELS[item.action]}{item.outcome === 'blocked' ? ' · заблокировано' : ''}</span>
          </article>
        ))}
      </section>
    </main>
  )
}
