import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthTokens, AuthUser, OAuthProvider } from '../services/auth/types';

interface AuthState {
  // ── 퍼시스트 대상 ──────────────────────────────
  user: AuthUser | null;
  tokens: AuthTokens | null;
  /** 약관 동의 완료 여부 (로컬 persist, 재로그인 시 유지) */
  hasAgreedToTerms: boolean;

  // ── 런타임 상태 (퍼시스트 제외) ──────────────────
  isLoading: boolean;
  error: string | null;
  /** OAuth flow 진행 중인 제공자 */
  pendingProvider: OAuthProvider | null;

  // ── 파생 상태 ─────────────────────────────────
  isAuthenticated: boolean;

  // ── 액션 ─────────────────────────────────────
  setUser: (user: AuthUser | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPendingProvider: (provider: OAuthProvider | null) => void;
  setHasAgreedToTerms: (agreed: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // 초기값
      user: null,
      tokens: null,
      hasAgreedToTerms: false,
      isLoading: false,
      error: null,
      pendingProvider: null,
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

      setHasAgreedToTerms: (hasAgreedToTerms) =>
        set({ hasAgreedToTerms }),

      logout: () =>
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          pendingProvider: null,
          error: null,
          // hasAgreedToTerms 유지: 재로그인 시 약관 동의 불필요
        }),
    }),
    {
      name: 'mypartnerai-auth',
      // user, tokens, hasAgreedToTerms를 localStorage에 저장, 런타임 상태 제외
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
        hasAgreedToTerms: state.hasAgreedToTerms,
      }),
    }
  )
);
