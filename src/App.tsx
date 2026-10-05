/**
 * Корень интерфейса. Здесь хранится состояние (порталы, журнал, что выбрано) и обработчики действий,
 * а рисуют всё компоненты из components/. Правила — в logic.ts.
 *
 *   components/PortalsTab   — сводка, визуальные порталы, таблица
 *   components/PortalCard   — карточка выбранного портала с кнопками
 *   components/EventLogTab  — журнал событий
 *   components/WorklogTab   — AI Worklog
 *   components/ui           — общие мелочи: значок риска, плашка, форматирование
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  applyAction, calculateRisk, creatures, demoPortals, isLogItem, isPortal, LOG_KEY, LOG_LIMIT, makeId,
  parseStored, readStorage, STORAGE_KEY, validateAction, writeStorage,
  type EventLogItem, type EventOutcome, type Portal, type PortalAction,
} from './logic'
import { EventLogTab } from './components/EventLogTab'
import { PortalCard, type PendingAction } from './components/PortalCard'
import { PortalsTab } from './components/PortalsTab'
import { NoticeBar, type Notice } from './components/ui'
import { WorklogTab } from './components/WorklogTab'

type Tab = 'portals' | 'activity' | 'worklog'

export default function App() {
  const [tab, setTab] = useState<Tab>('portals')
  const [portals, setPortals] = useState<Portal[]>(
    () => parseStored(readStorage(STORAGE_KEY), isPortal) ?? demoPortals,
  )
  const [log, setLog] = useState<EventLogItem[]>(() => parseStored(readStorage(LOG_KEY), isLogItem) ?? [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)
  // Global notices (reset / clear) pop up in the corner; action feedback renders under the card buttons.
  const [notice, setNotice] = useState<Notice | null>(null)
  const [feedback, setFeedback] = useState<Notice | null>(null)

  useEffect(() => writeStorage(STORAGE_KEY, portals), [portals])
  useEffect(() => writeStorage(LOG_KEY, log), [log])

  // The floating notice hides itself after a few seconds.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  const selected = portals.find((portal) => portal.id === selectedId) ?? null

  // On phones the card is a separate screen (the list is hidden while it is open), so:
  // - the system "Back" button/gesture closes it instead of leaving the site;
  // - closing it returns to the same place in the list.
  const listScrollY = useRef<number | null>(null)
  useEffect(() => {
    // After a page reload the card is closed, so drop a stale "card is open" history entry.
    if (window.history.state?.portalCard) window.history.replaceState(null, '')
    function onPopState() {
      setSelectedId(null)
      setPending(null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useLayoutEffect(() => {
    if (selectedId !== null && listScrollY.current !== null) window.scrollTo(0, 0)
    if (selectedId === null && listScrollY.current !== null) {
      window.scrollTo(0, listScrollY.current)
      listScrollY.current = null
    }
  }, [selectedId])

  function selectPortal(id: string) {
    if (!portals.some((p) => p.id === id)) return
    const opensScreen = window.matchMedia('(max-width: 980px)').matches && !window.history.state?.portalCard
    if (opensScreen) {
      listScrollY.current = window.scrollY
      window.history.pushState({ portalCard: true }, '')
    }
    setSelectedId(id)
    setPending(null)
    setNotice(null)
    setFeedback(null)
    setTab('portals')
  }

  function deselectPortal() {
    // If the card screen added a history entry, going back removes it and the popstate handler closes the card.
    if (window.history.state?.portalCard) {
      window.history.back()
      return
    }
    setSelectedId(null)
    setPending(null)
  }

  function appendLog(portal: Portal, action: PortalAction, outcome: EventOutcome, message: string) {
    const entry: EventLogItem = {
      id: makeId(),
      portalId: portal.id,
      portalName: portal.name,
      action,
      outcome,
      message,
      createdAt: new Date().toISOString(),
    }
    setLog((current) => [entry, ...current].slice(0, LOG_LIMIT))
  }

  function handleAction(action: PortalAction) {
    if (!selected) return
    setPending(null)

    const validation = validateAction(selected, action)
    if (!validation.allowed) {
      appendLog(selected, action, 'blocked', validation.reason)
      setFeedback({ type: 'error', text: validation.reason })
      return
    }

    if (validation.warning) {
      // A warned action (e.g. closing a portal) is not forbidden, but needs a second confirmation.
      setPending({ portalId: selected.id, action, warning: validation.warning })
      setFeedback(null)
      return
    }

    performAction(selected, action)
  }

  function performAction(portal: Portal, action: PortalAction) {
    const beforeRisk = calculateRisk(portal).total
    const next = applyAction(portal, action)
    const afterRisk = calculateRisk(next).total

    setPortals((current) => current.map((p) => (p.id === portal.id ? next : p)))
    setPending(null)

    const messages: Record<PortalAction, string> = {
      stabilize: `Стабилизирован. Стабильность ${portal.stability} → ${next.stability}, энергия ${portal.energy} → ${next.energy}; риск ${beforeRisk} → ${afterRisk}.`,
      close: portal.creaturesInside > 0
        ? `Закрыт, внутри заперто: ${creatures(portal.creaturesInside)} (подтверждено смотрителем).`
        : 'Портал безопасно закрыт.',
      observer: portal.creaturesInside > 0
        ? `Наблюдатель отправлен при риске ${beforeRisk}/100 и эвакуировал ${creatures(portal.creaturesInside)}.`
        : `Наблюдатель отправлен при риске ${beforeRisk}/100. Портал проверен${portal.status === 'questionable' ? ', пометка снята' : ''}.`,
      questionable: portal.status === 'questionable'
        ? 'Пометка «под вопросом» снята.'
        : 'Помечен «под вопросом» для приоритетной проверки.',
    }

    appendLog(portal, action, 'done', messages[action])
    setFeedback({ type: 'success', text: messages[action] })
  }

  function resetDemo() {
    setPortals(demoPortals)
    setLog([])
    setSelectedId(null)
    setPending(null)
    setNotice({ type: 'success', text: 'Демо-данные восстановлены, журнал очищен.' })
  }

  // From the empty state: bring the demo portals back but keep the log (clearing the list promised to keep it).
  function loadDemoPortals() {
    setPortals(demoPortals)
    setNotice({ type: 'success', text: 'Демо-порталы загружены, журнал сохранён.' })
  }

  function clearPortals() {
    setPortals([])
    setSelectedId(null)
    setPending(null)
    setNotice({ type: 'success', text: 'Список порталов очищен — сейчас видно пустое состояние.' })
  }

  return (
    <div className={`app-shell ${selected && tab === 'portals' ? 'card-open' : ''}`}>
      <header className="topbar">
        <div>
          <p className="eyebrow">MOX // ОТДЕЛ ТАЙНЫХ СИСТЕМ</p>
          <h1>Лаборатория нестабильных порталов</h1>
          <p className="intro">Риск каждого портала, рекомендации и действия смотрителя — в одном окне.</p>
        </div>
        <div className="system-indicator"><span /> СИСТЕМА В СЕТИ</div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Разделы приложения">
        <button role="tab" aria-selected={tab === 'portals'} className={tab === 'portals' ? 'active' : ''} onClick={() => setTab('portals')}>Порталы</button>
        <button role="tab" aria-selected={tab === 'activity'} className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>Журнал событий <b>{log.length}</b></button>
        <button role="tab" aria-selected={tab === 'worklog'} className={tab === 'worklog' ? 'active' : ''} onClick={() => setTab('worklog')}>AI Worklog</button>
      </nav>

      {notice && <NoticeBar notice={notice} onClose={() => setNotice(null)} floating />}

      {tab === 'portals' && (
        <PortalsTab
          portals={portals}
          selectedId={selectedId}
          onSelect={selectPortal}
          onClear={clearPortals}
          onReset={resetDemo}
          onLoadDemo={loadDemoPortals}
        >
          {selected && (
            <PortalCard
              portal={selected}
              history={log.filter((item) => item.portalId === selected.id)}
              feedback={feedback}
              pending={pending}
              onAction={handleAction}
              onConfirm={(action) => performAction(selected, action)}
              onCancel={() => setPending(null)}
              onCloseFeedback={() => setFeedback(null)}
              onClose={deselectPortal}
            />
          )}
        </PortalsTab>
      )}

      {tab === 'activity' && <EventLogTab log={log} onClear={() => setLog([])} onOpenPortal={selectPortal} portalExists={(id) => portals.some((p) => p.id === id)} />}

      {tab === 'worklog' && <WorklogTab />}
    </div>
  )
}
