import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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
    // GET: plan list
    if (req.method === 'GET') {
      const { data: plans } = await adminClient
        .from('subscription_plans')
        .select('*')
        .order('sort_order');
      return new Response(JSON.stringify({ plans }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'change-plan': {
        const { userId, planId, reason } = body;
        if (!userId || !planId) {
          return new Response(JSON.stringify({ error: 'userId and planId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: oldProfile } = await adminClient
          .from('profiles')
          .select('plan_id')
          .eq('id', userId)
          .single();

        const { error: updateError } = await adminClient.from('profiles').update({
          plan_id: planId,
          is_premium: planId !== 'free',
          plan_changed_at: new Date().toISOString(),
        }).eq('id', userId);

        if (updateError) throw updateError;

        await adminClient.from('subscription_history').insert({
          user_id: userId,
          old_plan_id: oldProfile?.plan_id || 'free',
          new_plan_id: planId,
          changed_by: user.id,
          reason: reason || null,
        });

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'set-quota-override': {
        const { userId, creditLimit } = body;
        if (!userId) {
          return new Response(JSON.stringify({ error: 'userId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { error: updateError } = await adminClient.from('profiles').update({
          monthly_credit_limit_override: creditLimit ?? null,
        }).eq('id', userId);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'toggle-admin': {
        const { userId, isAdmin } = body;
        if (!userId || typeof isAdmin !== 'boolean') {
          return new Response(JSON.stringify({ error: 'userId and isAdmin required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { error: updateError } = await adminClient.from('profiles').update({
          is_admin: isAdmin,
        }).eq('id', userId);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update-plan': {
        const { planId, name, monthlyCredits, isActive } = body;
        if (!planId) {
          return new Response(JSON.stringify({ error: 'planId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name;
        if (monthlyCredits !== undefined) updates.monthly_credit_limit = monthlyCredits;
        if (isActive !== undefined) updates.is_active = isActive;

        const { error: updateError } = await adminClient
          .from('subscription_plans')
          .update(updates)
          .eq('id', planId);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: 'server_error', message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
