import { useState, useCallback, useRef, useEffect } from 'react';
import { useConversationStore } from '../stores/conversationStore';
import { useAvatarStore, type Emotion, type GestureType } from '../stores/avatarStore';
import { useSettingsStore, type Language } from '../stores/settingsStore';
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

// Helper function to log to terminal
const log = (...args: any[]) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  console.log('[useConversation]', ...args);
  invoke('log_to_terminal', { message: `[useConversation] ${message}` }).catch(() => {});
};

function buildSystemPrompt(avatarName: string): string {
  const normalizedName = avatarName.trim() || '아바타';
  return `당신은 "${normalizedName}"이라는 이름의 친근하고 귀여운 AI 어시스턴트입니다.
성격: 밝고 긍정적이며, 사용자를 친구처럼 대합니다.
말투: 반말을 사용하고, 짧고 자연스러운 대화체로 말합니다.
특징:
- 이모티콘은 사용하지 않습니다
- 답변은 2-3문장 정도로 짧게 합니다
- 공감과 감정 표현을 잘합니다
- 한국어로 대화합니다`;
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
  const isKo = language === 'ko';
  const normalizedModel = model?.trim() || 'base';
  const modelFileName = normalizedModel.endsWith('.bin')
    ? normalizedModel
    : `ggml-${normalizedModel}.bin`;
  if (!status) {
    return isKo
      ? 'Whisper 엔진 상태 확인에 실패했습니다. 앱을 다시 실행한 뒤 다시 시도해 주세요.'
      : 'Failed to verify Whisper runtime status. Restart the app and try again.';
  }

  const missingCli = !status || !status.cliFound;
  const missingModel = !status || !status.modelFound;

  const cliGuide = isKo
    ? '내장 Whisper 런타임을 찾지 못했습니다. 최신 배포본으로 재설치 후 다시 실행해 주세요. (개발 환경에서는 `brew install whisper-cpp`로 대체 가능)'
    : 'Bundled Whisper runtime is missing. Reinstall the latest app build and restart. (For dev setup, install with `brew install whisper-cpp`.)';

  const modelGuide = isKo
    ? `모델 파일 미설치: \`${modelFileName}\`을 \`models/whisper/\`에 배치하거나 \`WHISPER_MODEL_PATH\`를 설정하세요.`
    : `Model is missing: place \`${modelFileName}\` under \`models/whisper/\` or set \`WHISPER_MODEL_PATH\`.`;

  if (missingCli && missingModel) {
    return `${cliGuide} ${modelGuide}`;
  }

  if (missingCli) return cliGuide;
  if (missingModel) return modelGuide;

  return isKo
    ? 'Whisper 로컬 음성 인식 엔진을 확인하지 못했습니다.'
    : 'Unable to verify local Whisper dependencies.';
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
    return language === 'ko'
      ? '로컬 음성 인식 엔진 확인 중입니다. 잠시만 기다려 주세요.'
      : 'Checking local speech recognition dependencies...';
  }

  return getWhisperInstallGuide(whisperStatus, language, model);
}

function isScreenRequest(text: string): boolean {
  return /(화면|스크린|screen)/i.test(text);
}

interface EmotionMatch {
  emotion: Emotion;
  score: number;
}

const EMOTION_KEYWORDS: Record<Emotion, string[]> = {
  neutral: [],
  happy: ['happy', 'great', 'love', 'awesome', '좋아', '행복', '기뻐', '최고', '고마워'],
  sad: ['sad', 'sorry', 'unfortunately', '슬퍼', '미안', '힘들', '우울', '걱정'],
  angry: ['angry', 'annoyed', 'frustrated', '화나', '짜증', '열받', '빡쳐'],
  surprised: ['wow', 'surprised', 'amazing', '대박', '놀라', '헉', '와'],
  relaxed: ['calm', 'relaxed', 'peaceful', '차분', '편안', '여유'],
  thinking: ['think', 'maybe', 'hmm', '음', '생각', '고민', '글쎄'],
};

function analyzeEmotion(text: string): EmotionMatch {
  const normalized = text.toLowerCase();
  let best: EmotionMatch = { emotion: 'neutral', score: 0 };

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS) as [Emotion, string[]][]) {
    if (emotion === 'neutral') continue;
    let score = 0;
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) score += 1;
    }
    if (score > best.score) {
      best = { emotion, score };
    }
  }

  return best;
}

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

  const {
    addMessage,
    setCurrentResponse,
    setStatus,
    clearCurrentResponse,
    clearMessages,
    isProcessing,
    isSpeaking,
  } = useConversationStore();

  const { setEmotion, triggerGesture, startDancing, stopDancing } = useAvatarStore();
  const { speak, stop: stopSpeaking } = useSpeechSynthesis();
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
  }, [runtimeVoiceInputBlockReason, settings.stt.model]);

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
  }, []);

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

    if (isProcessingRef.current) {
      log('Already processing, returning');
      return;
    }

    const userEmotionMatch = analyzeEmotion(text);
    if (userEmotionMatch.score > 0) {
      setEmotion(userEmotionMatch.emotion);
      const userGesture = pickGesture(userEmotionMatch.emotion, text);
      if (userGesture) {
        triggerGesture(userGesture);
      }
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
      // Get current messages from store (fresh)
      const currentMessages = useConversationStore.getState().messages;

      const systemPrompt = buildSystemPrompt(settings.avatarName || '');

      // Prepare messages for LLM (convert conversation store format to LLM format)
      const llmMessages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        ...currentMessages.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
      ];

      log('Sending to LLM:', llmMessages.length, 'messages');

      // Screen analysis request route (Vision models only)
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
        const response = await llmRouter.chat(llmMessages, {
          temperature: 0.7,
          maxTokens: 200,
        });
        responseText = response.content;
        log('LLM response received:', response.content?.substring(0, 50) + '...');
      }

      setError(null);

      const responseEmotionMatch = analyzeEmotion(responseText);
      const responseEmotion =
        responseEmotionMatch.score > 0 ? responseEmotionMatch.emotion : 'neutral';

      if (responseEmotionMatch.score > 0) {
        setEmotion(responseEmotionMatch.emotion);
        const responseGesture = pickGesture(responseEmotionMatch.emotion, responseText);
        if (responseGesture) {
          triggerGesture(responseGesture);
        }
        if (responseEmotionMatch.emotion === 'happy') {
          startDancing();
          setTimeout(() => stopDancing(), emotionTuningGlobal.happyDanceMs);
        }
      } else {
        stopDancing();
      }

      // Add assistant message and show popup immediately
      addMessage({ role: 'assistant', content: responseText });
      setCurrentResponse(responseText);
      setStatus('speaking');
      log('Popup shown, starting TTS...');

      // Small delay to ensure React state update is rendered before TTS starts
      await new Promise(resolve => setTimeout(resolve, 50));

      // Speak the response
      try {
        await speak(responseText);
        log('TTS completed');
      } catch (ttsErr) {
        log('TTS error:', ttsErr);
      }

      // Keep response visible for 5 seconds after speaking
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
  }, [addMessage, settings.avatarName, setCurrentResponse, clearCurrentResponse, setStatus, setEmotion, speak, triggerGesture, startDancing, stopDancing]);

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

    // Stop any ongoing speech
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
