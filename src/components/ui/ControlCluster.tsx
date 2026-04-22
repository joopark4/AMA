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
  Eye,
  EyeOff,
  History,
  Keyboard,
  Mic,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  X,
} from 'lucide-react';
import { useConversationStore } from '../../stores/conversationStore';
import { useSettingsStore, type LLMProvider } from '../../stores/settingsStore';
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
import { audioProcessor } from '../../services/voice/audioProcessor';
import VoiceWaveform from './VoiceWaveform';

interface DependencyIssue {
  id: string;
  title: string;
  summary: string;
  steps: string[];
}

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  ollama: 'Ollama',
  localai: 'LocalAI',
  claude: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
  claude_code: 'Claude Code',
  codex: 'Codex',
};

const CLOUD_DEFAULT_MODELS: Record<'claude' | 'openai' | 'gemini', string> = {
  claude: 'claude-sonnet-4-5',
  openai: 'gpt-5.1',
  gemini: 'gemini-2.5-flash',
};

function buildModelUnsetIssue(provider: LLMProvider): DependencyIssue {
  if (provider === 'ollama') {
    return {
      id: 'llm-model-unset',
      title: 'LLM 모델 설정 (Ollama)',
      summary: 'Ollama 모델이 선택되지 않았습니다.',
      steps: [
        '옵션(설정)에서 LLM Provider를 Ollama로 선택합니다.',
        '터미널에서 `ollama list`를 실행해 설치된 모델을 확인합니다.',
        '모델이 없으면 `ollama pull deepseek-v3` 후 Model 항목에서 해당 모델을 선택합니다.',
      ],
    };
  }
  if (provider === 'localai') {
    return {
      id: 'llm-model-unset',
      title: 'LLM 모델 설정 (LocalAI)',
      summary: 'LocalAI 모델이 선택되지 않았습니다.',
      steps: [
        '옵션(설정)에서 LLM Provider를 LocalAI로 선택합니다.',
        'LocalAI `/v1/models` 응답에 노출된 모델 id를 확인합니다.',
        'Model 항목에 해당 id와 동일한 모델명을 선택/입력합니다.',
      ],
    };
  }
  const defaultModel = CLOUD_DEFAULT_MODELS[provider as 'claude' | 'openai' | 'gemini'];
  return {
    id: 'llm-model-unset',
    title: `LLM 모델 설정 (${PROVIDER_LABELS[provider]})`,
    summary: `${PROVIDER_LABELS[provider]} 모델이 선택되지 않았습니다.`,
    steps: [
      `옵션(설정)에서 LLM Provider를 ${PROVIDER_LABELS[provider]}로 선택합니다.`,
      `Model 항목에서 사용 모델을 선택합니다. 예: \`${defaultModel}\``,
      '설정 저장 후 다시 질문을 입력해 응답을 확인합니다.',
    ],
  };
}

function buildEndpointUnsetIssue(provider: 'ollama' | 'localai'): DependencyIssue {
  if (provider === 'ollama') {
    return {
      id: 'llm-endpoint-unset',
      title: 'LLM 엔드포인트 설정 (Ollama)',
      summary: 'Ollama 서버 주소가 비어 있습니다.',
      steps: [
        '옵션(설정)에서 LLM Provider를 Ollama로 유지합니다.',
        'Endpoint에 `http://localhost:11434`를 입력합니다.',
        '`ollama serve` 실행 후 다시 질문을 입력합니다.',
      ],
    };
  }
  return {
    id: 'llm-endpoint-unset',
    title: 'LLM 엔드포인트 설정 (LocalAI)',
    summary: 'LocalAI 서버 주소가 비어 있습니다.',
    steps: [
      '옵션(설정)에서 LLM Provider를 LocalAI로 유지합니다.',
      'Endpoint에 LocalAI OpenAI 호환 주소를 입력합니다. 예: `http://localhost:8080`',
      'LocalAI 서버 실행 후 다시 질문을 입력합니다.',
    ],
  };
}

