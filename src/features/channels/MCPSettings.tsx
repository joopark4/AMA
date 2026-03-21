/**
 * MCPSettings — Claude Code Channels on/off + 글로벌 등록
 *
 * ON 시: 등록 확인 → 미등록이면 자동 등록 → AI 모델을 claude_code로 전환
 * OFF 시: 이전 AI 모델로 복원
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { invoke } from '@tauri-apps/api/core';
import { CLAUDE_CODE_PROVIDER, BRIDGE_DEFAULT_ENDPOINT, BRIDGE_DEFAULT_MODEL } from './constants';

/** 복사 가능한 터미널 명령어 블록 */
function CopyableCommand({ command }: { command: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(command).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-3">
      <code className="flex-1 text-xs text-green-400 font-mono select-all break-all">{command}</code>
      <button onClick={handleCopy} className="shrink-0 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600">
        {copied ? t('settings.mcp.copied') : t('settings.mcp.copy')}
      </button>
    </div>
  );
}

export default function MCPSettings() {
  const { t } = useTranslation();
  const { settings, setSettings, setLLMSettings } = useSettingsStore();
  const [bridgeStatus, setBridgeStatus] = useState<'unknown' | 'ok' | 'no-channel' | 'offline'>('unknown');
  const [checking, setChecking] = useState(false);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  // 글로벌 등록 상태 확인
  useEffect(() => {
    invoke<boolean>('check_channel_registered')
      .then(setRegistered)
      .catch(() => setRegistered(null));
  }, []);

  const checkBridgeStatus = async () => {
    setChecking(true);
    try {
      // 1. 서버 실행 확인
      const serverOk = await invoke<boolean>('check_bridge_health');
      if (!serverOk) {
        setBridgeStatus('offline');
        setChecking(false);
        return;
      }
      // 2. 채널 연결 테스트 (5초 타임아웃)
      const channelOk = await invoke<boolean>('check_bridge_channel');
      setBridgeStatus(channelOk ? 'ok' : 'no-channel');
    } catch {
      setBridgeStatus('offline');
    }
    setChecking(false);
  };

  /** 등록 확인 → 미등록이면 자동 등록 시도 (실패해도 계속 진행) */
  const ensureRegistered = async (): Promise<void> => {
    try {
      const isReg = await invoke<boolean>('check_channel_registered');
      if (isReg) {
        setRegistered(true);
        return;
      }
    } catch {
      // check 실패 시 등록 시도
    }

    // 자동 등록 시도
    try {
      await invoke<string>('register_channel_global', { projectDir: null });
      setRegistered(true);
      window.dispatchEvent(new CustomEvent('ama-toast', {
        detail: { type: 'info', message: t('settings.mcp.registerSuccess') },
      }));
    } catch (err) {
      // 등록 실패해도 토글은 진행 (수동 등록 안내)
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[MCPSettings] Auto-register failed:', msg);
    }
  };

  /** ON: 등록 확인 → bridge 연결 확인 → LLM을 claude_code로 전환 */
  const handleToggleOn = async () => {
    setToggling(true);

    // 등록 시도
    await ensureRegistered();

    // bridge 서버 실행 확인 (토글 ON은 서버 실행만 확인, 채널 테스트는 "연결 확인" 버튼에서)
    let serverOk = false;
    try {
      serverOk = await invoke<boolean>('check_bridge_health');
    } catch {
      serverOk = false;
    }

    if (!serverOk) {
      setBridgeStatus('offline');
      setToggling(false);
      window.dispatchEvent(new CustomEvent('ama-toast', {
        detail: { type: 'error', messageKey: 'settings.mcp.bridgeOffline' },
      }));
      return;
    }

    setBridgeStatus('ok');

    // 현재 LLM 설정 백업 (이미 claude_code가 아닐 때만)
    const currentLlm = useSettingsStore.getState().settings.llm;
    const prevLlm = currentLlm.provider !== CLAUDE_CODE_PROVIDER ? { ...currentLlm } : settings.mcpPreviousLlm;

    setSettings({
      mcpEnabled: true,
      mcpPreviousLlm: prevLlm,
    });
    setLLMSettings({
      provider: CLAUDE_CODE_PROVIDER,
      model: BRIDGE_DEFAULT_MODEL,
      endpoint: BRIDGE_DEFAULT_ENDPOINT,
    });

    setToggling(false);
  };

  /** OFF: 이전 LLM 설정으로 복원 */
  const handleToggleOff = () => {
    const prev = settings.mcpPreviousLlm;
    setSettings({ mcpEnabled: false });

    if (prev && prev.provider !== CLAUDE_CODE_PROVIDER) {
      setLLMSettings(prev);
    }
  };

  const handleToggle = async () => {
    if (settings.mcpEnabled) {
      handleToggleOff();
    } else {
      await handleToggleOn();
    }
  };

  const handleUnregister = async () => {
    try {
      await invoke<string>('unregister_channel_global');
      setRegistered(false);
      window.dispatchEvent(new CustomEvent('ama-toast', {
        detail: { type: 'info', message: t('settings.mcp.unregisterSuccess') },
      }));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      {/* 리서치 프리뷰 배너 */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <span className="text-amber-500 mt-0.5">&#9888;</span>
        <div>
          <span className="text-xs font-semibold text-amber-700">{t('settings.mcp.researchPreview')}</span>
          <p className="text-xs text-amber-600 mt-0.5">{t('settings.mcp.researchPreviewDesc')}</p>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        {t('settings.mcp.description')}
      </p>

      {/* Step 1: Claude Code 설치 확인 */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-gray-700">{t('settings.mcp.step1Title')}</p>
        <p className="text-xs text-gray-500">
          {t('settings.mcp.step1Desc')}{' '}
          <a
            href="https://docs.anthropic.com/en/docs/claude-code/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 underline"
          >
            Install Guide &rarr;
          </a>
        </p>
      </div>

      {/* Step 2: 터미널에서 실행 */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-gray-700">{t('settings.mcp.step2Title')}</p>
        <CopyableCommand command="claude --dangerously-load-development-channels server:ama-bridge --permission-mode acceptEdits" />
        <p className="text-xs text-gray-400 mt-1">{t('settings.mcp.step2Desc')}</p>
        <p className="text-xs text-amber-600 mt-1">{t('settings.mcp.step2Caution')}</p>
      </div>

      {/* Step 3: AMA에서 활성화 */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-gray-700">{t('settings.mcp.step3Title')}</p>
        <label className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-700">
              {t('settings.mcp.enabled')}
            </span>
            <p className="text-xs text-gray-400 mt-0.5">
              {t('settings.mcp.portInfo', { port: '8791' })}
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              settings.mcpEnabled ? 'bg-blue-500' : 'bg-gray-300'
            } ${toggling ? 'opacity-50' : ''}`}
            role="switch"
            aria-checked={settings.mcpEnabled}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                settings.mcpEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </label>
      </div>

      {/* 상태 표시 */}
      <div className="p-3 bg-gray-50 rounded-lg space-y-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${settings.mcpEnabled ? 'bg-green-400' : 'bg-gray-300'}`} />
          <span className="text-xs text-gray-600">
            {settings.mcpEnabled ? t('settings.mcp.statusOn') : t('settings.mcp.statusOff')}
          </span>
        </div>

        {/* AI 모델 잠금 안내 */}
        {settings.mcpEnabled && (
          <p className="text-xs text-blue-600">
            {t('settings.mcp.llmLocked')}
          </p>
        )}

        {/* ama-bridge 연결 확인 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              bridgeStatus === 'ok' ? 'bg-green-400'
                : bridgeStatus === 'no-channel' ? 'bg-amber-400'
                  : bridgeStatus === 'offline' ? 'bg-red-400'
                    : 'bg-gray-300'
            }`} />
            <span className="text-xs text-gray-600">
              {bridgeStatus === 'ok' ? t('settings.mcp.bridgeConnected')
                : bridgeStatus === 'no-channel' ? t('settings.mcp.bridgeNoChannel')
                  : bridgeStatus === 'offline' ? t('settings.mcp.bridgeOffline')
                    : t('settings.mcp.bridgeUnknown')}
            </span>
          </div>
          <button
            onClick={checkBridgeStatus}
            disabled={checking}
            className="text-xs text-blue-500 hover:text-blue-700 disabled:text-gray-400"
          >
            {checking ? '...' : t('settings.mcp.checkConnection')}
          </button>
        </div>
      </div>

      {/* 등록 상태 */}
      <div className="p-3 bg-purple-50 rounded-lg space-y-2">
        <p className="text-xs font-medium text-purple-700">
          {t('settings.mcp.globalSetupTitle')}
        </p>
        <p className="text-xs text-purple-600">
          {t('settings.mcp.globalSetupDesc')}
        </p>
        <div className="flex items-center gap-2">
          {registered ? (
            <>
              <span className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-lg">
                {t('settings.mcp.registered')}
              </span>
              <button
                onClick={handleUnregister}
                className="px-3 py-1.5 text-xs text-red-500 hover:text-red-700"
              >
                {t('settings.mcp.unregister')}
              </button>
            </>
          ) : (
            <span className="text-xs text-gray-500">
              {t('settings.mcp.notRegistered')}
            </span>
          )}
        </div>
      </div>

      {/* 리서치 프리뷰 안내 */}
      <p className="text-xs text-amber-600">
        {t('settings.mcp.testHint')}
      </p>
    </div>
  );
}
