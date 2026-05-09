import { describe, it, expect } from 'vitest'
import { buildSnapshots, ageAt, type BuildSnapshotsInput } from './living-data'
import type { Dimension, SkillCompetency } from '../types/database'
import type { SkillAssessment } from '../types/skill-assessment'

const SCHOOL = 'school-1'
const DIM_MATH = 'dim-math'
const DIM_LANG = 'dim-lang'
const DOMAIN_MATH = 'domain-math'
const DOMAIN_UNMAPPED = 'domain-unmapped'
const SUB_MATH_8_9 = 'sub-math-8-9'
const COMP_MATH_8_9 = 'comp-math-8-9'
const COMP_MATH_4_5 = 'comp-math-4-5'
const COMP_MATH_12_14 = 'comp-math-12-14'
const SKILL_A = 'skill-a'
const SKILL_B = 'skill-b'
const SKILL_UNMAPPED = 'skill-unmapped'
const SUB_UNMAPPED = 'sub-unmapped'
const COMP_UNMAPPED = 'comp-unmapped'

const dims: Dimension[] = [
  { id: DIM_MATH, school_id: SCHOOL, name: 'Math', display_order: 1, is_active: true } as Dimension,
  { id: DIM_LANG, school_id: SCHOOL, name: 'Language', display_order: 2, is_active: true } as Dimension,
]

function inputBase(overrides: Partial<BuildSnapshotsInput> = {}): BuildSnapshotsInput {
  return {
    dateOfBirth: '2018-01-15', // ~8y old at 2026-05-09
    schoolId: SCHOOL,
    dimensions: dims,
    assessments: [],
    surveys: [],
    skillCompetencies: [
      { skill_id: SKILL_A, competency_id: COMP_MATH_8_9 } as SkillCompetency,
      { skill_id: SKILL_B, competency_id: COMP_MATH_4_5 } as SkillCompetency,
      { skill_id: SKILL_UNMAPPED, competency_id: COMP_UNMAPPED } as SkillCompetency,
    ],
    competencies: [
      { id: COMP_MATH_8_9, subdomain_id: SUB_MATH_8_9, age_band_start: 8, age_band_end: 9 },
      { id: COMP_MATH_4_5, subdomain_id: SUB_MATH_8_9, age_band_start: 4, age_band_end: 5 },
      { id: COMP_MATH_12_14, subdomain_id: SUB_MATH_8_9, age_band_start: 12, age_band_end: 14 },
      { id: COMP_UNMAPPED, subdomain_id: SUB_UNMAPPED, age_band_start: 8, age_band_end: 9 },
    ],
    subdomains: [
      { id: SUB_MATH_8_9, domain_id: DOMAIN_MATH },
      { id: SUB_UNMAPPED, domain_id: DOMAIN_UNMAPPED },
    ],
    domainDimensionMap: [
      {
        id: 'm1',
        school_id: SCHOOL,
        competency_domain_id: DOMAIN_MATH,
        dimension_id: DIM_MATH,
      },
    ],
    ...overrides,
  }
}

function recent(monthsAgo: number, day = 15): string {
  const d = new Date()
  d.setMonth(d.getMonth() - monthsAgo)
  d.setDate(day)
  return d.toISOString()
}