function buildCloudApiKeyIssue(provider: 'claude' | 'openai' | 'gemini'): DependencyIssue {
  const apiKeyGuide =
    provider === 'claude'
      ? 'console.anthropic.com'
      : provider === 'openai'
        ? 'platform.openai.com'
        : 'aistudio.google.com';
  const keyPrefix =
    provider === 'openai' ? '`sk-...`' : provider === 'claude' ? '`sk-ant-...`' : '발급된 API 키';
  return {
    id: 'llm-api-key',
    title: `LLM API 키 설정 (${PROVIDER_LABELS[provider]})`,
    summary: `${PROVIDER_LABELS[provider]} API 키가 설정되지 않아 답변을 생성할 수 없습니다.`,
    steps: [
      `옵션(설정)에서 LLM Provider를 ${PROVIDER_LABELS[provider]}로 선택합니다.`,
      `${apiKeyGuide}에서 API 키를 발급받습니다.`,
      `API Key 입력란에 ${keyPrefix} 형식의 키를 입력하고 저장합니다.`,
    ],
  };
}

function buildLocalServerIssue(
  provider: 'ollama' | 'localai',
  endpoint: string,
  model: string
): DependencyIssue {
  if (provider === 'ollama') {
    return {
      id: 'llm-ollama-server',
      title: 'LLM 서버 연결 실패 (Ollama)',
      summary: 'Ollama 서버에 연결할 수 없습니다.',
      steps: [
        'macOS에서 `brew install ollama`로 설치합니다.',
        '터미널에서 `ollama serve`를 실행합니다.',
        `필요 모델을 \`ollama pull ${model || 'deepseek-v3'}\`로 내려받습니다.`,
        `Endpoint가 올바른지 확인합니다. 현재 값: ${endpoint || 'http://localhost:11434'}`,
      ],
    };
  }
  return {
    id: 'llm-localai-server',
    title: 'LLM 서버 연결 실패 (LocalAI)',
    summary: 'LocalAI 서버에 연결할 수 없습니다.',
    steps: [
      'LocalAI 서버를 실행하고 OpenAI 호환 API가 활성화되어 있는지 확인합니다.',
      '헬스체크로 `GET /v1/models` 응답이 오는지 확인합니다.',
      `Endpoint를 LocalAI 주소로 맞춥니다. 현재 값: ${endpoint || 'http://localhost:8080'}`,
      '모델 로드 로그를 확인한 뒤 다시 질문을 입력합니다.',
    ],
  };
}

function buildLocalModelIssue(provider: 'ollama' | 'localai', model: string): DependencyIssue {
  if (provider === 'ollama') {
    return {
      id: 'llm-ollama-model',
      title: 'LLM 모델 누락 (Ollama)',
      summary: `선택된 모델(${model || '미설정'})이 Ollama에 준비되어 있지 않습니다.`,
      steps: [
        `터미널에서 \`ollama pull ${model || 'deepseek-v3'}\`를 실행합니다.`,
        '`ollama list`로 모델이 내려받아졌는지 확인합니다.',
        '앱 설정에서 동일한 모델명을 선택한 뒤 다시 질문합니다.',
      ],
    };
  }
  return {
    id: 'llm-localai-model',
    title: 'LLM 모델 누락 (LocalAI)',
    summary: `선택된 모델(${model || '미설정'})이 LocalAI에 준비되어 있지 않습니다.`,
    steps: [
      'LocalAI 모델 디렉터리에 원하는 모델 파일을 배치합니다.',
      'LocalAI 설정 파일/실행 옵션에서 모델을 로드합니다.',
      '앱 설정의 Model 값을 LocalAI의 모델 id와 동일하게 맞춥니다.',
    ],
  };
}

/* ─────────────────────── 보조 컴포넌트 (v2 리디자인) ─────────────────────── */

type StatusKind = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

function StatusPill({ kind, label }: { kind: StatusKind; label: string }) {
  const meta: Record<StatusKind, { dot: string; text: string; animate: boolean }> = {
    idle: { dot: 'oklch(0.7 0.01 50)', text: 'var(--ink-3)', animate: false },
    listening: { dot: 'var(--glow)', text: 'var(--glow)', animate: true },
    processing: { dot: 'var(--accent)', text: 'var(--accent)', animate: true },
    speaking: { dot: 'var(--ok)', text: 'var(--ok)', animate: true },
    error: { dot: 'var(--danger)', text: 'var(--danger)', animate: true },
  };
  const m = meta[kind];
  return (
    <div
      className="glass inline-flex items-center gap-2 px-3 py-1.5"
      style={{
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 500,
        color: m.text,
        letterSpacing: '-0.01em',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 99,
          background: m.dot,
          boxShadow: `0 0 12px ${m.dot}`,
          animation: m.animate ? 'auraBreath 1.6s ease-in-out infinite' : 'none',
        }}
      />
      {label}
    </div>
  );
}

