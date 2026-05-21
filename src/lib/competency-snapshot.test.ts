import { describe, expect, it } from 'vitest'
import {
  ageFromDob,
  bandOffset,
  classifyBand,
  classifyTrend,
  computeSpectrumScore,
  decayWeight,
  spectrumToBarPercent,
  spectrumToZone,
  weightedLevelScore,
  DECAY_HALF_LIFE_DAYS,
} from './competency-snapshot'
import type { StandardAssessment } from './standards-assignment-data'

// ============================================================
// classifyBand
// ============================================================

describe('classifyBand', () => {
  it('matching when learner age sits in [start, end] inclusive', () => {
    expect(classifyBand(7, 6, 7)).toBe('matching')
    expect(classifyBand(6, 6, 7)).toBe('matching')
    expect(classifyBand(7, 6, 8)).toBe('matching')
  })

  it('older when learner is below band_start (band is for older kids)', () => {
    expect(classifyBand(5, 6, 7)).toBe('older')
  })

  it('younger when learner is above band_end (band is for younger kids)', () => {
    expect(classifyBand(8, 6, 7)).toBe('younger')
  })

  it('unknown when any input is null', () => {
    expect(classifyBand(null, 6, 7)).toBe('unknown')
    expect(classifyBand(7, null, 7)).toBe('unknown')
    expect(classifyBand(7, 6, null)).toBe('unknown')
  })
})

// ============================================================
// bandOffset
// ============================================================

describe('bandOffset', () => {
  it('older = +1, matching = 0, younger = -1, unknown = 0', () => {
    expect(bandOffset('older')).toBe(1)
    expect(bandOffset('matching')).toBe(0)
    expect(bandOffset('younger')).toBe(-1)
    expect(bandOffset('unknown')).toBe(0)
  })
})

// ============================================================
// decayWeight
// ============================================================

describe('decayWeight (exponential decay)', () => {
  it('returns 1 for a same-day (or future-clamped) assessment', () => {
    expect(decayWeight(0)).toBe(1)
    expect(decayWeight(-5)).toBe(1)
  })

  it('returns 0.5 at one half-life ago', () => {
    expect(decayWeight(DECAY_HALF_LIFE_DAYS)).toBeCloseTo(0.5, 6)
  })

  it('returns 0.25 at two half-lives ago', () => {
    expect(decayWeight(DECAY_HALF_LIFE_DAYS * 2)).toBeCloseTo(0.25, 6)
  })

  it('respects a custom half-life', () => {
    expect(decayWeight(30, 30)).toBeCloseTo(0.5, 6)
  })
})

// ============================================================
// weightedLevelScore
// ============================================================

function mk(level: StandardAssessment['level'], iso: string): StandardAssessment {
  return {
    id: `id-${iso}-${level}`,
    student_assignment_id: 'sa',
    student_id: 's',
    school_id: 'sch',
    standard_id: 'std',
    level,
    notes: null,
    assessor_id: 'a',
    assessed_at: iso,
    created_at: iso,
  }
}

const NOW = new Date('2026-05-21T00:00:00Z')

describe('weightedLevelScore', () => {
  it('returns null on empty history', () => {
    expect(weightedLevelScore([], NOW)).toBeNull()
  })

  it('returns the literal level score for a single recent assessment', () => {
    expect(weightedLevelScore([mk('achieving', '2026-05-20')], NOW)).toBeCloseTo(3, 5)
  })

  it('newer assessment dominates older', () => {
    // Older = developing (2) ~6 months ago, newer = mastery (4) yesterday.
    // With 90-day half-life, the newer weight should dominate the average.
    const score = weightedLevelScore(
      [mk('developing', '2025-11-20'), mk('mastery', '2026-05-20')],
      NOW
    )!
    expect(score).toBeGreaterThan(3.5)
  })

  it('two same-day assessments at different levels average evenly', () => {
    expect(
      weightedLevelScore(
        [mk('developing', '2026-05-21'), mk('mastery', '2026-05-21')],
        NOW
      )
    ).toBeCloseTo(3, 5)
  })
})

