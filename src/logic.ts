/**
 * Вся логика приложения. Здесь нет ничего про экран и кнопки — только данные и правила,
 * поэтому всё это проверяется тестами в logic.test.ts без браузера.
 *
 *   1. Типы           — что такое портал, журнал, результат проверки
 *   2. Тексты         — русские подписи и склонение
 *   3. Риск           — формула, уровни, факторы, рекомендация
 *   4. Действия       — что можно (validateAction) и что происходит (applyAction)
 *   5. Хранение       — безопасное чтение/запись localStorage
 *   6. Демо-данные    — порталы, с которыми приложение запускается
 */

// ─── 1. Типы ────────────────────────────────────────────────────────────────

export type PortalStatus = 'open' | 'questionable' | 'closed'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type PortalAction = 'stabilize' | 'close' | 'observer' | 'questionable'

export type Portal = {
  id: string
  name: string
  destination: string
  energy: number
  stability: number
  collapseMinutes: number
  creaturesInside: number
  status: PortalStatus
}

export type RiskBreakdown = {
  energy: number
  instability: number
  urgency: number
  total: number
  level: RiskLevel
}

export type ValidationResult =
  | { allowed: true; warning?: string }
  | { allowed: false; reason: string }

export type EventOutcome = 'done' | 'blocked'

export type EventLogItem = {
  id: string
  portalId: string
  portalName: string
  action: PortalAction
  outcome: EventOutcome
  message: string
  /** ISO 8601 timestamp */
  createdAt: string
}

// ─── 2. Тексты ──────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<PortalStatus, string> = {
  open: 'открыт',
  questionable: 'под вопросом',
  closed: 'закрыт',
}

export const LEVEL_LABELS: Record<RiskLevel, string> = {
  low: 'низкий',
  medium: 'средний',
  high: 'высокий',
  critical: 'критический',
}

export const ACTION_LABELS: Record<PortalAction, string> = {
  stabilize: 'Стабилизировать',
  observer: 'Отправить наблюдателя',
  questionable: 'Пометить «под вопросом»',
  close: 'Закрыть портал',
}

/** Russian plural form: plural(1, ['существо', 'существа', 'существ']) → 'существо' */
export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}

export const creatures = (n: number) => `${n} ${plural(n, ['существо', 'существа', 'существ'])}`

// ─── 3. Риск ────────────────────────────────────────────────────────────────

/** Lower bounds of the risk bands. Observer missions are allowed only below CRITICAL_RISK. */
const MEDIUM_RISK = 30
const HIGH_RISK = 60
export const CRITICAL_RISK = 80

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value))

function collapseUrgency(minutes: number): number {
  if (minutes <= 15) return 100
  if (minutes <= 30) return 85
  if (minutes <= 60) return 65
  if (minutes <= 120) return 40
  if (minutes <= 240) return 20
  return 5
}

export function getRiskLevel(score: number): RiskLevel {
  if (score >= CRITICAL_RISK) return 'critical'
  if (score >= HIGH_RISK) return 'high'
  if (score >= MEDIUM_RISK) return 'medium'
  return 'low'
}

export function calculateRisk(portal: Portal): RiskBreakdown {
  if (portal.status === 'closed') {
    return { energy: 0, instability: 0, urgency: 0, total: 0, level: 'low' }
  }

  // Each term is rounded first, so the breakdown shown in the UI always adds up to the total.
  const energy = Math.round(portal.energy * 0.35)
  const instability = Math.round((100 - portal.stability) * 0.45)
  const urgency = Math.round(collapseUrgency(portal.collapseMinutes) * 0.2)
  const total = clamp(energy + instability + urgency)

  return { energy, instability, urgency, total, level: getRiskLevel(total) }
}

