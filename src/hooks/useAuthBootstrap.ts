import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../services/auth/supabaseClient';
import type { OAuthProvider } from '../services/auth/types';

const toExpiresAt = (seconds: number) =>
  Date.now() + seconds * 1000;

/**
 * Supabase 세션 ↔ authStore 동기화 안전망.
 *
 * - 앱 시작 시 supabase.auth.getSession()으로 기존 세션 복원
 * - supabase.auth.onAuthStateChange 구독해 SIGNED_IN/SIGNED_OUT 이벤트 시
 *   authStore 자동 업데이트
 *
 * 이렇게 하면 deep link 콜백 핸들러가 어떤 이유로 실패해도
 * Supabase 클라이언트가 세션을 가지고 있는 한 로그인 UI가 정상 표시됨.
 */
export function useAuthBootstrap(): void {
  const { setUser, setTokens, setLoading, setPendingProvider } = useAuthStore();

  useEffect(() => {
    if (!supabase) return;

    const applySession = (session: import('@supabase/supabase-js').Session | null) => {
      if (!session) {
        return;
      }
      const { user } = session;
      if (!user) return;

      const rawProvider = (user.app_metadata?.provider as string | undefined) ?? 'google';
      const mappedProvider: OAuthProvider =
        rawProvider === 'facebook' ? 'meta' :
        rawProvider === 'twitter'  ? 'x'   :
        (rawProvider as OAuthProvider);

      setUser({
        id: user.id,
        email: user.email ?? '',
        nickname: (user.user_metadata?.full_name as string | undefined)
               ?? (user.user_metadata?.user_name as string | undefined)
               ?? user.email
               ?? '사용자',
        provider: mappedProvider,
        avatarUrl: user.user_metadata?.avatar_url as string | undefined,
        createdAt: new Date(user.created_at).getTime(),
      });
      setTokens({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: toExpiresAt(session.expires_in ?? 3600),
      });
      setLoading(false);
      setPendingProvider(null);
    };

    // 1) 시작 시 기존 세션 복원
    void supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
    });

    // 2) auth 이벤트 구독 — 콜백/리프레시/로그아웃 모두 자동 반영
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        applySession(session);
      } else if (event === 'SIGNED_OUT') {
        // 명시적 로그아웃은 UserProfile.logout()이 처리하므로 여기선 추가 작업 없음
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