// ============================================================
// computeSpectrumScore (the headline)
// ============================================================

describe('computeSpectrumScore — band-shifted spectrum', () => {
  it('returns null when band is unknown', () => {
    expect(
      computeSpectrumScore([mk('achieving', '2026-05-20')], 'unknown', NOW)
    ).toBeNull()
  })

  it('returns null with no history', () => {
    expect(computeSpectrumScore([], 'matching', NOW)).toBeNull()
  })

  it('matching band: emerging=1, developing=2, achieving=3, mastery=4', () => {
    expect(computeSpectrumScore([mk('emerging', '2026-05-20')], 'matching', NOW)).toBeCloseTo(1, 5)
    expect(computeSpectrumScore([mk('developing', '2026-05-20')], 'matching', NOW)).toBeCloseTo(2, 5)
    expect(computeSpectrumScore([mk('achieving', '2026-05-20')], 'matching', NOW)).toBeCloseTo(3, 5)
    expect(computeSpectrumScore([mk('mastery', '2026-05-20')], 'matching', NOW)).toBeCloseTo(4, 5)
  })

  it('younger band raises the bar — same level reads more behind', () => {
    // Score for younger should be one less than matching for the same level
    expect(computeSpectrumScore([mk('developing', '2026-05-20')], 'younger', NOW)).toBeCloseTo(1, 5)
    expect(computeSpectrumScore([mk('achieving', '2026-05-20')], 'younger', NOW)).toBeCloseTo(2, 5)
    expect(computeSpectrumScore([mk('mastery', '2026-05-20')], 'younger', NOW)).toBeCloseTo(3, 5)
  })

  it('older band lowers the bar — same level reads more ahead', () => {
    expect(computeSpectrumScore([mk('emerging', '2026-05-20')], 'older', NOW)).toBeCloseTo(2, 5)
    expect(computeSpectrumScore([mk('developing', '2026-05-20')], 'older', NOW)).toBeCloseTo(3, 5)
    expect(computeSpectrumScore([mk('achieving', '2026-05-20')], 'older', NOW)).toBeCloseTo(4, 5)
    expect(computeSpectrumScore([mk('mastery', '2026-05-20')], 'older', NOW)).toBeCloseTo(5, 5)
  })

  it('clamps to [0, 5]', () => {
    // younger + emerging would be 0; older + mastery would be 5; both clamped.
    expect(computeSpectrumScore([mk('emerging', '2026-05-20')], 'younger', NOW)).toBe(0)
    expect(computeSpectrumScore([mk('mastery', '2026-05-20')], 'older', NOW)).toBe(5)
  })

  it('blends history with decay — recent mastery pulls up an older developing', () => {
    const score = computeSpectrumScore(
      [mk('developing', '2025-11-20'), mk('mastery', '2026-05-20')],
      'matching',
      NOW
    )!
    expect(score).toBeGreaterThan(3.5)
    expect(score).toBeLessThan(4)
  })
})

// ============================================================
// spectrumToBarPercent / spectrumToZone
// ============================================================

describe('spectrumToBarPercent', () => {
  it('matching achieving (score 3) lands at exactly 60% on the linear bar', () => {
    // Linear map: 3/5 * 100 = 60. We anchor zone bounds at 33%/67% so 3 sits
    // safely in the "at" zone.
    expect(spectrumToBarPercent(3)).toBeCloseTo(60, 5)
  })

  it('clamps the score before mapping', () => {
    expect(spectrumToBarPercent(-1)).toBe(0)
    expect(spectrumToBarPercent(7)).toBe(100)
  })

  it('produces monotonically increasing positions', () => {
    let prev = -Infinity
    for (let s = 0; s <= 5; s += 0.5) {
      const p = spectrumToBarPercent(s)
      expect(p).toBeGreaterThanOrEqual(prev)
      prev = p
    }
  })
})