describe('buildSnapshots', () => {
  it('returns empty when dimensions is empty', () => {
    expect(buildSnapshots(inputBase({ dimensions: [] }))).toEqual([])
  })

  it('returns empty when dateOfBirth is missing', () => {
    expect(buildSnapshots(inputBase({ dateOfBirth: '' }))).toEqual([])
  })

  it('single Achieving in current age band → dimension score = 3', () => {
    const out = buildSnapshots(
      inputBase({
        assessments: [
          { skill_id: SKILL_A, level: 'achieving', assessed_at: recent(1) } as SkillAssessment,
        ],
      })
    )
    const last = out[out.length - 1]
    expect(last.dimensions[DIM_MATH]).toBe(3)
    // No assessments contribute to Language → null
    expect(last.dimensions[DIM_LANG]).toBeNull()
  })

  it('single Achieving above current age band (aged out) → capped at 1 (Emerging)', () => {
    const out = buildSnapshots(
      inputBase({
        assessments: [
          { skill_id: SKILL_B, level: 'achieving', assessed_at: recent(1) } as SkillAssessment,
        ],
      })
    )
    const last = out[out.length - 1]
    expect(last.dimensions[DIM_MATH]).toBe(1)
  })

  it('single Achieving on a future-band standard (differentiation) → score = 3', () => {
    const out = buildSnapshots(
      inputBase({
        assessments: [
          {
            skill_id: 'skill-future',
            level: 'achieving',
            assessed_at: recent(1),
          } as SkillAssessment,
        ],
        skillCompetencies: [
          { skill_id: 'skill-future', competency_id: COMP_MATH_12_14 } as SkillCompetency,
        ],
      })
    )
    const last = out[out.length - 1]
    expect(last.dimensions[DIM_MATH]).toBe(3)
  })

  it('mixed assessments → mean of effective scores', () => {
    const out = buildSnapshots(
      inputBase({
        assessments: [
          { skill_id: SKILL_A, level: 'developing', assessed_at: recent(2) } as SkillAssessment, // 2
          { skill_id: SKILL_A, level: 'exceeding', assessed_at: recent(1) } as SkillAssessment, // 4
        ],
      })
    )
    const last = out[out.length - 1]
    expect(last.dimensions[DIM_MATH]).toBe(3)
  })

  it('zero assessments for a dimension → null', () => {
    const out = buildSnapshots(inputBase())
    const last = out[out.length - 1]
    expect(last.dimensions[DIM_MATH]).toBeNull()
    expect(last.dimensions[DIM_LANG]).toBeNull()
  })

  it('assessment in domain with no mapping → does not contribute to any dimension', () => {
    const out = buildSnapshots(
      inputBase({
        assessments: [
          {
            skill_id: SKILL_UNMAPPED,
            level: 'achieving',
            assessed_at: recent(1),
          } as SkillAssessment,
        ],
      })
    )
    const last = out[out.length - 1]
    expect(last.dimensions[DIM_MATH]).toBeNull()
    expect(last.dimensions[DIM_LANG]).toBeNull()
  })

  it('marks age-rollover snapshot when ageYears advances', () => {
    // dob = today minus 8y minus 1 month → age rolls over THIS month
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - 8)
    dob.setMonth(dob.getMonth() - 1) // birthday last month
    const out = buildSnapshots(
      inputBase({
        dateOfBirth: dob.toISOString().slice(0, 10),
        assessments: [
          { skill_id: SKILL_A, level: 'achieving', assessed_at: recent(13) } as SkillAssessment,
        ],
      })
    )
    const rollovers = out.filter((s) => s.isAgeRollover)
    expect(rollovers.length).toBeGreaterThan(0)
    // Each rollover has prevAgeYears strictly less than its own ageYears
    for (const r of rollovers) {
      expect(r.prevAgeYears).toBeDefined()
      expect(r.prevAgeYears!).toBeLessThan(r.ageYears)
    }
  })
})

describe('ageAt', () => {
  it('returns 0y 0m on the day of birth', () => {
    const dob = new Date(2020, 5, 10)
    expect(ageAt(dob, dob)).toEqual({ years: 0, months: 0 })
  })

  it('handles before-birthday-this-year correctly', () => {
    const dob = new Date(2020, 5, 10) // June 10, 2020
    const at = new Date(2026, 4, 1) // May 1, 2026 — before June 10
    expect(ageAt(dob, at)).toEqual({ years: 5, months: 10 })
  })

  it('handles after-birthday-this-year correctly', () => {
    const dob = new Date(2020, 5, 10) // June 10, 2020
    const at = new Date(2026, 6, 15) // July 15, 2026 — after June 10
    expect(ageAt(dob, at)).toEqual({ years: 6, months: 1 })
  })
})
