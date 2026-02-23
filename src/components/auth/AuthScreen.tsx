import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { authService } from '../../services/auth/authService';
import { isMockMode, ENABLED_PROVIDERS } from '../../services/auth/oauthClient';
import { useAuthStore } from '../../stores/authStore';
import TermsModal from './TermsModal';
import type { OAuthProvider } from '../../services/auth/types';

const PROVIDER_ICONS: Record<OAuthProvider, string> = {
  google: 'G',
  apple: '',
  meta: 'f',
  x: 'X',
};

const PROVIDER_COLORS: Record<OAuthProvider, string> = {
  google: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
  apple: 'bg-black text-white hover:bg-gray-900',
  meta: 'bg-[#1877F2] text-white hover:bg-[#166FE5]',
  x: 'bg-black text-white hover:bg-gray-900',
};

export default function AuthScreen() {
  const { t } = useTranslation();
  const {
    isLoading,
    error,
    hasAgreedToTerms,
    setPendingProvider,
    setLoading,
    setError,
    setUser,
    setTokens,
    setHasAgreedToTerms,
  } = useAuthStore();

  const [agreedTerms, setAgreedTerms] = useState(hasAgreedToTerms);
  const [agreedPrivacy, setAgreedPrivacy] = useState(hasAgreedToTerms);
  const [termsModal, setTermsModal] = useState<'terms' | 'privacy' | null>(null);

  const allAgreed = agreedTerms && agreedPrivacy;

  const handleAgreementChange = (type: 'terms' | 'privacy', checked: boolean) => {
    if (type === 'terms') setAgreedTerms(checked);
    else setAgreedPrivacy(checked);
    // 둘 다 체크 시 스토어에 저장
    const termsOk = type === 'terms' ? checked : agreedTerms;
    const privacyOk = type === 'privacy' ? checked : agreedPrivacy;
    if (termsOk && privacyOk) setHasAgreedToTerms(true);
  };

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    setLoading(true);
    setError(null);
    try {
      // Supabase env 미설정 시 → MockAuthService로 직접 처리
      if (isMockMode()) {
        const result = await authService.handleCallback('mock_code', 'mock_state', 'mock_verifier');
        setUser(result.user);
        setTokens(result.tokens);
        setLoading(false);
        return;
      }

      const { authUrl } = await authService.initiateOAuth(provider, '', '');
      setPendingProvider(provider);
      await invoke('open_oauth_url', { url: authUrl });
      // 이후 처리는 App.tsx의 딥링크 이벤트 리스너에서 수행
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(t('auth.errors.providerError', { provider, error: message }));
      setLoading(false);
      setPendingProvider(null);
    }
  };

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

        {/* 약관 동의 (이미 동의한 경우 건너뜀) */}
        {!hasAgreedToTerms && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600">{t('auth.termsAgreement')}</p>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => handleAgreementChange('terms', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="flex-1">{t('auth.agreeToTerms')}</span>
              <button
                type="button"
                onClick={() => setTermsModal('terms')}
                className="text-xs text-blue-500 hover:underline flex-shrink-0"
              >
                {t('auth.viewTerms')}
              </button>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedPrivacy}
                onChange={(e) => handleAgreementChange('privacy', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="flex-1">{t('auth.agreeToPrivacy')}</span>
              <button
                type="button"
                onClick={() => setTermsModal('privacy')}
                className="text-xs text-blue-500 hover:underline flex-shrink-0"
              >
                {t('auth.viewTerms')}
              </button>
            </label>
          </div>
        )}

        <div className="space-y-3">
          {ENABLED_PROVIDERS.map((provider) => (
            <button
              key={provider}
              onClick={() => handleOAuthLogin(provider)}
              disabled={isLoading || (!hasAgreedToTerms && !allAgreed)}
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

      {/* 약관 모달 */}
      {termsModal && (
        <TermsModal type={termsModal} onClose={() => setTermsModal(null)} />
      )}
    </div>
  );
}
