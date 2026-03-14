// supabase/functions/invite-family/index.ts
// Supabase Edge Function — creates a family (parent) account server-side
// using the service-role key so the admin's session is never touched.

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' })
  }

  try {
    // 1. Verify the caller is an authenticated admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' })
    }

    const token = authHeader.replace('Bearer ', '')

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) {
      console.error('getUser failed:', authError?.message)
      return jsonResponse({ error: 'Unauthorized' })
    }

    const { data: callerProfile } = await anonClient
      .from('profiles')
      .select('role, school_id')
      .eq('id', user.id)
      .single()

    // Check if caller is a system admin
    const { data: sysAdmin } = await anonClient
      .from('system_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const isSystemAdmin = !!sysAdmin

    if (!callerProfile || (callerProfile.role !== 'admin' && !isSystemAdmin)) {
      return jsonResponse({ error: 'Only admins can invite family members' })
    }

    // 2. Parse request body
    const { email, full_name, school_id } = await req.json() as {
      email?: string
      full_name?: string
      school_id?: string
    }

    if (!email || !full_name || !school_id) {
      return jsonResponse({ error: 'email, full_name, and school_id are required' })
    }

    // System admins can invite to any school
    if (!isSystemAdmin && callerProfile.school_id !== school_id) {
      return jsonResponse({ error: 'Cannot invite family members to a different school' })
    }

    // 3. Service client for privileged operations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check if email already exists in profiles
    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .limit(1)
      .maybeSingle()

    if (existingProfile) {
      return jsonResponse({ error: 'An account with this email already exists.' })
    }

    // 4. Invite user — creates the account AND sends the invite email
    const { data: inviteData, error: inviteErr } = await serviceClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          full_name,
          role: 'parent',
          school_id,
        },
      }
    )

    if (inviteErr) {
      const msg = inviteErr.message || ''
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('duplicate')) {
        return jsonResponse({ error: 'An account with this email already exists.' })
      }
      return jsonResponse({ error: msg || 'Failed to invite user' })
    }

    const newUserId = inviteData.user.id

    // 5. Ensure profile exists with correct role
    const { error: upsertErr } = await serviceClient
      .from('profiles')
      .upsert({
        id: newUserId,
        school_id,
        role: 'parent',
        full_name,
        email,
        avatar_url: null,
      }, { onConflict: 'id' })

    if (upsertErr) {
      console.error('Profile upsert error:', upsertErr)
    }

    return jsonResponse({ success: true, user_id: newUserId })
  } catch (err) {
    console.error('invite-family error:', err)
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal server error' }
    )
  }
})
