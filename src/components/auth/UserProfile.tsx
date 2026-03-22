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
      logout();
      usePremiumStore.getState().reset();
      // 프리미엄 TTS 사용 중이었으면 로컬 엔진으로 복원
      const settingsState = useSettingsStore.getState();
      if (settingsState.settings.tts.engine === 'supertone_api') {
        settingsState.setTTSSettings({ engine: 'supertonic' });
      }
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
      // 로컬 대화 기록도 삭제
      clearMessages();
      logout();
      usePremiumStore.getState().reset();
      // 프리미엄 TTS 사용 중이었으면 로컬 엔진으로 복원
      const settingsState = useSettingsStore.getState();
      if (settingsState.settings.tts.engine === 'supertone_api') {
        settingsState.setTTSSettings({ engine: 'supertonic' });
      }
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
              // OAuth 닉네임을 아바타 이름 초기값으로 연동
              const currentSettings = useSettingsStore.getState();
              if (result.user.nickname && !(currentSettings.settings.avatarName || '').trim()) {
                currentSettings.setAvatarName(result.user.nickname);
              }
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
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          {/* 계정 요약 (항상 표시) */}
          <button
            onClick={() => { setExpanded((v) => !v); setDeleteConfirm(false); setDeleteError(null); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="w-8 h-8 bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm flex-shrink-0">
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

              {/* 약관 링크 */}
              <div className="flex gap-3 text-xs text-gray-400">
                <button
                  type="button"
                  onClick={() => setTermsModal('terms')}
                  className="hover:text-blue-500 hover:underline"
                >
                  {t('auth.termsLink')}
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setTermsModal('privacy')}
                  className="hover:text-blue-500 hover:underline"
                >
                  {t('auth.privacyLink')}
                </button>
              </div>

              <button
                onClick={handleLogout}
                disabled={isLoading}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-white hover:text-gray-800 transition-colors disabled:opacity-50"
              >
                {t('auth.logout')}
              </button>

              {/* 계정 삭제 영역 */}
              <div className="pt-1 border-t border-gray-200 space-y-2">
                {deleteError && (
                  <p className="text-xs text-red-600">{deleteError}</p>
                )}
                {deleteConfirm && (
                  <p className="text-xs text-red-500 font-medium">
                    {t('auth.deleteAccountConfirm')}
                  </p>
                )}
                <button
                  onClick={handleDeleteAccount}
                  disabled={isLoading}
                  className={`
                    w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50
                    ${deleteConfirm
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'border border-red-200 text-red-500 hover:bg-red-50'}
                  `}
                >
                  {deleteConfirm ? t('auth.deleteAccountFinal') : t('auth.deleteAccount')}
                </button>
                {deleteConfirm && (
                  <button
                    onClick={() => { setDeleteConfirm(false); setDeleteError(null); }}
                    disabled={isLoading}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-white transition-colors disabled:opacity-50"
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
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        {/* 헤더 (항상 표시) */}
        <button
          onClick={() => { setExpanded((v) => !v); setError(null); }}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="w-8 h-8 bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
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
            {/* 에러 메시지 */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}

            {/* 개발/테스트 모드 안내 */}
            {mockMode && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                {t('auth.mockModeNotice')}
              </div>
            )}

            {/* 약관 동의 (이미 동의한 경우 건너뜀) */}
            {!hasAgreedToTerms && (
              <div className="space-y-1.5 pb-1">
                <p className="text-xs font-medium text-gray-600">{t('auth.termsAgreement')}</p>
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => handleAgreementChange('terms', e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="flex-1">{t('auth.agreeToTerms')}</span>
                  <button type="button" onClick={() => setTermsModal('terms')} className="text-blue-500 hover:underline flex-shrink-0">{t('auth.viewTerms')}</button>
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedPrivacy}
                    onChange={(e) => handleAgreementChange('privacy', e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="flex-1">{t('auth.agreeToPrivacy')}</span>
                  <button type="button" onClick={() => setTermsModal('privacy')} className="text-blue-500 hover:underline flex-shrink-0">{t('auth.viewTerms')}</button>
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
            <p className="text-center text-xs text-gray-400 pt-1">{t('auth.termsNotice')}</p>
          </div>
        )}
      </div>

      {termsModal && (
        <TermsModal type={termsModal} onClose={() => setTermsModal(null)} />
      )}
    </>
  );
}
