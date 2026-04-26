import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ApiStatus =
  | 'ok'
  | 'unauthorized'
  | 'rate_limit'
  | 'server_error'
  | 'network'
  | 'no_key'
  | 'skipped';

interface VoiceUsageEntry {
  date: string;
  voice_id: string;
  name: string;
  style?: string;
  language?: string;
  model?: string;
  total_minutes_used: number;
}

function mapHttpStatus(status: number): ApiStatus {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'server_error';
  return 'server_error';
}

/** 500 응답을 stage 라벨과 함께 반환해 실제 실패 지점을 노출. */
function errorResponse(stage: string, err: unknown): Response {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[supertone-usage] ${stage} error:`, message, stack);
  return new Response(
    JSON.stringify({ error: 'server_error', stage, message }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

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

  let user: { id: string } | null = null;
  try {
    const { data, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !data.user) {
      return new Response(JSON.stringify({ error: 'Authentication failed', message: userError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    user = data.user;
  } catch (e) {
    return errorResponse('auth.getUser', e);
  }

  // body 파싱
  let body: { type?: string; startDate?: string; endDate?: string; scope?: string };
  try {
    body = await req.json();
  } catch (e) {
    return errorResponse('body.parse', e);
  }
  const { type, startDate, endDate, scope } = body;

  // profile 조회 — error를 throw하지 않고 로그만 남김.
  let profile: { plan_id?: string | null; monthly_credit_limit_override?: number | null; is_admin?: boolean | null } | null = null;
  try {
    const { data, error } = await supabaseUser
      .from('profiles')
      .select('plan_id, monthly_credit_limit_override, is_admin')
      .eq('id', user.id)
      .single();
    if (error) {
      console.warn('[supertone-usage] profile query non-fatal:', error.message);
    }
    profile = data;
  } catch (e) {
    return errorResponse('profile.query', e);
  }

  const isAdmin = profile?.is_admin === true;
  const isAllScope = scope === 'all';
  const includeApiCredits = isAllScope;
  const includeVoiceUsage = isAdmin && isAllScope;
  const aggregateAllUsers = isAdmin && scope === 'all';

  // plan 조회 — 없어도 creditLimit=0으로 진행.
  let plan: { monthly_credit_limit?: number | null } | null = null;
  try {
    const { data, error } = await supabaseUser
      .from('subscription_plans')
      .select('monthly_credit_limit')
      .eq('id', profile?.plan_id || 'free')
      .single();
    if (error) {
      console.warn('[supertone-usage] plan query non-fatal:', error.message);
    }
    plan = data;
  } catch (e) {
    return errorResponse('plan.query', e);
  }

  const creditLimit = profile?.monthly_credit_limit_override ?? plan?.monthly_credit_limit ?? 0;

  const now = new Date();
  const defaultStart = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const defaultEnd = endDate || now.toISOString();

  if (type === 'daily') {
    try {
      let query = supabaseUser
        .from('tts_usage')
        .select('created_at, audio_duration, text_length')
        .gte('created_at', defaultStart)
        .lt('created_at', defaultEnd)
        .order('created_at', { ascending: false });

      if (!aggregateAllUsers) {
        query = query.eq('user_id', user.id);
      }

      const { data: records, error } = await query;
      if (error) return errorResponse('tts_usage.daily', error);

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
    } catch (e) {
      return errorResponse('daily.handler', e);
    }
  }

  // summary
  let totalSeconds = 0;
  let totalCharacters = 0;
  let totalRequests = 0;
  try {
    let summaryQuery = supabaseUser
      .from('tts_usage')
      .select('audio_duration, text_length, credits_used')
      .gte('created_at', defaultStart)
      .lt('created_at', defaultEnd);

    if (!aggregateAllUsers) {
      summaryQuery = summaryQuery.eq('user_id', user.id);
    }

    const { data: usageData, error } = await summaryQuery;
    if (error) return errorResponse('tts_usage.summary', error);

    totalSeconds = usageData?.reduce((s: number, r: { audio_duration: number | null }) => s + (r.audio_duration || 0), 0) ?? 0;
    totalCharacters = usageData?.reduce((s: number, r: { text_length: number | null }) => s + (r.text_length || 0), 0) ?? 0;
    totalRequests = usageData?.length ?? 0;
  } catch (e) {
    return errorResponse('summary.query', e);
  }

  let creditsStatus: ApiStatus = 'skipped';
  let usageStatus: ApiStatus = 'skipped';
  let voiceUsageStatus: ApiStatus = 'skipped';
  let apiCreditsData: { balance: number; used: number; total: number } | null = null;
  let apiVoiceUsageData: { usages: VoiceUsageEntry[]; totalMinutes: number } | null = null;

  if (includeApiCredits) {
    const supertoneApiKey = Deno.env.get('SUPERTONE_API_KEY');
    if (!supertoneApiKey) {
      creditsStatus = 'no_key';
      usageStatus = 'no_key';
      if (includeVoiceUsage) voiceUsageStatus = 'no_key';
    } else {
      let balance: number | null = null;
      let apiUsedMinutes = 0;
      let usageOk = false;

      try {
        const creditsRes = await fetch('https://supertoneapi.com/v1/credits', {
          headers: { 'x-sup-api-key': supertoneApiKey },
        });
        if (creditsRes.ok) {
          const creditsJson = await creditsRes.json();
          balance = typeof creditsJson.balance === 'number' ? creditsJson.balance : 0;
          creditsStatus = 'ok';
        } else {
          creditsStatus = mapHttpStatus(creditsRes.status);
        }
      } catch (e) {
        console.error('[supertone-usage] credits fetch error:', e);
        creditsStatus = 'network';
      }

      try {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const startTime = monthStart.toISOString();
        const endTime = now.toISOString();
        const usageUrl = `https://supertoneapi.com/v1/usage?start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`;
        const usageRes = await fetch(usageUrl, {
          headers: { 'x-sup-api-key': supertoneApiKey },
        });
        if (usageRes.ok) {
          const usageJson = await usageRes.json();
          if (Array.isArray(usageJson.data)) {
            for (const bucket of usageJson.data) {
              if (Array.isArray(bucket.results)) {
                for (const r of bucket.results) {
                  apiUsedMinutes += r.minutes_used ?? 0;
                }
              }
            }
          }
          usageStatus = 'ok';
          usageOk = true;
        } else {
          usageStatus = mapHttpStatus(usageRes.status);
        }
      } catch (e) {
        console.error('[supertone-usage] usage fetch error:', e);
        usageStatus = 'network';
      }

      if (balance != null) {
        const apiUsedSeconds = usageOk ? apiUsedMinutes * 60 : 0;
        apiCreditsData = {
          balance,
          used: apiUsedSeconds,
          total: apiUsedSeconds + balance,
        };
      }

      if (includeVoiceUsage) {
        try {
          const monthStartLocal = new Date(now.getFullYear(), now.getMonth(), 1);
          const startDateYmd = monthStartLocal.toISOString().slice(0, 10);
          const endDateYmd = now.toISOString().slice(0, 10);
          const voiceUsageUrl = `https://supertoneapi.com/v1/voice-usage?start_date=${startDateYmd}&end_date=${endDateYmd}`;
          const voiceUsageRes = await fetch(voiceUsageUrl, {
            headers: { 'x-sup-api-key': supertoneApiKey },
          });
          if (voiceUsageRes.ok) {
            const vuJson = await voiceUsageRes.json();
            const usages: VoiceUsageEntry[] = Array.isArray(vuJson.usages) ? vuJson.usages : [];
            const totalMinutes = usages.reduce((s, u) => s + (u.total_minutes_used || 0), 0);
            apiVoiceUsageData = { usages, totalMinutes };
            voiceUsageStatus = 'ok';
          } else {
            voiceUsageStatus = mapHttpStatus(voiceUsageRes.status);
          }
        } catch (e) {
          console.error('[supertone-usage] voice-usage fetch error:', e);
          voiceUsageStatus = 'network';
        }
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
    ...(isAllScope
      ? {
          apiCredits: apiCreditsData,
          apiVoiceUsage: apiVoiceUsageData,
          apiStatus: {
            credits: creditsStatus,
            usage: usageStatus,
            voiceUsage: voiceUsageStatus,
          },
        }
      : {}),
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
