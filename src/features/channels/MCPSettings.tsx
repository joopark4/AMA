/**
 * MCPSettings — Claude Code Channels on/off + 글로벌 등록 (v2 리디자인).
 *
 * ON 시: 등록 확인 → 미등록이면 자동 등록 → AI 모델을 claude_code로 전환
 * OFF 시: 이전 AI 모델로 복원
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { AlertTriangle, Copy, Check } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { Field, Row, SectionHint, Toggle } from '../../components/settings/forms';
import { CLAUDE_CODE_PROVIDER, BRIDGE_DEFAULT_ENDPOINT, BRIDGE_DEFAULT_MODEL } from './constants';

/** 복사 가능한 터미널 명령어 블록 — 다크 카드 + mono */
function CopyableCommand({ command }: { command: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(command).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div
      className="flex items-center"
      style={{
        gap: 8,
        padding: 12,
        borderRadius: 12,
        background: 'oklch(0.18 0.01 50)',
      }}
    >
      <code
        className="flex-1 select-all break-all"
        style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 11.5,
          color: 'oklch(0.85 0.12 130)',
          lineHeight: 1.55,
        }}
      >
        {command}
      </code>
      <button
        onClick={handleCopy}
        className="shrink-0 grid place-items-center focus-ring"
        style={{
          padding: '4px 8px',
          borderRadius: 6,
          fontSize: 11,
          background: 'oklch(0.3 0.01 50)',
          color: 'oklch(0.92 0 0)',
        }}
        data-interactive="true"
      >
        <span className="inline-flex items-center" style={{ gap: 4 }}>
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? t('settings.mcp.copied') : t('settings.mcp.copy')}
        </span>
      </button>
    </div>
  );
}

