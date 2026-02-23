import type {
  AuthResult,
  AuthTokens,
  IAuthService,
  OAuthInitResult,
  OAuthProvider,
} from './types';
import { toExpiresAt } from './tokenManager';

// ─── 실제 백엔드 구현 ─────────────────────────────────────────────────────────

class BackendAuthService implements IAuthService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async initiateOAuth(
    provider: OAuthProvider,
    pkceChallenge: string,
    state: string
  ): Promise<OAuthInitResult> {
    const res = await fetch(`${this.baseUrl}/auth/oauth/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, pkceChallenge, state }),
    });
    if (!res.ok) throw new Error(`OAuth 초기화 실패: ${res.status}`);
    return res.json();
  }

  async handleCallback(
    code: string,
    state: string,
    pkceVerifier: string
  ): Promise<AuthResult> {
    const res = await fetch(`${this.baseUrl}/auth/oauth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state, pkceVerifier }),
    });
    if (!res.ok) throw new Error(`OAuth 콜백 처리 실패: ${res.status}`);
    const data = await res.json();
    return {
      user: data.user,
      tokens: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: toExpiresAt(data.expiresIn ?? 3600),
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const res = await fetch(`${this.baseUrl}/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) throw new Error(`토큰 갱신 실패: ${res.status}`);
    const data = await res.json();
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: toExpiresAt(data.expiresIn ?? 3600),
    };
  }

  async logout(accessToken: string): Promise<void> {
    await fetch(`${this.baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }
}

// ─── 개발/테스트용 Mock 구현 ──────────────────────────────────────────────────

class MockAuthService implements IAuthService {
  async initiateOAuth(
    _provider: OAuthProvider,
    _pkceChallenge: string,
    _state: string
  ): Promise<OAuthInitResult> {
    // 실제 OAuth 없이 즉시 성공 시뮬레이션
    return {
      authUrl: 'mypartnerai://auth/callback?code=mock_code&state=mock_state',
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
}

// ─── 서비스 인스턴스 팩토리 ───────────────────────────────────────────────────

function createAuthService(): IAuthService {
  const backendUrl = import.meta.env.VITE_AUTH_BACKEND_URL;
  if (backendUrl) {
    return new BackendAuthService(backendUrl);
  }
  console.warn('[AuthService] VITE_AUTH_BACKEND_URL 미설정 → MockAuthService 사용');
  return new MockAuthService();
}

export const authService = createAuthService();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
