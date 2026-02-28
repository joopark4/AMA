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
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Total & premium user counts
    const { count: totalUsers } = await adminClient
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: premiumUsers } = await adminClient
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_premium', true);

    // Plan distribution
    const { data: planDist } = await adminClient
      .from('profiles')
      .select('plan_id');

    const planCounts: Record<string, number> = {};
    for (const p of planDist || []) {
      planCounts[p.plan_id] = (planCounts[p.plan_id] || 0) + 1;
    }

    // This month total usage
    const { data: monthlyUsage } = await adminClient
      .from('tts_usage')
      .select('audio_duration, user_id')
      .gte('created_at', monthStart);

    const totalSeconds = monthlyUsage?.reduce((s, r) => s + (r.audio_duration || 0), 0) ?? 0;
    const totalRequests = monthlyUsage?.length ?? 0;
    const activeUsers = new Set(monthlyUsage?.map(r => r.user_id)).size;

    // Daily usage (last 30 days)
    const { data: dailyData } = await adminClient
      .from('tts_usage')
      .select('created_at, audio_duration, user_id')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false });

    const dailyMap = new Map<string, { seconds: number; requests: number; users: Set<string> }>();
    for (const r of dailyData || []) {
      const date = new Date(r.created_at).toISOString().slice(0, 10);
      const existing = dailyMap.get(date) || { seconds: 0, requests: 0, users: new Set<string>() };
      existing.seconds += r.audio_duration || 0;
      existing.requests += 1;
      existing.users.add(r.user_id);
      dailyMap.set(date, existing);
    }

    const dailyStats = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, seconds: data.seconds, requests: data.requests, users: data.users.size }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Top users this month
    const userUsageMap = new Map<string, { seconds: number; requests: number }>();
    for (const r of monthlyUsage || []) {
      const existing = userUsageMap.get(r.user_id) || { seconds: 0, requests: 0 };
      existing.seconds += r.audio_duration || 0;
      existing.requests += 1;
      userUsageMap.set(r.user_id, existing);
    }

    const topUserIds = Array.from(userUsageMap.entries())
      .sort((a, b) => b[1].seconds - a[1].seconds)
      .slice(0, 20);

    const topUsers = [];
    for (const [uid, usage] of topUserIds) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('email, nickname, plan_id')
        .eq('id', uid)
        .single();
      topUsers.push({
        userId: uid,
        email: profile?.email,
        nickname: profile?.nickname,
        planId: profile?.plan_id,
        totalSeconds: usage.seconds,
        totalRequests: usage.requests,
      });
    }

    return new Response(JSON.stringify({
      totalUsers: totalUsers || 0,
      premiumUsers: premiumUsers || 0,
      planDistribution: planCounts,
      monthlyUsage: { totalSeconds, totalRequests, activeUsers },
      dailyStats,
      topUsers,
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
