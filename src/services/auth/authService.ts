import type {
  AuthResult,
  AuthTokens,
  IAuthService,
  OAuthInitResult,
  OAuthProvider,
} from './types';
import { supabase } from './supabaseClient';
import { toExpiresAt } from './tokenManager';

// ─── Supabase 구현 ────────────────────────────────────────────────────────────

class SupabaseAuthService implements IAuthService {
  async initiateOAuth(
    provider: OAuthProvider,
    _pkceChallenge: string,
    _state: string
  ): Promise<OAuthInitResult> {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다');

    const supabaseProvider = provider === 'meta' ? 'facebook'
                           : provider === 'x'    ? 'twitter'
                           : provider;

    // 개발 모드: Vite dev 서버의 OAuth 콜백 미들웨어로 리다이렉트
    // 프로덕션: 딥링크 URL 스킴으로 리다이렉트
    // 프로덕션: GitHub Pages에 호스팅된 브릿지 페이지로 redirect.
    // 그 페이지가 사용자에게 "로그인 완료" UI를 보여준 뒤 ama://auth/callback?... 로
    // 자동 이동시켜 앱 deep link 핸들러가 인증 코드를 처리한다.
    // (직접 ama:// 로 redirect 하면 브라우저 탭이 빈 화면으로 남는 UX 이슈가 있음.)
    const redirectTo = import.meta.env.DEV
      ? 'http://localhost:1420/auth/callback'
      : 'https://joopark4.github.io/apps/ama/auth/callback';

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: supabaseProvider as Parameters<typeof supabase.auth.signInWithOAuth>[0]['provider'],
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw new Error(`OAuth 초기화 실패: ${error.message}`);
    if (!data.url) throw new Error('OAuth URL을 받지 못했습니다');

    return {
      authUrl: data.url,
      state: '',
    };
  }

  async handleCallback(
    code: string,
    _state: string,
    _pkceVerifier: string
  ): Promise<AuthResult> {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다');

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) throw new Error(`OAuth 콜백 처리 실패: ${error.message}`);
    if (!data.user || !data.session) throw new Error('세션 정보를 받지 못했습니다');

    const { user, session } = data;

    const rawProvider = (user.app_metadata?.provider as string | undefined) ?? 'google';
    const mappedProvider: OAuthProvider =
      rawProvider === 'facebook' ? 'meta' :
      rawProvider === 'twitter'  ? 'x'   :
      rawProvider as OAuthProvider;

    const authUser = {
      id: user.id,
      email: user.email ?? '',
      nickname: (user.user_metadata?.full_name as string | undefined)
             ?? (user.user_metadata?.user_name as string | undefined)
             ?? user.email
             ?? '사용자',
      provider: mappedProvider,
      avatarUrl: user.user_metadata?.avatar_url as string | undefined,
      createdAt: new Date(user.created_at).getTime(),
    };

    return {
      user: authUser,
      tokens: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: toExpiresAt(session.expires_in ?? 3600),
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다');

    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error) throw new Error(`토큰 갱신 실패: ${error.message}`);
    if (!data.session) throw new Error('갱신된 세션 정보를 받지 못했습니다');

    const { session } = data;
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: toExpiresAt(session.expires_in ?? 3600),
    };
  }

  async logout(_accessToken: string): Promise<void> {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async deleteAccount(accessToken: string): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase 설정이 없습니다');
    }

    const res = await fetch(
      `${supabaseUrl}/functions/v1/delete-account`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': supabaseAnonKey,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const reason = (data as { error?: string }).error ?? `${res.status} ${res.statusText}`;
      throw new Error(`계정 삭제 실패: ${reason}`);
    }
  }
}

// ─── 개발/테스트용 Mock 구현 ──────────────────────────────────────────────────

class MockAuthService implements IAuthService {
  async initiateOAuth(
    _provider: OAuthProvider,
    _pkceChallenge: string,
    _state: string
  ): Promise<OAuthInitResult> {
    return {
      authUrl: 'ama://auth/callback?code=mock_code&state=mock_state',
      state: 'mock_state',
    };
  }

  async handleCallback(
    _code: string,
    _state: string,
    _pkceVerifier: string
  ): Promise<AuthResult> {
    await delay(800);
    return {
      user: {
        id: 'mock_user_001',
        email: 'demo@mypartnerai.com',
        nickname: '데모 사용자',
        provider: 'google',
        createdAt: Date.now(),
      },
      tokens: {
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
        expiresAt: toExpiresAt(3600),
      },
    };
  }

  async refreshToken(_refreshToken: string): Promise<AuthTokens> {
    await delay(300);
    return {
      accessToken: 'mock_access_token_refreshed',
      refreshToken: 'mock_refresh_token',
      expiresAt: toExpiresAt(3600),
    };
  }

  async logout(_accessToken: string): Promise<void> {
    await delay(200);
  }

  async deleteAccount(_accessToken: string): Promise<void> {
    await delay(500);
  }
}

// ─── 서비스 인스턴스 팩토리 ───────────────────────────────────────────────────

function createAuthService(): IAuthService {
  if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
    return new SupabaseAuthService();
  }
  console.warn('[AuthService] VITE_SUPABASE_URL 미설정 → MockAuthService 사용');
  return new MockAuthService();
}

export const authService = createAuthService();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