/** 상태 도트 + 라벨 */
function StatusDot({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <div
      className="flex items-center"
      // min-w-0 + flex-1 없이 부모 row에서 wrap 시 여러 줄 가능 — 버튼과의 정렬을 위해
      // dot은 shrink 안 하고, label만 남는 폭에서 wrap 또는 ellipsis 처리.
      style={{ gap: 8, minWidth: 0, flex: '1 1 auto' }}
      title={label}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 99,
          background: color,
          boxShadow: `0 0 8px ${color}`,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 12,
          color: 'var(--ink-2)',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
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

  useEffect(() => {
    invoke<boolean>('check_channel_registered')
      .then(setRegistered)
      .catch(() => setRegistered(null));
  }, []);

  const checkBridgeStatus = async () => {
    setChecking(true);
    try {
      const serverOk = await invoke<boolean>('check_bridge_health');
      if (!serverOk) {
        setBridgeStatus('offline');
      } else {
        const channelOk = await invoke<boolean>('check_bridge_channel');
        setBridgeStatus(channelOk ? 'ok' : 'no-channel');
      }
    } catch {
      setBridgeStatus('offline');
    }
    setChecking(false);
  };

  const ensureRegistered = async (): Promise<void> => {
    try {
      await invoke<string>('register_channel_global', { projectDir: null });
      setRegistered(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[MCPSettings] Auto-register failed:', msg);
    }
  };

  const handleToggleOn = async () => {
    setToggling(true);
    try {
      try {
        await invoke<string>('setup_bridge_plugin');
        window.dispatchEvent(new CustomEvent('ama-toast', {
          detail: { type: 'info', message: t('settings.mcp.setupSuccess') },
        }));
      } catch {
        window.dispatchEvent(new CustomEvent('ama-toast', {
          detail: { type: 'error', message: t('settings.mcp.setupFailManual') },
        }));
      }

      await ensureRegistered();

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

      checkBridgeStatus();
    } finally {
      setToggling(false);
    }
  };

  const handleToggleOff = () => {
    const prev = settings.mcpPreviousLlm;
    setSettings({ mcpEnabled: false });
    if (prev && prev.provider !== CLAUDE_CODE_PROVIDER) {
      setLLMSettings(prev);
    }
  };

  const handleToggle = async (on: boolean) => {
    if (on === settings.mcpEnabled) return;
    if (on) await handleToggleOn();
    else handleToggleOff();
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
    <div>
      {/* 리서치 프리뷰 배너 */}
      <div
        className="flex items-start"
        style={{
          gap: 8,
          padding: '10px 12px',
          borderRadius: 12,
          background: 'oklch(0.95 0.04 75 / 0.5)',
          boxShadow: 'inset 0 0 0 1px oklch(0.7 0.15 75 / 0.3)',
          marginBottom: 8,
        }}
      >
        <AlertTriangle size={14} style={{ color: 'var(--warn)', marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warn)' }}>
            {t('settings.mcp.researchPreview')}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 2 }}>
            {t('settings.mcp.researchPreviewDesc')}
          </div>
        </div>
      </div>

      <SectionHint>{t('settings.mcp.description')}</SectionHint>

      {/* Step 1 */}
      <Field label={t('settings.mcp.step1Title')}>
        <SectionHint>
          {t('settings.mcp.step1Desc')}{' '}
          <a
            href="https://docs.anthropic.com/en/docs/claude-code/overview"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-ink)', textDecoration: 'underline' }}
            data-interactive="true"
          >
            Install Guide →
          </a>
        </SectionHint>
      </Field>

      {/* Step 2 — AMA에서 활성화 (토글 먼저 켜면 자동 설치됨) */}
      <Field label={t('settings.mcp.step2Title')}>
        <Row
          label={
            <div>
              <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>
                {t('settings.mcp.enabled')}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                {t('settings.mcp.portInfo', { port: '8791' })}
              </div>
            </div>
          }
        >
          <Toggle
            on={settings.mcpEnabled}
            disabled={toggling}
            onChange={(on) => void handleToggle(on)}
          />
        </Row>
      </Field>

      {/* Step 3 — 터미널에서 Claude Code 실행 */}
      <Field label={t('settings.mcp.step3Title')}>
        <CopyableCommand command="claude --dangerously-load-development-channels server:ama-bridge --permission-mode bypassPermissions" />
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>
          {t('settings.mcp.step3Desc')}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--warn)', marginTop: 4 }}>
          {t('settings.mcp.step3Caution')}
        </div>
      </Field>

      {/* 상태 표시 */}
      <div
        style={{
          padding: 12,
          borderRadius: 12,
          background: 'oklch(1 0 0 / 0.55)',
          boxShadow: 'inset 0 0 0 1px var(--hairline)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginTop: 8,
        }}
      >
        <StatusDot
          color={settings.mcpEnabled ? 'var(--ok)' : 'oklch(0.7 0.01 50)'}
          label={settings.mcpEnabled ? t('settings.mcp.statusOn') : t('settings.mcp.statusOff')}
        />

        {settings.mcpEnabled && (
          <div style={{ fontSize: 11.5, color: 'var(--accent-ink)' }}>
            {t('settings.mcp.llmLocked')}
          </div>
        )}

        <div className="flex items-center justify-between">
          <StatusDot
            color={
              bridgeStatus === 'ok' ? 'var(--ok)'
                : bridgeStatus === 'no-channel' ? 'var(--warn)'
                  : bridgeStatus === 'offline' ? 'var(--danger)'
                    : 'oklch(0.7 0.01 50)'
            }
            label={
              bridgeStatus === 'ok' ? t('settings.mcp.bridgeConnected')
                : bridgeStatus === 'no-channel' ? t('settings.mcp.bridgeNoChannel')
                  : bridgeStatus === 'offline' ? t('settings.mcp.bridgeOffline')
                    : t('settings.mcp.bridgeUnknown')
            }
          />
          <button
            onClick={checkBridgeStatus}
            disabled={checking}
            className="focus-ring"
            style={{
              fontSize: 11.5,
              color: 'var(--accent-ink)',
              background: 'transparent',
              padding: '2px 6px',
              borderRadius: 6,
              opacity: checking ? 0.5 : 1,
            }}
            data-interactive="true"
          >
            {checking ? '...' : t('settings.mcp.checkConnection')}
          </button>
        </div>
      </div>

      {/* 등록 상태 */}
      <div
        style={{
          padding: 12,
          borderRadius: 12,
          background: 'var(--accent-soft)',
          boxShadow: 'inset 0 0 0 1px oklch(0.85 0.07 50 / 0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          marginTop: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-ink)' }}>
          {t('settings.mcp.globalSetupTitle')}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--accent-ink)', opacity: 0.8 }}>
          {t('settings.mcp.globalSetupDesc')}
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          {registered ? (
            <>
              <span
                style={{
                  padding: '5px 10px',
                  fontSize: 11.5,
                  background: 'oklch(0.95 0.05 160 / 0.6)',
                  color: 'var(--ok)',
                  borderRadius: 8,
                }}
              >
                {t('settings.mcp.registered')}
              </span>
              <button
                onClick={handleUnregister}
                className="focus-ring"
                style={{
                  padding: '5px 10px',
                  fontSize: 11.5,
                  color: 'var(--danger)',
                  background: 'transparent',
                  borderRadius: 8,
                }}
                data-interactive="true"
              >
                {t('settings.mcp.unregister')}
              </button>
            </>
          ) : (
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
              {t('settings.mcp.notRegistered')}
            </span>
          )}
        </div>
      </div>

      {/* 리서치 프리뷰 안내 */}
      <div style={{ fontSize: 11.5, color: 'var(--warn)', marginTop: 8 }}>
        {t('settings.mcp.testHint')}
      </div>
    </div>
  );
}
