import { useState, useCallback, useRef, useEffect } from 'react';
import { useConversationStore } from '../stores/conversationStore';
import { useAvatarStore, type Emotion, type GestureType } from '../stores/avatarStore';
import { useSettingsStore, type Language } from '../stores/settingsStore';
import { useModelDownloadStore } from '../stores/modelDownloadStore';
import { llmRouter } from '../services/ai/llmRouter';
import { screenAnalyzer } from '../services/ai/screenAnalyzer';
import { useSpeechSynthesis } from './useSpeechSynthesis';
import { parseVoiceCommand, type VoiceCommandType } from '../services/voice/voiceCommandParser';
import { audioProcessor } from '../services/voice/audioProcessor';
import { ttsRouter } from '../services/voice/ttsRouter';
import { permissions } from '../services/tauri/permissions';
import type { Message as LLMMessage } from '../services/ai/types';
import { invoke } from '@tauri-apps/api/core';
import { emotionTuningGlobal, getEmotionTuning } from '../config/emotionTuning';
import { selectMotionClip } from '../services/avatar/motionSelector';
import { useClaudeCodeChat } from '../features/channels';
import { buildCharacterPrompt, analyzeEmotion } from '../services/character';
import { ttsQueue } from '../services/voice/ttsQueue';
import { buildMessageWindow, summarizeIfNeeded } from '../services/ai/memoryManager';

// Helper function to log to terminal
const log = (...args: any[]) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  console.log('[useConversation]', ...args);
  invoke('log_to_terminal', { message: `[useConversation] ${message}` }).catch(() => {});
};

/**
 * 시스템 프롬프트 빌드 — 캐릭터 프로필 기반
 *
 * @deprecated 레거시 시그니처, sendMessage 내에서 직접 character 프로필 사용 권장
 */
export function buildSystemPrompt(avatarName: string, personalityPrompt: string): string {
  // 레거시 호환: 캐릭터 프로필이 설정되어 있으면 그것을 사용
  const character = useSettingsStore.getState().settings.character;
  if (character && (character.name || character.personality.traits.length > 0)) {
    return buildCharacterPrompt(character);
  }

  // 폴백: 프로필이 없으면 기존 방식 유지
  const normalizedName = avatarName.trim() || '아바타';
  const basePrompt = `당신은 "${normalizedName}"이라는 이름의 친근하고 귀여운 AI 어시스턴트입니다.
성격: 밝고 긍정적이며, 사용자를 친구처럼 대합니다.
말투: 반말을 사용하고, 짧고 자연스러운 대화체로 말합니다.
특징:
- 이모티콘은 사용하지 않습니다
- 답변은 2-3문장 정도로 짧게 합니다
- 공감과 감정 표현을 잘합니다
- 한국어로 대화합니다`;

  const normalizedPersonalityPrompt = personalityPrompt.trim();
  if (!normalizedPersonalityPrompt) {
    return basePrompt;
  }

  return `${basePrompt}

추가 성격 가이드(사용자 지정):
${normalizedPersonalityPrompt}

위 사용자 지정 가이드를 기본 성격과 함께 우선 반영하세요.`;
}

function isTauriDesktopRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__);
}

function getRuntimeVoiceInputBlockReason(
  isRemoteSession: boolean
): string | null {
  if (isRemoteSession) {
    return '현재 원격 연결 상태에서는 음성 인식을 사용할 수 없습니다. 텍스트 입력을 사용해 주세요.';
  }

  return null;
}

interface WhisperAvailabilityStatus {
  cliFound: boolean;
  modelFound: boolean;
  cliPath?: string;
  modelPath?: string;
}

