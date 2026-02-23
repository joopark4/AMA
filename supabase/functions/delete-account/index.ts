// supabase/functions/delete-account/index.ts
// Supabase Edge Function — 계정 영구 삭제
// 배포: Supabase 대시보드 → Edge Functions → delete-account

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: '인증 헤더 없음' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 사용자 JWT 검증
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: '인증 실패' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Admin으로 삭제 (Service Role Key — CASCADE로 모든 관련 데이터 삭제)
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
