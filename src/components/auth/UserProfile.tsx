import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { authService } from '../../services/auth/authService';
import { generatePKCE, generateState, buildOAuthUrl } from '../../services/auth/oauthClient';
import { useAuthStore } from '../../stores/authStore';
import type { OAuthProvider } from '../../services/auth/types';

const PROVIDER_COLORS: Record<OAuthProvider, string> = {
  google: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
  apple: 'bg-black text-white hover:bg-gray-900',
  meta: 'bg-[#1877F2] text-white hover:bg-[#166FE5]',
};

const PROVIDER_ICONS: Record<OAuthProvider, string> = {
  google: 'G',
  apple: '',
  meta: 'f',
};

export default function UserProfile() {
  const { t } = useTranslation();
  const {
    user, tokens, isAuthenticated,
    logout, setLoading, isLoading,
    setPendingProvider, setPkceVerifier, setOAuthState, setError,
  } = useAuthStore();
  const [expanded, setExpanded] = useState(false);

  const handleLogout = async () => {
    if (!window.confirm(t('auth.logoutConfirm'))) return;
    setLoading(true);
    try {
      if (tokens?.accessToken) {
        await authService.logout(tokens.accessToken);
      }
    } catch {
      // 로그아웃 API 실패해도 로컬 상태는 초기화
    } finally {
      logout();
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    setLoading(true);
    setError(null);
    try {
      const { verifier, challenge } = await generatePKCE();
      const state = generateState();
      setPendingProvider(provider);
      setPkceVerifier(verifier);
      setOAuthState(state);
      const authUrl = buildOAuthUrl(provider, challenge, state);
      await invoke('open_oauth_url', { url: authUrl });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(t('auth.errors.providerError', { provider, error: message }));
      setLoading(false);
      setPendingProvider(null);
      setPkceVerifier(null);
      setOAuthState(null);
    }
  };

  const providers: OAuthProvider[] = ['google', 'apple', 'meta'];

  // ── 로그인 상태 ───────────────────────────────────────────────────────────
  if (isAuthenticated && user) {
    return (
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        {/* 계정 요약 (항상 표시) */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm flex-shrink-0">
            {user.nickname.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{user.nickname}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* 상세 정보 (펼침) */}
        {expanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100 bg-gray-50">
            <div className="pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('auth.profile.provider')}</span>
                <span className="text-gray-700">{t(`auth.providers.${user.provider}`)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('auth.profile.joinedAt')}</span>
                <span className="text-gray-700">{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-white hover:text-gray-800 transition-colors disabled:opacity-50"
            >
              {t('auth.logout')}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── 비로그인 상태 ─────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      {/* 헤더 (항상 표시) */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-gray-700">{t('auth.profile.title')}</p>
          <p className="text-xs text-gray-400">{t('auth.subtitle')}</p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* OAuth 버튼 (펼침) */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 bg-gray-50 pt-3">
          {providers.map((provider) => (
            <button
              key={provider}
              onClick={() => handleOAuthLogin(provider)}
              disabled={isLoading}
              className={`
                w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                text-sm font-medium transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                ${PROVIDER_COLORS[provider]}
              `}
            >
              <span className="w-4 text-center font-bold">{PROVIDER_ICONS[provider]}</span>
              {isLoading
                ? t('auth.loading')
                : t('auth.loginWith', { provider: t(`auth.providers.${provider}`) })}
            </button>
          ))}
          <p className="text-center text-xs text-gray-400 pt-1">{t('auth.termsNotice')}</p>
        </div>
      )}
    </div>
  );
}
