import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { authService } from '../../services/auth/authService';
import { isMockMode, ENABLED_PROVIDERS, PROVIDER_ICONS } from '../../services/auth/oauthClient';
import { useAuthStore } from '../../stores/authStore';
import TermsModal from './TermsModal';
import type { OAuthProvider } from '../../services/auth/types';

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
    const termsOk = type === 'terms' ? checked : agreedTerms;
    const privacyOk = type === 'privacy' ? checked : agreedPrivacy;
    // 둘 다 동의 → true, 하나라도 해제 → false (버그 수정: 해제 시 스토어 반영)
    setHasAgreedToTerms(termsOk && privacyOk);
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
      className="fixed inset-0 z-[230] flex items-center justify-center px-4"
      data-interactive="true"
    >
      {/* 반투명 backdrop (글래시 톤) */}
      <div
        className="absolute inset-0"
        style={{
          background: 'oklch(0.2 0 0 / 0.55)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />

      {/* 로그인 카드 */}
      <div
        className="glass-strong relative w-full max-w-sm"
        style={{
          padding: 28,
          borderRadius: 'var(--r-lg)',
          animation: 'scaleIn 280ms var(--ease)',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
        data-interactive="true"
      >
        <div className="text-center" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1
            style={{
              fontSize: 19,
              fontWeight: 700,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            {t('auth.title')}
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--ink-3)',
            }}
          >
            {t('auth.subtitle')}
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'oklch(0.95 0.04 25 / 0.6)',
              boxShadow: 'inset 0 0 0 1px oklch(0.7 0.15 25 / 0.4)',
              fontSize: 12.5,
              color: 'var(--danger)',
              lineHeight: 1.55,
            }}
          >
            {error}
          </div>
        )}

        {/* 약관 동의 (이미 동의한 경우 건너뜀) */}
        {!hasAgreedToTerms && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: 'var(--ink-2)',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {t('auth.termsAgreement')}
            </p>
            <TermsCheckbox
              checked={agreedTerms}
              onChange={(c) => handleAgreementChange('terms', c)}
              label={t('auth.agreeToTerms')}
              viewLabel={t('auth.viewTerms')}
              onView={() => setTermsModal('terms')}
            />
            <TermsCheckbox
              checked={agreedPrivacy}
              onChange={(c) => handleAgreementChange('privacy', c)}
              label={t('auth.agreeToPrivacy')}
              viewLabel={t('auth.viewTerms')}
              onView={() => setTermsModal('privacy')}
            />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ENABLED_PROVIDERS.map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={() => handleOAuthLogin(provider)}
              disabled={isLoading || (!hasAgreedToTerms && !allAgreed)}
              className="w-full flex items-center justify-center transition-all focus-ring"
              style={{
                gap: 10,
                padding: '12px 16px',
                borderRadius: 14,
                fontSize: 13.5,
                fontWeight: 500,
                background: 'oklch(1 0 0 / 0.7)',
                boxShadow: 'inset 0 0 0 1px var(--hairline)',
                color: 'var(--ink)',
                opacity: isLoading || (!hasAgreedToTerms && !allAgreed) ? 0.5 : 1,
                cursor: isLoading || (!hasAgreedToTerms && !allAgreed) ? 'not-allowed' : 'pointer',
                transitionDuration: '160ms',
                transitionTimingFunction: 'var(--ease)',
              }}
              data-interactive="true"
            >
              <span style={{ fontWeight: 700, width: 20, textAlign: 'center' }}>
                {PROVIDER_ICONS[provider] ?? provider[0].toUpperCase()}
              </span>
              {isLoading
                ? t('auth.loading')
                : t('auth.loginWith', { provider: t(`auth.providers.${provider}`) })}
            </button>
          ))}
        </div>

        <p
          className="text-center"
          style={{
            fontSize: 11.5,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
          }}
        >
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

/* ─── 약관 동의 체크박스 ─── */

function TermsCheckbox({
  checked,
  onChange,
  label,
  viewLabel,
  onView,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  viewLabel: string;
  onView: () => void;
}) {
  return (
    <label
      className="flex items-center cursor-pointer"
      style={{ gap: 8, fontSize: 13, color: 'var(--ink)' }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          width: 16,
          height: 16,
          accentColor: 'var(--accent)',
          cursor: 'pointer',
        }}
      />
      <span className="flex-1">{label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onView();
        }}
        style={{
          fontSize: 11.5,
          color: 'var(--accent-ink)',
          background: 'transparent',
          padding: '2px 6px',
          borderRadius: 6,
          flexShrink: 0,
        }}
      >
        {viewLabel}
      </button>
    </label>
  );
}
