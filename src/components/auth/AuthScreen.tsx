import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { generatePKCE, generateState, buildOAuthUrl } from '../../services/auth/oauthClient';
import { useAuthStore } from '../../stores/authStore';
import type { OAuthProvider } from '../../services/auth/types';

const PROVIDER_ICONS: Record<OAuthProvider, string> = {
  google: 'G',
  apple: '',
  meta: 'f',
};

const PROVIDER_COLORS: Record<OAuthProvider, string> = {
  google: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
  apple: 'bg-black text-white hover:bg-gray-900',
  meta: 'bg-[#1877F2] text-white hover:bg-[#166FE5]',
};

export default function AuthScreen() {
  const { t } = useTranslation();
  const {
    isLoading,
    error,
    setPendingProvider,
    setPkceVerifier,
    setOAuthState,
    setLoading,
    setError,
  } = useAuthStore();

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
      // 이후 처리는 App.tsx의 딥링크 이벤트 리스너에서 수행
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

  return (
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center"
      data-interactive="true"
    >
      {/* 반투명 배경 */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* 로그인 카드 */}
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-gray-900">{t('auth.title')}</h1>
          <p className="text-sm text-gray-500">{t('auth.subtitle')}</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {providers.map((provider) => (
            <button
              key={provider}
              onClick={() => handleOAuthLogin(provider)}
              disabled={isLoading}
              className={`
                w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl
                text-sm font-medium transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                ${PROVIDER_COLORS[provider]}
              `}
            >
              <span className="text-base font-bold w-5 text-center">
                {PROVIDER_ICONS[provider]}
              </span>
              {isLoading
                ? t('auth.loading')
                : t('auth.loginWith', { provider: t(`auth.providers.${provider}`) })}
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 leading-relaxed">
          {t('auth.termsNotice')}
        </p>
      </div>
    </div>
  );
}
