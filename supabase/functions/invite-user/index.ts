// supabase/functions/invite-user/index.ts
// Generic Edge Function for inviting users at any role level.
// Computes the caller's access level to enforce hierarchy rules:
//   - Inviting 'admin' requires caller level >= 5
//   - Inviting 'educator'/'parent'/'learner' requires level >= 4
// Optionally assigns the invited educator to a department (making them a dept admin).

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
    // 1. Verify the caller is authenticated
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

    // 2. Fetch caller's profile and compute access level
    const { data: callerProfile } = await anonClient
      .from('profiles')
      .select('role, school_id')
      .eq('id', user.id)
      .single()

    if (!callerProfile) {
      return jsonResponse({ error: 'Caller profile not found' })
    }

    const { data: sysAdmin } = await anonClient
      .from('system_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const isSystemAdmin = !!sysAdmin

    let callerLevel = 0
    if (isSystemAdmin) {
      callerLevel = 6
    } else if (callerProfile.role === 'admin') {
      callerLevel = 5
    } else if (callerProfile.role === 'educator') {
      const { data: deptAdmin } = await anonClient
        .from('department_admins')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      callerLevel = deptAdmin ? 4 : 3
    }

    if (callerLevel < 4) {
      return jsonResponse({ error: 'Insufficient permissions to invite users' })
    }

    // 3. Parse request body
    const { email, full_name, school_id, role, department_id, is_system_admin, student_id, classroom_id } = await req.json() as {
      email?: string
      full_name?: string
      school_id?: string
      role?: string
      department_id?: string
      is_system_admin?: boolean
      student_id?: string      // Link learner to existing student record
      classroom_id?: string    // Auto-create student record in this classroom
    }

    if (!email || !full_name || !school_id || !role) {
      return jsonResponse({ error: 'email, full_name, school_id, and role are required' })
    }

    const validRoles = ['admin', 'educator', 'parent', 'learner']
    if (!validRoles.includes(role)) {
      return jsonResponse({ error: `Invalid role: ${role}` })
    }

    // 4. Permission gates based on target role
    if (is_system_admin && callerLevel < 6) {
      return jsonResponse({ error: 'Only system admins can invite other system admins' })
    }

    if (role === 'admin' && !is_system_admin && callerLevel < 5) {
      return jsonResponse({ error: 'Only school admins and above can invite school admins' })
    }

    // Non-system-admins can only invite within their own school
    if (!isSystemAdmin && callerProfile.school_id !== school_id) {
      return jsonResponse({ error: 'Cannot invite users to a different school' })
    }

    // 5. Service client for privileged operations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check if email already exists
    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .limit(1)
      .maybeSingle()

    if (existingProfile) {
      return jsonResponse({ error: 'An account with this email already exists.' })
    }

    // 6. Invite user — creates the account AND sends the invite email
    const { data: inviteData, error: inviteErr } = await serviceClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          full_name,
          role,
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

    // 7. Ensure profile exists with correct role
    let linkedStudentId = student_id || null

    // 7a. For learners: if classroom_id provided but no student_id, auto-create student record
    if (role === 'learner' && classroom_id && !student_id) {
      const nameParts = full_name.split(' ')
      const firstName = nameParts[0] || full_name
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''

      const { data: newStudent, error: studentErr } = await serviceClient
        .from('students')
        .insert({
          school_id,
          classroom_id,
          first_name: firstName,
          last_name: lastName || firstName, // Fallback if single name
          student_status: 'active',
        })
        .select('id')
        .single()

      if (studentErr) {
        console.error('Auto-create student error:', studentErr)
      } else if (newStudent) {
        linkedStudentId = newStudent.id

        // Also create junction table entry for multi-classroom support
        const { error: scErr } = await serviceClient
          .from('student_classrooms')
          .upsert({
            student_id: newStudent.id,
            classroom_id,
            school_id,
            is_primary: true,
          }, { onConflict: 'student_id,classroom_id' })

        if (scErr) {
          console.error('Student-classroom enrollment error:', scErr)
        }
      }
    }

    const { error: upsertErr } = await serviceClient
      .from('profiles')
      .upsert({
        id: newUserId,
        school_id,
        role,
        full_name,
        email,
        avatar_url: null,
        ...(linkedStudentId ? { student_id: linkedStudentId } : {}),
      }, { onConflict: 'id' })

    if (upsertErr) {
      console.error('Profile upsert error:', upsertErr)
    }

    // 8. If department_id provided and role is educator, assign as department admin
    let departmentAssigned = false
    if (department_id && role === 'educator') {
      const { error: deptErr } = await serviceClient
        .from('department_admins')
        .upsert({
          user_id: newUserId,
          department_id,
          school_id,
        }, { onConflict: 'user_id,department_id' })

      if (deptErr) {
        console.error('Department admin assignment error:', deptErr)
      } else {
        departmentAssigned = true
      }
    }

    // 9. If is_system_admin, add to system_admins table
    let systemAdminAssigned = false
    if (is_system_admin) {
      const { error: sysAdminErr } = await serviceClient
        .from('system_admins')
        .upsert({ user_id: newUserId }, { onConflict: 'user_id' })

      if (sysAdminErr) {
        console.error('System admin assignment error:', sysAdminErr)
      } else {
        systemAdminAssigned = true
      }
    }

    return jsonResponse({
      success: true,
      user_id: newUserId,
      student_linked: !!linkedStudentId,
      department_assigned: departmentAssigned,
      system_admin_assigned: systemAdminAssigned,
    })
  } catch (err) {
    console.error('invite-user error:', err)
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal server error' }
    )
  }
})