/** Human-readable list of what makes this portal dangerous right now. */
export function getRiskFactors(portal: Portal): string[] {
  if (portal.status === 'closed') {
    return portal.creaturesInside > 0
      ? [`Запечатан, внутри заперто: ${creatures(portal.creaturesInside)}.`]
      : []
  }

  const factors: string[] = []
  const risk = calculateRisk(portal)

  if (portal.stability < 40) factors.push(`Низкая стабильность (${portal.stability}/100) — главный источник риска.`)
  else if (portal.stability < 70) factors.push(`Умеренная стабильность (${portal.stability}/100).`)
  if (portal.energy >= 70) factors.push(`Высокая энергия (${portal.energy}/100).`)
  if (portal.collapseMinutes <= 30) factors.push(`Схлопывание неизбежно: осталось ${portal.collapseMinutes} мин.`)
  else if (portal.collapseMinutes <= 60) factors.push(`Схлопнется в течение часа (${portal.collapseMinutes} мин).`)
  if (portal.creaturesInside > 0) {
    factors.push(`Внутри ${creatures(portal.creaturesInside)} — закрытие сейчас запрёт их.`)
  }
  if (risk.total >= CRITICAL_RISK) factors.push('Слишком опасно для отправки наблюдателя.')
  if (portal.status === 'questionable') factors.push('Помечен «под вопросом» — нужна проверка.')

  return factors
}

export function getRecommendedAction(portal: Portal): string {
  if (portal.status === 'closed') return 'Действий не требуется — портал закрыт.'

  const { total } = calculateRisk(portal)
  if (total >= CRITICAL_RISK && portal.creaturesInside > 0) {
    return `Стабилизировать до риска ниже ${CRITICAL_RISK}, затем отправить наблюдателя эвакуировать существ, затем закрыть.`
  }
  if (total >= CRITICAL_RISK) return 'Рекомендуется стабилизировать портал, чтобы снизить риск и выиграть время. Внутри никого нет — если портал не нужен, его можно закрыть.'
  if (total >= HIGH_RISK) return 'Стабилизировать, чтобы снизить риск, затем переоценить.'
  if (portal.creaturesInside > 0) return 'Отправить наблюдателя эвакуировать существ.'
  if (portal.status === 'questionable') return 'Отправить наблюдателя проверить портал и снять пометку.'
  if (total >= MEDIUM_RISK) return 'Наблюдать; отправка наблюдателя допустима.'
  return 'Оставить открытым, плановое наблюдение.'
}

// ─── 4. Действия ────────────────────────────────────────────────────────────

const STABILITY_CAP = 90

export function validateAction(portal: Portal, action: PortalAction): ValidationResult {
  if (portal.status === 'closed') {
    return {
      allowed: false,
      reason: action === 'close'
        ? 'Портал уже закрыт.'
        : 'С закрытым порталом нельзя выполнять действия.',
    }
  }

  switch (action) {
    case 'stabilize':
      if (portal.stability >= STABILITY_CAP) {
        return {
          allowed: false,
          reason: `Стабильность уже ${portal.stability}/100 — это рабочий максимум (${STABILITY_CAP}).`,
        }
      }
      return { allowed: true }

    case 'observer': {
      const risk = calculateRisk(portal).total
      if (risk >= CRITICAL_RISK) {
        return {
          allowed: false,
          reason: `Наблюдателя отправить нельзя: риск ${risk}/100 (критический). Сначала стабилизируйте портал ниже ${CRITICAL_RISK}.`,
        }
      }
      return { allowed: true }
    }

    // Closing is irreversible, so it always needs a second confirmation; trapped creatures get an extra warning.
    case 'close':
      if (portal.creaturesInside > 0) {
        return {
          allowed: true,
          warning: `Внутри ещё ${creatures(portal.creaturesInside)}. Закрытие запрёт их внутри — лучше сначала отправить наблюдателя для эвакуации. Действие необратимо.`,
        }
      }
      return { allowed: true, warning: 'Уверены, что хотите закрыть портал? Действие необратимо — открыть его снова будет нельзя.' }

    // The flag is a reversible note: it can be set and removed at any time (e.g. if it was set by mistake).
    case 'questionable':
      return { allowed: true }
  }
}

/**
 * Pure state transition. Callers must run validateAction first.
 * - stabilize: +25 stability (max 100), −10 energy, +30 min before collapse
 * - observer: evacuates all creatures and clears the "questionable" flag
 * - close: seals the portal; creatures left inside stay trapped
 * - questionable: toggles the "questionable" flag on and off
 */
