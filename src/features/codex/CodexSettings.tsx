/**
 * CodexSettings — Codex CLI 설치/로그인/연결 상태 + 모델/성능 선택
 *
 * LLMSettings에서 provider가 'codex'일 때 추가 표시되는 섹션.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore, type CodexReasoningEffort, type CodexApprovalPolicy } from '../../stores/settingsStore';
import { useCodexConnection } from './useCodexConnection';

interface CodexModelInfo {
  id: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  defaultReasoningEffort: string;
  supportedReasoningEfforts: { reasoningEffort: string; description: string }[];
}

const EFFORT_LABELS: Record<CodexReasoningEffort, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra High',
};

export default function CodexSettings() {
  const { t } = useTranslation();
  const { settings, setCodexSettings } = useSettingsStore();
  const {
    connectionState,
    errorMessage,
    installed,
    authenticated,
    refreshStatus,
    reconnect,
  } = useCodexConnection();

  const [models, setModels] = useState<CodexModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // 연결 시 모델 목록 조회
  useEffect(() => {
    if (connectionState !== 'connected') return;
    setLoadingModels(true);
    invoke<{ data: CodexModelInfo[] }>('codex_list_models')
      .then((result) => {
        const visible = (result.data || []).filter((m) => !m.displayName.includes('hidden'));
        setModels(visible);
      })
      .catch(() => setModels([]))
      .finally(() => setLoadingModels(false));
  }, [connectionState]);

  const currentModel = models.find((m) => m.id === settings.codex.model);
  const availableEfforts = currentModel?.supportedReasoningEfforts || [];

  const handleSelectFolder = async () => {
    try {
      const selected = await invoke<string | null>('pick_folder', {
        title: t('settings.codex.selectFolder'),
      });
      if (typeof selected === 'string' && selected.trim().length > 0) {
        setCodexSettings({ workingDir: selected });
      }
    } catch {
      // 사용자가 취소
    }
  };

  const handleClearFolder = () => {
    setCodexSettings({ workingDir: '' });
  };

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
          <p className="text-xs text-amber-700">{t('settings.codex.installGuide')}</p>
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
          <p className="text-xs text-amber-700">{t('settings.codex.loginGuide')}</p>
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

      {/* 작업 폴더 */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('settings.codex.workingDir')}
        </label>
        <div className="flex items-center gap-2">
          <div
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 truncate text-gray-600 min-h-[38px] flex items-center"
            title={settings.codex.workingDir || undefined}
          >
            {settings.codex.workingDir || (
              <span className="text-gray-400">{t('settings.codex.workingDirPlaceholder')}</span>
            )}
          </div>
          <button
            onClick={handleSelectFolder}
            className="px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 whitespace-nowrap"
          >
            {t('settings.codex.selectFolder')}
          </button>
          {settings.codex.workingDir && (
            <button
              onClick={handleClearFolder}
              className="px-2 py-2 text-sm text-gray-400 hover:text-red-500"
              title={t('settings.codex.clearFolder')}
            >
              ✕
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500">{t('settings.codex.workingDirHelp')}</p>
      </div>

      {/* 모델 선택 */}
      {connectionState === 'connected' && (
        <>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {t('settings.codex.model')}
              {loadingModels && <span className="ml-2 text-xs text-gray-400">...</span>}
            </label>
            <select
              value={settings.codex.model}
              onChange={(e) => {
                const selected = models.find((m) => m.id === e.target.value);
                setCodexSettings({
                  model: e.target.value,
                  reasoningEffort: (selected?.defaultReasoningEffort || 'medium') as CodexReasoningEffort,
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}{m.isDefault ? ` (${t('settings.codex.default')})` : ''}
                </option>
              ))}
            </select>
            {currentModel && (
              <p className="text-xs text-gray-500">{currentModel.description}</p>
            )}
          </div>

          {/* 성능 선택 */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {t('settings.codex.effort')}
            </label>
            <select
              value={settings.codex.reasoningEffort}
              onChange={(e) => setCodexSettings({ reasoningEffort: e.target.value as CodexReasoningEffort })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {availableEfforts.length > 0
                ? availableEfforts.map((e) => (
                    <option key={e.reasoningEffort} value={e.reasoningEffort}>
                      {EFFORT_LABELS[e.reasoningEffort as CodexReasoningEffort] || e.reasoningEffort}
                    </option>
                  ))
                : (['low', 'medium', 'high', 'xhigh'] as const).map((e) => (
                    <option key={e} value={e}>{EFFORT_LABELS[e]}</option>
                  ))
              }
            </select>
            {availableEfforts.find((e) => e.reasoningEffort === settings.codex.reasoningEffort) && (
              <p className="text-xs text-gray-500">
                {availableEfforts.find((e) => e.reasoningEffort === settings.codex.reasoningEffort)?.description}
              </p>
            )}
          </div>

          {/* 접근 권한 */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {t('settings.codex.approvalPolicy')}
            </label>
            <select
              value={settings.codex.approvalPolicy}
              onChange={(e) => setCodexSettings({ approvalPolicy: e.target.value as CodexApprovalPolicy })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="on-request">{t('settings.codex.approvalOnRequest')}</option>
              <option value="never">{t('settings.codex.approvalNever')}</option>
              <option value="untrusted">{t('settings.codex.approvalUntrusted')}</option>
            </select>
            <p className="text-xs text-gray-500">
              {settings.codex.approvalPolicy === 'never' && t('settings.codex.approvalNeverDesc')}
              {settings.codex.approvalPolicy === 'on-request' && t('settings.codex.approvalOnRequestDesc')}
              {settings.codex.approvalPolicy === 'untrusted' && t('settings.codex.approvalUntrustedDesc')}
            </p>
            {settings.codex.approvalPolicy === 'never' && (
              <p className="text-xs text-red-500 font-medium">{t('settings.codex.approvalNeverWarning')}</p>
            )}
          </div>
        </>
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