function getWhisperInstallGuide(
  status: WhisperAvailabilityStatus | null,
  language: Language,
  model: string
): string {
  const normalizedModel = model?.trim() || 'base';
  const modelFileName = normalizedModel.endsWith('.bin')
    ? normalizedModel
    : `ggml-${normalizedModel}.bin`;
  if (!status) {
    if (language === 'ja') return 'Whisperエンジンの状態確認に失敗しました。アプリを再起動してもう一度お試しください。';
    if (language === 'en') return 'Failed to verify Whisper runtime status. Restart the app and try again.';
    return 'Whisper 엔진 상태 확인에 실패했습니다. 앱을 다시 실행한 뒤 다시 시도해 주세요.';
  }

  const missingCli = !status || !status.cliFound;
  const missingModel = !status || !status.modelFound;

  const cliGuideMap: Record<Language, string> = {
    ko: '내장 Whisper 런타임을 찾지 못했습니다. 최신 배포본으로 재설치 후 다시 실행해 주세요. (개발 환경에서는 `brew install whisper-cpp`로 대체 가능)',
    en: 'Bundled Whisper runtime is missing. Reinstall the latest app build and restart. (For dev setup, install with `brew install whisper-cpp`.)',
    ja: '内蔵Whisperランタイムが見つかりません。最新ビルドを再インストールして再起動してください。(開発環境では`brew install whisper-cpp`で代替可能)',
  };
  const cliGuide = cliGuideMap[language];

  const modelGuideMap: Record<Language, string> = {
    ko: `모델 파일 미설치: \`${modelFileName}\`을 \`models/whisper/\`에 배치하거나 \`WHISPER_MODEL_PATH\`를 설정하세요.`,
    en: `Model is missing: place \`${modelFileName}\` under \`models/whisper/\` or set \`WHISPER_MODEL_PATH\`.`,
    ja: `モデルファイル未インストール: \`${modelFileName}\`を\`models/whisper/\`に配置するか\`WHISPER_MODEL_PATH\`を設定してください。`,
  };
  const modelGuide = modelGuideMap[language];

  if (missingCli && missingModel) {
    return `${cliGuide} ${modelGuide}`;
  }

  if (missingCli) return cliGuide;
  if (missingModel) return modelGuide;

  const fallbackMap: Record<Language, string> = {
    ko: 'Whisper 로컬 음성 인식 엔진을 확인하지 못했습니다.',
    en: 'Unable to verify local Whisper dependencies.',
    ja: 'Whisperローカル音声認識エンジンを確認できませんでした。',
  };
  return fallbackMap[language];
}

function getVoiceInputUnavailableReason(
  hasLocalWhisper: boolean,
  hasCheckedLocalWhisper: boolean,
  whisperStatus: WhisperAvailabilityStatus | null,
  language: Language,
  model: string
): string | null {
  if (hasLocalWhisper) return null;

  if (isTauriDesktopRuntime() && !hasCheckedLocalWhisper) {
    if (language === 'ja') return 'ローカル音声認識エンジンを確認中です。しばらくお待ちください。';
    if (language === 'en') return 'Checking local speech recognition dependencies...';
    return '로컬 음성 인식 엔진 확인 중입니다. 잠시만 기다려 주세요.';
  }

  return getWhisperInstallGuide(whisperStatus, language, model);
}

function isScreenRequest(text: string): boolean {
  return /(화면|스크린|screen)/i.test(text);
}

// analyzeEmotion은 src/services/character/analyzeEmotion.ts에서 import

function pickGesture(emotion: Emotion, text: string): GestureType {
  const normalized = text.toLowerCase();
  if (/(안녕|hello|hi|bye|잘가)/i.test(normalized)) return 'wave';
  if (emotion === 'happy') return 'celebrate';
  if (emotion === 'surprised') return 'nod';
  if (emotion === 'sad') return 'thinking';
  if (emotion === 'angry') return 'shake';
  if (emotion === 'thinking') return 'thinking';
  if (emotion === 'relaxed') return 'nod';
  return null;
}

interface LocalTranscriptionResult {
  text: string;
  confidence: number;
  language: string;
}

