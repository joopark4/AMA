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

  // User JWT verification
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
    const { text, voiceId, language, style, model, outputFormat, voiceSettings } = body;

    if (!text || !voiceId) {
      return new Response(JSON.stringify({ error: 'invalid_request', message: 'text and voiceId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // voiceId 형식 검증 (영숫자, 하이픈, 밑줄만 허용 — 경로 삽입 방지)
    if (typeof voiceId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(voiceId)) {
      return new Response(JSON.stringify({ error: 'invalid_request', message: 'Invalid voiceId format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Text length limit
    if (typeof text !== 'string' || text.length > 300) {
      return new Response(JSON.stringify({ error: 'invalid_request', message: 'Text must be a string of 300 characters or less' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // model/language/style 허용 목록 검증
    const ALLOWED_MODELS = ['sona_speech_1', 'sona_speech_2', 'sona_speech_2_flash'];
    if (model && !ALLOWED_MODELS.includes(model)) {
      return new Response(JSON.stringify({ error: 'invalid_request', message: 'Invalid model' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check premium status and quota
    const { data: profile } = await supabaseUser
      .from('profiles')
      .select('plan_id, monthly_credit_limit_override, is_premium, is_admin')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.is_admin === true;

    // 관리자는 프리미엄/할당량 체크 건너뛰기
    if (!isAdmin && !profile?.is_premium) {
      return new Response(JSON.stringify({ error: 'premium_required', message: 'Premium subscription required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let usedCredits = 0;
    let creditLimit = 0;

    if (!isAdmin) {
      const { data: plan } = await supabaseUser
        .from('subscription_plans')
        .select('monthly_credit_limit')
        .eq('id', profile.plan_id)
        .single();

      creditLimit = profile.monthly_credit_limit_override ?? plan?.monthly_credit_limit ?? 0;

      // Check monthly usage
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: usageData } = await supabaseUser
        .from('tts_usage')
        .select('credits_used')
        .eq('user_id', user.id)
        .gte('created_at', monthStart);

      usedCredits = usageData?.reduce((sum: number, r: { credits_used: number | null }) => sum + (r.credits_used || 0), 0) ?? 0;

      if (usedCredits >= creditLimit) {
        return new Response(JSON.stringify({
          error: 'quota_exceeded',
          message: 'Monthly credit limit exceeded',
          used: usedCredits,
          limit: creditLimit,
          plan: profile.plan_id,
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Call Supertone API
    const supertoneApiKey = Deno.env.get('SUPERTONE_API_KEY');
    if (!supertoneApiKey) {
      return new Response(JSON.stringify({ error: 'server_error', message: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supertoneBody: Record<string, unknown> = {
      text,
      language: language || 'ko',
      style: style || 'neutral',
      model: model || 'sona_speech_1',
      output_format: outputFormat || 'wav',
    };

    if (voiceSettings) {
      supertoneBody.voice_settings = {
        pitch_shift: voiceSettings.pitchShift ?? 0,
        pitch_variance: voiceSettings.pitchVariance ?? 1,
        speed: voiceSettings.speed ?? 1,
      };
    }

    const supertoneResponse = await fetch(
      `https://supertoneapi.com/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'x-sup-api-key': supertoneApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(supertoneBody),
      }
    );

    if (!supertoneResponse.ok) {
      const errorText = await supertoneResponse.text();
      let errorCode = 'server_error';
      if (supertoneResponse.status === 402) errorCode = 'insufficient_credits';
      else if (supertoneResponse.status === 429) errorCode = 'rate_limited';
      else if (supertoneResponse.status === 400) errorCode = 'invalid_request';
      else if (supertoneResponse.status === 403) errorCode = 'voice_access_denied';

      return new Response(JSON.stringify({ error: errorCode, message: errorText }), {
        status: supertoneResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get audio duration from response header
    const audioDuration = parseFloat(supertoneResponse.headers.get('X-Audio-Length') || '0');
    const creditsUsed = audioDuration; // 1 second = 1 credit

    // Record usage
    await supabaseUser.from('tts_usage').insert({
      user_id: user.id,
      voice_id: voiceId,
      voice_name: body.voiceName || null,
      model: model || 'sona_speech_1',
      language: language || 'ko',
      style: style || 'neutral',
      text_length: text.length,
      audio_duration: audioDuration,
      credits_used: creditsUsed,
    });

    // Updated quota info
    const newUsed = usedCredits + creditsUsed;
    const remaining = Math.max(0, creditLimit - newUsed);

    // Return audio binary
    const audioData = await supertoneResponse.arrayBuffer();
    return new Response(audioData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/wav',
        'X-Quota-Used': String(newUsed),
        'X-Quota-Limit': String(creditLimit),
        'X-Quota-Remaining': String(remaining),
        'X-Audio-Length': String(audioDuration),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: 'server_error', message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
