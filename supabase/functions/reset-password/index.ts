// supabase/functions/reset-password/index.ts
// Edge Function — allows admins to trigger a password reset email
// for any user below them in the access-level hierarchy.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

/** Compute numeric access level for a user given their profile + junction tables. */
async function computeLevel(
  // deno-lint-ignore no-explicit-any
  client: any,
  userId: string,
  role: string
): Promise<number> {
  const { data: sa } = await client
    .from('system_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (sa) return 6

  if (role === 'admin') return 5

  if (role === 'educator') {
    const { data: da } = await client
      .from('department_admins')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    return da ? 4 : 3
  }

  if (role === 'parent') return 2
  if (role === 'learner') return 1
  return 0
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' })
  }

  try {
    // 1. Authenticate the caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' })
    }

    // Extract the JWT from the Bearer token
    const token = authHeader.replace('Bearer ', '')

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    // Pass the JWT directly to getUser() — relying on global headers alone
    // can fail in newer @supabase/supabase-js versions where getUser()
    // checks the local session first (which is empty in Edge Functions).
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) {
      console.error('getUser failed:', authError?.message)
      return jsonResponse({ error: 'Unauthorized' })
    }

    // 2. Parse body
    const { target_user_id } = await req.json() as { target_user_id?: string }
    if (!target_user_id) {
      return jsonResponse({ error: 'target_user_id is required' })
    }

    // 3. Service client for privileged operations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 4. Fetch caller's and target's profiles
    const { data: callerProfile } = await serviceClient
      .from('profiles')
      .select('role, school_id')
      .eq('id', user.id)
      .single()

    const { data: targetProfile } = await serviceClient
      .from('profiles')
      .select('role, school_id, email')
      .eq('id', target_user_id)
      .single()

    if (!callerProfile) {
      return jsonResponse({ error: 'Caller profile not found' })
    }
    if (!targetProfile) {
      return jsonResponse({ error: 'Target user not found' })
    }

    // 5. Compute access levels and enforce hierarchy
    const callerLevel = await computeLevel(serviceClient, user.id, callerProfile.role)
    const targetLevel = await computeLevel(serviceClient, target_user_id, targetProfile.role)

    if (callerLevel <= targetLevel) {
      return jsonResponse({ error: 'Cannot reset password for a user at or above your access level' })
    }

    // Non-system-admins can only reset passwords within their school
    const isSystemAdmin = callerLevel >= 6
    if (!isSystemAdmin && callerProfile.school_id !== targetProfile.school_id) {
      return jsonResponse({ error: 'Cannot reset password for a user in a different school' })
    }

    // 6. Send the password reset email
    const { error: resetError } = await serviceClient.auth.resetPasswordForEmail(
      targetProfile.email,
      { redirectTo: 'https://sproutmap.org/reset-password' }
    )

    if (resetError) {
      console.error('resetPasswordForEmail error:', resetError)
      return jsonResponse({ error: resetError.message || 'Failed to send reset email' })
    }

    return jsonResponse({
      success: true,
      email: targetProfile.email,
    })
  } catch (err) {
    console.error('reset-password error:', err)
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal server error' }
    )
  }
})
