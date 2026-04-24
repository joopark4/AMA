import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { authService } from '../../services/auth/authService';
import { isMockMode, ENABLED_PROVIDERS, PROVIDER_ICONS, PROVIDER_COLORS } from '../../services/auth/oauthClient';
import { useAuthStore } from '../../stores/authStore';
import { useConversationStore } from '../../stores/conversationStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { usePremiumStore } from '../../features/premium-voice';
import TermsModal from './TermsModal';
import type { OAuthProvider } from '../../services/auth/types';

export default function UserProfile() {
  const { t } = useTranslation();
  const {
    user, tokens, isAuthenticated, error,
    logout, setLoading, isLoading,
    setUser, setTokens,
    setPendingProvider, setError,
    hasAgreedToTerms, setHasAgreedToTerms,
  } = useAuthStore();
  const { clearMessages } = useConversationStore();
  const [expanded, setExpanded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [termsModal, setTermsModal] = useState<'terms' | 'privacy' | null>(null);
  const [agreedTerms, setAgreedTerms] = useState(hasAgreedToTerms);
  const [agreedPrivacy, setAgreedPrivacy] = useState(hasAgreedToTerms);
  const oauthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const oauthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleAgreementChange = (type: 'terms' | 'privacy', checked: boolean) => {
    if (type === 'terms') setAgreedTerms(checked);
    else setAgreedPrivacy(checked);
    const termsOk = type === 'terms' ? checked : agreedTerms;
    const privacyOk = type === 'privacy' ? checked : agreedPrivacy;
    setHasAgreedToTerms(termsOk && privacyOk);
  };

  const clearOAuthTimeout = () => {
    if (oauthTimeoutRef.current) {
      clearTimeout(oauthTimeoutRef.current);
      oauthTimeoutRef.current = null;
    }
  };

  const clearOAuthPoll = () => {
    if (oauthPollRef.current) {
      clearInterval(oauthPollRef.current);
      oauthPollRef.current = null;
    }
  };

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      clearOAuthTimeout();
      clearOAuthPoll();
    };
  }, []);

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
      // 프리미엄 음성 상태 초기화 + TTS 엔진 로컬로 복원
      usePremiumStore.getState().reset();
      const settingsState = useSettingsStore.getState();
      if (settingsState.settings.tts.engine === 'supertone_api') {
        settingsState.setTTSSettings({ engine: 'supertonic' });
      }
      logout();
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setDeleteError(null);
      return;
    }
    setLoading(true);
    try {
      await authService.deleteAccount(tokens?.accessToken ?? '');
      // 프리미엄 음성 상태 초기화 + TTS 엔진 로컬로 복원
      usePremiumStore.getState().reset();
      const settingsState = useSettingsStore.getState();
      if (settingsState.settings.tts.engine === 'supertone_api') {
        settingsState.setTTSSettings({ engine: 'supertonic' });
      }
      // 로컬 대화 기록도 삭제
      clearMessages();
      logout();
    } catch {
      setDeleteError(t('auth.errors.deleteAccountFailed'));
    } finally {
      setLoading(false);
      setDeleteConfirm(false);
    }
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
      // OAuth 브라우저가 보이도록 설정 패널 닫기
      useSettingsStore.getState().closeSettings();
      await invoke('open_oauth_url', { url: authUrl });

      // 개발 모드: Vite dev 서버에서 OAuth 코드를 폴링
      // 프로덕션: App.tsx의 딥링크 이벤트 리스너에서 처리
      if (import.meta.env.DEV) {
        clearOAuthPoll();
        oauthPollRef.current = setInterval(async () => {
          try {
            const res = await fetch('/api/auth-code');
            const data = await res.json() as { code: string | null };
            if (data.code) {
              clearOAuthPoll();
              clearOAuthTimeout();
              const result = await authService.handleCallback(data.code, '', '');
              setUser(result.user);
              setTokens(result.tokens);
              // 의도적으로 OAuth 닉네임을 avatarName으로 자동 연동하지 않음.
              // App.tsx의 일반 OAuth 콜백 흐름과 동일한 정책.
              // (AvatarRestingBadge 등 UI에서 OAuth 계정 이름이 노출되는 문제 방지)
              setLoading(false);
              setPendingProvider(null);
            }
          } catch {
            // 폴링 실패는 무시 (서버가 아직 코드를 받지 못한 경우)
          }
        }, 1000);
      }

      // 5분 내 콜백이 없으면 로딩 상태 자동 복귀
      const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;
      oauthTimeoutRef.current = setTimeout(() => {
        clearOAuthPoll();
        setLoading(false);
        setPendingProvider(null);
        setError(t('auth.errors.timeout'));
      }, OAUTH_TIMEOUT_MS);
    } catch (err) {
      clearOAuthTimeout();
      clearOAuthPoll();
      const message = err instanceof Error ? err.message : String(err);
      setError(t('auth.errors.providerError', { provider, error: message }));
      setLoading(false);
      setPendingProvider(null);
    }
  };

  const mockMode = isMockMode();

  // ── 로그인 상태 ───────────────────────────────────────────────────────────
  if (isAuthenticated && user) {
    return (
      <>
        {/* 외곽 pill — 과거 `HeaderUserPill` 디자인(아바타 38px 원형 + 그라데이션,
            닉네임 13.5px/600, 이메일 11.5px ink-3)을 그대로 재사용.
            확장 시 같은 카드 하단에 상세/로그아웃/삭제 영역이 이어진다. */}
        <div
          className="overflow-hidden"
          style={{
            borderRadius: 16,
            background: 'oklch(1 0 0 / 0.55)',
            boxShadow: 'inset 0 0 0 1px var(--hairline)',
          }}
        >
          {/* 계정 요약 (항상 표시) */}
          <button
            onClick={() => { setExpanded((v) => !v); setDeleteConfirm(false); setDeleteError(null); }}
            className="w-full flex items-center transition-colors focus-ring hover:bg-[oklch(1_0_0_/_0.25)]"
            style={{ padding: '12px 14px', gap: 12 }}
          >
            <div
              className="grid place-items-center shrink-0"
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent), var(--glow))',
                color: 'white',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {user.nickname.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div
                className="truncate"
                style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}
              >
                {user.nickname}
              </div>
              <div
                className="truncate"
                style={{ fontSize: 11.5, color: 'var(--ink-3)' }}
              >
                {user.email}
              </div>
            </div>
            <svg
              className={`w-4 h-4 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
              style={{ color: 'var(--ink-3)' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* 상세 정보 (펼침) */}
          {expanded && (
            <div
              className="px-4 pb-4 space-y-3 border-t"
              style={{ borderColor: 'var(--hairline)', background: 'oklch(1 0 0 / 0.45)' }}
            >
              <div className="pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ink-3)' }}>{t('auth.profile.provider')}</span>
                  <span style={{ color: 'var(--ink-2)' }}>{t(`auth.providers.${user.provider}`)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ink-3)' }}>{t('auth.profile.joinedAt')}</span>
                  <span style={{ color: 'var(--ink-2)' }}>{new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* 약관 링크 */}
              <div className="flex gap-3 text-xs" style={{ color: 'var(--ink-3)' }}>
                <button
                  type="button"
                  onClick={() => setTermsModal('terms')}
                  className="hover:text-accent-ink hover:underline"
                >
                  {t('auth.termsLink')}
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setTermsModal('privacy')}
                  className="hover:text-accent-ink hover:underline"
                >
                  {t('auth.privacyLink')}
                </button>
              </div>

              <button
                onClick={handleLogout}
                disabled={isLoading}
                className="w-full px-4 py-2 rounded-lg border text-sm hover:bg-[oklch(1_0_0_/_0.6)] transition-colors disabled:opacity-50"
                style={{ borderColor: 'var(--hairline)', color: 'var(--ink-2)' }}
              >
                {t('auth.logout')}
              </button>

              {/* 계정 삭제 영역 */}
              <div className="pt-1 border-t space-y-2" style={{ borderColor: 'var(--hairline)' }}>
                {deleteError && (
                  <p className="text-xs text-danger">{deleteError}</p>
                )}
                {deleteConfirm && (
                  <p className="text-xs text-danger font-medium">
                    {t('auth.deleteAccountConfirm')}
                  </p>
                )}
                <button
                  onClick={handleDeleteAccount}
                  disabled={isLoading}
                  className={`
                    w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50
                    ${deleteConfirm
                      ? 'bg-danger text-white hover:bg-danger'
                      : 'border border-[oklch(0.7_0.15_25_/_0.4)] text-danger hover:bg-[oklch(0.95_0.04_25_/_0.6)]'}
                  `}
                >
                  {deleteConfirm ? t('auth.deleteAccountFinal') : t('auth.deleteAccount')}
                </button>
                {deleteConfirm && (
                  <button
                    onClick={() => { setDeleteConfirm(false); setDeleteError(null); }}
                    disabled={isLoading}
                    className="w-full px-4 py-2 rounded-lg border text-sm hover:bg-[oklch(1_0_0_/_0.6)] transition-colors disabled:opacity-50"
                    style={{ borderColor: 'var(--hairline)', color: 'var(--ink-2)' }}
                  >
                    {t('auth.deleteAccountCancel')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {termsModal && (
          <TermsModal type={termsModal} onClose={() => setTermsModal(null)} />
        )}
      </>
    );
  }

  // ── 비로그인 상태 ─────────────────────────────────────────────────────────
  return (
    <>
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--hairline)' }}
      >
        {/* 헤더 (항상 표시) */}
        <button
          onClick={() => { setExpanded((v) => !v); setError(null); }}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[oklch(0.92_0.02_60_/_0.7)] transition-colors"
        >
          <div
            className="w-8 h-8 flex items-center justify-center flex-shrink-0"
            style={{ background: 'oklch(1 0 0 / 0.45)', color: 'var(--ink-3)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>{t('auth.profile.title')}</p>
            <p className="text-xs" style={{ color: 'var(--ink-3)' }}>{t('auth.subtitle')}</p>
          </div>
          <svg
            className={`w-4 h-4 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            style={{ color: 'var(--ink-3)' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* OAuth 버튼 (펼침) */}
        {expanded && (
          <div
            className="px-4 pb-4 space-y-2 border-t pt-3"
            style={{ borderColor: 'var(--hairline)', background: 'oklch(1 0 0 / 0.45)' }}
          >
            {/* 에러 메시지 */}
            {error && (
              <div className="rounded-lg bg-[oklch(0.95_0.04_25_/_0.6)] border border-[oklch(0.7_0.15_25_/_0.4)] px-3 py-2 text-xs text-danger">
                {error}
              </div>
            )}

            {/* 개발/테스트 모드 안내 */}
            {mockMode && (
              <div className="rounded-lg bg-[oklch(0.95_0.04_75_/_0.6)] border border-[oklch(0.7_0.15_75_/_0.4)] px-3 py-2 text-xs text-warn">
                {t('auth.mockModeNotice')}
              </div>
            )}

            {/* 약관 동의 (이미 동의한 경우 건너뜀) */}
            {!hasAgreedToTerms && (
              <div className="space-y-1.5 pb-1">
                <p className="text-xs font-medium" style={{ color: 'var(--ink-2)' }}>{t('auth.termsAgreement')}</p>
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--ink-2)' }}>
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => handleAgreementChange('terms', e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-accent-ink focus:ring-accent"
                    style={{ borderColor: 'var(--hairline)' }}
                  />
                  <span className="flex-1">{t('auth.agreeToTerms')}</span>
                  <button type="button" onClick={() => setTermsModal('terms')} className="text-accent-ink hover:underline flex-shrink-0">{t('auth.viewTerms')}</button>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--ink-2)' }}>
                  <input
                    type="checkbox"
                    checked={agreedPrivacy}
                    onChange={(e) => handleAgreementChange('privacy', e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-accent-ink focus:ring-accent"
                    style={{ borderColor: 'var(--hairline)' }}
                  />
                  <span className="flex-1">{t('auth.agreeToPrivacy')}</span>
                  <button type="button" onClick={() => setTermsModal('privacy')} className="text-accent-ink hover:underline flex-shrink-0">{t('auth.viewTerms')}</button>
                </label>
              </div>
            )}

            {ENABLED_PROVIDERS.map((provider) => (
              <button
                key={provider}
                onClick={() => handleOAuthLogin(provider)}
                disabled={isLoading || (!hasAgreedToTerms && !(agreedTerms && agreedPrivacy))}
                className={`
                  w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  text-sm font-medium transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${PROVIDER_COLORS[provider] ?? 'bg-gray-100 text-gray-600'}
                `}
              >
                <span className="w-4 text-center font-bold">{PROVIDER_ICONS[provider] ?? provider[0].toUpperCase()}</span>
                {isLoading
                  ? t('auth.loading')
                  : t('auth.loginWith', { provider: t(`auth.providers.${provider}`) })}
              </button>
            ))}
            <p className="text-center text-xs pt-1" style={{ color: 'var(--ink-3)' }}>{t('auth.termsNotice')}</p>
          </div>
        )}
      </div>

      {termsModal && (
        <TermsModal type={termsModal} onClose={() => setTermsModal(null)} />
      )}
    </>
  );
}
