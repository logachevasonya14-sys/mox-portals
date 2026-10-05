import { describe, expect, it } from 'vitest'
import {
  applyAction, calculateRisk, creatures, demoPortals, getRecommendedAction, getRiskFactors, getRiskLevel,
  isLogItem, isPortal, makeId, parseStored, plural, validateAction, type Portal,
} from './logic'

const criticalPortal: Portal = {
  id: 'critical',
  name: 'Critical',
  destination: 'Test',
  energy: 95,
  stability: 10,
  collapseMinutes: 10,
  creaturesInside: 2,
  status: 'open',
}

const calmPortal: Portal = {
  id: 'calm',
  name: 'Calm',
  destination: 'Test',
  energy: 20,
  stability: 92,
  collapseMinutes: 600,
  creaturesInside: 0,
  status: 'open',
}

describe('risk engine', () => {
  it('classifies high-energy unstable urgent portal as critical', () => {
    expect(calculateRisk(criticalPortal).level).toBe('critical')
  })

  it('matches the documented formula', () => {
    // each term is rounded: 95*0.35 = 33.25 → 33, 90*0.45 = 40.5 → 41, 100*0.2 = 20 → 94
    expect(calculateRisk(criticalPortal)).toMatchObject({ energy: 33, instability: 41, urgency: 20, total: 94 })
    // 20*0.35 = 7, 8*0.45 = 3.6 → 4, 5*0.2 = 1 → 12
    expect(calculateRisk(calmPortal)).toMatchObject({ total: 12, level: 'low' })
  })

  it('breakdown always adds up to the total', () => {
    for (const portal of [criticalPortal, calmPortal, ...demoPortals]) {
      const r = calculateRisk(portal)
      expect(r.energy + r.instability + r.urgency).toBe(r.total)
    }
  })

  it('stabilization lowers risk', () => {
    const before = calculateRisk(criticalPortal).total
    const after = calculateRisk(applyAction(criticalPortal, 'stabilize')).total
    expect(after).toBeLessThan(before)
  })

  it('closed portal has zero operational risk', () => {
    const closed = applyAction(criticalPortal, 'close')
    expect(calculateRisk(closed).total).toBe(0)
  })

  it('uses documented risk bands', () => {
    expect(getRiskLevel(29)).toBe('low')
    expect(getRiskLevel(30)).toBe('medium')
    expect(getRiskLevel(59)).toBe('medium')
    expect(getRiskLevel(60)).toBe('high')
    expect(getRiskLevel(79)).toBe('high')
    expect(getRiskLevel(80)).toBe('critical')
  })

  it('explains risk factors, including trapped creatures', () => {
    const factors = getRiskFactors(criticalPortal).join(' ')
    expect(factors).toMatch(/Низкая стабильность/)
    expect(factors).toMatch(/2 существа/)
    expect(factors).toMatch(/наблюдател/)
    expect(getRiskFactors(calmPortal)).toEqual([])
  })

  it('recommends only actions that actually exist', () => {
    expect(getRecommendedAction(criticalPortal)).toMatch(/Стабилизировать.*наблюдател.*закрыть/i)
    expect(getRecommendedAction({ ...criticalPortal, creaturesInside: 0 })).toMatch(/^Рекомендуется/)
    expect(getRecommendedAction(applyAction(criticalPortal, 'close'))).toMatch(/не требуется/)
  })
})

describe('action validation (impossible states)', () => {
  it('blocks observer mission for critical portal', () => {
    const result = validateAction(criticalPortal, 'observer')
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.reason).toMatch(/94\/100/)
  })

  it('observer boundary is exactly the critical band: 80 blocked, 79 allowed', () => {
    // 100*0.35 = 35, 98*0.45 = 44.1 → 44, 5*0.2 = 1 → 80
    const at80: Portal = { ...calmPortal, energy: 100, stability: 2 }
    // 96*0.45 = 43.2 → 43 → 79
    const at79: Portal = { ...calmPortal, energy: 100, stability: 4 }
    expect(calculateRisk(at80).total).toBe(80)
    expect(calculateRisk(at79).total).toBe(79)
    expect(validateAction(at80, 'observer').allowed).toBe(false)
    expect(validateAction(at79, 'observer').allowed).toBe(true)
  })

  it('closing always asks for confirmation; with creatures inside the warning names them', () => {
    const occupied = validateAction(criticalPortal, 'close')
    expect(occupied.allowed).toBe(true)
    if (occupied.allowed) expect(occupied.warning).toMatch(/2 существа.*необратимо/)

    const empty = validateAction(calmPortal, 'close')
    expect(empty.allowed).toBe(true)
    if (empty.allowed) expect(empty.warning).toMatch(/необратимо/)
  })

  it('blocks every action on a closed portal', () => {
    const closed = applyAction(criticalPortal, 'close')
    for (const action of ['stabilize', 'observer', 'questionable', 'close'] as const) {
      expect(validateAction(closed, action).allowed).toBe(false)
    }
  })

  it('blocks stabilizing an already stable portal', () => {
    expect(validateAction(calmPortal, 'stabilize').allowed).toBe(false)
  })

  it('questionable flag can be set and removed at any time', () => {
    const flagged = applyAction(calmPortal, 'questionable')
    expect(flagged.status).toBe('questionable')
    expect(validateAction(flagged, 'questionable').allowed).toBe(true)
    expect(applyAction(flagged, 'questionable').status).toBe('open')
  })
})

