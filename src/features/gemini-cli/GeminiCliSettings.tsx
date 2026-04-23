/**
 * GeminiCliSettings — Gemini CLI(ACP) 설치/인증/연결 상태 + 작업 디렉터리·승인 모드
 *
 * LLMSettings에서 provider가 'gemini_cli'일 때 추가 표시되는 섹션.
 * 첫 버전(최소 UI): 상태 표시 + workingDir 입력 + approvalMode Pill + 재연결 버튼.
 * 모델 선택은 Gemini CLI가 자체 기본값을 쓰도록 비워 둔다.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import {
  useSettingsStore,
  type GeminiCliApprovalMode,
} from '../../stores/settingsStore';
import { Select } from '../../components/settings/forms';
import { useGeminiCliConnection } from './useGeminiCliConnection';

const APPROVAL_MODES: { value: GeminiCliApprovalMode; labelKey: string }[] = [
  { value: 'default', labelKey: 'settings.geminiCli.approvalDefault' },
  { value: 'auto_edit', labelKey: 'settings.geminiCli.approvalAutoEdit' },
  { value: 'yolo', labelKey: 'settings.geminiCli.approvalYolo' },
  { value: 'plan', labelKey: 'settings.geminiCli.approvalPlan' },
];

interface GeminiCliModel {
  modelId: string;
  name: string;
  description?: string;
}

interface GeminiCliModelList {
  availableModels: GeminiCliModel[];
  currentModelId?: string;
}

export default function GeminiCliSettings() {
  const { t } = useTranslation();
  const { settings, setGeminiCliSettings } = useSettingsStore();
  const {
    connectionState,
    errorMessage,
    installed,
    authenticated,
    refreshStatus,
    reconnect,
    syncApprovalMode,
  } = useGeminiCliConnection();

  const [models, setModels] = useState<GeminiCliModel[]>([]);

  // 연결된 상태에서 Gemini CLI가 session/new로 내려준 모델 목록 조회.
  useEffect(() => {
    if (connectionState !== 'connected') {
      setModels([]);
      return;
    }
    invoke<GeminiCliModelList | null>('gemini_cli_list_models')
      .then((result) => {
        setModels(result?.availableModels ?? []);
      })
      .catch(() => setModels([]));
  }, [connectionState]);

  const handleModelChange = async (modelId: string) => {
    setGeminiCliSettings({ model: modelId });
    // 활성 세션에 즉시 반영 — unstable RPC이므로 실패해도 설정값은 유지됨.
    try {
      await invoke('gemini_cli_set_model', { modelId });
    } catch {
      // best-effort
    }
  };

  const handleSelectFolder = async () => {
    try {
      const selected = await invoke<string | null>('pick_folder', {
        title: t('settings.geminiCli.selectFolder'),
      });
      if (typeof selected === 'string' && selected.trim().length > 0) {
        setGeminiCliSettings({ workingDir: selected });
      }
    } catch {
      // 사용자 취소
    }
  };

  const handleClearFolder = () => setGeminiCliSettings({ workingDir: '' });

  const statusDotColor: Record<typeof connectionState, string> = {
    disconnected: 'var(--ink-3)',
    connecting: 'var(--warn)',
    connected: 'var(--ok)',
    error: 'var(--danger)',
  };

  const connectionLabel = t(`settings.geminiCli.${connectionState}`);

  return (
    <div className="space-y-3" style={{ marginTop: 12 }}>
      {/* CLI 설치 상태 */}
      <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>
          {t('settings.geminiCli.cliStatus')}
        </div>
        <div style={{ color: installed ? 'var(--ok)' : 'var(--warn)' }}>
          {installed === null
            ? '…'
            : installed
              ? t('settings.geminiCli.installed')
              : t('settings.geminiCli.notInstalled')}
        </div>
        {installed === false && (
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
            {t('settings.geminiCli.installGuide')}
          </div>
        )}
      </div>

      {/* 인증 상태 */}
      <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>
          {t('settings.geminiCli.authStatus')}
        </div>
        <div style={{ color: authenticated ? 'var(--ok)' : 'var(--warn)' }}>
          {authenticated === null
            ? '…'
            : authenticated
              ? t('settings.geminiCli.loggedIn')
              : t('settings.geminiCli.notLoggedIn')}
        </div>
        {authenticated === false && (
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
            {t('settings.geminiCli.loginGuide')}
          </div>
        )}
      </div>

      {/* 연결 상태 — Codex 스타일(폰트·색)에 맞춤.
          재연결(retry)은 상시 노출하지 않고 error 상태에서만 에러 박스 내부에 표시. */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={connectionState === 'connecting' ? 'animate-pulse' : ''}
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: statusDotColor[connectionState],
            }}
          />
          <span className="text-sm" style={{ color: 'var(--ink-2)' }}>
            {t('settings.geminiCli.connection')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
            {connectionLabel}
          </span>
          <button
            type="button"
            onClick={refreshStatus}
            className="text-xs hover:underline"
            style={{ color: 'var(--accent)' }}
            data-interactive="true"
          >
            {t('settings.geminiCli.refresh')}
          </button>
        </div>
      </div>

      {connectionState === 'error' && errorMessage && (
        <div className="p-3 rounded-lg" style={{ background: 'oklch(0.95 0.04 25 / 0.5)' }}>
          <p className="text-xs" style={{ color: 'oklch(0.45 0.18 25)' }}>
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={reconnect}
            className="mt-2 text-xs text-danger hover:underline"
            data-interactive="true"
          >
            {t('settings.geminiCli.retry')}
          </button>
        </div>
      )}

      {/* 작업 디렉터리 */}
      <div>
        <div
          style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 4 }}
        >
          {t('settings.geminiCli.workingDir')}
        </div>
        <div className="flex items-center" style={{ gap: 6 }}>
          <input
            type="text"
            value={settings.geminiCli.workingDir}
            onChange={(e) => setGeminiCliSettings({ workingDir: e.target.value })}
            placeholder={t('settings.geminiCli.workingDirPlaceholder')}
            className="focus-ring"
            style={{
              flex: 1,
              minWidth: 0,
              padding: '6px 10px',
              fontSize: 12,
              borderRadius: 8,
              border: 0,
              background: 'oklch(1 0 0 / 0.7)',
              boxShadow: 'inset 0 0 0 1px var(--hairline)',
              color: 'var(--ink)',
            }}
            data-interactive="true"
          />
          <button
            type="button"
            onClick={handleSelectFolder}
            className="focus-ring shrink-0"
            style={{
              padding: '6px 10px',
              fontSize: 12,
              borderRadius: 8,
              background: 'var(--surface-1)',
              color: 'var(--ink-2)',
            }}
            data-interactive="true"
          >
            {t('settings.geminiCli.selectFolder')}
          </button>
          {settings.geminiCli.workingDir && (
            <button
              type="button"
              onClick={handleClearFolder}
              className="focus-ring shrink-0"
              style={{
                padding: '6px 10px',
                fontSize: 12,
                borderRadius: 8,
                background: 'transparent',
                color: 'var(--ink-3)',
              }}
              data-interactive="true"
            >
              {t('settings.geminiCli.clearFolder')}
            </button>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>
          {t('settings.geminiCli.workingDirHelp')}
        </div>
      </div>

      {/* 모델 선택 — 연결 후 session/new 응답의 availableModels를 Select로 표시 */}
      {models.length > 0 && (
        <div>
          <div
            style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 4 }}
          >
            {t('settings.geminiCli.model')}
          </div>
          <Select
            value={settings.geminiCli.model}
            onChange={(value) => {
              void handleModelChange(value);
            }}
            options={models.map((m) => ({ value: m.modelId, label: m.name }))}
          />
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>
            {t('settings.geminiCli.modelInfo')}
          </div>
        </div>
      )}

      {/* 승인 모드 — Select */}
      <div>
        <div
          style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 4 }}
        >
          {t('settings.geminiCli.approvalMode')}
        </div>
        <Select<GeminiCliApprovalMode>
          value={settings.geminiCli.approvalMode}
          onChange={(value) => {
            setGeminiCliSettings({ approvalMode: value });
            void syncApprovalMode(value);
          }}
          options={APPROVAL_MODES.map(({ value, labelKey }) => ({
            value,
            label: t(labelKey),
          }))}
        />
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>
          {t('settings.geminiCli.approvalInfo')}
        </div>
      </div>
    </div>
  );
}
