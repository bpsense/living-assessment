// supabase/functions/invite-educator/index.ts
// Supabase Edge Function — creates an educator account server-side
// using the service-role key so the admin's session is never touched.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Helpers ────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

// ── Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    // 1. Verify the caller is an authenticated admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401)
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await anonClient.auth.getUser()
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    // Check caller's profile role
    const { data: callerProfile } = await anonClient
      .from('profiles')
      .select('role, school_id')
      .eq('id', user.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'admin') {
      return jsonResponse({ error: 'Only admins can invite educators' }, 403)
    }

    // 2. Parse request body
    const { email, full_name, school_id } = await req.json() as {
      email?: string
      full_name?: string
      school_id?: string
    }

    if (!email || !full_name || !school_id) {
      return jsonResponse({ error: 'email, full_name, and school_id are required' }, 400)
    }

    // Ensure the admin belongs to the same school
    if (callerProfile.school_id !== school_id) {
      return jsonResponse({ error: 'Cannot invite educators to a different school' }, 403)
    }

    // 3. Create the user server-side with the service role key
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name,
        role: 'educator',
        school_id,
      },
    })

    if (createError) {
      if (
        createError.message.toLowerCase().includes('already') ||
        createError.message.toLowerCase().includes('duplicate')
      ) {
        return jsonResponse({ error: 'An account with this email already exists.' }, 409)
      }
      return jsonResponse({ error: createError.message }, 400)
    }

    // 4. Generate a password reset link so the educator can set their password
    const { error: resetError } = await serviceClient.auth.admin.generateLink({
      type: 'recovery',
      email,
    })

    if (resetError) {
      // User was created but reset link generation failed — log but don't fail
      console.warn('Password reset link generation failed:', resetError.message)
    }

    return jsonResponse({
      success: true,
      user_id: newUser.user.id,
    })
  } catch (err) {
    console.error('invite-educator error:', err)
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      500
    )
  }
})