describe('spectrumToZone', () => {
  it('< 2 -> below, [2, 4) -> at, >= 4 -> above, null -> untimed', () => {
    expect(spectrumToZone(0)).toBe('below')
    expect(spectrumToZone(1.9)).toBe('below')
    expect(spectrumToZone(2)).toBe('at')
    expect(spectrumToZone(3)).toBe('at')
    expect(spectrumToZone(3.99)).toBe('at')
    expect(spectrumToZone(4)).toBe('above')
    expect(spectrumToZone(5)).toBe('above')
    expect(spectrumToZone(null)).toBe('untimed')
  })
})

// ============================================================
// classifyTrend — unchanged from v1, tests retained
// ============================================================

describe('classifyTrend', () => {
  it('flat for zero or one assessments', () => {
    expect(classifyTrend([])).toBe('flat')
    expect(classifyTrend([mk('developing', '2026-01-01')])).toBe('flat')
  })

  it('up / down / flat based on the last two assessments', () => {
    expect(
      classifyTrend([mk('developing', '2026-01-01'), mk('achieving', '2026-03-01')])
    ).toBe('up')
    expect(
      classifyTrend([mk('achieving', '2026-01-01'), mk('developing', '2026-03-01')])
    ).toBe('down')
    expect(
      classifyTrend([mk('developing', '2026-01-01'), mk('developing', '2026-03-01')])
    ).toBe('flat')
  })
})

// ============================================================
// ageFromDob — unchanged
// ============================================================

describe('ageFromDob', () => {
  it('rounds down at the birthday', () => {
    expect(ageFromDob('2018-06-15', new Date('2026-06-14T12:00:00'))).toBe(7)
    expect(ageFromDob('2018-06-15', new Date('2026-06-15T12:00:00'))).toBe(8)
  })
  it('returns null on missing/unparseable input', () => {
    expect(ageFromDob(null)).toBeNull()
    expect(ageFromDob('not-a-date')).toBeNull()
  })
})

// ============================================================
// End-to-end scenarios — Maya (7) and Theo (7) sample data
// ============================================================

describe('smoke scenarios — band-shift rule for a 7yo learner', () => {
  it('matching band (6-7): emerging=below, dev/achieving=at, mastery=above', () => {
    const band = classifyBand(7, 6, 7)
    expect(spectrumToZone(computeSpectrumScore([mk('emerging', '2026-05-20')], band, NOW))).toBe('below')
    expect(spectrumToZone(computeSpectrumScore([mk('developing', '2026-05-20')], band, NOW))).toBe('at')
    expect(spectrumToZone(computeSpectrumScore([mk('achieving', '2026-05-20')], band, NOW))).toBe('at')
    expect(spectrumToZone(computeSpectrumScore([mk('mastery', '2026-05-20')], band, NOW))).toBe('above')
  })

  it('younger band (4-5): emerging/dev=below, achieving/mastery=at', () => {
    const band = classifyBand(7, 4, 5)
    expect(spectrumToZone(computeSpectrumScore([mk('emerging', '2026-05-20')], band, NOW))).toBe('below')
    expect(spectrumToZone(computeSpectrumScore([mk('developing', '2026-05-20')], band, NOW))).toBe('below')
    expect(spectrumToZone(computeSpectrumScore([mk('achieving', '2026-05-20')], band, NOW))).toBe('at')
    expect(spectrumToZone(computeSpectrumScore([mk('mastery', '2026-05-20')], band, NOW))).toBe('at')
  })

  it('older band (8-9): emerging/dev=at (stretch), achieving/mastery=above', () => {
    const band = classifyBand(7, 8, 9)
    expect(spectrumToZone(computeSpectrumScore([mk('emerging', '2026-05-20')], band, NOW))).toBe('at')
    expect(spectrumToZone(computeSpectrumScore([mk('developing', '2026-05-20')], band, NOW))).toBe('at')
    expect(spectrumToZone(computeSpectrumScore([mk('achieving', '2026-05-20')], band, NOW))).toBe('above')
    expect(spectrumToZone(computeSpectrumScore([mk('mastery', '2026-05-20')], band, NOW))).toBe('above')
  })
})