describe('state transitions', () => {
  it('critical → stabilize → observer evacuates → safe close', () => {
    const stabilized = applyAction(criticalPortal, 'stabilize')
    expect(stabilized.stability).toBe(35)
    expect(stabilized.energy).toBe(85)
    expect(stabilized.collapseMinutes).toBe(40)

    // one stabilization is enough to drop below the critical band
    expect(validateAction(stabilized, 'observer').allowed).toBe(true)

    const evacuated = applyAction(stabilized, 'observer')
    expect(evacuated.creaturesInside).toBe(0)
    const close = validateAction(evacuated, 'close')
    expect(close.allowed).toBe(true)
    if (close.allowed) expect(close.warning).not.toMatch(/существ/)
  })

  it('observer clears the questionable flag', () => {
    const flagged = applyAction(calmPortal, 'questionable')
    expect(applyAction(flagged, 'observer').status).toBe('open')
  })

  it('applyAction does not mutate the input', () => {
    const copy = { ...criticalPortal }
    applyAction(criticalPortal, 'stabilize')
    applyAction(criticalPortal, 'close')
    expect(criticalPortal).toEqual(copy)
  })
})

describe('persisted state parsing', () => {
  it('accepts valid demo data', () => {
    expect(parseStored(JSON.stringify(demoPortals), isPortal)).toEqual(demoPortals)
    expect(parseStored('[]', isPortal)).toEqual([])
  })

  it('rejects missing or corrupted data instead of crashing', () => {
    expect(parseStored(null, isPortal)).toBeNull()
    expect(parseStored('{not json', isPortal)).toBeNull()
    expect(parseStored('{"a":1}', isPortal)).toBeNull()
    expect(parseStored('[{"id":"x"}]', isPortal)).toBeNull()
    expect(parseStored(JSON.stringify([{ ...calmPortal, status: 'exploded' }]), isPortal)).toBeNull()
  })

  it('validates log entries', () => {
    const entry = {
      id: '1', portalId: 'p', portalName: 'P', action: 'close', outcome: 'blocked',
      message: 'm', createdAt: new Date().toISOString(),
    }
    expect(isLogItem(entry)).toBe(true)
    expect(isLogItem({ ...entry, createdAt: '12:30' })).toBe(false)
  })

  it('makes unique ids even without crypto.randomUUID (plain http on a LAN)', () => {
    const original = crypto.randomUUID
    try {
      Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
      const ids = new Set(Array.from({ length: 100 }, makeId))
      expect(ids.size).toBe(100)
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true })
    }
  })
})

describe('demo data', () => {
  it('covers the required showcase states', () => {
    const levels = demoPortals.map(calculateRisk).map((r) => r.level)
    expect(levels).toContain('critical')
    expect(levels).toContain('low')
    expect(demoPortals.some((p) => p.status === 'closed')).toBe(true)
    expect(demoPortals.some((p) => p.status === 'questionable')).toBe(true)
    expect(new Set(demoPortals.map((p) => p.id)).size).toBe(demoPortals.length)
  })
})

describe('russian plurals', () => {
  it('picks the right form', () => {
    expect(creatures(1)).toBe('1 существо')
    expect(creatures(3)).toBe('3 существа')
    expect(creatures(5)).toBe('5 существ')
    expect(creatures(11)).toBe('11 существ')
    expect(creatures(21)).toBe('21 существо')
    expect(plural(12, ['a', 'b', 'c'])).toBe('c')
  })
})
