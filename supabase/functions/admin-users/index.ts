import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify user
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Authentication failed' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Admin check
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: adminProfile } = await adminClient
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!adminProfile?.is_admin) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const search = url.searchParams.get('search') || '';
    const planFilter = url.searchParams.get('plan') || '';

    // Single user detail
    if (userId) {
      const { data: userProfile } = await adminClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!userProfile) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get subscription history
      const { data: history } = await adminClient
        .from('subscription_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Get this month's usage
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: usage } = await adminClient
        .from('tts_usage')
        .select('credits_used, audio_duration, text_length')
        .eq('user_id', userId)
        .gte('created_at', monthStart);

      const monthlyUsed = usage?.reduce((s, r) => s + (r.credits_used || 0), 0) ?? 0;
      const monthlySeconds = usage?.reduce((s, r) => s + (r.audio_duration || 0), 0) ?? 0;
      const monthlyCharacters = usage?.reduce((s, r) => s + (r.text_length || 0), 0) ?? 0;
      const monthlyRequests = usage?.length ?? 0;

      return new Response(JSON.stringify({
        user: userProfile,
        usage: { monthlyUsed, monthlySeconds, monthlyCharacters, monthlyRequests },
        history: history || [],
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // User list
    let query = adminClient
      .from('profiles')
      .select('id, email, nickname, provider, is_premium, plan_id, monthly_credit_limit_override, is_admin, created_at', { count: 'exact' });

    if (search) {
      query = query.or(`email.ilike.%${search}%,nickname.ilike.%${search}%`);
    }
    if (planFilter) {
      query = query.eq('plan_id', planFilter);
    }

    const { data: users, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Get monthly usage for each user
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const usersWithUsage = [];
    for (const u of users || []) {
      const { data: usage } = await adminClient
        .from('tts_usage')
        .select('credits_used')
        .eq('user_id', u.id)
        .gte('created_at', monthStart);
      const monthlyUsed = usage?.reduce((s, r) => s + (r.credits_used || 0), 0) ?? 0;
      usersWithUsage.push({ ...u, monthlyUsed });
    }

    return new Response(JSON.stringify({
      users: usersWithUsage,
      total: count || 0,
      limit,
      offset,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: 'server_error', message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
