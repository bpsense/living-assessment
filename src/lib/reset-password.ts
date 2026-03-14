// src/lib/reset-password.ts
// Frontend wrapper for the reset-password Edge Function.
// Allows admins to trigger a password reset email for users below them.

import { supabase } from './supabase'

export async function adminResetPassword(
  targetUserId: string
): Promise<{ error: string | null; email?: string }> {
  try {
    const { data, error: fnError } = await supabase.functions.invoke(
      'reset-password',
      {
        body: { target_user_id: targetUserId },
      }
    )

    if (fnError) {
      return { error: fnError.message }
    }

    if (data?.error) {
      return { error: data.error }
    }

    return { error: null, email: data?.email }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to reset password',
    }
  }
}