/**
 * ListeningBars — Voice 버튼 내 7개 막대.
 * audioProcessor에서 실시간 amplitude를 읽어 각 막대의 scaleY를 동기화.
 * 마운트는 voice button이 listening일 때만 (외부에서 조건부 렌더).
 */
function ListeningBars() {
  const containerRef = useRef<HTMLDivElement>(null);
  const BAR_COUNT = 7;
  const SAMPLES_PER_BAR = 4;
  const SMOOTH = 0.4;
  const FRAME_INTERVAL_MS = 1000 / 30;
  const SENSITIVITY = 3.5;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const bars = Array.from(container.children) as HTMLElement[];
    let rafId: number | null = null;
    let lastFrame = 0;
    const smoothed = new Float32Array(BAR_COUNT);

    const tick = (ts: number) => {
      rafId = requestAnimationFrame(tick);
      if (ts - lastFrame < FRAME_INTERVAL_MS) return;
      lastFrame = ts;

      const data = audioProcessor.getWaveformData(BAR_COUNT * SAMPLES_PER_BAR);
      for (let i = 0; i < BAR_COUNT; i++) {
        let peak = 0;
        for (let j = 0; j < SAMPLES_PER_BAR; j++) {
          const v = Math.abs(data[i * SAMPLES_PER_BAR + j] || 0);
          if (v > peak) peak = v;
        }
        smoothed[i] = smoothed[i] * (1 - SMOOTH) + peak * SMOOTH;
        const scaled = Math.max(0.2, Math.min(1, smoothed[i] * SENSITIVITY));
        bars[i].style.transform = `scaleY(${scaled})`;
      }
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      // 컴포넌트 언마운트 시 막대 초기화
      bars.forEach((b) => (b.style.transform = 'scaleY(0.4)'));
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center gap-[3px]"
      style={{ height: 22 }}
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: 18,
            borderRadius: 2,
            background: 'white',
            transformOrigin: 'center',
            transform: 'scaleY(0.4)',
            transition: 'transform 60ms linear',
          }}
        />
      ))}
    </div>
  );
}

