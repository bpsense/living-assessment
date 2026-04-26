// learner-profile-data.ts
//
// CRUD helpers for the V2 Learner Profile model (see docs/ASSESSMENT_PHILOSOPHY.md).
// Each school has one system-managed default profile (is_default=true) and zero
// or more school-owned profiles. Exactly one profile per school is the active
// one driving the amoeba.

import { supabase } from './supabase'
import type {
  LearnerProfile,
  LearnerProfileDomain,
  LearnerProfileDomainInsert,
  LearnerProfileDomainUpdate,
  LearnerProfileUpdate,
  LearnerProfileWithDomains,
} from '../types/learner-profile'

// ============================================================
// Default template
// ============================================================
//
// Mirrors the seed in supabase/migrations/062_learner_profiles.sql so that
// "Reset to Default" rebuilds an editable profile with the same content the
// server-side seed produces.

export const DEFAULT_LEARNER_PROFILE_DOMAINS: ReadonlyArray<{
  name: string
  description: string
  color: string
}> = [
  {
    name: 'Language & Communication',
    description:
      'Reading, writing, speaking, listening, and multimodal expression across languages and contexts.',
    color: '#0EA5E9',
  },
  {
    name: 'Mathematical Thinking',
    description:
      'Number sense, reasoning with quantity and pattern, problem solving, and modelling the world mathematically.',
    color: '#6366F1',
  },
  {
    name: 'Scientific & Environmental Inquiry',
    description:
      'Observation, hypothesis, evidence, and the dispositions of a curious investigator of natural and built systems.',
    color: '#10B981',
  },
  {
    name: 'Creative Expression & Making',
    description:
      'Visual art, music, performance, design, and craft — generating ideas and bringing them into the world.',
    color: '#F59E0B',
  },
  {
    name: 'Inner Self & Well Being',
    description:
      'Self-awareness, emotional regulation, identity, agency, and the capacity to flourish.',
    color: '#EC4899',
  },
  {
    name: 'Physical Wellbeing & Movement',
    description:
      'Gross and fine motor development, body awareness, healthy habits, and physical confidence.',
    color: '#EF4444',
  },
  {
    name: 'Collaboration & Relational Skills',
    description:
      'Listening, perspective-taking, conflict navigation, and contributing to shared work with care.',
    color: '#8B5CF6',
  },
  {
    name: 'Global Citizenship & Contribution',
    description:
      'Curiosity about cultures and systems, ethical reasoning, and the impulse to act for the common good.',
    color: '#14B8A6',
  },
]

// ============================================================
// Profiles
// ============================================================