export function applyAction(portal: Portal, action: PortalAction): Portal {
  switch (action) {
    case 'stabilize':
      return {
        ...portal,
        stability: Math.min(100, portal.stability + 25),
        energy: Math.max(0, portal.energy - 10),
        collapseMinutes: portal.collapseMinutes + 30,
      }
    case 'close':
      return { ...portal, status: 'closed', energy: 0, collapseMinutes: 0 }
    case 'questionable':
      return { ...portal, status: portal.status === 'questionable' ? 'open' : 'questionable' }
    case 'observer':
      return { ...portal, creaturesInside: 0, status: 'open' }
  }
}

// ─── 5. Хранение ────────────────────────────────────────────────────────────

// v4: demo data changed (Седьмой Запечатанный → Безмолвие), so data saved by older versions is not reused
export const STORAGE_KEY = 'mox-portal-control-state-v4'
export const LOG_KEY = 'mox-portal-control-log-v4'
/** Oldest log entries beyond this are dropped so localStorage does not grow forever. */
export const LOG_LIMIT = 500

const STATUSES: unknown[] = ['open', 'questionable', 'closed']
const ACTIONS: unknown[] = ['stabilize', 'close', 'observer', 'questionable']

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

export function isPortal(value: unknown): value is Portal {
  if (!value || typeof value !== 'object') return false
  const p = value as Record<string, unknown>
  return (
    isStr(p.id) && isStr(p.name) && isStr(p.destination) &&
    isNum(p.energy) && isNum(p.stability) && isNum(p.collapseMinutes) && isNum(p.creaturesInside) &&
    STATUSES.includes(p.status)
  )
}

export function isLogItem(value: unknown): value is EventLogItem {
  if (!value || typeof value !== 'object') return false
  const e = value as Record<string, unknown>
  return (
    isStr(e.id) && isStr(e.portalId) && isStr(e.portalName) && isStr(e.message) &&
    isStr(e.createdAt) && !Number.isNaN(Date.parse(e.createdAt)) &&
    ACTIONS.includes(e.action) && (e.outcome === 'done' || e.outcome === 'blocked')
  )
}

/**
 * Parses persisted JSON. Returns null when the payload is missing or corrupted,
 * so the caller falls back to defaults instead of crashing the UI.
 */
export function parseStored<T>(raw: string | null, guard: (v: unknown) => v is T): T[] | null {
  if (raw === null) return null
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data) || !data.every(guard)) return null
    return data
  } catch {
    return null
  }
}

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage may be unavailable (private mode, quota) — the app keeps working in memory.
  }
}

/** Removes only this app's keys: on GitHub Pages the origin is shared with the owner's other projects. */
export function clearAppStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LOG_KEY)
  } catch {
    // storage unavailable
  }
}

/** crypto.randomUUID exists only in secure contexts (HTTPS, localhost), not on http://192.168.x.x. */
export function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ─── 6. Демо-данные ─────────────────────────────────────────────────────────
// Подобраны так, чтобы были видны все состояния из ТЗ: критический с существами и без,
// «под вопросом», средний, низкий, слишком стабильный для стабилизации, закрытый.

export const demoPortals: Portal[] = [
  { id: 'nyx-gate', name: 'Врата Никты', destination: 'Умбра', energy: 94, stability: 18, collapseMinutes: 12, creaturesInside: 3, status: 'open' },
  { id: 'ember-maw', name: 'Огненная Пасть', destination: 'Пиррос', energy: 88, stability: 25, collapseMinutes: 25, creaturesInside: 0, status: 'open' },
  { id: 'moss-rift', name: 'Моховой Разлом', destination: 'Вердантия', energy: 38, stability: 81, collapseMinutes: 360, creaturesInside: 0, status: 'open' },
  { id: 'glass-door', name: 'Стеклянная Дверь', destination: 'Зазеркалье', energy: 72, stability: 49, collapseMinutes: 52, creaturesInside: 1, status: 'questionable' },
  { id: 'ashen-arch', name: 'Пепельная Арка', destination: 'Пеплоземье', energy: 63, stability: 66, collapseMinutes: 145, creaturesInside: 0, status: 'open' },
  { id: 'quiet-threshold', name: 'Тихий Порог', destination: 'Сомния', energy: 21, stability: 91, collapseMinutes: 720, creaturesInside: 0, status: 'open' },
  { id: 'sealed-seven', name: 'Седьмой Запечатанный', destination: 'Безмолвие', energy: 0, stability: 100, collapseMinutes: 0, creaturesInside: 0, status: 'closed' },
]