function ClusterBtn({
  children,
  onClick,
  title,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      data-interactive="true"
      className={[
        'grid place-items-center transition-all',
        'w-10 h-5 rounded-pill',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[oklch(0.92_0.02_60_/_0.7)]',
      ].join(' ')}
      style={{
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent-ink)' : 'var(--ink-2)',
        transitionDuration: '160ms',
        transitionTimingFunction: 'var(--ease)',
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 24,
        background: 'var(--hairline-strong)',
        margin: '0 4px',
      }}
    />
  );
}

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

  // 메뉴바 실제 폭을 추적해 VoiceWaveform pill 폭을 동기화 (ResizeObserver).
  const menuBarRef = useRef<HTMLDivElement>(null);
  const [menuBarWidth, setMenuBarWidth] = useState<number>(320);
  useEffect(() => {
    const el = menuBarRef.current;
    if (!el) return;
    setMenuBarWidth(el.offsetWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && Math.abs(w - menuBarWidth) > 0.5) setMenuBarWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        if (!cancelled) setLlmDependencyIssue(buildModelUnsetIssue(provider));
        return;
      }
      if ((provider === 'ollama' || provider === 'localai') && !endpoint.trim()) {
        if (!cancelled) setLlmDependencyIssue(buildEndpointUnsetIssue(provider));
        return;
      }
      if (provider === 'openai' || provider === 'claude' || provider === 'gemini') {
        if (!apiKey.trim()) {
          if (!cancelled) setLlmDependencyIssue(buildCloudApiKeyIssue(provider));
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
          setLlmDependencyIssue(buildLocalServerIssue(provider, endpoint, model));
        }
        return;
      }
      if (provider === 'ollama') {
        const models = await ollamaClient.getAvailableModels();
        if (!cancelled) {
          if (!model || !models.includes(model)) {
            setLlmDependencyIssue(buildLocalModelIssue(provider, model));
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
            setLlmDependencyIssue(buildLocalModelIssue(provider, model));
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
        title: '음성 인식 (Whisper)',
        summary: voiceInputUnavailableReason,
        steps: isVoiceInputRuntimeBlocked
          ? [
              '원격 연결 세션을 종료한 뒤 앱을 다시 실행합니다.',
              '로컬 환경에서 마이크 권한을 허용하고 다시 시도합니다.',
            ]
          : [
              'macOS에서 `brew install whisper-cpp`로 whisper-cli를 설치합니다.',
              '`ggml-base.bin` 파일을 `models/whisper/` 경로에 배치합니다.',
              '필요 시 `WHISPER_MODEL_PATH` 환경 변수로 모델 경로를 지정합니다.',
            ],
      });
    }
    if (hasTriedChat && ttsUnavailableReason) {
      issues.push({
        id: 'tts-supertonic',
        title: '음성 합성 (Supertonic)',
        summary: ttsUnavailableReason,
        steps: [
          '`models/supertonic/onnx` 폴더에 ONNX 모델 파일을 배치합니다.',
          '`models/supertonic/voice_styles` 폴더에 보이스 스타일 JSON 파일을 배치합니다.',
          '앱을 완전히 종료한 뒤 다시 실행합니다.',
        ],
      });
    }
    if ((hasTriedChat || isImmediateLlmConfigIssue) && llmDependencyIssue) {
      issues.push(llmDependencyIssue);
    }
    return issues;
  }, [
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

      {/* ─── Text input row (showTextInput 시) ─── */}
      {showTextInput && (
        <form
          onSubmit={handleTextSubmit}
          className="flex items-center gap-2"
          style={{
            padding: 3,
            paddingLeft: 14,
            borderRadius: 999,
            width: 440,
            // glass-strong 효과를 인라인으로 적용하되, 외곽 shadow 제거 (겹쳐 보이는 잔상 방지).
            background: 'var(--surface-2)',
            backdropFilter: 'blur(40px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
            boxShadow: 'inset 0 1px 0 var(--top-edge), inset 0 0 0 1px var(--hairline)',
            animation: 'inputSlide 240ms var(--ease)',
          }}
          data-interactive="true"
        >
          <Keyboard size={14} style={{ color: 'var(--ink-3)' }} />
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={t('chat.placeholder')}
            className="flex-1 bg-transparent border-0 outline-none"
            style={{
              padding: '4px 4px',
              fontSize: 13,
              letterSpacing: '-0.01em',
              color: 'var(--ink)',
            }}
            autoFocus
            data-interactive="true"
          />
          <button
            type="button"
            onClick={() => {
              setShowTextInput(false);
              setTextInput('');
            }}
            title={t('overlay.closeKeyboard')}
            className="grid place-items-center transition-all"
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              background: 'transparent',
              color: 'var(--ink-3)',
              transitionDuration: '160ms',
              transitionTimingFunction: 'var(--ease)',
            }}
            data-interactive="true"
          >
            <X size={12} />
          </button>
          <button
            type="submit"
            disabled={
              !textInput.trim() ||
              (status === 'processing' &&
                settings.llm.provider !== CLAUDE_CODE_PROVIDER &&
                settings.llm.provider !== 'codex')
            }
            className="grid place-items-center transition-all"
            style={{
              width: 24,
              height: 18,
              borderRadius: 999,
              background: textInput.trim() ? 'var(--accent)' : 'oklch(0.88 0.01 60)',
              color: textInput.trim() ? 'white' : 'var(--ink-3)',
              transitionDuration: '200ms',
              transitionTimingFunction: 'var(--ease)',
            }}
            data-interactive="true"
          >
            <Send size={12} />
          </button>
        </form>
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
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: 'oklch(0.2 0 0 / 0.6)' }}
          data-interactive="true"
        >
          <div
            className="glass-strong w-full max-w-2xl max-h-[80vh] overflow-y-auto p-5 scroll"
            style={{ borderRadius: 'var(--r-lg)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
                {t('dependency.guideTitle')}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openSettings}
                  className="px-3 py-1 text-xs rounded-md text-white"
                  style={{ background: 'var(--accent)' }}
                >
                  {t('dependency.openSettings')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDependencyGuide(false)}
                  className="px-3 py-1 text-xs rounded-md"
                  style={{ background: 'oklch(1 0 0 / 0.6)', color: 'var(--ink)' }}
                >
                  {t('dependency.close')}
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {dependencyIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="p-3"
                  style={{
                    border: '1px solid var(--hairline)',
                    borderRadius: 'var(--r-sm)',
                    background: 'oklch(1 0 0 / 0.4)',
                  }}
                >
                  <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    {issue.title}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: 'var(--ink-2)' }}>
                    {issue.summary}
                  </div>
                  <ol
                    className="mt-2 list-decimal list-inside space-y-1 text-xs"
                    style={{ color: 'var(--ink-2)' }}
                  >
                    {issue.steps.map((step, index) => (
                      <li key={`${issue.id}-${index}`}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