export async function fetchProfilesForSchool(schoolId: string): Promise<LearnerProfile[]> {
  const { data, error } = await supabase
    .from('learner_profiles')
    .select('*')
    .eq('school_id', schoolId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as LearnerProfile[]
}

/**
 * Fetch the single global default Learner Profile (school_id IS NULL).
 * Returns null only if the seed has never run.
 */
export async function fetchDefaultProfile(): Promise<LearnerProfile | null> {
  const { data, error } = await supabase
    .from('learner_profiles')
    .select('*')
    .eq('is_default', true)
    .is('school_id', null)
    .maybeSingle()

  if (error) throw error
  return (data as LearnerProfile | null) ?? null
}

/**
 * The "active" Learner Profile for a school. Resolution order:
 *   1. The school's own non-default, active profile (a customized clone), OR
 *   2. The single global default profile (school_id IS NULL, is_default=true).
 *
 * Returns null only if there is neither a school override nor a seeded
 * global default — that would indicate the seed never ran.
 */
export async function fetchActiveProfile(
  schoolId: string
): Promise<LearnerProfileWithDomains | null> {
  const { data: schoolOwn, error: schoolErr } = await supabase
    .from('learner_profiles')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_default', false)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)

  if (schoolErr) throw schoolErr
  const own = (schoolOwn?.[0] as LearnerProfile | undefined) ?? null
  if (own) {
    const domains = await fetchDomains(own.id)
    return { ...own, domains }
  }

  const fallback = await fetchDefaultProfile()
  if (!fallback) return null
  const domains = await fetchDomains(fallback.id)
  return { ...fallback, domains }
}

export async function fetchProfileWithDomains(
  profileId: string
): Promise<LearnerProfileWithDomains | null> {
  const { data: profile, error } = await supabase
    .from('learner_profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle()

  if (error) throw error
  if (!profile) return null

  const domains = await fetchDomains(profileId)
  return { ...(profile as LearnerProfile), domains }
}

export async function updateProfile(
  profileId: string,
  patch: LearnerProfileUpdate
): Promise<void> {
  const { error } = await supabase
    .from('learner_profiles')
    .update(patch)
    .eq('id', profileId)

  if (error) throw error
}

export async function deleteProfile(profileId: string): Promise<void> {
  const { error } = await supabase.from('learner_profiles').delete().eq('id', profileId)
  if (error) throw error
}

// ============================================================
// Cloning
// ============================================================

/**
 * Clone the global default Learner Profile into an editable, school-owned
 * working copy. The clone becomes the school's active profile; the global
 * default is untouched.
 */
export async function cloneDefaultProfileForSchool(
  schoolId: string,
  options: { name?: string; description?: string | null } = {}
): Promise<LearnerProfileWithDomains> {
  const defaultProfile = await fetchDefaultProfile()
  if (!defaultProfile) {
    throw new Error(
      `No global default learner profile found. Run the 065 migration / seed_global_default_learner_profile().`
    )
  }

  const defaultDomains = await fetchDomains(defaultProfile.id)
  const name = options.name ?? 'Our Learner Profile'

  // Deactivate the school's other profiles so the new clone is the sole
  // school-owned active one. (The global default is untouched.)
  const { error: deactivateErr } = await supabase
    .from('learner_profiles')
    .update({ is_active: false })
    .eq('school_id', schoolId)
    .eq('is_active', true)
  if (deactivateErr) throw deactivateErr

  const { data: cloned, error: insertErr } = await supabase
    .from('learner_profiles')
    .insert({
      school_id: schoolId,
      name,
      description:
        options.description ??
        defaultProfile.description ??
        'Editable copy of the default Learner Profile.',
      is_default: false,
      is_active: true,
    })
    .select('*')
    .single()

  if (insertErr || !cloned) throw new Error(`Failed to clone profile: ${insertErr?.message}`)

  const newProfile = cloned as LearnerProfile

  if (defaultDomains.length > 0) {
    const inserts: LearnerProfileDomainInsert[] = defaultDomains.map((d, i) => ({
      profile_id: newProfile.id,
      name: d.name,
      description: d.description,
      color: d.color,
      sort_order: i,
    }))
    const { error: domErr } = await supabase.from('learner_profile_domains').insert(inserts)
    if (domErr) {
      // Roll back the orphan profile so callers can retry cleanly.
      await supabase.from('learner_profiles').delete().eq('id', newProfile.id)
      throw domErr
    }
  }

  const domains = await fetchDomains(newProfile.id)
  return { ...newProfile, domains }
}

/**
 * Drop all school-owned customizations so the global default profile takes
 * over for this school. Returns the active profile after the reset (which
 * is the global default unless the seed has never run).
 */
export async function resetToDefaultProfile(
  schoolId: string
): Promise<LearnerProfileWithDomains> {
  const { error } = await supabase
    .from('learner_profiles')
    .delete()
    .eq('school_id', schoolId)
    .eq('is_default', false)

  if (error) throw error

  const active = await fetchActiveProfile(schoolId)
  if (!active) {
    throw new Error(
      'Reset succeeded but no active profile resolved — global default may not be seeded.'
    )
  }
  return active
}

// ============================================================
// Domains
// ============================================================

export async function fetchDomains(profileId: string): Promise<LearnerProfileDomain[]> {
  const { data, error } = await supabase
    .from('learner_profile_domains')
    .select('*')
    .eq('profile_id', profileId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as LearnerProfileDomain[]
}

export async function createDomain(
  profileId: string,
  domain: { name: string; description?: string | null; color?: string | null; sort_order?: number }
): Promise<LearnerProfileDomain> {
  let sortOrder = domain.sort_order
  if (sortOrder === undefined) {
    // Append to the end.
    const existing = await fetchDomains(profileId)
    sortOrder = existing.length
  }

  const insert: LearnerProfileDomainInsert = {
    profile_id: profileId,
    name: domain.name,
    description: domain.description ?? null,
    color: domain.color ?? null,
    sort_order: sortOrder,
  }

  const { data, error } = await supabase
    .from('learner_profile_domains')
    .insert(insert)
    .select('*')
    .single()

  if (error || !data) throw new Error(`Failed to create domain: ${error?.message}`)
  return data as LearnerProfileDomain
}

export async function updateDomain(
  domainId: string,
  patch: LearnerProfileDomainUpdate
): Promise<void> {
  const { error } = await supabase
    .from('learner_profile_domains')
    .update(patch)
    .eq('id', domainId)

  if (error) throw error
}

export async function deleteDomain(domainId: string): Promise<void> {
  const { error } = await supabase.from('learner_profile_domains').delete().eq('id', domainId)
  if (error) throw error
}

/**
 * Persist a new ordering for a profile's domains. Pass the domain IDs in the
 * desired display order; sort_order is rewritten to match.
 */
export async function reorderDomains(
  profileId: string,
  orderedIds: string[]
): Promise<void> {
  const results = await Promise.all(
    orderedIds.map((id, i) =>
      supabase
        .from('learner_profile_domains')
        .update({ sort_order: i })
        .eq('id', id)
        .eq('profile_id', profileId)
    )
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
}