interface RemoteEnvironmentResult {
  isRemote: boolean;
  detector?: string;
  reason?: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function getVoiceCommandResponse(command: VoiceCommandType, language: Language): string {
  if (language === 'en') {
    const english: Record<VoiceCommandType, string> = {
      'open-settings': 'Opened settings.',
      'close-settings': 'Closed settings.',
      'open-microphone-settings': 'Opened microphone settings.',
      'clear-messages': 'Cleared conversation history.',
      'stop-speaking': 'Stopped voice output.',
      'set-language-ko': 'Switched language to Korean.',
      'set-language-en': 'Switched language to English.',
      'show-help': 'Voice commands: open/close settings, open microphone settings, clear chat, stop speaking, switch language.',
    };
    return english[command];
  }

  if (language === 'ja') {
    const japanese: Record<VoiceCommandType, string> = {
      'open-settings': '設定を開いたよ。',
      'close-settings': '設定を閉じたよ。',
      'open-microphone-settings': 'マイク設定を開いたよ。',
      'clear-messages': '会話履歴を消したよ。',
      'stop-speaking': '音声出力を止めたよ。',
      'set-language-ko': '言語を韓国語に変えたよ。',
      'set-language-en': '言語を英語に変えたよ。',
      'show-help': '使える音声コマンドは、設定の開閉、マイク設定、会話履歴消去、音声停止、言語切替だよ。',
    };
    return japanese[command];
  }

  const korean: Record<VoiceCommandType, string> = {
    'open-settings': '설정 창을 열었어.',
    'close-settings': '설정 창을 닫았어.',
    'open-microphone-settings': '마이크 설정을 열었어.',
    'clear-messages': '대화 기록을 지웠어.',
    'stop-speaking': '음성 출력을 멈췄어.',
    'set-language-ko': '언어를 한국어로 바꿨어.',
    'set-language-en': '언어를 영어로 바꿨어.',
    'show-help': '사용 가능한 음성 명령은 설정 열기/닫기, 마이크 설정 열기, 대화 기록 지우기, 말 멈추기, 언어 전환이야.',
  };
  return korean[command];
}

interface UseConversationReturn {
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  transcript: string;
  error: string | null;
  needsMicrophonePermission: boolean;
  isVoiceInputSupported: boolean;
  isVoiceInputRuntimeBlocked: boolean;
  voiceInputUnavailableReason: string | null;
  ttsUnavailableReason: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  sendMessage: (text: string) => Promise<void>;
  openMicrophoneSettings: () => Promise<void>;
}

export function useConversation(): UseConversationReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needsMicrophonePermission, setNeedsMicrophonePermission] = useState(false);
  const [isLocalWhisperAvailable, setIsLocalWhisperAvailable] = useState(false);
  const [hasCheckedLocalWhisper, setHasCheckedLocalWhisper] = useState(false);
  const [whisperStatus, setWhisperStatus] = useState<WhisperAvailabilityStatus | null>(null);
  const [isSupertonicAvailable, setIsSupertonicAvailable] = useState(true);
  const [isRemoteSession, setIsRemoteSession] = useState(false);

  const isProcessingRef = useRef(false);
  const localRecordingRef = useRef(false);
  const { settings, openSettings, closeSettings, setLanguage } = useSettingsStore();
  const modelStatus = useModelDownloadStore((s) => s.status);

  const {
    addMessage,
    setCurrentResponse,
    setStreamingResponse,
    appendStreamingToken,
    setMemory,
    setStatus,
    clearCurrentResponse,
    clearMessages,
    isProcessing,
    isSpeaking,
  } = useConversationStore();

  const {
    setEmotion,
    triggerGesture,
    triggerMotionClip,
    registerMotionSelection,
    startDancing,
    stopDancing,
  } = useAvatarStore();
  const { speak, stop: stopSpeaking } = useSpeechSynthesis();
  const { sendToClaudeCode, isClaudeCodeProvider } = useClaudeCodeChat();
  const runtimeVoiceInputBlockReason = getRuntimeVoiceInputBlockReason(
    isRemoteSession
  );
  const hasLocalWhisper =
    runtimeVoiceInputBlockReason === null && isLocalWhisperAvailable;
  const isVoiceInputSupported = hasLocalWhisper;
  const isVoiceInputRuntimeBlocked = Boolean(runtimeVoiceInputBlockReason);
  const voiceInputUnavailableReason =
    runtimeVoiceInputBlockReason ||
    getVoiceInputUnavailableReason(
      hasLocalWhisper,
      hasCheckedLocalWhisper,
      whisperStatus,
      settings.language,
      settings.stt.model
    );
  const ttsUnavailableReason = isSupertonicAvailable
    ? null
    : settings.language === 'ja'
      ? 'Supertonicモデルファイルが見つかりません。`models/supertonic/onnx`と`models/supertonic/voice_styles`を準備してアプリを再起動してください。'
      : settings.language === 'ko'
        ? 'Supertonic 모델 파일을 찾을 수 없습니다. `models/supertonic/onnx`와 `models/supertonic/voice_styles`를 준비한 뒤 앱을 재실행해 주세요.'
        : 'Supertonic model files are missing. Prepare `models/supertonic/onnx` and `models/supertonic/voice_styles`, then restart the app.';

  const showVoiceCommandFeedback = useCallback(async (
    message: string,
    emotion: Emotion = 'happy',
    speakOut = true
  ) => {
    addMessage({ role: 'assistant', content: message });
    setCurrentResponse(message);
    setEmotion(emotion);

    if (speakOut) {
      setStatus('speaking');
      try {
        await speak(message);
      } catch (err) {
        log('Voice command TTS error:', err);
      }
      setStatus('idle');
    } else {
      setStatus('idle');
    }

    const responseHoldMs = Math.max(
      emotionTuningGlobal.responseClearMs,
      getEmotionTuning(emotion).expressionHoldMs
    );
    setTimeout(() => {
      setEmotion('neutral');
      clearCurrentResponse();
    }, responseHoldMs);
  }, [addMessage, setCurrentResponse, setEmotion, setStatus, speak, clearCurrentResponse]);

  const triggerEmotionMotion = useCallback(
    (emotion: Emotion, score: number, text: string, preferSpeakingContext = false) => {
      const settingsState = useSettingsStore.getState().settings;
      const avatarState = useAvatarStore.getState();
      const conversationState = useConversationStore.getState();
      const faceOnlyModeEnabled =
        settingsState.avatar?.animation?.faceExpressionOnlyMode ?? false;
      const clipsEnabled = settingsState.avatar?.animation?.enableMotionClips ?? true;
      const gesturesEnabled = settingsState.avatar?.animation?.enableGestures ?? true;
      const diversityStrength = settingsState.avatar?.animation?.motionDiversity ?? 1;
      const dynamicMotionEnabled =
        settingsState.avatar?.animation?.dynamicMotionEnabled ?? false;
      const dynamicMotionBoost = dynamicMotionEnabled
        ? settingsState.avatar?.animation?.dynamicMotionBoost ?? 1.0
        : 0;

      if (faceOnlyModeEnabled) {
        return;
      }

      if (clipsEnabled) {
        const selection = selectMotionClip({
          emotion,
          emotionScore: score,
          isSpeaking: preferSpeakingContext || conversationState.status === 'speaking',
          isMoving: avatarState.isMoving,
          diversityStrength,
          dynamicBoost: dynamicMotionBoost,
          recentMotionIds: avatarState.recentMotionIds,
          cooldownMap: avatarState.motionCooldownMap,
          now: Date.now(),
        });

        if (selection.selected) {
          registerMotionSelection(selection.selected.id, selection.selected.cooldown_ms);
          triggerMotionClip(selection.selected.id);
          return;
        }
      }

      const fallbackGesture = pickGesture(emotion, text);
      if (gesturesEnabled && fallbackGesture) {
        triggerGesture(fallbackGesture);
      }
    },
    [registerMotionSelection, triggerGesture, triggerMotionClip]
  );

  useEffect(() => {
    let cancelled = false;

    const checkRemoteEnvironment = async () => {
      if (!isTauriDesktopRuntime()) {
        if (!cancelled) {
          setIsRemoteSession(false);
        }
        return;
      }

      try {
        const result = await invoke<RemoteEnvironmentResult>('detect_remote_environment');
        if (!cancelled) {
          setIsRemoteSession(Boolean(result?.isRemote));
          if (result?.isRemote) {
            log('Remote session detected:', result.detector || 'unknown', result.reason || '');
          }
        }
      } catch (err) {
        log('Failed to detect remote environment:', err);
        if (!cancelled) {
          setIsRemoteSession(false);
        }
      }
    };

    void checkRemoteEnvironment();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkLocalWhisperAvailability = async () => {
      if (runtimeVoiceInputBlockReason) {
        if (!cancelled) {
          setIsLocalWhisperAvailable(false);
          setWhisperStatus(null);
          setHasCheckedLocalWhisper(true);
        }
        return;
      }

      if (!isTauriDesktopRuntime()) {
        if (!cancelled) {
          setIsLocalWhisperAvailable(false);
          setWhisperStatus(null);
          setHasCheckedLocalWhisper(true);
        }
        return;
      }

      try {
        const detail = await invoke<WhisperAvailabilityStatus>('get_whisper_availability', {
          model: settings.stt.model || 'base',
        });
        if (!cancelled) {
          setWhisperStatus(detail);
          setIsLocalWhisperAvailable(Boolean(detail.cliFound && detail.modelFound));
          setHasCheckedLocalWhisper(true);
        }
        return;
      } catch (err) {
        log('Failed to check detailed Whisper availability:', err);
      }

      try {
        const available = await invoke<boolean>('check_whisper_available');
        if (!cancelled) {
          setWhisperStatus(
            available
              ? { cliFound: true, modelFound: true }
              : null
          );
          setIsLocalWhisperAvailable(available);
        }
      } catch (fallbackErr) {
        log('Failed to run fallback Whisper availability check:', fallbackErr);
        if (!cancelled) {
          setWhisperStatus(null);
          // If runtime check fails unexpectedly, allow attempting STT and report concrete errors on use.
          setIsLocalWhisperAvailable(true);
        }
      } finally {
        if (!cancelled) {
          setHasCheckedLocalWhisper(true);
        }
      }
    };

    void checkLocalWhisperAvailability();

    return () => {
      cancelled = true;
    };
  }, [runtimeVoiceInputBlockReason, settings.stt.model, modelStatus?.whisperBaseReady]);

  useEffect(() => {
    let cancelled = false;

    const checkTtsAvailability = async () => {
      try {
        const available = await ttsRouter.isAvailable();
        if (!cancelled) {
          setIsSupertonicAvailable(available);
        }
      } catch (err) {
        log('Failed to check Supertonic availability:', err);
        if (!cancelled) {
          setIsSupertonicAvailable(false);
        }
      }
    };

    void checkTtsAvailability();

    return () => {
      cancelled = true;
    };
  }, [modelStatus?.supertonicReady]);

  const transcribeWithLocalWhisper = useCallback(async (audioData: ArrayBuffer): Promise<string> => {
    const audioBase64 = arrayBufferToBase64(audioData);
    const result = await invoke<LocalTranscriptionResult>('transcribe_audio', {
      audioBase64,
      model: settings.stt.model || 'base',
      language: settings.language,
    });
    return result.text?.trim() || '';
  }, [settings.stt.model, settings.language]);

  const handleVoiceCommand = useCallback(async (text: string): Promise<boolean> => {
    const command = parseVoiceCommand(text);
    if (!command) return false;

    log('Voice command detected:', command.type, 'from:', text);
    setError(null);
    setNeedsMicrophonePermission(false);

    const getCurrentLanguage = () => useSettingsStore.getState().settings.language;

    switch (command.type) {
      case 'open-settings': {
        openSettings();
        await showVoiceCommandFeedback(getVoiceCommandResponse(command.type, getCurrentLanguage()));
        return true;
      }
      case 'close-settings': {
        closeSettings();
        await showVoiceCommandFeedback(getVoiceCommandResponse(command.type, getCurrentLanguage()));
        return true;
      }
      case 'open-microphone-settings': {
        try {
          await permissions.openMicrophoneSettings();
          await showVoiceCommandFeedback(getVoiceCommandResponse(command.type, getCurrentLanguage()));
        } catch (err) {
          log('Failed to open microphone settings from voice command:', err);
          const fallbackMessage = getCurrentLanguage() === 'en'
            ? 'Failed to open microphone settings. Please open system settings manually.'
            : '마이크 설정을 열지 못했어. 시스템 설정에서 직접 확인해줘.';
          await showVoiceCommandFeedback(fallbackMessage, 'sad');
        }
        return true;
      }
      case 'clear-messages': {
        clearMessages();
        clearCurrentResponse();
        await showVoiceCommandFeedback(getVoiceCommandResponse(command.type, getCurrentLanguage()));
        return true;
      }
      case 'stop-speaking': {
        ttsQueue.flush();
        stopSpeaking();
        clearCurrentResponse();
        await showVoiceCommandFeedback(
          getVoiceCommandResponse(command.type, getCurrentLanguage()),
          'neutral',
          false
        );
        return true;
      }
      case 'set-language-ko': {
        setLanguage('ko');
        await showVoiceCommandFeedback(getVoiceCommandResponse(command.type, 'ko'));
        return true;
      }
      case 'set-language-en': {
        setLanguage('en');
        await showVoiceCommandFeedback(getVoiceCommandResponse(command.type, 'en'));
        return true;
      }
      case 'show-help': {
        await showVoiceCommandFeedback(getVoiceCommandResponse(command.type, getCurrentLanguage()));
        return true;
      }
      default:
        return false;
    }
  }, [
    openSettings,
    closeSettings,
    setLanguage,
    clearMessages,
    clearCurrentResponse,
    stopSpeaking,
    showVoiceCommandFeedback,
  ]);

  // Send message to LLM and get response
  const sendMessage = useCallback(async (text: string) => {
    log('sendMessage called with:', text);

    if (!text.trim()) {
      log('Empty text, returning');
      return;
    }

    // Claude Code / Codex: 비동기 처리 (fire-and-forget, 입력 비차단)
    const currentProvider = useSettingsStore.getState().settings.llm.provider;
    if (isClaudeCodeProvider() || currentProvider === 'codex') {
      setError(null);
      sendToClaudeCode(text, (errMsg) => setError(errMsg));
      return;
    }

    if (isProcessingRef.current) {
      log('Already processing, returning');
      return;
    }

    const currentCharacter = useSettingsStore.getState().settings.character;
    const archetype = currentCharacter?.personality?.archetype;
    const userEmotionMatch = analyzeEmotion(text, archetype);
    if (userEmotionMatch.score > 0) {
      setEmotion(userEmotionMatch.emotion);
      triggerEmotionMotion(userEmotionMatch.emotion, userEmotionMatch.score, text);
    }

    isProcessingRef.current = true;
    setError(null);
    setStatus('processing');
    if (userEmotionMatch.score === 0) {
      setEmotion('thinking');
    }

    // Add user message
    addMessage({ role: 'user', content: text });

    try {
      // Get current messages + memory from store (fresh)
      const storeState = useConversationStore.getState();
      const currentMessages = storeState.messages;
      const currentMemory = storeState.memory;

      const systemPrompt = currentCharacter?.name || currentCharacter?.personality?.traits?.length
        ? buildCharacterPrompt(currentCharacter)
        : buildSystemPrompt(settings.avatarName || '', settings.avatarPersonalityPrompt || '');

      // Phase 2: 메모리 기반 메시지 윈도우 구성
      const { memoryContext, recentMessages } = buildMessageWindow(currentMessages, currentMemory);

      // 시스템 프롬프트에 메모리 컨텍스트 결합
      const fullSystemPrompt = memoryContext
        ? `${systemPrompt}\n\n${memoryContext}`
        : systemPrompt;

      const llmMessages: LLMMessage[] = [
        { role: 'system', content: fullSystemPrompt },
        ...recentMessages,
      ];

      log('Sending to LLM:', llmMessages.length, 'messages (window:', recentMessages.length, ')');

      // Screen analysis request route (Vision models only) — 스트리밍 미적용
      let responseText = '';
      if (isScreenRequest(text)) {
        try {
          responseText = await screenAnalyzer.helpWithScreen(text);
        } catch (screenError) {
          const message = screenError instanceof Error ? screenError.message : String(screenError);
          if (message.includes('Vision not supported')) {
            throw new Error('화면 분석은 Claude/OpenAI/Gemini 제공자에서만 지원됩니다.');
          }
          throw screenError;
        }
      } else {
        // ── 스트리밍 응답 + TTS 큐 파이프라인 (Phase 1) ──
        setStreamingResponse('');
        setCurrentResponse('');
        setStatus('speaking');

        // 립싱크 헬퍼 (TTS 큐에서 문장 재생 시 사용)
        let lipSyncInterval: ReturnType<typeof setInterval> | null = null;
        const startLipSync = () => {
          if (lipSyncInterval) return;
          let phase = 0;
          lipSyncInterval = setInterval(() => {
            phase += 0.3;
            const v = Math.abs(Math.sin(phase)) * 0.7 + Math.random() * 0.3;
            useAvatarStore.getState().setLipSyncValue(Math.min(1, v));
          }, 80);
        };
        const stopLipSync = () => {
          if (lipSyncInterval) {
            clearInterval(lipSyncInterval);
            lipSyncInterval = null;
          }
          useAvatarStore.getState().setLipSyncValue(0);
        };

        // TTS 큐 시작
        ttsQueue.start({
          ttsOptions: { voice: settings.tts.voice },
          onLipSyncStart: startLipSync,
          onLipSyncStop: stopLipSync,
        });

        // 실시간 감정 추적
        let lastDetectedEmotion: Emotion = 'neutral';

        responseText = await new Promise<string>((resolve, reject) => {
          llmRouter.chatStream(
            llmMessages,
            {
              onToken: (token) => {
                appendStreamingToken(token);
                // 말풍선 실시간 업데이트
                const accumulated = (useConversationStore.getState().streamingResponse ?? '') ;
                setCurrentResponse(accumulated);
                // TTS 큐에 토큰 전달 (문장 종결 시 자동 재생)
                ttsQueue.pushToken(token);
                // 실시간 감정 분석 (누적 텍스트 기반, 매 토큰마다는 비효율 → 50자마다)
                if (accumulated.length % 50 < token.length) {
                  const emotionMatch = analyzeEmotion(accumulated, archetype);
                  if (emotionMatch.score > 0 && emotionMatch.emotion !== lastDetectedEmotion) {
                    lastDetectedEmotion = emotionMatch.emotion;
                    setEmotion(emotionMatch.emotion);
                    triggerEmotionMotion(emotionMatch.emotion, emotionMatch.score, accumulated, true);
                  }
                }
              },
              onComplete: (fullResponse) => {
                log('Streaming complete:', fullResponse.substring(0, 50) + '...');
                resolve(fullResponse);
              },
              onError: (error) => {
                reject(error);
              },
            },
            { temperature: 0.7, maxTokens: 1024 }
          );
        });

        // TTS 큐 잔여분 재생 완료 대기
        await ttsQueue.complete();
        stopLipSync();
        setStreamingResponse(null);
      }

      setError(null);

      const responseEmotionMatch = analyzeEmotion(responseText, archetype);
      const responseEmotion =
        responseEmotionMatch.score > 0 ? responseEmotionMatch.emotion : 'neutral';
      const faceOnlyModeEnabled =
        useSettingsStore.getState().settings.avatar?.animation?.faceExpressionOnlyMode ?? false;

      if (responseEmotionMatch.score > 0) {
        setEmotion(responseEmotionMatch.emotion);
        triggerEmotionMotion(
          responseEmotionMatch.emotion,
          responseEmotionMatch.score,
          responseText,
          true
        );
        if (!faceOnlyModeEnabled && responseEmotionMatch.emotion === 'happy') {
          startDancing();
          setTimeout(() => stopDancing(), emotionTuningGlobal.happyDanceMs);
        }
      } else {
        stopDancing();
      }

      // Add assistant message and set final response
      addMessage({ role: 'assistant', content: responseText });
      setCurrentResponse(responseText);

      // 화면 분석의 경우만 별도 TTS (스트리밍은 이미 큐에서 재생됨)
      if (isScreenRequest(text)) {
        setStatus('speaking');
        await new Promise(resolve => setTimeout(resolve, 50));
        try {
          await speak(responseText, { emotion: responseEmotion });
          log('TTS completed');
        } catch (ttsErr) {
          log('TTS error:', ttsErr);
        }
      }

      // Phase 2: 비동기 메모리 요약 (UI 차단 없이 백그라운드 실행)
      void (async () => {
        try {
          const freshMessages = useConversationStore.getState().messages;
          const freshMemory = useConversationStore.getState().memory;
          const updated = await summarizeIfNeeded(freshMessages, freshMemory);
          if (updated) {
            setMemory(updated);
            log('Memory updated: summary length', updated.summary.length, 'facts', updated.importantFacts.length);
          }
        } catch (err) {
          log('Memory summarization error (non-fatal):', err);
        }
      })();

      // Keep response visible
      setStatus('idle');
      const responseHoldMs = Math.max(
        emotionTuningGlobal.responseClearMs,
        getEmotionTuning(responseEmotion).expressionHoldMs
      );
      setTimeout(() => {
        setEmotion('neutral');
        clearCurrentResponse();
        log('Response cleared after', responseHoldMs, 'ms');
      }, responseHoldMs);
    } catch (err) {
      log('LLM error:', err);
      ttsQueue.flush();
      setStreamingResponse(null);
      const rawErrorMessage = err instanceof Error ? err.message : 'Failed to get response';
      const isRateLimit = /\b429\b|rate.?limit|quota|resource_exhausted|too many requests/i.test(rawErrorMessage);
      const providerLabel =
        settings.llm.provider === 'gemini'
          ? 'Gemini'
          : settings.llm.provider === 'openai'
            ? 'OpenAI'
            : settings.llm.provider === 'claude'
              ? 'Claude'
              : settings.llm.provider === 'ollama'
                ? 'Ollama'
                : 'LocalAI';
      const errorMessage = isRateLimit
        ? `${providerLabel} API 요청 한도를 초과했습니다(429). 설정에서 사용 가능한 모델/Provider를 선택하거나 잠시 후 다시 시도해 주세요.`
        : rawErrorMessage;
      setError(errorMessage);
      setStatus('error');
      setEmotion('sad');
      stopDancing();

      // Reset after error
      setTimeout(() => {
        setStatus('idle');
        setEmotion('neutral');
      }, emotionTuningGlobal.idleNeutralDelayMs);
    } finally {
      isProcessingRef.current = false;
    }
  }, [
    addMessage,
    settings.character,
    settings.avatarName,
    settings.avatarPersonalityPrompt,
    settings.tts.voice,
    setCurrentResponse,
    setStreamingResponse,
    appendStreamingToken,
    clearCurrentResponse,
    setStatus,
    setEmotion,
    speak,
    triggerEmotionMotion,
    startDancing,
    stopDancing,
    sendToClaudeCode,
    isClaudeCodeProvider,
  ]);

  const handleRecognizedInput = useCallback(async (text: string) => {
    const isCommandHandled = await handleVoiceCommand(text);
    if (!isCommandHandled) {
      await sendMessage(text);
    }
  }, [handleVoiceCommand, sendMessage]);

  useEffect(() => {
    return () => {
      if (localRecordingRef.current) {
        localRecordingRef.current = false;
        void audioProcessor.stopRecording().catch(() => {});
      }
      audioProcessor.dispose();
    };
  }, []);

  // Start voice recognition (local Whisper only)
  const startListening = useCallback(async () => {
    if (isListening || isProcessingRef.current) return;

    if (!isVoiceInputSupported) {
      const reason = voiceInputUnavailableReason || '현재 환경에서는 음성 인식을 지원하지 않습니다.';
      log('STT blocked by runtime policy:', reason);
      setError(reason);
      setNeedsMicrophonePermission(false);
      setStatus('error');
      setEmotion('sad');
      return;
    }

    // Stop any ongoing speech + streaming TTS queue
    ttsQueue.flush();
    stopSpeaking();
    clearCurrentResponse();
    setError(null);
    setNeedsMicrophonePermission(false);

    if (!hasLocalWhisper) {
      setError(voiceInputUnavailableReason || 'Whisper 로컬 음성 인식을 사용할 수 없습니다.');
      setStatus('error');
      setEmotion('sad');
      return;
    }

    try {
      // 선택된 마이크가 변경되었으면 재초기화
      const selectedDeviceId = useSettingsStore.getState().settings.stt.audioInputDeviceId;
      if (audioProcessor.getDeviceId() !== selectedDeviceId) {
        await audioProcessor.reinitialize(selectedDeviceId);
        // 폴백 발생 시 (선택 디바이스 분리 등) 설정도 동기화하여 반복 재초기화 방지
        if (selectedDeviceId && audioProcessor.getDeviceId() !== selectedDeviceId) {
          useSettingsStore.getState().setSTTSettings({ audioInputDeviceId: audioProcessor.getDeviceId() });
        }
      }

      await audioProcessor.startRecording();
      localRecordingRef.current = true;
      setTranscript('');
      setIsListening(true);
      setStatus('listening');
      setEmotion('neutral');
      log('Local Whisper recording started');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log('Local Whisper recording failed:', message);
      const permissionDenied = /permission|not.?allowed|denied|disallowed/i.test(message);
      setNeedsMicrophonePermission(permissionDenied);
      setError(permissionDenied ? '마이크 권한이 필요합니다.' : `로컬 음성 인식을 시작할 수 없습니다: ${message}`);
      setStatus('error');
      setEmotion('sad');
    }
  }, [
    isListening,
    hasLocalWhisper,
    isVoiceInputSupported,
    voiceInputUnavailableReason,
    setStatus,
    stopSpeaking,
    clearCurrentResponse,
    setEmotion,
  ]);

  // Stop voice recognition
  const stopListening = useCallback(() => {
    log('stopListening called');
    if (localRecordingRef.current) {
      localRecordingRef.current = false;
      setIsListening(false);
      setTranscript('');
      setStatus('processing');
      setEmotion('thinking');

      void (async () => {
        try {
          const audioData = await audioProcessor.stopRecording();
          const recognizedText = await transcribeWithLocalWhisper(audioData);

          if (!recognizedText) {
            setStatus('idle');
            setEmotion('neutral');
            return;
          }

          setTranscript(recognizedText);
          await handleRecognizedInput(recognizedText);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log('Local Whisper transcription failed:', message);
          const permissionDenied = /permission|not.?allowed|denied|disallowed/i.test(message);
          setNeedsMicrophonePermission(permissionDenied);
          setError(permissionDenied ? '마이크 권한이 필요합니다.' : `로컬 음성 인식 오류: ${message}`);
          setStatus('error');
          setEmotion('sad');
        }
      })();

      return;
    }

    setIsListening(false);
    setStatus('idle');
    setTranscript('');
    setEmotion('neutral');
  }, [
    setStatus,
    setEmotion,
    handleRecognizedInput,
    transcribeWithLocalWhisper,
  ]);

  // Open microphone settings
  const openMicrophoneSettings = useCallback(async () => {
    console.log('[useConversation] Opening microphone settings...');
    try {
      await permissions.openMicrophoneSettings();
      console.log('[useConversation] Microphone settings opened successfully');
    } catch (err) {
      console.error('[useConversation] Failed to open microphone settings:', err);
    }
  }, []);

  return {
    isListening,
    isProcessing,
    isSpeaking,
    transcript,
    error,
    needsMicrophonePermission,
    isVoiceInputSupported,
    isVoiceInputRuntimeBlocked,
    voiceInputUnavailableReason,
    ttsUnavailableReason,
    startListening,
    stopListening,
    sendMessage,
    openMicrophoneSettings,
  };
}

export default useConversation;
