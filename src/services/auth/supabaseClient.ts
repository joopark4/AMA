import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key
  ? createClient(url, key, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,  // Tauri에서 URL 자동감지 비활성화
        autoRefreshToken: true,
        persistSession: false,      // authStore에서 직접 persist
      },
    })
  : null;
