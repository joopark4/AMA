/**
 * GeminiCliSettings — Gemini CLI(ACP) 설치/인증/연결 상태 + 작업 디렉터리·승인 모드
 *
 * LLMSettings에서 provider가 'gemini_cli'일 때 추가 표시되는 섹션.
 * 첫 버전(최소 UI): 상태 표시 + workingDir 입력 + approvalMode Pill + 재연결 버튼.
 * 모델 선택은 Gemini CLI가 자체 기본값을 쓰도록 비워 둔다.
 */
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import {
  useSettingsStore,
  type GeminiCliApprovalMode,
} from '../../stores/settingsStore';
import { useGeminiCliConnection } from './useGeminiCliConnection';

const APPROVAL_MODES: { value: GeminiCliApprovalMode; labelKey: string }[] = [
  { value: 'default', labelKey: 'settings.geminiCli.approvalDefault' },
  { value: 'auto_edit', labelKey: 'settings.geminiCli.approvalAutoEdit' },
  { value: 'yolo', labelKey: 'settings.geminiCli.approvalYolo' },
  { value: 'plan', labelKey: 'settings.geminiCli.approvalPlan' },
];

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
  } = useGeminiCliConnection();

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

      {/* 연결 상태 */}
      <div className="flex items-center" style={{ gap: 8 }}>
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: 999,
            background: statusDotColor[connectionState],
          }}
        />
        <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
          {t('settings.geminiCli.connection')}: {connectionLabel}
        </span>
        <button
          type="button"
          onClick={refreshStatus}
          className="focus-ring"
          style={{
            marginLeft: 'auto',
            padding: '4px 8px',
            fontSize: 11.5,
            color: 'var(--accent-ink)',
            background: 'transparent',
            borderRadius: 6,
          }}
          data-interactive="true"
        >
          {t('settings.geminiCli.refresh')}
        </button>
        <button
          type="button"
          onClick={reconnect}
          className="focus-ring"
          style={{
            padding: '4px 8px',
            fontSize: 11.5,
            color: 'var(--accent-ink)',
            background: 'transparent',
            borderRadius: 6,
          }}
          data-interactive="true"
        >
          {t('settings.geminiCli.retry')}
        </button>
      </div>
      {errorMessage && (
        <div style={{ fontSize: 11.5, color: 'var(--danger)' }}>
          {t('settings.geminiCli.error')}: {errorMessage}
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

      {/* 승인 모드 */}
      <div>
        <div
          style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 4 }}
        >
          {t('settings.geminiCli.approvalMode')}
        </div>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {APPROVAL_MODES.map(({ value, labelKey }) => {
            const active = settings.geminiCli.approvalMode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setGeminiCliSettings({ approvalMode: value })}
                className="focus-ring"
                style={{
                  padding: '6px 12px',
                  fontSize: 12.5,
                  borderRadius: 99,
                  background: active ? 'var(--accent)' : 'oklch(1 0 0 / 0.7)',
                  color: active ? 'white' : 'var(--ink-2)',
                  boxShadow: active ? 'none' : 'inset 0 0 0 1px var(--hairline)',
                  fontWeight: active ? 500 : 400,
                }}
                data-interactive="true"
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>
          {t('settings.geminiCli.approvalInfo')}
        </div>
      </div>
    </div>
  );
}
