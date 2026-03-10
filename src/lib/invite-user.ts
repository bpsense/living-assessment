// src/lib/invite-user.ts
// Frontend wrapper for the generic invite-user Edge Function.

import { supabase } from './supabase'
import type { UserRole } from '../types/database'

interface InviteUserParams {
  email: string
  fullName: string
  schoolId: string
  role: UserRole
  departmentId?: string // only for educator → dept admin
  isSystemAdmin?: boolean // only for system admin invites from All Schools view
}

export async function inviteUser(
  params: InviteUserParams
): Promise<{ error: string | null; userId?: string }> {
  try {
    const { data, error: fnError } = await supabase.functions.invoke(
      'invite-user',
      {
        body: {
          email: params.email,
          full_name: params.fullName,
          school_id: params.schoolId,
          role: params.role,
          department_id: params.departmentId,
          is_system_admin: params.isSystemAdmin,
        },
      }
    )

    if (fnError) {
      return { error: fnError.message }
    }

    if (data?.error) {
      return { error: data.error }
    }

    return { error: null, userId: data?.user_id }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to invite user',
    }
  }
}
