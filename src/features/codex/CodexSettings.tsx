/**
 * CodexSettings — Codex CLI 설치/로그인/연결 상태 표시
 *
 * LLMSettings에서 provider가 'codex'일 때 추가 표시되는 섹션.
 */
import { useTranslation } from 'react-i18next';
import { useCodexConnection } from './useCodexConnection';

export default function CodexSettings() {
  const { t } = useTranslation();
  const {
    connectionState,
    errorMessage,
    installed,
    authenticated,
    refreshStatus,
    reconnect,
  } = useCodexConnection();

  const statusColor = {
    disconnected: 'bg-gray-400',
    connecting: 'bg-yellow-400 animate-pulse',
    connected: 'bg-green-500',
    error: 'bg-red-500',
  }[connectionState];

  const statusLabel = {
    disconnected: t('settings.codex.disconnected'),
    connecting: t('settings.codex.connecting'),
    connected: t('settings.codex.connected'),
    error: t('settings.codex.error'),
  }[connectionState];

  return (
    <div className="space-y-3">
      {/* 설치 상태 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{t('settings.codex.cliStatus')}</span>
        <span className={`text-sm font-medium ${installed ? 'text-green-600' : 'text-red-600'}`}>
          {installed === null ? '...' : installed ? t('settings.codex.installed') : t('settings.codex.notInstalled')}
        </span>
      </div>

      {installed === false && (
        <div className="p-3 bg-amber-50 rounded-lg">
          <p className="text-xs text-amber-700">
            {t('settings.codex.installGuide')}
          </p>
          <code className="block mt-1 text-xs bg-amber-100 px-2 py-1 rounded font-mono">
            npm install -g @openai/codex
          </code>
        </div>
      )}

      {/* 로그인 상태 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{t('settings.codex.authStatus')}</span>
        <span className={`text-sm font-medium ${authenticated ? 'text-green-600' : 'text-red-600'}`}>
          {authenticated === null ? '...' : authenticated ? t('settings.codex.loggedIn') : t('settings.codex.notLoggedIn')}
        </span>
      </div>

      {authenticated === false && (
        <div className="p-3 bg-amber-50 rounded-lg">
          <p className="text-xs text-amber-700">
            {t('settings.codex.loginGuide')}
          </p>
          <code className="block mt-1 text-xs bg-amber-100 px-2 py-1 rounded font-mono">
            codex login
          </code>
        </div>
      )}

      {/* 연결 상태 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-sm text-gray-600">{t('settings.codex.connection')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{statusLabel}</span>
          <button
            onClick={refreshStatus}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            {t('settings.codex.refresh')}
          </button>
        </div>
      </div>

      {connectionState === 'error' && errorMessage && (
        <div className="p-3 bg-red-50 rounded-lg">
          <p className="text-xs text-red-700">{errorMessage}</p>
          <button
            onClick={reconnect}
            className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
          >
            {t('settings.codex.retry')}
          </button>
        </div>
      )}

      {/* Codex 안내 */}
      <div className="p-3 bg-green-50 rounded-lg">
        <p className="text-xs text-green-700">
          {t('settings.codex.info')}
        </p>
      </div>
    </div>
  );
}
