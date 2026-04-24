/**
 * ControlCluster — 우하단 컨트롤 영역 (v2 리디자인).
 *
 * 기존 StatusIndicator의 모든 기능(상태 표시 / 음성 / 키보드 / 기록 / 설정 /
 * 의존성 가이드 / 에러 토스트 / 글로벌 단축키 등)을 흡수하고,
 * 디자인은 핸드오프 문서의 ControlCluster 사양으로 교체했다.
 *
 * 추가 사항(v2):
 * - StatusPill을 클러스터 상단에 배치 (이전: 우상단)
 * - 자주 쓰는 기능(✨) 버튼 자리 — Phase 4 전까지 비활성/안내
 * - 아바타 숨기기 토글 (settingsStore.avatarHidden)
 *
 * 클릭스루: 모든 인터랙티브 wrapper에 data-interactive="true" 부여.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Coffee,
  ExternalLink,
  Eye,
  EyeOff,
  Heart,
  History,
  Keyboard,
  Mic,
  Settings as SettingsIcon,
  Sparkles,
} from 'lucide-react';
import { useConversationStore } from '../../stores/conversationStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useConversation } from '../../hooks/useConversation';
import { useGlobalVoiceShortcut } from '../../hooks/useGlobalVoiceShortcut';
import { DEFAULT_GLOBAL_SHORTCUT_ACCELERATOR } from '../../services/tauri/globalShortcutUtils';
import { llmRouter } from '../../services/ai/llmRouter';
import { ollamaClient } from '../../services/ai/ollamaClient';
import { localAiClient } from '../../services/ai/localAiClient';
import { CLAUDE_CODE_PROVIDER } from '../../features/channels';
import { QuickActionsPalette } from '../../features/quick-actions';
import { permissions } from '../../services/tauri/permissions';
import { ttsRouter } from '../../services/voice/ttsRouter';
import VoiceWaveform from './VoiceWaveform';
import AvatarRestingBadge from './AvatarRestingBadge';
import {
  type DependencyIssue,
  readSteps,
  buildModelUnsetIssue,
  buildEndpointUnsetIssue,
  buildCloudApiKeyIssue,
  buildLocalServerIssue,
  buildLocalModelIssue,
  isModelSelectableProvider,
} from './controlCluster/dependencyIssues';
import { StatusPill, type StatusKind } from './controlCluster/StatusPill';
import { ListeningBars } from './controlCluster/ListeningBars';
import { ClusterBtn, Divider } from './controlCluster/clusterPrimitives';
import { DependencyGuideModal } from './controlCluster/DependencyGuideModal';
import { TextInputRow } from './controlCluster/TextInputRow';

/* ────────────────────────────── 메인 컴포넌트 ────────────────────────────── */

