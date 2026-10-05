/** Вкладка «AI Worklog». Здесь только вёрстка — сам текст лежит в worklog.ts. */
import type { ReactNode } from 'react'
import { worklog, type Text } from '../worklog'

/** Plain text, or a yellow "fill in" placeholder for todo(...) values. */
function T({ value }: { value: Text }) {
  if (typeof value === 'string') return <>{value}</>
  return <span className="worklog-placeholder">Заполнить: {value.todo}</span>
}

/** A list where every item gets the same marker: ✕ mistakes, ✓ done by hand, ☐/☑ checks, → next steps. */
function MarkedList({ items, kind }: { items: Text[]; kind: 'bad' | 'good' | 'check' | 'next' }) {
  return (
    <ul className={`wl-list ${kind}`}>
      {items.map((item, i) => <li key={i} className={typeof item === 'string' ? '' : 'pending'}><T value={item} /></li>)}
    </ul>
  )
}

function Card({ eyebrow, title, wide = false, children }: { eyebrow: string; title: string; wide?: boolean; children: ReactNode }) {
  return (
    <article className={`work-card ${wide ? 'wide' : ''}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      {children}
    </article>
  )
}

export function WorklogTab() {
  return (
    <main>
      <section className="section-heading">
        <div><p className="eyebrow">РАЗРАБОТКА С AI</p><h2>AI Worklog</h2></div>
      </section>

      <section className="wl-stats">
        {worklog.stats.map((s) => (
          <div className="wl-stat" key={s.label}>
            <span>{s.label}</span>
            <strong>{s.value}</strong>
            {s.hint && <small>{s.hint}</small>}
          </div>
        ))}
      </section>

      <section className="worklog-grid">
        <Card eyebrow="ИНСТРУМЕНТЫ" title="Кто что делал">
          <div className="wl-tools">
            {worklog.tools.map((t) => (
              <div className="wl-tool" key={t.name}><b>{t.name}</b><span>{t.role}</span></div>
            ))}
          </div>
          <p className="wl-subhead">Токены Claude Code</p>
          <table className="wl-tokens">
            <thead>
              <tr><th>Сессия</th><th>Выходные</th><th>Новые входные</th><th>Кэш</th></tr>
            </thead>
            <tbody>
              {worklog.tokenSessions.map((s) => (
                <tr key={s.session}><td>{s.session}</td><td><b>{s.output}</b></td><td>{s.input}</td><td>{s.cache}</td></tr>
              ))}
            </tbody>
          </table>
          <ul className="wl-notes">{worklog.tokenNotes.map((t, i) => <li key={i}><T value={t} /></li>)}</ul>
        </Card>

        <Card eyebrow="МОИ РЕШЕНИЯ" title="Что решила сама">
          <ol className="wl-decisions">
            {worklog.decisions.map((d) => <li key={d.title}><b>{d.title}</b> — {d.why}</li>)}
          </ol>
        </Card>

        <Card eyebrow="ПРОЦЕСС" title="Этапы: я и AI" wide>
          <ol className="wl-timeline">
            {worklog.stages.map((stage) => (
              <li key={stage.title}>
                <h4>{stage.title}</h4>
                <p><span className="wl-tag me">Я</span><T value={stage.me} /></p>
                <p><span className="wl-tag ai">AI</span><T value={stage.ai} /></p>
                <p className="wl-prompt"><span className="wl-tag prompt">Промпт</span><T value={stage.prompt} /></p>
              </li>
            ))}
          </ol>
        </Card>

        <Card eyebrow="ОШИБКИ AI" title="Где AI ошибся">
          <MarkedList items={worklog.aiMistakes} kind="bad" />
        </Card>

        <Card eyebrow="РУЧНАЯ РАБОТА" title="Что сделала руками">
          <p className="wl-subhead">Код</p>
          <MarkedList items={worklog.manualRework} kind="good" />
          <p className="wl-subhead">Моя роль в работе с AI</p>
          <MarkedList items={worklog.myRole} kind="good" />
        </Card>

        <Card eyebrow="ПРОВЕРКА" title="Как проверяла" wide>
          <MarkedList items={worklog.verification} kind="check" />
        </Card>

        <Card eyebrow="ДАЛЬШЕ" title="Что улучшить" wide>
          <p className="wl-goal">{worklog.improvementsGoal}</p>
          <MarkedList items={worklog.improvements} kind="next" />
        </Card>
      </section>
    </main>
  )
}
