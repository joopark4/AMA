import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
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

  // JWT verification (no premium check needed for voice listing)
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
    const supertoneApiKey = Deno.env.get('SUPERTONE_API_KEY');
    if (!supertoneApiKey) {
      return new Response(JSON.stringify({ error: 'server_error', message: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse query parameters for search
    const url = new URL(req.url);
    const searchParams = url.searchParams;

    let apiUrl = 'https://supertoneapi.com/v1/voices';

    // If search params exist, use search endpoint
    const language = searchParams.get('language');
    const style = searchParams.get('style');
    const gender = searchParams.get('gender');

    if (language || style || gender) {
      const params = new URLSearchParams();
      if (language) params.set('language', language);
      if (style) params.set('style', style);
      if (gender) params.set('gender', gender);
      apiUrl = `https://supertoneapi.com/v1/voices/search?${params.toString()}`;
    }

    const response = await fetch(apiUrl, {
      headers: {
        'x-sup-api-key': supertoneApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: 'api_error', message: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const voices = await response.json();
    return new Response(JSON.stringify(voices), {
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
