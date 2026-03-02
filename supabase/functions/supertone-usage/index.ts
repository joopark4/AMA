import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  try {
    const body = await req.json();
    const { type, startDate, endDate } = body;

    // Get profile + plan info for quota
    const { data: profile } = await supabaseUser
      .from('profiles')
      .select('plan_id, monthly_credit_limit_override')
      .eq('id', user.id)
      .single();

    const { data: plan } = await supabaseUser
      .from('subscription_plans')
      .select('monthly_credit_limit')
      .eq('id', profile?.plan_id || 'free')
      .single();

    const creditLimit = profile?.monthly_credit_limit_override ?? plan?.monthly_credit_limit ?? 0;

    const now = new Date();
    const defaultStart = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const defaultEnd = endDate || now.toISOString();

    if (type === 'daily') {
      const { data: records, error } = await supabaseUser
        .from('tts_usage')
        .select('created_at, audio_duration, text_length')
        .eq('user_id', user.id)
        .gte('created_at', defaultStart)
        .lt('created_at', defaultEnd)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by date
      const dailyMap = new Map<string, { seconds: number; characters: number; requests: number }>();
      for (const r of records || []) {
        const date = new Date(r.created_at).toISOString().slice(0, 10);
        const existing = dailyMap.get(date) || { seconds: 0, characters: 0, requests: 0 };
        existing.seconds += r.audio_duration || 0;
        existing.characters += r.text_length || 0;
        existing.requests += 1;
        dailyMap.set(date, existing);
      }

      const dailyRecords = Array.from(dailyMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => b.date.localeCompare(a.date));

      return new Response(JSON.stringify({ records: dailyRecords }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default: summary
    const { data: usageData, error } = await supabaseUser
      .from('tts_usage')
      .select('audio_duration, text_length, credits_used')
      .eq('user_id', user.id)
      .gte('created_at', defaultStart)
      .lt('created_at', defaultEnd);

    if (error) throw error;

    const totalSeconds = usageData?.reduce((s: number, r: { audio_duration: number | null }) => s + (r.audio_duration || 0), 0) ?? 0;
    const totalCharacters = usageData?.reduce((s: number, r: { text_length: number | null }) => s + (r.text_length || 0), 0) ?? 0;
    const totalRequests = usageData?.length ?? 0;

    return new Response(JSON.stringify({
      totalSeconds,
      totalCharacters,
      totalRequests,
      period: { start: defaultStart.slice(0, 10), end: defaultEnd.slice(0, 10) },
      quota: {
        limit: creditLimit,
        used: totalSeconds,
        remaining: Math.max(0, creditLimit - totalSeconds),
      },
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
