import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthTokens, AuthUser, OAuthProvider } from '../services/auth/types';

interface AuthState {
  // ── 퍼시스트 대상 ──────────────────────────────
  user: AuthUser | null;
  tokens: AuthTokens | null;

  // ── 런타임 상태 (퍼시스트 제외) ──────────────────
  isLoading: boolean;
  error: string | null;
  /** OAuth flow 진행 중인 제공자 */
  pendingProvider: OAuthProvider | null;
  /** PKCE verifier (OAuth flow 중 임시 저장) */
  pkceVerifier: string | null;
  /** CSRF 방지 state (OAuth flow 중 임시 저장) */
  oauthState: string | null;

  // ── 파생 상태 ─────────────────────────────────
  isAuthenticated: boolean;

  // ── 액션 ─────────────────────────────────────
  setUser: (user: AuthUser | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPendingProvider: (provider: OAuthProvider | null) => void;
  setPkceVerifier: (verifier: string | null) => void;
  setOAuthState: (state: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // 초기값
      user: null,
      tokens: null,
      isLoading: false,
      error: null,
      pendingProvider: null,
      pkceVerifier: null,
      oauthState: null,
      isAuthenticated: false,

      // 액션
      setUser: (user) =>
        set({ user, isAuthenticated: user !== null }),

      setTokens: (tokens) =>
        set({ tokens }),

      setLoading: (isLoading) =>
        set({ isLoading }),

      setError: (error) =>
        set({ error }),

      setPendingProvider: (pendingProvider) =>
        set({ pendingProvider }),

      setPkceVerifier: (pkceVerifier) =>
        set({ pkceVerifier }),

      setOAuthState: (oauthState) =>
        set({ oauthState }),

      logout: () =>
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          pendingProvider: null,
          pkceVerifier: null,
          oauthState: null,
          error: null,
        }),
    }),
    {
      name: 'mypartnerai-auth',
      // user와 tokens만 localStorage에 저장, 런타임 상태 제외
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
