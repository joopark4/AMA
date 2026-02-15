import { useState, useCallback, useRef, useEffect } from 'react';
import { useConversationStore } from '../stores/conversationStore';
import { useAvatarStore, type Emotion, type GestureType } from '../stores/avatarStore';
import { useSettingsStore } from '../stores/settingsStore';
import { llmRouter } from '../services/ai/llmRouter';
import { screenAnalyzer } from '../services/ai/screenAnalyzer';
import { useSpeechSynthesis } from './useSpeechSynthesis';
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

// System prompt for the AI assistant
const SYSTEM_PROMPT = `당신은 "은연"이라는 이름의 친근하고 귀여운 AI 어시스턴트입니다.
성격: 밝고 긍정적이며, 사용자를 친구처럼 대합니다.
말투: 반말을 사용하고, 짧고 자연스러운 대화체로 말합니다.
특징:
- 이모티콘은 사용하지 않습니다
- 답변은 2-3문장 정도로 짧게 합니다
- 공감과 감정 표현을 잘합니다
- 한국어로 대화합니다`;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
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

interface UseConversationReturn {
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  transcript: string;
  error: string | null;
  needsMicrophonePermission: boolean;
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

  const isProcessingRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { settings } = useSettingsStore();

  const {
    addMessage,
    setCurrentResponse,
    setStatus,
    clearCurrentResponse,
    isProcessing,
    isSpeaking,
  } = useConversationStore();

  const { setEmotion, triggerGesture, startDancing, stopDancing } = useAvatarStore();
  const { speak, stop: stopSpeaking } = useSpeechSynthesis();

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

      // Prepare messages for LLM (convert conversation store format to LLM format)
      const llmMessages: LLMMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to get response';
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
  }, [addMessage, setCurrentResponse, clearCurrentResponse, setStatus, setEmotion, speak, triggerGesture, startDancing, stopDancing]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  // Start voice recognition (Web Speech API)
  const startListening = useCallback(async () => {
    if (isListening || isProcessingRef.current) return;

    // Stop any ongoing speech
    stopSpeaking();
    clearCurrentResponse();
    setError(null);
    setNeedsMicrophonePermission(false);

    const hasMicAccess = await permissions.requestMicrophoneAccess();
    if (!hasMicAccess) {
      setNeedsMicrophonePermission(true);
      setError('마이크 권한이 필요합니다.');
      setStatus('error');
      setEmotion('sad');
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      setError('현재 환경에서는 음성 인식을 지원하지 않습니다. 텍스트 입력을 사용해 주세요.');
      setStatus('error');
      setEmotion('sad');
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = settings.language === 'ko' ? 'ko-KR' : 'en-US';

    recognition.onstart = () => {
      log('STT started');
      setTranscript('');
      setIsListening(true);
      setStatus('listening');
      setEmotion('neutral');
    };

    recognition.onresult = (event) => {
      let interimText = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const chunk = result[0]?.transcript?.trim() || '';
        if (!chunk) continue;
        if (result.isFinal) {
          finalText += `${finalText ? ' ' : ''}${chunk}`;
        } else {
          interimText += `${interimText ? ' ' : ''}${chunk}`;
        }
      }

      if (interimText) {
        setTranscript(interimText);
      }

      if (finalText) {
        const normalized = finalText.trim();
        setTranscript(normalized);
        recognition.stop();
        void sendMessage(normalized);
      }
    };

    recognition.onerror = (event) => {
      log('STT error:', event.error, event.message);
      setIsListening(false);

      if (event.error === 'aborted') return;

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setNeedsMicrophonePermission(true);
        setError('마이크 권한이 필요합니다.');
      } else {
        setError(`음성 인식 오류: ${event.error}`);
      }

      setStatus('error');
      setEmotion('sad');
    };

    recognition.onend = () => {
      log('STT ended');
      setIsListening(false);
      setTranscript('');
      if (useConversationStore.getState().status === 'listening') {
        setStatus('idle');
        setEmotion('neutral');
      }
    };

    try {
      recognition.start();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`음성 인식을 시작할 수 없습니다: ${message}`);
      setStatus('error');
      setEmotion('sad');
    }
  }, [isListening, setStatus, stopSpeaking, clearCurrentResponse, sendMessage, settings.language, setEmotion]);

  // Stop voice recognition
  const stopListening = useCallback(() => {
    log('stopListening called');
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setStatus('idle');
    setTranscript('');
    setEmotion('neutral');
  }, [setStatus, setEmotion]);

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
    startListening,
    stopListening,
    sendMessage,
    openMicrophoneSettings,
  };
}

export default useConversation;
