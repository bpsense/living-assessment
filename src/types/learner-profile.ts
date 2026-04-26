// learner-profile.ts — Types for the V2 Learner Profile model.
//
// A Learner Profile is the school-owned set of competency domains that drives
// the amoeba visualization. Each school gets a system-managed default
// (is_default=true, read-only to non-system-admins) which can be cloned into
// an editable working profile owned by the school.

export interface LearnerProfile {
  id: string
  school_id: string
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export type LearnerProfileInsert = Omit<LearnerProfile, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  description?: string | null
  is_default?: boolean
  is_active?: boolean
}

export type LearnerProfileUpdate = Partial<
  Omit<LearnerProfile, 'id' | 'school_id' | 'is_default' | 'created_at' | 'updated_at'>
>

export interface LearnerProfileDomain {
  id: string
  profile_id: string
  name: string
  description: string | null
  /** Hex color used by the amoeba renderer (e.g. "#0EA5E9"). */
  color: string | null
  sort_order: number
  created_at: string
}

export type LearnerProfileDomainInsert = Omit<LearnerProfileDomain, 'id' | 'created_at'> & {
  id?: string
  description?: string | null
  color?: string | null
  sort_order?: number
}

export type LearnerProfileDomainUpdate = Partial<
  Omit<LearnerProfileDomain, 'id' | 'profile_id' | 'created_at'>
>

export interface LearnerProfileWithDomains extends LearnerProfile {
  domains: LearnerProfileDomain[]
}
