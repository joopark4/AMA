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
    const { type, startDate, endDate, scope } = body;

    // Get profile + plan info for quota
    const { data: profile } = await supabaseUser
      .from('profiles')
      .select('plan_id, monthly_credit_limit_override, is_admin')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.is_admin === true;
    // [BETA] 공용 잔고 공유 — admin이 아니어도 scope='all' 요청을 허용한다. 합성(supertone-tts)
    // 측도 베타 기간에는 구독·개인 할당량 게이트를 해제했다.
    // apiCredits 계산(하단 isAllScope 분기)은 전체 공용 잔고라 어떤 사용자가 호출하든 동일한 값.
    // 단, 사용량 기록(tts_usage)의 user_id 필터링은 여전히 개인 단위로 필요하므로 별도로 분기.
    const isAllScope = scope === 'all';
    const includeApiCredits = isAllScope;
    const aggregateAllUsers = isAdmin && scope === 'all';

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
      let query = supabaseUser
        .from('tts_usage')
        .select('created_at, audio_duration, text_length')
        .gte('created_at', defaultStart)
        .lt('created_at', defaultEnd)
        .order('created_at', { ascending: false });

      // 사용량 기록 필터: 관리자만 전체 범위로 조회 (비관리자 베타 사용자는 본인 기록만 반환).
      if (!aggregateAllUsers) {
        query = query.eq('user_id', user.id);
      }

      const { data: records, error } = await query;

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
    let summaryQuery = supabaseUser
      .from('tts_usage')
      .select('audio_duration, text_length, credits_used')
      .gte('created_at', defaultStart)
      .lt('created_at', defaultEnd);

    if (!aggregateAllUsers) {
      summaryQuery = summaryQuery.eq('user_id', user.id);
    }

    const { data: usageData, error } = await summaryQuery;

    if (error) throw error;

    const totalSeconds = usageData?.reduce((s: number, r: { audio_duration: number | null }) => s + (r.audio_duration || 0), 0) ?? 0;
    const totalCharacters = usageData?.reduce((s: number, r: { text_length: number | null }) => s + (r.text_length || 0), 0) ?? 0;
    const totalRequests = usageData?.length ?? 0;

    // 베타: scope='all' 요청이면 Supertone API 전체 크레딧 잔액을 조회해 공유.
    // 관리자뿐 아니라 일반 사용자에게도 노출해 공용 잔고 UI를 구동한다.
    let apiCreditsData: { balance: number; used: number; total: number } | null = null;
    if (includeApiCredits) {
      const supertoneApiKey = Deno.env.get('SUPERTONE_API_KEY');
      if (supertoneApiKey) {
        try {
          // 1) 잔액 조회
          const creditsRes = await fetch('https://supertoneapi.com/v1/credits', {
            headers: { 'x-sup-api-key': supertoneApiKey },
          });
          let balance = 0;
          if (creditsRes.ok) {
            const creditsJson = await creditsRes.json();
            balance = creditsJson.balance ?? 0;
          }

          // 2) 이번 달 사용량 조회 (Supertone API 기준)
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const startTime = monthStart.toISOString();
          const endTime = now.toISOString();
          const usageUrl = `https://supertoneapi.com/v1/usage?start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`;
          const usageRes = await fetch(usageUrl, {
            headers: { 'x-sup-api-key': supertoneApiKey },
          });
          let apiUsedMinutes = 0;
          if (usageRes.ok) {
            const usageJson = await usageRes.json();
            // data[].results[].minutes_used 합산
            if (Array.isArray(usageJson.data)) {
              for (const bucket of usageJson.data) {
                if (Array.isArray(bucket.results)) {
                  for (const r of bucket.results) {
                    apiUsedMinutes += r.minutes_used ?? 0;
                  }
                }
              }
            }
          }

          const apiUsedSeconds = apiUsedMinutes * 60;
          apiCreditsData = {
            balance,
            used: apiUsedSeconds,
            total: apiUsedSeconds + balance,
          };
        } catch (e) {
          console.error('[supertone-usage] Failed to fetch API credits/usage:', e);
        }
      }
    }

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
      ...(isAllScope && apiCreditsData ? { apiCredits: apiCreditsData } : {}),
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