export default function ControlCluster() {
  const { t } = useTranslation();
  const { status, isSpeaking } = useConversationStore();
  const {
    openSettings,
    settings,
    isHistoryOpen,
    toggleHistory,
    toggleAvatarHidden,
  } = useSettingsStore();
  const {
    isListening: isVoiceListening,
    isVoiceInputRuntimeBlocked,
    transcript,
    error: voiceError,
    needsMicrophonePermission,
    voiceInputUnavailableReason,
    ttsUnavailableReason,
    startListening,
    stopListening,
    sendMessage,
    openMicrophoneSettings,
  } = useConversation();

  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [showDependencyGuide, setShowDependencyGuide] = useState(false);
  const [hasTriedChat, setHasTriedChat] = useState(false);
  const [hasTriedVoiceInput, setHasTriedVoiceInput] = useState(false);
  const [hasAutoShownConfigGuide, setHasAutoShownConfigGuide] = useState(false);
  const [llmDependencyIssue, setLlmDependencyIssue] = useState<DependencyIssue | null>(null);
  const [globalShortcutToast, setGlobalShortcutToast] = useState<string | null>(null);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const sponsorWrapRef = useRef<HTMLDivElement>(null);

  // 후원 팝오버 외부 클릭 시 닫기. 팝오버 자체나 트리거 버튼 클릭은 wrap ref 내부로 분류되어 무시된다.
  useEffect(() => {
    if (!sponsorOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (target && sponsorWrapRef.current && !sponsorWrapRef.current.contains(target)) {
        setSponsorOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sponsorOpen]);

  // 메뉴바 실제 폭을 추적해 VoiceWaveform pill 폭을 동기화 (ResizeObserver).
  // 비교는 functional updater로 prev를 직접 받아 stale closure 회피.
  const menuBarRef = useRef<HTMLDivElement>(null);
  const [menuBarWidth, setMenuBarWidth] = useState<number>(320);
  useEffect(() => {
    const el = menuBarRef.current;
    if (!el) return;
    setMenuBarWidth(el.offsetWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (!w) return;
      setMenuBarWidth((prev) => (Math.abs(w - prev) > 0.5 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const avatarHidden = settings.avatarHidden;

  /* ─── 의존성 이슈 추적 (LLM provider/key/endpoint/model) ─── */
  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      const provider = settings.llm.provider;
      const model = settings.llm.model || '';
      const endpoint = settings.llm.endpoint || '';
      const apiKey = settings.llm.apiKey || '';

      if (!model.trim()) {
        // claude_code / codex는 외부 세션·CLI에서 모델을 결정하므로
        // settings.llm.model이 비어 있어도 이슈가 아니다 → 다음 흐름으로.
        // isModelSelectableProvider 가드로 좁혀 buildModelUnsetIssue가
        // 안전한 provider 타입만 받도록 한다 (cloud lookup undefined 차단).
        if (isModelSelectableProvider(provider)) {
          if (!cancelled) setLlmDependencyIssue(buildModelUnsetIssue(t, provider));
          return;
        }
        // claude_code / codex 분기: 다음 단계(isAvailable 체크 등)는 이들 provider에
        // 매치되는 분기가 없어 stale 이슈를 clear할 기회가 없다.
        // 이전 provider(예: openai)에서 발생한 API key 경고가 그대로 남는 회귀를
        // 방지하기 위해 여기서 명시적으로 null로 초기화한다.
        if (!cancelled) setLlmDependencyIssue(null);
      }
      if ((provider === 'ollama' || provider === 'localai') && !endpoint.trim()) {
        if (!cancelled) setLlmDependencyIssue(buildEndpointUnsetIssue(t, provider));
        return;
      }
      if (provider === 'openai' || provider === 'claude' || provider === 'gemini') {
        if (!apiKey.trim()) {
          if (!cancelled) setLlmDependencyIssue(buildCloudApiKeyIssue(t, provider));
          return;
        }
        if (!cancelled) setLlmDependencyIssue(null);
        return;
      }
      if (!hasTriedChat) {
        if (!cancelled) setLlmDependencyIssue(null);
        return;
      }
      const isAvailable = await llmRouter.isAvailable();
      if (!isAvailable) {
        if (!cancelled && (provider === 'ollama' || provider === 'localai')) {
          setLlmDependencyIssue(buildLocalServerIssue(t, provider, endpoint, model));
        }
        return;
      }
      if (provider === 'ollama') {
        const models = await ollamaClient.getAvailableModels();
        if (!cancelled) {
          if (!model || !models.includes(model)) {
            setLlmDependencyIssue(buildLocalModelIssue(t, provider, model));
          } else {
            setLlmDependencyIssue(null);
          }
        }
        return;
      }
      if (provider === 'localai') {
        const models = await localAiClient.getAvailableModels();
        if (!cancelled) {
          if (!model || !models.includes(model)) {
            setLlmDependencyIssue(buildLocalModelIssue(t, provider, model));
          } else {
            setLlmDependencyIssue(null);
          }
        }
        return;
      }
      if (!cancelled) setLlmDependencyIssue(null);
    };
    void update();
    return () => {
      cancelled = true;
    };
  }, [
    t,
    hasTriedChat,
    settings.llm.provider,
    settings.llm.model,
    settings.llm.endpoint,
    settings.llm.apiKey,
  ]);

  const isImmediateLlmConfigIssue =
    llmDependencyIssue?.id === 'llm-api-key' ||
    llmDependencyIssue?.id === 'llm-model-unset' ||
    llmDependencyIssue?.id === 'llm-endpoint-unset';

  useEffect(() => {
    if (isImmediateLlmConfigIssue && !hasAutoShownConfigGuide) {
      setShowDependencyGuide(true);
      setHasAutoShownConfigGuide(true);
      return;
    }
    if (!isImmediateLlmConfigIssue) {
      setHasAutoShownConfigGuide(false);
    }
  }, [isImmediateLlmConfigIssue, hasAutoShownConfigGuide]);

  const dependencyIssues = useMemo<DependencyIssue[]>(() => {
    const issues: DependencyIssue[] = [];
    if (hasTriedVoiceInput && voiceInputUnavailableReason) {
      issues.push({
        id: 'stt-whisper',
        title: t('dependency.issue.voice.title'),
        summary: voiceInputUnavailableReason,
        steps: readSteps(
          t,
          isVoiceInputRuntimeBlocked
            ? 'dependency.issue.voice.remoteSteps'
            : 'dependency.issue.voice.localSteps'
        ),
      });
    }
    if (hasTriedChat && ttsUnavailableReason) {
      issues.push({
        id: 'tts-supertonic',
        title: t('dependency.issue.tts.title'),
        summary: ttsUnavailableReason,
        steps: readSteps(t, 'dependency.issue.tts.steps'),
      });
    }
    if ((hasTriedChat || isImmediateLlmConfigIssue) && llmDependencyIssue) {
      issues.push(llmDependencyIssue);
    }
    return issues;
  }, [
    t,
    voiceInputUnavailableReason,
    ttsUnavailableReason,
    llmDependencyIssue,
    isImmediateLlmConfigIssue,
    isVoiceInputRuntimeBlocked,
    hasTriedChat,
    hasTriedVoiceInput,
  ]);

  useEffect(() => {
    if (dependencyIssues.length === 0 && showDependencyGuide) {
      setShowDependencyGuide(false);
    }
  }, [dependencyIssues.length, showDependencyGuide]);

  // 의존성 가이드 모달 ESC 닫기
  useEffect(() => {
    if (!showDependencyGuide) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDependencyGuide(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showDependencyGuide]);

  /* ─── 입력/음성 핸들러 ─── */
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    ttsRouter.ensureOutputDevice().catch(() => {});
    if (textInput.trim()) {
      setHasTriedChat(true);
      sendMessage(textInput.trim());
      setTextInput('');
    }
  };

  const handleVoiceToggle = useCallback(() => {
    ttsRouter.ensureOutputDevice().catch(() => {});
    if (isVoiceListening) {
      stopListening();
    } else {
      setHasTriedVoiceInput(true);
      void startListening();
    }
  }, [isVoiceListening, startListening, stopListening]);

  const handleSparklesClick = useCallback(() => {
    setQuickActionsOpen((v) => !v);
  }, []);

  /* ─── 글로벌 단축키 ─── */
  const globalShortcutSettings = settings.globalShortcut ?? {
    enabled: true,
    accelerator: DEFAULT_GLOBAL_SHORTCUT_ACCELERATOR,
  };
  const { registerError: globalShortcutRegisterError } = useGlobalVoiceShortcut({
    enabled: globalShortcutSettings.enabled,
    accelerator: globalShortcutSettings.accelerator,
    onTrigger: handleVoiceToggle,
  });

  useEffect(() => {
    if (!globalShortcutRegisterError) {
      setGlobalShortcutToast(null);
      return;
    }
    setGlobalShortcutToast(globalShortcutRegisterError);
  }, [globalShortcutRegisterError]);

  const handleOpenAccessibilitySettings = useCallback(async () => {
    try {
      await permissions.openAccessibilitySettings();
    } catch (error) {
      console.error('Failed to open accessibility settings:', error);
    }
  }, []);

  /* ─── 키보드 토글 부수효과 ─── */
  useEffect(() => {
    if (!showTextInput) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowTextInput(false);
        setTextInput('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showTextInput]);

  /* ─── StatusPill 결정 ─── */
  const pillKind: StatusKind = (() => {
    if (status === 'error') return 'error';
    if (isVoiceListening || status === 'listening') return 'listening';
    if (status === 'processing') return 'processing';
    if (status === 'speaking' || isSpeaking) return 'speaking';
    return 'idle';
  })();

  const pillLabel = (() => {
    if (isVoiceListening && transcript) {
      return transcript.length > 30 ? '…' + transcript.slice(-30) : transcript;
    }
    switch (pillKind) {
      case 'listening':
        return t('status.listening');
      case 'processing':
        return t('status.processing');
      case 'speaking':
        return t('status.speaking');
      case 'error':
        return t('status.error');
      default:
        return t('status.idle');
    }
  })();

  /* ─── 음성 버튼 비주얼 ─── */
  // outer drop shadow / outer ring / scale을 모두 제거.
  // 이전 구조는 listening 시 button이 메뉴바 inner 영역을 벗어나며
  // 메뉴바의 hairline과 겹쳐 하단에 회색 잔상 선이 보였음.
  // listening 강조는 background gradient + inset white highlight로만 처리.
  const voiceBtnStyle: React.CSSProperties = {
    width: 52,
    height: 26,
    borderRadius: 999,
    display: 'grid',
    placeItems: 'center',
    background: isVoiceListening
      ? 'linear-gradient(135deg, var(--glow) 0%, var(--accent) 100%)'
      : 'var(--accent)',
    color: 'white',
    boxShadow: isVoiceListening
      ? 'inset 0 0 0 1.5px rgba(255, 255, 255, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
      : 'inset 0 1px 0 rgba(255, 255, 255, 0.3)',
    transition: 'background 240ms var(--ease), box-shadow 240ms var(--ease)',
    position: 'relative',
  };

  return (
    <div
      className="fixed flex flex-col items-end gap-3 z-50"
      style={{
        right: 'max(env(safe-area-inset-right), 24px)',
        bottom: 'max(env(safe-area-inset-bottom), 24px)',
      }}
      data-interactive="true"
    >
      {/* ─── Toasts / dependency banners ─── */}
      {dependencyIssues.length > 0 && (
        <div
          className="glass px-3 py-2 text-xs max-w-xs"
          style={{ color: 'var(--ink)', borderRadius: 'var(--r)' }}
          data-interactive="true"
        >
          <div>{t('dependency.requiredCheck', { count: dependencyIssues.length })}</div>
          <button
            type="button"
            onClick={() => setShowDependencyGuide(true)}
            className="mt-2 w-full px-2 py-1 rounded-md text-white text-xs"
            style={{ background: 'var(--accent)' }}
          >
            {t('dependency.showGuide')}
          </button>
        </div>
      )}

      {globalShortcutToast && (
        <div
          className="glass px-3 py-2 text-xs max-w-xs"
          style={{ color: 'var(--ink)', borderRadius: 'var(--r)' }}
          data-interactive="true"
        >
          <div>{t('settings.voice.globalShortcut.registerErrorToast')}</div>
          <div className="mt-1 text-[11px] break-words" style={{ color: 'var(--ink-2)' }}>
            {globalShortcutToast}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleOpenAccessibilitySettings()}
              className="px-2 py-1 rounded text-white text-[11px]"
              style={{ background: 'var(--accent)' }}
            >
              {t('settings.voice.globalShortcut.openAccessibility')}
            </button>
            <button
              type="button"
              onClick={() => setGlobalShortcutToast(null)}
              className="px-2 py-1 rounded text-[11px]"
              style={{ background: 'oklch(1 0 0 / 0.6)', color: 'var(--ink)' }}
            >
              {t('settings.cancel')}
            </button>
          </div>
        </div>
      )}

      {voiceError && (
        <div
          className="glass px-3 py-2 text-xs max-w-xs"
          style={{ color: 'var(--danger)', borderRadius: 'var(--r)' }}
          data-interactive="true"
        >
          <div>{voiceError}</div>
          {needsMicrophonePermission && (
            <button
              onClick={openMicrophoneSettings}
              data-interactive="true"
              className="mt-2 w-full px-2 py-1 rounded text-white text-xs font-medium"
              style={{ background: 'var(--danger)' }}
            >
              {t('dependency.openSystemSettings')}
            </button>
          )}
        </div>
      )}

      {!voiceError && hasTriedChat && ttsUnavailableReason && (
        <div
          className="glass px-3 py-2 text-xs max-w-xs"
          style={{ color: 'var(--warn)', borderRadius: 'var(--r)' }}
          data-interactive="true"
        >
          <div>{ttsUnavailableReason}</div>
        </div>
      )}

      {/* ─── VoiceWaveform: listening 시 cluster 상단 슬롯에 단독 노출
              폭은 메뉴바와 동기화 (ResizeObserver) ─── */}
      {isVoiceListening && (
        <div style={{ marginBottom: -4 }}>
          <VoiceWaveform
            label={t('status.voiceListeningOverlay')}
            width={menuBarWidth}
          />
        </div>
      )}

      {/* ─── 아바타 숨김 안내: 메뉴바 위 슬롯 (이전: 화면 중앙) ─── */}
      {avatarHidden && (
        <div style={{ marginBottom: -4 }}>
          <AvatarRestingBadge />
        </div>
      )}

      {/* ─── Text input row (showTextInput 시) ─── */}
      {showTextInput && (
        <TextInputRow
          value={textInput}
          onChange={setTextInput}
          onSubmit={handleTextSubmit}
          onClose={() => {
            setShowTextInput(false);
            setTextInput('');
          }}
          submitDisabled={
            !textInput.trim() ||
            (status === 'processing' &&
              settings.llm.provider !== CLAUDE_CODE_PROVIDER &&
              settings.llm.provider !== 'codex')
          }
        />
      )}

      {/* ─── Button cluster row: 메뉴바 왼쪽에 StatusPill 상시 표시
              (listening 시에는 transcript / '듣는 중' 라벨로 자동 전환) ─── */}
      <div className="flex items-center gap-2">
        <StatusPill kind={pillKind} label={pillLabel} />
        <div
          ref={menuBarRef}
          className="glass-strong flex items-center"
          style={{ padding: 6, gap: 4, borderRadius: 999 }}
          data-interactive="true"
        >
          <ClusterBtn
            onClick={handleSparklesClick}
            title={t('overlay.quickActions')}
            active={quickActionsOpen}
          >
            <Sparkles size={17} />
          </ClusterBtn>
          <ClusterBtn
            onClick={toggleHistory}
            title={t('history.button')}
            active={isHistoryOpen}
          >
            <History size={17} />
          </ClusterBtn>
          <ClusterBtn
            onClick={() => setShowTextInput((v) => !v)}
            title={showTextInput ? t('overlay.closeKeyboard') : t('overlay.toggleKeyboard')}
            active={showTextInput}
          >
            <Keyboard size={17} />
          </ClusterBtn>
          <ClusterBtn
            onClick={toggleAvatarHidden}
            title={avatarHidden ? t('overlay.showAvatar') : t('overlay.hideAvatar')}
            active={avatarHidden}
          >
            {avatarHidden ? <EyeOff size={17} /> : <Eye size={17} />}
          </ClusterBtn>
          <Divider />

          {/* Voice button (primary) — listening 시 ListeningBars로 amplitude 표시,
              전체 waveform pill은 cluster 상단 슬롯에서 별도 렌더(StatusPill 자리). */}
          <div className="relative" data-interactive="true">
            <button
              type="button"
              onClick={handleVoiceToggle}
              title={
                isVoiceListening
                  ? t('chat.stopListening')
                  : voiceInputUnavailableReason || t('chat.startVoiceInput')
              }
              style={voiceBtnStyle}
              data-interactive="true"
            >
              {isVoiceListening ? <ListeningBars /> : <Mic size={20} />}
            </button>
          </div>

          <Divider />
          {/* 후원 버튼 — 클릭 시 Buy Me a Coffee / Toonation 링크 팝오버. */}
          <div
            className="relative"
            ref={sponsorWrapRef}
            data-interactive="true"
          >
            <ClusterBtn
              onClick={() => setSponsorOpen((v) => !v)}
              title={t('overlay.sponsor')}
              active={sponsorOpen}
            >
              {/* 후원 버튼은 카테고리 인식을 위해 진한 핑크 stroke 고정(outline 톤).
                  active/비활성 모두 동일 색으로 유지해 "후원"이라는 의미를 강조. */}
              <Heart size={17} style={{ color: '#DB2777' }} />
            </ClusterBtn>
            {sponsorOpen && (
              <div
                className="glass-strong absolute flex flex-col"
                style={{
                  bottom: 'calc(100% + 8px)',
                  right: 0,
                  padding: 6,
                  gap: 2,
                  borderRadius: 14,
                  minWidth: 220,
                  zIndex: 30,
                }}
                data-interactive="true"
              >
                <SponsorLinkRow
                  href="https://buymeacoffee.com/eunyeon"
                  label="Buy Me a Coffee"
                  icon={<Coffee size={14} />}
                  onOpen={() => setSponsorOpen(false)}
                />
                <SponsorLinkRow
                  href="https://toon.at/donate/heavyarm"
                  label="Toonation"
                  icon={<Heart size={14} />}
                  onOpen={() => setSponsorOpen(false)}
                />
              </div>
            )}
          </div>
          <ClusterBtn onClick={openSettings} title={t('settings.title')}>
            <SettingsIcon size={17} />
          </ClusterBtn>
        </div>
      </div>

      {/* ─── Quick Actions Palette (✨) ─── */}
      <QuickActionsPalette
        open={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
      />

      {/* ─── Dependency guide modal ─── */}
      {showDependencyGuide && (
        <DependencyGuideModal
          issues={dependencyIssues}
          onClose={() => setShowDependencyGuide(false)}
          onOpenSettings={openSettings}
        />
      )}
    </div>
  );
}

/* ────────────────────── 후원 링크 행(팝오버 내부) ────────────────────── */

/**
 * SponsorLinkRow — 후원 팝오버의 링크 한 줄. 외부 URL은 `target="_blank"` +
 * `rel="noopener noreferrer"` 조합의 순수 앵커로 연다. 기존 LicensesSettings
 * /MCPSettings의 외부 링크와 동일 패턴(OS 기본 브라우저 오픈).
 */
function SponsorLinkRow({
  href,
  label,
  icon,
  onOpen,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  onOpen: () => void;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onOpen}
      className="flex items-center transition-colors focus-ring hover:bg-[oklch(1_0_0_/_0.25)]"
      style={{
        padding: '8px 10px',
        borderRadius: 10,
        gap: 10,
        color: 'var(--ink-2)',
        textDecoration: 'none',
      }}
      data-interactive="true"
    >
      <span
        className="grid place-items-center shrink-0"
        style={{ color: 'var(--ink-3)' }}
      >
        {icon}
      </span>
      <span className="flex-1 truncate" style={{ fontSize: 13, fontWeight: 500 }}>
        {label}
      </span>
      <ExternalLink size={12} style={{ color: 'var(--ink-3)' }} />
    </a>
  );
}
