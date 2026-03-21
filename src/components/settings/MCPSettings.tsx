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

export default function MCPSettings() {
  const { t } = useTranslation();
  const { settings, setSettings, setLLMSettings } = useSettingsStore();
  const [bridgeStatus, setBridgeStatus] = useState<'unknown' | 'ok' | 'offline'>('unknown');
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
      const ok = await invoke<boolean>('check_bridge_health');
      setBridgeStatus(ok ? 'ok' : 'offline');
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

  /** ON: 등록 확인 → LLM을 claude_code로 전환 */
  const handleToggleOn = async () => {
    setToggling(true);

    // 등록 시도 (실패해도 토글은 진행 — 이미 등록됐을 수 있음)
    await ensureRegistered();

    // 현재 LLM 설정 백업 (이미 claude_code가 아닐 때만)
    const currentLlm = useSettingsStore.getState().settings.llm;
    const prevLlm = currentLlm.provider !== 'claude_code' ? { ...currentLlm } : settings.mcpPreviousLlm;

    setSettings({
      mcpEnabled: true,
      mcpPreviousLlm: prevLlm,
    });
    setLLMSettings({
      provider: 'claude_code',
      model: 'dev-bridge',
      endpoint: 'http://127.0.0.1:8790',
    });

    setToggling(false);
  };

  /** OFF: 이전 LLM 설정으로 복원 */
  const handleToggleOff = () => {
    const prev = settings.mcpPreviousLlm;
    setSettings({ mcpEnabled: false });

    if (prev && prev.provider !== 'claude_code') {
      setLLMSettings(prev);
    }
  };

  const handleToggle = () => {
    if (settings.mcpEnabled) {
      handleToggleOff();
    } else {
      handleToggleOn();
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
      <p className="text-xs text-gray-500">
        {t('settings.mcp.description')}
      </p>

      {/* Channels 토글 */}
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

        {/* dev-bridge 연결 확인 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              bridgeStatus === 'ok' ? 'bg-green-400' : bridgeStatus === 'offline' ? 'bg-red-400' : 'bg-gray-300'
            }`} />
            <span className="text-xs text-gray-600">
              {bridgeStatus === 'ok' ? t('settings.mcp.bridgeConnected')
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
