import { describe, expect, it } from 'vitest'
import {
  ageFromDob,
  classifyBand,
  classifyPosition,
  classifyTrend,
} from './competency-snapshot'
import type { StandardAssessment } from './standards-assignment-data'

// ============================================================
// classifyBand
// ============================================================

describe('classifyBand', () => {
  it('returns matching when learner age is inside the band (inclusive)', () => {
    expect(classifyBand(8, 8, 9)).toBe('matching')
    expect(classifyBand(9, 8, 9)).toBe('matching')
    expect(classifyBand(8, 6, 10)).toBe('matching')
  })

  it('returns older when learner is below band_start (band is for older kids)', () => {
    expect(classifyBand(5, 6, 7)).toBe('older')
  })

  it('returns younger when learner is above band_end (band is for younger kids)', () => {
    expect(classifyBand(10, 6, 7)).toBe('younger')
  })

  it('returns unknown when any input is null', () => {
    expect(classifyBand(null, 6, 7)).toBe('unknown')
    expect(classifyBand(8, null, 7)).toBe('unknown')
    expect(classifyBand(8, 6, null)).toBe('unknown')
  })
})

// ============================================================
// classifyPosition — the exact agreed table
// ============================================================

describe('classifyPosition', () => {
  it('older band + achieving/mastery -> ahead', () => {
    expect(classifyPosition('achieving', 'older')).toBe('ahead')
    expect(classifyPosition('mastery', 'older')).toBe('ahead')
  })

  it('older band + emerging/developing -> at (age-appropriate stretch)', () => {
    expect(classifyPosition('emerging', 'older')).toBe('at')
    expect(classifyPosition('developing', 'older')).toBe('at')
  })

  it('matching band -> at, regardless of level', () => {
    expect(classifyPosition('emerging', 'matching')).toBe('at')
    expect(classifyPosition('developing', 'matching')).toBe('at')
    expect(classifyPosition('achieving', 'matching')).toBe('at')
    expect(classifyPosition('mastery', 'matching')).toBe('at')
  })

  it('younger band + achieving/mastery -> at (learner has it, as expected)', () => {
    expect(classifyPosition('achieving', 'younger')).toBe('at')
    expect(classifyPosition('mastery', 'younger')).toBe('at')
  })

  it('younger band + emerging/developing -> building (real gap)', () => {
    expect(classifyPosition('emerging', 'younger')).toBe('building')
    expect(classifyPosition('developing', 'younger')).toBe('building')
  })

  it('unknown band -> untimed', () => {
    expect(classifyPosition('emerging', 'unknown')).toBe('untimed')
    expect(classifyPosition('mastery', 'unknown')).toBe('untimed')
  })
})

// ============================================================
// classifyTrend
// ============================================================

function mkAssessment(level: StandardAssessment['level'], iso: string): StandardAssessment {
  return {
    id: `id-${iso}`,
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

describe('classifyTrend', () => {
  it('returns flat for zero assessments', () => {
    expect(classifyTrend([])).toBe('flat')
  })

  it('returns flat for a single assessment', () => {
    expect(classifyTrend([mkAssessment('developing', '2026-01-01')])).toBe('flat')
  })

  it('returns up when latest level outranks prior', () => {
    expect(
      classifyTrend([
        mkAssessment('developing', '2026-01-01'),
        mkAssessment('achieving', '2026-03-01'),
      ])
    ).toBe('up')
  })

  it('returns down when latest level is lower than prior', () => {
    expect(
      classifyTrend([
        mkAssessment('achieving', '2026-01-01'),
        mkAssessment('developing', '2026-03-01'),
      ])
    ).toBe('down')
  })

  it('returns flat when latest and prior are the same level', () => {
    expect(
      classifyTrend([
        mkAssessment('developing', '2026-01-01'),
        mkAssessment('developing', '2026-03-01'),
      ])
    ).toBe('flat')
  })

  it('is order-agnostic — sorts before comparing the last two', () => {
    expect(
      classifyTrend([
        mkAssessment('achieving', '2026-03-01'),
        mkAssessment('developing', '2026-01-01'),
        mkAssessment('mastery', '2026-05-01'),
      ])
    ).toBe('up')
  })
})

// ============================================================
// ageFromDob
// ============================================================

describe('ageFromDob', () => {
  it('returns the integer year difference, floored at the birthday', () => {
    // DOB 2018-06-15, "now" 2026-06-14 → 7 (birthday hasn't happened yet)
    expect(ageFromDob('2018-06-15', new Date('2026-06-14T12:00:00'))).toBe(7)
    // DOB 2018-06-15, "now" 2026-06-15 → 8 (birthday today)
    expect(ageFromDob('2018-06-15', new Date('2026-06-15T12:00:00'))).toBe(8)
  })

  it('returns null for missing or unparseable dob', () => {
    expect(ageFromDob(null)).toBeNull()
    expect(ageFromDob(undefined)).toBeNull()
    expect(ageFromDob('not a date')).toBeNull()
  })
})

// ============================================================
// Smoke scenarios from the prompt: 7yo, 9yo, 11yo
// ============================================================

describe('smoke scenarios — 7yo / 9yo / 11yo', () => {
  // Sample standard bands: 4-5, 6-7, 8-9, 10-11
  // (these mirror the Boundless conventions)

  it('7yo on younger-band (4-5) standard still at developing → BUILDING', () => {
    const band = classifyBand(7, 4, 5) // younger
    expect(band).toBe('younger')
    expect(classifyPosition('developing', band)).toBe('building')
  })

  it('9yo on older-band (10-11) standard at mastery → AHEAD', () => {
    const band = classifyBand(9, 10, 11) // older
    expect(band).toBe('older')
    expect(classifyPosition('mastery', band)).toBe('ahead')
  })

  it('11yo on older-band (12-14) standard at developing → AT (age-appropriate stretch)', () => {
    const band = classifyBand(11, 12, 14)
    expect(band).toBe('older')
    expect(classifyPosition('developing', band)).toBe('at')
  })

  it('9yo on matching-band (8-9) at any level → AT', () => {
    const band = classifyBand(9, 8, 9)
    expect(band).toBe('matching')
    for (const lvl of ['emerging', 'developing', 'achieving', 'mastery'] as const) {
      expect(classifyPosition(lvl, band)).toBe('at')
    }
  })
})
